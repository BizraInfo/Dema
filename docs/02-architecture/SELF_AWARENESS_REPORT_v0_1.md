# Self-Awareness Report Kernel v0.1

- **Schema:** `bizra.dema.self_awareness_report.v0.1`
- **Live source of truth:** `packages/core/src/self-awareness-report.js` (a real, imported, tested kernel).
- **Status:** the third *live* framework kernel from the V2 audit's framework-maturity list (self-awareness was previously `DESIGNED_NOT_LIVE`).

## What it is — and what it is emphatically NOT

A deterministic kernel that computes the system's structured, **evidence-bound account of its own capabilities and blind spots**. It is "self-awareness" **only in the ZANN sense**: knowing what it can and cannot *prove* about itself.

It is **NOT** consciousness, **NOT** sentience, **NOT** subjective introspection, and it runs nothing. `claims_consciousness` is `false`, and `verifySelfAwarenessReport` fails closed (`consciousness_overclaim`) if that flag is ever flipped.

## Classification

Each declared capability becomes exactly one of:
- **EVIDENCED** — backed by ≥1 evidence anchor.
- **BLIND_SPOT** — *claimed but with no evidence anchor*. This is the point of the kernel: it surfaces what the system asserts about itself that it cannot back up, rather than hiding it.
- **NOT_KNOWN** — explicitly marked `known_unknown: true` (an honest known-unknown).

`self_knowledge_coverage = evidenced_count / declared_count` (shown ratio, bounded `[0,1]`). High coverage + low blind-spot count = honest self-knowledge; a pile of `BLIND_SPOT`s is exactly the un-self-aware overclaim the discipline rejects.

## API

- `buildSelfAwarenessReport({ capabilities, namespace })` → frozen, content-addressed report (`report_hash`, per-capability `capability_hash`).
- `normalizeSelfCapability(capability, index)` → classified capability or a fail-closed reason.
- `verifySelfAwarenessReport(report)` → `{ valid, blocked_by }`: recomputes hashes, reconciles counts + coverage, and rejects schema/boundary/consciousness tampering.

## Fail-closed

Malformed capability, missing `name`/`claim`, duplicate id, empty input, invalid status, count/coverage mismatch, capability/report hash mismatch, non-false boundary, and consciousness overclaim — every negative verdict carries a `reason_code`. Deterministic, deep-frozen, pure (no fs/network/clock/random/model/execution).

## Boundary — what this is not

`boundary` is entirely `false`: no runtime, no introspection runtime, no model call, no network, no self-modification, no signing/key/mint, no PoI/MCP/A2A/federation. The kernel reads caller-supplied capability claims + evidence anchors and returns a frozen verdict — nothing else. It does not verify that the cited evidence is itself true.
