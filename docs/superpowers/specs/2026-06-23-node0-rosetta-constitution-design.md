# NODE0-ROSETTA-CONSTITUTION-1A — Design Spec

- **Status:** DESIGN_APPROVED (operator GO 2026-06-23, ultracode) · grounded in adversarially-verified audit `docs/audits/NODE0_DEMA_NORTHSTAR_AUDIT_1A.md`
- **Truth label of the artifact:** `NODE0_ROSETTA_CONSTITUTION_PREVIEW_ONLY`
- **Slice class:** micro-slice, preview-only, pure kernel + read-only CLI + canon doc + tests
- **Core rule:** every capability is **bound to a real on-disk anchor and labeled `IMPLEMENTED | DECLARED | DESIGNED_NOT_LIVE | UNKNOWN`**; the labels are *derived from verified evidence*, never asserted.

## 1. Purpose

One frozen, machine-readable + human-readable **Rosetta Stone** that becomes the honest northstar future BIZRA nodes inherit. It answers exactly one question:

> What does Node0/Dema actually have today — and at what truth level — translated across the Telescript mobile-agent vocabulary, Dema's own primitives, and the SYNAPSE-CORE operating doctrine?

Its job is **anti-drift**: make it mechanically impossible for future work (or a future AI) to claim MCP / A2A / federation / ZK / Firecracker / PoI / token / autopoietic-runtime are *live* before they are. It replaces scattered, drifting capability claims with a single source whose anchors are checked against disk by its own test.

## 2. Non-goals (hard boundary)

No runtime, no daemon, no network, no file write, no signing, no key generation, no mint, no MCP/A2A invocation, no federation, no live autopoietic loop, no PoI, no ZK, no Firecracker. It **modifies nothing shipped** — the existing `external-pattern-registry-preview.js` stays byte-for-byte unchanged and is only cross-linked by reference. Pure, read-only doctrine.

## 3. Architecture

New isolated kernel + one CLI subcommand + one canon doc + one test. Refactors nothing (per per-module-boundary discipline).

| Unit | File | Role |
|---|---|---|
| Constitution kernel | `packages/core/src/node0-rosetta-constitution-preview.js` | `buildNode0RosettaConstitutionPreview()` → frozen envelope; `verifyNode0RosettaConstitution(map, { anchorExists })` → fail-closed self-consistency check. **Pure** (no fs/net/clock/random). |
| CLI subcommand | `apps/cli/src/commands/node0.js` (extend) | `dema node0 map` — read-only print (text + `--json`). ADR-012 space-subcommand; no new kebab, no new top-level command. |
| Canon doc | `docs/02-architecture/NODE0_ROSETTA_CONSTITUTION_v0_1.md` | Human-readable Rosetta Stone + truth ledger + boundary. |
| Test | `tests/node0-rosetta-constitution-preview.test.js` | Full proof incl. the **phantom-file guard** (real fs-backed `anchorExists`). |
| Registry | `docs/TESTING.md` (+1 line, same commit) | Register the test (integration-check discipline). |

### Purity ↔ phantom-file guard (the key design move)

The kernel must stay pure (kernel-purity gate scans `packages/core/src`), so it **cannot** read the filesystem. To still bind every anchor to disk, `verifyNode0RosettaConstitution` takes an **injected** predicate `anchorExists(path) → boolean`. The kernel ships a trivial default (`() => true` is *not* used — default requires the caller to supply it, else verification of anchor-existence is reported as `UNKNOWN`, never silently passed). The **test** supplies a real `node:fs`-backed predicate, so CI mechanically asserts: every `IMPLEMENTED`/`DECLARED` row's `anchor_path` exists on disk; the known-absent `docs/public/third-fact-v0.1.md` stays `DESIGNED_NOT_LIVE` *because* it is absent. This converts the audit's dangling-reference defect class into an enforced invariant for the canonical map.

## 4. Envelope shape — `bizra.dema.node0_rosetta_constitution_preview.v0.1`

```
{
  schema, truth_label: "NODE0_ROSETTA_CONSTITUTION_PREVIEW_ONLY", mode: "preview_only",
  rosetta: [ { telescript, dema_primitive, synapse_core, anchor_path, status, note } ],
  capability_ledger: [ { capability, status, anchor_path, anchor_detail, evidence_ref } ],
  rest_protection: {
    metric: "autonomy_coverage", definition_status: "IMPLEMENTED",
    live_measurement_status: "DESIGNED_NOT_LIVE",
    formula: "autonomous_action_classes / total_action_classes",
    action_classes: [ { class, reversible, requires_typed_go, autonomous } ],
    autonomous_count, total_count, autonomy_coverage   // ratio in [0,1], shown math
  },
  boundary: { runtime:false, federation:false, mint:false, network:false, signing:false,
              key_generation:false, mcp_invoked:false, a2a_called:false, autopoietic_runtime:false,
              poi_scored:false, token_minted:false, file_write:false },
  cross_ref: { external_pattern_registry: { anchor_path, schema } },
  status_summary: { IMPLEMENTED, DECLARED, DESIGNED_NOT_LIVE, UNKNOWN },
  what_this_proves: [...], what_this_does_not_prove: [...],
  constitution_hash   // sha256(stableStringify(canonical body))
}
```

## 5. The Rosetta rows (Telescript ↔ Dema ↔ SYNAPSE-CORE, all anchors verified on disk)

| Telescript | Dema primitive | SYNAPSE-CORE | anchor_path | status |
|---|---|---|---|---|
| Agent | agent profile / PAT agent | sub-agent (researcher/builder/critic) | `packages/agents/src/agent-profile-registry.js` | IMPLEMENTED |
| Place | Node0 / DEMA_HOME / Realm | local execution context | `packages/core/src/live-homebase.js` | IMPLEMENTED |
| go | bounded-task + mission lifecycle | SNR Strike + consent gate | `packages/tasks/src/bounded-task-runner.js` | IMPLEMENTED (live mutating exec → DESIGNED_NOT_LIVE) |
| Ticket | consent proof / typed GO | FATE consent gate §1 | `packages/consent/src/consent-common.js` | IMPLEMENTED |
| Permit | boundary / autonomy gate | FATE action-class table | `packages/core/src/external-pattern-registry-preview.js` (boundary discipline) | IMPLEMENTED |
| Stub | SAT verdict envelope | verifier / critic | `packages/verifier/src/sat-placeholder.js` | DECLARED (placeholder) |
| Telesphere | URP shared world / federation | autonomy contract §8 (NODE0 executor) | `packages/core/src/shared-urp-world-preview.js` | DESIGNED_NOT_LIVE |
| *(state carries proof, not code)* | proof passport + receipt chain | §0 bind-before-speak | `packages/receipts/src/proof-passport.js` | IMPLEMENTED |

## 6. Capability ledger (curated from the 36-entry verified audit ledger)

Encodes the named components + the spine. Each row carries `status` + `anchor_path` (verified). Full 36 live in the audit doc.

- **Spine (IMPLEMENTED):** zero-dep invariant, kernel-purity, exact-string consent, cryptographic consent-proof + nonce replay-close, fail-closed boundary blocks, DoS guards, proof-passport/canonical-receipt, receipt paging, agent-DNA root-coherence (Law of Assumption gate).
- **Components — the "integrate" set, already preview kernels (DECLARED):** MCP capability descriptor (`mcp-capability-descriptor-preview.js`), A2A envelope (`a2a-message-envelope-preview.js`), Amana smart-contract registry (`amana-contracts-preview.js`), SNR scoring engine (`process-value-preview.js` `computeSNRValue`), RSI metric (`process-value-preview.js` `computeProcessRsi`), shoulder-of-giants protocol (`peak-self-loop-preview.js` `shoulders_protocol` + `external-pattern-registry-preview.js`), dual-token ledger (`dual-token-ledger.js`), URP local (`urp-shared-runtime-discovery.js`), post-quantum crypto-policy (`crypto-policy.js`).
- **DESIGNED_NOT_LIVE:** autopoietic/autonomous self-modification loop (`peak-self-loop-preview.js` `not_autonomous_runtime:true`), URP shared runtime, SAT/PAT dual-loop, Node1/Node2 federation handoff (`network-fixture-preview.js`), PoI/token-economy/Step-7 mint, canonical Third-Fact md (absent — enforced sentinel).

## 7. Rest-protection metric — Autonomy Coverage Ratio

The SYNAPSE-CORE §1 FATE action-classes are encoded as a frozen constant. `autonomy_coverage = autonomous_action_classes / total_action_classes`, numerator/denominator **shown** (ZANN-safe — no decimal without math). The *definition* is `IMPLEMENTED` and unit-tested; any *live fleet-wide measurement* is `DESIGNED_NOT_LIVE`. Ties to SYNAPSE-CORE §8/§12: the higher the share Dema can do without waking Mumu (reversible classes), the more rest is protected.

## 8. Fail-closed invariants (the anti-overclaim teeth)

`verifyNode0RosettaConstitution` returns `{ valid:false, blocked_by:[...] }` if: any `status` ∉ enum; any `IMPLEMENTED`/`DECLARED` row whose `anchor_path` fails the injected `anchorExists` (or `anchorExists` not supplied → `anchor_existence_unverified`, fail-closed not silent); any boundary key not `false`; `autonomy_coverage` ∉ [0,1] or ≠ `autonomous_count/total_count`; missing `cross_ref`; `status_summary` ≠ recomputed counts; any forbidden field name present (reuse the leak-guard discipline). Pure, deterministic, deep-frozen.

## 9. CLI — `dema node0 map`

Read-only. Default: a truth-labeled table (rosetta + status_summary + autonomy_coverage). `--json`: the full frozen envelope. No consent flag (read-only, no mutation). Routed inside `cmd_node0` (no new COMMAND_TABLE entry).

## 10. Testing strategy

`tests/node0-rosetta-constitution-preview.test.js`: schema/truth_label; rosetta rows present + valid status enum; **phantom-file guard** (real fs `anchorExists` → every IMPLEMENTED/DECLARED anchor exists; third-fact md absent ⇒ stays DESIGNED_NOT_LIVE); boundary all-false; rest_protection math (ratio = count/count, ∈[0,1], live measurement DESIGNED_NOT_LIVE); cross_ref present + unchanged registry schema; status_summary = recomputed; determinism + deep-frozen; fail-closed on tampered status / missing anchorExists / non-false boundary; purity (no fs/net/clock/random in the module source). Register in `docs/TESTING.md` same commit.

## 11. Roadmap — invariant-safe additions (each its own GO-covered TDD slice, after 1A)

1. **(S) doc-staleness + broken-internal-link gate** (`scripts/review/doc-staleness-gate.mjs`) — closes the dangling-third-fact defect class repo-wide. Read-only scanner.
2. **(S) covenant CLI fail-open fix** — replace `require()` in ESM (`index.js:907/934`) so the gate fails closed; add a test exercising the CLI path.
3. **(M) SAT-review verification step-7** — wire `verifyImprovement` to actually verify a SAT signature (pure crypto, external pubkey, mock SAT).
4. **(M) RSI self-improvement-PROPOSAL preview kernel** — emits a frozen reviewable proposal envelope (boundary all-false, never applies).
5. **(S) MCP descriptor negative-conformance fixtures**; **(S) Amana unblock-criteria manifest.**

## 12. What this proves / does not prove

**Proves:** Node0/Dema's real capability surface can be expressed as one frozen, anchor-bound, truth-labeled map whose own test rejects phantom anchors and overclaimed statuses.
**Does NOT prove:** that any DECLARED/DESIGNED_NOT_LIVE capability is live; that federation/MCP/A2A/PoI/token/autopoietic-runtime work; that the grades in the audit are measured facts (they are assessments). The map is a mirror, not a runtime.
