# DEMA · Isnād Modern — Design System v0.1

Truth label: `DESIGN_CANON_DOCS_ONLY` — this is a **written design constitution**, not an
implementation. **DOCS-ONLY · NO RUNTIME.** No TUI or GUI is built or shipped here.

*Isnād* (إسناد) is the chain of transmission that authenticates a report: every claim carries the
line of witnesses that makes it trustworthy. **Isnād Modern** is that idea as an interface language —
a screen is a *proof object*, and its beauty is its provenance. A panel without evidence is
decoration; a panel with provenance is Dema.

---

## 0 · The seven laws (canonical doctrine markers)

These eight lines are the enforced spine of the canon. The review gate requires each verbatim.

1. **ZERO-EXTERNAL-REQUEST** — the interface makes no network call by default: no CDN, no font
   host, no analytics, no beacon. Every asset is inline or local. The only permitted probe is an
   explicit, opt-in, localhost-only model check (`127.0.0.1`), never automatic.
2. **GOLD ONLY WHERE PROOF EXISTS** — the gold accent is reserved for *verified* state. Unverified,
   simulated, or declared content never wears gold. Gold is earned, not decorative.
3. **EVERY NUMBER WEARS AN EVIDENCE CHIP** — no figure appears without a chip naming its class
   (`MEASURED` / `SIMULATED` / `AGENT` / `STATIC` / `BLOCKED`). A naked number is a bug.
4. **ARABIC IS FIRST-CLASS** — Arabic and English are co-equal. Language is chosen *before* identity;
   RTL is a first-class layout, not a mirror afterthought.
5. **CONSENT IS NEVER MYSTERIOUS** — consent gates are always legible: exact scope, exact phrase,
   plain outcome. Mystery may decorate the *path*, never the *gate*.
6. **ERRORS ARE NEVER MYSTERIOUS** — an error states what failed, which lens (inward/outward), and the
   one next action. No silent failure, no decorative fog over a fault.
7. **PROOF STATUS IS NEVER HIDDEN** — what is proven, what is not, and what is blocked are always on
   the surface. The UI admits what it cannot see.

Eighth, above all: **DOCS-ONLY · NO RUNTIME** — this canon governs how an interface *should* look and
behave; it implements none of it. No live runtime, no GUI/TUI implementation, no mint, no URP, no
federation is claimed by this document.

---

## 1 · Design philosophy — provenance as beauty

- **The screen is a proof object.** Aesthetic weight follows evidence weight. The most beautiful
  element on a screen should be the most proven one.
- **Gold only where proof exists.** Verified truth glows; everything else is quiet.
- **Mystery decorates the path, never the gate.** Ornament, geometry, and motion may make the journey
  feel like a house with ceremony — but consent, error, and proof states stay plainly legible.
- **The Daughter Test for pixels:** would the founder want Dema to inherit this surface? If a panel
  flatters without proof, it fails.

## 2 · Color doctrine

- **Gold (`proof-gold`)** — reserved for `MEASURED`/verified state only (law 2). Never used for
  chrome, hover, or decoration.
- **Ink / parchment** — the neutral ground (dark-first, with a light theme). Carries structure, not
  meaning.
- **Class hues** — each evidence class has one fixed hue: `SIMULATED` (muted blue), `AGENT` (violet),
  `STATIC` (slate), `BLOCKED` (amber-red). A number's chip color is a fact, not a mood.
- **Contrast floor** — all text meets WCAG AA (≥4.5:1 body, ≥3:1 large). Gold-on-ground is verified
  to clear AA before use.
- **Light + dark parity** — the same doctrine holds in both themes; gold stays the proof accent in
  each.

## 3 · Typography doctrine

- **Bilingual pairing** — one Latin family + one Arabic family chosen to share rhythm and weight;
  neither is a fallback for the other. **ARABIC IS FIRST-CLASS.**
- **Numerals wear chips** — figures use tabular numerals and always sit beside an evidence chip
  (law 3).
- **Hierarchy by structure** — size/weight encode structural depth, not emphasis-for-emphasis' sake.
- **No text in images** — text is real text (selectable, RTL-aware, screen-reader legible), never
  baked into a raster.

## 4 · Evidence-chip doctrine

Every datum carries a chip. The five classes and their contract:

| Chip | Meaning | May wear gold? |
| --- | --- | --- |
| `MEASURED` | inspected on disk / in output / re-derivable | **yes** |
| `SIMULATED` | sample / fixture / illustrative | no |
| `AGENT` | produced by an agent, pending verification | no |
| `STATIC` | declared constant / config | no |
| `BLOCKED` | gated: consent/permission/proof missing | no |

- A chip names the datum's *evidence class*, never a vibe.
- `BLOCKED` is a first-class, dignified state — it says *why* and *what unblocks it*, never a dead end.
- Hovering/expanding a chip reveals its isnād (the source path, hash, or command that backs it).

## 5 · Geometry doctrine

- **Geometry is structure, not decoration.** Islamic golden-age tessellation informs layout grids,
  the nuqta/phyllotaxis seed-avatar, and rhythm — but every geometric element maps to real structure
  (a boundary, a chain, a rung), never pure ornament.
- **The seed avatar** (nuqta + phyllotaxis) represents the node's identity; it is generated from the
  node's own fingerprint, not random art.

## 6 · Motion doctrine

- **Motion only for truth-events** — a state genuinely changing (a proof landing, a gate opening, a
  receipt sealing). No idle animation, no attention-farming motion.
- **Reduced-motion is honored absolutely** — `prefers-reduced-motion` disables all non-essential
  motion; truth-events degrade to an instant, legible state change.

## 7 · Accessibility

- WCAG AA contrast floor (§2); full keyboard operability; visible focus rings.
- RTL and LTR are both first-class; no direction is a second-class mirror.
- Screen-reader labels on every chip and gate; `BLOCKED`/error states are announced, not just colored.
- Reduced-motion and high-contrast preferences respected.

---

## What this design canon proves

That Dema has a **written, enforceable visual constitution**: a fixed doctrine (the seven laws) that a
review gate can check documents against — gold reserved for proof, every number chipped, Arabic
first-class, consent/error/proof states never hidden, zero external requests, motion only for
truth-events. It makes the design *falsifiable in prose* before any pixel is built.

## What this design canon does NOT prove

It implements **nothing**. **No live runtime, no GUI/TUI implementation, no mint, no URP, no
federation.** It does not render a screen, does not measure a real interface, and does not certify any
built UI as conformant — only a future implementation slice, with its own tests, can do that. This is
doctrine, not product.
