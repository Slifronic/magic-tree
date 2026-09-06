/**
 * A small synthesised ambience — filtered noise for wind plus occasional
 * pentatonic chimes. Synthesised rather than sampled so the bundle stays light.
 */
export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private chimeTimer: number | null = null;
  private enabled = false;

  private static readonly SCALE = [0, 2, 4, 7, 9, 12, 14];

  get isOn() {
    return this.enabled;
  }

  /** Must be called from a user gesture the first time. */
  async enable() {
    if (this.enabled) return;
    this.enabled = true;

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.startWind();
    }

    await this.ctx.resume();
    this.ramp(0.5);
    this.scheduleChime();
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this.ramp(0);
    if (this.chimeTimer !== null) {
      window.clearTimeout(this.chimeTimer);
      this.chimeTimer = null;
    }
  }

  toggle() {
    if (this.enabled) this.disable();
    else void this.enable();
    return this.enabled;
  }

  /** A brighter flourish when the canopy resolves into the code. */
  chord() {
    if (!this.enabled || !this.ctx) return;
    [0, 4, 7, 11].forEach((semi, i) => {
      this.ping(261.63 * Math.pow(2, semi / 12) * 2, 0.09, i * 0.07);
    });
  }

  dispose() {
    this.disable();
    this.windSource?.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  // ------------------------------------------------------------- internals

  private ramp(to: number) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(to, now + 0.6);
  }

  private startWind() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown-ish noise: smoother and less hissy than white.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.4;

    const gain = ctx.createGain();
    gain.gain.value = 0.12;

    // Slow breathing so the wind never sits flat.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.windSource = src;
  }

  private ping(freq: number, peak: number, delay: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);

    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + 2.6);
  }

  private scheduleChime() {
    if (!this.enabled) return;
    const wait = 2600 + Math.random() * 5200;
    this.chimeTimer = window.setTimeout(() => {
      const semi = Ambience.SCALE[Math.floor(Math.random() * Ambience.SCALE.length)];
      this.ping(523.25 * Math.pow(2, semi / 12), 0.07, 0);
      this.scheduleChime();
    }, wait);
  }
}
