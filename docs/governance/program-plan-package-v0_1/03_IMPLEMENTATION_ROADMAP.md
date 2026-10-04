# 03 · Implementation Roadmap

**Status:** PROPOSED · phases anchored to real HEADs; durations are TARGETS

## Phase ladder (each phase exits through the same gates: test·check·guidance·diff-check + CI)

### P0 — Law foundation ✅ COMPLETE (evidence: canon `d5458e5`)
Delivered: ~90 measured capabilities; transport/wire/projection/effects/join laws; registry with anti-overclaim fields; CI rail with fail-closed classifier.

### P1 — Boundary parity ✅ COMPLETE (evidence: realm-shell `f801be5`)
Delivered: Rust mirror of frame + transport laws under shared digests; FSM/admission/socket-spec units; O01–O10 + A1–A20 machinery; PARITY gate.

### P2 — Host binding (NEXT · blocked on environment, not engineering)
- Install omarchy/quickshell on target host → re-run `gen-binding` → gates flip UNAVAILABLE→PASS → HOST_BINDING_OK.
- IPC ops (ping/update_presence/hide_presence) measured live.
- Exit criteria: all ten O-gates PASS; A16–A19 flip PASS; receipt regenerated.
- Duration TARGET: 1–2 sessions (environment work, operator hands required).

### P3 — Live projection slice
- `dema-presence-service` binary consumes real Node0 feed over AF_UNIX (operator GO per launch).
- End-to-end: Node0 event → envelope → boundary → reducer → QML contract surface.
- Exit: golden mission_work rides live wire to VERIFIED_DONE with simulated markers intact.
- Duration TARGET: 2–3 sprints after P2.

### P4 — Enterprise platform hardening (12 FTE assumption)
- Per blueprint §5.2 phases 2–4: authn/z, billing domain, perf @2× load, DR rehearsal timed, SOC2 evidence automation.
- Duration TARGET: 10–12 weeks from staffed start.

### P5 — GA gate
- 30 consecutive days inside error budgets; runbook audit; support playbook.
- Sign-off: exec committee; authority stays with operator consent chains.

## Dependencies & critical path

ICD §87 acquisition (A20) ∥ host provisioning (A16–A19) → both feed P2 exit.
Critical path to first external value: **P2 → P3** (everything else parallelizes).

## Resource allocation reality check

| Phase | Staffing model | Feasibility note |
|---|---|---|
| P0–P1 | operator + AI fleet | DONE — validated this approach's velocity |
| P2 | operator (hardware) | no engineering risk |
| P3 | +1 Rust-capable engineer recommended | parity harness makes onboarding ≤2 days (laws are executable docs) |
| P4–P5 | blueprint's 12-FTE table applies | hiring gated on P3 success demo |

## Buffer management

One centrally-held buffer sprint per phase-group, released by explicit
architect decision; slippage >1 week triggers scope renegotiation, never
silent quality reduction (repo completion-ladder enforces honesty).
