/**
 * Stage 05 — Release.
 *
 * A deliberate terminal act rather than whatever happens when the tab closes.
 * There is no confirmation dialog: the hold is the confirmation, and it is more
 * ritually appropriate than a modal asking whether you meant it.
 */

import { downloadSigil } from "../../core/svg";
import { createGlyphView } from "../../core/svg";
import type { AppContext, StagePanel } from "../context";
import { h, prefersReducedMotion, prose } from "../dom";

const HOLD_MS = 1500;

export function releaseStage(ctx: AppContext): StagePanel {
  if (ctx.justReleased) {
    return {
      node: h(
        "section",
        { class: "stage stage-released", "aria-labelledby": "stage-05-title" },
        h("p", { class: "stage-index", text: "05" }),
        h("h1", { id: "stage-05-title", class: "stage-title", text: "Released" }),
        prose([
          "The mark is gone, and so is the statement it came from. Nothing was kept — not here, not anywhere else.",
          "Whatever was worked is now the working's business rather than yours.",
        ]),
        h(
          "div",
          { class: "stage-actions" },
          h("button", {
            class: "button button-quiet",
            type: "button",
            text: "Begin again",
            onClick: () => ctx.goto(1),
          }),
        ),
      ),
    };
  }

  const { composition } = ctx.derived;

  if (!composition) {
    return {
      node: h(
        "section",
        { class: "stage", "aria-labelledby": "stage-05-title" },
        h("p", { class: "stage-index", text: "05" }),
        h("h1", { id: "stage-05-title", class: "stage-title", text: "Release" }),
        h(
          "p",
          { class: "locked-reason" },
          "There is no mark to release yet. The stage stays here, and stays shut, until one exists.",
        ),
        h(
          "div",
          { class: "stage-actions" },
          h("button", {
            class: "button button-quiet",
            type: "button",
            text: ctx.session.statement ? "Back to the strip" : "01 — State the Intent",
            onClick: () => ctx.goto(ctx.session.statement ? 2 : 1),
          }),
        ),
      ),
    };
  }

  const view = createGlyphView(composition);
  view.setCompression(ctx.session.compression || 1);
  const frame = h("div", { class: "glyph-frame" }, view.svg);

  let armed = false;
  let raf = 0;
  let start = 0;
  let dissolving = false;

  const button = h("button", {
    class: "button button-release",
    type: "button",
  }) as HTMLButtonElement;
  button.textContent = "Release";

  const setProgress = (p: number) => button.style.setProperty("--progress", `${p * 100}%`);

  const dissolve = () => {
    dissolving = true;
    button.disabled = true;
    button.textContent = "Gone";
    if (prefersReducedMotion() || ctx.session.stillImage) {
      ctx.release();
      return;
    }
    frame.classList.add("is-dissolving");
    window.setTimeout(() => ctx.release(), 1400);
  };

  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      dissolve();
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  const beginHold = () => {
    if (!armed || dissolving) return;
    start = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    if (dissolving) return;
    cancelAnimationFrame(raf);
    setProgress(0);
  };

  button.addEventListener("click", () => {
    // Tap once to arm; the second interaction is the hold itself.
    if (armed || dissolving) return;
    armed = true;
    button.classList.add("is-armed");
    button.textContent = "Hold to release";
  });
  button.addEventListener("pointerdown", (event) => {
    if (!armed) return;
    button.setPointerCapture(event.pointerId);
    event.preventDefault();
    beginHold();
  });
  button.addEventListener("pointerup", cancelHold);
  button.addEventListener("pointercancel", cancelHold);
  button.addEventListener("keydown", (event) => {
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    if (!armed) return;
    event.preventDefault();
    beginHold();
  });
  button.addEventListener("keyup", cancelHold);
  button.addEventListener("blur", cancelHold);

  const node = h(
    "section",
    { class: "stage", "aria-labelledby": "stage-05-title" },
    h("p", { class: "stage-index", text: "05" }),
    h("h1", { id: "stage-05-title", class: "stage-title", text: "Release" }),
    prose([
      ctx.session.chargedAt
        ? "The mark has been driven in. What is left is the copy on this screen, and keeping it is the one thing the method cannot survive."
        : "The mark can be released at any point, charged or not. Nothing about the destruction depends on the working having been finished.",
    ]),

    frame,

    h(
      "div",
      { class: "release-block" },
      h("h2", { class: "section-title", text: "Keep it, briefly" }),
      prose([
        "Vector only, no raster. Worth downloading only if the intention is to destroy the file's physical form later — printed and burned, buried, thrown into water. A sigil that lives in a downloads folder is a sigil being checked on.",
        "The exported file carries the statement in an XML comment: invisible in every renderer, plain to anyone who opens it in a text editor. That is a fair mirror of how a physical sigil works.",
      ]),
      h(
        "div",
        { class: "stage-actions" },
        h("button", {
          class: "button button-quiet",
          type: "button",
          text: "Download SVG",
          onClick: () => downloadSigil(composition, ctx.session.statement),
        }),
      ),
    ),

    h(
      "div",
      { class: "release-block" },
      h("h2", { class: "section-title", text: "Destroy it" }),
      prose([
        "Releasing erases the mark, the statement, the seed and the charge from this browser at once. Nothing was ever sent anywhere, so there is nothing anywhere to recover it from.",
      ]),
      h("div", { class: "stage-actions" }, button),
      h("p", {
        class: "footnote",
        text: "Tap once, then hold. There is no confirmation dialog; the hold is the confirmation.",
      }),
    ),
  );

  return { node, dispose: () => cancelAnimationFrame(raf) };
}
