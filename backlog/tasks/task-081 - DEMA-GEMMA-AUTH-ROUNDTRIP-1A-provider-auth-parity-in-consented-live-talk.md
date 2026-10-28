---
id: TASK-081
title: 'DEMA-GEMMA-AUTH-ROUNDTRIP-1A: provider-auth parity in consented live talk'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-10-10 03:32'
updated_date: '2026-10-10 03:47'
labels: []
dependencies: []
references:
  - packages/core/src/dema-talk-loop-live.js
  - tests/dema-talk-loop-live.test.js
documentation:
  - docs/06-adr/ADR-042-operator-bridge-threat-model.md
type: bug
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reproduce H1 using injected fetch and synthetic keys, repair optional provider-specific auth in the existing live-talk owner, and prepare one consent-gated Dema-to-Gemma call. Discovery, generation, useful performance, and Node0 closure remain separate evidence levels. Fresh human provider/model consent is required for real inference; no service transition or real DEMA_HOME mutation is authorized.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Synthetic llama.cpp and LM Studio requests use only their own optional bearer key; Ollama and keyless requests stay keyless.
- [ ] #2 Consent, localhost, allow-list, redirect refusal, HTTP failure, response validation, and credential non-disclosure controls pass with injected fetch.
- [x] #3 Focused tests and safe read-only gates have exact exit evidence; unrelated work and protected state are preserved.
- [x] #4 At most one real Dema Gemma call is independently observed after fresh exact human consent, without receipt persistence or real DEMA_HOME mutation.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rebind clean c8499b03 HEAD/tree, active mission, user service, listener, GPU, alias, and auth presence. 2. Record a bounded current-turn engineering lease and RED auth/credential-echo tests. 3. Repair the existing live-talk path and necessary callers only; retain safety and routing semantics. 4. Run focused tests, safe review gates, and read-only peer review. 5. Show the exact one-call preview and wait for fresh human consent; preserve failures and stop after this frontier.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
RED: live-talk tests exited 1 (27 pass, 8 fail), reproducing missing headers, CLI forwarding and credential echoes. Repair: injected env in the existing adapter; only talk CLI forwards operator env; provider-specific header and exact-key echo suppression added, no dependency or secret store. Final focused run: 103/103 exit 0 across eight files; six safe review gates exit 0. Peer review reran 87 checks exit 0. Required non-local override refusal remains FAIL: identical-method HEAD and candidate both discard the override and fetch localhost. Empty completions and body-read timeout remain separate existing gaps. Full npm test/check NOT_RUN under zero signer/key-operation lease because broad graphs include key generation/persistence/signing tests and gates. One live call remains pending fresh exact human router consent; first reply did not match, zero calls issued. Evidence: /data/bizra/campaigns/dema-gemma-auth-roundtrip-1a-20261010. No service restart, real-home mutation, push or merge.

LIVE: fresh exact human consent matched the router after one rejected typo. Exactly one existing dema talk call ran at 2026-10-10T03:45:04Z, returned READY, hello!, status completed, CLI exit 0, LOCAL_TALK_OK, suggestion-only. CLI duration 1.246s; adapter 1136ms. Unit main PID102202 and listener PID102205/start ticks unchanged; restart count0; before/after Dema-home and repository metadata identical with no scan errors; GPU memory11108MiB before/after. Unit journal task22 corroborates generation within the window, but no unique HTTP request ID or HTTP access-status line was logged. An extra observer access-line assertion failed (Python exit1; shell wrapper final0) and is preserved; supported observation checks then passed exit0 without promoting independent HTTP status beyond UNKNOWN. Non-local override refusal remains a pre-existing FAIL, so AC2 and overall task remain incomplete. One-call budget exhausted; no retry or next campaign. Retained live streams are sanitized; raw credential absence was not separately recorded. Full evidence and unsigned closeout are under the campaign root.
<!-- SECTION:NOTES:END -->
