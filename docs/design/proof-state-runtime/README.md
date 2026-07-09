# Proof-state runtime — design surfaces

Status: **PREVIEW_ONLY / DESIGNED_NOT_LIVE**. These are design-console mockups
and motion source, not runtime. Nothing here is `MEASURED`; no file here proves
a live capability. The runtime lives in `packages/`, `apps/`; the honesty map is
`docs/CURRENT_LIMITS.md`.

Integrated 2026-07-09 from the operator's `BIZRA proof-state runtime/`
design-export bundle (authored 2026-07-08). **Selective**: only the text/design
source was committed; heavy binaries and the archive were left out of git
history (manifest below).

## Design law

`DESIGN_LAW_GIANTS_BENCHMARK_1A.md` — the binding design canon for this project
(`GIANTS-BENCHMARK-BIZRA-BOUNDARY-1A`, 2026-07-05). Renamed from the bundle's
`CLAUDE.md` so Claude Code never loads it as operator instructions; it is design
doctrine, not repo canon.

## What's here (committed, ~2.7 MB)

- `*.dc.html` — design-console surfaces: Delivery Forge, Dema Console, Legend
  Paper, Manifestation, Mission Terminal, Node0, Realm, Runtime Console, Dema
  Bond, Dema Pulse, Dema TUI.
- `*.html` — rendered surfaces (e.g. `BIZRA Delivery Forge.html`).
- `animations.jsx`, `one-pulse.jsx` — motion source.
- `support.js`, `doc-page.js`, `export/` — supporting scripts + export source.
- `uploads/*.html` — Master Brand System, brand identity, pulse, sovereign
  showcase, Dema Brand Film.
- `legend-paper-raw.txt` — raw Legend Paper text. Dedup note: the Legend Paper
  is already in-tree as prose under `docs/paper/BIZRA_LEGEND_*` and
  `docs/receipts/BIZRA_LEGEND_PAPER_EVIDENCE_HARDENING_1A.md`. This is the
  design form, kept as complementary source, not a re-canonization.

## Excluded from git (kept local only)

Left out to avoid ~42 MB of permanent history bloat. They remain in the
operator's local bundle at repo root (gitignored):

- `BIZRA proof-state runtime.zip` — 20 MB duplicate archive of the whole bundle.
  `sha256 a1091d893d3f4ecb139a27fea5e10286b100424450204287460367b302a7c7dc`
- `uploads/*.png` — 15 screenshots, ~15 MB.
- `uploads/2603.14724v1.pdf` — 6.1 MB arXiv paper (reference by arXiv id, not a
  repo asset).
- `uploads/BIZRA_Legend_Paper_v0_1.pdf` — 210 KB; the tracked prose above is the
  canonical form.
- `.thumbnail` — bundle preview thumbnail.

If any excluded screenshot is later needed as bound evidence, add it explicitly
with a claim binding — not in bulk.
