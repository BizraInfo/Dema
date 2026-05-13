# ADR-006: Continuous Assurance and No-mint Verification

**Status:** Accepted
**Date:** 2026-05-12
**Decision makers:** Mumu (Mohamed Beshr)
**Supersedes:** none
**Related:** [ADR-002 No Shadow State](ADR-002-no-shadow-state.md), [ADR-005 Operator Actions Require Explicit Consent](ADR-005-operator-actions-require-explicit-consent.md)
**Implements:** `~/.dema/kernel/assurance/spec/dema_assure_verify_v0_1.md` (verify mode v0.1)
**Companion plan:** `~/.dema/kernel/assurance/spec/phase3_audit_migration_v0_1.md` (Phase 3.1 audit.py migration)
**Evidence:** proof-forge receipt [`2026-05-12_035145`](../../.proof-forge/receipts/2026-05-12_035145.json) (evidence_hash `fe2e83a866276959da55126f2f83ceb474fea7d0d213167909f1e8078a3f6614`, position 9, Ironclad)

## Context

Phase 2 (2026-05-12 02:09 UTC) shipped the local Continuous Assurance module: `mint_lib` (canonical digest minting), four inner gates (preflight, security, chain, perf), one composite gate (`all.py`), the `dema-assure` shim, and a legacy receipt freeze manifest anchoring 149 pre-existing `blake3_*` receipts. Node0 test runner reported `64/64 PASS`.

Phase 2 had exactly one chain-extension entrypoint (`mint_lib.mint_receipt`). Every assurance act extended the agent chain by one receipt. This is correct for normal operation but creates two problems when verification is needed:

1. **Observer effect.** Running `dema-assure all` to "verify the system is healthy" mints 5 new receipts. The act of verification changes the state being verified. A reviewer reading a verification report cannot trust that the report describes the chain as it was *before* review.
2. **Chain pollution under routine checks.** A daily or PR-gate verification would balloon the receipt count without information gain.

The risk was empirical, not hypothetical. On 2026-05-12 06:25 GST, a `/V` (validate) review of Phase 2 was labeled "strict read-only validation" but actually minted 5 receipts during its run. The verification report described a chain state that no longer existed by the time the review concluded.

This ADR formalizes the response: BIZRA must support **proof without mutation**.

## Problem: verification observer effect

A verifier that changes the state it verifies is not audit-grade.

Closing this gap requires more than discipline. It requires a structural bifurcation: two sibling code paths that share digest semantics but differ in their commitment to filesystem writes and chain extension. The first (mint mode) produces canonical receipts the second (verify mode) produces equivalent proof previews without mutating state.

## Decision

BIZRA separates assurance into two modes, structurally enforced at the library level.

### 1. Mint mode (canonical chain extension)

- Entrypoint: `mint_lib.mint_receipt(...)`.
- Produces a canonical receipt with `digest_algo + prev_digest + self_digest + producer_identity + chain_id + timestamp + schema`.
- Writes the receipt file to disk under `~/.dema/agents/dema.node0_mission_agent/receipts/{date}/`.
- Advances `chain-head.txt` atomically.
- Surface: `dema-assure all`, `dema-assure preflight`, `dema-assure security`, `dema-assure chain`, `dema-assure perf`.

### 2. Verify mode (non-mutating validation)

- Entrypoint: `mint_lib.preview_receipt(...)`.
- Same signature as `mint_receipt`; same digest derivation; same validation.
- **Zero filesystem writes.** **Zero chain-head advancement.**
- Returns a dict bit-identical in shape to what `mint_receipt` would have emitted at the current chain head.
- Surface: `dema-assure verify`, `dema-assure diff`.
- Surface schemas (ephemeral, never written as receipts): `bizra.dema.assurance.verify_report.v0.1`, `bizra.dema.assurance.legacy_diff_report.v0.1`.

The four inner gates accept an optional `minter=` parameter (default = `mint_lib.mint_receipt`). Verify mode passes `minter=mint_lib.preview_receipt`. The gate code is byte-identical between modes — bifurcation is at exactly one parameter.

## Invariant (V-I10, binding)

For any invocation of `dema-assure verify`:

```text
chain_head_before == chain_head_after
```

No exception. The contract is asserted at the end of every verify run; any mismatch produces non-zero exit and halts the gate as FAIL even if all sub-gates passed.

Static guarantee: `STRUCT-VERIFY-NO-MINT-IMPORT` (Node0 test runner) AST-scans `verify.py` and `legacy_freeze_diff.py` for any call to `mint_lib.mint_receipt`. Zero matches required.

## Producer migration policy

Legacy receipt producers must migrate one at a time, in an order determined by **empirical drift evidence**, not preference.

The drift evidence channel is `dema-assure diff`. It compares the latest `assurance-legacy-freeze-*.json` receipt against a live re-scan of `blake3_*` receipts and reports `(mismatches, missing, extra) + freeze_receipt_self_consistent`. Any producer whose receipts appear in `extra` is the next migration candidate.

Current migration order (re-derivable from diff state):

1. `~/.dema/audit/audit.py` → producer identity `dema.audit.system` (currently leaking; `extra: 2` as of 2026-05-12 08:00 GST)
2. `~/.dema/kernel/handlers/voice.py` (or current voice module path)
3. `~/.dema/kernel/mission_lifecycle/handlers/node0_awakening.py`
4. `~/.dema/kernel/mission_lifecycle/kernel.py`

Each migration is its own bounded GO. Each migration is gated on the 9-step readiness checklist in the per-producer migration spec. The schema string of a migrated producer's receipt MUST NOT change — only the producer's mint mechanism migrates from inline `blake3_prev/blake3_self` to `mint_lib.mint_receipt(...)`.

Phase 3.1 (the `audit.py` migration) is scoped in `~/.dema/kernel/assurance/spec/phase3_audit_migration_v0_1.md`. See that spec for invariants `M-I1…M-I12` and tests `AUDIT-MIG-T01…T08`.

Historical legacy receipts MUST NOT be modified in any byte during migration. Per `feedback_hash_binding_no_forge`: never modify bytes to match a hash; never modify a hash to match bytes. Migration changes the producer's *future emits*, never historical witnesses.

## CI/CD implications

**Node0 is authority. GHA is witness.**

- Local Node0 (`dema-assure all`, `dema-assure verify`, `dema-assure diff`, `~/.dema/bin/test-runner`) is the canonical assurance surface. All chain extensions originate here.
- Future GitHub Actions may run diagnostic mirrors of these surfaces and emit reports. GHA MUST NOT mint canonical Node0 receipts. GHA MUST NOT advance the agent chain. Anything GHA produces is a witness artifact reconciled by Node0; canonical authority never lives in CI infrastructure.
- Reconciliation flow (when GHA witness is implemented, deferred to Phase 6): GHA reports → Node0 reads → Node0 mints `ci_concordance` or `ci_drift` receipt.

The verify-mode surface (`dema-assure verify`) is the CORRECT surface for any future PR-gate or scheduled health check. The mint-mode surface (`dema-assure all`) is reserved for meaningful state transitions (releases, capability anchors, post-migration witnesses).

## DevOps integration

The `dema-assure` family is the local Continuous Assurance gate:

| Before this act | Run this assurance |
|---|---|
| Any implementation begins | `dema-assure verify` (no-mint pre-flight) |
| Capability receipt anchor | `dema-assure all` (canonical mint) |
| Producer migration acceptance | `verify` + `all` + `diff` + full test runner — all green |
| Release tag | local assurance + GHA witness (future) + Node0 reconcile (future) |

## Performance-quality tracking

Per-run metrics tracked by `perf.py` and emitted into each assurance receipt's `payload.metrics`:

- `verify_runtime` (target: < 60 s)
- `assure_all_runtime` (target: < 120 s)
- `diff_runtime` (target: deterministic, < 5 s through ~10k legacy receipts)
- `chain_walk_time` (scales linearly with receipt count)
- `test_runtime` (Node0 runner)
- `audit_runtime` (skipped in verify mode per V-I10)
- `smi_render` (skipped in verify mode per V-I10)
- `memory_peak`

Drift signals tracked separately by `legacy_freeze_diff.py`:

- `drift_detected` (bool)
- `mismatches`, `missing`, `extra` (counts)
- `freeze_receipt_self_consistent` (bool)
- `chain_head_unchanged` (bool, verify mode only)

Regression threshold: a `regression` flag fires when current-run runtime > 20% above the relevant baseline in `~/.dema/kernel/assurance/baselines/baselines.json`. Baseline refresh is operator-gated; no auto-update.

## Software quality rule

Every new capability shipped after this ADR must declare, in its spec:

1. **Test surface** — which tests in the Node0 runner exercise it; what they assert.
2. **Assurance surface** — which `dema-assure` gate (or new gate) verifies it; which preview equivalent.
3. **Receipt mode** — does this capability emit canonical receipts; if so, via `mint_lib.mint_receipt`; never via inline mint code.
4. **No-mint verification behavior** — how the capability behaves when called under `minter=mint_lib.preview_receipt`; what it skips; what it preserves.
5. **Rollback or freeze strategy** — how a failure or revert is recovered; what receipts are preserved; what is re-frozen.

A capability that cannot answer all five does not ship.

## Consequences

**Positive:**

- `/V` reviews are now structurally honest. The chain head bit-identity assertion makes "read-only" enforceable, not aspirational.
- Phase 3 producer migrations have a non-destructive verification surface. Every migration commit can be gated on `verify PASS + diff clean + chain head unchanged` without spending chain entries.
- The bifurcation pattern generalizes. Any future BIZRA operation with observation cost (audit logs, scientific replication, blockchain analysis) can adopt the same mint/preview sibling structure.
- CI/CD authority boundary is now binding. Future GHA work cannot accidentally become canonical.

**Negative / costs:**

- All inner-gate `run()` functions now accept an optional `minter=` parameter. Mint-mode callers must not pass it; verify-mode callers must. Small API surface increase.
- Gates that subprocess external producers must explicitly guard those subprocess calls in verify mode. Today's `perf.py` already does this (skips `measure_audit_runtime` and `measure_smi_render` when `_minter is mint_lib.preview_receipt`); future gates must add the same guard, or a structural test must enforce it. (Recommendation: add a STRUCT test in a subsequent ADR-007 if more gates appear.)
- The verify report schema (`bizra.dema.assurance.verify_report.v0.1`) is ephemeral. Reviewers cannot reference a verify report by self_digest the way they can a minted receipt. This is by design — reports are not authority.

## Non-claims

This ADR does **not**:

- Implement GitHub Actions workflows.
- Implement release automation, publish, or reconcile flows.
- Migrate `audit.py`, `voice.py`, `node0_awakening.py`, or `mission_lifecycle/kernel.py`.
- Create Node1 federation surfaces.
- Implement the Ultra Micro Actuator runtime. The actuator remains a doctrine candidate; its v1.0 spec must be revised to v1.1 with explicit witness modes (preview / ephemeral / canonical / composite) before any runtime implementation. Not every micro-actuation should extend the canonical chain.
- Add per-producer cryptographic signing. The `producer_identity` regex (`^dema\.[a-z_]+\.[a-z_.]+$`) is the v0.1 identity primitive; GPG or per-producer keys are deferred to a future ADR.
- Mandate a CI mirror. ADR-006 only states the authority boundary if and when CI is added.

## Authority boundary (binding)

**Node0 is authority. GHA is witness.**

This sentence is the constitutional anchor of all future CI/CD work. Any future automation that proposes to mint canonical receipts outside Node0 — for any reason — must first amend this ADR by superseding it.

## Implementation status

ADR-006 codifies what was shipped on 2026-05-12 and tested at 71/71 PASS:

| Surface | State | Path |
|---|---|---|
| `mint_lib.preview_receipt` | shipped | `~/.dema/kernel/assurance/mint_lib.py` |
| `preflight/security/chain/perf.run(minter=)` | shipped | `~/.dema/kernel/assurance/{preflight,security,chain,perf}.py` |
| `verify.py` orchestrator | shipped | `~/.dema/kernel/assurance/verify.py` |
| `legacy_freeze_diff.py` | shipped | `~/.dema/kernel/assurance/legacy_freeze_diff.py` |
| `dema-assure` shim with `verify` + `diff` cases | shipped | `~/.dema/bin/dema-assure` |
| 7 VERIFY-T tests in Node0 runner | shipped | `~/.dema/kernel/test_runner/runner.py` |
| Capability receipt | minted | agent chain `5654cc11…b188af` (schema `bizra.dema.assurance.verify_capability.v0.1`) |
| Proof-forge anchor | minted | proof-forge position 9, evidence_hash `fe2e83a8…3f6614` |
| Phase 3.1 migration plan | designed | `~/.dema/kernel/assurance/spec/phase3_audit_migration_v0_1.md` |

## Effect on existing ADRs

- **ADR-002 No Shadow State:** unchanged. ADR-006 is a refinement — verify mode is not shadow state; its reports are ephemeral by design and never persist as canonical.
- **ADR-005 Operator Actions Require Explicit Consent:** unchanged. Verify mode is an inspection surface; it does not perform operator actions on the world. It performs internal validation.

## Acceptance

This ADR is accepted if all of the following hold at the time of merge:

- `dema-assure verify` PASSes with `chain_head_unchanged: True` against the chain head at the time of this commit.
- Node0 test runner reports ≥ 71/71 PASS.
- The 12 acceptance items enumerated in the authoring spec for this ADR are all addressed above (decision · context · observer-effect problem · mint/preview bifurcation · consequences · implementation implications · CI/CD implications · QA/performance implications · producer migration policy · non-claims · link to Phase 3 audit migration plan · explicit Node0-authority / GHA-witness statement).
- No runtime code was modified by the act of authoring this ADR.

Verified: 2026-05-12 08:10 GST.
