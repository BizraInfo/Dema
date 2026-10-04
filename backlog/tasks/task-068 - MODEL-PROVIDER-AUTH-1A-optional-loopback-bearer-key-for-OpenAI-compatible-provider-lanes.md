---
id: TASK-068
title: >-
  MODEL-PROVIDER-AUTH-1A: optional loopback bearer key for OpenAI-compatible
  provider lanes
status: Done
assignee: []
created_date: '2026-08-15 15:38'
updated_date: '2026-08-15 15:38'
labels: []
dependencies: []
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Motivated by measured 2026-08-15 defect: the keyed Hermes Gemma4 backend on :8080 was DISCOVERED (keyless GET /v1/models) but 401-mute on every inference call, scoring 0/6 in the full-fleet baseline while listed as tested. Adds optional bearer-key support to the llamacpp and lm_studio lanes in apps/cli/src/commands/eval-baseline-gatherer.js, read from LLAMACPP_KEY / LMSTUDIO_KEY env. Additive; ollama and keyless lanes byte-identical.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 LLAMACPP_KEY/LMSTUDIO_KEY env attach Authorization: Bearer to that lane's list+generate calls
- [x] #2 No key set => no auth header anywhere (old behavior byte-identical)
- [x] #3 ollama lane never carries a key
- [x] #4 The key never appears in the returned report
- [x] #5 Focused tests green + docs/TESTING.md row added
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented 2026-08-15 pre-dawn session (7 surgical edits to eval-baseline-gatherer.js + tests/model-provider-auth.test.js 4 tests, injected fetch, zero network + docs/TESTING.md row). Verified this session: focused 4/4 green; full-suite isolation control (git archive HEAD + only night-slice files) shows ZERO new reds vs pure base (both 3 pre-existing: NCG-01/02, key-store); kernel-purity 0/493; git diff --check clean. Operationally proven by night-close run: gemma4-12b answered the canonical suite for the first time (was 0/6 401-mute).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added optional LLAMACPP_KEY/LMSTUDIO_KEY bearer support to llamacpp+lm_studio lanes; verified with node --test (4/4) and base-control isolation (no regressions); measured end-to-end in night-close (keyed lane answered).
<!-- SECTION:FINAL_SUMMARY:END -->
