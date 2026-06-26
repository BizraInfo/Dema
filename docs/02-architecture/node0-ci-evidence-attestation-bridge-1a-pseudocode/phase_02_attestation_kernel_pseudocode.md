# Phase 2 · Attestation Kernel Pseudocode

**Pseudocode-bundle file:** `phase_02_attestation_kernel_pseudocode.md`
**Target module:** `packages/core/src/node0-ci-evidence-attestation.js`
**Layer:** PURE — no I/O

## Module exports

```text
NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA
NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL
CI_EVIDENCE_RAIL_STATUSES
CI_EVIDENCE_REQUIRED_RAILS
CI_EVIDENCE_ATTESTATION_OVERCLAIM_VERDICTS
CI_EVIDENCE_ATTESTATION_PASS_FIXTURE

buildCiEvidenceAttestationBoundary()
buildNode0CiEvidenceAttestation(params)
verifyNode0CiEvidenceAttestation(attestation, opts)
ciEvidenceAttestationReadyForReadyLocal(attestation)
mergeCiEvidenceAttestationIntoGatheredInput(baseInput, attestation)
buildGatheredAuditResultWithCiEvidenceAttestation(baseInput, attestation)
buildAttestedPassAuditResult(commit)
runNode0CiEvidenceAttestation(params)
formatNode0CiEvidenceAttestation(attestation)
```

## Pseudocode: build attestation

```text
FUNCTION buildNode0CiEvidenceAttestation({ commit, rails, evidence_source, claimed_release_verdict }):

  normalizedRails ← for each key in REQUIRED_RAILS:
                        normalize to PASS | FAIL | UNKNOWN (default UNKNOWN)

  body ← {
    schema: ATTESTATION_SCHEMA,
    truth_label: ATTESTATION_TRUTH_LABEL,
    commit: String(commit ?? ""),
    rails: normalizedRails,
    evidence_source: String(evidence_source ?? "operator_supplied_or_ci_exported"),
    boundary: buildCiEvidenceAttestationBoundary()
  }

  IF claimed_release_verdict IS NOT NULL:
    body.claimed_release_verdict ← String(claimed_release_verdict)

  receipt_hash ← "sha256:" + sha256(stableStringify(body))

  RETURN deepFreeze({ ...body, receipt_hash })
```

## Pseudocode: verify attestation

```text
FUNCTION verifyNode0CiEvidenceAttestation(attestation, { require_pass_rails }):

  blocked_by ← []

  IF attestation.schema ≠ ATTESTATION_SCHEMA → blocked_by += invalid_schema; RETURN { ok: false, blocked_by }
  IF attestation.truth_label ≠ ATTESTATION_TRUTH_LABEL → blocked_by += invalid_truth_label
  IF commit missing or blank → blocked_by += missing_commit
  IF commit == "UNKNOWN" → blocked_by += commit_unknown_sentinel
  IF receipt_hash missing or not sha256-prefixed → blocked_by += missing_receipt_hash

  expectedHash ← computeHash(bodyWithoutReceiptHash)
  IF attestation.receipt_hash ≠ expectedHash → blocked_by += receipt_hash_mismatch

  FOR EACH flag IN boundary(local_only, no_network_required, not_remote_seal, not_public_safe_claim):
    IF flag ≠ true → blocked_by += boundary_<flag>

  IF claimed_release_verdict IN (READY_REMOTE, PUBLIC_SAFE) → blocked_by += overclaim_release_verdict

  FOR EACH rail IN REQUIRED_RAILS:
    IF rail status ∉ {PASS, FAIL, UNKNOWN} → blocked_by += invalid_rail_<rail>
    IF require_pass_rails AND status ≠ PASS → blocked_by += rail_<rail>_not_pass
    IF require_pass_rails AND status == UNKNOWN → blocked_by += rail_<rail>_unknown_when_pass_required

  RETURN { ok: blocked_by.empty?, blocked_by }
```

## Pseudocode: merge into gathered input

```text
FUNCTION mergeCiEvidenceAttestationIntoGatheredInput(baseInput, attestation):

  verified ← verifyNode0CiEvidenceAttestation(attestation)
  IF NOT verified.ok → RETURN { input: baseInput, merged: false, verified }

  IF String(attestation.commit) ≠ String(baseInput.commit):
    RETURN { input: baseInput, merged: false, verified, blocked_by: [commit_mismatch] }

  allPass ← every REQUIRED_RAIL status == PASS

  mergedInput ← {
    ...baseInput,
    checks: {
      ...baseInput.checks,
      codeql: attestation.rails.codeql,
      gitleaks: attestation.rails.gitleaks,
      bizra_review_gate: allPass ? PASS : UNKNOWN
    },
    workflows: {
      ...baseInput.workflows,
      ci_matrix: attestation.rails.ci_matrix,
      codeql: attestation.rails.codeql,
      gitleaks: attestation.rails.gitleaks
    },
    risks: baseInput.risks + [ attestation-applied risk record ]
  }

  RETURN { input: mergedInput, merged: true, verified, attestation }
```

## Pseudocode: build gathered audit with attestation

```text
FUNCTION buildGatheredAuditResultWithCiEvidenceAttestation(baseInput, attestation):

  merge ← mergeCiEvidenceAttestationIntoGatheredInput(baseInput, attestation)
  input ← merge.merged ? merge.input : baseInput
  ledger ← buildNode0ProofOfTruthControlPlane(input)

  RETURN deepFreeze({
    ledger,
    hermetic: false,
    release_mode: false,
    ci_evidence_attestation: attestation,
    attestation_merged: merge.merged
  })
```

## Invariants

| ID | Invariant |
| --- | --- |
| K-1 | Kernel never reads `process.env` |
| K-2 | Hash uses same `stableStringify` + `sha256` as consent-common / control plane |
| K-3 | Merge never mutates attestation object in place |
| K-4 | Overclaim verdicts rejected at verify time, not silently ignored |
