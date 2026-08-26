# 01 · Executive Summary

**Status:** PROPOSED · targets labeled · `authority_delta:0`

## Strategic overview

BIZRA is building a truth-projection platform: Node0 (the sovereign runtime)
projects verified state into human-facing surfaces through a composition of
frozen, independently testable laws — transport (hash-chained SSE envelopes),
wire (realm contracts), projection (presence reducer), effects (FATE exactly-
once), and a diagnostic constitution that gates every derived conclusion
behind four rails.

The differentiator is **composition integrity**: components are proven, and
so are the joins between them, with named, non-cascading refusals that make
drift observable at birth rather than at incident.

## Business value proposition

1. **Audit-readiness by construction** — receipts, digests and forbidden-
   claim registries make SOC2/SOC-style evidence collection a byproduct of
   development, not a project.
2. **Cross-language longevity** — frame + transport laws are parity-proven
   JS↔Rust under shared digests (`ce180884…`, `6a4d352a…`); vendor or runtime
   migration does not invalidate the evidence chain.
3. **Operator sovereignty** — exact-string consent; no execution without GO;
   UNKNOWN rendered honestly (trust surface for regulated deployments).

## Technical approach summary

Two repositories, one discipline:

| Repo | HEAD (context-validated 2026-08-26) | Contents |
|---|---|---|
| Dema | `d5458e5`, GitHub CI all-green | Law kernels (JS), capability registry (~90 measured rows), review gates, qualification machinery |
| realm-shell | `f801be5`, local git | Rust boundary workspace: FSM/frame/admission/socket-spec/sse laws mirrored, O01–O10 conformance, A1–A20 qualification + PARITY gate |

Toolchain validated live: Node v22.22.2 · cargo/rustc 1.94.1 · zero runtime
dependencies in law crates beyond vetted libs (tokio, serde, sha2).

## Resource requirements

Baseline plan assumes 12 FTE × ~6 months for the enterprise platform phase.
Current reality: operator + AI agent fleet has already produced the law layer
(~90 capabilities, 9740 tests) at near-zero cash cost; scaling requires the
hiring phases in the Roadmap, sequenced so each hire lands into an existing
proof harness rather than greenfield chaos.

## Success criteria

- **Engineering:** DORA elite tier (lead <2d, daily deploys, CFR <10%, MTTR <30m) — TARGETS.
- **Product:** first external consumer of the presence projection on real hardware (HOST_BINDING_OK).
- **Compliance:** SOC2 Type II evidence automation running from Phase 0; WCAG 2.1 AA audit pass on any shipped UI.
- **Constitutional:** zero overclaim events (registry lint + no-overclaim gate stay green continuously).
