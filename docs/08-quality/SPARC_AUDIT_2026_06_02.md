# SPARC Multi-Lens Audit — BIZRA Genesis Node / Dema

- **Date:** 2026-06-02 (GST)
- **Commit:** `b3e34af` on branch `refactor/cli-command-table`
- **Method:** Direct disk measurement (`grep`/`wc`/`node --test`/`npm run coverage`) + targeted code reading. No external-tool generation.
- **Truth labels:** `[M]` measured this session · `[A]` assessed/qualitative · `—` measured-absent.

> **Scope calibration (read first).** This 25-pillar framework is calibrated for **distributed, hosted agentic services**. Dema is a **local-first, no-daemon, no-public-network sovereign CLI node**. Several pillars (Observability, SRE, Scalability, Operational Readiness) score low **not from defect but from deliberate scope exclusion**. We score against the literal framework, then give a scope-adjusted read. Every score binds to a measured signal — honoring the framework's own **Claim Discipline** pillar.

## Evidence base (all [M])

| Metric                     | Value                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Packages / apps            | 21 packages + 1 CLI                                                                                                                            |
| Production deps / dev deps | **0 / 0** (empty `node_modules`, no lockfile)                                                                                                  |
| Runtime / module system    | Node ≥20, ESM                                                                                                                                  |
| Source code                | 59,666 LOC / 226 `.js` files                                                                                                                   |
| Test code                  | 73,195 LOC / 284 `.test.js` (test:src 1.23:1)                                                                                                  |
| Test result                | 4008 / 4008 pass                                                                                                                               |
| Coverage                   | 96.71% line / 87.15% branch / 97.78% func (gates 95/85/95)                                                                                     |
| True e2e tests             | 110 / 284 files spawn the CLI                                                                                                                  |
| Docs                       | 198 `.md`, 18 ADRs                                                                                                                             |
| Quality gate               | `npm run check` = 59 sub-commands, 11 review scripts, EXIT 0                                                                                   |
| Crypto                     | `node:crypto` in 48 files; SHA-256 ×431, Ed25519 ×46, sign/verify, `generateKeyPair` ×2                                                        |
| Network surface            | **loopback-only**: Node0 gateway `127.0.0.1:7421`; Ollama `localhost`/`127.0.0.1:11434`; LM Studio `127.0.0.1:1234` where model commands apply |
| Immutability               | 1,892 `Object.freeze`                                                                                                                          |
| Bounded limits             | `timeoutMs` ×47, `MAX_ITERATIONS` ×37, `maxFiles` ×27, `MAX_*_BYTES`, `maxDepth` ×13                                                           |
| Error handling             | 246 `try`, 87 `throw`, 124 `process.exit`                                                                                                      |

## Master scorecard — Elite Agentic Pillars (20)

| #   | Pillar                      | Score  | Evidence (measured)                                                                                                           | Verdict                                                    |
| --- | --------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Observability               | 3/10   | **0** OTel/pino/winston/correlation-IDs; 326 ad-hoc `console.*`; no traces/metrics/dashboards                                 | Absent — ad-hoc only                                       |
| 2   | Reliability/SRE             | 4/10   | No SLO/SLI/error-budget (6 stray refs); graceful `partial:true` degradation                                                   | Not a monitored service                                    |
| 3   | Security Engineering        | 9/10   | 0-dep (no scan surface), secrets via `process.env`, `MAX_*` input caps, fail-closed defaults, `SECURITY.md`                   | Strong; lacked formal threat model → see `THREAT_MODEL.md` |
| 4   | AppSec Verification (ASVS)  | 8.5/10 | Ed25519+SHA-256, `exact_lookup_only` consent = access control, pervasive validation, stateless, local data                    | Strong                                                     |
| 5   | Testability                 | 9/10   | 4008 tests, **110 e2e** subprocess files, mutation-property tests, **119** replay/determinism files, failure-path tests       | Excellent; thin on chaos + lifecycle chains                |
| 6   | Formal Correctness          | 9/10   | **1,892** `Object.freeze`, 371 versioned schemas, state-machine rules (Block0 sealability), deterministic adapters            | Excellent                                                  |
| 7   | Cryptographic Integrity     | 8.5/10 | SHA-256 ×431, Ed25519 ×46, hash chains (`prev_hash` ×105, `chain_root` ×21), ledger replay; Merkle root for proof-of-priority | Strong; receipt chains are **linear, not Merkle**          |
| 8   | Determinism & Replayability | 9/10   | 119 replay/deterministic test files, `econ-ledger-replay`, `stableStringify` canonicalization before hash                     | Excellent                                                  |
| 9   | Data Governance             | 8/10   | Consent ubiquitous, redaction (95 refs), sovereignty (local `DEMA_HOME` only)                                                 | Strong; explicit retention policy thin                     |
| 10  | Agentic Safety              | 9/10   | Boundary-attestation tool gates, typed-GO human approval, anti-prompt-injection in 7+ files + tests, rollback                 | Excellent                                                  |
| 11  | Performance                 | 6/10   | Bounded-by-design caps, O(1)/O(n) paths; **no** profiling/benchmarks/backpressure/cache strategy                              | Bounded but unmeasured                                     |
| 12  | Scalability                 | 5/10   | Single-node by design; federation gated (`federation_started=false`); no queues/sharding                                      | Scope-deferred                                             |
| 13  | Maintainability             | 8/10   | 21 cohesive packages, low coupling, Track-2 dispatcher refactor (god-switch → COMMAND_TABLE)                                  | Strong; `index.js` still **4,941 LOC**                     |
| 14  | DX                          | 8/10   | README/CONTRIBUTING/CHANGELOG/SECURITY; `npm test`/`check` clear; 0-dep = instant setup                                       | Strong; 59-step `check` is dense                           |
| 15  | Economic Integrity          | 6.5/10 | PoI ×45, riba-zero, Gini, Harberger referenced; anti-gaming in spec                                                           | **DESIGNED_NOT_LIVE** — live incentives unverifiable       |
| 16  | Operational Readiness       | 4/10   | Rollback exists; honest `CURRENT_LIMITS.md`; **no** DR/backup runbook, no deploy                                              | Weak (local scope)                                         |
| 17  | Supply Chain Integrity      | 9/10   | 0-dep, no lockfile-to-poison, **5 OpenTimestamps** (.ots) Bitcoin-anchored, `merkle-root.txt.ots`                             | Excellent; SBOM → see `SBOM.md`                            |
| 18  | Compliance Readiness        | 8/10   | Attestation ×257, `audit_trail` ×77, `EVIDENCE_INDEX` ×18, boundary attestations                                              | Strong; no policy→control map                              |
| 19  | UX Trust Layer              | 8.5/10 | Exact-string consent shown, `dema explain` + help-topics, refusal-as-product, boundary footers                                | Strong, no dark patterns                                   |
| 20  | Evolution Architecture      | 8/10   | **371** versioned schema tags (`.v0.1`), 18 ADRs, 30 migration/deprecation refs                                               | Strong; no formal deprecation policy                       |

## Master scorecard — BIZRA Gold Additions (5)

| #   | Pillar                        | Score  | Evidence                                                                                                                              | Verdict                      |
| --- | ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 21  | Proof-of-Truth Convergence    | 7.5/10 | Formal ✓ · Crypto ✓ · Empirical ✓ (4008 tests) · Economic ◐ (not live)                                                                | **3 of 4 axes live**         |
| 22  | Receipt Discipline            | 9/10   | `receipts` pkg, content-addressed, `EVIDENCE_INDEX`, attestation ×257                                                                 | Excellent                    |
| 23  | Human Sovereignty Boundary    | 9/10   | SAT ×228, PAT ×158, URP ×127, FATE ×22 — pervasive, enforced                                                                          | Excellent                    |
| 24  | Claim Discipline              | 9.5/10 | Boundary keys false-by-default (`network_used`/`token_minted`/`runtime_execution_performed`), no-overclaim gates, `CURRENT_LIMITS.md` | **Exemplary — self-applied** |
| 25  | Minimal Solvable Special Case | 9/10   | PR-per-slice cadence; Block0 12/12 via incremental adapters                                                                           | Excellent                    |

## Tiers

- **Tier 1 — World-class (9+):** Claim Discipline, Formal Correctness, Determinism, Agentic Safety, Testability, Security Engineering, Supply Chain, Receipt Discipline, Sovereignty Boundary, Minimal-Solvable-Case.
- **Tier 2 — Strong (8–8.5):** AppSec, Crypto Integrity, Data Governance, Maintainability, DX, Compliance, UX Trust, Evolution.
- **Tier 3 — Scope-deferred / pre-proof (3–6.5):** Observability (3), SRE (4), Ops Readiness (4), Scalability (5), Performance (6), Economic Integrity (6.5).

## Aggregate

- **Raw mean across 25 pillars:** ≈ **7.7 / 10 → B+ / A− (≈ 84)** against the literal elite-distributed framework.
- **Scope-adjusted** (excluding the 4 deliberately-deferred service-ops pillars 1/2/12/16): ≈ **8.4 / 10 → A−/A**.

Honest framing: against a **distributed-agentic-service** bar, Dema is **B+/A−**, held there by missing telemetry/SRE/ops it has not yet entered. Against its **actual scope — a local-first sovereign proof kernel — it is A**, with the proof-discipline pillars at genuine world-class.

## Highest-leverage proof-gap reducers (per "Minimal Solvable Special Case")

1. **Observability →** structured local event log (`receipts`-backed JSONL + `correlation_id` per command run). Closes #1 without a network daemon. _(3→6)_
2. **Supply Chain #17 →** `SBOM.md` (this commit) — 0-dep posture + OTS anchoring. ✅ landed.
3. **Security #3 →** `THREAT_MODEL.md` (this commit) — STRIDE over the local boundary. ✅ landed.
4. **Crypto #7 →** optional Merkle root over receipt batches (already computed for proof-of-priority).
5. **Ops #16 →** `RECOVERY.md` runbook (`~/.dema` backup/restore + receipt re-verify).
6. **Economic #15 →** convert one PoI rule `DESIGNED_NOT_LIVE → MEASURED` via a deterministic local fixture (Block0 adapter pattern).

## Confidence

High on quantitative pillars (3–14, 17–25 — directly grepped/run). Medium on Observability/SRE/Ops where the finding is _absence_ (source + docs scanned; a telemetry config living outside the repo would not be seen).
