import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createWorld, heightAt, SPAWN, WATER_Y } from './world.js';
import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { Quest } from './quest.js';
import { UI } from './ui.js';
import { FX } from './fx.js';
import { AudioEngine } from './audio.js';
import { clamp, damp } from './look.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

let detectedQuality = 'high';
try {
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const name = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|software|llvmpipe|basic render/i.test(name)) detectedQuality = 'low';
  else if (window.matchMedia('(pointer: coarse)').matches) detectedQuality = 'medium';
} catch {}

const quality = ['low', 'medium', 'high'].includes(params.get('quality'))
  ? params.get('quality')
  : detectedQuality;

let activeQuality = quality;
const pixelRatio = () =>
  Math.min(window.devicePixelRatio || 1, activeQuality === 'high' ? 2 : activeQuality === 'medium' ? 1.5 : 1);

renderer.setPixelRatio(pixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = quality !== 'low';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.12, 760);
camera.userData.yaw = 0;

const fx = new FX(scene, camera);
const audio = new AudioEngine();

const game = {
  mode: 'loading',
  quality,
  scene,
  camera,
  renderer,
  fx,
  audio,
  elapsed: 0,
  qualityIndex: ['low', 'medium', 'high'].indexOf(quality),
};

const clock = { last: performance.now() };
const camState = { yaw: 0, pitch: 0.17, dist: 8.8, targetDist: 8.8 };
const keys = new Set();
const joy = { x: 0, y: 0, active: false, pointerId: null };
const input = {
  x: 0,
  y: 0,
  sprint: false,
  jumpPressed: false,
  jumpHeld: false,
  attackPressed: false,
  skillPressed: false,
  burstPressed: false,
  interactPressed: false,
};
let touchJumpHeld = false;
let drag = null;
let ui = null;
let world = null;
let player = null;
let enemies = null;
let quest = null;
let composer = null;
let bloom = null;
let minimapTimer = 0;
let currentInteraction = null;
let booted = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function boot() {
  ui = new UI(game);
  game.ui = ui;
  ui.setLoading(0.08, 'Menenun angin...');
  await sleep(40);

  ui.setLoading(0.22, 'Mengangkat pulau dari laut...');
  await sleep(30);
  world = createWorld(scene, { quality });
  game.world = world;

  ui.setLoading(0.55, 'Menumbuhkan hutan Aetheria...');
  await sleep(30);

  enemies = new EnemyManager({
    scene,
    fx,
    audio,
    ui,
    camera,
    onKill: (enemy) => handleKill(enemy),
  });
  game.enemies = enemies;

  player = new Player({ scene, camera, world, fx, enemies, audio, ui });
  game.player = player;

  quest = new Quest(game);
  game.quest = quest;

  ui.setLoading(0.82, 'Membangunkan elemen purba...');
  await sleep(30);

  if (quality === 'high') {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.55, 0.9);
      composer.addPass(bloom);
    } catch (error) {
      composer = null;
    }
  }

  // A pleasant establishing shot before the player takes control.
  player.character.root.position.copy(player.pos);
  player.character.root.rotation.y = player.facing;
  player.character.update(0.016, { speed: 0, onGround: true, elapsed: 0 });

  camState.yaw = 0.55;
  camState.pitch = 0.24;
  camState.dist = 8.2;
  camState.targetDist = 8.2;
  updateCamera(0.016, true);

  ui.setLoading(0.95, 'Menajamkan bilah...');
  await sleep(30);
  ui.setLoading(1, 'Aetheria siap.');
  await sleep(280);

  ui.hideLoading();
  ui.showTitle();
  game.mode = 'title';
  booted = true;
  clock.last = performance.now();
  requestAnimationFrame(loop);
}

function handleKill(enemy) {
  quest?.onKill(enemy);
  if (player) {
    const gain = enemy.boss ? 24 : 15;
    player.energy[player.active] = Math.min(player.maxEnergy, player.energy[player.active] + gain);
  }
}

function startGame() {
  if (game.mode !== 'title' || !booted) return;
  audio.init();
  audio.sfx('ui');
  ui.hideTitle();
  ui.showHud();
  player.character.root.position.copy(player.pos);
  player.character.root.rotation.y = player.facing;
  ui.updateParty(player);
  ui.setElement(player.data.element);
  quest.start();
  camState.yaw = 0;
  camState.pitch = 0.17;
  camState.targetDist = 8.8;
  updateCamera(0.016, true);
  game.mode = 'playing';
  ui.toast('Jelajahi pulau. Ikuti <b>penanda emas</b> untuk memulai.', '✦');
}

function togglePause() {
  if (game.mode === 'playing') {
    ui.openPause();
  } else if (game.mode === 'paused') {
    ui.closePause();
  }
}

function cycleQuality() {
  game.qualityIndex = (game.qualityIndex + 1) % 3;
  game.quality = ['low', 'medium', 'high'][game.qualityIndex];
  activeQuality = game.quality;
  renderer.setPixelRatio(pixelRatio());
  const label = document.querySelector('#toggle-quality b');
  if (label) label.textContent = game.quality === 'low' ? 'Rendah' : game.quality === 'medium' ? 'Sedang' : 'Tinggi';
}

function toggleAudio() {
  audio.setEnabled(!audio.enabled);
  const label = document.querySelector('#toggle-audio b');
  if (label) label.textContent = audio.enabled ? 'Nyala' : 'Mati';
}

function requestJump() {
  input.jumpPressed = true;
  input.jumpHeld = true;
  touchJumpHeld = true;
}

function releaseJump() {
  touchJumpHeld = false;
  input.jumpHeld = false;
}

function bindControls() {
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-pause').addEventListener('click', () => {
    if (game.mode === 'playing' || game.mode === 'paused') togglePause();
  });
  document.getElementById('pause-resume').addEventListener('click', () => ui.closePause());
  document.getElementById('toggle-quality').addEventListener('click', cycleQuality);
  document.getElementById('toggle-audio').addEventListener('click', toggleAudio);
  document.getElementById('pause-restart').addEventListener('click', () => location.reload());

  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const attack = document.getElementById('btn-attack');
  const skill = document.getElementById('btn-skill');
  const burst = document.getElementById('btn-burst');
  const jump = document.getElementById('btn-jump');

  attack.addEventListener('pointerdown', (event) => {
    stop(event);
    if (game.mode === 'playing') input.attackPressed = true;
  });
  skill.addEventListener('pointerdown', (event) => {
    stop(event);
    if (game.mode === 'playing') input.skillPressed = true;
  });
  burst.addEventListener('pointerdown', (event) => {
    stop(event);
    if (game.mode === 'playing') input.burstPressed = true;
  });
  jump.addEventListener('pointerdown', (event) => {
    stop(event);
    if (game.mode === 'playing') requestJump();
  });
  jump.addEventListener('pointerup', (event) => {
    stop(event);
    releaseJump();
  });
  jump.addEventListener('pointercancel', releaseJump);
  jump.addEventListener('pointerleave', releaseJump);

  document.querySelectorAll('.char-chip').forEach((chip) => {
    chip.addEventListener('pointerdown', (event) => {
      stop(event);
      if (game.mode !== 'playing') return;
      player.switchTo(Number(chip.dataset.char));
      audio.sfx('ui');
    });
  });

  // Keyboard
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      if (game.mode === 'playing' || game.mode === 'paused') {
        event.preventDefault();
        togglePause();
      }
      return;
    }
    if (game.mode !== 'playing') return;
    const code = event.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) event.preventDefault();
    keys.add(code);
    if (event.repeat) return;
    if (code === 'Space') {
      requestJump();
    } else if (code === 'KeyE') {
      input.skillPressed = true;
    } else if (code === 'KeyQ') {
      input.burstPressed = true;
    } else if (code === 'KeyF') {
      input.interactPressed = true;
    } else if (code === 'Digit1') {
      player.switchTo(0);
    } else if (code === 'Digit2') {
      player.switchTo(1);
    } else if (code === 'KeyM') {
      toggleAudio();
      ui.toast(audio.enabled ? 'Suara <b>nyala</b>' : 'Suara <b>mati</b>', '♪');
    } else if (code === 'KeyJ') {
      input.attackPressed = true;
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    if (event.code === 'Space') {
      touchJumpHeld = false;
      input.jumpHeld = false;
    }
  });
  window.addEventListener('blur', () => {
    keys.clear();
    releaseJump();
  });

  // Mouse / touch camera on the canvas.
  canvas.addEventListener('pointerdown', (event) => {
    if (game.mode !== 'playing') return;
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: 0,
      start: performance.now(),
      type: event.pointerType,
      button: event.button,
    };
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const sens = drag.type === 'touch' ? 0.0062 : 0.0046;
    camState.yaw -= dx * sens;
    camState.pitch = clamp(camState.pitch + dy * sens * 0.8, 0.02, 1.12);
  });
  const endDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const quick = performance.now() - drag.start < 320;
    if (drag.type === 'mouse' && drag.button === 0 && drag.moved < 7 && quick && game.mode === 'playing') {
      input.attackPressed = true;
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      camState.targetDist = clamp(camState.targetDist + event.deltaY * 0.0055, 3.6, 12);
    },
    { passive: false }
  );

  // Virtual joystick.
  const joyEl = document.getElementById('joystick');
  const stick = document.getElementById('stick');
  const moveJoy = (event) => {
    const rect = joyEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.32;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    joy.x = dx / maxR;
    joy.y = -dy / maxR;
    stick.style.transform = `translate(${dx * 0.82}px, ${dy * 0.82}px)`;
  };
  joyEl.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    joy.active = true;
    joy.pointerId = event.pointerId;
    joyEl.setPointerCapture(event.pointerId);
    moveJoy(event);
  });
  joyEl.addEventListener('pointermove', (event) => {
    if (!joy.active || joy.pointerId !== event.pointerId) return;
    event.preventDefault();
    moveJoy(event);
  });
  const endJoy = (event) => {
    if (joy.pointerId !== event.pointerId) return;
    joy.active = false;
    joy.pointerId = null;
    joy.x = 0;
    joy.y = 0;
    stick.style.transform = 'translate(0px, 0px)';
  };
  joyEl.addEventListener('pointerup', endJoy);
  joyEl.addEventListener('pointercancel', endJoy);

  // Pause menu label sync on load.
  const qLabel = document.querySelector('#toggle-quality b');
  if (qLabel) qLabel.textContent = quality === 'low' ? 'Rendah' : quality === 'medium' ? 'Sedang' : 'Tinggi';

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 220));
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(w, h);
  composer?.setSize(w, h);
  bloom?.setSize(w, h);
}

function updateCamera(dt, snap = false) {
  camState.dist = damp(camState.dist, camState.targetDist, 8, dt);
  const target = new THREE.Vector3(player.pos.x, player.pos.y + 1.62, player.pos.z);
  const cosPitch = Math.cos(camState.pitch);
  const desired = new THREE.Vector3(
    target.x + Math.sin(camState.yaw) * cosPitch * camState.dist,
    target.y + Math.sin(camState.pitch) * camState.dist,
    target.z + Math.cos(camState.yaw) * cosPitch * camState.dist
  );

  // Never let the camera sink into a hill.
  const ground = heightAt(desired.x, desired.z);
  const minY = Math.max(ground, WATER_Y) + 0.55;
  if (desired.y < minY) desired.y = minY;

  if (snap) camera.position.copy(desired);
  else camera.position.lerp(desired, 1 - Math.exp(-13 * dt));

  if (player.shake > 0.002) {
    const s = player.shake * 0.34;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }

  camera.lookAt(target);
  camera.userData.yaw = camState.yaw;
}

function gatherInput() {
  const keyboardX = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const keyboardY = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  let x = keyboardX + joy.x;
  let y = keyboardY + joy.y;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  input.x = x;
  input.y = y;
  const joyMag = Math.hypot(joy.x, joy.y);
  input.sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') || joyMag > 0.92;
  input.jumpHeld = keys.has('Space') || touchJumpHeld;
}

function clearPressed() {
  input.jumpPressed = false;
  input.attackPressed = false;
  input.skillPressed = false;
  input.burstPressed = false;
  input.interactPressed = false;
}

function updatePlaying(dt) {
  gatherInput();
  camera.userData.yaw = camState.yaw;
  player.update(dt, input, camState.yaw, game.elapsed);
  enemies.update(dt, player, game.elapsed);
  quest.update(player.pos);
  updateCamera(dt);

  // Interaction prompt & quest markers.
  currentInteraction = quest.nearestInteraction(player.pos);
  ui.setInteraction(currentInteraction);
  if (input.interactPressed && currentInteraction) {
    quest.interact(player.pos);
  }

  const marker = quest.getMarker();
  ui.updateMarker(marker, camera);
  ui.updateBoss(enemies.bossBarData, camera, player.pos);
  ui.updateHud(player.stats(), player);

  minimapTimer -= dt;
  if (minimapTimer <= 0) {
    minimapTimer = 0.08;
    ui.drawMinimap(player, quest, enemies, camState.yaw);
  }

  clearPressed();
}

function updateNonPlaying(dt) {
  if (player) {
    player.character.anim.attack = -1;
    player.character.update(dt, { speed: 0, onGround: true, elapsed: game.elapsed });
    player.character.root.position.copy(player.pos);
    player.character.root.rotation.y = player.facing;
  }
  ui.setInteraction(null);
  clearPressed();
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.0001, (now - clock.last) / 1000));
  clock.last = now;
  game.elapsed += dt;

  if (game.mode === 'title') {
    camState.yaw += dt * 0.07;
    updateNonPlaying(dt);
    // A slow cinematic establishing shot of the island and its peaks.
    const t = game.elapsed;
    camera.position.set(30 + Math.sin(t * 0.07) * 3.5, 25.5, 2 + Math.cos(t * 0.055) * 2.5);
    camera.lookAt(-4, 7, 40);
    camera.userData.yaw = camState.yaw;
    world.update(dt, game.elapsed, player.pos);
    ui.updateMarker(null, camera);
  } else if (game.mode === 'playing') {
    updatePlaying(dt);
    world.update(dt, game.elapsed, player.pos);
  } else {
    updateNonPlaying(dt);
    if (game.mode !== 'paused' && game.mode !== 'dead') {
      // Keep ambient time alive for dialogue and reward screens.
      world.update(dt, game.elapsed, player.pos);
      updateCamera(dt);
    }
  }

  // Keep damage numbers glued to the world even while paused.
  fx.update(dt);

  if (composer && useComposer()) composer.render();
  else renderer.render(scene, camera);
}

function useComposer() {
  return game.quality === 'high' && composer !== null;
}

window.addEventListener('error', (event) => {
  console.error(event.error || event.message);
});

game.start = startGame;
game.interact = () => {
  if (game.mode === 'playing') quest.interact(player.pos);
};
game.respawnPlayer = () => {
  player.respawn();
  updateCamera(0.016, true);
};
window.game = game;

bindControls();
boot().catch((error) => {
  console.error(error);
  const text = document.getElementById('loading-text');
  if (text) text.textContent = 'Gagal memuat dunia. Muat ulang halaman.';
});
