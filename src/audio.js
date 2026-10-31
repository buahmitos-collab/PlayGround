import { clamp } from './look.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.ambientStarted = false;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.enabled = false;
      return;
    }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.createNoise(2.5);
    this.startAmbient();
  }

  createNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 2.6;
    }
    return buffer;
  }

  startAmbient() {
    if (this.ambientStarted || !this.ctx) return;
    this.ambientStarted = true;
    const ctx = this.ctx;

    const pad = ctx.createGain();
    pad.gain.value = 0.045;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.8;
    pad.connect(filter);
    filter.connect(this.master);

    for (const [freq, detune, gain] of [
      [110, -6, 0.55],
      [164.81, 4, 0.32],
      [220, 8, 0.16],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(pad);
      osc.start();
    }

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 280;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 620;
    windFilter.Q.value = 0.35;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.11;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.master);
    wind.start();

    const swell = ctx.createOscillator();
    swell.frequency.value = 0.055;
    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.05;
    swell.connect(swellGain);
    swellGain.connect(windGain.gain);
    swell.start();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.3 : 0, this.ctx.currentTime, 0.08);
  }

  beep(freq, dur = 0.14, type = 'sine', gain = 0.18, slide = null, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise(dur = 0.2, freq = 900, gain = 0.12, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.25), t0 + dur);
    filter.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  chord(freqs, dur = 0.5, type = 'sine', gain = 0.09) {
    freqs.forEach((f, i) => this.beep(f, dur, type, gain, f * 1.01, i * 0.025));
  }

  sfx(name) {
    if (!this.enabled || !this.ctx) return;
    switch (name) {
      case 'jump':
        this.beep(300, 0.18, 'sine', 0.1, 620);
        break;
      case 'land':
        this.noise(0.14, 220, 0.1);
        this.beep(90, 0.1, 'sine', 0.08, 60);
        break;
      case 'slash':
        this.noise(0.12, 2600, 0.13);
        this.beep(720, 0.07, 'triangle', 0.05, 360);
        break;
      case 'hit':
        this.noise(0.1, 1400, 0.1);
        this.beep(170, 0.1, 'square', 0.05, 90);
        break;
      case 'crit':
        this.noise(0.14, 2200, 0.14);
        this.beep(1040, 0.16, 'triangle', 0.08, 1560);
        break;
      case 'skillAnemo':
        this.noise(0.5, 800, 0.12);
        this.chord([523.25, 659.25, 783.99, 1046.5], 0.65, 'sine', 0.05);
        break;
      case 'skillPyro':
        this.noise(0.45, 500, 0.16);
        this.beep(120, 0.4, 'sawtooth', 0.07, 60);
        this.beep(392, 0.35, 'triangle', 0.06, 523);
        break;
      case 'burst':
        this.noise(0.8, 600, 0.16);
        this.chord([261.63, 329.63, 392, 523.25, 659.25], 1.1, 'triangle', 0.06);
        break;
      case 'pickup':
        [880, 1174.66, 1567.98].forEach((f, i) => this.beep(f, 0.2, 'sine', 0.09, f * 1.02, i * 0.07));
        break;
      case 'heal':
        [392, 523.25, 659.25, 880].forEach((f, i) => this.beep(f, 0.5, 'sine', 0.05, f * 1.01, i * 0.08));
        break;
      case 'hurt':
        this.beep(140, 0.22, 'sawtooth', 0.1, 70);
        this.noise(0.16, 500, 0.1);
        break;
      case 'switch':
        this.beep(660, 0.1, 'triangle', 0.06, 990);
        this.beep(990, 0.14, 'sine', 0.05, 1320, 0.05);
        break;
      case 'chest':
        this.chord([523.25, 659.25, 783.99, 1046.5, 1318.5], 1.2, 'sine', 0.075);
        this.noise(0.5, 1800, 0.08);
        break;
      case 'quest':
        this.chord([659.25, 783.99, 1046.5], 0.8, 'triangle', 0.06);
        break;
      case 'dialogue':
        this.beep(520, 0.05, 'sine', 0.025);
        break;
      case 'ui':
        this.beep(600, 0.06, 'sine', 0.04, 720);
        break;
      case 'death':
        this.chord([220, 261.63, 329.63], 1.6, 'sine', 0.06);
        this.beep(110, 1.4, 'sawtooth', 0.04, 55);
        break;
      default:
        break;
    }
  }
}
