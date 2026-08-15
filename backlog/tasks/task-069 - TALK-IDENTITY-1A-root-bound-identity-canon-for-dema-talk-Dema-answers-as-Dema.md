---
id: TASK-069
title: >-
  TALK-IDENTITY-1A: root-bound identity canon for dema talk (Dema answers as
  Dema)
status: Done
assignee: []
created_date: '2026-08-15 16:14'
updated_date: '2026-08-15 16:21'
labels: []
dependencies: []
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator GO 2026-08-15: build the identity bridge, roots-first — the five founding PDFs at /data/bizra/contracts/roots are the only source of truth. Mirrors the proven DEMA-FIRST-LESSON-CANON-1A shape: pure kernel (identity text distilled from a full 106-page read of all five roots, content-bound to their exact sha256 pins — any drift refuses identity), thin read-only gatherer, opt-in talk wiring (--as-dema flag or DEMA_TALK_IDENTITY=1 env; default behavior byte-identical). Fail-closed: drifted or missing roots never speak as Dema.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Kernel builds identity canon only when all five root hashes match pins; any drift => rejected with root_drift naming the file
- [x] #2 Identity prompt contains canonical anchors (DEMA bridge definition, canonical voice, never-impersonate-consent boundary) and boundary block is all-false
- [x] #3 verify* re-derivation path refuses tampered canon (relaunder + hash forgery cases)
- [x] #4 talk without the flag/env is byte-identical to before (additive); with it, live path composes identity and prints its hash
- [x] #5 Focused tests green red-first + kernel purity clean + docs/TESTING.md row
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Red-first (module-absent fail observed) -> 8/8 green. Talk suite 74/74 (66 pre-existing talk tests, zero regressions). Kernel purity 0/494. Default-path negative control: talk preview byte-identical to pre-change HEAD extraction (diff clean). Fail-closed proven live: missing roots dir refused naming the file; ONE appended byte to themassage.pdf refused with root_drift:themassage.pdf. Live smoke (sandbox ollama llama3.1:8b, throwaway DEMA_HOME, --as-dema): model answered AS DEMA — 'I am Dema, the face and door of BIZRA... a bridge between intention, understanding, and action' — identity hash 14795773 printed, suggestion-only label held. Corpus gate new=0; git diff --check clean; full suite 9430 tests, red-set byte-identical to pre-slice (19 classified other-streams/env reds, zero from this slice). Identity text distilled from full 106-page read of all five roots this session; pins = sha256 measured against the durable copies.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Root-bound identity canon shipped: kernel + gatherer + opt-in talk wiring, mirroring first-lesson-canon shape. Drift refuses identity; default talk untouched; live smoke answered as Dema.
<!-- SECTION:FINAL_SUMMARY:END -->
