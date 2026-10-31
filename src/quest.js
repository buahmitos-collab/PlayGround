import * as THREE from 'three';
import { NPC_POS, CHEST_POS, STATUE_POS, WISP_SPOTS, heightAt } from './world.js';

const STEPS = [
  {
    title: 'Bicara dengan Penjaga Awan',
    desc: 'Temui penjaga di desa dekat pantai.',
    total: 0,
  },
  {
    title: 'Kumpulkan 3 Serpihan Angin',
    desc: 'Ikuti cahaya biru yang berdenyut di sekitar pulau.',
    total: 3,
  },
  {
    title: 'Kalahkan 3 slime',
    desc: 'Bersihkan slime yang mengganggu aliran angin.',
    total: 3,
  },
  {
    title: 'Buka Peti di Puncak',
    desc: 'Naiki bukit barat laut dan buka peti kuno.',
    total: 0,
  },
  {
    title: 'Jelajahi Aetheria',
    desc: 'Badai telah tenang. Pulau ini kini milikmu untuk dijelajahi.',
    total: 0,
  },
];

const ELDER_LINES = [
  'Ah, pendatang baru. Angin membawamu ke Aetheria pada waktu yang tepat.',
  'Pulau ini kehilangan Serpihan Anginnya. Tanpa serpihan, badai purba akan bangkit dari puncak.',
  'Kumpulkan tiga serpihan yang bersinar. Setelah itu bersihkan slime, lalu buka peti kuno di puncak bukit barat laut.',
  'Kau bisa berganti karakter dengan 1 dan 2. Gunakan E untuk skill dan Q untuk burst saat energimu penuh.',
  'Patung Angin di dekat sini akan memulihkan lukamu. Pergilah, dan semoga angin menyertaimu.',
];

const ELDER_REPEAT = [
  'Angin masih berbisik tentang serpihan yang hilang. Dengarkanlah.',
  'Jangan lupa: elemen yang berbeda menciptakan reaksi yang kuat. Cobalah!',
  'Raja Slime Purba menjaga puncak. Kau mungkin perlu burst sebelum menghadapinya.',
];

export class Quest {
  constructor(game) {
    this.game = game;
    this.step = 0;
    this.wispCount = 0;
    this.killCount = 0;
    this.started = false;
    this.rewardShown = false;
    this.repeatIndex = 0;
    this.markerPos = new THREE.Vector3();
  }

  start() {
    this.started = true;
    this.step = 0;
    this.refresh();
    this.game.ui.toast('Petualangan dimulai · <b>Jejak Sang Angin</b>', '◆');
  }

  refresh() {
    const info = STEPS[this.step];
    const current = this.step === 1 ? this.wispCount : this.step === 2 ? this.killCount : 0;
    this.game.ui.setQuest({
      title: info.title,
      desc: info.desc,
      current,
      total: info.total,
    });
  }

  advance(step) {
    this.step = step;
    if (step === 2) this.killCount = 0;
    this.refresh();
    this.game.audio.sfx('quest');
    if (step === 2) this.game.ui.toast('Serpihan lengkap! Sekarang bersihkan <b>3 slime</b>.', '◆');
    if (step === 3) this.game.ui.toast('Jalan ke puncak terbuka. <b>Buka peti kuno</b>!', '◆');
    if (step === 4) this.game.ui.toast('Badai mereda. <b>Aetheria</b> kembali damai.', '✦');
  }

  update(playerPos) {
    if (!this.started) return;

    // Serpihan Angin are collected by walking into their glow.
    if (this.step === 1) {
      this.game.world.wisps.forEach((wisp, i) => {
        if (wisp.userData.collected) return;
        const d = Math.hypot(wisp.position.x - playerPos.x, wisp.position.z - playerPos.z);
        if (d < 2.1) {
          const pos = this.game.world.collectWisp(i) || wisp.position.clone();
          this.wispCount++;
          this.game.fx.burst(pos, 'anemo', 40);
          this.game.fx.pickup(pos, '#8cf0dd');
          this.game.audio.sfx('pickup');
          this.game.ui.toast(`Serpihan Angin <b>${this.wispCount}/3</b>`, '✦');
          this.game.player.energy[this.game.player.active] = Math.min(
            this.game.player.maxEnergy,
            this.game.player.energy[this.game.player.active] + 8
          );
          this.refresh();
          if (this.wispCount >= 3) {
            setTimeout(() => this.advance(2), 550);
          }
        }
      });
    }
  }

  onKill(enemy) {
    if (this.step !== 2 || enemy.boss) return;
    this.killCount++;
    this.refresh();
    this.game.ui.toast(`Slime dikalahkan <b>${this.killCount}/3</b>`, '⚔');
    if (this.killCount >= 3) setTimeout(() => this.advance(3), 450);
  }

  getMarker() {
    if (!this.started) return null;
    if (this.step === 0) {
      return { pos: new THREE.Vector3(NPC_POS.x, heightAt(NPC_POS.x, NPC_POS.z) + 2.8, NPC_POS.z), label: 'Penjaga Awan' };
    }
    if (this.step === 1) {
      const wisp = this.game.world.wisps.find((w) => !w.userData.collected);
      if (!wisp) return null;
      return { pos: wisp.position.clone().add(new THREE.Vector3(0, 1.4, 0)), label: 'Serpihan Angin' };
    }
    if (this.step === 2) {
      const slime = this.game.enemies.nearest(this.game.player.pos, 999);
      if (!slime) return null;
      return { pos: slime.pos.clone().add(new THREE.Vector3(0, 2.2, 0)), label: 'Slime' };
    }
    if (this.step === 3 && !this.game.world.chestOpened()) {
      return { pos: new THREE.Vector3(CHEST_POS.x, heightAt(CHEST_POS.x, CHEST_POS.z) + 2.1, CHEST_POS.z), label: 'Peti Kuno' };
    }
    return null;
  }

  nearestInteraction(playerPos) {
    const list = [];
    const npcD = Math.hypot(playerPos.x - NPC_POS.x, playerPos.z - NPC_POS.z);
    if (npcD < 3.5) {
      list.push({ type: 'npc', dist: npcD, label: this.step === 0 ? 'Bicara dengan Penjaga' : 'Bicara' });
    }
    const statueD = Math.hypot(playerPos.x - STATUE_POS.x, playerPos.z - STATUE_POS.z);
    if (statueD < 4.6) {
      list.push({ type: 'statue', dist: statueD + 0.5, label: 'Berdoa di Patung Angin' });
    }
    const chestD = Math.hypot(playerPos.x - CHEST_POS.x, playerPos.z - CHEST_POS.z);
    if (chestD < 3.8 && !this.game.world.chestOpened()) {
      list.push({
        type: 'chest',
        dist: chestD,
        label: this.step >= 3 ? 'Buka Peti Kuno' : 'Peti Tersegel',
      });
    }
    list.sort((a, b) => a.dist - b.dist);
    return list[0] || null;
  }

  interact(playerPos) {
    const target = this.nearestInteraction(playerPos);
    if (!target) return;
    if (target.type === 'npc') {
      const lines = this.step === 0 ? ELDER_LINES : [ELDER_REPEAT[this.repeatIndex++ % ELDER_REPEAT.length]];
      this.game.ui.startDialogue('Penjaga Awan', lines, () => {
        if (this.step === 0) this.advance(1);
      });
    } else if (target.type === 'statue') {
      this.game.player.heal(999, { fx: true });
      this.game.audio.sfx('heal');
      this.game.ui.toast('Luka dipulihkan oleh <b>Patung Angin</b>', '✦');
    } else if (target.type === 'chest') {
      if (this.step < 3) {
        this.game.audio.sfx('ui');
        this.game.ui.toast('Peti ini disegel. Selesaikan tugas penjaga dahulu.', '🔒');
        return;
      }
      const pos = this.game.world.openChest();
      this.game.fx.burst(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 'pyro', 60);
      this.game.fx.pickup(pos.clone().add(new THREE.Vector3(0, 1, 0)), '#f3d998');
      this.game.fx.shockwave(pos, '#f3d998', 6, { life: 0.8 });
      this.game.audio.sfx('chest');
      this.game.player.energy[this.game.player.active] = this.game.player.maxEnergy;
      this.game.ui.toast('Peti kuno terbuka!', '✦');
      this.advance(4);
      setTimeout(() => this.game.ui.showReward(), 850);
      this.rewardShown = true;
    }
  }

  isDone() {
    return this.step >= 4;
  }
}
