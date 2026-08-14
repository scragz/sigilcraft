/**
 * Stage 03 — Compress the Glyph.
 *
 * The slider reveals a precomputed path by arc length. It does not interpolate
 * letter count: what moves is the drawing of one finished mark, which is
 * ritually correct — sigils are traditionally drawn in a single motion.
 *
 * Once the mark has been charged the slider locks and the reroll disappears.
 * Locking a teaching control is normally hostile; here the lock is the
 * teaching.
 */

import { h, prefersReducedMotion, prose } from "../dom";
import type { AppContext, StagePanel } from "../context";
import { compressionValueText, createGlyphView, downloadSigil } from "../../core/svg";
import { seedHex } from "../../core/rng";

const PASSES = [
  "Each surviving consonant carries one gesture: a single stroke in unit space with a declared entry and exit. K is angular, S a double curve, T a cross. Lifted back out of a finished mark, a gesture is still recognisable; the mark is not.",
  "The gestures chain rather than scatter — each one's entry is placed on the last one's exit, at a rotation drawn from the seed. Only a third to two-thirds of each gesture is drawn, and the chord that reaches the next entry cuts across whatever was left out. That fragmenting is what kills legibility; the chaining is what keeps the result one stroke.",
  "The rotations and scales are then hill-climbed against a score: spread evenly across the field, mass near the centre, reaching the circle without breaching it, crossing itself about three times. The crossing term is load-bearing. A mark reads as one thing largely because it intersects itself.",
];

export function compressStage(ctx: AppContext): StagePanel {
  const { composition, seed } = ctx.derived;
  if (!composition) {
    return {
      node: h("section", { class: "stage" }, h("p", { text: "No letters survived." })),
    };
  }

  const charged = ctx.session.chargedAt !== null;
  const still = prefersReducedMotion() || ctx.session.stillImage;
  const view = createGlyphView(composition);

  let raf = 0;
  let value = ctx.session.compression;

  const readout = h("p", { class: "slider-readout" });

  const apply = (t: number, persist: boolean) => {
    value = t;
    view.setCompression(t);
    readout.textContent = compressionValueText(composition, t);
    if (slider) slider.setAttribute("aria-valuetext", readout.textContent);
    if (persist) ctx.updateQuiet({ compression: t });
  };

  const slider = charged
    ? null
    : (h("input", {
        class: "slider",
        type: "range",
        min: "0",
        max: "1000",
        step: "1",
        id: "compression",
        "aria-label": "compression",
        onInput: (event: Event) => {
          cancelAnimationFrame(raf);
          apply(Number((event.target as HTMLInputElement).value) / 1000, true);
        },
      }) as HTMLInputElement);

  const control = charged
    ? h(
        "div",
        { class: "slider-locked" },
        h("p", { class: "field-label", text: "Compression" }),
        h("p", {
          class: "locked-value",
          text: `${Math.round(value * 100)}% — locked`,
        }),
        h("p", {
          class: "footnote",
          text: "The mark was charged at this compression. It is the mark now; there is nothing left to adjust.",
        }),
      )
    : h(
        "div",
        { class: "slider-row" },
        h("label", { class: "field-label", for: "compression", text: "Compression" }),
        slider!,
      );

  const node = h(
    "section",
    { class: "stage", "aria-labelledby": "stage-03-title" },
    h("p", { class: "stage-index", text: "03" }),
    h("h1", { id: "stage-03-title", class: "stage-title", text: "Compress the Glyph" }),

    h(
      "div",
      { class: "glyph-frame" },
      view.svg,
      h(
        "p",
        { class: "glyph-caption" },
        `${composition.letters.join(" ")} · seed ${seedHex(seed)}`,
        ctx.session.rerolls > 0 ? ` · reroll +${ctx.session.rerolls}` : "",
      ),
    ),

    control,
    readout,

    h(
      "div",
      { class: "stage-actions" },
      charged
        ? null
        : h("button", {
            class: "button button-quiet",
            type: "button",
            text: `Reroll +${ctx.session.rerolls + 1}`,
            title: "Increments the seed. Practitioners reroll marks they don't like.",
            onClick: () => ctx.update({ rerolls: ctx.session.rerolls + 1 }),
          }),
      h("button", {
        class: "button button-primary",
        type: "button",
        text: charged ? "Back to the charge" : "Charge it",
        onClick: () => ctx.goto(4),
      }),
      h("button", {
        class: "button button-quiet",
        type: "button",
        text: "Download SVG",
        onClick: () => downloadSigil(composition, ctx.session.statement),
      }),
    ),

    h(
      "div",
      { class: "guidance" },
      h("h2", { class: "section-title", text: "Three passes" }),
      h(
        "ol",
        { class: "passes" },
        ...PASSES.map((text) => h("li", { text })),
      ),
      h("h2", { class: "section-title", text: "On the seed" }),
      prose([
        `The seed is derived from the letters themselves — ${seedHex(
          ctx.derived.baseSeed,
        )} for this set — so the same statement always produces the same mark. The glyph is not drawn alongside the statement; it comes out of it.`,
        "Rerolling adds one to that seed and says so. Practitioners reroll marks they don't take to, and hiding that behind invisible randomness would be dishonest about what changed.",
      ]),
    ),
  );

  // Reads as drawing: on first arrival the mark draws itself once, then the
  // slider takes over.
  if (slider) {
    slider.value = String(Math.round(value * 1000));
    if (value === 0 && !still) {
      const start = performance.now();
      const duration = 2200;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = t * t * (3 - 2 * t);
        slider.value = String(Math.round(eased * 1000));
        apply(eased, t === 1);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      apply(value || 1, value === 0);
      slider.value = String(Math.round(value * 1000) || 1000);
    }
  } else {
    apply(value || 1, false);
  }

  return { node, dispose: () => cancelAnimationFrame(raf) };
}
