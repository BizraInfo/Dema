# Phase 1 · Requirements · Edge Cases · Constraints

**Pseudocode-bundle file:** `phase_01_requirements.md`
**Maps to:** user contract `NODE0-CI-EVIDENCE-ATTESTATION-BRIDGE-1A`
**Goal:** lock the evidence bridge before (or while) implementation ships.

## Problem statement

Prior advisory CI rails could be promoted by setting raw environment variables
(`DEMA_PROOF_CODEQL_STATUS`, etc.). That pattern is easy to misuse and hard to
audit. The bridge introduces a structured, hashable attestation that Dema can
verify locally without network.

```text
CI evidence → attestation object → verifier → proof snapshot attachment → READY_LOCAL eligibility
```

## Functional requirements

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-1 | Attestation schema is `bizra.dema.node0_ci_evidence_attestation.v0.1` | TDD-CEA-01 |
| FR-2 | Truth label is `NODE0_CI_EVIDENCE_ATTESTATION_LOCAL_ONLY` | TDD-CEA-01 |
| FR-3 | Attestation includes `commit`, `rails`, `evidence_source`, `receipt_hash`, `boundary` | TDD-CEA-01 |
| FR-4 | Required rails: `ci_matrix`, `codeql`, `gitleaks` each in `PASS\|FAIL\|UNKNOWN` | TDD-CEA-08 |
| FR-5 | `receipt_hash` is `sha256:` + stable hash of body excluding hash field | TDD-CEA-05 |
| FR-6 | Verifier blocks missing commit, `UNKNOWN` commit sentinel, missing hash | TDD-CEA-03, TDD-CEA-04 |
| FR-7 | Verifier blocks any boundary flag not strictly true | TDD-CEA-07 |
| FR-8 | Verifier blocks `claimed_release_verdict` of `READY_REMOTE` or `PUBLIC_SAFE` | TDD-CEA-06 |
| FR-9 | Merge applies rails only when attestation verifies and commit matches gathered input | TDD-CEA-09, TDD-CEA-10 |
| FR-10 | All three rails `PASS` sets `bizra_review_gate: PASS` on merged input | TDD-CEA-09 |
| FR-11 | Audit gatherer loads attestation from `DEMA_CI_EVIDENCE_ATTESTATION_JSON` or `_PATH` only | TDD-AUDIT-01 |
| FR-12 | Without attestation, gathered audit keeps advisory rails `UNKNOWN` and `BLOCKED` verdict | TDD-PSA-02 |
| FR-13 | With valid attestation, convergence reports `ready_local_eligible: true` and `READY_LOCAL` | TDD-PC-12 |
| FR-14 | Without attestation, convergence reports `PROOF_ATTACHED_ADVISORY_BLOCKED` | TDD-PC-06 |
| FR-15 | Full convergence + attested rails → `compose_status: PROOF_ATTACHED_READY_LOCAL` | TDD-PC-13 |
| FR-16 | Review gate `node0-ci-evidence-attestation-check.mjs` wired in `npm run check` | TDD-CEA-13 |
| FR-17 | Hermetic `npm run proof:truth:check` remains unaffected | TDD-PT-01 |

## Edge cases

| ID | Case | Expected behavior |
| --- | --- | --- |
| EC-1 | Attestation JSON malformed | Audit gatherer throws; convergence fails closed |
| EC-2 | Attestation verify fails | Audit gatherer throws with blocked_by codes |
| EC-3 | Attestation commit ≠ git HEAD | Merge refused; audit does not promote rails |
| EC-4 | Rail omitted in attestation body | Normalized to `UNKNOWN` at build time |
| EC-5 | Rail value not in allowed set | Verifier adds `invalid_rail_*` |
| EC-6 | `require_pass_rails` with any rail not `PASS` | `ready_local_rails_eligible` false |
| EC-7 | Tampered `receipt_hash` | Verifier reports `receipt_hash_mismatch` |
| EC-8 | Tampered boundary after hash computed | Verifier fails (hash or boundary check) |
| EC-9 | Attestation present but convergence claims all PARTIAL | `PROOF_ATTACHED_PARTIAL_CONVERGENCE` (still `READY_LOCAL` on ledger) |
| EC-10 | Hermetic audit mode (`--hermetic`) | Ignores attestation; uses control-plane fixture |

## Non-functional constraints

| ID | Constraint |
| --- | --- |
| C-1 | Kernel in `packages/core/src/` — no fs, git, network, or `process.env` |
| C-2 | I/O only in `scripts/audit/` and CLI gatherer wrapper |
| C-3 | Max auto-verdict remains `READY_LOCAL` |
| C-4 | All boundary preview flags on compose surfaces remain all-false |
| C-5 | Each implementation file < 500 lines unless justified |
| C-6 | No hard-coded secrets, tokens, or production config in specs or code |
| C-7 | New env vars registered in `scripts/review/env-hygiene-check.mjs` |

## Attestation schema (canonical)

```json
{
  "schema": "bizra.dema.node0_ci_evidence_attestation.v0.1",
  "truth_label": "NODE0_CI_EVIDENCE_ATTESTATION_LOCAL_ONLY",
  "commit": "<git sha>",
  "rails": {
    "ci_matrix": "PASS",
    "codeql": "PASS",
    "gitleaks": "PASS"
  },
  "evidence_source": "operator_supplied_or_ci_exported",
  "receipt_hash": "sha256:<stable-body-hash>",
  "boundary": {
    "local_only": true,
    "no_network_required": true,
    "not_remote_seal": true,
    "not_public_safe_claim": true
  }
}
```

## Out of scope

- Fetching CI status from GitHub Actions API inside Dema.
- Signing attestations with operator keys (future slice).
- Promoting to `READY_REMOTE` or public-safe publication.
- Replacing hermetic proof-truth check with gathered attestation in CI matrix.
