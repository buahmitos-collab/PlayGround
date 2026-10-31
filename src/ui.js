import { BLOCKS } from './blocks.js'
import { makeBlockIcon } from './textures.js'

function heartData(fill) {
  const c = document.createElement('canvas')
  c.width = 20
  c.height = 20
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const draw = (color) => {
    ctx.fillStyle = color
    // chunky pixel heart
    const rows = [
      [4, 2, 4], [8, 2, 4],
      [2, 4, 12], [1, 6, 14], [1, 8, 14], [2, 10, 12],
      [3, 12, 10], [4, 14, 8], [5, 16, 6], [7, 18, 2],
    ]
    for (const [x, y, w] of rows) ctx.fillRect(x, y, w, 2)
  }
  if (fill === 'empty') draw('#2a1a1c')
  else draw('#d84242')
  if (fill === 'half') {
    ctx.clearRect(10, 0, 10, 20)
    ctx.fillStyle = '#2a1a1c'
    const rows = [
      [4, 2, 4], [8, 2, 4],
      [2, 4, 12], [1, 6, 14], [1, 8, 14], [2, 10, 12],
      [3, 12, 10], [4, 14, 8], [5, 16, 6], [7, 18, 2],
    ]
    for (const [x, y, w] of rows) {
      if (x + w > 10) ctx.fillRect(Math.max(10, x), y, x + w - Math.max(10, x), 2)
    }
  }
  // outline and shine
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = 'rgba(0,0,0,.22)'
  ctx.fillRect(0, 14, 20, 6)
  ctx.fillStyle = 'rgba(255,255,255,.4)'
  ctx.fillRect(4, 4, 3, 2)
  return c.toDataURL()
}

export class UI {
  constructor({ player, world, audio, atlas, renderer, camera }) {
    this.player = player
    this.world = world
    this.audio = audio
    this.atlas = atlas
    this.renderer = renderer
    this.camera = camera
    this.callbacks = {}
    this.state = 'loading'
    this.icons = new Map()
    this.hearts = { full: heartData('full'), half: heartData('half'), empty: heartData('empty') }
    this.lastHealth = -1
    this.lastAir = -1
    this.lastSelected = -1
    this.lastTargetId = -1
    this.toastTimer = 0
    this.damageTimer = 0
    this.debugVisible = false
    this.lockHintVisible = false
    this.settings = this.loadSettings()
    this.fps = 0
    this.frameAccum = 0
    this.frameCount = 0
    this.debugTimer = 0
    this.tipTimer = 0
    this.tips = [
      'Tip: press F3 to inspect the world.',
      'Tip: double-tap Space to fly.',
      'Tip: zombies only come out at night.',
      'Tip: hold left click to mine faster.',
      'Tip: press E for the full block catalogue.',
      'Tip: place glowstone to light up caves.',
      'Tip: the world is deterministic — your seed rebuilds it exactly.',
      'Tip: touch controls appear automatically on phones and tablets.',
    ]

    this.cache()
    this.buildIcons()
    this.buildHotbar()
    this.buildInventory()
    this.buildHearts()
    this.bind()
    this.applySettings()
    this.setTouchMode(matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)
    this.updateSoundButton()
  }

  on(event, fn) {
    this.callbacks[event] = fn
  }

  emit(event, ...args) {
    this.callbacks[event]?.(...args)
  }

  cache() {
    const $ = (id) => document.getElementById(id)
    this.el = {
      loading: $('loading'), loadingFill: $('loading-fill'), loadingStatus: $('loading-status'), loadingTip: $('loading-tip'),
      title: $('title'), btnPlay: $('btn-play'), seedInput: $('seed-input'), btnNew: $('btn-new'), saveNote: $('save-note'),
      hud: $('hud'), debug: $('debug'), clockIcon: $('clock-icon'), clockText: $('clock-text'), coords: $('coords-chip'),
      btnSound: $('btn-sound'), btnFullscreen: $('btn-fullscreen'), btnPause: $('btn-pause'),
      crosshair: $('crosshair'), targetName: $('target-name'), hearts: $('hearts'), airbar: $('airbar'),
      hotbar: $('hotbar'), hotbarLabel: $('hotbar-label'), underwater: $('underwater-overlay'), damage: $('damage-vignette'),
      toast: $('toast'), lockHint: $('lock-hint'),
      pause: $('pause'), btnResume: $('btn-resume'), btnClosePause: $('btn-close-pause'), btnSettings: $('btn-settings'),
      settings: $('settings'), setRender: $('set-render'), setFov: $('set-fov'), setSens: $('set-sens'), setSound: $('set-sound'),
      rdVal: $('rd-val'), fovVal: $('fov-val'), sensVal: $('sens-val'),
      btnHelp: $('btn-help'), help: $('help'), btnReset: $('btn-reset'), btnQuit: $('btn-quit'),
      inventory: $('inventory'), grid: $('inventory-grid'), invSlot: $('inv-slot'), invName: $('inv-selected-name'),
      btnCloseInventory: $('btn-close-inventory'), btnInventoryDone: $('btn-inventory-done'),
      joystick: $('joystick'), knob: $('joystick-knob'), btnJump: $('btn-jump'), btnFly: $('btn-fly'),
      btnBreak: $('btn-break'), btnPlace: $('btn-place'), btnInvMobile: $('btn-inv-mobile'),
    }
  }

  buildIcons() {
    for (let id = 1; id < BLOCKS.length; id++) {
      if (!BLOCKS[id]) continue
      this.icons.set(id, makeBlockIcon(this.atlas, id))
    }
  }

  buildHotbar() {
    this.el.hotbar.innerHTML = ''
    this.slots = []
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div')
      slot.className = 'slot'
      slot.dataset.index = String(i)
      slot.title = ''
      const icon = document.createElement('div')
      icon.className = 'icon'
      const num = document.createElement('span')
      num.className = 'num'
      num.textContent = String(i + 1)
      slot.append(icon, num)
      slot.addEventListener('click', (e) => {
        e.stopPropagation()
        this.emit('selectSlot', i)
      })
      this.el.hotbar.append(slot)
      this.slots.push(slot)
    }
    this.refreshHotbar()
  }

  buildInventory() {
    this.el.grid.innerHTML = ''
    this.invButtons = new Map()
    for (let id = 1; id < BLOCKS.length; id++) {
      const block = BLOCKS[id]
      if (!block) continue
      const button = document.createElement('button')
      button.className = 'inv-item'
      button.dataset.id = String(id)
      const img = document.createElement('img')
      img.src = this.icons.get(id)
      img.alt = ''
      img.draggable = false
      const label = document.createElement('span')
      label.textContent = block.name
      button.append(img, label)
      button.addEventListener('click', () => this.emit('pickBlock', id))
      this.el.grid.append(button)
      this.invButtons.set(id, button)
    }
    this.refreshInventory()
  }

  buildHearts() {
    this.el.hearts.innerHTML = ''
    this.heartEls = []
    for (let i = 0; i < 10; i++) {
      const heart = document.createElement('div')
      heart.className = 'heart'
      this.el.hearts.append(heart)
      this.heartEls.push(heart)
    }
    this.updateHealth(true)
  }

  bind() {
    this.el.btnPlay.addEventListener('click', () => {
      this.audio?.init()
      this.audio?.click()
      this.emit('play')
    })
    this.el.btnNew.addEventListener('click', () => {
      this.audio?.init()
      this.audio?.click()
      this.emit('newWorld', this.el.seedInput.value.trim())
    })
    this.el.seedInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.audio?.init()
        this.emit('newWorld', this.el.seedInput.value.trim())
      }
    })
    this.el.btnPause.addEventListener('click', () => this.emit('pause'))
    this.el.btnResume.addEventListener('click', () => this.emit('resume'))
    this.el.btnClosePause.addEventListener('click', () => this.emit('resume'))
    this.el.btnSettings.addEventListener('click', () => this.el.settings.classList.toggle('hidden'))
    this.el.btnHelp.addEventListener('click', () => this.el.help.classList.toggle('hidden'))
    this.el.btnQuit.addEventListener('click', () => this.emit('quit'))
    this.el.btnReset.addEventListener('click', () => {
      if (window.confirm('Delete this world and all of your builds?')) this.emit('reset')
    })
    this.el.btnCloseInventory.addEventListener('click', () => this.emit('closeInventory'))
    this.el.btnInventoryDone.addEventListener('click', () => this.emit('closeInventory'))
    this.el.btnSound.addEventListener('click', () => this.emit('toggleSound'))
    this.el.btnFullscreen.addEventListener('click', () => this.emit('fullscreen'))
    this.el.btnInvMobile.addEventListener('click', () => this.emit('openInventory'))

    const bindSlider = (input, label, key, format = (v) => v) => {
      input.addEventListener('input', () => {
        const value = Number(input.value)
        label.textContent = format(value)
        this.settings[key] = value
        this.saveSettings()
        this.emit('settings', this.settings)
      })
    }
    bindSlider(this.el.setRender, this.el.rdVal, 'renderDistance')
    bindSlider(this.el.setFov, this.el.fovVal, 'fov')
    bindSlider(this.el.setSens, this.el.sensVal, 'sensitivity', (v) => v.toFixed(1))
    this.el.setSound.addEventListener('change', () => {
      this.settings.sound = this.el.setSound.checked
      this.saveSettings()
      this.emit('settings', this.settings)
    })

    // Touch joystick.
    let joyId = null
    const moveJoy = (e) => {
      const rect = this.el.joystick.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = e.clientX - cx
      let dy = e.clientY - cy
      const max = rect.width * 0.34
      const len = Math.hypot(dx, dy)
      if (len > max) {
        dx = (dx / len) * max
        dy = (dy / len) * max
      }
      this.el.knob.style.transform = `translate(${dx}px, ${dy}px)`
      this.player.setTouchMove(-dy / max, dx / max)
    }
    this.el.joystick.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      joyId = e.pointerId
      this.el.joystick.setPointerCapture(e.pointerId)
      this.el.joystick.classList.add('active')
      moveJoy(e)
    })
    this.el.joystick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return
      e.preventDefault()
      moveJoy(e)
    })
    const endJoy = (e) => {
      if (e.pointerId !== joyId) return
      joyId = null
      this.el.knob.style.transform = ''
      this.player.setTouchMove(0, 0)
    }
    this.el.joystick.addEventListener('pointerup', endJoy)
    this.el.joystick.addEventListener('pointercancel', endJoy)
    this.el.joystick.addEventListener('lostpointercapture', () => {
      joyId = null
      this.el.knob.style.transform = ''
      this.player.setTouchMove(0, 0)
    })

    this.el.btnJump.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      try { this.el.btnJump.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      this.player.jumpHeld = true
      this.player.jumpQueued = true
      this.el.btnJump.classList.add('pressed')
    })
    const endJump = () => {
      this.player.jumpHeld = false
      this.el.btnJump.classList.remove('pressed')
    }
    this.el.btnJump.addEventListener('pointerup', endJump)
    this.el.btnJump.addEventListener('pointercancel', endJump)
    this.el.btnJump.addEventListener('lostpointercapture', endJump)
    this.el.btnFly.addEventListener('click', (e) => {
      e.preventDefault()
      this.player.toggleFly()
    })
    this.el.btnBreak.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      try { this.el.btnBreak.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      this.player.beginPrimary()
      this.el.btnBreak.classList.add('pressed')
    })
    const endBreak = () => {
      this.player.endPrimary()
      this.el.btnBreak.classList.remove('pressed')
    }
    this.el.btnBreak.addEventListener('pointerup', endBreak)
    this.el.btnBreak.addEventListener('pointercancel', endBreak)
    this.el.btnBreak.addEventListener('lostpointercapture', endBreak)
    this.el.btnPlace.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.player.placeBlock()
      this.el.btnPlace.classList.add('pressed')
    })
    const endPlace = () => this.el.btnPlace.classList.remove('pressed')
    this.el.btnPlace.addEventListener('pointerup', endPlace)
    this.el.btnPlace.addEventListener('pointercancel', endPlace)

    this.el.hotbar.addEventListener('click', (e) => e.stopPropagation())
  }

  loadSettings() {
    const defaults = { renderDistance: 6, fov: 75, sensitivity: 1, sound: true }
    try {
      const saved = JSON.parse(localStorage.getItem('voxelcraft.settings') || 'null')
      if (saved && typeof saved === 'object') return { ...defaults, ...saved }
    } catch { /* ignore */ }
    if (matchMedia('(pointer: coarse)').matches) defaults.renderDistance = 4
    return defaults
  }

  saveSettings() {
    try { localStorage.setItem('voxelcraft.settings', JSON.stringify(this.settings)) } catch { /* ignore */ }
  }

  applySettings() {
    this.el.setRender.value = String(this.settings.renderDistance)
    this.el.setFov.value = String(this.settings.fov)
    this.el.setSens.value = String(this.settings.sensitivity)
    this.el.setSound.checked = !!this.settings.sound
    this.el.rdVal.textContent = String(this.settings.renderDistance)
    this.el.fovVal.textContent = String(this.settings.fov)
    this.el.sensVal.textContent = Number(this.settings.sensitivity).toFixed(1)
  }

  setTouchMode(value) {
    this.touch = value
    document.body.classList.toggle('touch', value)
  }

  setState(state) {
    this.state = state
    const show = (el, value) => el.classList.toggle('hidden', !value)
    show(this.el.loading, state === 'loading')
    show(this.el.title, state === 'title')
    show(this.el.hud, state !== 'loading' && state !== 'title')
    show(this.el.pause, state === 'paused')
    show(this.el.inventory, state === 'inventory')
    if (state === 'playing') {
      this.el.lockHint.classList.toggle('hidden', !this.lockHintVisible || this.touch)
      this.el.crosshair.classList.remove('hidden')
    } else {
      this.el.lockHint.classList.add('hidden')
      this.el.crosshair.classList.add('hidden')
      this.el.targetName.classList.remove('show')
    }
    if (state !== 'inventory') this.el.inventory.classList.add('hidden')
    if (state !== 'paused') this.el.pause.classList.add('hidden')
  }

  showLoading(progress, status) {
    this.el.loadingFill.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`
    if (status) this.el.loadingStatus.textContent = status
  }

  rotateTip() {
    this.el.loadingTip.textContent = this.tips[Math.floor(Math.random() * this.tips.length)]
  }

  showTitle({ seed, hasSave }) {
    this.el.seedInput.value = String(seed)
    this.el.saveNote.textContent = hasSave
      ? 'Saved world found. Continue where you left off, or start a fresh world.'
      : 'No saved world yet — a new one will be generated.'
    this.setState('title')
    this.rotateTip()
  }

  setSeed(seed) {
    this.el.seedInput.value = String(seed)
  }

  refreshHotbar() {
    if (!this.slots) return
    for (let i = 0; i < 9; i++) {
      const id = this.player.hotbar[i]
      const slot = this.slots[i]
      const icon = slot.querySelector('.icon')
      icon.style.backgroundImage = this.icons.get(id) ? `url(${this.icons.get(id)})` : 'none'
      slot.title = BLOCKS[id]?.name || 'Empty'
      slot.classList.toggle('selected', i === this.player.selected)
    }
    this.lastSelected = this.player.selected
    this.lastTargetId = this.player.selectedId
    this.el.hotbarLabel.textContent = BLOCKS[this.player.selectedId]?.name || ''
    this.el.hotbarLabel.classList.add('show')
    clearTimeout(this.labelTimer)
    this.labelTimer = setTimeout(() => this.el.hotbarLabel.classList.remove('show'), 1600)
    this.refreshInventory()
  }

  refreshInventory() {
    if (!this.invButtons) return
    const current = this.player.selectedId
    for (const [id, button] of this.invButtons) {
      button.classList.toggle('selected', id === current)
    }
    this.el.invSlot.textContent = String(this.player.selected + 1)
    this.el.invName.textContent = BLOCKS[current]?.name || 'Empty'
  }

  updateHealth(force = false) {
    if (!force && this.player.health === this.lastHealth) return
    this.lastHealth = this.player.health
    const full = Math.floor(this.player.health / 2)
    const half = this.player.health % 2
    for (let i = 0; i < 10; i++) {
      const img = i < full ? this.hearts.full : i === full && half ? this.hearts.half : this.hearts.empty
      this.heartEls[i].style.backgroundImage = `url(${img})`
    }
  }

  updateAir() {
    const show = this.player.air < this.player.maxAir - 0.05 || this.player.headInWater
    this.el.airbar.classList.toggle('hidden', !show)
    if (!show) return
    const bubbles = Math.ceil((this.player.air / this.player.maxAir) * 10)
    for (let i = 0; i < 10; i++) {
      this.el.airbar.children[i].classList.toggle('empty', i >= bubbles)
    }
  }

  showToast(text, ms = 1700) {
    this.el.toast.textContent = text
    this.el.toast.classList.add('show')
    this.toastTimer = ms / 1000
  }

  flashDamage() {
    this.el.damage.classList.add('show')
    this.damageTimer = 0.16
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible
    this.el.debug.classList.toggle('hidden', !this.debugVisible)
  }

  setLockHint(value) {
    this.lockHintVisible = value
    this.el.lockHint.classList.toggle('hidden', !value || this.state !== 'playing' || this.touch)
  }

  setUnderwater(value) {
    this.el.underwater.classList.toggle('show', value)
  }

  updateSoundButton() {
    this.el.btnSound.textContent = this.settings.sound ? '♪' : '×'
    this.el.btnSound.title = this.settings.sound ? 'Mute sound' : 'Enable sound'
  }

  update(dt, info) {
    this.frameAccum += dt
    this.frameCount++
    this.debugTimer += dt
    if (this.frameAccum >= 0.5) {
      this.fps = Math.round(this.frameCount / this.frameAccum)
      this.frameAccum = 0
      this.frameCount = 0
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show')
    }
    if (this.damageTimer > 0) {
      this.damageTimer -= dt
      if (this.damageTimer <= 0) this.el.damage.classList.remove('show')
    }
    if (this.state !== 'playing' && this.state !== 'paused' && this.state !== 'inventory') return

    const p = this.player
    if (p.health !== this.lastHealth) this.updateHealth()
    this.updateAir()
    if (p.selected !== this.lastSelected) this.refreshHotbar()
    if (p.selectedId !== this.lastTargetId) this.refreshHotbar()

    const target = p.target
    if (target && this.state === 'playing') {
      const name = BLOCKS[target.id]?.name || ''
      if (name) {
        this.el.targetName.textContent = name
        this.el.targetName.classList.add('show')
      } else {
        this.el.targetName.classList.remove('show')
      }
    } else {
      this.el.targetName.classList.remove('show')
    }

    this.el.coords.textContent = `${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)}, ${p.pos.z.toFixed(1)}`
    const hours = (info.dayTime * 24 + 24) % 24
    const hh = String(Math.floor(hours)).padStart(2, '0')
    const mm = String(Math.floor((hours % 1) * 60)).padStart(2, '0')
    this.el.clockText.textContent = `Day ${info.dayNumber} · ${hh}:${mm}`
    this.el.clockIcon.textContent = info.isNight ? '☾' : '☀'
    this.setUnderwater(p.headInWater)

    if (this.debugVisible && this.debugTimer > 0.25) {
      this.debugTimer = 0
      const r = this.renderer.info.render
      const cx = Math.floor(p.pos.x / 16)
      const cz = Math.floor(p.pos.z / 16)
      const biome = this.world.biomeAt(Math.floor(p.pos.x), Math.floor(p.pos.z))
      const tri = r.triangles > 1000 ? `${(r.triangles / 1000).toFixed(1)}k` : String(r.triangles)
      this.el.debug.innerHTML =
        `<b>Voxelcraft</b>  ${this.fps} fps\n` +
        `XYZ  ${p.pos.x.toFixed(2)} / ${p.pos.y.toFixed(2)} / ${p.pos.z.toFixed(2)}\n` +
        `Chunk  ${cx}, ${cz}   ${biome}\n` +
        `Time  ${this.el.clockText.textContent}\n` +
        `Draws ${r.calls}   Tris ${tri}\n` +
        `Chunks ${this.world.chunks.size}   Mobs ${info.mobCount}\n` +
        `Fly ${p.flying ? 'on' : 'off'}   Water ${p.inWater ? 'yes' : 'no'}\n` +
        `Seed ${this.world.seed}`
    }
  }
}
