# Phase 3 · Audit Gatherer Pseudocode

**Pseudocode-bundle file:** `phase_03_audit_gatherer_pseudocode.md`
**Target modules:**
- `scripts/audit/node0-proof-of-truth-control-plane.mjs` (I/O)
- `apps/cli/src/proof-snapshot-audit-gatherer.js` (thin wrapper)

## I/O boundary responsibilities

| Layer | May read env | May read git | May read files |
| --- | --- | --- | --- |
| Kernel (`node0-ci-evidence-attestation.js`) | NO | NO | NO |
| Audit script | YES (attestation supply only) | YES (`rev-parse HEAD`) | YES (attestation path) |
| CLI gatherer | NO (delegates to audit) | NO | NO |

## Pseudocode: load attestation

```text
FUNCTION loadCiEvidenceAttestation():

  inline ← process.env.DEMA_CI_EVIDENCE_ATTESTATION_JSON
  path ← process.env.DEMA_CI_EVIDENCE_ATTESTATION_PATH

  raw ← inline
  IF raw IS NULL AND path exists on disk:
    raw ← readFileSync(path, utf8)

  IF raw IS NULL:
    RETURN null

  TRY:
    RETURN JSON.parse(raw)
  CATCH error:
    THROW "invalid CI evidence attestation JSON"
```

## Pseudocode: build gathered input (post-bridge)

```text
FUNCTION buildGatheredInput():

  commit ← readGitCommit()
  IF commit IS NULL:
    THROW "git commit unavailable"

  baseInput ← {
    commit,
    checks: { ...local rails true..., codeql/gitleaks/bizra_review_gate: UNKNOWN },
    workflows: { ci_matrix/codeql/gitleaks: UNKNOWN, seals: PENDING or SKIPPED },
    coverage, perf, claims: [], risks: [R-AUDIT-001], release_mode
  }

  attestation ← loadCiEvidenceAttestation()
  IF attestation IS NULL:
    RETURN { input: baseInput, attestation: null, attestation_merged: false }

  verified ← verifyNode0CiEvidenceAttestation(attestation)
  IF NOT verified.ok:
    THROW "attestation verify failed: " + verified.blocked_by

  merge ← mergeCiEvidenceAttestationIntoGatheredInput(baseInput, attestation)
  IF NOT merge.merged:
    THROW "attestation merge failed: " + merge.blocked_by

  RETURN { input: merge.input, attestation, attestation_merged: true }
```

## Pseudocode: run audit

```text
FUNCTION runNode0ProofOfTruthControlPlaneAudit({ hermetic }):

  IF hermetic:
    ledger ← buildNode0ProofOfTruthControlPlane(HERMETIC_FIXTURE)
    RETURN { ledger, hermetic: true, ci_evidence_attestation: null, attestation_merged: false }

  { input, attestation, attestation_merged } ← buildGatheredInput()
  ledger ← buildNode0ProofOfTruthControlPlane(input)

  RETURN {
    ledger,
    hermetic: false,
    release_mode: input.release_mode,
    ci_evidence_attestation: attestation,
    attestation_merged
  }
```

## Removed pattern (explicit non-goal)

```text
// DO NOT USE in gatherer after bridge:
codeql ← readAdvisoryStatus("DEMA_PROOF_CODEQL_STATUS")
gitleaks ← readAdvisoryStatus("DEMA_PROOF_GITLEAKS_STATUS")
```

Raw env rail promotion is replaced by attestation verify + merge.

## Operator supply contract

| Variable | Purpose |
| --- | --- |
| `DEMA_CI_EVIDENCE_ATTESTATION_JSON` | Inline JSON attestation object |
| `DEMA_CI_EVIDENCE_ATTESTATION_PATH` | Filesystem path to attestation JSON |

Attestation `commit` field MUST equal `git rev-parse HEAD` at gather time.

## Future slice hooks (not implemented here)

```text
// CI export job writes attestation artifact post-matrix
// Operator runs: export-ci-evidence-attestation.mjs → file → PATH env
// Optional: Ed25519 signature over receipt_hash (separate slice)
```
