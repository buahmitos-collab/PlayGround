import { heightAt, slopeAt, WORLD_RADIUS, STATUE_POS, NPC_POS, CHEST_POS, WISP_SPOTS } from './world.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      loading: $('loading'),
      loadingFill: $('loading-fill'),
      loadingText: $('loading-text'),
      title: $('title'),
      hud: $('hud'),
      questTitle: $('quest-title'),
      questDesc: $('quest-desc'),
      questProgress: $('quest-progress'),
      questProgressFill: $('quest-progress').querySelector('i'),
      questProgressText: $('quest-progress').querySelector('span'),
      marker: $('objective-marker'),
      markerDist: $('marker-dist'),
      interact: $('interact'),
      interactText: $('interact-text'),
      staminaWrap: $('stamina-wrap'),
      stamina: $('stamina').querySelector('i'),
      hp: document.querySelectorAll('.char-hp i'),
      party: document.querySelectorAll('.char-chip'),
      skill: $('btn-skill'),
      burst: $('btn-burst'),
      attack: $('btn-attack'),
      jump: $('btn-jump'),
      skillCd: $('btn-skill').querySelector('.cd'),
      burstEnergy: $('btn-burst').querySelector('.energy-pip'),
      toastStack: $('toast-stack'),
      damageLayer: $('damage-layer'),
      enemyBars: $('enemy-bars'),
      reaction: $('reaction-pop'),
      bossBar: $('boss-bar'),
      bossFill: $('boss-fill'),
      bossName: $('boss-name'),
      bossElement: $('boss-element'),
      dialogue: $('dialogue'),
      dialogueName: $('dialogue-name'),
      dialogueText: $('dialogue-text'),
      dialogueNext: $('dialogue-next'),
      reward: $('reward'),
      rewardClose: $('reward-close'),
      pause: $('pause'),
      death: $('death'),
      deathRespawn: $('death-respawn'),
      flash: $('flash'),
      lowHp: $('low-hp'),
      minimap: $('minimap'),
      minimapLabel: $('minimap-label'),
    };
    this.ctx = this.el.minimap.getContext('2d');
    this.dialogueLines = [];
    this.dialogueIndex = 0;
    this.dialogueTimer = null;
    this.dialogueTyping = false;
    this.dialogueFull = '';
    this.dialogueChar = 0;
    this.dialogueOnDone = null;
    this.dialogueActive = false;
    this.mapCanvas = null;
    this.mapScale = 1;
    this.mapExtent = 110;
    this.reactionTimer = null;
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (this.isTouch) document.body.classList.add('touch');
    this.buildMap();
    this.bind();
    this.createHurtFlash();
  }

  createHurtFlash() {
    const el = document.createElement('div');
    el.id = 'hurt-flash';
    el.style.cssText = `
      position:fixed;inset:0;pointer-events:none;z-index:29;opacity:0;
      background:radial-gradient(ellipse at center, transparent 38%, rgba(200,25,30,.6) 100%);
      transition:opacity .45s ease;
    `;
    document.body.appendChild(el);
    this.hurtFlash = el;
  }

  buildMap() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const extent = this.mapExtent;
    const waterDeep = [12, 48, 63];
    const waterShallow = [45, 111, 122];
    const sand = [203, 189, 141];
    const grass = [95, 138, 77];
    const grassDark = [69, 110, 66];
    const rock = [138, 136, 123];
    const highRock = [185, 177, 156];

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const wx = (px / size) * extent * 2 - extent;
        const wz = (py / size) * extent * 2 - extent;
        const h = heightAt(wx, wz);
        const slope = slopeAt(wx, wz);
        let c;
        if (h < 0) {
          const t = Math.min(1, -h / 7);
          c = mix(waterShallow, waterDeep, t);
        } else if (h < 1.6) {
          c = mix(sand, grass, Math.min(1, h / 2.2) * 0.35);
        } else {
          c = mix(grass, grassDark, Math.min(1, h / 26) * 0.55);
          if (slope > 0.6) c = mix(c, rock, Math.min(1, (slope - 0.6) * 1.6));
          if (h > 20) c = mix(c, highRock, Math.min(1, (h - 20) / 12) * 0.7);
        }
        const shade = 0.92 + Math.sin(wx * 0.3 + wz * 0.2) * 0.04;
        const i = (py * size + px) * 4;
        img.data[i] = Math.min(255, c[0] * shade);
        img.data[i + 1] = Math.min(255, c[1] * shade);
        img.data[i + 2] = Math.min(255, c[2] * shade);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const upscale = document.createElement('canvas');
    upscale.width = upscale.height = 512;
    const uctx = upscale.getContext('2d');
    uctx.imageSmoothingEnabled = true;
    uctx.drawImage(canvas, 0, 0, 512, 512);
    this.mapCanvas = upscale;
    this.mapScale = 512 / (extent * 2);

    function mix(a, b, t) {
      return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ];
    }
  }

  bind() {
    this.el.dialogueNext.addEventListener('click', () => this.advanceDialogue());
    this.el.interact.addEventListener('click', () => {
      if (this.game.mode === 'playing') this.game.interact();
    });
    this.el.rewardClose.addEventListener('click', () => this.hideReward());
    this.el.deathRespawn.addEventListener('click', () => this.game.respawnPlayer());
    window.addEventListener('keydown', (event) => {
      if (!this.dialogueActive) return;
      if (event.code === 'Enter' || event.code === 'Space' || event.code === 'KeyF') {
        event.preventDefault();
        event.stopPropagation();
        this.advanceDialogue();
      }
    }, true);
  }

  setLoading(progress, text) {
    this.el.loadingFill.style.width = `${Math.round(progress * 100)}%`;
    if (text) this.el.loadingText.textContent = text;
  }

  hideLoading() {
    this.el.loading.classList.add('hidden');
  }

  showTitle() {
    this.el.title.classList.remove('hidden');
  }

  hideTitle() {
    this.el.title.classList.add('hidden');
  }

  showHud() {
    this.el.hud.classList.remove('hidden');
  }

  setQuest({ title, desc, current, total }) {
    this.el.questTitle.textContent = title;
    this.el.questDesc.textContent = desc;
    if (total > 0) {
      this.el.questProgress.classList.remove('hidden');
      this.el.questProgressFill.style.setProperty('--p', `${Math.min(100, (current / total) * 100)}%`);
      this.el.questProgressText.textContent = `${current} / ${total}`;
    } else {
      this.el.questProgress.classList.add('hidden');
    }
  }

  updateParty(player) {
    this.el.party.forEach((chip, index) => {
      chip.classList.toggle('active', index === player.active);
      this.el.hp[index].style.width = `${Math.max(0, (player.health / player.maxHealth) * 100)}%`;
    });
  }

  setElement(element) {
    document.body.classList.toggle('pyro', element === 'pyro');
  }

  updateAbilities(stats) {
    const cd = stats.cooldown;
    this.el.skillCd.textContent = cd > 0.05 ? String(Math.ceil(cd)) : '';
    this.el.skillCd.style.height = cd > 0.05 ? `${Math.min(100, (cd / stats.maxCooldown) * 100)}%` : '0%';
    this.el.skill.classList.toggle('ready', cd <= 0.05);

    const energyPct = Math.min(100, (stats.energy / stats.maxEnergy) * 100);
    this.el.burstEnergy.style.setProperty('--energy', `${energyPct}%`);
    this.el.burst.classList.toggle('ready', energyPct >= 99.5);

    this.el.stamina.style.width = `${Math.max(0, (stats.stamina / stats.maxStamina) * 100)}%`;
    const showStamina = stats.stamina < stats.maxStamina - 1 || stats.gliding || stats.swimming || stats.sprinting;
    this.el.staminaWrap.classList.toggle('hidden', !showStamina);

    this.el.lowHp.classList.toggle('on', stats.health > 0 && stats.health < 30);
    this.setElement(stats.element);
  }

  setInteraction(interaction) {
    if (!interaction) {
      this.el.interact.classList.add('hidden');
      return;
    }
    this.el.interact.classList.remove('hidden');
    this.el.interactText.textContent = interaction.label;
  }

  updateMarker(marker, camera) {
    if (!marker) {
      this.el.marker.classList.add('hidden');
      return;
    }
    const v = marker.pos.clone();
    const dist = Math.hypot(v.x - this.game.player.pos.x, v.z - this.game.player.pos.z);
    v.project(camera);
    if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.12 || Math.abs(v.y) > 1.12 || dist < 2) {
      this.el.marker.classList.add('hidden');
      return;
    }
    this.el.marker.classList.remove('hidden');
    this.el.marker.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    this.el.marker.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    this.el.markerDist.textContent = `${Math.round(dist)} m`;
  }

  updateBoss(boss, camera, playerPos) {
    if (!boss) {
      this.el.bossBar.classList.add('hidden');
      return;
    }
    const dist = Math.hypot(boss.pos.x - playerPos.x, boss.pos.z - playerPos.z);
    if (dist > 30) {
      this.el.bossBar.classList.add('hidden');
      return;
    }
    this.el.bossBar.classList.remove('hidden');
    this.el.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
  }

  showReaction(text) {
    this.el.reaction.textContent = text;
    this.el.reaction.classList.remove('show');
    void this.el.reaction.offsetWidth;
    this.el.reaction.classList.add('show');
    clearTimeout(this.reactionTimer);
    this.reactionTimer = setTimeout(() => this.el.reaction.classList.remove('show'), 1600);
  }

  toast(html, icon = '✦') {
    while (this.el.toastStack.children.length >= 4) {
      this.el.toastStack.firstElementChild.remove();
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="toast-icon">${icon}</span><span>${html}</span>`;
    this.el.toastStack.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 420);
    }, 3200);
  }

  flashScreen() {
    this.el.flash.classList.add('on');
    setTimeout(() => this.el.flash.classList.remove('on'), 80);
  }

  damageFlash() {
    this.hurtFlash.style.opacity = '1';
    setTimeout(() => { this.hurtFlash.style.opacity = '0'; }, 130);
  }

  showDeath() {
    this.el.death.classList.remove('hidden');
    this.game.mode = 'dead';
  }

  hideDeath() {
    this.el.death.classList.add('hidden');
    this.game.mode = 'playing';
  }

  showReward() {
    this.el.reward.classList.remove('hidden');
    this.game.mode = 'reward';
  }

  hideReward() {
    this.el.reward.classList.add('hidden');
    this.game.mode = 'playing';
  }

  openPause() {
    this.el.pause.classList.remove('hidden');
    this.game.mode = 'paused';
  }

  closePause() {
    this.el.pause.classList.add('hidden');
    this.game.mode = 'playing';
  }

  startDialogue(name, lines, onDone) {
    this.dialogueLines = lines;
    this.dialogueIndex = 0;
    this.dialogueOnDone = onDone;
    this.dialogueActive = true;
    this.el.dialogueName.textContent = name;
    this.el.dialogue.classList.remove('hidden');
    this.game.mode = 'dialogue';
    this.typeDialogue(lines[0]);
  }

  typeDialogue(text) {
    clearInterval(this.dialogueTimer);
    this.dialogueFull = text;
    this.dialogueChar = 0;
    this.dialogueTyping = true;
    this.el.dialogueText.textContent = '';
    this.dialogueTimer = setInterval(() => {
      this.dialogueChar += 1;
      this.el.dialogueText.textContent = text.slice(0, this.dialogueChar);
      if (this.dialogueChar % 5 === 0) this.game.audio.sfx('dialogue');
      if (this.dialogueChar >= text.length) {
        clearInterval(this.dialogueTimer);
        this.dialogueTyping = false;
      }
    }, 18);
  }

  advanceDialogue() {
    if (!this.dialogueActive) return;
    if (this.dialogueTyping) {
      clearInterval(this.dialogueTimer);
      this.dialogueTyping = false;
      this.el.dialogueText.textContent = this.dialogueFull;
      return;
    }
    this.dialogueIndex++;
    if (this.dialogueIndex >= this.dialogueLines.length) {
      this.endDialogue();
      return;
    }
    this.typeDialogue(this.dialogueLines[this.dialogueIndex]);
  }

  endDialogue() {
    clearInterval(this.dialogueTimer);
    this.dialogueTyping = false;
    this.dialogueActive = false;
    this.el.dialogue.classList.add('hidden');
    this.game.mode = 'playing';
    const cb = this.dialogueOnDone;
    this.dialogueOnDone = null;
    cb?.();
  }

  drawMinimap(player, quest, enemies, cameraYaw) {
    const ctx = this.ctx;
    const size = this.el.minimap.width;
    const viewR = 48;
    const px = player.pos.x;
    const pz = player.pos.z;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#0d3343';
    ctx.fillRect(0, 0, size, size);

    const sw = viewR * 2 * this.mapScale;
    const sx = (px + this.mapExtent - viewR) * this.mapScale;
    const sy = (pz + this.mapExtent - viewR) * this.mapScale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapCanvas, sx, sy, sw, sw, 0, 0, size, size);

    const toScreen = (wx, wz) => ({
      x: ((wx - (px - viewR)) / (viewR * 2)) * size,
      y: ((wz - (pz - viewR)) / (viewR * 2)) * size,
    });

    const near = (p) => Math.hypot(p.x - px, p.z - pz) < viewR;

    // enemies
    for (const e of enemies.enemies) {
      if (e.dead) continue;
      if (!near(e.pos)) continue;
      const s = toScreen(e.pos.x, e.pos.z);
      ctx.beginPath();
      ctx.arc(s.x, s.y, e.boss ? 7 : 3.3, 0, Math.PI * 2);
      ctx.fillStyle = e.boss ? '#ff8b5e' : '#ff6961';
      ctx.fill();
      if (e.boss) {
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // wisps
    for (const wisp of this.game.world.wisps) {
      if (wisp.userData.collected || !near(wisp.position)) continue;
      const s = toScreen(wisp.position.x, wisp.position.z);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#8cf0dd';
      ctx.shadowColor = '#8cf0dd';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    const point = (wx, wz, color, radius, stroke = false) => {
      if (!near({ x: wx, z: wz })) return;
      const s = toScreen(wx, wz);
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = 'rgba(255,255,255,.75)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    };

    point(NPC_POS.x, NPC_POS.z, '#f3d998', 3.6, true);
    point(STATUE_POS.x, STATUE_POS.z, '#8cf0dd', 4, true);
    if (!this.game.world.chestOpened()) point(CHEST_POS.x, CHEST_POS.z, '#ffcf7a', 4, true);

    // current quest target (clamped to the rim when off-map)
    const marker = quest.getMarker();
    if (marker) {
      const s = toScreen(marker.pos.x, marker.pos.z);
      const dx = s.x - size / 2;
      const dy = s.y - size / 2;
      const d = Math.hypot(dx, dy);
      const maxR = size / 2 - 16;
      let mx = s.x;
      let my = s.y;
      if (d > maxR) {
        mx = size / 2 + (dx / d) * maxR;
        my = size / 2 + (dy / d) * maxR;
      }
      const pulse = 1 + Math.sin(performance.now() / 260) * 0.18;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#f3d998';
      ctx.shadowColor = '#f3d998';
      ctx.shadowBlur = 10;
      ctx.fillRect(-5.2 * pulse, -5.2 * pulse, 10.4 * pulse, 10.4 * pulse);
      ctx.restore();
    }

    // player arrow
    const yaw = player.facing;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const cx = size / 2;
    const cy = size / 2;
    ctx.beginPath();
    ctx.moveTo(cx + fx * 12, cy + fz * 12);
    ctx.lineTo(cx - fx * 7 + rx * 7, cy - fz * 7 + rz * 7);
    ctx.lineTo(cx - fx * 4, cy - fz * 4);
    ctx.lineTo(cx - fx * 7 - rx * 7, cy - fz * 7 - rz * 7);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#8cf0dd';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(10,30,40,.8)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // camera view cone
    const camAngle = Math.atan2(-Math.cos(cameraYaw), -Math.sin(cameraYaw));
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 34, camAngle - 0.44, camAngle + 0.44);
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 34);
    g.addColorStop(0, 'rgba(220,255,250,.18)');
    g.addColorStop(1, 'rgba(220,255,250,0)');
    ctx.fillStyle = g;
    ctx.fill();

    ctx.restore();

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(243,217,152,.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  updateHud(stats, player) {
    this.updateAbilities(stats);
    if (player) this.updateParty(player);
  }
}
