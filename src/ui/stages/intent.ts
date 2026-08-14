/**
 * Stage 01 — State the Intent.
 *
 * The constraints are stated as guidance and never enforced. Each one is
 * explained, because a rule whose reason is withheld gets followed badly.
 * The one thing that is enforced is the hard block: a statement no consonant
 * survives cannot become a mark.
 */

import { h, prose } from "../dom";
import type { AppContext, StagePanel } from "../context";
import { analyze } from "../../core/strip";

interface Rule {
  rule: string;
  why: string;
}

const RULES: Rule[] = [
  {
    rule: "Present tense.",
    why: "A statement in the future tense installs the future along with the outcome, and the outcome stays perpetually not-yet. Present tense leaves it nowhere to defer to.",
  },
  {
    rule: "No negation.",
    why: "A mark cannot carry a not. Strip the letters out of “I am not afraid” and what survives is indistinguishable from the fear. Name the condition wanted, not the one being left.",
  },
  {
    rule: "One outcome.",
    why: "A compound statement splits the sigil's attention-budget across outcomes, and the mark carries neither of them well. Two desires are two workings.",
  },
];

export function intentStage(ctx: AppContext): StagePanel {
  const draft = { value: ctx.session.statement };

  const error = h("p", { class: "field-error", role: "alert", hidden: true });

  const input = h("textarea", {
    class: "statement-input",
    id: "statement",
    rows: "3",
    spellcheck: "false",
    autocapitalize: "sentences",
    placeholder: "It is already the case that…",
    "aria-describedby": "statement-help",
    onInput: (event: Event) => {
      draft.value = (event.target as HTMLTextAreaElement).value;
      error.hidden = true;
    },
  }) as HTMLTextAreaElement;
  input.value = ctx.session.statement;

  const submit = () => {
    const statement = draft.value.trim();
    if (!statement) {
      error.textContent = "Nothing to work with yet.";
      error.hidden = false;
      input.focus();
      return;
    }
    const analysis = analyze(statement);
    if (!analysis.letters.length) {
      error.textContent =
        analysis.status === "non-latin"
          ? "Those letters fall outside the Latin alphabet, and the gesture library here is Latin-only. Restated in Latin script, this will work; otherwise this is the wrong tool for it."
          : "No consonants survived the strip. There is nothing here to build a mark from.";
      error.hidden = false;
      input.focus();
      return;
    }
    // A different statement is a different working: the seed and the charge
    // both belong to the old one.
    const changed = statement !== ctx.session.statement;
    ctx.update({
      statement,
      stage: 2,
      ...(changed ? { rerolls: 0, held: 0, chargedAt: null, compression: 0 } : {}),
    });
  };

  const node = h(
    "section",
    { class: "stage", "aria-labelledby": "stage-01-title" },
    h("p", { class: "stage-index", text: "01" }),
    h("h1", { id: "stage-01-title", class: "stage-title", text: "State the Intent" }),
    prose([
      "One statement, written the way desire is rarely written: as something already true. It will not be checked, corrected, or read by anything but the strip on the next stage.",
    ]),

    h(
      "form",
      {
        class: "statement-form",
        onSubmit: (event: Event) => {
          event.preventDefault();
          submit();
        },
      },
      h("label", { class: "field-label", for: "statement", text: "The statement" }),
      input,
      error,
      h(
        "div",
        { class: "stage-actions" },
        h("button", { class: "button button-primary", type: "submit", text: "Strip it" }),
      ),
    ),

    h(
      "div",
      { class: "guidance", id: "statement-help" },
      h("h2", { class: "section-title", text: "Form" }),
      h(
        "dl",
        { class: "rules" },
        ...RULES.flatMap((r) => [h("dt", { text: r.rule }), h("dd", { text: r.why })]),
      ),
      h("h2", { class: "section-title", text: "What the strip discards" }),
      prose([
        "The next stage keeps letters and nothing else. Digits, punctuation, spacing and any character outside the Latin alphabet are dropped without comment — “I earn 5000 a month” loses the 5000 entirely, and the mark gets built from R N M T H.",
        "Quantities and dates therefore have to survive as words if they are to survive at all.",
      ]),
    ),
  );

  return { node };
}
