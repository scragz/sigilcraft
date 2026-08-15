/**
 * Stage 05 — Release.
 *
 * A deliberate terminal act rather than whatever happens when the tab closes.
 * There is no confirmation dialog: the hold is the confirmation, and it is more
 * ritually appropriate than a modal asking whether you meant it.
 */

import { createGlyphView, downloadSigil } from "../../core/svg";
import type { AppContext, StagePanel } from "../context";
import { h, prefersReducedMotion, prose } from "../dom";

const HOLD_MS = 1500;

export function releaseStage(ctx: AppContext): StagePanel {
  if (ctx.justReleased) {
    return {
      node: h(
        "section",
        { class: "stage", "aria-labelledby": "stage-05-title" },
        h("p", { class: "stage-index", text: "05" }),
        h("h1", { id: "stage-05-title", class: "stage-title", text: "Released" }),
        prose(
          [
            "The mark is gone, and the words with it. Nothing was kept.",
            "It is not yours to watch now.",
          ],
          "epigraph",
        ),
        h(
          "div",
          { class: "acts" },
          h("button", {
            class: "act",
            type: "button",
            text: "Again",
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
        h("p", { class: "aside", text: "There is no mark yet. This stage stays shut until there is." }),
        h(
          "div",
          { class: "acts" },
          h("button", {
            class: "act",
            type: "button",
            text: ctx.session.statement ? "02" : "01",
            "aria-label": ctx.session.statement ? "Back to the strip" : "Go to stage 01",
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
    class: "act act-release",
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

    frame,

    h(
      "div",
      { class: "release-acts" },
      h(
        "div",
        { class: "release-act" },
        h("p", { class: "aside", text: "Keep it only to destroy it somewhere real." }),
        h("button", {
          class: "act",
          type: "button",
          text: "Keep",
          "aria-label": "download the mark as SVG",
          onClick: () => downloadSigil(composition, ctx.session.statement),
        }),
      ),
      h(
        "div",
        { class: "release-act" },
        h("p", { class: "aside", text: "Nothing is stored elsewhere. Nothing can be recovered." }),
        button,
      ),
    ),
  );

  return { node, dispose: () => cancelAnimationFrame(raf) };
}
