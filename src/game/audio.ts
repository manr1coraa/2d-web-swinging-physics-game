/** Tiny WebAudio synth SFX — no assets needed. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem("pauchok_muted") === "1";
    } catch {
      this.muted = false;
    }
  }

  /** must be called from a user gesture */
  ensure(): boolean {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return true;
    }
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.4;
      this.master.connect(this.ctx.destination);

      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      // looping wind, level tied to speed
      this.windSrc = this.ctx.createBufferSource();
      this.windSrc.buffer = this.noiseBuf;
      this.windSrc.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = "lowpass";
      this.windFilter.frequency.value = 320;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSrc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      this.windSrc.start();
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem("pauchok_muted", m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx)
      this.master.gain.setValueAtTime(m ? 0 : 0.4, this.ctx.currentTime);
  }

  setWind(level: number) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const t = this.ctx.currentTime;
    const target = Math.min(0.07, Math.max(0, level - 0.25) * 0.1);
    this.windGain.gain.setTargetAtTime(target, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(240 + level * 700, t, 0.2);
  }

  private tone(
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(
    dur: number,
    vol: number,
    filterFreq: number,
    type: BiquadFilterType = "highpass",
    delay = 0,
  ) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.9 + Math.random() * 0.3;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  /** web stick */
  thwip() {
    this.tone(820 + Math.random() * 120, 420, 0.12, "sine", 0.07);
    this.noise(0.06, 0.035, 3000, "bandpass");
  }

  /** web release */
  whoosh() {
    this.noise(0.2, 0.035, 700, "bandpass");
  }

  /** miss click */
  tick() {
    this.tone(320, 260, 0.05, "sine", 0.04);
  }

  coin(chain: number) {
    const k = 1 + Math.min(chain, 10) * 0.07;
    this.tone(740 * k, 740 * k, 0.1, "sine", 0.08);
    this.tone(1180 * k, 1180 * k, 0.18, "sine", 0.05, 0.06);
  }

  death() {
    this.tone(260, 70, 0.6, "sine", 0.14);
    this.tone(130, 50, 0.8, "triangle", 0.1, 0.05);
    this.noise(0.45, 0.07, 500, "lowpass");
  }

  best() {
    const n = [523, 659, 784, 1046];
    n.forEach((f, i) => this.tone(f, f, 0.2, "sine", 0.09, i * 0.09));
  }

  start() {
    this.tone(392, 392, 0.12, "sine", 0.08);
    this.tone(587, 587, 0.16, "sine", 0.08, 0.09);
  }

  /** boost ring hit — rising sweep */
  boost() {
    this.tone(280, 1000, 0.3, "sine", 0.08);
    this.tone(560, 1500, 0.34, "sine", 0.05, 0.03);
    this.noise(0.26, 0.03, 1600, "bandpass");
  }

  shieldUp() {
    this.tone(760, 760, 0.1, "sine", 0.08);
    this.tone(1140, 1140, 0.2, "sine", 0.06, 0.06);
  }

  shieldBreak() {
    this.tone(420, 90, 0.35, "sine", 0.12);
    this.noise(0.3, 0.05, 900, "lowpass");
  }

  magnetUp() {
    this.tone(440, 880, 0.22, "sine", 0.07);
    this.tone(660, 1320, 0.22, "sine", 0.05, 0.05);
  }

  /** perfect release — pitch climbs with combo */
  /**
   * Perfect releases climb one major-pentatonic step each, so a long chain
   * plays as a melody that never clashes with the ambient pad.
   */
  perfect(n: number) {
    const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19];
    const semis = steps[Math.min(Math.max(n, 1), steps.length) - 1];
    const f = 523.25 * Math.pow(2, semis / 12); // C5 base
    this.tone(f, f, 0.16, "sine", 0.1);
    this.tone(f * 2, f * 2, 0.24, "sine", 0.03, 0.03);
  }

  milestone() {
    this.tone(660, 660, 0.12, "sine", 0.08);
    this.tone(990, 990, 0.18, "sine", 0.07, 0.08);
  }

  /* ---- ambient pad ---- */

  private pad: {
    o1: OscillatorNode;
    o2: OscillatorNode;
    g: GainNode;
    f: BiquadFilterNode;
  } | null = null;

  /** background pad on/off (the sound effects are separate) */
  musicOn = true;

  setMusic(on: boolean) {
    this.musicOn = on;
    if (!on) this.padStop();
  }

  padStart() {
    if (!this.musicOn) return;
    if (!this.ensure() || !this.ctx || !this.master || this.pad) return;
    const c = this.ctx;
    const t = c.currentTime;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 320;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(0.025, t, 0.8);
    const o1 = c.createOscillator();
    o1.type = "triangle";
    o1.frequency.value = 110;
    const o2 = c.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = 165.2;
    o2.detune.value = 5;
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.master);
    o1.start();
    o2.start();
    this.pad = { o1, o2, g, f };
  }

  padStop() {
    if (!this.ctx || !this.pad) return;
    const t = this.ctx.currentTime;
    const { o1, o2, g } = this.pad;
    g.gain.setTargetAtTime(0, t, 0.15);
    o1.stop(t + 0.6);
    o2.stop(t + 0.6);
    this.pad = null;
  }

  padDuck(duck: boolean) {
    if (!this.ctx || !this.pad) return;
    this.pad.g.gain.setTargetAtTime(duck ? 0.008 : 0.025, this.ctx.currentTime, 0.2);
  }

  padLevel(v: number) {
    if (!this.ctx || !this.pad) return;
    this.pad.f.frequency.setTargetAtTime(
      280 + Math.min(1, Math.max(0, v)) * 560,
      this.ctx.currentTime,
      0.3,
    );
  }

  dispose() {
    try {
      this.windSrc?.stop();
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
  }
}
