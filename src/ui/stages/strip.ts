/**
 * Stage 02 — Strip the Letters.
 *
 * Deterministic and watched, not operated. The before/after grid shows every
 * character of the statement with the reason it lived or died; the declared
 * decisions are stated as decisions, not offered as toggles.
 */

import { h, prefersReducedMotion, prose } from "../dom";
import type { AppContext, StagePanel } from "../context";
import type { Fate, StripResult } from "../../core/strip";
import { MAX_LETTERS } from "../../core/strip";

const FATE_LABEL: Record<Fate, string> = {
  kept: "kept",
  vowel: "vowel",
  repeat: "already seen",
  "over-cap": "past the cap",
  dropped: "not a letter",
};

const LEGEND: Fate[] = ["kept", "vowel", "repeat", "dropped"];

function note(analysis: StripResult): HTMLElement | null {
  switch (analysis.status) {
    case "sparse":
      return h(
        "div",
        { class: "note note-sparse" },
        h("h2", { class: "section-title", text: "A thin set" }),
        h("p", {
          text: `${analysis.letters.length} letter${
            analysis.letters.length === 1 ? "" : "s"
          } survived. Sparse letter-sets make weak marks: there is little for the gesture chain to fuse, and what comes out stays close to legible. The mark will be built anyway — this is the tradition's own judgement about it, not a verdict on the statement.`,
        }),
      );
    case "compound":
      return h(
        "div",
        { class: "note note-compound" },
        h("h2", { class: "section-title", text: "A compound intent" }),
        h("p", {
          text: `${analysis.full.length} letters survived and the first ${MAX_LETTERS} are kept. The statement is compound — the tradition would split this into separate workings rather than ask one mark to carry all of it.`,
        }),
      );
    default:
      return null;
  }
}

export function stripStage(ctx: AppContext): StagePanel {
  const { analysis } = ctx.derived;
  const still = prefersReducedMotion() || ctx.session.stillImage;

  const before = h(
    "p",
    { class: "letter-grid letter-grid-before", "aria-label": "the statement as typed" },
    ...analysis.tokens.map((token, i) =>
      h("span", {
        class: `cell cell-${token.fate}`,
        style: still ? undefined : `--i:${i}`,
        text: token.char === " " ? "·" : token.char,
        title: FATE_LABEL[token.fate],
      }),
    ),
  );

  const after = h(
    "p",
    { class: "letter-grid letter-grid-after", "aria-label": "the surviving letter set" },
    ...analysis.letters.map((letter, i) =>
      h("span", {
        class: "cell cell-kept",
        style: still ? undefined : `--i:${i}`,
        text: letter,
      }),
    ),
  );

  if (!still) after.classList.add("is-animated");

  const node = h(
    "section",
    { class: "stage", "aria-labelledby": "stage-02-title" },
    h("p", { class: "stage-index", text: "02" }),
    h("h1", { id: "stage-02-title", class: "stage-title", text: "Strip the Letters" }),
    prose([
      "Normalise, filter, dedupe — in that order, with no randomness anywhere in it. Accents fold to their base letters, vowels go, and each surviving consonant is kept once, at its first occurrence.",
    ]),

    h(
      "div",
      { class: "strip-panel" },
      h("h2", { class: "section-title", text: "As typed" }),
      before,
      h("h2", { class: "section-title", text: "What survives" }),
      after,
      h("p", {
        class: "letter-count",
        text: `${analysis.letters.length} letter${analysis.letters.length === 1 ? "" : "s"}`,
      }),
    ),

    h(
      "ul",
      { class: "legend" },
      ...LEGEND.map((fate) =>
        h(
          "li",
          {},
          h("span", { class: `swatch cell-${fate}`, "aria-hidden": "true" }),
          FATE_LABEL[fate],
        ),
      ),
    ),

    note(analysis),

    h(
      "div",
      { class: "decisions" },
      h("h2", { class: "section-title", text: "Declared decisions" }),
      h(
        "ul",
        {},
        h("li", { text: "Y is a consonant. It survives." }),
        h("li", {
          text: "Digits are dropped, not spelled out.",
        }),
        h("li", {
          text: "Non-Latin scripts are out of scope, and are reported rather than silently discarded.",
        }),
        h("li", {
          text: `At most ${MAX_LETTERS} letters, by first occurrence.`,
        }),
      ),
      analysis.droppedDigits
        ? h("p", { class: "footnote", text: "This statement contained digits. They were dropped." })
        : null,
    ),

    h(
      "div",
      { class: "stage-actions" },
      h("button", {
        class: "button button-primary",
        type: "button",
        text: "Compress it",
        onClick: () => ctx.goto(3),
      }),
      h("button", {
        class: "button button-quiet",
        type: "button",
        text: "Change the statement",
        onClick: () => ctx.goto(1),
      }),
    ),
  );

  return { node };
}
