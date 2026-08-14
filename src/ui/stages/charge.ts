/**
 * Stage 04 — Charge.
 *
 * The nervous system is the substrate of this stage, so this stage touches it:
 * a seed-derived audio field and a breath-rate visual pulse, held for as long
 * as the mark is held.
 *
 * Two things here are safety machinery rather than design:
 *   - the pre-charge gate, which must be on screen before the hold goes live;
 *   - the pulse rate, which is clamped at the output no matter what the
 *     attractor does.
 */

import { ChargeField, type FieldFrame } from "../../audio/engine";
import { DURATIONS, METHODS, METHOD_ORDER, type MethodId } from "../../audio/methods";
import { createGlyphView } from "../../core/svg";
import type { AppContext, StagePanel } from "../context";
import { h, prefersReducedMotion, prose } from "../dom";

const NS = "http://www.w3.org/2000/svg";
const RING_LENGTH = 1000;

const CAUTION = [
  "The practice keeps its own cautions about this stage. Gnosis sought too often, or held too long, stops being a technique and becomes the thing being done — the state gets pursued for itself and the working is forgotten inside it.",
  "The related failure comes later: a released sigil that gets checked on, revisited, reconsidered, admired. A mark under conscious supervision is a mark the conscious mind is still arguing with, which reintroduces exactly the interference this whole method exists to bypass. Forgetting is the last part of the technique, not what happens when the technique is over.",
];

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function chargeStage(ctx: AppContext): StagePanel {
  const { composition } = ctx.derived;
  if (!composition) {
    return { node: h("section", { class: "stage" }, h("p", { text: "No mark to charge." })) };
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
  const ringPath = document.createElementNS(NS, "circle");
  ringPath.setAttribute("cx", "0");
  ringPath.setAttribute("cy", "0");
  ringPath.setAttribute("r", "1.02");
  ringPath.setAttribute("pathLength", String(RING_LENGTH));
  ringPath.setAttribute("stroke-dasharray", String(RING_LENGTH));
  ringPath.setAttribute("transform", "rotate(-90)");
  ring.append(ringPath);

  const frame = h("div", { class: "glyph-frame glyph-frame-charge" }, view.svg, ring);

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

  // ------------------------------------------------------------- the machinery
  let field: ChargeField | null = null;
  let raf = 0;
  let lastTick = 0;
  let held = ctx.session.held;
  let persistAt = held;
  let running = false;

  const durationMs = () => ctx.session.duration * 1000;
  const remaining = () => Math.max(0, durationMs() - held);

  const clock = h("p", { class: "charge-clock", text: formatClock(ctx.session.duration) });
  const audioNote = h("p", { class: "footnote", hidden: true });

  const setRing = () => {
    const left = durationMs() > 0 ? remaining() / durationMs() : 0;
    ringPath.setAttribute("stroke-dashoffset", String(RING_LENGTH * (1 - left)));
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
    hold.textContent = "Holding";
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
      audioNote.textContent = "Audio is unavailable in this browser. The hold still counts.";
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
    hold.textContent = held > 0 ? "Hold to continue" : "Hold";
    ctx.updateQuiet({ held });
    persistAt = held;
  };

  const hold = h("button", {
    class: "hold",
    type: "button",
    text: ctx.session.held > 0 ? "Hold to continue" : "Hold",
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
  const methodCards = h(
    "div",
    { class: "method-cards", role: "radiogroup", "aria-label": "charging method" },
    ...METHOD_ORDER.map((id) => {
      const profile = METHODS[id];
      const selected = ctx.session.method === id;
      return h(
        "button",
        {
          class: `method-card${selected ? " is-selected" : ""}`,
          type: "button",
          role: "radio",
          "aria-checked": selected ? "true" : "false",
          onClick: () => {
            suspend();
            ctx.update({
              method: id,
              duration: profile.defaultDuration,
              held: 0,
            });
          },
        },
        h("h3", { class: "method-name", text: profile.name }),
        h("p", { class: "method-body", text: profile.body }),
        h("p", { class: "method-feel", text: profile.feel }),
      );
    }),
  );

  // --------------------------------------------------------------- the gate
  const gate = precharge(ctx, () => field);

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
    ? "Choose a method first."
    : !ctx.session.gateSeen
      ? "The notice above has to be on screen before this goes live."
      : null;
  hold.disabled = blocked !== null;

  const node = h(
    "section",
    { class: "stage", "aria-labelledby": "stage-04-title" },
    h("p", { class: "stage-index", text: "04" }),
    h("h1", { id: "stage-04-title", class: "stage-title", text: "Charge" }),
    prose([
      "Four traditional routes to the same place: a state in which the mark can be looked at without being thought about. The field below is derived from the same letters as the mark — the same initial conditions, run as sound instead of as a line.",
    ]),

    methodCards,

    gate,

    h(
      "div",
      { class: "charge-panel" },
      frame,
      h(
        "div",
        { class: "charge-controls" },
        clock,
        durations,
        hold,
        blocked ? h("p", { class: "footnote", text: blocked }) : null,
        h("p", {
          class: "footnote",
          text: "Releasing pauses the charge; it does not undo it.",
        }),
        audioNote,
      ),
    ),

    h(
      "div",
      { class: "guidance" },
      h("h2", { class: "section-title", text: "A note from inside the practice" }),
      prose(CAUTION),
    ),
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
// The pre-charge gate
// ---------------------------------------------------------------------------

/**
 * One compact panel, not a modal and not a checkbox wall. It does not require
 * acknowledgement — only presence before the fact.
 *
 * This is the one place in the app that should be slightly less elegant than it
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
    h("h2", { class: "section-title", text: "Before the hold" }),
    h(
      "div",
      { class: "gate-row" },
      h("label", { for: "gate-motion", text: "Still image" }),
      motion,
      h("p", {
        class: "footnote",
        text: prefersReducedMotion()
          ? "This stage breathes the glyph slowly, under 1 Hz. Reduced motion is set at the system level, so it stays still."
          : "This stage breathes the glyph slowly, under 1 Hz. No flashing, no background change.",
      }),
    ),
    h(
      "div",
      { class: "gate-row" },
      h("label", { for: "gate-volume", text: "Volume" }),
      volume,
      h("p", { class: "footnote", text: "Headphones recommended." }),
    ),
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
    h("h1", { id: "stage-04-title", class: "stage-title", text: "Charge" }),
    prose([
      `Driven in by ${method.toLowerCase()}, at ${Math.round(
        ctx.session.duration / 60,
      )} minutes. The compression is fixed and the seed will not move again.`,
    ]),
    frame,
    h(
      "div",
      { class: "stage-actions" },
      // The one quiet line. It states itself once and does not come back.
      ctx.session.doneLineSeen
        ? null
        : h("p", { class: "done-line", text: "The working is done — let it go." }),
      h("button", {
        class: "button button-primary",
        type: "button",
        text: "05 — Release",
        onClick: () => ctx.goto(5),
      }),
    ),
    h(
      "div",
      { class: "guidance" },
      h("h2", { class: "section-title", text: "A note from inside the practice" }),
      prose(CAUTION),
    ),
  );
}
