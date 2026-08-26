# 02 · Technical Architecture Document

**Status:** PROPOSED · condensed to verifiable architecture; full prose in `BIZRA_ENTERPRISE_DELIVERY_BLUEPRINT_v0_1.md` (ancestor `d0ecaa7`)

## 1. System decomposition (implemented vs designed)

| Layer | Component | State | Evidence anchor |
|---|---|---|---|
| Transport | SSE envelope stream (hash-chain, seq-from-1, one terminal) | **MEASURED** | `567fb49`, 19 tests + negative controls |
| Wire | Realm contracts IF-01 (admission/sequence/digest/freshness) | **MEASURED** | 47 tests mirroring ICD C01–C20 |
| Projection | Presence reducer v2 (11 states, no-stale-success) | **MEASURED** | 15 tests incl. golden G-02 |
| Composition | SSE→frame→wire→reducer join | **MEASURED** | 10 join tests; layer-tagged refusals |
| Effects | FATE staged effect (exactly-once, crash windows) | **MEASURED** | 14 tests, injected-fs fault injection |
| Boundary | Rust mirror: frame+transport laws, FSM, admission, socket spec | **MEASURED (parity)** | digests `ce180884…` / `6a4d352a…` / stream `8538512d…` |
| Qualification | O01–O10 conformance + A1–A20 campaign + receipt binding | **MEASURED machinery** | receipt sha `92442244…`; overall UNKNOWN (honest) |
| Host binding | quickshell/omarchy live integration | **PENDING (operator GO)** | HOST_BINDING_PENDING by law |

## 2. Data flow (persistent connection articulation)

```
Node0 truth ──► envelope builder ──► SSE wire ──► Rust boundary (AF_UNIX,
             (hash-chained events)   text/articulation  SO_PEERCRED uid1000)
                                     data: <envelope>)      │
                                                            ▼
                              frame length-law → payload UTF-8/JSON law
                                                            │
                                                            ▼
                              realm admission → presence reducer → render
```

Refusals are **per-event, named, and never cascaded** (`event_N:event_hash_mismatch` semantics — codified by operator ruling "JS is law", 2026-08-26).

## 3. Technology specifications (validated versions)

| Tool | Version | Role |
|---|---|---|
| Node.js | v22.22.2 | law kernels, CLI, CI |
| Rust/cargo | 1.94.1 | boundary service workspace (4 crates) |
| GitHub Actions | 5 workflows | check · review-gate(30m) · CodeQL(30m) · gitleaks · rail-aggregation |
| Backlog.md CLI | active | task governance (CLI-only mutation) |

Forward stack (targets, per blueprint §1.2): PostgreSQL 16 · Redis 7 · NATS JetStream · React 19/Vite · Fastify · Go core services.

## 4. Integration patterns

- Anti-corruption layers at every third-party edge; vendor DTOs never cross.
- Strangler-fig for legacy; dual-write with reconciliation before cutover.
- Webhooks: HMAC + timestamp window; outbound circuit breakers (fail-open reads / fail-closed writes).

## 5. Security framework

- Exact-string consent (no ambient authority); deny-by-default ABAC/RBAC plan.
- SO_PEERCRED uid-binding at the Unix socket; root explicitly refused (test-pinned).
- Supply chain: SLSA-3 target — cosign signatures, SBOM per artifact, provenance at admission.
- Secrets: zero-in-git enforced (gitleaks green in every sweep tonight).
- Compliance mapping: GDPR erasure via crypto-shredding+tombstone hash; SOC2 immutable audit logs; HIPAA module behind flag (BAAs required).

## 6. Scalability approach

Stateless services; HPA on p95 + queue depth; read replicas; single-flight cache coalescing; cursor pagination only; bounded queues pinned by law (EVENT=128, RENDER=16) so backpressure is contractual, not emergent.

## 7. Known architectural ceilings (measured honestly)

- Chain layer owns non-object payloads before frame decode can run (join ceiling, documented in receipt).
- No independent external anchor yet: forged bodies with recomputed transport hashes pass — launder-resistance requires a future signer.
- ICD §87 A-gate source text unavailable; qualification holds UNKNOWN rather than guessing.
