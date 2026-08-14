/**
 * Stage 02 — strip the letters.
 *
 * Deterministic. No randomness. Order: normalize -> filter -> dedupe.
 * Declared decisions (stated in-app, not offered as toggles):
 *   - Y is a consonant.
 *   - Digits are dropped, not spelled out.
 *   - Non-Latin scripts are out of scope; detected and explained, not failed silently.
 */

export const VOWELS = "AEIOU";
export const MAX_LETTERS = 12;

/** The canonical reduction, exactly as specified. */
export const strip = (raw: string): string[] => {
  const norm = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // café -> cafe
    .toUpperCase()
    .replace(/[^A-Z]/g, ""); // digits, emoji, punctuation dropped
  const consonants = [...norm].filter((c) => !VOWELS.includes(c));
  return [...new Set(consonants)]; // Set preserves first occurrence
};

/** What happened to a single character of the raw statement. */
export type Fate =
  | "kept" // survives into the letter set
  | "vowel" // removed as a vowel
  | "repeat" // consonant already seen
  | "over-cap" // survived the filter but fell past the 12-letter cap
  | "dropped"; // digit, punctuation, emoji, whitespace, non-Latin

export interface Token {
  char: string; // as typed
  folded: string; // normalized form, "" when it folds to nothing
  fate: Fate;
}

export type StripStatus = "ok" | "sparse" | "compound" | "non-latin" | "empty";

export interface StripResult {
  raw: string;
  tokens: Token[];
  /** Consonants surviving normalize -> filter -> dedupe, before the cap. */
  full: string[];
  /** The working letter set: `full` capped at 12 by first occurrence. */
  letters: string[];
  status: StripStatus;
  droppedDigits: boolean;
  droppedNonLatin: boolean;
}

/** Fold one character the way `strip` folds the whole string. */
function fold(char: string): string {
  const n = char
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return n;
}

/**
 * The same reduction as `strip`, instrumented so stage 02 can show the
 * before/after grid: every raw character carries the reason it lived or died.
 */
export function analyze(raw: string): StripResult {
  const tokens: Token[] = [];
  const seen = new Set<string>();
  const full: string[] = [];
  let droppedDigits = false;
  let droppedNonLatin = false;

  for (const char of raw) {
    const folded = fold(char);
    if (folded === "") {
      if (/\d/.test(char)) droppedDigits = true;
      // A character that is a letter in some script but folds to no A-Z.
      if (/\p{L}/u.test(char)) droppedNonLatin = true;
      tokens.push({ char, folded, fate: "dropped" });
      continue;
    }
    // A fold can widen (ﬁ -> FI); the first letter carries the token's fate.
    const letter = folded[0]!;
    if (VOWELS.includes(letter)) {
      tokens.push({ char, folded, fate: "vowel" });
      continue;
    }
    if (seen.has(letter)) {
      tokens.push({ char, folded, fate: "repeat" });
      continue;
    }
    seen.add(letter);
    full.push(letter);
    tokens.push({
      char,
      folded,
      fate: full.length > MAX_LETTERS ? "over-cap" : "kept",
    });
  }

  const letters = full.slice(0, MAX_LETTERS);

  let status: StripStatus;
  if (letters.length === 0) {
    // The only hard block. Distinguish "wrong alphabet" from "no consonants".
    status = droppedNonLatin ? "non-latin" : "empty";
  } else if (full.length > MAX_LETTERS) {
    status = "compound";
  } else if (letters.length < 3) {
    status = "sparse";
  } else {
    status = "ok";
  }

  return { raw, tokens, full, letters, status, droppedDigits, droppedNonLatin };
}
