/**
 * Glyph rendering and export.
 *
 * The live glyph is an SVG built here and mutated in place by the compression
 * slider and the charge pulse. The exported file is a separate, static
 * serialisation: no animation, no partial compression.
 */

import { PATH_LENGTH, SEAL_RADIUS, type Composition } from "./compose";
import { seedHex } from "./rng";

const NS = "http://www.w3.org/2000/svg";
const VIEW_BOX = "-1.1 -1.1 2.2 2.2";

export interface GlyphView {
  svg: SVGSVGElement;
  mark: SVGPathElement;
  seal: SVGCircleElement;
  /** 0 = nothing drawn, 1 = the sealed mark. */
  setCompression(t: number): void;
}

/** The live glyph: a single stroke revealed by arc length, plus its seal. */
export function createGlyphView(comp: Composition): GlyphView {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", VIEW_BOX);
  svg.setAttribute("class", "glyph");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Sigil derived from the letters ${comp.letters.join(" ")}`);

  const seal = document.createElementNS(NS, "circle");
  seal.setAttribute("class", "glyph-seal");
  seal.setAttribute("cx", "0");
  seal.setAttribute("cy", "0");
  seal.setAttribute("r", String(SEAL_RADIUS));

  const mark = document.createElementNS(NS, "path");
  mark.setAttribute("class", "glyph-mark");
  mark.setAttribute("d", comp.d);
  mark.setAttribute("pathLength", String(PATH_LENGTH));
  mark.setAttribute("stroke-dasharray", String(PATH_LENGTH));

  svg.append(seal, mark);

  const setCompression = (t: number) => {
    const clamped = Math.min(1, Math.max(0, t));
    mark.setAttribute("stroke-dashoffset", String(PATH_LENGTH * (1 - clamped)));
    // The seal arrives last, once the mark is essentially whole.
    const sealOpacity = clamped <= 0.9 ? 0 : (clamped - 0.9) / 0.1;
    seal.setAttribute("opacity", sealOpacity.toFixed(3));
  };

  setCompression(0);
  return { svg, mark, seal, setCompression };
}

/** How many of the letters' fragments have been drawn at compression `t`. */
export function fusedStrokes(comp: Composition, t: number): number {
  return comp.segments.filter((s) => s.end <= t + 1e-6).length;
}

export function compressionValueText(comp: Composition, t: number): string {
  const pct = Math.round(t * 100);
  return `compression ${pct} percent — ${spell(fusedStrokes(comp, t))} of ${spell(
    comp.segments.length,
  )} strokes fused.`;
}

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
const spell = (n: number) => WORDS[n] ?? String(n);

function escapeForComment(text: string): string {
  // "--" terminates an XML comment early; nothing else can break out of one.
  return text.replace(/--+/g, (m) => m.split("").join(" "));
}

/**
 * The exported mark: full compression regardless of slider position, no pulse,
 * no dash offset. The statement rides along in an XML comment — nowhere
 * visible, recoverable by anyone who opens the file in a text editor, which is
 * a fair mirror of how a physical sigil works.
 */
export function serializeSigil(comp: Composition, statement: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Sigil ${seedHex(comp.seed)}
  letters: ${comp.letters.join(" ")}
  statement: ${escapeForComment(statement)}
-->
<svg xmlns="${NS}" viewBox="${VIEW_BOX}" width="1024" height="1024">
  <rect x="-1.1" y="-1.1" width="2.2" height="2.2" fill="#0b0b0d"/>
  <g fill="none" stroke="#e8e4dc" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="0" cy="0" r="${SEAL_RADIUS}" stroke-width="0.006" opacity="0.55"/>
    <path d="${comp.d}" stroke-width="0.022"/>
  </g>
</svg>
`;
}

export function downloadSigil(comp: Composition, statement: string): void {
  const blob = new Blob([serializeSigil(comp, statement)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sigil-${seedHex(comp.seed)}.svg`;
  document.body.append(a);
  a.click();
  a.remove();
  // Revoke on the next turn; Safari needs the URL to survive the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
