/**
 * Stage 04 — Charge.
 *
 * The nervous system is the substrate of this stage, so this stage touches it:
 * a seed-derived audio field and a breath-rate visual pulse, held for as long
 * as the mark is held.
 *
 * Two things here are safety machinery rather than design, and stay however
 * spare the rest of the app gets:
 *   - the pre-charge notice, which must be on screen before the hold goes live;
 *   - the pulse rate, which is clamped at the output no matter what the
 *     attractor does.
 */

import { ChargeField, type FieldFrame } from "../../audio/engine";
import { DURATIONS, METHODS, METHOD_ORDER } from "../../audio/methods";
import { createGlyphView } from "../../core/svg";
import type { AppContext, StagePanel } from "../context";
import { h, prefersReducedMotion } from "../dom";

const NS = "http://www.w3.org/2000/svg";
const RING_RADIUS = 1.02;

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

/** From inside the practice, not bolted on. */
const CAUTION = [
  "Sought too often, the state becomes the working.",
  "A mark checked on is a mark still being argued with.",
];

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function chargeStage(ctx: AppContext): StagePanel {
  const { composition } = ctx.derived;
  if (!composition) {
    return { node: h("section", { class: "stage" }, h("p", { text: "Nothing to charge." })) };
  }

  const charged = ctx.session.chargedAt !== null;
  const still = () => prefersReducedMotion() || ctx.session.stillImage;

  // ---------------------------------------------------------------- the mark
  const view = createGlyphView(composition);
  view.setCompression(ctx.session.compression || 1);

  const ring = document.createElementNS(NS, "svg");
  ring.setAttribute("viewBox", "-1.1 -1.1 2.2 2.2");
  ring.setAttribute("class", "charge-ring");
  ring.setAttribute("aria-hidden", "true");
  const ringPath = document.createElementNS(NS, "path");
  ring.append(ringPath);

  const frame = h("div", { class: "glyph-frame" }, view.svg, ring);

  if (charged) {
    return {
      node: chargedPanel(ctx, frame),
      // The quiet line has now been said. It does not repeat, escalate, or
      // nag on return visits.
      dispose: () => {
        if (!ctx.session.doneLineSeen) ctx.updateQuiet({ doneLineSeen: true });
      },
    };
  }

  // ------------------------------------------------------------ the machinery
  let field: ChargeField | null = null;
  let raf = 0;
  let lastTick = 0;
  let held = ctx.session.held;
  let persistAt = held;
  let running = false;

  const durationMs = () => ctx.session.duration * 1000;
  const remaining = () => Math.max(0, durationMs() - held);

  const clock = h("p", { class: "charge-clock", text: formatClock(ctx.session.duration) });
  const audioNote = h("p", { class: "gate-note", hidden: true });

  const setRing = () => {
    const left = durationMs() > 0 ? remaining() / durationMs() : 0;
    ringPath.setAttribute("d", arcPath(left));
  };
  setRing();

  const setPulse = (value: number) => {
    frame.style.setProperty("--pulse", still() ? "1" : value.toFixed(3));
  };
  setPulse(1);

  const onFrame = (f: FieldFrame) => setPulse(f.pulse);

  const tick = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(250, now - lastTick);
    lastTick = now;
    held += dt;
    field?.setProgress(Math.min(1, held / durationMs()));
    setRing();
    clock.textContent = formatClock(remaining() / 1000);
    // Survive a reload without losing the charge, without writing every frame.
    if (held - persistAt > 2000) {
      persistAt = held;
      ctx.updateQuiet({ held });
    }
    if (held >= durationMs()) complete();
  };

  const complete = () => {
    running = false;
    cancelAnimationFrame(raf);
    void field?.stop();
    field = null;
    // Three things fire together: the mark is fixed, the slider locks, and the
    // reroll disappears.
    ctx.update({ held: durationMs(), chargedAt: Date.now() });
  };

  const begin = async () => {
    if (running || !ctx.session.method || !ctx.session.gateSeen) return;
    running = true;
    hold.classList.add("is-holding");
    hold.textContent = "Held";
    lastTick = performance.now();
    raf = requestAnimationFrame(tick);
    try {
      if (!field) {
        field = new ChargeField({
          letters: composition.letters,
          seed: composition.seed,
          method: ctx.session.method,
          volume: ctx.session.volume,
          onFrame,
        });
        field.setProgress(Math.min(1, held / durationMs()));
      }
      await field.start();
    } catch {
      // The visual field and the timer stand on their own.
      field = null;
      audioNote.textContent = "No audio in this browser. The hold still counts.";
      audioNote.hidden = false;
    }
  };

  const suspend = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    field?.pause();
    setPulse(1);
    hold.classList.remove("is-holding");
    hold.textContent = "Hold";
    ctx.updateQuiet({ held });
    persistAt = held;
  };

  const hold = h("button", {
    class: "hold",
    type: "button",
    text: "Hold",
    onPointerDown: (event: PointerEvent) => {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      event.preventDefault();
      void begin();
    },
    onPointerUp: suspend,
    onPointerCancel: suspend,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
      event.preventDefault();
      void begin();
    },
    onKeyUp: (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") suspend();
    },
    onBlur: suspend,
  }) as HTMLButtonElement;

  // ------------------------------------------------------------------ methods
  const methods = h(
    "div",
    { class: "methods", role: "radiogroup", "aria-label": "method" },
    ...METHOD_ORDER.map((id) => {
      const profile = METHODS[id];
      const selected = ctx.session.method === id;
      return h(
        "button",
        {
          class: `method${selected ? " is-selected" : ""}`,
          type: "button",
          role: "radio",
          "aria-checked": selected ? "true" : "false",
          onClick: () => {
            suspend();
            ctx.update({ method: id, duration: profile.defaultDuration, held: 0 });
          },
        },
        h("span", { class: "method-name", text: profile.name }),
        h("span", { class: "method-line", text: profile.line }),
      );
    }),
  );

  const durations = h(
    "div",
    { class: "durations", role: "radiogroup", "aria-label": "duration" },
    ...DURATIONS.map((seconds) =>
      h("button", {
        class: `chip${ctx.session.duration === seconds ? " is-selected" : ""}`,
        type: "button",
        role: "radio",
        "aria-checked": ctx.session.duration === seconds ? "true" : "false",
        text: seconds >= 600 ? "10 min" : `${seconds / 60} min`,
        onClick: () => {
          suspend();
          ctx.update({ duration: seconds, held: 0 });
        },
      }),
    ),
  );

  const blocked = !ctx.session.method
    ? "Choose a method."
    : !ctx.session.gateSeen
      ? "After the notice above."
      : null;
  hold.disabled = blocked !== null;

  const node = h(
    "section",
    { class: "stage", "aria-labelledby": "stage-04-title" },
    h("p", { class: "stage-index", text: "04" }),
    h("h1", { id: "stage-04-title", class: "stage-title", text: "Charge" }),

    methods,
    frame,
    clock,
    durations,

    precharge(ctx, () => field),

    hold,
    blocked ? h("p", { class: "gate-note", text: blocked }) : null,
    audioNote,

    h("ul", { class: "laws" }, ...CAUTION.map((text) => h("li", { text }))),
  );

  return {
    node,
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      void field?.stop();
      field = null;
      if (held !== ctx.session.held) ctx.updateQuiet({ held });
    },
  };
}

// ---------------------------------------------------------------------------
// The pre-charge notice
// ---------------------------------------------------------------------------

/**
 * One compact panel, not a modal and not a checkbox wall. It does not require
 * acknowledgement — only presence before the fact.
 *
 * This is the one place in the app that should be slightly plainer than it
 * wants to be.
 */
function precharge(ctx: AppContext, field: () => ChargeField | null): HTMLElement {
  const motion = h("input", {
    type: "checkbox",
    id: "gate-motion",
    onChange: (event: Event) => {
      ctx.updateQuiet({ stillImage: (event.target as HTMLInputElement).checked });
    },
  }) as HTMLInputElement;
  motion.checked = ctx.session.stillImage || prefersReducedMotion();
  motion.disabled = prefersReducedMotion();

  const volume = h("input", {
    type: "range",
    id: "gate-volume",
    class: "slider",
    min: "0",
    max: "100",
    step: "1",
    onInput: (event: Event) => {
      const v = Number((event.target as HTMLInputElement).value) / 100;
      ctx.updateQuiet({ volume: v });
      field()?.setVolume(v);
    },
  }) as HTMLInputElement;
  volume.value = String(Math.round(ctx.session.volume * 100));

  const panel = h(
    "div",
    { class: "gate" },
    h(
      "div",
      { class: "gate-row" },
      h("label", { for: "gate-motion", text: "Still image" }),
      motion,
    ),
    h("div", { class: "gate-row" }, h("label", { for: "gate-volume", text: "Volume" }), volume),
    h("p", {
      class: "gate-note",
      text: "The glyph breathes below one hertz. Nothing flashes. Headphones.",
    }),
  );

  // Presence before the fact: the hold goes live once this has actually been
  // on screen, not merely present in the document.
  if (!ctx.session.gateSeen) {
    if (typeof IntersectionObserver === "function") {
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          observer.disconnect();
          ctx.update({ gateSeen: true });
        },
        { threshold: 0.6 },
      );
      observer.observe(panel);
    } else {
      ctx.updateQuiet({ gateSeen: true });
    }
  }

  return panel;
}

// ---------------------------------------------------------------------------
// After the charge
// ---------------------------------------------------------------------------

function chargedPanel(ctx: AppContext, frame: HTMLElement): HTMLElement {
  const method = ctx.session.method ? METHODS[ctx.session.method].name : "—";
  frame.style.setProperty("--pulse", "1");

  return h(
    "section",
    { class: "stage", "aria-labelledby": "stage-04-title" },
    h("p", { class: "stage-index", text: "04" }),
    h("h1", { id: "stage-04-title", class: "stage-title", text: "Charged" }),
    frame,
    h("p", {
      class: "glyph-caption",
      text: `${method} · ${Math.round(ctx.session.duration / 60)} min`,
    }),
    // The one quiet line. It states itself once and does not come back.
    ctx.session.doneLineSeen
      ? null
      : h("p", { class: "aside done-line", text: "The working is done — let it go." }),
    h(
      "div",
      { class: "acts" },
      h("button", {
        class: "act act-primary",
        type: "button",
        text: "05",
        "aria-label": "Go to stage 05, release",
        onClick: () => ctx.goto(5),
      }),
    ),
  );
}
