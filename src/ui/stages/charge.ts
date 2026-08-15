/**
 * Stage 04 — Charge.
 *
 * The screen is the mark and one way out of it. Tap the mark and the field
 * comes up: a seed-derived drone and a breath-rate luminance pulse, with a ring
 * that empties as the charge accumulates. Tap it again and everything ramps
 * back down.
 *
 * There is nothing to configure here. Method, length and level are decided by
 * the mark and by the constants below — a person who has just written down
 * something they want should not then be asked to pick a waveform.
 *
 * The pulse rate is the one number that is a constraint rather than a taste:
 * it is clamped to 0.25-1 Hz at the output in engine.ts, no matter what the
 * attractor does, and `prefers-reduced-motion` stops it entirely. The field
 * never starts without a tap and always ramps in over more than a second.
 */

import { ChargeField, type FieldFrame } from "../../audio/engine";
import { createGlyphView } from "../../core/svg";
import type { AppContext, StagePanel } from "../context";
import { h, prefersReducedMotion } from "../dom";

const NS = "http://www.w3.org/2000/svg";
const RING_RADIUS = 1.02;

/** Fixed, and not a slider. Loud enough to fill headphones, not to startle. */
const VOLUME = 0.5;

/**
 * The depleting ring, as an arc rather than a dashed circle.
 *
 * Dashing was the obvious way to do this and it does not work: Chrome measures
 * a <circle> as several percent shorter than its own rendering of it, so both
 * `pathLength` normalisation and `getTotalLength()` leave the ring open at full
 * charge. Describing the arc directly is exact and owes the renderer nothing.
 */
function arcPath(fraction: number, r = RING_RADIUS): string {
  const f = Math.min(1, Math.max(0, fraction));
  if (f <= 0.0005) return "";
  if (f >= 0.9995) return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${r} ${r} 0 0 1 0 ${-r}`;
  const angle = -Math.PI / 2 + f * Math.PI * 2;
  const x = (Math.cos(angle) * r).toFixed(4);
  const y = (Math.sin(angle) * r).toFixed(4);
  return `M 0 ${-r} A ${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}`;
}

export function chargeStage(ctx: AppContext): StagePanel {
  const { composition, method, chargeMs } = ctx.derived;
  if (!composition) {
    return { node: h("section", { class: "screen" }, h("p", { text: "Nothing to charge." })) };
  }

  const charged = ctx.session.chargedAt !== null;

  // ---------------------------------------------------------------- the mark
  const view = createGlyphView(composition);
  view.setCompression(ctx.session.compression || 1);

  const ring = document.createElementNS(NS, "svg");
  ring.setAttribute("viewBox", "-1.1 -1.1 2.2 2.2");
  ring.setAttribute("class", "charge-ring");
  ring.setAttribute("aria-hidden", "true");
  const ringPath = document.createElementNS(NS, "path");
  ring.append(ringPath);

  let field: ChargeField | null = null;
  let raf = 0;
  let lastTick = 0;
  let held = ctx.session.held;
  let persistAt = held;
  let running = false;

  const mark = h(
    "button",
    {
      class: "mark",
      type: "button",
      "aria-pressed": "false",
      "aria-label": charged ? "the charged mark" : "charge the mark",
      onClick: () => void toggle(),
    },
    view.svg,
    ring,
  ) as HTMLButtonElement;

  const hint = h("p", {
    class: "hint",
    text: charged ? "" : "Tap the mark",
  });

  const setRing = () => {
    ringPath.setAttribute("d", arcPath(chargeMs > 0 ? 1 - Math.min(1, held / chargeMs) : 0));
  };
  setRing();

  const setPulse = (value: number) => {
    mark.style.setProperty("--pulse", prefersReducedMotion() ? "1" : value.toFixed(3));
  };
  setPulse(1);

  const onFrame = (f: FieldFrame) => setPulse(f.pulse);

  const tick = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(250, now - lastTick);
    lastTick = now;
    held += dt;
    field?.setProgress(Math.min(1, held / chargeMs));
    setRing();
    // Survive a reload without losing the charge, without writing every frame.
    if (held - persistAt > 2000) {
      persistAt = held;
      ctx.updateQuiet({ held });
    }
    if (held >= chargeMs) complete();
  };

  const start = async () => {
    if (running) return;
    running = true;
    mark.classList.add("is-charging");
    mark.setAttribute("aria-pressed", "true");
    hint.textContent = "";
    lastTick = performance.now();
    raf = requestAnimationFrame(tick);
    try {
      if (!field) {
        field = new ChargeField({
          letters: composition.letters,
          seed: composition.seed,
          method: method.id,
          volume: VOLUME,
          onFrame,
        });
        field.setProgress(Math.min(1, held / chargeMs));
      }
      await field.start();
    } catch {
      // The pulse and the ring stand on their own.
      field = null;
      hint.textContent = "No audio here. The charge still runs.";
    }
  };

  const stop = (finished: boolean) => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    setPulse(1);
    mark.classList.remove("is-charging");
    mark.setAttribute("aria-pressed", "false");
    if (finished) {
      void field?.stop();
      field = null;
    } else {
      field?.pause();
      hint.textContent = "";
    }
    ctx.updateQuiet({ held });
    persistAt = held;
  };

  const toggle = async () => {
    if (running) stop(false);
    else await start();
  };

  const complete = () => {
    stop(true);
    // Three things fire together: the mark is fixed, the slider locks, and the
    // reroll disappears.
    ctx.update({ held: chargeMs, chargedAt: Date.now() });
  };

  const node = h(
    "section",
    { class: "screen", "aria-labelledby": "stage-04-title" },
    h("p", { class: "screen-index", text: "04" }),
    h("h1", { id: "stage-04-title", class: "screen-title", text: charged ? "Charged" : "Charge" }),

    mark,
    hint,

    // The one quiet line. It states itself once and does not come back.
    charged && !ctx.session.doneLineSeen
      ? h("p", { class: "aside done-line", text: "The working is done — let it go." })
      : null,

    h("button", {
      class: "sigil-act",
      type: "button",
      text: "Release",
      onClick: () => ctx.goto(5),
    }),
  );

  return {
    node,
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      void field?.stop();
      field = null;
      const patch: Partial<typeof ctx.session> = {};
      if (held !== ctx.session.held) patch.held = held;
      if (charged && !ctx.session.doneLineSeen) patch.doneLineSeen = true;
      if (Object.keys(patch).length) ctx.updateQuiet(patch);
    },
  };
}
