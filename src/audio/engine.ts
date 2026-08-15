/**
 * Stage 04 — the charge field.
 *
 * The premise: the letter set sets the initial conditions of a deterministic
 * chaotic system, and the sound is that system's trajectory. This is the same
 * relationship the sigil has to the statement — fully determined by it,
 * unreadable from it, never repeating. The audio is not illustrating the
 * method; it is another instance of it.
 *
 * Layers, in the order they were built:
 *   0. chaotic core          (chaos.ts)
 *   1. substrate             feedback delay network
 *   2. spine                 cross-modulated FM pair, run twice for the beat
 *   3. weather               swept narrow bands over noise
 */

import { Logistic, Lorenz, Rossler } from "./chaos";
import { METHODS, type MethodId } from "./methods";

/** Emitted as a real file by the build; worklets load poorly from data: URLs. */
const FDN_MODULE_URL = new URL("./fdn-processor.js", import.meta.url);

export interface FieldFrame {
  /** Luminance-breathing signal, 0-1. Rate-limited; see below. */
  pulse: number;
  /** Which wing of the attractor the field is currently on. */
  lobe: -1 | 1;
  rho: number;
}

export interface FieldOptions {
  letters: string[];
  seed: number;
  method: MethodId;
  volume: number;
  onFrame?: (frame: FieldFrame) => void;
}

/** Integration step of the Lorenz at 60 Hz: lobe residency of roughly 25-70 s. */
const BASE_DT = 0.0015;
const FADE_IN = 1.2;
const FADE_OUT = 0.9;
/** Hard ceiling on the visual pulse, an order of magnitude under the WCAG line. */
const VISUAL_HZ_MAX = 1;
const VISUAL_HZ_MIN = 0.25;

const HADAMARD = [
  [0.5, 0.5, 0.5, 0.5],
  [0.5, -0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5, 0.5],
];

/** Inharmonic on purpose — not octaves, not fifths. */
const RATIOS = [7 / 5, 11 / 8, 13 / 9];

const dbToGain = (db: number) => Math.pow(10, db / 20);

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

interface Spine {
  a: OscillatorNode;
  b: OscillatorNode;
  indexA: GainNode;
  indexB: GainNode;
  base: number;
  ratio: number;
}

export class ChargeField {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private substrate: GainNode | null = null;
  private spineBus: GainNode | null = null;

  /** Delay times of the four lines, whichever substrate implementation is live. */
  private delayParams: AudioParam[] = [];
  private delayBase: number[] = [];
  private burst: GainNode | null = null;
  private burstFilter: BiquadFilterNode | null = null;
  private weather: BiquadFilterNode[] = [];
  private spines: Spine[] = [];
  private sources: AudioScheduledSourceNode[] = [];

  private lorenz: Lorenz;
  private rossler: Rossler;
  private logistic: Logistic;

  private raf = 0;
  private lastTime = 0;
  private accumulator = 0;
  private nextBurstIn = 1.5;
  private phase = 0;
  private visualRate: number;
  private progress = 0;
  private running = false;
  private volume: number;

  constructor(private opts: FieldOptions) {
    const { letters, seed } = opts;
    // Initial conditions from the sigil. This is the whole point.
    this.lorenz = new Lorenz(
      0.1 + ((letters[0]?.charCodeAt(0) ?? 70) % 23) / 23,
      0.1 + ((letters[1]?.charCodeAt(0) ?? 71) % 19) / 19,
      20 + (seed % 13),
    );
    this.rossler = new Rossler(
      1 + ((letters[2]?.charCodeAt(0) ?? 72) % 7) / 7,
      1 + ((letters[3]?.charCodeAt(0) ?? 73) % 11) / 11,
      0.5,
    );
    this.logistic = new Logistic(((seed >>> 8) % 1000) / 1000);
    this.volume = opts.volume;
    this.visualRate = METHODS[opts.method].visualHz;
  }

  get profile() {
    return METHODS[this.opts.method];
  }

  /** Must be called from a user gesture. Constructs the graph, then ramps in. */
  async start(): Promise<void> {
    if (this.ctx) return this.resume();
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error("no-audio");
    const ctx = new Ctor();
    this.ctx = ctx;
    await ctx.resume();

    // --- master ------------------------------------------------------------
    // The compressor is a safety net, not a sound: the FDN and the FM index
    // both have unbounded-looking peaks and this catches them.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.3;
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(limiter);
    this.master = master;

    await this.buildSubstrate(ctx, master);
    this.buildSpine(ctx, master);
    this.buildWeather(ctx, master);

    // Never hard-start.
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume), ctx.currentTime + FADE_IN);

    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // -------------------------------------------------------------------------
  // Layer 1 — substrate: feedback delay network
  // -------------------------------------------------------------------------
  private async buildSubstrate(ctx: AudioContext, out: GainNode): Promise<void> {
    const { letters } = this.opts;

    // Incommensurate delay times -> no common period -> no loop point, ever.
    const base = [37.1, 53.7, 79.3, 113.9]; // near-prime, ms
    this.delayBase = base.map(
      (b, i) => (b * (1 + ((letters[i]?.charCodeAt(0) ?? 70) % 17) / 400)) / 1000,
    );

    const bus = ctx.createGain();
    bus.gain.value = 0.5;
    bus.connect(out);
    this.substrate = bus;

    // Excitation: sparse filtered-noise bursts, logistic-clocked. The FDN turns
    // each burst into a resonant cloud that decays over 8-20 s, and because the
    // delay times are incommensurate the overlapping decays never align.
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    noise.loop = true;
    const burst = ctx.createGain();
    burst.gain.value = 0;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 600;
    bp.Q.value = 1.2;
    noise.connect(burst);
    burst.connect(bp);
    noise.start();
    this.sources.push(noise);
    this.burst = burst;
    this.burstFilter = bp;

    const worklet = await this.buildWorkletFdn(ctx);
    if (worklet) {
      bp.connect(worklet);
      worklet.connect(bus);
      return;
    }
    this.buildNativeFdn(ctx, bp, bus);
  }

  /** The real substrate. See fdn-processor.js for why it has to live there. */
  private async buildWorkletFdn(ctx: AudioContext): Promise<AudioWorkletNode | null> {
    if (!ctx.audioWorklet || typeof AudioWorkletNode !== "function") return null;
    try {
      await ctx.audioWorklet.addModule(FDN_MODULE_URL.href);
      const node = new AudioWorkletNode(ctx, "sigilcraft-fdn", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.delayParams = [0, 1, 2, 3].map((i) => node.parameters.get(`delay${i}`)!);
      this.delayParams.forEach((p, i) => {
        p.value = this.delayBase[i]!;
      });
      node.parameters.get("feedback")!.value = 0.96;
      // One-pole coefficient equivalent to a 2.4 kHz lowpass in the loop.
      node.parameters.get("damping")!.value =
        1 - Math.exp((-2 * Math.PI * 2400) / ctx.sampleRate);
      return node;
    } catch {
      return null;
    }
  }

  /**
   * Fallback for runtimes without AudioWorklet. Same topology out of nodes,
   * but the loop gain has to stay well under the worklet's 0.96: Web Audio's
   * per-path latency in feedback cycles costs the Hadamard matrix its
   * contraction property, and anything approaching 0.85 measurably runs away.
   * The tail is shorter than it should be. That is the price of the fallback.
   */
  private buildNativeFdn(ctx: AudioContext, excitation: AudioNode, bus: GainNode): void {
    const inputs: GainNode[] = [];
    const feedbacks: GainNode[] = [];
    this.delayParams = [];

    for (let i = 0; i < 4; i++) {
      const input = ctx.createGain();
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = this.delayBase[i]!;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2400;
      // At the default Q of 1 a lowpass peaks about +1.2 dB, which is loop gain
      // this network cannot afford.
      lp.Q.value = 0.5;
      const fb = ctx.createGain();
      fb.gain.value = 0.7;

      input.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      delay.connect(bus);
      excitation.connect(input);

      inputs.push(input);
      feedbacks.push(fb);
      this.delayParams.push(delay.delayTime);
    }

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const mix = ctx.createGain();
        mix.gain.value = HADAMARD[j]![i]!;
        feedbacks[i]!.connect(mix);
        mix.connect(inputs[j]!);
      }
    }

    // Denormals in a near-unity feedback path are a real CPU problem on long
    // decays; a vanishing DC offset keeps them away.
    const dc = ctx.createConstantSource();
    dc.offset.value = 1e-20;
    for (const input of inputs) dc.connect(input);
    dc.start();
    this.sources.push(dc);
  }

  // -------------------------------------------------------------------------
  // Layer 2 — spine: cross-modulated FM pair, run twice
  // -------------------------------------------------------------------------
  private buildSpine(ctx: AudioContext, out: GainNode): void {
    const { seed, letters } = this.opts;
    const bus = ctx.createGain();
    bus.gain.value = dbToGain(this.profile.spineDb) * 0.22;
    bus.connect(out);
    this.spineBus = bus;

    const f = 55 * Math.pow(2, seed % 3);
    const ratio = RATIOS[(letters[0]?.charCodeAt(0) ?? 70) % RATIOS.length]!;
    const beat = this.profile.beat ? this.profile.beat[0] : 0;

    // The beat pair is folded into the spine rather than bolted on: the
    // entrainment offset lives inside the timbre, so on speakers it collapses
    // to chorus instead of to nothing.
    for (const [channel, detune] of [
      [-1, 0],
      [1, beat],
    ] as const) {
      const a = ctx.createOscillator();
      const b = ctx.createOscillator();
      a.frequency.value = f + detune;
      b.frequency.value = (f + detune) * ratio;

      const indexA = ctx.createGain();
      const indexB = ctx.createGain();
      indexA.gain.value = 0;
      indexB.gain.value = 0;
      a.connect(indexA);
      indexA.connect(b.frequency);
      b.connect(indexB);
      indexB.connect(a.frequency);

      const mix = ctx.createGain();
      mix.gain.value = 0.5;
      a.connect(mix);
      const bLevel = ctx.createGain();
      bLevel.gain.value = 0.35;
      b.connect(bLevel);
      bLevel.connect(mix);

      const pan = ctx.createStereoPanner();
      pan.pan.value = channel;
      mix.connect(pan);
      pan.connect(bus);

      a.start();
      b.start();
      this.sources.push(a, b);
      this.spines.push({ a, b, indexA, indexB, base: f, ratio });
    }
  }

  // -------------------------------------------------------------------------
  // Layer 3 — weather
  // -------------------------------------------------------------------------
  private buildWeather(ctx: AudioContext, out: GainNode): void {
    const bus = ctx.createGain();
    bus.gain.value = dbToGain(-18);
    bus.connect(out);

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer(ctx);
    noise.loop = true;

    for (let i = 0; i < 2; i++) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 900 + i * 1500;
      bp.Q.value = 14;
      noise.connect(bp);
      bp.connect(bus);
      this.weather.push(bp);
    }

    noise.start();
    this.sources.push(noise);
  }

  // -------------------------------------------------------------------------
  // Integration
  // -------------------------------------------------------------------------
  private frame = (now: number): void => {
    if (!this.running || !this.ctx) return;
    this.raf = requestAnimationFrame(this.frame);

    const dtReal = Math.min(0.25, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.accumulator += dtReal;

    const stepReal = 1 / 60;
    const profile = this.profile;
    const rho = profile.rho[0] + (profile.rho[1] - profile.rho[0]) * this.progress;
    const dt = BASE_DT * profile.dtScale;

    let steps = 0;
    while (this.accumulator >= stepReal && steps < 8) {
      this.lorenz.step(rho, dt);
      this.rossler.step(dt * 4);
      this.accumulator -= stepReal;
      steps++;
      this.nextBurstIn -= stepReal;
    }

    if (this.nextBurstIn <= 0) {
      this.fireBurst();
      // The interval is itself taken from the map: 3-11 s.
      this.nextBurstIn = 3 + this.logistic.next() * 8;
    }

    this.applyModulation(dtReal, rho);
  };

  private applyModulation(dtReal: number, rho: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const lx = this.lorenz.nx;
    const lz = this.lorenz.nz;

    // The most important routing here: +-0.4% delay-time modulation in a
    // high-feedback FDN produces slow pitch smear and beating between the
    // internal modes, which is what makes the substrate feel alive.
    for (let i = 0; i < this.delayParams.length; i++) {
      const target = this.delayBase[i]! * (1 + (lx * 2 - 1) * 0.004);
      this.delayParams[i]!.setTargetAtTime(target, t, 0.08);
    }

    // FM index rides a Lorenz coordinate, so the spine crosses from clean
    // tones to metallic to broadband grit at no schedule at all.
    const spread = this.opts.method === "excitatory" ? 460 : 340;
    const index = lz * spread;
    const beat = this.profile.beat;
    for (let i = 0; i < this.spines.length; i++) {
      const spine = this.spines[i]!;
      spine.indexA.gain.setTargetAtTime(index, t, 0.12);
      spine.indexB.gain.setTargetAtTime(index * 0.7, t, 0.12);
      if (i === 1 && beat) {
        const delta = beat[0] + (beat[1] - beat[0]) * this.progress;
        spine.a.frequency.setTargetAtTime(spine.base + delta, t, 0.3);
        spine.b.frequency.setTargetAtTime((spine.base + delta) * spine.ratio, t, 0.3);
      }
    }

    // Weather: 200 Hz - 6 kHz, swept logarithmically.
    const rx = this.rossler.nx;
    const ry = this.rossler.ny;
    if (this.weather[0]) {
      this.weather[0].frequency.setTargetAtTime(200 * Math.pow(30, rx), t, 0.2);
      this.weather[0].Q.setTargetAtTime(8 + ry * 22, t, 0.4);
    }
    if (this.weather[1]) {
      this.weather[1].frequency.setTargetAtTime(200 * Math.pow(30, ry), t, 0.25);
      this.weather[1].Q.setTargetAtTime(8 + rx * 22, t, 0.4);
    }

    // Visual coupling. The rate limiter is a safety layer, not an aesthetic
    // one: clamp the output signal, never the attractor.
    const wanted = this.profile.visualHz * (0.75 + lx * 0.5);
    const maxSlew = 0.35 * dtReal; // Hz per second
    const delta = Math.max(-maxSlew, Math.min(maxSlew, wanted - this.visualRate));
    this.visualRate = Math.max(VISUAL_HZ_MIN, Math.min(VISUAL_HZ_MAX, this.visualRate + delta));
    // A stalled frame must not turn into a jump in brightness. Capping the
    // phase step means a long gap slows the breathing down rather than
    // skipping it forward, which keeps the luminance change gradual even when
    // the main thread is not.
    const phaseStep = Math.min(0.05, dtReal);
    this.phase = (this.phase + Math.PI * 2 * this.visualRate * phaseStep) % (Math.PI * 2);
    const pulse = 0.5 + 0.5 * Math.sin(this.phase);

    this.opts.onFrame?.({ pulse, lobe: this.lorenz.lobe, rho });
  }

  private fireBurst(): void {
    if (!this.ctx || !this.burst || !this.burstFilter) return;
    const t = this.ctx.currentTime;
    const v = this.logistic.next();
    const length = 0.04 + v * 0.05; // 40-90 ms
    this.burstFilter.frequency.setTargetAtTime(180 + v * 2600, t, 0.02);
    const g = this.burst.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(0.12 + v * 0.1, t + 0.008);
    g.exponentialRampToValueAtTime(0.0001, t + length);
  }

  // -------------------------------------------------------------------------
  // Control
  // -------------------------------------------------------------------------
  setProgress(p: number): void {
    this.progress = Math.min(1, Math.max(0, p));
  }

  setVolume(v: number): void {
    this.volume = Math.max(0.0001, v);
    if (this.master && this.ctx && this.running) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
    }
  }

  /** Ramps the field down but keeps the attractor's state and the graph alive. */
  pause(): void {
    if (!this.ctx || !this.master || !this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
    this.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  }

  async resume(): Promise<void> {
    if (!this.ctx || !this.master || this.running) return;
    await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
    this.master.gain.exponentialRampToValueAtTime(this.volume, t + 0.8);
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Ramps out over FADE_OUT, then tears the graph down. */
  async stop(): Promise<void> {
    const ctx = this.ctx;
    const master = this.master;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ctx = null;
    this.master = null;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.exponentialRampToValueAtTime(0.0001, t + FADE_OUT);
    const sources = this.sources;
    this.sources = [];
    this.delayParams = [];
    this.spines = [];
    this.weather = [];
    window.setTimeout(() => {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
      void ctx.close();
    }, (FADE_OUT + 0.2) * 1000);
  }
}
