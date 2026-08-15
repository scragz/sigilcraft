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

import { h, prefersReducedMotion } from "../dom";
import type { AppContext, StagePanel } from "../context";
import { compressionValueText, createGlyphView, downloadSigil } from "../../core/svg";
import { seedHex } from "../../core/rng";

export function compressStage(ctx: AppContext): StagePanel {
  const { composition, seed } = ctx.derived;
  if (!composition) {
    return { node: h("section", { class: "stage" }, h("p", { text: "Nothing to compress." })) };
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
    const text = compressionValueText(composition, t);
    readout.textContent = charged
      ? `${Math.round(t * 100)}% · sealed`
      : `${Math.round(t * 100)}%`;
    slider?.setAttribute("aria-valuetext", text);
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

  const node = h(
    "section",
    { class: "stage", "aria-labelledby": "stage-03-title" },
    h("p", { class: "stage-index", text: "03" }),
    h("h1", { id: "stage-03-title", class: "stage-title", text: "Compress the Glyph" }),

    h("div", { class: "glyph-frame" }, view.svg),
    h("p", {
      class: "glyph-caption",
      text: ctx.session.rerolls > 0 ? `${seedHex(seed)} · +${ctx.session.rerolls}` : seedHex(seed),
    }),

    slider,
    readout,

    h(
      "div",
      { class: "acts" },
      h("button", {
        class: "act act-primary",
        type: "button",
        text: charged ? "Return" : "Charge",
        onClick: () => ctx.goto(4),
      }),
      charged
        ? null
        : h("button", {
            class: "act",
            type: "button",
            text: `Reroll +${ctx.session.rerolls + 1}`,
            onClick: () => ctx.update({ rerolls: ctx.session.rerolls + 1 }),
          }),
      h("button", {
        class: "act",
        type: "button",
        text: "Keep",
        "aria-label": "download the mark as SVG",
        onClick: () => downloadSigil(composition, ctx.session.statement),
      }),
    ),

    h("p", {
      class: "aside",
      text: charged
        ? "Sealed at the compression it was charged at. It is the mark now."
        : "The same words always make the same mark.",
    }),
  );

  // Reads as drawing: on first arrival the mark draws itself once, then the
  // slider takes over.
  if (slider) {
    slider.value = String(Math.round(value * 1000));
    if (value === 0 && !still) {
      const start = performance.now();
      const duration = 2600;
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
