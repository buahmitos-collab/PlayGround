import * as THREE from 'three'
import { AIR, WATER, BLOCKS, isSolid, isLiquid } from './blocks.js'

const materialCache = new Map()
function mat(color) {
  let m = materialCache.get(color)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color })
    materialCache.set(color, m)
  }
  return m
}

function box(w, h, d, color, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

function pivotLeg(w, h, color, x, y, z, parent) {
  const group = new THREE.Group()
  group.position.set(x, y, z)
  parent.add(group)
  box(w, h, w, color, 0, -h / 2, 0, group)
  return group
}

function makeModel(kind) {
  const root = new THREE.Group()
  const legs = []
  let head = null
  let body = null

  if (kind === 'pig') {
    body = box(0.9, 0.65, 1.25, 0xe89aa3, 0, 0.7, 0, root)
    head = new THREE.Group()
    head.position.set(0, 0.8, -0.78)
    root.add(head)
    box(0.62, 0.58, 0.55, 0xe89aa3, 0, 0, 0, head)
    box(0.36, 0.24, 0.2, 0xd47f8a, 0, -0.08, -0.34, head)
    box(0.08, 0.08, 0.04, 0x1a1a1a, -0.16, 0.12, -0.3, head)
    box(0.08, 0.08, 0.04, 0x1a1a1a, 0.16, 0.12, -0.3, head)
    box(0.18, 0.2, 0.1, 0xe89aa3, -0.25, 0.3, 0, head)
    box(0.18, 0.2, 0.1, 0xe89aa3, 0.25, 0.3, 0, head)
    legs.push(pivotLeg(0.22, 0.5, 0xd47f8a, -0.28, 0.5, -0.42, root))
    legs.push(pivotLeg(0.22, 0.5, 0xd47f8a, 0.28, 0.5, -0.42, root))
    legs.push(pivotLeg(0.22, 0.5, 0xd47f8a, -0.28, 0.5, 0.42, root))
    legs.push(pivotLeg(0.22, 0.5, 0xd47f8a, 0.28, 0.5, 0.42, root))
  } else if (kind === 'sheep') {
    body = box(1.0, 0.72, 1.3, 0xf1f0e8, 0, 0.82, 0, root)
    box(0.92, 0.18, 1.18, 0xe4e2d6, 0, 0.52, 0, root)
    head = new THREE.Group()
    head.position.set(0, 0.95, -0.82)
    root.add(head)
    box(0.5, 0.5, 0.48, 0xf1f0e8, 0, 0, 0, head)
    box(0.36, 0.32, 0.16, 0xd9b89a, 0, -0.08, -0.3, head)
    box(0.07, 0.08, 0.03, 0x1a1a1a, -0.14, 0.1, -0.25, head)
    box(0.07, 0.08, 0.03, 0x1a1a1a, 0.14, 0.1, -0.25, head)
    box(0.2, 0.1, 0.12, 0xf1f0e8, -0.22, 0.2, 0, head)
    box(0.2, 0.1, 0.12, 0xf1f0e8, 0.22, 0.2, 0, head)
    legs.push(pivotLeg(0.2, 0.5, 0xd9b89a, -0.3, 0.52, -0.45, root))
    legs.push(pivotLeg(0.2, 0.5, 0xd9b89a, 0.3, 0.52, -0.45, root))
    legs.push(pivotLeg(0.2, 0.5, 0xd9b89a, -0.3, 0.52, 0.45, root))
    legs.push(pivotLeg(0.2, 0.5, 0xd9b89a, 0.3, 0.52, 0.45, root))
  } else if (kind === 'chicken') {
    body = box(0.44, 0.46, 0.56, 0xf4f1e4, 0, 0.48, 0, root)
    head = new THREE.Group()
    head.position.set(0, 0.8, -0.28)
    root.add(head)
    box(0.28, 0.3, 0.28, 0xf4f1e4, 0, 0, 0, head)
    box(0.1, 0.1, 0.18, 0xe8a23a, 0, -0.04, -0.22, head)
    box(0.14, 0.06, 0.1, 0xc0392b, 0, 0.17, -0.02, head)
    box(0.05, 0.06, 0.03, 0x1a1a1a, -0.09, 0.05, -0.14, head)
    box(0.05, 0.06, 0.03, 0x1a1a1a, 0.09, 0.05, -0.14, head)
    box(0.06, 0.28, 0.4, 0xe8e4d8, -0.27, 0.48, 0.02, root)
    box(0.06, 0.28, 0.4, 0xe8e4d8, 0.27, 0.48, 0.02, root)
    legs.push(pivotLeg(0.07, 0.3, 0xe8a23a, -0.12, 0.28, 0, root))
    legs.push(pivotLeg(0.07, 0.3, 0xe8a23a, 0.12, 0.28, 0, root))
  } else {
    // zombie
    body = box(0.55, 0.85, 0.32, 0x2e7d6e, 0, 1.18, 0, root)
    box(0.58, 0.12, 0.34, 0x4a3a2a, 0, 0.76, 0, root)
    head = new THREE.Group()
    head.position.set(0, 1.78, 0)
    root.add(head)
    box(0.5, 0.5, 0.5, 0x5c9b55, 0, 0, 0, head)
    box(0.09, 0.09, 0.04, 0x111111, -0.12, 0.06, -0.26, head)
    box(0.09, 0.09, 0.04, 0x111111, 0.12, 0.06, -0.26, head)
    box(0.18, 0.05, 0.04, 0x3f6e3b, 0, -0.14, -0.26, head)
    const armL = new THREE.Group()
    armL.position.set(-0.38, 1.55, 0)
    armL.rotation.x = -Math.PI / 2
    root.add(armL)
    box(0.17, 0.7, 0.17, 0x5c9b55, 0, -0.35, 0, armL)
    const armR = new THREE.Group()
    armR.position.set(0.38, 1.55, 0)
    armR.rotation.x = -Math.PI / 2
    root.add(armR)
    box(0.17, 0.7, 0.17, 0x5c9b55, 0, -0.35, 0, armR)
    legs.push(pivotLeg(0.2, 0.76, 0x2f3a6e, -0.16, 0.76, 0, root))
    legs.push(pivotLeg(0.2, 0.76, 0x2f3a6e, 0.16, 0.76, 0, root))
    root.userData.arms = [armL, armR]
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.52, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.015
  shadow.scale.set(kind === 'chicken' ? 0.7 : 1, kind === 'chicken' ? 0.7 : 1, 1)
  root.add(shadow)

  return { root, legs, head, body }
}

const MOB_INFO = {
  pig: { width: 0.9, height: 0.9, health: 10, speed: 1.15, sound: 'pig' },
  sheep: { width: 1.0, height: 1.15, health: 12, speed: 1.0, sound: 'sheep' },
  chicken: { width: 0.55, height: 0.8, health: 6, speed: 1.4, sound: 'chicken' },
  zombie: { width: 0.62, height: 1.95, health: 20, speed: 1.55, sound: 'zombie' },
}

export class Mob {
  constructor(manager, kind, x, y, z) {
    this.manager = manager
    this.kind = kind
    this.info = MOB_INFO[kind]
    this.pos = new THREE.Vector3(x, y, z)
    this.vel = new THREE.Vector3()
    this.yaw = Math.random() * Math.PI * 2
    this.targetYaw = this.yaw
    this.health = this.info.health
    this.maxHealth = this.health
    this.onGround = false
    this.wanderTimer = 0
    this.walkPhase = Math.random() * 10
    this.hurtTimer = 0
    this.attackCooldown = 0
    this.soundTimer = 4 + Math.random() * 8
    this.alive = true
    this.stuckTimer = 0
    this.deadTime = 0
    const model = makeModel(kind)
    this.model = model
    this.group = model.root
    this.group.position.copy(this.pos)
    this.group.rotation.y = this.yaw
    manager.scene.add(this.group)
  }

  get isZombie() {
    return this.kind === 'zombie'
  }

  hitbox() {
    return new THREE.Box3(
      new THREE.Vector3(this.pos.x - this.info.width / 2, this.pos.y, this.pos.z - this.info.width / 2),
      new THREE.Vector3(this.pos.x + this.info.width / 2, this.pos.y + this.info.height, this.pos.z + this.info.width / 2),
    )
  }

  damage(amount, fromPos) {
    if (!this.alive) return
    this.health -= amount
    this.hurtTimer = 2.6
    if (fromPos) {
      const dx = this.pos.x - fromPos.x
      const dz = this.pos.z - fromPos.z
      const len = Math.hypot(dx, dz) || 1
      this.vel.x += (dx / len) * 4.5
      this.vel.z += (dz / len) * 4.5
      this.vel.y = 4
    }
    if (this.health <= 0) {
      this.die()
    } else {
      this.manager.audio?.mob(this.kind)
    }
  }

  die() {
    if (!this.alive) return
    this.alive = false
    this.deadTime = 0
    this.manager.particles?.spawn(this.pos.x - 0.5, this.pos.y + this.info.height * 0.4, this.pos.z - 0.5, this.isZombie ? 0x5c9b55 : 0xf0f0e8, 18, 0.9)
    this.manager.audio?.mob(this.kind)
    this.group.visible = false
    this.manager.onDeath?.(this)
  }

  moveAxis(axis, delta) {
    if (delta === 0) return
    this.pos[axis === 0 ? 'x' : axis === 1 ? 'y' : 'z'] += delta
    const half = this.info.width / 2
    const minX = Math.floor(this.pos.x - half + 0.001)
    const maxX = Math.floor(this.pos.x + half - 0.001)
    const minY = Math.floor(this.pos.y + 0.001)
    const maxY = Math.floor(this.pos.y + this.info.height - 0.001)
    const minZ = Math.floor(this.pos.z - half + 0.001)
    const maxZ = Math.floor(this.pos.z + half - 0.001)
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (!isSolid(this.manager.world.getBlock(bx, by, bz))) continue
          if (axis === 0) {
            if (delta > 0) this.pos.x = Math.min(this.pos.x, bx - half - 0.001)
            else this.pos.x = Math.max(this.pos.x, bx + 1 + half + 0.001)
            this.vel.x = 0
          } else if (axis === 1) {
            if (delta > 0) this.pos.y = Math.min(this.pos.y, by - this.info.height - 0.001)
            else {
              this.pos.y = Math.max(this.pos.y, by + 1 + 0.001)
              this.onGround = true
            }
            this.vel.y = 0
          } else {
            if (delta > 0) this.pos.z = Math.min(this.pos.z, bz - half - 0.001)
            else this.pos.z = Math.max(this.pos.z, bz + 1 + half + 0.001)
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
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.35))
    for (let i = 0; i < steps; i++) {
      this.moveAxis(0, dx / steps)
      this.moveAxis(2, dz / steps)
      this.moveAxis(1, dy / steps)
    }
  }

  update(dt, player, time, isNight) {
    if (!this.alive) {
      this.deadTime += dt
      if (this.deadTime > 0.5) this.dispose()
      return
    }
    this.hurtTimer = Math.max(0, this.hurtTimer - dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.soundTimer -= dt
    if (this.soundTimer <= 0) {
      this.soundTimer = 7 + Math.random() * 12
      if (Math.random() < 0.55) this.manager.audio?.mob(this.kind)
    }

    const dx = player.pos.x - this.pos.x
    const dz = player.pos.z - this.pos.z
    const dist = Math.hypot(dx, dz)
    const water = isLiquid(this.manager.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z)))

    let speed = this.info.speed
    let desiredYaw = this.targetYaw
    let wantsMove = false

    if (this.isZombie) {
      if (dist < 26 && dist > 1.05) {
        desiredYaw = Math.atan2(-dx, -dz)
        wantsMove = true
        speed = this.info.speed
      } else if (dist <= 1.05 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.1
        player.damage(2, 'zombie')
        const len = dist || 1
        player.vel.x += (dx / len) * 5
        player.vel.z += (dz / len) * 5
        player.vel.y = Math.max(player.vel.y, 3.5)
        this.manager.audio?.mob('zombie')
      } else {
        this.wanderTimer -= dt
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 2 + Math.random() * 4
          this.targetYaw = Math.random() * Math.PI * 2
        }
        desiredYaw = this.targetYaw
        wantsMove = true
        speed *= 0.55
      }
      if (!isNight && dist > 8) {
        this.health -= dt * 2
        if (this.health <= 0) this.die()
      }
    } else if (this.hurtTimer > 0) {
      desiredYaw = Math.atan2(dx, dz)
      wantsMove = true
      speed = 2.8
    } else {
      this.wanderTimer -= dt
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2.5 + Math.random() * 5
        this.targetYaw = Math.random() * Math.PI * 2
      }
      desiredYaw = this.targetYaw
      wantsMove = true
      if (dist < 2.2) {
        desiredYaw = Math.atan2(-dx, -dz)
      }
    }

    let dyaw = ((desiredYaw - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    this.yaw += dyaw * Math.min(1, 6 * dt)

    if (wantsMove) {
      const fx = -Math.sin(this.yaw)
      const fz = -Math.cos(this.yaw)
      this.vel.x += (fx * speed - this.vel.x) * Math.min(1, 8 * dt)
      this.vel.z += (fz * speed - this.vel.z) * Math.min(1, 8 * dt)
    } else {
      this.vel.x *= Math.pow(0.02, dt)
      this.vel.z *= Math.pow(0.02, dt)
    }

    if (water) {
      this.vel.y += (2.2 - this.vel.y) * Math.min(1, 5 * dt)
      this.vel.y *= Math.pow(0.2, dt)
    } else {
      this.vel.y -= 26 * dt
      this.vel.y = Math.max(-40, this.vel.y)
    }

    const oldX = this.pos.x
    const oldZ = this.pos.z
    this.onGround = false
    this.move(dt)
    const moved = Math.hypot(this.pos.x - oldX, this.pos.z - oldZ)
    if (wantsMove && moved < 0.002) {
      this.stuckTimer += dt
      if (this.stuckTimer > 0.4) {
        this.stuckTimer = 0
        if (this.onGround && !water) this.vel.y = 7.2
        else if (this.isZombie) this.targetYaw += Math.PI * (0.5 + Math.random())
      }
    } else {
      this.stuckTimer = 0
    }

    if (this.pos.y < -10) this.die()

    const walkSpeed = Math.hypot(this.vel.x, this.vel.z)
    this.walkPhase += dt * (2 + walkSpeed * 4)
    const amp = Math.min(0.7, walkSpeed * 0.18)
    for (let i = 0; i < this.model.legs.length; i++) {
      const leg = this.model.legs[i]
      leg.rotation.x = Math.sin(this.walkPhase + (i % 2 ? Math.PI : 0)) * amp
    }
    if (this.model.head) {
      this.model.head.rotation.y = Math.sin(this.walkPhase * 0.3) * 0.08
    }
    this.model.root.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.025 * Math.min(1, walkSpeed)
    this.group.position.set(this.pos.x, this.pos.y + Math.abs(Math.sin(this.walkPhase)) * 0.025 * Math.min(1, walkSpeed), this.pos.z)
    this.group.rotation.y = this.yaw
  }

  dispose() {
    this.alive = false
    this.manager.scene.remove(this.group)
    this.group.traverse((obj) => {
      if (obj.isMesh) obj.geometry.dispose()
    })
    const i = this.manager.mobs.indexOf(this)
    if (i >= 0) this.manager.mobs.splice(i, 1)
  }
}

export class MobManager {
  constructor({ scene, world, player, audio, particles }) {
    this.scene = scene
    this.world = world
    this.player = player
    this.audio = audio
    this.particles = particles
    this.mobs = []
    this.spawnTimer = 3
    this.onDeath = null
    this.ray = new THREE.Ray()
    this.point = new THREE.Vector3()
    this.maxPassive = 8
    this.maxZombies = 4
  }

  passiveCount() {
    return this.mobs.filter((m) => m.alive && !m.isZombie).length
  }

  zombieCount() {
    return this.mobs.filter((m) => m.alive && m.isZombie).length
  }

  trySpawn(kind, distanceMin = 12, distanceMax = 28) {
    const p = this.player.pos
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const dist = distanceMin + Math.random() * (distanceMax - distanceMin)
      const x = Math.floor(p.x + Math.cos(angle) * dist) + 0.5
      const z = Math.floor(p.z + Math.sin(angle) * dist) + 0.5
      const y = this.world.getSurfaceY(Math.floor(x), Math.floor(z))
      if (y <= 38) continue
      const ground = this.world.getBlock(Math.floor(x), y, Math.floor(z))
      if (ground !== 1 && ground !== 5 && ground !== 14) continue
      if (this.world.getBlock(Math.floor(x), y + 1, Math.floor(z)) !== AIR) continue
      if (this.world.getBlock(Math.floor(x), y + 2, Math.floor(z)) !== AIR) continue
      const mob = new Mob(this, kind, x, y + 1.001, z)
      this.mobs.push(mob)
      return mob
    }
    return null
  }

  update(dt, time, isNight) {
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.5 + Math.random() * 3
      if (this.passiveCount() < this.maxPassive) {
        const kind = Math.random() < 0.36 ? 'pig' : Math.random() < 0.55 ? 'sheep' : 'chicken'
        this.trySpawn(kind, 14, 30)
      }
      if (isNight && this.zombieCount() < this.maxZombies) {
        this.trySpawn('zombie', 18, 32)
      }
    }

    for (const mob of [...this.mobs]) {
      mob.update(dt, this.player, time, isNight)
      const dist = Math.hypot(mob.pos.x - this.player.pos.x, mob.pos.z - this.player.pos.z)
      if (mob.alive && dist > 72) mob.dispose()
    }
  }

  tryHit(player, maxDistance = 4.4) {
    const origin = new THREE.Vector3()
    const dir = new THREE.Vector3()
    player.camera.getWorldPosition(origin)
    player.camera.getWorldDirection(dir)
    this.ray.set(origin, dir)
    let best = null
    let bestDist = maxDistance
    const blockDist = player.target?.distance ?? Infinity
    for (const mob of this.mobs) {
      if (!mob.alive) continue
      const hit = this.ray.intersectBox(mob.hitbox(), this.point)
      if (!hit) continue
      const d = origin.distanceTo(hit)
      if (d < bestDist && d < blockDist) {
        bestDist = d
        best = { mob, point: hit.clone() }
      }
    }
    if (!best) return false
    best.mob.damage(5, player.pos)
    this.particles?.spawn(best.point.x - 0.5, best.point.y - 0.5, best.point.z - 0.5, 0xb03030, 8, 0.7)
    this.audio?.attack()
    return true
  }

  dispose() {
    for (const mob of this.mobs) mob.dispose()
    this.mobs.length = 0
  }
}
