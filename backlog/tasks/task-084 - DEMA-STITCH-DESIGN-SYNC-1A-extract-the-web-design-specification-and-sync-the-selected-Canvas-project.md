---
id: TASK-084
title: >-
  BIZRA-STITCH-DESIGN-SYNC-1A: extract the public-site design specification and
  sync the selected Canvas project
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-15 04:04'
updated_date: '2026-10-15 11:08'
labels: []
dependencies: []
references:
  - packages/bizra-site/src/app/page.tsx
  - packages/bizra-site/src/app/layout.tsx
  - packages/bizra-site/src/components/bizra/habitat-brand.tsx
  - docs/brand/BIZRA_VISUAL_TOKENS.json
  - docs/CLAIM_REGISTER_v0_1.md
type: docs
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extract packages/bizra-site styles and the canonical BIZRA brand tokens into root DESIGN.md, following the human-selected BIZRA public-site scope. Preserve source gaps, public claim boundaries and unrelated user changes. Synchronize only to the human-selected Stitch Canvas project after CLI authentication is available.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 DESIGN.md describes materiality, exact palette values, typography, components, layout and generation rules with source references and explicit observed-versus-proposed distinctions.
- [x] #2 The installed Stitch CLI accepts the local design document in a dry run and local validation results are recorded.
- [ ] #3 The human-selected Stitch project has the uploaded design system and a successful CLI readback verifies it; otherwise record the specific authentication or selection blocker without claiming sync.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Current local continuation: preserve existing DESIGN.md and protected source; build one source-bound interactive first-screen review artifact under .artifacts/prototypes using README atlas, actual journey data and existing design tokens; omit unverified install destinations and live claims; render and inspect desktop/mobile, exercise keyboard/pointer and reduced-motion behavior, and record source hashes/limits. This is a proposed local layout, not a capture of the incomplete public app or a published screen. Canvas sync remains blocked by MISSING_CREDENTIALS and no selected project.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Human selected BIZRA public site during source research, before DESIGN.md was written. The Dema UI is no longer the extraction target. Initial Stitch status: MISSING_CREDENTIALS, NEEDS_MANIFEST, no linked Canvas project.

Human confirmed there is no specific existing Canvas project. No binding target is selected. Public-site source is partial: layout imports absent globals.css; package manifest, public font binaries, and several page imports are absent from this checkout. Extraction will bind available components, label missing font/theme evidence, and distinguish the public material palette from canonical core brand tokens. No cloud sync is currently possible because CLI credentials are missing.

Primary-source review confirmed the Stitch generation skill requires project-level style tokens rather than repeated theme instructions in generation prompts. RED self-check on the first local DESIGN.md found theme leakage in all three examples. Official design.md specification makes YAML optional; lack of YAML is not a syntax defect, but this slice requires explicit parsable tokens so contrast checks are meaningful. No production code repair selected; scope remains BIZRA public-site design.

Local design slice verified: DESIGN.md SHA-256 669ca023e4782be425e14df2064506c939d3274e163d4170f1ac5e9e45914e8e. Official @google/design.md@0.4.0 lint: 0 errors, 0 warnings, nonzero token/component coverage (6 colors, 6 typography roles, 2 radii, 5 spacings, 5 components). RED preimage: no machine tokens and all three generation examples leaked theme. Broken-reference and low-contrast controls are detected; reverse patch restores the preimage and reapplication restores the candidate; fresh-copy lint passes. All 37 document hex values bind to public-site or core brand sources. Stitch dry run passes. Final npm test: 10,284 total, 10,280 pass, 4 skip, 0 fail, exit 0. Sampled existing safety suites: 73 and 117 pass. Baseline npm run check exits 1 at gate 147: native branch coverage displays 84.00% but fails the 84% floor. Final-byte aggregate still running; no global GREEN claim. The 40 existing changed/untracked files and tracked diff match session preimages. Evidence packet: .artifacts/audits/bizra-design-contract-20261015. AC3 remains unchecked: missing Stitch credentials and no selected project; task stays In Progress.

FINAL UPDATE: the final-byte npm run check exited 0, including native coverage and terminal per-gate start/complete evidence. Preserve the earlier baseline exit 1: both print 95.40% lines / 84.00% branches / 97.57% functions, but two printed branch rows differ (node0-runtime-mission-proof.mjs 41.03 to 42.50; c4d-tail-resume-child.mjs 61.11 to 64.71). Application source bytes are unchanged; root cause and exact unrounded coverage are UNKNOWN. This is one passing aggregate run, not a coverage repair or stable TASK-075.24 closure. Full before/final logs and coverage-comparison.json are retained in the evidence packet. Local design acceptance is satisfied; Canvas sync and overall TASK-084 remain blocked/In Progress.

Source-context revision complete: DESIGN.md SHA-256 54fb36776807f54f9bbbdfea0aea063d0c6f22b9d839a4b4d33a0ac919ebc3a4. Added verbatim README purpose/copy, critical source-owner map, journey/consent/receipt structure and page goals; inherited tokens and color/typography sections unchanged. Ten README strings match, 19 source links resolve, 3 prompts remain theme-free; design lint 0 errors/0 warnings; Stitch dry run, guidance, claim corpus (130 inherited/0 new), diff check and reverse/forward scratch recovery pass. npm test: 10,284 total, 10,280 pass, 4 skip, 0 fail. Initial aggregate refused agent-supplied DEMA_HOME; corrected environment then npm run check failed at gate 146: 10,399 total, 10,394 pass, 4 skip, 1 asset-scan CLI preview failure (tests/homebase-asset-awareness-cli.test.js:39); focused recheck passes, cause UNKNOWN, downstream gates NOT_RUN. No allowlist or source repair. Forty unrelated changed files and prior sealed packet anchors unchanged. New unsigned engineering evidence: .artifacts/audits/bizra-design-context-20261015. Previous sealed packet remains historical and untouched. AC3 stays unchecked/In Progress: MISSING_CREDENTIALS and no selected Canvas project; no cloud sync or public-site render claimed.

Local first-screen continuation: created .artifacts/prototypes/bizra-first-screen-20261015/index.html (11,154 bytes), a proposed interactive layout using existing DESIGN.md, README atlas/product copy and exact journey-builder data. Four preview tabs inspect First launch, Mission and consent, Node0 handoff, Receipts and impact; no execution or consent grant. Static checks pass; Node DOM-fixture logic checks pass for 4 states, arrow wrapping, Home/End, ordinary Tab preservation and restoration; 2 deliberately broken variants are rejected. These are logic-only tests, not native browser input or visual proof. Stitch static file normalization passes and produces stitch-screen.html with fixed 1280 viewport, while index.html keeps responsive viewport. Browser review rejected file navigation under its HTTP(S)-only URL policy; no alternate browser, raw CDP, server/proxy or indirect navigation was attempted. Desktop/mobile visual, layout, font and real keyboard/touch verification remain NOT_RUN. Existing DESIGN lint freshly passes offline (0 errors/0 warnings), bytes unchanged. npm test exits 0: 10,288 / 10,284 pass / 4 skip / 0 fail. Fresh npm run check exits 1 at gate139: CLI status-path timing 157.134ms exceeds local150ms budget; source gate uses median3 samples after warmup, cause UNKNOWN. No threshold/env manipulation or retry for green. Downstream aggregate gates, including coverage, NOT_RUN. Guidance, corpus (130 inherited /0 new), diff-check pass. All protected source and tracked diff preserved; task remains In Progress, cloud AC3 unchecked because MISSING_CREDENTIALS and no selected Canvas. This artifact is not a capture of the incomplete public app, a complete public launch page, an installed product change, or a cloud sync. No runtime/provider/model/service/signer/economic/publication action issued.
<!-- SECTION:NOTES:END -->
