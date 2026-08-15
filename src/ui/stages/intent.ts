/**
 * Stage 01 — State the Intent.
 *
 * The constraints are stated as law and never enforced. What is enforced is the
 * hard block: a statement no consonant survives cannot become a mark.
 */

import { h } from "../dom";
import type { AppContext, StagePanel } from "../context";
import { analyze } from "../../core/strip";

const LAWS = ["Present tense", "No negation", "One outcome", "Letters only"];

export function intentStage(ctx: AppContext): StagePanel {
  const draft = { value: ctx.session.statement };

  const error = h("p", { class: "field-error", role: "alert", hidden: true });

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const input = h("textarea", {
    class: "statement-input",
    id: "statement",
    rows: "1",
    spellcheck: "false",
    autocapitalize: "sentences",
    placeholder: "It is already so",
    "aria-label": "the statement",
    "aria-describedby": "statement-laws",
    onInput: (event: Event) => {
      const el = event.target as HTMLTextAreaElement;
      draft.value = el.value;
      error.hidden = true;
      grow(el);
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    },
  }) as HTMLTextAreaElement;
  input.value = ctx.session.statement;

  const submit = () => {
    const statement = draft.value.trim();
    if (!statement) {
      error.textContent = "Nothing to work with.";
      error.hidden = false;
      input.focus();
      return;
    }
    const analysis = analyze(statement);
    if (!analysis.letters.length) {
      error.textContent =
        analysis.status === "non-latin"
          ? "Outside the Latin alphabet. The gestures here do not reach that far."
          : "No consonants survive. There is nothing to build from.";
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
    { class: "screen", "aria-labelledby": "stage-01-title" },
    h("p", { class: "screen-index", text: "01" }),
    h("h1", { id: "stage-01-title", class: "screen-title", text: "State the Intent" }),

    h(
      "form",
      {
        onSubmit: (event: Event) => {
          event.preventDefault();
          submit();
        },
      },
      input,
      error,
      h(
        "ul",
        { class: "laws", id: "statement-laws" },
        ...LAWS.map((law) => h("li", { text: law })),
      ),
      h(
        "div",
        { class: "acts" },
        h("button", { class: "act act-primary", type: "submit", text: "Strip" }),
      ),
    ),

    h("p", {
      class: "aside",
      text: "Digits and marks do not survive the strip. Written as a number, five thousand a month leaves only the month.",
    }),

    h("p", { class: "whisper", text: "Nothing typed here leaves this device" }),
  );

  queueMicrotask(() => grow(input));

  return { node };
}
