import * as THREE from 'three'
import { AIR, WATER, BLOCKS, isSolid, isLiquid, isReplaceable, PARTICLE_COLORS } from './blocks.js'
import { createBlockGeometry } from './blockmesh.js'
import { tileUV } from './textures.js'

const EPS = 0.0001
const PLAYER_WIDTH = 0.6
const PLAYER_HEIGHT = 1.8
const EYE_HEIGHT = 1.62

export class Player {
  constructor({ world, camera, canvas, atlas, audio, particles, spawn }) {
    this.world = world
    this.camera = camera
    this.canvas = canvas
    this.atlas = atlas
    this.audio = audio
    this.particles = particles
    this.spawn = spawn

    this.pos = new THREE.Vector3(spawn.x, spawn.y, spawn.z)
    this.vel = new THREE.Vector3()
    this.yaw = 0
    this.pitch = 0
    this.width = PLAYER_WIDTH
    this.height = PLAYER_HEIGHT
    this.eyeHeight = EYE_HEIGHT
    this.onGround = false
    this.flying = false
    this.sprinting = false
    this.sneaking = false
    this.inWater = false
    this.headInWater = false
    this.enabled = false
    this.sensitivity = 1
    this.baseFov = 75
    this.health = 20
    this.maxHealth = 20
    this.air = 10
    this.maxAir = 10
    this.invuln = 0
    this.lastDamage = -99
    this.regenTimer = 0
    this.breakHeld = false
    this.breakProgress = 0
    this.breakTarget = null
    this.placeCooldown = 0
    this.swing = 0
    this.bobPhase = 0
    this.bobAmount = 0
    this.fallStart = null
    this.jumpQueued = false
    this.jumpHeld = false
    this.lastSpace = -10
    this.touchForward = 0
    this.touchStrafe = 0
    this.touchMode = false
    this.keys = new Set()
    this.target = null
    this.hotbar = [1, 4, 10, 8, 9, 11, 21, 19, 43]
    this.selected = 0
    this.callbacks = {}
    this.time = 0
    this.stepTimer = 0
    this.lastBlockSound = 'grass'

    this.handGroup = new THREE.Group()
    this.handGroup.position.set(0.36, -0.36, -0.8)
    this.handGroup.rotation.set(0.06, 0.55, -0.06)
    this.camera.add(this.handGroup)
    this.handMesh = null
    this.handMat = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      vertexColors: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
    })
    this.handSpriteMat = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
    })

    const highlightGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006))
    this.highlight = new THREE.LineSegments(highlightGeo, new THREE.LineBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.55,
      depthTest: true,
    }))
    this.highlight.visible = false
    this.highlight.renderOrder = 5
    this.camera.parent?.add(this.highlight)

    this.crackMat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      side: THREE.DoubleSide,
    })
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.008, 1.008, 1.008), this.crackMat)
    this.crack.visible = false
    this.crack.renderOrder = 6
    this.camera.parent?.add(this.crack)

    this.rebuildHand()
    this.bindKeys()
  }

  on(event, fn) {
    this.callbacks[event] = fn
  }

  emit(event, ...args) {
    this.callbacks[event]?.(...args)
  }

  get selectedId() {
    return this.hotbar[this.selected] || 0
  }

  get eyePosition() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z)
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return
      if (e.code === 'F3' || e.code === 'KeyE' || e.code === 'Escape') return
      const digit = /^Digit([1-9])$/.exec(e.code)
      if (digit) {
        this.setSelected(Number(digit[1]) - 1)
        return
      }
      if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' ||
          e.code === 'ShiftLeft' || e.code === 'ShiftRight' ||
          e.code === 'ControlLeft' || e.code === 'ControlRight') {
        this.keys.add(e.code)
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault()
      }
      if (e.code === 'Space') {
        e.preventDefault()
        this.jumpHeld = true
        if (!e.repeat) {
          const now = performance.now() / 1000
          if (now - this.lastSpace < 0.3) {
            this.toggleFly()
            this.lastSpace = -10
          } else {
            this.lastSpace = now
            this.jumpQueued = true
          }
        }
      }
      if (e.code === 'KeyF' && !e.repeat) this.toggleFly()
    }, { passive: false })

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
      if (e.code === 'Space') this.jumpHeld = false
    })

    window.addEventListener('blur', () => {
      this.keys.clear()
      this.jumpHeld = false
      this.endPrimary()
    })

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.enabled) return
      if (document.pointerLockElement === this.canvas) {
        this.look(e.movementX, e.movementY)
      }
    })

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.canvas) return
      if (e.button === 0) this.beginPrimary()
      else if (e.button === 2) this.placeBlock()
      else if (e.button === 1) {
        e.preventDefault()
        this.pickBlock()
      }
    })

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.endPrimary()
    })

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    this.canvas.addEventListener('wheel', (e) => {
      if (!this.enabled) return
      e.preventDefault()
      this.cycle(e.deltaY > 0 ? 1 : -1)
    }, { passive: false })
  }

  setEnabled(value) {
    this.enabled = value
    if (!value) {
      this.keys.clear()
      this.jumpHeld = false
      this.endPrimary()
      this.highlight.visible = false
    }
  }

  look(dx, dy) {
    if (!this.enabled) return
    const scale = 0.0022 * this.sensitivity
    this.yaw -= dx * scale
    this.pitch -= dy * scale
    const limit = Math.PI / 2 - 0.015
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch))
    this.yaw = ((this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
  }

  setSelected(index) {
    const next = ((index % 9) + 9) % 9
    if (next === this.selected) return
    this.selected = next
    this.rebuildHand()
    this.emit('select', this.selected)
  }

  cycle(delta) {
    this.setSelected(this.selected + delta)
  }

  setTouchMove(forward, strafe) {
    this.touchForward = Math.max(-1, Math.min(1, forward))
    this.touchStrafe = Math.max(-1, Math.min(1, strafe))
  }

  toggleFly() {
    this.flying = !this.flying
    this.vel.y = 0
    this.emit('fly', this.flying)
  }

  toggleSneak() {
    this.sneaking = !this.sneaking
  }

  // ------------------------------------------------------------- interaction
  raycast(maxDistance = 6) {
    const origin = new THREE.Vector3()
    const dir = new THREE.Vector3()
    this.camera.getWorldPosition(origin)
    this.camera.getWorldDirection(dir)
    let x = Math.floor(origin.x)
    let y = Math.floor(origin.y)
    let z = Math.floor(origin.z)
    const stepX = dir.x > 0 ? 1 : -1
    const stepY = dir.y > 0 ? 1 : -1
    const stepZ = dir.z > 0 ? 1 : -1
    const tDeltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x)
    const tDeltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y)
    const tDeltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z)
    let tMaxX = dir.x === 0 ? Infinity : dir.x > 0 ? (x + 1 - origin.x) / dir.x : (origin.x - x) / -dir.x
    let tMaxY = dir.y === 0 ? Infinity : dir.y > 0 ? (y + 1 - origin.y) / dir.y : (origin.y - y) / -dir.y
    let tMaxZ = dir.z === 0 ? Infinity : dir.z > 0 ? (z + 1 - origin.z) / dir.z : (origin.z - z) / -dir.z
    let normal = [0, 1, 0]
    let t = 0
    for (let i = 0; i < 128; i++) {
      const id = this.world.getBlock(x, y, z)
      if (id !== AIR && id !== WATER) {
        return { x, y, z, id, normal, distance: t }
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX
        t = tMaxX
        tMaxX += tDeltaX
        normal = [-stepX, 0, 0]
      } else if (tMaxY < tMaxZ) {
        y += stepY
        t = tMaxY
        tMaxY += tDeltaY
        normal = [0, -stepY, 0]
      } else {
        z += stepZ
        t = tMaxZ
        tMaxZ += tDeltaZ
        normal = [0, 0, -stepZ]
      }
      if (t > maxDistance) break
    }
    return null
  }

  updateTarget() {
    const previous = this.target
    this.target = this.enabled ? this.raycast(6) : null
    if (this.target) {
      this.highlight.visible = true
      this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5)
    } else {
      this.highlight.visible = false
    }
    if (previous?.x !== this.target?.x || previous?.y !== this.target?.y || previous?.z !== this.target?.z) {
      this.breakProgress = 0
      this.breakTarget = null
      this.crack.visible = false
      this.emit('target', this.target)
    }
  }

  beginPrimary() {
    if (!this.enabled) return
    if (this.callbacks.attack?.()) {
      this.swing = 1
      return
    }
    if (!this.target) return
    this.breakHeld = true
    this.breakProgress = 0
    this.breakTarget = this.target
    this.crack.visible = true
    this.updateCrack()
  }

  endPrimary() {
    this.breakHeld = false
    this.breakProgress = 0
    this.breakTarget = null
    this.crack.visible = false
  }

  updateCrack() {
    const block = this.target ? BLOCKS[this.target.id] : null
    if (!this.target || !block) {
      this.crack.visible = false
      return
    }
    const stage = Math.max(0, Math.min(4, Math.floor(this.breakProgress * 5)))
    if (this.crackMat.map !== this.crackTextures?.[stage]) {
      this.crackMat.map = this.crackTextures?.[stage] || null
      this.crackMat.needsUpdate = true
    }
    this.crack.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5)
    this.crack.visible = this.breakHeld && this.breakProgress > 0.01
  }

  setCrackTextures(textures) {
    this.crackTextures = textures
  }

  updateBreaking(dt) {
    if (!this.breakHeld) return
    if (!this.target || !this.breakTarget) return
    if (this.target.x !== this.breakTarget.x || this.target.y !== this.breakTarget.y || this.target.z !== this.breakTarget.z) {
      this.breakProgress = 0
      this.breakTarget = this.target
      this.crack.visible = false
      return
    }
    const block = BLOCKS[this.target.id]
    if (!block || !Number.isFinite(block.breakTime) || block.breakTime <= 0) return
    this.breakProgress += dt / block.breakTime
    this.updateCrack()
    if (this.breakProgress >= 1) {
      const t = this.target
      this.world.setBlock(t.x, t.y, t.z, AIR)
      const color = PARTICLE_COLORS[t.id] || 0x999999
      this.particles?.spawn(t.x, t.y, t.z, color, 16, 1)
      this.audio?.breakBlock(block.sound)
      this.emit('break', t)
      this.endPrimary()
      this.swing = 1
    }
  }

  placeBlock() {
    if (!this.enabled || !this.target) return
    if (this.placeCooldown > 0) return
    const id = this.selectedId
    if (!id) return
    const nx = this.target.x + this.target.normal[0]
    const ny = this.target.y + this.target.normal[1]
    const nz = this.target.z + this.target.normal[2]
    if (ny < 1 || ny >= 96) return
    if (!isReplaceable(this.world.getBlock(nx, ny, nz))) return
    const block = BLOCKS[id]
    if (block.solid && this.intersectsBlock(nx, ny, nz)) return
    this.world.setBlock(nx, ny, nz, id)
    this.audio?.placeBlock(block.sound)
    this.particles?.spawn(nx, ny, nz, PARTICLE_COLORS[id] || 0xaaaaaa, 5, 0.5)
    this.placeCooldown = 0.18
    this.swing = 1
    this.emit('place', { x: nx, y: ny, z: nz, id })
  }

  pickBlock() {
    if (!this.target) return
    const id = this.target.id
    if (!BLOCKS[id]) return
    this.hotbar[this.selected] = id
    this.rebuildHand()
    this.emit('select', this.selected)
    this.audio?.click()
  }

  intersectsBlock(bx, by, bz) {
    const minX = this.pos.x - this.width / 2
    const maxX = this.pos.x + this.width / 2
    const minY = this.pos.y
    const maxY = this.pos.y + this.height
    const minZ = this.pos.z - this.width / 2
    const maxZ = this.pos.z + this.width / 2
    return maxX > bx && minX < bx + 1 && maxY > by && minY < by + 1 && maxZ > bz && minZ < bz + 1
  }

  // ------------------------------------------------------------------ physics
  isInWater() {
    const x = Math.floor(this.pos.x)
    const z = Math.floor(this.pos.z)
    return isLiquid(this.world.getBlock(x, Math.floor(this.pos.y + 0.2), z)) ||
      isLiquid(this.world.getBlock(x, Math.floor(this.pos.y + 1), z))
  }

  isHeadInWater() {
    return isLiquid(this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + this.eyeHeight), Math.floor(this.pos.z)))
  }

  moveAxis(axis, delta) {
    if (delta === 0) return
    if (axis === 0) this.pos.x += delta
    else if (axis === 1) this.pos.y += delta
    else this.pos.z += delta

    const minX = Math.floor(this.pos.x - this.width / 2 + EPS)
    const maxX = Math.floor(this.pos.x + this.width / 2 - EPS)
    const minY = Math.floor(this.pos.y + EPS)
    const maxY = Math.floor(this.pos.y + this.height - EPS)
    const minZ = Math.floor(this.pos.z - this.width / 2 + EPS)
    const maxZ = Math.floor(this.pos.z + this.width / 2 - EPS)

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (!isSolid(this.world.getBlock(bx, by, bz))) continue
          if (axis === 0) {
            if (delta > 0) this.pos.x = Math.min(this.pos.x, bx - this.width / 2 - EPS)
            else this.pos.x = Math.max(this.pos.x, bx + 1 + this.width / 2 + EPS)
            this.vel.x = 0
          } else if (axis === 1) {
            if (delta > 0) {
              this.pos.y = Math.min(this.pos.y, by - this.height - EPS)
            } else {
              this.pos.y = Math.max(this.pos.y, by + 1 + EPS)
              this.onGround = true
            }
            this.vel.y = 0
          } else {
            if (delta > 0) this.pos.z = Math.min(this.pos.z, bz - this.width / 2 - EPS)
            else this.pos.z = Math.max(this.pos.z, bz + 1 + this.width / 2 + EPS)
            this.vel.z = 0
          }
        }
      }
    }
  }

  move(dt) {
    const dx = this.vel.x * dt
    const dy = this.vel.y * dt
    const dz = this.vel.z * dt
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.38))
    for (let i = 0; i < steps; i++) {
      this.moveAxis(0, dx / steps)
      this.moveAxis(2, dz / steps)
      this.moveAxis(1, dy / steps)
    }
  }

  checkGround() {
    const x = Math.floor(this.pos.x)
    const z = Math.floor(this.pos.z)
    const y = Math.floor(this.pos.y - 0.06)
    for (const ox of [-0.26, 0.26]) {
      for (const oz of [-0.26, 0.26]) {
        if (isSolid(this.world.getBlock(Math.floor(this.pos.x + ox), y, Math.floor(this.pos.z + oz)))) return true
      }
    }
    return isSolid(this.world.getBlock(x, y, z))
  }

  setPosition(x, y, z) {
    this.pos.set(x, y, z)
    this.vel.set(0, 0, 0)
    for (let i = 0; i < 8; i++) {
      if (!this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) break
      this.pos.y += 1
    }
    this.fallStart = null
  }

  collidesAt(x, y, z) {
    const minX = Math.floor(x - this.width / 2 + EPS)
    const maxX = Math.floor(x + this.width / 2 - EPS)
    const minY = Math.floor(y + EPS)
    const maxY = Math.floor(y + this.height - EPS)
    const minZ = Math.floor(z - this.width / 2 + EPS)
    const maxZ = Math.floor(z + this.width / 2 - EPS)
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true
        }
      }
    }
    return false
  }

  damage(amount, source = 'hurt') {
    if (this.invuln > 0 || this.health <= 0) return
    this.health = Math.max(0, this.health - amount)
    this.invuln = 0.65
    this.lastDamage = this.time
    this.regenTimer = 0
    this.audio?.hurt()
    this.emit('damage', { amount, health: this.health, source })
    if (this.health <= 0) this.respawn()
  }

  respawn() {
    this.health = this.maxHealth
    this.air = this.maxAir
    this.invuln = 1.5
    this.setPosition(this.spawn.x, this.spawn.y, this.spawn.z)
    this.yaw = 0
    this.pitch = 0
    this.emit('respawn')
  }

  update(dt) {
    this.time += dt
    this.placeCooldown = Math.max(0, this.placeCooldown - dt)
    this.invuln = Math.max(0, this.invuln - dt)
    this.swing = Math.max(0, this.swing - dt * 5.2)

    if (!this.enabled) {
      this.updateCamera(dt)
      return
    }

    dt = Math.min(dt, 0.05)
    const forward = Math.max(-1, Math.min(1, ((this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0)) + this.touchForward))
    const strafe = Math.max(-1, Math.min(1, ((this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)) + this.touchStrafe))
    const moving = forward !== 0 || strafe !== 0
    this.sneaking = this.keys.has('ControlLeft') || this.keys.has('ControlRight')
    this.inWater = this.isInWater()
    this.headInWater = this.isHeadInWater()

    let speed = this.flying ? 11 : this.sneaking ? 2.2 : 4.4
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
      if (!this.sneaking) speed = this.flying ? 16 : 5.9
    }
    this.sprinting = speed > 5 && moving && !this.sneaking
    if (this.inWater && !this.flying) speed *= 0.58

    let wishX = -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe
    let wishZ = -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe
    const wishLen = Math.hypot(wishX, wishZ)
    if (wishLen > 1) {
      wishX /= wishLen
      wishZ /= wishLen
    }
    const accel = this.flying ? 10 : this.inWater ? 5 : this.onGround ? 15 : 4.5
    const blend = Math.min(1, accel * dt)
    this.vel.x += (wishX * speed - this.vel.x) * blend
    this.vel.z += (wishZ * speed - this.vel.z) * blend

    if (this.flying) {
      const up = (this.jumpHeld ? 1 : 0) - (this.sneaking ? 1 : 0)
      this.vel.y += (up * 8 - this.vel.y) * Math.min(1, 12 * dt)
    } else if (this.inWater) {
      this.vel.y -= 5.5 * dt
      if (this.jumpHeld) this.vel.y = Math.min(3.4, this.vel.y + 22 * dt)
      this.vel.y *= Math.pow(0.08, dt)
      this.fallStart = null
    } else {
      this.vel.y -= 28 * dt
      this.vel.y = Math.max(this.vel.y, -55)
      if (this.jumpQueued && (this.onGround || this.coyote > 0)) {
        this.vel.y = 8.4
        this.onGround = false
        this.coyote = 0
      }
      if (this.jumpQueued && this.inWater) this.vel.y = 3.6
    }
    this.jumpQueued = false
    this.coyote = this.onGround ? 0.1 : Math.max(0, (this.coyote || 0) - dt)

    const wasGround = this.onGround
    this.onGround = false
    this.move(dt)
    const grounded = this.checkGround()
    if (grounded && this.vel.y <= 0.001) {
      this.onGround = true
      if (!wasGround && this.fallStart !== null) {
        const fall = this.fallStart - this.pos.y
        if (fall > 3.4 && !this.inWater) this.damage(Math.floor(fall - 3))
        this.fallStart = null
      }
    }
    if (!this.onGround && !this.flying && !this.inWater && this.vel.y < -0.1 && this.fallStart === null) {
      this.fallStart = this.pos.y
    }
    if (this.onGround) this.fallStart = null

    if (this.pos.y < -20) this.respawn()

    // Air meter.
    if (this.headInWater) {
      this.air = Math.max(0, this.air - dt)
      if (this.air <= 0) {
        this.drownTimer = (this.drownTimer || 0) + dt
        if (this.drownTimer > 1.2) {
          this.drownTimer = 0
          this.damage(1)
        }
      }
    } else {
      this.air = Math.min(this.maxAir, this.air + dt * 3)
      this.drownTimer = 0
    }

    // Health regeneration.
    if (this.health < this.maxHealth && this.time - this.lastDamage > 6) {
      this.regenTimer += dt
      if (this.regenTimer > 2.8) {
        this.regenTimer = 0
        this.health = Math.min(this.maxHealth, this.health + 1)
        this.emit('heal', this.health)
      }
    }

    // Footstep sounds.
    if (this.onGround && moving && !this.flying) {
      this.stepTimer -= dt
      if (this.stepTimer <= 0) {
        const below = this.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z))
        const sound = BLOCKS[below]?.sound || 'grass'
        this.audio?.step(sound)
        this.stepTimer = this.sprinting ? 0.3 : 0.42
      }
    } else {
      this.stepTimer = 0
    }

    if (this.inWater !== this.wasInWater) {
      if (this.inWater) this.audio?.splash()
      this.wasInWater = this.inWater
    }

    // Camera bob.
    if (this.onGround && moving && !this.flying) {
      this.bobPhase += dt * (this.sprinting ? 11 : 8)
      this.bobAmount = Math.min(1, this.bobAmount + dt * 5)
    } else {
      this.bobAmount = Math.max(0, this.bobAmount - dt * 6)
    }

    this.updateCamera(dt)
    this.updateTarget()
    this.updateBreaking(dt)
    this.updateHand(dt)
  }

  updateCamera(dt) {
    const bob = Math.sin(this.bobPhase * 2) * 0.035 * this.bobAmount
    const sway = Math.cos(this.bobPhase) * 0.018 * this.bobAmount
    const eye = this.pos.y + this.eyeHeight - (this.sneaking ? 0.16 : 0)
    this.camera.position.set(this.pos.x + sway * Math.cos(this.yaw), eye + bob, this.pos.z + sway * Math.sin(this.yaw))
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.set(this.pitch, this.yaw, 0)
    const targetFov = this.baseFov + (this.sprinting ? 6 : 0) + (this.flying ? 4 : 0)
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 10 * (dt || 0.016))
      this.camera.updateProjectionMatrix()
    }
  }

  updateHand(dt) {
    if (!this.handGroup) return
    const swingPhase = Math.sin((1 - this.swing) * Math.PI)
    const bob = Math.sin(this.bobPhase * 2) * 0.018 * this.bobAmount
    const sway = Math.cos(this.bobPhase) * 0.012 * this.bobAmount
    const breakShake = this.breakHeld ? Math.sin(this.time * 38) * 0.012 : 0
    // Pull the held item inward on narrow portrait screens so it stays in frame.
    const aspect = this.camera.aspect || 1.6
    const handX = 0.36 * Math.min(1, Math.max(0.46, aspect / 1.5))
    this.handGroup.scale.setScalar(Math.min(1, Math.max(0.62, aspect / 1.3)))
    this.handGroup.position.set(
      handX + sway,
      -0.36 + bob - swingPhase * 0.24 + breakShake,
      -0.8 + swingPhase * 0.08,
    )
    this.handGroup.rotation.set(
      0.06 + swingPhase * 0.85,
      0.55 - swingPhase * 0.25,
      -0.06 - swingPhase * 0.15,
    )
  }

  rebuildHand() {
    if (this.handMesh) {
      this.handGroup.remove(this.handMesh)
      this.handMesh.geometry.dispose()
      this.handMesh = null
    }
    const id = this.selectedId
    if (!id || !BLOCKS[id]) return
    const block = BLOCKS[id]
    let geometry
    let material = this.handMat
    if (block.cross) {
      const [u0, v0, u1, v1] = tileUV(this.atlas, block.tiles.all || block.tiles.side)
      geometry = new THREE.PlaneGeometry(0.21, 0.21)
      const uv = geometry.attributes.uv
      uv.setXY(0, u0, v1)
      uv.setXY(1, u1, v1)
      uv.setXY(2, u0, v0)
      uv.setXY(3, u1, v0)
      uv.needsUpdate = true
      material = this.handSpriteMat
    } else {
      geometry = createBlockGeometry(id, this.atlas, 0.18)
    }
    this.handMesh = new THREE.Mesh(geometry, material)
    this.handMesh.renderOrder = 999
    this.handMesh.frustumCulled = false
    this.handGroup.add(this.handMesh)
  }

  serialize() {
    return {
      x: this.pos.x, y: this.pos.y, z: this.pos.z,
      yaw: this.yaw, pitch: this.pitch,
      health: this.health,
      hotbar: this.hotbar.slice(),
      selected: this.selected,
      flying: this.flying,
    }
  }

  deserialize(data) {
    if (!data) return
    if (Number.isFinite(data.x) && Number.isFinite(data.y) && Number.isFinite(data.z)) {
      this.setPosition(data.x, data.y, data.z)
    }
    if (Number.isFinite(data.yaw)) this.yaw = data.yaw
    if (Number.isFinite(data.pitch)) this.pitch = data.pitch
    if (Number.isFinite(data.health)) this.health = Math.max(1, Math.min(20, data.health))
    if (Array.isArray(data.hotbar) && data.hotbar.length === 9) {
      this.hotbar = data.hotbar.map((id) => (BLOCKS[id] ? id : 1))
    }
    if (Number.isFinite(data.selected)) this.selected = Math.max(0, Math.min(8, data.selected))
    this.flying = !!data.flying
    this.rebuildHand()
  }
}
