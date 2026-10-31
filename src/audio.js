// Procedural WebAudio soundscape: no external audio files, everything is
// synthesised from oscillators and noise so the game stays a single bundle.
export class GameAudio {
  constructor() {
    this.ctx = null
    this.master = null
    this.sfx = null
    this.music = null
    this.muted = false
    this.started = false
    this.musicTimer = null
    this.noteIndex = 0
  }

  init() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    try {
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.7
      this.master.connect(this.ctx.destination)

      this.sfx = this.ctx.createGain()
      this.sfx.gain.value = 0.9
      this.sfx.connect(this.master)

      this.music = this.ctx.createGain()
      this.music.gain.value = 0.14
      const reverb = this.ctx.createConvolver()
      reverb.buffer = this.makeImpulse(2.4, 2.6)
      const wet = this.ctx.createGain()
      wet.gain.value = 0.55
      this.music.connect(reverb)
      reverb.connect(wet)
      wet.connect(this.master)
      this.music.connect(this.master)

      this.noiseBuffer = this.makeNoise(2)
      this.started = true
      this.scheduleMusic()
    } catch (error) {
      console.warn('Audio unavailable', error)
    }
  }

  makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate
    const length = Math.floor(rate * seconds)
    const buffer = this.ctx.createBuffer(2, length, rate)
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    return buffer
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate
    const length = Math.floor(rate * seconds)
    const buffer = this.ctx.createBuffer(1, length, rate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      last = last * 0.35 + white * 0.65
      data[i] = last
    }
    return buffer
  }

  setMuted(value) {
    this.muted = value
    if (this.master) this.master.gain.setTargetAtTime(value ? 0 : 0.7, this.ctx.currentTime, 0.05)
  }

  noise(duration, frequency, gain, type = 'bandpass', q = 1, when = 0) {
    if (!this.started || this.muted) return
    const ctx = this.ctx
    const t = ctx.currentTime + when
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.playbackRate.value = 0.8 + Math.random() * 0.4
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = frequency
    filter.Q.value = q
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    source.connect(filter)
    filter.connect(g)
    g.connect(this.sfx)
    source.start(t)
    source.stop(t + duration + 0.02)
  }

  tone(freq, duration, gain = 0.08, type = 'sine', when = 0, slide = 0) {
    if (!this.started || this.muted) return
    const ctx = this.ctx
    const t = ctx.currentTime + when
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(g)
    g.connect(this.sfx)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  breakBlock(sound) {
    const freq = { stone: 900, wood: 650, grass: 1300, sand: 1700, glass: 2800, wool: 480, gravel: 1000, snow: 2000, water: 700 }[sound] || 900
    this.noise(0.16, freq, 0.18, 'bandpass', 0.8)
    this.noise(0.08, freq * 1.8, 0.08, 'highpass', 0.7)
    if (sound === 'glass') {
      this.tone(1800, 0.12, 0.04, 'triangle')
      this.tone(2400, 0.1, 0.03, 'triangle', 0.02)
    }
    if (sound === 'wood') this.tone(160, 0.1, 0.05, 'square')
  }

  placeBlock(sound) {
    const freq = { stone: 500, wood: 380, grass: 900, sand: 1200, glass: 1600, wool: 300, gravel: 700, snow: 1300 }[sound] || 500
    this.noise(0.09, freq, 0.12, 'lowpass', 0.9)
    this.tone(freq * 0.45, 0.07, 0.05, 'sine')
  }

  step(sound) {
    const freq = { stone: 550, wood: 400, grass: 800, sand: 1400, glass: 1200, wool: 260, gravel: 650, snow: 1500 }[sound] || 700
    this.noise(0.07, freq, 0.035, 'bandpass', 1.2)
  }

  splash() {
    this.noise(0.4, 1200, 0.2, 'lowpass', 0.6)
    this.noise(0.25, 2400, 0.08, 'highpass', 0.8)
  }

  hurt() {
    this.tone(180, 0.18, 0.1, 'sawtooth', 0, -70)
    this.noise(0.12, 500, 0.08, 'lowpass')
  }

  attack() {
    this.noise(0.07, 700, 0.08, 'bandpass', 1.4)
    this.tone(140, 0.08, 0.05, 'square', 0, -50)
  }

  click() {
    this.tone(720, 0.05, 0.035, 'square')
    this.tone(1080, 0.04, 0.02, 'square', 0.03)
  }

  mob(kind) {
    if (kind === 'pig') {
      this.tone(150, 0.18, 0.06, 'sawtooth', 0, 40)
      this.noise(0.12, 450, 0.05, 'bandpass')
    } else if (kind === 'sheep') {
      this.tone(330, 0.35, 0.045, 'sawtooth', 0, 90)
      this.noise(0.3, 900, 0.025, 'bandpass', 2)
    } else if (kind === 'chicken') {
      this.tone(900, 0.07, 0.04, 'square')
      this.tone(700, 0.06, 0.03, 'square', 0.08)
    } else if (kind === 'zombie') {
      this.tone(95, 0.5, 0.06, 'sawtooth', 0, -20)
      this.noise(0.4, 260, 0.04, 'lowpass')
    }
  }

  scheduleMusic() {
    if (!this.started) return
    if (this.musicTimer) clearTimeout(this.musicTimer)
    const play = () => {
      if (!this.started) return
      if (!this.muted) this.playPhrase()
      this.musicTimer = setTimeout(play, 4200 + Math.random() * 5200)
    }
    this.musicTimer = setTimeout(play, 1800)
  }

  playPhrase() {
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25]
    const roots = [261.63, 220.0, 174.61, 196.0]
    const root = roots[Math.floor(this.noteIndex / 4) % roots.length]
    const notes = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < notes; i++) {
      const pick = scale[Math.floor(Math.random() * scale.length)]
      const octave = Math.random() > 0.72 ? 2 : 1
      const freq = (pick * octave) / 2 + root * 0.25
      const when = i * 0.55 + Math.random() * 0.12
      this.tone(freq, 2.2, 0.028, 'triangle', when)
      this.tone(freq * 0.5, 2.6, 0.014, 'sine', when)
    }
    this.noteIndex++
  }
}
