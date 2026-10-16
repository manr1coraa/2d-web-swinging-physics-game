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
      this.master.gain.value = this.muted ? 0 : 0.55;
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
      this.master.gain.setValueAtTime(m ? 0 : 0.55, this.ctx.currentTime);
  }

  setWind(level: number) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const t = this.ctx.currentTime;
    const target = Math.min(0.16, Math.max(0, level - 0.25) * 0.22);
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
    this.tone(950 + Math.random() * 200, 180, 0.09, "square", 0.12);
    this.noise(0.07, 0.09, 3800);
  }

  /** web release */
  whoosh() {
    this.noise(0.16, 0.07, 900, "bandpass");
  }

  /** miss click */
  tick() {
    this.tone(320, 240, 0.05, "triangle", 0.06);
  }

  coin(chain: number) {
    const k = 1 + Math.min(chain, 10) * 0.07;
    this.tone(740 * k, 740 * k, 0.07, "sine", 0.14);
    this.tone(1180 * k, 1180 * k, 0.14, "sine", 0.11, 0.055);
  }

  death() {
    this.tone(200, 34, 0.55, "sawtooth", 0.22);
    this.tone(90, 24, 0.7, "sine", 0.26);
    this.noise(0.5, 0.22, 520, "lowpass");
  }

  best() {
    const n = [523, 659, 784, 1046];
    n.forEach((f, i) => this.tone(f, f, 0.16, "triangle", 0.12, i * 0.09));
  }

  start() {
    this.tone(392, 392, 0.1, "triangle", 0.12);
    this.tone(587, 587, 0.14, "triangle", 0.12, 0.09);
  }

  /** boost ring hit — rising sweep */
  boost() {
    this.tone(280, 1150, 0.28, "sawtooth", 0.12);
    this.tone(560, 1700, 0.34, "sine", 0.1, 0.03);
    this.noise(0.26, 0.1, 1600, "bandpass");
  }

  shieldUp() {
    this.tone(760, 760, 0.08, "sine", 0.12);
    this.tone(1140, 1140, 0.18, "sine", 0.1, 0.06);
  }

  shieldBreak() {
    this.tone(420, 80, 0.32, "sawtooth", 0.16);
    this.noise(0.3, 0.15, 900, "lowpass");
  }

  magnetUp() {
    this.tone(440, 880, 0.22, "triangle", 0.11);
    this.tone(660, 1320, 0.22, "sine", 0.08, 0.05);
  }

  /** perfect release — pitch climbs with combo */
  perfect(n: number) {
    const f = 590 * (1 + Math.min(n, 8) * 0.09);
    this.tone(f, f, 0.09, "triangle", 0.13);
    this.tone(f * 1.5, f * 1.5, 0.2, "sine", 0.1, 0.07);
  }

  /** gate dive — whoosh down then a rising jingle */
  portal() {
    this.noise(0.7, 0.16, 300, "lowpass");
    this.tone(180, 60, 0.6, "sine", 0.16);
    const n = [523, 659, 784, 1046, 1318];
    n.forEach((f, i) => this.tone(f, f, 0.2, "triangle", 0.11, 0.35 + i * 0.1));
  }

  levelUp() {
    const n = [659, 880, 1174, 1568];
    n.forEach((f, i) => this.tone(f, f, 0.22, "triangle", 0.12, i * 0.1));
  }

  milestone() {
    this.tone(660, 660, 0.1, "triangle", 0.1);
    this.tone(990, 990, 0.16, "triangle", 0.09, 0.08);
  }

  /* ---- ambient pad ---- */

  private pad: {
    o1: OscillatorNode;
    o2: OscillatorNode;
    g: GainNode;
    f: BiquadFilterNode;
  } | null = null;

  padStart() {
    if (!this.ensure() || !this.ctx || !this.master || this.pad) return;
    const c = this.ctx;
    const t = c.currentTime;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 320;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.setTargetAtTime(0.045, t, 0.8);
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
    this.pad.g.gain.setTargetAtTime(duck ? 0.012 : 0.045, this.ctx.currentTime, 0.2);
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
