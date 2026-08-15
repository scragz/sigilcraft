/**
 * Layer 1, the substrate: a four-line feedback delay network, Hadamard-mixed.
 *
 * This runs in an AudioWorklet rather than as a graph of DelayNodes and
 * GainNodes, and that is not a performance decision. Web Audio inserts a
 * render-quantum of latency into feedback cycles, and it does not insert the
 * same amount into every path: the sixteen mix connections end up with
 * different effective delays. That scatter breaks the property the Hadamard
 * matrix is chosen for — an orthonormal matrix is only a contraction when every
 * path through it shares the same delay structure — and a network that is
 * stable on paper runs away in the browser. Measured in Chrome, a 0.96 loop
 * built out of nodes grows by a factor of ~35 per second.
 *
 * Integrating it here restores the guarantee: one sample, one matrix
 * multiplication, loop gain exactly what it says it is.
 *
 * Plain JS on purpose — worklet modules are loaded as-is, without a build step.
 */

/** Orthonormal: rows are mutually orthogonal and each has unit norm. */
const H = [
  [0.5, 0.5, 0.5, 0.5],
  [0.5, -0.5, 0.5, -0.5],
  [0.5, 0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5, 0.5],
];

const MAX_DELAY = 0.5;
/** Hard ceiling on loop gain. Above this the network is not a reverb. */
const MAX_FEEDBACK = 0.985;

class FeedbackDelayNetwork extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const delays = [0.0371, 0.0537, 0.0793, 0.1139].map((value, i) => ({
      name: `delay${i}`,
      defaultValue: value,
      minValue: 0.002,
      maxValue: MAX_DELAY - 0.01,
      automationRate: "a-rate",
    }));
    return [
      ...delays,
      {
        name: "feedback",
        defaultValue: 0.96,
        minValue: 0,
        maxValue: MAX_FEEDBACK,
        automationRate: "k-rate",
      },
      {
        // One-pole lowpass coefficient for the damping in the loop. At DC its
        // gain is exactly 1 and it never peaks, so it can only take energy out.
        name: "damping",
        defaultValue: 0.25,
        minValue: 0.005,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    this.size = Math.ceil(sampleRate * MAX_DELAY) + 4;
    this.lines = [
      new Float32Array(this.size),
      new Float32Array(this.size),
      new Float32Array(this.size),
      new Float32Array(this.size),
    ];
    this.lp = [0, 0, 0, 0];
    this.write = 0;
  }

  process(inputs, outputs, params) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    const input = inputs[0] && inputs[0][0];
    const frames = left.length;

    const fb = Math.min(MAX_FEEDBACK, params.feedback[0]);
    const damp = params.damping[0];
    const d = [params.delay0, params.delay1, params.delay2, params.delay3];
    const y = [0, 0, 0, 0];

    for (let n = 0; n < frames; n++) {
      const x = input ? input[n] : 0;

      for (let i = 0; i < 4; i++) {
        const seconds = d[i].length > 1 ? d[i][n] : d[i][0];
        const samples = Math.min(this.size - 2, Math.max(1, seconds * sampleRate));
        let read = this.write - samples;
        while (read < 0) read += this.size;
        const i0 = read | 0;
        const frac = read - i0;
        const i1 = i0 + 1 >= this.size ? 0 : i0 + 1;
        const line = this.lines[i];
        y[i] = line[i0] * (1 - frac) + line[i1] * frac;
      }

      // Two lines per side: the substrate arrives already wide, without a
      // stereo effect having been applied to it.
      left[n] = (y[0] + y[2]) * 0.5;
      right[n] = (y[1] + y[3]) * 0.5;

      for (let i = 0; i < 4; i++) this.lp[i] += damp * (y[i] - this.lp[i]);

      for (let j = 0; j < 4; j++) {
        const row = H[j];
        const mixed =
          row[0] * this.lp[0] + row[1] * this.lp[1] + row[2] * this.lp[2] + row[3] * this.lp[3];
        // The vanishing DC keeps denormals out of a near-unity feedback path,
        // which is a real CPU problem on long decays.
        this.lines[j][this.write] = fb * mixed + x + 1e-20;
      }

      this.write = this.write + 1 >= this.size ? 0 : this.write + 1;
    }

    // Cheap insurance: one non-finite sample would otherwise poison the loop
    // forever.
    if (!Number.isFinite(this.lp[0] + this.lp[1] + this.lp[2] + this.lp[3])) {
      this.lp = [0, 0, 0, 0];
      for (const line of this.lines) line.fill(0);
    }

    return true;
  }
}

registerProcessor("sigilcraft-fdn", FeedbackDelayNetwork);
