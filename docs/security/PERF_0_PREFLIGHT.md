# PERF-0 · Performance and Self-Optimization Preflight

**Status:** preflight design only; no runtime code; no key export; no benchmark against external systems; no real-time monitoring exposed
**Sparse point:** after KEYCONSENT-1A kernel sealed (`89ad00b`) and after KEYCONSENT-1B verdict-attest gate (`b94c448`)
**Pair-doc (future):** `PERF_CLOSEOUT.md` (after PERF-1A + PERF-1B + PERF-1C + PERF-1D sealed)
**Date:** 2026-05-30 (Dubai · GST)

## 1. Current weakness

Dema cannot prove whether it improved, regressed, or stayed the same.

There is:

- **no baseline performance snapshot** — no receipt anywhere on disk that records "at commit X on host Y, dema boot latency was N ms";
- **no measured-vs-measured comparison receipt** — even when an operator subjectively notices "feels faster," there is no signed artifact that ties the feeling to a number;
- **no regression guard** — a slice that doubles `mission_selection_latency_ms` ships as easily as one that halves it; nothing in the test/check loop notices;
- **no proof of optimization** — there is no schema, no envelope, no signature, no hash chain that an external auditor could replay to confirm a speed claim.

Any "self-optimizing" claim Dema makes today would be **zann** — speculation passed as certainty — and a direct violation of the constitutional anchors recorded in `~/CLAUDE.md` (no zann; ihsan as minimum; daughter test).

PDF §22 Final Law states this plainly:

> If it cannot be measured, it cannot be called optimization.

PERF-0 is the preflight for the slice family (PERF-1A through PERF-1D) that closes that gap.

## 2. Target

Turn every "Dema got faster / lighter / more efficient" claim into a **measured-vs-measured comparison** anchored by two signed receipts:

- a **baseline snapshot** (PERF-1A) — what we measured before;
- an **improvement receipt** (PERF-1D) — what we measured after, with a deterministic comparison rule applied;

and require a passing **SAT review** before any surface (CLI, JSON output, doc, narrative line) is allowed to print a performance claim.

Mechanism (in one line): _the claim is no longer "I think Dema is faster"; the claim is "baseline_proof_hash = A, improvement_proof_hash = B, delta is computed, interpretation is deterministic, SAT review signed."_

## 3. Baseline + improvement envelope schemas

Two envelopes, both following the same body/signature/proof_hash separation the URP-4.1A choose decision and the KEYCONSENT-1A consent proof established.

### 3.1 `bizra.dema.perf_baseline.v0.1`

```text
schema:                              "bizra.dema.perf_baseline.v0.1"
baseline_id:                         "<short opaque id; e.g., perf-baseline-2026-05-30-001>"
baseline_metrics: {
  dema_boot_latency_ms:              <number>,
  mission_selection_latency_ms:      <number>,
  consent_proof_build_latency_ms:    <number>,
  consent_proof_verify_latency_ms:   <number>,
  receipt_write_latency_ms:          <number>,
  verification_latency_ms:           <number>,
  test_check_runtime_ms:             <number>,
  memory_rss_mb:                     <number>,
  cpu_utilization_pct:               <number>,
  gpu_utilization_pct:               <number>,
  disk_usage_mb:                     <number>,
  token_settlement_time_ms:          <number>,
  poi_scoring_time_ms:               <number>,
  regression_count:                  <integer>
}
measurement_context: {
  host_fingerprint:                  "<sha256 hex of stable host identifiers; e.g., uname+cpuinfo digest>",
  node_version:                      "<e.g., v22.4.0>",
  run_count:                         <integer; how many warm runs were averaged>,
  env_hash:                          "<sha256 hex of normalized DEMA_HOME + relevant env flags>"
}
prev_hash:                           "<sha256 hex of the previous baseline_proof_hash on this host, or 'genesis'>"
created_at_iso:                      "<ISO-8601 UTC timestamp>"
operator_public_key_fingerprint:     "<sha256 hex of the operator's Ed25519 pubkey, DER form>"
baseline_signature_b64:              "<Ed25519 signature over stableStringify(body without _b64/proof_hash fields), base64>"
baseline_proof_hash:                 "<sha256 of stableStringify(body excluding baseline_signature_b64 and baseline_proof_hash)>"
```

The required metric set is the literal list from PDF §14. No metric is optional in a baseline — a baseline that omits a metric is REJECTED at write time (PERF-1A DOD), so improvement receipts can never silently compare against a partial baseline.

### 3.2 `bizra.dema.perf_improvement.v0.1`

```text
schema:                              "bizra.dema.perf_improvement.v0.1"
improvement_id:                      "<short opaque id; e.g., perf-improvement-2026-05-30-001>"
baseline_proof_hash:                 "<sha256 hex; MUST resolve to a real baseline in the bundle>"
new_metrics: {
  dema_boot_latency_ms:              <number>,
  ... (same shape as baseline_metrics; every metric required) ...
}
delta: {
  dema_boot_latency_ms:              <number; computed: new - baseline>,
  ... (same shape; one delta per metric) ...
}
interpretation: {
  dema_boot_latency_ms:              "improved" | "regressed" | "unchanged",
  ... (same shape; one label per metric) ...
}
interpretation_rule_id:              "<e.g., perf-interp.v0.1; named, versioned, deterministic>"
sat_review_receipt_hash:             "<sha256 hex of the SAT review receipt body>"
consent_proof_hash:                  "<sha256 hex of a valid KEYCONSENT-1A consent proof for action_type=CLAIM_OPTIMIZATION>"
prev_hash:                           "<sha256 hex of previous improvement_proof_hash on this host, or 'genesis'>"
created_at_iso:                      "<ISO-8601 UTC timestamp>"
operator_public_key_fingerprint:     "<sha256 hex of the operator's Ed25519 pubkey, DER form>"
improvement_signature_b64:           "<Ed25519 signature over stableStringify(body without _b64/proof_hash fields), base64>"
improvement_proof_hash:              "<sha256 of stableStringify(body excluding improvement_signature_b64 and improvement_proof_hash)>"
```

The `body` for signing/hashing in each envelope is the schema **without** the `_signature_b64` and `_proof_hash` fields — the same separation pattern as KEYCONSENT-1A consent proof, URP-4.1A choose decision, and the verdict-receipt body. The signature commits to all other fields; the proof_hash is the content address.

Three derived properties:

1. **Identity binding**: both `baseline_signature_b64` and `improvement_signature_b64` are producible only by someone holding the operator's private key at the time of signing. Same key signs both — the verifier enforces that.
2. **Baseline binding**: `improvement.baseline_proof_hash` is a content-addressed reference. Re-measuring against a different (looser) baseline requires a different hash, which the verifier and the SAT reviewer can both detect.
3. **Interpretation determinism**: `interpretation_rule_id` names a deterministic, repo-pinned rule. The verifier re-derives `interpretation` from `delta` using the rule and rejects any mismatch.

## 4. How action/learning surfaces reference performance

Any receipt — action, learning, narrative, urp choose, mission close, demo card — that wishes to claim "Dema is faster," "improved performance," "reduced latency," "more efficient," or any synonym gains ONE new optional field:

```text
improvement_proof_hash:  "<sha256 hex of a PERF-1D improvement receipt body>"
```

The rule is hard:

- if `improvement_proof_hash` is present → the surface MAY print the optimization claim, and the bundle MUST ship the referenced improvement receipt + its baseline alongside;
- if `improvement_proof_hash` is absent → the surface MUST NOT print any optimization claim. Phrases such as "Dema got faster," "improved performance," "we optimized X," "speed gain of Y" are forbidden in any output (CLI, JSON, doc generator, narrative line).

This mirrors how KEYCONSENT-1B made `consent_proof_hash` mandatory before any verdict could be attested — the receipt commits to its evidence, and the surface is gated on the receipt.

A surface that prints an unqualified speed claim without an `improvement_proof_hash` is a doctrine violation on par with printing a verdict without a verdict_receipt_hash.

## 5. Verification flow

A stranger with (bundle containing baseline + improvement + SAT review + consent proof) + (operator's pubkey, supplied SEPARATELY via `--pubkey`) + (this repo's rule code) verifies in this order:

1. **Baseline signature** — verify `baseline.baseline_signature_b64` over `stableStringify(baseline body without _b64/_proof_hash)` using external `--pubkey`. On failure → `REJECTED:baseline_signature_invalid`.
2. **Baseline proof_hash recompute** — `sha256(stableStringify(baseline body excluding sig + proof_hash)) == baseline.baseline_proof_hash`. On mismatch → `REJECTED:baseline_proof_hash_mismatch`.
3. **Improvement signature** — verify `improvement.improvement_signature_b64` using THE SAME external `--pubkey` (same-key invariant — baseline and improvement must be the same operator). On failure → `REJECTED:improvement_signature_invalid`.
4. **Baseline reference resolves** — the bundle MUST contain a baseline envelope whose `baseline_proof_hash` exactly equals `improvement.baseline_proof_hash`. On miss → `REJECTED:baseline_not_found_in_bundle`.
5. **Delta recompute** — for every metric in `baseline.baseline_metrics`, `improvement.delta[metric] == improvement.new_metrics[metric] - baseline.baseline_metrics[metric]`. Any mismatch → `REJECTED:delta_mismatch`.
6. **Interpretation re-derivation** — `improvement.interpretation_rule_id` resolves to a known, repo-pinned deterministic rule (e.g., `perf-interp.v0.1`). Apply the rule to `improvement.delta` and assert the resulting label map equals `improvement.interpretation` exactly. Any mismatch → `REJECTED:interpretation_mismatch`. Unknown rule id → `REJECTED:interpretation_rule_unknown`.
7. **SAT review verification** — the SAT review receipt referenced by `improvement.sat_review_receipt_hash` is present in the bundle, has a verifiable signature (via the same external pubkey or a separately-supplied SAT-reviewer pubkey, per the slice's SAT model), and explicitly attests to this `improvement_proof_hash`. On failure → `REJECTED:sat_review_invalid` or `REJECTED:sat_review_does_not_attest_this_improvement`.
8. **Consent binding** — `improvement.consent_proof_hash` resolves to a valid KEYCONSENT-1A consent proof in the bundle whose `action_scope.action_type == "CLAIM_OPTIMIZATION"` and whose `action_scope.target_hash == improvement.improvement_proof_hash`. The consent proof itself verifies per KEYCONSENT-1A §5. On failure → `REJECTED:consent_invalid` or `REJECTED:consent_scope_mismatch`.

If steps 1–8 all pass → `VERIFIED`. The optimization claim is now grounded, measured, deterministically interpreted, SAT-reviewed, and consent-bound.

## 6. Non-goals

This preflight and the PERF-1A through PERF-1D implementation slices DO NOT:

- Claim "production-grade performance" (PDF §1 forbidden language).
- Benchmark Dema against external systems (no comparison to other CLIs, frameworks, or "competing" tools).
- Publish a public performance leaderboard.
- Offer SLO or SLA contracts to any party.
- Expose a real-time monitoring dashboard (no live socket, no streamed metrics endpoint, no externally-reachable telemetry surface).
- Fine-tune any model (no learning loop trained on these metrics).
- Autotune GPU or any hardware parameter.
- Pursue or accept any commercial benchmarking certification.
- Replace the operator's existing verification gates — PERF integrates alongside, not in place of, the existing test/check/smoke/auth chain.
- Promise universal portability — measurement_context fingerprints the host so cross-host comparison is structurally refused, not silently averaged.

## 7. Threat model

| Attacker                     | Capability                                                                                                       | PERF-1A/1D status                                     | Why                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Baseline-fabrication**     | Hand-writes a baseline JSON without running any measurement; signs it; ships it.                                 | **BLOCKED at PERF-1A write time, NOT at verify time** | PERF-1A kernel refuses to mint a baseline that did not come from the measurement harness (the harness emits a context block the kernel checks). A stranger cannot distinguish forged-but-signed from real-but-signed — that is exactly why the SAT review (step 7) and the operator's own daughter-test on the baseline matter. |
| **Metric-cherry-picking**    | Reports only the metrics that improved; omits the ones that got worse.                                           | **BLOCKED**                                           | The required metric set is fixed at the PDF §14 list. A baseline or improvement missing any metric is REJECTED at write time and at verify step 5 (delta recompute would skip-and-mismatch).                                                                                                                                    |
| **Host-substitution**        | Measures on a faster machine (e.g., M3 Max) and claims the win on a slower machine (e.g., budget laptop).        | **BLOCKED**                                           | `measurement_context.host_fingerprint` is a stable digest of host identifiers. The verifier refuses comparison across differing `host_fingerprint` values → `REJECTED:host_mismatch` (PERF-1B specifies that gate).                                                                                                             |
| **Interpretation-rule-swap** | Picks a lenient interpretation rule (e.g., "any delta < 10 ms counts as 'improved'") to convert noise into wins. | **BLOCKED**                                           | `interpretation_rule_id` is repo-pinned and versioned. Switching rules between baseline and improvement, or using an unknown rule, fails verify step 6. Rule changes are themselves slices with their own SAT review.                                                                                                           |
| **Regression-hiding**        | Improvement receipt's `interpretation` mislabels a regressed metric as "unchanged" or "improved."                | **BLOCKED**                                           | Verify step 6 re-derives `interpretation` from `delta` using the named rule. Any operator-supplied mislabel is overridden by the deterministic re-derivation and fails → `REJECTED:interpretation_mismatch`.                                                                                                                    |
| **Comparison-replay**        | Reuses an old `improvement_proof_hash` to decorate a new, unmeasured code change.                                | **BLOCKED**                                           | The consent proof's `action_scope.target_hash` is bound to the specific `improvement_proof_hash`. Decorating a new change with an old improvement fails verify step 8 (`consent_scope_mismatch`).                                                                                                                               |
| **SAT review forgery**       | Mints a SAT review without an actual reviewer.                                                                   | **BLOCKED at signature, NOT at human-intent layer**   | SAT review is itself a signed receipt; without the reviewer's key, no valid signature. If the operator-as-reviewer signs both, the cryptography passes but the daughter-test fails; this is acknowledged as an out-of-scope social attack and addressed in a future multi-party SAT slice.                                      |
| **Embedded-key liar**        | Modifies `bundle.signer_public_key_pem` to claim a different signer.                                             | **BLOCKED**                                           | Same invariant as verdict-receipt REJECT-4 and KEYCONSENT-1A: verifier IGNORES embedded pubkey and uses ONLY the externally-supplied `--pubkey`.                                                                                                                                                                                |

## 8. Determinism boundary

The interpretation rule MUST be deterministic. Specifically:

- pure arithmetic on the delta values (subtraction, ratio, absolute value);
- boolean comparisons against named, versioned thresholds (e.g., `dema_boot_latency_ms.improved_threshold_ms = -50`);
- no model judgment, no LLM-derived "this looks like an improvement," no statistical test that depends on hidden state;
- no clock, no random number, no network call inside the rule;
- the rule is pure-function `(delta_object, thresholds_object) -> label_object` and is re-runnable by a stranger with the rule code alone.

A non-deterministic interpretation rule is REJECTED at PERF-1A schema-validation time. The boundary block records this explicitly (`non_deterministic_interpretation_accepted: false`).

This is the same posture URP-4.1A took for the choose-decision interpretation: humans see the verdict, machines re-derive it; the receipt is the meeting point.

## 9. DOD for PERF-1A (baseline snapshot kernel)

Exit criteria for the IMMEDIATELY-FOLLOWING implementation slice (not this preflight):

- [ ] `packages/perf/src/baseline-snapshot.js` (or equivalent path agreed at slice start) exports pure functions: `buildBaseline({measurements, measurementContext, demaHome, prevHash?, createdAtIso?})` — fails closed when any PDF §14 metric is missing, when `measurement_context` is incomplete, when no signing key is found, or when `measurements` came from outside the harness; otherwise signs and returns a frozen envelope per §3.1.
- [ ] `verifyBaseline({baseline, pubkeyPem})` — performs §5 steps 1–2 (signature + proof_hash recompute). Returns `{verified: true, ...}` or `{verified: false, reason: "<first failing reason>"}`.
- [ ] All Ed25519 + sha256 + stableStringify primitives REUSED from existing modules — no duplication of the consent/verdict/choose primitives.
- [ ] A measurement harness (separate file, separate slice gate; named in PERF-1A but kept minimal) emits a measurement_context that the kernel can validate; the kernel refuses any baseline whose context does not pass the harness signature/structural check.
- [ ] Tests (`tests/perf-baseline.test.js`): happy path → `verified: true`; missing metric → `metric_missing:<name>`; incomplete measurement_context → `context_invalid`; no signing key → `no_authorship_key`; tampered body → `baseline_signature_invalid`; wrong external pubkey → `baseline_signature_invalid`; deterministic when inputs are injected (two builds deep-equal).
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; `npm test`, `npm run check`, `npm run llm:guidance`, `git diff --check` all clean.
- [ ] Does NOT yet integrate with any user-facing surface — no CLI prints "baseline taken." That integration is **PERF-1C** at earliest.
- [ ] Does NOT yet enforce baseline-prev-hash chain validation at write time; that is **PERF-1B**.

## 10. DOD for PERF-1B (regression guard slice)

Exit criteria, gated on PERF-1A sealed and remote-CI verified:

- [ ] `verifyImprovement({improvement, baseline, satReview, consentProof, pubkeyPem, satReviewerPubkeyPem?, now?})` — performs §5 steps 3–8 in order. Returns `{verified: true, ...}` or `{verified: false, reason: "<first failing reason>"}`.
- [ ] Deterministic interpretation rule `perf-interp.v0.1` lives in `packages/perf/src/interpretation-rules/perf-interp.v0.1.js`, is pure, has its own test file, and is referenced by id (not by import path) in improvement receipts.
- [ ] Host-fingerprint mismatch between baseline and improvement → `REJECTED:host_mismatch`. Cross-host comparison is structurally refused, not averaged or warned-and-allowed.
- [ ] Tests (`tests/perf-improvement.test.js`): happy path; baseline_not_found_in_bundle; delta_mismatch (operator-supplied delta differs from recompute); interpretation_mismatch (operator-supplied label differs from re-derivation); interpretation_rule_unknown; host_mismatch; sat_review_does_not_attest_this_improvement; consent_scope_mismatch; embedded-key-liar (signer_public_key_pem changed) → still `improvement_signature_invalid` because verifier uses `--pubkey`.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; all required local checks clean.
- [ ] Does NOT yet add a CLI surface (`dema perf snapshot`, `dema perf compare`, etc.) — that is **PERF-1C**.
- [ ] Does NOT yet produce a measured improvement receipt as part of normal flow — that is **PERF-1D**.

## 11. Boundary

This preflight document is text-only. Its boundary block:

```json
{
  "runtime_code_changed": false,
  "private_key_exported": false,
  "network_used": false,
  "federation_used": false,
  "external_benchmark_claimed": false,
  "production_performance_claimed": false,
  "real_time_monitoring_dashboard_emitted": false,
  "non_deterministic_interpretation_accepted": false
}
```

PERF-1A, PERF-1B, PERF-1C, and PERF-1D will each carry their own boundary blocks and tighter scope statements.

## 12. What this preflight does NOT do

- Does NOT change any existing performance behavior, latency, or resource footprint.
- Does NOT introduce any new schema into a running envelope.
- Does NOT modify the operator's `~/.dema/` directory or any `DEMA_HOME` artifact.
- Does NOT take any measurement; no `process.hrtime` call ships in this slice, no metric is sampled, no host is fingerprinted.
- Does NOT make a security claim that Dema is now measurably optimized (it is not, yet — this is a design doc, not a shipped feature).
- Does NOT promise a specific implementation timeline for PERF-1A onward.
- Does NOT close the gap that any current speed claim must be qualified as "roughly" per `~/CLAUDE.md` ZANN discipline; closure requires PERF-1A + PERF-1B sealed and PERF-1D measured improvement receipts produced.
- Does NOT permit any surface (CLI, JSON, narrative line) to print "Dema is faster" until an `improvement_proof_hash` is referenced and the bundle verifies per §5.
- Does NOT establish cross-host comparability; same-host-only comparison is by design, and cross-host comparison is a future federation-class slice with a separate threat model.

## 13. What unlocks next

After this preflight is committed and remote-CI verified:

- **PERF-1A** (baseline snapshot kernel) begins — pure-function builder + verifier + measurement-harness gate, no CLI, no integration.
- **PERF-1B** (regression guard) follows, gated on PERF-1A sealed — adds `verifyImprovement` and the deterministic interpretation rule.
- **PERF-1C** (optimization proposal) follows, gated on PERF-1B sealed — introduces an internal proposal envelope for a candidate change, signed and reviewed before any measurement is permitted to claim it as the cause of a delta.
- **PERF-1D** (measured improvement receipt) follows, gated on PERF-1C sealed — produces real improvement receipts as part of the normal optimization flow, attested by SAT review and bound by KEYCONSENT-1A consent for `action_type=CLAIM_OPTIMIZATION`.

When PERF-1A + 1B + 1C + 1D are all sealed and remote-CI verified, the canon glossary entry for "self-optimization" can be promoted from DECLARED to MEASURED with cited test names + receipt hashes as evidence, and the `PERF_CLOSEOUT.md` pair-doc is written.

Until then, every speed claim Dema makes in any surface stays qualified per CLAUDE.md ZANN discipline: "roughly," "subjectively," "not yet measured" — never unqualified.

PDF §22 holds: _if it cannot be measured, it cannot be called optimization._
