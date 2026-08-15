/**
 * Deterministic hashing and pseudo-randomness.
 *
 * Everything downstream of a statement — the glyph, the audio initial
 * conditions — is derived from these two functions. Nothing here may ever
 * consult Math.random(): the same intent must produce the same sigil.
 */

/** FNV-1a, 32-bit. Stable across runtimes and versions. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32. Small, fast, adequate for gesture placement. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedHex(seed: number): string {
  return (seed >>> 0).toString(16).padStart(8, "0");
}
