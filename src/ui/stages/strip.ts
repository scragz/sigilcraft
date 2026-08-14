/**
 * Stage 02 — Strip the Letters.
 *
 * Deterministic, and watched rather than operated. The statement as typed sits
 * above the rule; what survives sits below it. The declared decisions are
 * stated as law and are not offered as toggles.
 */

import { h, prefersReducedMotion } from "../dom";
import type { AppContext, StagePanel } from "../context";
import type { StripResult } from "../../core/strip";
import { MAX_LETTERS } from "../../core/strip";

const LAWS = ["Y is a consonant", "Digits do not survive", `${MAX_LETTERS} at most`];

/** Tradition-internal judgement, not validation. */
function verdict(analysis: StripResult): string | null {
  if (analysis.status === "sparse") return "A thin set. Sparse letters make a weak mark.";
  if (analysis.status === "compound")
    return "Compound. The tradition would divide this into separate workings.";
  return null;
}

export function stripStage(ctx: AppContext): StagePanel {
  const { analysis } = ctx.derived;
  const still = prefersReducedMotion() || ctx.session.stillImage;
  const line = verdict(analysis);

  const before = h(
    "p",
    { class: "letter-grid letter-grid-before", "aria-label": "the statement as typed" },
    ...analysis.tokens.map((token) =>
      h("span", {
        class: `cell cell-${token.fate}`,
        text: token.char === " " ? " " : token.char,
      }),
    ),
  );

  const after = h(
    "p",
    {
      class: `letter-grid letter-grid-after${still ? "" : " is-animated"}`,
      "aria-label": "the surviving letters",
    },
    ...analysis.letters.map((letter, i) =>
      h("span", {
        class: "cell",
        style: still ? undefined : `--i:${i}`,
        text: letter,
      }),
    ),
  );

  const node = h(
    "section",
    { class: "stage", "aria-labelledby": "stage-02-title" },
    h("p", { class: "stage-index", text: "02" }),
    h("h1", { id: "stage-02-title", class: "stage-title", text: "Strip the Letters" }),

    before,
    h("div", { class: "strip-rule", "aria-hidden": "true" }),
    after,
    h("p", {
      class: "letter-count",
      text: `${analysis.letters.length} letter${analysis.letters.length === 1 ? "" : "s"}`,
    }),

    line ? h("p", { class: "aside", text: line }) : null,

    h("ul", { class: "laws" }, ...LAWS.map((law) => h("li", { text: law }))),

    h(
      "div",
      { class: "acts" },
      h("button", {
        class: "act act-primary",
        type: "button",
        text: "Compress",
        onClick: () => ctx.goto(3),
      }),
      h("button", {
        class: "act",
        type: "button",
        text: "Restate",
        onClick: () => ctx.goto(1),
      }),
    ),
  );

  return { node };
}
