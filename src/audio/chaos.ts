/**
 * Layer 0 — the chaotic modulation core.
 *
 * Three coupled sources, integrated on the main thread at 60 Hz. Sample-accurate
 * modulation is unnecessary: everything downstream moves over seconds to
 * minutes.
 *
 * All three normalise to [0, 1] against empirically clamped ranges, and the
 * clamps are hard. An unbounded modulator arriving at a filter cutoff is how
 * you get a sound nobody consented to.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const norm = (v: number, lo: number, hi: number) => clamp01((v - lo) / (hi - lo));

/**
 * The structural driver.
 *
 * Chosen over an LFO for one behavioural reason: it dwells then flips. The
 * trajectory orbits one lobe for tens of seconds, then crosses to the other
 * without warning and without periodicity.
 */
export class Lorenz {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /** sigma = 10, beta = 8/3; rho is the bifurcation parameter (see METHODS). */
  step(rho: number, dt: number): void {
    const dx = 10 * (this.y - this.x);
    const dy = this.x * (rho - this.z) - this.y;
    const dz = this.x * this.y - (8 / 3) * this.z;
    this.x += dx * dt;
    this.y += dy * dt;
    this.z += dz * dt;
    if (!Number.isFinite(this.x + this.y + this.z)) {
      this.x = 0.1;
      this.y = 0.1;
      this.z = 20;
    }
  }

  get nx(): number {
    return norm(this.x, -26, 26);
  }
  get ny(): number {
    return norm(this.y, -34, 34);
  }
  get nz(): number {
    return norm(this.z, 0, 80);
  }
  /** Which wing of the attractor the trajectory is currently on. */
  get lobe(): -1 | 1 {
    return this.x < 0 ? -1 : 1;
  }
}

/**
 * The texture driver, run about four times faster than the Lorenz.
 * Signature: spiral, spiral, spiral, spike — extended quiet winding
 * interrupted by sharp z-excursions.
 */
export class Rossler {
  x = 1;
  y = 1;
  z = 0.5;

  constructor(x = 1, y = 1, z = 0.5) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  step(dt: number, a = 0.2, b = 0.2, c = 5.7): void {
    const dx = -this.y - this.z;
    const dy = this.x + a * this.y;
    const dz = b + this.z * (this.x - c);
    this.x += dx * dt;
    this.y += dy * dt;
    this.z += dz * dt;
    if (!Number.isFinite(this.x + this.y + this.z)) {
      this.x = 1;
      this.y = 1;
      this.z = 0.5;
    }
  }

  get nx(): number {
    return norm(this.x, -11, 13);
  }
  get ny(): number {
    return norm(this.y, -12, 8);
  }
  get nz(): number {
    return norm(this.z, 0, 25);
  }
}

/**
 * x(n+1) = r * x(n) * (1 - x(n)) at r = 3.9: chaotic but bounded.
 * Used only for discrete events — excitation bursts and resonator retunes —
 * and clocked irregularly, with the interval itself taken from the map.
 */
export class Logistic {
  private x: number;

  constructor(seed01: number, private r = 3.9) {
    // Keep away from the fixed points 0 and 1, which are absorbing.
    this.x = 0.15 + clamp01(seed01) * 0.7;
  }

  next(): number {
    this.x = this.r * this.x * (1 - this.x);
    if (!Number.isFinite(this.x) || this.x <= 0 || this.x >= 1) this.x = 0.4;
    return this.x;
  }
}
