/**
 * Stage 00 — Threshold.
 *
 * Cryptic by design. Nothing here is defined, glossed, or justified, and the
 * copy is deliberately under 120 words: opacity plus length reads as evasive,
 * opacity plus brevity reads as assumed competence. There is no second-person
 * instruction anywhere on this stage — the first imperative in the app is the
 * text field in stage 01.
 *
 * This is not a missing tutorial. The whole app rests on the believing mind not
 * being addressed directly, and a threshold that argued for the method would
 * activate exactly the faculty the method exists to route around.
 */

import { h, prose } from "../dom";
import type { AppContext, StagePanel } from "../context";

const PREMISE = [
  "The mind that wants and the mind that judges are not the same system.",
  "The second one intercepts. A desire stated plainly is weighed, checked against everything already believed possible, and handed back diminished.",
  "A sigil is a desire that gets past it. The statement is written, then destroyed as language: letters stripped, the survivors fused into a single mark that carries the intent and no longer spells it. What cannot be read cannot be argued with. The mark is driven in while the judging mind is busy elsewhere, and then forgotten.",
  "Five stages. The method is old and the mechanism is plain.",
];

export function thresholdStage(ctx: AppContext): StagePanel {
  const node = h(
    "section",
    { class: "stage stage-threshold", "aria-labelledby": "stage-00-title" },
    h("p", { class: "stage-index", text: "00" }),
    h("h1", { id: "stage-00-title", class: "stage-title", text: "Threshold" }),
    prose(PREMISE, "prose prose-lead"),
    h(
      "p",
      { class: "footnote" },
      "Nothing typed into this page leaves the device it is typed on. No account, no server, no copy. ",
      "The statement is held in this browser until it is released, and then it is gone.",
    ),
    h(
      "div",
      { class: "stage-actions" },
      h("button", {
        class: "button button-primary",
        type: "button",
        text: "01 — State the Intent",
        onClick: () => ctx.goto(1),
      }),
    ),
  );

  return { node };
}
