/**
 * Stage 00 — Threshold.
 *
 * Cryptic by design. Nothing here is defined, glossed, or justified, and the
 * copy stays short: opacity plus length reads as evasive, opacity plus brevity
 * reads as assumed competence. There is no second-person instruction anywhere
 * on this stage — the first imperative in the app is the text field in 01.
 *
 * This is not a missing tutorial. The whole method routes around the believing
 * mind, and a threshold that argued for it would activate exactly the faculty
 * being routed around.
 */

import { h, prose } from "../dom";
import type { AppContext, StagePanel } from "../context";

const PREMISE = [
  "The mind that wants and the mind that judges are not the same system.",
  "The second one intercepts. A desire stated plainly is weighed, checked against everything already believed possible, and handed back diminished.",
  "A sigil is a desire that gets past it. The statement is written, then destroyed as language. What cannot be read cannot be argued with.",
  "Five stages.",
];

export function thresholdStage(ctx: AppContext): StagePanel {
  const node = h(
    "section",
    { class: "stage", "aria-labelledby": "stage-00-title" },
    h("p", { class: "stage-index", text: "00" }),
    h("h1", { id: "stage-00-title", class: "stage-title", text: "Threshold" }),
    prose(PREMISE, "epigraph"),
    h(
      "div",
      { class: "acts" },
      h("button", {
        class: "act act-primary",
        type: "button",
        text: "01",
        "aria-label": "Go to stage 01, state the intent",
        onClick: () => ctx.goto(1),
      }),
    ),
    h("p", { class: "whisper", text: "Nothing typed here leaves this device" }),
  );

  return { node };
}
