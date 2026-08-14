# Sigil Craft

An interactive manual for the classical four-stage sigil method, built so that the
interface performs the mechanism it describes: the compression happens live, on the
reader's own words, rather than being explained.

The interface is deliberately spare. One thing per screen, a numeral for a stage,
and constraints stated as law rather than argued. Anything that reads as
documentation belongs in this file, not in the app.

Client-only. No backend, no account, no request carrying a statement anywhere. The
session lives in `localStorage` until stage 05 destroys it.

```
npm install
npm run dev        # vite dev server
npm run typecheck  # app and worker are separate programs
npm run build      # -> dist/
npm run start      # wrangler dev, serving dist through the worker
npm run deploy
```

## The five stages

| Stage | What happens |
|---|---|
| 00 Threshold | The premise, stated and not argued |
| 01 State the Intent | One statement, with the constraints stated rather than enforced |
| 02 Strip the Letters | `normalize -> filter -> dedupe`, deterministic, shown character by character |
| 03 Compress the Glyph | Gesture library, chained and fragmented, then annealed |
| 04 Charge | A seed-derived audio field and a breath-rate visual pulse, held |
| 05 Release | Hold to destroy the mark, the statement and the session |

## Where the work is

**`src/core/`** — the deterministic half.

- `strip.ts` holds the canonical reduction and an instrumented version of it that
  records why each character lived or died. Y is a consonant, digits are dropped
  rather than spelled out, non-Latin scripts are reported rather than silently
  discarded, and the letter set is capped at twelve by first occurrence.
- `gestures.ts` is one stroke per consonant, in unit space, with an entry and an
  exit. Letters that are conventionally multi-stroke retrace instead of lifting so
  the chain stays continuous.
- `compose.ts` chains the gestures (entry of *k* onto exit of *k−1*), draws only
  35–70% of each, and then hill-climbs the rotation/scale vector against a score
  that wants even coverage, centred mass, a mark that reaches the seal circle
  without breaching it, and about three self-intersections. The crossing term is
  load-bearing: a mark reads as one object largely because it crosses itself.
- `svg.ts` renders the live glyph and serialises the exported one. The live mark is
  revealed by `stroke-dashoffset` against a declared `pathLength`, which is exact
  for a polyline — but see the note on the charge ring below before reaching for
  the same trick on a `<circle>`.
- The seed is `hash(letterSet.join(''))`, so the same statement always produces the
  same mark. Reroll increments the seed visibly and says by how much.

**`src/audio/`** — the charge field. The letter set sets the initial conditions of a
deterministic chaotic system, and the sound is that system's trajectory: fully
determined by the statement, unreadable from it, never repeating.

- `chaos.ts` — a slow Lorenz (structure), a faster Rössler (texture), and a logistic
  map (discrete events). All three clamp hard before they reach an AudioParam.
- `fdn-processor.js` — the substrate, a four-line Hadamard-mixed feedback delay
  network. It runs in an AudioWorklet for a specific reason, documented in the file:
  Web Audio inserts a render quantum of latency into feedback cycles and does not
  insert the same amount into every path, which costs an orthonormal mixing matrix
  the contraction property it is chosen for. Built out of nodes, a 0.96 loop grows
  by a factor of about 35 per second in Chrome. There is a node-graph fallback for
  runtimes without AudioWorklet; it runs at a much lower loop gain and a
  correspondingly shorter tail.
- `engine.ts` — substrate, spine (a cross-modulated FM pair, run twice so the
  entrainment beat lives inside the timbre rather than beside it), and weather.
- `methods.ts` — the four methods are the same system at four points on its own
  bifurcation diagram. ρ is the real control parameter, so *Inhibitory* does not
  imitate settling: it passes below the chaotic threshold partway through the hold
  and stops being chaotic.

## Safety machinery

Two things in stage 04 are constraints rather than design, and should not be
"simplified" without re-deriving them:

- **The pulse is luminance breathing, never flashing.** Its rate is clamped to
  0.25–1 Hz at the output — the attractor is never clamped, the signal derived from
  it is — and the per-frame phase step is capped so a stalled main thread slows the
  breathing rather than jumping it. Opacity moves between 0.55 and 1.0 on the glyph
  stroke only: no background change, no colour inversion, no hard edges.
- **The palette is load-bearing.** At opacity 0.55, `#e4dfd4` over `#08080a` is
  4.96:1. Moving either colour means re-checking that the dimmest pulse state still
  clears 4.5:1.

The pre-charge panel (motion toggle, volume, headphone note) must be on screen once
before the hold control goes live. It asks for presence, not acknowledgement — no
modal, no checkbox wall. It is the one part of the interface allowed to be plainer
than the rest, and it does not get trimmed for tone.

## Two places the browser disagrees with the obvious approach

Both are load-bearing and both look like needless complication until they are
changed back:

- **The FDN cannot be a graph of nodes.** See `fdn-processor.js`.
- **The depleting ring is a generated arc, not a dashed circle.** Chrome measures a
  `<circle>` several percent shorter than it renders it, so both `pathLength`
  normalisation and `getTotalLength()` leave a visible gap in the ring at full
  charge. `arcPath()` in `charge.ts` describes the arc directly and owes the
  renderer nothing.

## Deliberate non-features

- **Stage 00 does not explain itself.** The reticence is functional: the whole method
  routes around the believing mind, and a threshold that argued for it would activate
  exactly the faculty being routed around. A high drop-off there is the intended
  behaviour of a threshold.
- **No moderation, filtering, or analysis of statement content.** The tool does not
  read what it processes.
- **Reroll and the compression slider both withdraw once the mark is charged.** A
  charged mark is the mark; scrubbing it afterwards is the conscious fiddling the
  method exists to stop.
- **The declared decisions in stage 02 are stated, not offered as toggles.**
- **No explanation of the method anywhere in the app.** Not on the threshold, not
  beside the strip, not under the glyph. The reasoning lives here.

## Deployment

`wrangler.jsonc` serves `dist/` through a worker that exists only to make it explicit
that `/api/*` is not a thing here. Response headers, including the CSP, live in
`public/_headers`.
