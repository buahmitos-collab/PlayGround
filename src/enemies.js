import * as THREE from 'three';
import { toon, glowSprite, clamp } from './look.js';
import { ELEMENT_COLORS } from './fx.js';
import { heightAt, slopeAt, BOSS_POS } from './world.js';

const TYPES = {
  hydro: { body: '#3f9bc9', light: '#a5e8ff', glow: '#6fc9ff', name: 'Slime Hydro' },
  pyro: { body: '#cf5b36', light: '#ffb27a', glow: '#ff9a5c', name: 'Slime Pyro' },
  electro: { body: '#8765ca', light: '#d3bcff', glow: '#c69bff', name: 'Slime Electro' },
};

const SPAWNS = [
  [18, 4, 'hydro'],
  [-14, -6, 'electro'],
  [20, -14, 'pyro'],
  [34, 18, 'hydro'],
  [-38, 12, 'electro'],
  [6, -34, 'pyro'],
  [-26, 44, 'hydro'],
  [40, -8, 'electro'],
  [30, 38, 'pyro'],
];

const REACTIONS = {
  'hydro+pyro': { name: 'UAP', mult: 1.8 },
  'pyro+hydro': { name: 'UAP', mult: 1.8 },
  'anemo+pyro': { name: 'KOBAR', mult: 1.35 },
  'pyro+anemo': { name: 'KOBAR', mult: 1.35 },
  'anemo+hydro': { name: 'PUSARAN', mult: 1.3 },
  'hydro+anemo': { name: 'PUSARAN', mult: 1.3 },
  'hydro+electro': { name: 'KEJUT', mult: 1.5 },
  'electro+hydro': { name: 'KEJUT', mult: 1.5 },
  'pyro+electro': { name: 'LEDAKAN', mult: 1.6 },
  'electro+pyro': { name: 'LEDAKAN', mult: 1.6 },
  'anemo+electro': { name: 'PUSARAN', mult: 1.3 },
  'electro+anemo': { name: 'PUSARAN', mult: 1.3 },
};

function makeSlime(type, scale, boss = false) {
  const data = TYPES[type];
  const group = new THREE.Group();
  const bodyMat = toon(data.body);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 14), bodyMat);
  body.position.y = 0.6;
  body.scale.set(1, 0.82, 1);
  body.castShadow = true;
  group.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), toon(data.light));
  belly.position.set(0, 0.5, 0.14);
  belly.scale.set(1, 0.7, 0.55);
  group.add(belly);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.17, 0),
    new THREE.MeshBasicMaterial({ color: data.glow, transparent: true, opacity: 0.85 })
  );
  core.position.set(0, 0.58, 0.3);
  group.add(core);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), new THREE.MeshBasicMaterial({ color: '#f7fffd' }));
    eye.position.set(side * 0.23, 0.74, 0.6);
    eye.scale.set(0.85, 1.1, 0.6);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: '#17262d' }));
    pupil.position.set(side * 0.23, 0.74, 0.685);
    pupil.scale.set(0.9, 1.3, 0.4);
    group.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.028, 0.02), new THREE.MeshBasicMaterial({ color: '#2a1e1e' }));
    brow.position.set(side * 0.23, 0.87, 0.66);
    brow.rotation.z = side * -0.28;
    group.add(brow);
  }

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.035, 0.02),
    new THREE.MeshBasicMaterial({ color: '#3b2323' })
  );
  mouth.position.set(0, 0.58, 0.67);
  group.add(mouth);

  const glow = glowSprite(data.glow, 2.2, 0.3);
  glow.position.y = 0.6;
  group.add(glow);

  if (boss) {
    const crown = new THREE.Group();
    const gold = toon('#f0cc76');
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 4), gold);
      const a = (i / 5) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.34, 1.28, Math.sin(a) * 0.34);
      spike.rotation.z = -Math.cos(a) * 0.25;
      spike.rotation.x = Math.sin(a) * 0.25;
      crown.add(spike);
    }
    group.add(crown);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 5), toon('#e8e1c8'));
    horn.position.set(0, 1.2, 0.32);
    horn.rotation.x = 0.35;
    group.add(horn);
  }

  group.scale.setScalar(scale);
  group.userData = { body, belly, core, glow, bodyMat, eyes: [] };
  return group;
}

export class EnemyManager {
  constructor({ scene, fx, audio, ui, camera, onKill }) {
    this.scene = scene;
    this.fx = fx;
    this.audio = audio;
    this.ui = ui;
    this.camera = camera;
    this.onKill = onKill;
    this.enemies = [];
    this.bars = [];
    this.boss = null;
    this.kills = 0;
    this.vortex = null;
    this.time = 0;
    this.barLayer = document.getElementById('enemy-bars');
    this.tmp = new THREE.Vector3();

    SPAWNS.forEach(([x, z, type]) => this.spawn(x, z, type, 1));
    this.boss = this.spawn(BOSS_POS.x, BOSS_POS.z, 'hydro', 2.15, true);
  }

  spawn(x, z, type, scale, boss = false) {
    const group = makeSlime(type, scale, boss);
    const y = heightAt(x, z);
    group.position.set(x, y, z);
    this.scene.add(group);
    const body = group.userData.body;

    const bar = document.createElement('div');
    bar.className = `enemy-bar${boss ? ' boss' : ''}`;
    bar.innerHTML = `<span class="eb-name">${boss ? 'Raja Slime Purba' : TYPES[type].name}</span><div class="eb-track"><div class="eb-fill"></div></div>`;
    this.barLayer.appendChild(bar);

    const enemy = {
      group,
      body,
      type,
      boss,
      home: new THREE.Vector3(x, y, z),
      pos: group.position,
      scale,
      hp: boss ? 420 : 72,
      maxHp: boss ? 420 : 72,
      radius: 0.72 * scale,
      state: 'idle',
      stateT: 0,
      attackCooldown: 1 + Math.random() * 2,
      wanderAngle: Math.random() * Math.PI * 2,
      wanderT: 0,
      aura: { element: type, until: Infinity },
      burning: null,
      flash: 0,
      dead: false,
      respawn: 0,
      velocity: new THREE.Vector3(),
      phase: Math.random() * 6.28,
      bar,
      fill: bar.querySelector('.eb-fill'),
      hitFlash: 0,
      lastHit: 0,
    };
    enemy.group.userData.enemy = enemy;
    this.enemies.push(enemy);
    return enemy;
  }

  get alive() {
    return this.enemies.filter((e) => !e.dead);
  }

  nearest(position, maxDistance = 999) {
    let best = null;
    let bestD = maxDistance;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - position.x, e.pos.z - position.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  setVortex(center, radius, duration, dps, element = 'anemo') {
    this.vortex = { center: center.clone(), radius, until: this.time + duration, dps, element, tick: 0 };
  }

  update(dt, player, elapsed) {
    this.time = elapsed;
    const pAlive = player.alive;
    const px = player.pos.x;
    const pz = player.pos.z;
    const py = player.pos.y;

    if (this.vortex) {
      if (elapsed > this.vortex.until) this.vortex = null;
      else this.vortex.tick -= dt;
    }

    for (const e of this.enemies) {
      if (e.dead) {
        e.respawn -= dt;
        if (e.respawn <= 0) this.respawn(e, player);
        continue;
      }

      const dist = Math.hypot(e.pos.x - px, e.pos.z - pz);
      e.stateT += dt;
      e.attackCooldown -= dt;
      e.flash = Math.max(0, e.flash - dt * 4);
      e.hitFlash = Math.max(0, e.hitFlash - dt * 6);

      // Elemental aura slowly decays.
      if (e.aura.until !== Infinity && elapsed > e.aura.until) e.aura = { element: null, until: 0 };

      // Burning damage-over-time from a Kobar reaction.
      if (e.burning) {
        e.burning.t -= dt;
        e.burning.tick -= dt;
        if (e.burning.tick <= 0) {
          e.burning.tick = 0.62;
          this.rawDamage(e, 7 + player.level * 1.2, 'pyro', false, true);
          const pos = e.pos.clone();
          pos.y += 0.8 * e.scale;
          this.fx.spark(pos, 'pyro', { count: 5, speed: 1.6, size: 0.22, life: 0.5, gravity: -1, up: 1.6 });
        }
        if (e.burning.t <= 0) e.burning = null;
      }

      if (e.dead) continue;

      // Anemo vortex pulls enemies toward its centre.
      if (this.vortex) {
        const v = this.vortex;
        const dx = v.center.x - e.pos.x;
        const dz = v.center.z - e.pos.z;
        const vd = Math.hypot(dx, dz);
        if (vd < v.radius && vd > 0.2) {
          const pull = (1 - vd / v.radius) * 4.4;
          e.pos.x += (dx / vd) * pull * dt;
          e.pos.z += (dz / vd) * pull * dt;
          e.state = 'pulled';
          e.stateT = 0;
          if (Math.random() < dt * 6) {
            const p = e.pos.clone();
            p.y += 0.8;
            this.fx.spark(p, v.element, { count: 2, speed: 1, size: 0.18, life: 0.5, gravity: -1.5, up: 2 });
          }
          if (v.tick <= 0) {
            v.tick = 0.5;
            this.rawDamage(e, v.dps * 0.5, v.element, false, true);
          }
        }
      }

      // Hit knockback smoothing.
      e.pos.x += e.velocity.x * dt;
      e.pos.z += e.velocity.z * dt;
      e.velocity.multiplyScalar(Math.max(0, 1 - 8 * dt));

      const aggro = pAlive && dist < (e.boss ? 22 : 16);
      if (e.state === 'windup' || e.state === 'pulled') {
        // stay put while telegraphing / being pulled
      } else if (aggro) {
        const speed = e.boss ? 2.1 : 2.4;
        if (dist > (e.boss ? 3.6 : 2.5)) {
          const nx = (px - e.pos.x) / dist;
          const nz = (pz - e.pos.z) / dist;
          const wobble = Math.sin(elapsed * 4 + e.phase) * 0.32;
          const targetX = e.pos.x + (nx + -nz * wobble) * speed * dt;
          const targetZ = e.pos.z + (nz + nx * wobble) * speed * dt;
          const h = heightAt(targetX, targetZ);
          if (h > -0.4) {
            e.pos.x = targetX;
            e.pos.z = targetZ;
          }
          e.state = 'chase';
        } else {
          e.state = 'chase';
          if (e.attackCooldown <= 0) {
            e.state = 'windup';
            e.stateT = 0;
            e.attackCooldown = e.boss ? 2.6 : 2.2;
          }
        }
      } else {
        // gentle wander around the spawn point
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          e.wanderT = 2.4 + Math.random() * 3.5;
          e.wanderAngle = Math.random() * Math.PI * 2;
        }
        if (e.state === 'chase') e.state = 'idle';
        const homeDist = Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z);
        if (homeDist < 5) {
          const nx = e.pos.x + Math.cos(e.wanderAngle) * 0.55 * dt;
          const nz = e.pos.z + Math.sin(e.wanderAngle) * 0.55 * dt;
          if (heightAt(nx, nz) > -0.2) {
            e.pos.x = nx;
            e.pos.z = nz;
          }
        } else {
          const nx = (e.home.x - e.pos.x) / homeDist;
          const nz = (e.home.z - e.pos.z) / homeDist;
          e.pos.x += nx * 0.9 * dt;
          e.pos.z += nz * 0.9 * dt;
        }
      }

      // Windup then strike.
      if (e.state === 'windup' && e.stateT > (e.boss ? 0.62 : 0.48)) {
        const strikeDist = Math.hypot(px - e.pos.x, pz - e.pos.z);
        if (pAlive && strikeDist < 3.2 * (e.boss ? 1.25 : 1)) {
          const dmg = e.boss ? 20 : 11;
          player.takeDamage(dmg, e.pos, e.type);
          if (e.boss) {
            this.fx.shockwave(e.pos.clone(), ELEMENT_COLORS.hydro, 3.4, { life: 0.4 });
          }
        }
        this.fx.spark(
          new THREE.Vector3(e.pos.x, e.pos.y + 0.5, e.pos.z),
          e.type,
          { count: 12, speed: 3.5, size: 0.25, life: 0.5, gravity: 6, up: 0.5 }
        );
        this.audio.sfx('land');
        e.state = 'idle';
        e.stateT = 0;
      }

      // Keep slimes planted on the terrain and face the player.
      const ground = heightAt(e.pos.x, e.pos.z);
      e.pos.y = ground + 0.02;
      if (aggro || e.state === 'windup') {
        const targetYaw = Math.atan2(px - e.pos.x, pz - e.pos.z);
        let diff = targetYaw - e.group.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        e.group.rotation.y += diff * Math.min(1, dt * 7);
      } else {
        e.group.rotation.y += dt * 0.4;
      }

      // Squash/stretch + element flash.
      const squash = e.state === 'windup' ? 0.78 + Math.sin(elapsed * 30) * 0.05 : 1 + Math.sin(elapsed * 4.2 + e.phase) * 0.06;
      e.group.userData.body.scale.set(1.04 / Math.sqrt(squash), 0.82 * squash, 1.04 / Math.sqrt(squash));
      const flash = Math.max(e.flash, e.hitFlash * 0.55);
      e.group.userData.bodyMat.emissive.setRGB(flash, flash, flash);
      e.group.userData.bodyMat.emissiveIntensity = flash * 1.4;

      // Update floating HP bar.
      this.updateBar(e, dist);
    }

    // Hide bars for enemies that are far away.
    for (const e of this.enemies) {
      if (e.dead) e.bar.style.display = 'none';
    }
  }

  updateBar(e, dist) {
    const bar = e.bar;
    const scale = e.scale;
    this.tmp.set(e.pos.x, e.pos.y + 1.7 * scale + 0.5, e.pos.z);
    this.tmp.project(this.camera);
    const visible = !e.boss && dist < 26 && this.tmp.z < 1 && this.tmp.z > -1;
    if (!visible) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = '';
    bar.style.left = `${(this.tmp.x * 0.5 + 0.5) * window.innerWidth}px`;
    bar.style.top = `${(-this.tmp.y * 0.5 + 0.5) * window.innerHeight}px`;
    bar.style.opacity = clamp(1.4 - dist / 34, 0.25, 1);
    e.fill.style.width = `${Math.max(0, (e.hp / e.maxHp) * 100)}%`;
  }

  hitCone(origin, direction, range, cosHalf, damage, element, crit) {
    const hits = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - origin.x;
      const dz = e.pos.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.radius) continue;
      const dot = (dx / (d || 1)) * direction.x + (dz / (d || 1)) * direction.z;
      if (dot < cosHalf && d > 1.2) continue;
      hits.push(e);
      this.applyDamage(e, damage, element, { crit, from: origin, knockback: 2.6 });
    }
    return hits;
  }

  damageArea(center, radius, damage, element, { crit = false, knockback = 1.4 } = {}) {
    const hits = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.pos.x - center.x, e.pos.z - center.z);
      if (d > radius + e.radius) continue;
      hits.push(e);
      const falloff = 1 - clamp((d - radius * 0.4) / (radius * 0.8), 0, 0.45);
      this.applyDamage(e, damage * falloff, element, { crit, from: center, knockback });
    }
    return hits;
  }

  applyDamage(enemy, baseDamage, element, { crit = false, from = null, knockback = 1.2, silent = false } = {}) {
    if (enemy.dead) return 0;

    // Elemental reaction with the aura currently on the target.
    let multiplier = 1;
    let reaction = null;
    const auraEl = enemy.aura?.element;
    if (auraEl && auraEl !== element) {
      const key = `${auraEl}+${element}`;
      if (REACTIONS[key]) {
        reaction = REACTIONS[key];
        multiplier = reaction.mult;
        enemy.aura = { element: null, until: 0 };
        if (reaction.name === 'KOBAR') {
          enemy.burning = { t: 3.2, tick: 0, name: 'Kobar' };
        } else if (reaction.name === 'KEJUT') {
          // Electro-charged arcs to one nearby enemy.
          const other = this.enemies.find(
            (o) => o !== enemy && !o.dead && Math.hypot(o.pos.x - enemy.pos.x, o.pos.z - enemy.pos.z) < 7
          );
          if (other) setTimeout(() => this.rawDamage(other, baseDamage * 0.45, 'electro', false, false), 120);
        }
      }
    }
    if (element !== 'physical' && element !== 'anemo') {
      if (!enemy.burning) enemy.aura = { element, until: this.time + 7 };
    } else if (element === 'anemo' && !auraEl) {
      enemy.aura = { element: null, until: 0 };
    }

    if (reaction) {
      this.ui?.showReaction(reaction.name);
      const p = enemy.pos.clone();
      p.y += 1.1;
      this.fx.floatText(p, reaction.name, { kind: 'reaction' });
      this.fx.burst(enemy.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), element, 26);
    }

    const variance = 0.92 + Math.random() * 0.16;
    const amount = baseDamage * multiplier * variance * (crit ? 1.9 : 1);
    const dealt = this.rawDamage(enemy, amount, element, crit, silent);
    enemy.flash = 1;

    if (from) {
      const dx = enemy.pos.x - from.x;
      const dz = enemy.pos.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      enemy.velocity.x += (dx / d) * knockback;
      enemy.velocity.z += (dz / d) * knockback;
    }
    return dealt;
  }

  rawDamage(enemy, amount, element, crit = false, silent = false) {
    if (enemy.dead) return 0;
    const dmg = Math.max(1, Math.round(amount));
    enemy.hp -= dmg;
    const p = enemy.pos.clone();
    p.y += 0.95 * enemy.scale + Math.random() * 0.4;
    if (!silent) {
      this.fx.floatText(p, String(dmg), { kind: crit ? 'crit' : '' });
      this.fx.hit(p, element, crit);
      this.audio.sfx(crit ? 'crit' : 'hit');
    }
    if (enemy.hp <= 0) this.kill(enemy);
    return dmg;
  }

  kill(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    enemy.hp = 0;
    enemy.respawn = enemy.boss ? 55 : 30;
    enemy.bar.style.display = 'none';
    enemy.group.visible = false;
    enemy.aura = { element: null, until: 0 };
    enemy.burning = null;

    const pos = enemy.pos.clone();
    pos.y += 0.6;
    this.fx.burst(pos, enemy.type, enemy.boss ? 120 : 48);
    this.fx.shockwave(pos, ELEMENT_COLORS[enemy.type], enemy.boss ? 8 : 2.5, { life: 0.55 });
    this.fx.pickup(pos, '#ffe29a');
    this.audio.sfx('burst');
    this.kills++;
    this.onKill?.(enemy);
    if (enemy.boss) this.ui?.toast('Raja Slime Purba tumbang!', '✦');
  }

  respawn(enemy, player) {
    const dist = Math.hypot(player.pos.x - enemy.home.x, player.pos.z - enemy.home.z);
    if (dist < 22) {
      enemy.respawn = 4;
      return;
    }
    enemy.dead = false;
    enemy.hp = enemy.maxHp;
    enemy.group.visible = true;
    enemy.group.position.copy(enemy.home);
    enemy.state = 'idle';
    enemy.aura = { element: enemy.type, until: Infinity };
    enemy.scale = enemy.scale;
    this.fx.pickup(enemy.pos.clone().add(new THREE.Vector3(0, 1, 0)), ELEMENT_COLORS[enemy.type]);
  }

  get bossBarData() {
    if (!this.boss || this.boss.dead) return null;
    return this.boss;
  }
}
