import * as THREE from 'three';
import { createCharacter, CHARACTERS } from './character.js';
import { clamp, damp } from './look.js';
import { ELEMENT_COLORS } from './fx.js';
import {
  heightAt,
  slopeAt,
  WATER_Y,
  WORLD_RADIUS,
  SPAWN,
  STATUE_POS,
} from './world.js';

const GRAVITY = 27;
const MAX_ENERGY = 80;

function angleLerp(a, b, t) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * t;
}

export class Player {
  constructor({ scene, camera, world, fx, enemies, audio, ui }) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.fx = fx;
    this.enemies = enemies;
    this.audio = audio;
    this.ui = ui;

    this.level = 12;
    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.energy = [42, 46];
    this.cooldowns = [0, 0];
    this.maxEnergy = MAX_ENERGY;

    this.pos = new THREE.Vector3(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z);
    this.vel = new THREE.Vector3();
    this.facing = Math.PI;
    this.active = 0;
    this.alive = true;
    this.onGround = true;
    this.gliding = false;
    this.swimming = false;
    this.sprinting = false;
    this.invuln = 0;
    this.airTime = 0;
    this.staminaDelay = 0;
    this.lastDamageAt = -99;
    this.stepTimer = 0;
    this.healFxTimer = 0;
    this.nearStatue = false;
    this.shake = 0;
    this.flash = 0;
    this.pendingMeteors = [];
    this.statsDirty = true;

    this.attackTime = -1;
    this.attackDuration = 0.46;
    this.attackHit = false;
    this.attackQueued = false;
    this.combo = 0;
    this.castTime = 0;
    this.castDuration = 0;

    this.characters = CHARACTERS.map((_, i) => {
      const character = createCharacter(i);
      character.setVisible(i === 0);
      this.scene.add(character.root);
      return character;
    });
    this.characters[0].root.position.copy(this.pos);
    this.characters[0].root.rotation.y = this.facing;

    this.tmp = new THREE.Vector3();
    this.moveDir = new THREE.Vector3();
    this.forwardVec = new THREE.Vector3();
    this.lookVec = new THREE.Vector3();
  }

  get character() {
    return this.characters[this.active];
  }

  get data() {
    return CHARACTERS[this.active];
  }

  get forward() {
    return this.forwardVec.set(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  get energyReady() {
    return this.energy[this.active] >= MAX_ENERGY;
  }

  switchTo(index) {
    if (!this.alive || index === this.active || index < 0 || index > 1) return;
    this.characters[this.active].setVisible(false);
    this.active = index;
    const next = this.characters[index];
    next.setVisible(true);
    next.root.position.copy(this.pos);
    next.root.rotation.y = this.facing;
    this.attackTime = -1;
    this.castTime = 0;
    this.invuln = Math.max(this.invuln, 0.5);
    this.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 1.1, 0)), this.data.element, 26);
    this.fx.shockwave(this.pos, ELEMENT_COLORS[this.data.element], 2.4, { life: 0.45 });
    this.audio.sfx('switch');
    this.ui.toast(`<b>${this.data.name}</b> · ${this.data.elementLabel}`, '❖');
    this.ui.setElement(this.data.element);
    this.ui.updateParty(this);
    this.statsDirty = true;
  }

  tryAttack() {
    if (!this.alive) return;
    if (this.attackTime >= 0 && this.attackTime < this.attackDuration - 0.08) {
      this.attackQueued = true;
      return;
    }
    this.startAttack();
  }

  startAttack() {
    const target = this.autoTarget(7);
    if (target) {
      this.facing = angleLerp(this.facing, Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z), 1);
      this.character.root.rotation.y = this.facing;
    } else {
      this.facing = Math.atan2(-Math.sin(this.camera.userData.yaw), -Math.cos(this.camera.userData.yaw));
    }
    this.combo = (this.combo + 1) % 3;
    this.attackTime = 0;
    this.attackDuration = this.combo === 2 ? 0.54 : 0.4;
    this.attackHit = false;
    this.attackQueued = false;
    this.audio.sfx('slash');
    const f = this.forward;
    const slashPos = this.pos.clone().addScaledVector(f, 0.2);
    this.fx.slash(slashPos, this.facing, ELEMENT_COLORS[this.data.element]);
  }

  autoTarget(range) {
    const enemy = this.enemies.nearest(this.pos, range);
    if (!enemy) return null;
    const dx = enemy.pos.x - this.pos.x;
    const dz = enemy.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const f = this.forward;
    const dot = (dx / d) * f.x + (dz / d) * f.z;
    return dot > -0.1 ? enemy : null;
  }

  applyAttackHit() {
    const comboDamage = [17, 19, 30][this.combo];
    const crit = Math.random() < 0.22;
    const f = this.forward;
    const hits = this.enemies.hitCone(
      this.pos,
      f,
      3.15,
      Math.cos((64 * Math.PI) / 180),
      comboDamage * (1 + (this.level - 1) * 0.018),
      this.data.element,
      crit
    );
    if (hits.length) {
      this.energy[this.active] = Math.min(MAX_ENERGY, this.energy[this.active] + 5);
      this.shake = Math.max(this.shake, crit ? 0.32 : 0.16);
      this.statsDirty = true;
    } else {
      this.audio.sfx('slash');
    }
    this.lookVec.copy(f).multiplyScalar(0.5);
    this.pos.add(this.lookVec);
  }

  useSkill() {
    if (!this.alive || this.cooldowns[this.active] > 0) return;
    const char = this.data;
    const f = this.forward;
    const target = this.autoTarget(9);
    if (target) {
      this.facing = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    }

    if (char.element === 'anemo') {
      const center = this.pos.clone().addScaledVector(this.forward, 5.6);
      const gy = heightAt(center.x, center.z);
      center.y = Math.max(gy, WATER_Y);
      this.enemies.setVortex(center, 6.2, 1.8, 26, 'anemo');
      this.enemies.damageArea(center, 2.2, 22 * (1 + this.level * 0.01), 'anemo', { knockback: 0.4 });
      this.fx.vortex(center, 'anemo', 1.9);
      this.fx.shockwave(center, ELEMENT_COLORS.anemo, 5.2, { life: 0.7, height: 0.2 });
      this.audio.sfx('skillAnemo');
      this.cooldowns[this.active] = 7;
    } else {
      const center = this.pos.clone().addScaledVector(f, 1.8);
      this.enemies.damageArea(center, 4.6, 52 * (1 + this.level * 0.012), 'pyro', { knockback: 3.2 });
      this.enemies.enemies.forEach((e) => {
        if (!e.dead && Math.hypot(e.pos.x - center.x, e.pos.z - center.z) < 4.6) {
          e.burning = { t: 4, tick: 0 };
        }
      });
      this.fx.explosion(center, 'pyro', 4.4);
      this.fx.shockwave(center, ELEMENT_COLORS.pyro, 6.5, { life: 0.55 });
      this.audio.sfx('skillPyro');
      this.shake = 0.5;
      this.cooldowns[this.active] = 6;
    }

    this.energy[this.active] = Math.min(MAX_ENERGY, this.energy[this.active] + 11);
    this.castTime = 0.62;
    this.castDuration = 0.62;
    this.character.anim.cast = 0;
    this.statsDirty = true;
  }

  useBurst() {
    if (!this.alive) return;
    if (this.energy[this.active] < MAX_ENERGY) {
      this.ui.toast(`Energi belum cukup · ${Math.floor(this.energy[this.active])}/${MAX_ENERGY}`, '✦');
      this.audio.sfx('ui');
      return;
    }
    const char = this.data;
    this.energy[this.active] = 0;
    this.invuln = Math.max(this.invuln, 1.2);
    this.shake = 0.85;
    this.flash = 0.6;
    this.ui.flashScreen();
    this.audio.sfx('burst');
    this.character.anim.cast = 0;
    this.castTime = 0.9;
    this.castDuration = 0.9;

    if (char.element === 'anemo') {
      const center = this.pos.clone();
      this.enemies.damageArea(center, 8.5, 105 * (1 + this.level * 0.015), 'anemo', { knockback: 6 });
      this.enemies.setVortex(center, 8, 2.1, 34, 'anemo');
      this.fx.burst(center.clone().add(new THREE.Vector3(0, 0.8, 0)), 'anemo', 110);
      this.fx.shockwave(center, ELEMENT_COLORS.anemo, 9, { life: 0.9 });
      this.fx.pillar(center, ELEMENT_COLORS.anemo, 10, 1.3);
      this.fx.vortex(center, 'anemo', 2.1);
      this.ui.showReaction('BADAI ZEPHYR');
    } else {
      const center = this.pos.clone();
      this.enemies.damageArea(center, 5.5, 70 * (1 + this.level * 0.015), 'pyro', { knockback: 5 });
      this.fx.burst(center.clone().add(new THREE.Vector3(0, 1, 0)), 'pyro', 100);
      this.fx.shockwave(center, ELEMENT_COLORS.pyro, 7, { life: 0.8 });
      this.fx.pillar(center, ELEMENT_COLORS.pyro, 8, 1.1);
      for (let i = 0; i < 6; i++) {
        this.pendingMeteors.push({
          delay: 0.15 + i * 0.12,
          offset: new THREE.Vector3((Math.random() - 0.5) * 9, 0, (Math.random() - 0.5) * 9),
        });
      }
      this.ui.showReaction('HUJAN METEOR');
    }
    this.statsDirty = true;
    this.ui.updateParty(this);
  }

  spawnMeteor(offset) {
    const to = this.pos.clone().add(offset);
    to.y = heightAt(to.x, to.z) + 0.2;
    const from = to.clone().add(new THREE.Vector3(2, 16, 1.5));
    this.fx.meteor(from, to, ELEMENT_COLORS.pyro, 0.55, (impact) => {
      if (!this.alive) return;
      this.enemies.damageArea(impact, 3.1, 46 * (1 + this.level * 0.012), 'pyro', { knockback: 3.4 });
      this.fx.explosion(impact, 'pyro', 3.1);
      this.audio.sfx('hit');
      this.shake = Math.max(this.shake, 0.25);
    });
  }

  takeDamage(amount, source, element = 'physical') {
    if (!this.alive || this.invuln > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.invuln = 0.85;
    this.lastDamageAt = this.world ? performance.now() / 1000 : 0;
    this.character.anim.hurt = 1;
    this.shake = 0.55;
    this.fx.floatText(this.pos.clone().add(new THREE.Vector3(0, 1.6, 0)), `-${Math.round(amount)}`, { kind: 'hurt' });
    this.fx.spark(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 'pyro', { count: 12, speed: 3, size: 0.25 });
    this.audio.sfx('hurt');
    this.ui.damageFlash();
    if (source) {
      const dx = this.pos.x - source.x;
      const dz = this.pos.z - source.z;
      const d = Math.hypot(dx, dz) || 1;
      this.vel.x += (dx / d) * 5;
      this.vel.z += (dz / d) * 5;
      this.vel.y = Math.max(this.vel.y, 2.4);
      this.onGround = false;
    }
    if (this.health <= 0) this.die();
    this.statsDirty = true;
  }

  heal(amount, { silent = false, fx = false } = {}) {
    if (!this.alive) return;
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    const gained = this.health - before;
    if (gained > 0.5 && !silent) {
      this.statsDirty = true;
      if (fx) {
        this.fx.heal(this.pos.clone().add(new THREE.Vector3(0, 1, 0)));
        this.fx.floatText(this.pos.clone().add(new THREE.Vector3(0, 1.7, 0)), `+${Math.round(gained)}`, { kind: 'heal' });
      }
    }
  }

  die() {
    this.alive = false;
    this.gliding = false;
    this.audio.sfx('death');
    this.character.setVisible(false);
    this.ui.showDeath();
  }

  respawn() {
    this.alive = true;
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.pos.set(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z);
    this.vel.set(0, 0, 0);
    this.facing = Math.PI;
    this.character.setVisible(true);
    this.character.root.position.copy(this.pos);
    this.invuln = 2;
    this.ui.hideDeath();
    this.ui.toast('Angin membawamu kembali', '✦');
    this.statsDirty = true;
  }

  update(dt, input, camYaw, elapsed) {
    if (!this.alive) {
      this.character.update(dt, { speed: 0, onGround: true, elapsed });
      return;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.cooldowns[0] = Math.max(0, this.cooldowns[0] - dt);
    this.cooldowns[1] = Math.max(0, this.cooldowns[1] - dt);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.flash = Math.max(0, this.flash - dt * 3.2);

    for (let i = this.pendingMeteors.length - 1; i >= 0; i--) {
      const meteor = this.pendingMeteors[i];
      meteor.delay -= dt;
      if (meteor.delay <= 0) {
        this.spawnMeteor(meteor.offset);
        this.pendingMeteors.splice(i, 1);
      }
    }

    // ---- movement ----
    const f = this.tmp.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const rightX = Math.cos(camYaw);
    const rightZ = -Math.sin(camYaw);
    let mx = f.x * input.y + rightX * input.x;
    let mz = f.z * input.y + rightZ * input.x;
    const inLen = Math.hypot(mx, mz);
    if (inLen > 1) {
      mx /= inLen;
      mz /= inLen;
    }
    const inputLen = Math.min(1, inLen);
    this.moveDir.set(mx, 0, mz);

    const ground = heightAt(this.pos.x, this.pos.z);
    const depth = WATER_Y - ground;
    const wasSwimming = this.swimming;
    this.swimming = depth > 0.85 && this.pos.y < WATER_Y + 0.5;
    if (this.swimming && !wasSwimming) {
      this.gliding = false;
    }

    const wantsSprint = input.sprint && inputLen > 0.2 && this.onGround && !this.swimming;
    this.sprinting = wantsSprint && this.stamina > 0.5;

    let speed;
    if (this.swimming) speed = this.stamina > 0 ? 4.2 : 2.4;
    else if (this.sprinting) speed = 9.1;
    else speed = 5.7;
    if (this.gliding) speed = 7.6;

    let slopePenalty = 1;
    if (this.onGround && !this.swimming) {
      const slope = slopeAt(this.pos.x, this.pos.z);
      slopePenalty = clamp(1 - (slope - 0.45) * 0.32, 0.55, 1);
    }

    const targetVX = mx * speed * slopePenalty;
    const targetVZ = mz * speed * slopePenalty;
    const accel = this.swimming ? 5 : this.onGround ? 13 : this.gliding ? 4.5 : 4;
    this.vel.x = damp(this.vel.x, targetVX, accel, dt);
    this.vel.z = damp(this.vel.z, targetVZ, accel, dt);
    if (this.swimming) this.vel.y = 0;

    // ---- jump / glide ----
    if (input.jumpPressed && this.onGround && !this.swimming) {
      this.vel.y = 8.9;
      this.onGround = false;
      this.airTime = 0;
      this.stamina = Math.max(0, this.stamina - 6);
      this.staminaDelay = 0.7;
      this.audio.sfx('jump');
    }

    if (!this.onGround && input.jumpHeld && !this.swimming && this.vel.y < 2 && this.airTime > 0.18 && this.stamina > 2) {
      if (!this.gliding) {
        this.gliding = true;
        this.fx.spark(this.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 'anemo', { count: 18, speed: 3, size: 0.4, life: 0.6, gravity: 0, up: 0.2 });
      }
    }
    if (this.gliding && (!input.jumpHeld || this.stamina <= 0 || this.onGround)) {
      this.gliding = false;
    }

    if (this.swimming) {
      this.pos.y = damp(this.pos.y, WATER_Y + 0.12, 8, dt);
      this.onGround = false;
      this.airTime = 0;
      this.gliding = false;
      this.stamina = Math.max(0, this.stamina - 3.5 * dt);
      this.staminaDelay = 0.8;
    } else {
      if (this.gliding) {
        this.vel.y = Math.max(this.vel.y - GRAVITY * 0.14 * dt, -2.4);
        this.stamina = Math.max(0, this.stamina - 5.5 * dt);
        this.staminaDelay = 0.8;
      } else {
        this.vel.y -= GRAVITY * dt;
      }
      const wasGrounded = this.onGround;
      this.pos.y += this.vel.y * dt;
      const g = heightAt(this.pos.x, this.pos.z);
      if (this.pos.y <= g) {
        if (!wasGrounded && this.vel.y < -9) {
          this.audio.sfx('land');
          this.fx.particles.spawn(this.pos.clone().add(new THREE.Vector3(0, 0.05, 0)), '#cdbf9a', {
            count: 10,
            speed: 1.6,
            size: 0.18,
            life: 0.5,
            gravity: -0.5,
            up: 0.2,
            radius: 0.2,
          });
        }
        this.pos.y = g;
        this.vel.y = 0;
        this.onGround = true;
        this.airTime = 0;
        if (this.gliding) this.gliding = false;
      } else {
        this.onGround = false;
        this.airTime += dt;
      }
    }

    // Horizontal movement + boundary.
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const radial = Math.hypot(this.pos.x, this.pos.z);
    if (radial > WORLD_RADIUS + 2) {
      const k = (WORLD_RADIUS + 2) / radial;
      this.pos.x *= k;
      this.pos.z *= k;
      this.vel.x *= 0.4;
      this.vel.z *= 0.4;
    }

    if (this.onGround && !this.swimming) {
      this.pos.y = heightAt(this.pos.x, this.pos.z);
    }

    // ---- stamina ----
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - 13 * dt);
      this.staminaDelay = 0.7;
    }
    if (this.stamina <= 0) {
      this.sprinting = false;
      if (this.gliding) this.gliding = false;
    }
    const regen = !this.sprinting && !this.gliding && !this.swimming;
    if (regen) {
      this.staminaDelay = Math.max(0, this.staminaDelay - dt);
      if (this.staminaDelay <= 0) this.stamina = Math.min(this.maxStamina, this.stamina + 18 * dt);
    }

    // ---- facing ----
    const speed2 = Math.hypot(this.vel.x, this.vel.z);
    if (this.attackTime < 0 && this.castTime <= 0 && speed2 > 0.4 && inputLen > 0.1) {
      this.facing = angleLerp(this.facing, Math.atan2(this.vel.x, this.vel.z), Math.min(1, dt * 12));
    }
    this.character.root.rotation.y = this.facing;

    // ---- attacks ----
    if (input.attackPressed && !this.swimming) {
      this.tryAttack();
    }
    if (this.attackTime >= 0) {
      this.attackTime += dt;
      if (!this.attackHit && this.attackTime >= 0.16) {
        this.attackHit = true;
        this.applyAttackHit();
      }
      if (this.attackTime >= this.attackDuration) {
        if (this.attackQueued) {
          this.startAttack();
        } else {
          this.attackTime = -1;
          this.combo = -1;
          this.attackQueued = false;
        }
      }
    }
    if (this.castTime > 0) {
      this.castTime -= dt;
      if (this.character.anim.cast >= 0) this.character.anim.cast = 1 - this.castTime / this.castDuration;
      if (this.castTime <= 0) this.character.anim.cast = -1;
    }

    if (input.skillPressed) this.useSkill();
    if (input.burstPressed) this.useBurst();

    // ---- world interactions ----
    const statueDist = Math.hypot(this.pos.x - STATUE_POS.x, this.pos.z - STATUE_POS.z);
    if (statueDist < 5.2 && this.health < this.maxHealth) {
      this.heal(16 * dt, { silent: false, fx: false });
      this.healFxTimer -= dt;
      if (this.healFxTimer <= 0) {
        this.healFxTimer = 0.55;
        this.fx.heal(this.pos.clone().add(new THREE.Vector3(0, 1, 0)));
        this.fx.floatText(this.pos.clone().add(new THREE.Vector3(0, 1.7, 0)), '+16', { kind: 'heal' });
        this.audio.sfx('heal');
      }
      if (!this.nearStatue) {
        this.nearStatue = true;
        this.ui.toast('Diberkati oleh <b>Patung Angin</b>', '✦');
      }
    } else {
      this.nearStatue = false;
    }

    // Out-of-combat regeneration keeps the exploration loop forgiving.
    const now = performance.now() / 1000;
    if (now - this.lastDamageAt > 12 && this.health < this.maxHealth && !this.nearStatue) {
      this.heal(1.8 * dt, { silent: true });
    }

    // ---- animation ----
    this.character.anim.attack = this.attackTime >= 0 ? this.attackTime / this.attackDuration : -1;
    if (this.castTime > 0) this.character.anim.cast = 1 - this.castTime / this.castDuration;
    this.character.root.position.copy(this.pos);
    this.character.update(dt, {
      speed: speed2,
      onGround: this.onGround,
      gliding: this.gliding,
      swimming: this.swimming,
      elapsed,
    });

    // run dust, glide trails, footstep audio
    if (this.onGround && speed2 > 5.5) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sprinting ? 0.22 : 0.34;
        this.fx.particles.spawn(
          this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.08, (Math.random() - 0.5) * 0.4)),
          '#d8cba6',
          { count: 2, speed: 0.7, size: 0.16, life: 0.42, gravity: 1, up: 0.35, radius: 0.1 }
        );
      }
    }
    if (this.gliding) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.05;
        this.fx.particles.spawn(
          this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.5, (Math.random() - 0.5) * 0.8)),
          ELEMENT_COLORS.anemo,
          { count: 1, speed: 1.2, size: 0.22, life: 0.55, gravity: -0.2, up: 0.6, radius: 0 }
        );
      }
    }

    this.statsDirty = true;
  }

  stats() {
    return {
      health: this.health,
      maxHealth: this.maxHealth,
      stamina: this.stamina,
      maxStamina: this.maxStamina,
      energy: this.energy[this.active],
      maxEnergy: this.maxEnergy,
      cooldown: this.cooldowns[this.active],
      maxCooldown: this.data.element === 'anemo' ? 7 : 6,
      active: this.active,
      element: this.data.element,
      name: this.data.name,
      level: this.level,
      alive: this.alive,
      gliding: this.gliding,
      sprinting: this.sprinting,
      swimming: this.swimming,
    };
  }
}
