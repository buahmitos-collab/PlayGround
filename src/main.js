import * as THREE from 'three'
import { createTextureAtlas, createCrackTextures } from './textures.js'
import { World } from './world.js'
import { Player } from './player.js'
import { Particles } from './particles.js'
import { GameAudio } from './audio.js'
import { MobManager } from './mobs.js'
import { Environment } from './environment.js'
import { UI } from './ui.js'
import { BLOCKS } from './blocks.js'

const SAVE_KEY = 'voxelcraft.save.v1'
const DAY_LENGTH = 480
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* storage may be unavailable */ }
}

function hashSeed(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value) >>> 0
  const text = String(value ?? '').trim()
  // Keep numeric seeds literal so the seed shown in the title screen round-trips.
  if (/^\d+$/.test(text)) {
    const numeric = Number(text)
    if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 0xFFFFFFFF) return Math.floor(numeric) >>> 0
  }
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) || 12345
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.version !== 1 || !Number.isFinite(data.seed)) return null
    return data
  } catch {
    return null
  }
}

const canvas = document.getElementById('game')
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isTouch,
  powerPreference: 'high-performance',
  alpha: false,
  stencil: false,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2))
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.02

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 420)
camera.rotation.order = 'YXZ'
scene.add(camera)

const atlas = createTextureAtlas()
const crackTextures = createCrackTextures()
const params = new URLSearchParams(location.search)
const urlSeed = params.get('seed')
const save = urlSeed ? null : loadSave()
const seed = urlSeed ? hashSeed(urlSeed) : save?.seed ?? hashSeed(Math.floor(Math.random() * 1e9))
if (urlSeed) {
  clearSave()
  try { history.replaceState({}, '', location.pathname) } catch { /* ignore */ }
}

const world = new World(scene, atlas, seed)
if (save?.edits) world.importEdits(save.edits)
const spawnPoint = save?.spawn || world.findSpawn()

const particles = new Particles(scene, isTouch ? 120 : 200)
const audio = new GameAudio()

const player = new Player({
  world,
  camera,
  canvas,
  atlas,
  audio,
  particles,
  spawn: spawnPoint,
})
player.setCrackTextures(crackTextures)
if (save?.player) player.deserialize(save.player)
player.setEnabled(false)
player.handGroup.visible = false

const mobs = new MobManager({ scene, world, player, audio, particles })
player.on('attack', () => mobs.tryHit(player))
player.on('damage', () => ui.flashDamage())
player.on('respawn', () => ui.showToast('You respawned at the world spawn.'))
player.on('select', () => ui.refreshHotbar())
player.on('fly', (on) => ui.showToast(on ? 'Flight enabled — Space up, Shift down' : 'Flight disabled'))
player.on('place', ({ id }) => {
  if (id === 21) ui.showToast('Glowstone placed')
})
player.on('break', ({ id }) => {
  if (id === 18) ui.showToast('Diamond ore mined!')
})

const environment = new Environment(scene, renderer, camera)

let ui
ui = new UI({ player, world, audio, atlas, renderer, camera })

let worldTime = Number.isFinite(save?.time) ? save.time : 0.33 * DAY_LENGTH
let state = 'loading'
let renderRadius = 6
let fogFar = 96
let lastFrame = performance.now()
let titleTime = 0
let saveTimer = 0
let lastSavedEdits = world.editCount || 0
let lastSavedPos = player.pos.clone()
let titleCameraAngle = 0.6
let lockRequested = false
let hadLock = false
let touchLookId = null
let touchLastX = 0
let touchLastY = 0
let pausedFromLock = false

function applySettings(settings) {
  renderRadius = Math.max(3, Math.min(9, Number(settings.renderDistance) || 6))
  fogFar = Math.max(42, renderRadius * 16 * 1.02)
  player.baseFov = Number(settings.fov) || 75
  player.sensitivity = Number(settings.sensitivity) || 1
  camera.fov = player.baseFov
  camera.updateProjectionMatrix()
  audio.setMuted(!settings.sound)
  ui.updateSoundButton()
  environment.setUnderwater(player.headInWater)
}
applySettings(ui.settings)

function setHandVisible(value) {
  player.handGroup.visible = value
}

function requestLock() {
  if (isTouch) return
  if (document.pointerLockElement === canvas) return
  lockRequested = true
  try {
    const result = canvas.requestPointerLock()
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        lockRequested = false
        ui.setLockHint(state === 'playing')
      })
    }
  } catch {
    lockRequested = false
    ui.setLockHint(state === 'playing')
  }
}

function enterPlaying() {
  state = 'playing'
  player.setEnabled(true)
  setHandVisible(true)
  ui.setState('playing')
  ui.setLockHint(!isTouch && document.pointerLockElement !== canvas)
  audio.init()
  requestLock()
}

function playGame() {
  if (state !== 'title') return
  enterPlaying()
  ui.showToast(isTouch ? 'Touch controls ready — drag to look around' : 'Explore, mine and build — Esc to pause', 3000)
}

function pauseGame() {
  if (state !== 'playing') return
  state = 'paused'
  player.setEnabled(false)
  setHandVisible(false)
  ui.setState('paused')
  ui.setLockHint(false)
  saveWorld(true)
  if (document.pointerLockElement === canvas) document.exitPointerLock()
}

function resumeGame() {
  if (state !== 'paused') return
  state = 'playing'
  player.setEnabled(true)
  setHandVisible(true)
  ui.setState('playing')
  ui.setLockHint(!isTouch && document.pointerLockElement !== canvas)
  requestLock()
}

function openInventory() {
  if (state !== 'playing') return
  state = 'inventory'
  player.setEnabled(false)
  setHandVisible(false)
  ui.setState('inventory')
  ui.refreshInventory()
  ui.setLockHint(false)
  if (document.pointerLockElement === canvas) document.exitPointerLock()
}

function closeInventory() {
  if (state !== 'inventory') return
  state = 'playing'
  player.setEnabled(true)
  setHandVisible(true)
  ui.setState('playing')
  requestLock()
}

function quitToTitle() {
  if (state === 'loading') return
  saveWorld(true)
  state = 'title'
  player.setEnabled(false)
  setHandVisible(false)
  ui.setState('title')
  ui.showTitle({ seed: world.seed, hasSave: true })
  if (document.pointerLockElement === canvas) document.exitPointerLock()
}

function newWorld(seedText) {
  let value = String(seedText ?? '').trim()
  // The field is pre-filled with the current seed; treat that as "give me a fresh world".
  if (!value || value === String(world.seed)) value = String(Math.floor(Math.random() * 1e9))
  clearSave()
  const url = new URL(location.href)
  url.searchParams.set('seed', value)
  location.href = url.toString()
}

function resetWorld() {
  clearSave()
  const url = new URL(location.href)
  url.searchParams.set('seed', String(Math.floor(Math.random() * 1e9)))
  location.href = url.toString()
}

function saveWorld(force = false) {
  if (state === 'loading') return
  const moved = player.pos.distanceTo(lastSavedPos) > 0.6
  if (!force && (world.editCount || 0) === lastSavedEdits && !moved && saveTimer < 18) return
  const edits = world.exportEdits()
  const editCount = edits.length
  const data = {
    version: 1,
    seed: world.seed,
    edits,
    spawn: { x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z },
    player: player.serialize(),
    time: worldTime,
    savedAt: Date.now(),
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
    lastSavedEdits = editCount
    lastSavedPos.copy(player.pos)
    saveTimer = 0
  } catch (error) {
    console.warn('Could not save world', error)
    ui.showToast('World is too large to save — try fewer blocks', 2600)
  }
}

ui.on('play', playGame)
ui.on('newWorld', newWorld)
ui.on('pause', pauseGame)
ui.on('resume', resumeGame)
ui.on('quit', quitToTitle)
ui.on('reset', resetWorld)
ui.on('openInventory', openInventory)
ui.on('closeInventory', closeInventory)
ui.on('pickBlock', (id) => {
  if (!BLOCKS[id]) return
  player.hotbar[player.selected] = id
  player.rebuildHand()
  ui.refreshHotbar()
  audio.click()
  ui.showToast(`${BLOCKS[id].name} → slot ${player.selected + 1}`)
})
ui.on('selectSlot', (index) => {
  player.setSelected(index)
  ui.refreshHotbar()
  audio.click()
})
ui.on('toggleSound', () => {
  ui.settings.sound = !ui.settings.sound
  ui.el.setSound.checked = ui.settings.sound
  ui.saveSettings()
  audio.init()
  audio.setMuted(!ui.settings.sound)
  ui.updateSoundButton()
  ui.showToast(ui.settings.sound ? 'Sound on' : 'Sound muted')
})
ui.on('fullscreen', () => {
  if (document.fullscreenElement) document.exitFullscreen?.()
  else document.documentElement.requestFullscreen?.().catch(() => {})
})
ui.on('settings', (settings) => applySettings(settings))

window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault()
    ui.toggleDebug()
    return
  }
  if (e.code === 'KeyM') {
    ui.settings.sound = !ui.settings.sound
    ui.el.setSound.checked = ui.settings.sound
    ui.saveSettings()
    audio.setMuted(!ui.settings.sound)
    ui.updateSoundButton()
    return
  }
  if (e.code === 'Escape') {
    e.preventDefault()
    if (state === 'inventory') closeInventory()
    else if (state === 'playing') pauseGame()
    else if (state === 'paused') resumeGame()
    return
  }
  if (e.code === 'KeyE' && !e.repeat) {
    e.preventDefault()
    if (state === 'playing') openInventory()
    else if (state === 'inventory') closeInventory()
    return
  }
  if (e.code === 'KeyH' && state === 'paused') {
    ui.el.help.classList.toggle('hidden')
  }
})

canvas.addEventListener('click', () => {
  if (state === 'playing' && !isTouch && document.pointerLockElement !== canvas) {
    requestLock()
  }
})

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    hadLock = true
    lockRequested = false
    ui.setLockHint(false)
    pausedFromLock = false
  } else if (state === 'playing' && hadLock && !isTouch) {
    hadLock = false
    pauseGame()
    pausedFromLock = true
  } else {
    hadLock = false
  }
})

// Touch look controls.
canvas.addEventListener('pointerdown', (e) => {
  if (state !== 'playing' || e.pointerType !== 'touch') return
  if (touchLookId !== null) return
  touchLookId = e.pointerId
  touchLastX = e.clientX
  touchLastY = e.clientY
  canvas.setPointerCapture(e.pointerId)
  e.preventDefault()
}, { passive: false })

canvas.addEventListener('pointermove', (e) => {
  if (state !== 'playing' || e.pointerId !== touchLookId) return
  const dx = e.clientX - touchLastX
  const dy = e.clientY - touchLastY
  touchLastX = e.clientX
  touchLastY = e.clientY
  player.look(dx * 1.7, dy * 1.7)
  e.preventDefault()
}, { passive: false })

const endTouchLook = (e) => {
  if (e.pointerId === touchLookId) {
    touchLookId = null
    try { canvas.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }
}
canvas.addEventListener('pointerup', endTouchLook)
canvas.addEventListener('pointercancel', endTouchLook)

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2))
})

window.addEventListener('beforeunload', () => saveWorld(true))
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveWorld(true)
    if (state === 'playing') pauseGame()
  }
})

function cinematicCamera(dt) {
  titleTime += dt
  titleCameraAngle += dt * 0.03
  const px = player.pos.x
  const pz = player.pos.z
  const py = player.pos.y
  const radius = 19
  const angle = titleCameraAngle
  const cx = px + Math.cos(angle) * radius
  const cz = pz + Math.sin(angle) * radius
  let cy = py + 12.5 + Math.sin(titleTime * 0.22) * 0.5
  // Keep the orbit above the tree canopy (and out of any hill it grazes).
  for (let i = 0; i < 12; i++) {
    if (world.getBlock(Math.floor(cx), Math.floor(cy), Math.floor(cz)) === 0) break
    cy += 1.1
  }
  camera.position.set(cx, cy, cz)
  // Look across the treetops toward the horizon instead of into nearby canopy.
  const lookX = px - Math.cos(angle) * 26
  const lookZ = pz - Math.sin(angle) * 26
  const lookY = py + 5.4 + Math.sin(titleTime * 0.17) * 0.7
  camera.lookAt(lookX, lookY, lookZ)
  camera.rotation.z = Math.sin(titleTime * 0.08) * 0.008
}

function loop(now) {
  requestAnimationFrame(loop)
  const rawDt = (now - lastFrame) / 1000
  lastFrame = now
  const dt = Math.min(0.08, Math.max(0, rawDt))

  if (state === 'title') {
    cinematicCamera(dt)
    world.update(player.pos.x, player.pos.z, Math.min(renderRadius, 6), isTouch ? 3 : 5)
  } else if (state === 'playing') {
    worldTime += dt
    saveTimer += dt
    player.update(dt)
    mobs.update(dt, worldTime, environment.isNight)
    world.update(player.pos.x, player.pos.z, renderRadius, isTouch ? 4 : 6)
    if (saveTimer > 18) saveWorld()
  } else if (state === 'paused' || state === 'inventory') {
    // Keep the scene visible but freeze simulation.
    if (document.pointerLockElement === canvas && state !== 'playing') document.exitPointerLock()
  }

  const dayTime = (worldTime / DAY_LENGTH) % 1
  const dayNumber = Math.floor(worldTime / DAY_LENGTH) + 1
  environment.update(dt, dayTime, camera.position, fogFar)
  ui.update(dt, {
    dayTime,
    dayNumber,
    isNight: environment.isNight,
    mobCount: mobs.mobs.length,
    state,
  })
  if (state === 'playing') {
    ui.setLockHint(!isTouch && document.pointerLockElement !== canvas)
  }
  renderer.render(scene, camera)
}

async function boot() {
  ui.setState('loading')
  ui.showLoading(0.02, 'Shaping continents…')
  ui.rotateTip()
  await new Promise((resolve) => setTimeout(resolve, 40))
  const preloadRadius = isTouch ? 3 : 4
  await world.preload(player.pos.x, player.pos.z, preloadRadius, (p) => {
    const percent = Math.round(p * 100)
    ui.showLoading(p * 0.92, `Generating terrain… ${percent}%`)
  })
  ui.showLoading(0.98, 'Planting trees and lighting the sky…')
  await new Promise((resolve) => setTimeout(resolve, 60))
  ui.showLoading(1, 'Ready')
  state = 'title'
  player.setEnabled(false)
  setHandVisible(false)
  ui.showTitle({ seed: world.seed, hasSave: !!loadSave() })
  if (params.has('debug')) {
    window.__vc = {
      player, world, mobs, environment, camera, ui,
      get state() { return state },
      get worldTime() { return worldTime },
      get spawnPoint() { return spawnPoint },
      setTime(value) { worldTime = value },
    }
  }
  lastFrame = performance.now()
  requestAnimationFrame(loop)
}

boot().catch((error) => {
  console.error(error)
  ui.showLoading(1, 'Something went wrong — reload to try again')
})
