# URP-3.0 — Universal Resource Pool Local Index Preflight

Risk classification and design preflight for Stage 3 of the BIZRA
Lifecycle (`docs/canon/BIZRA_LIFECYCLE_SEED_TO_POOL.md`). This document
must pass before any URP indexer code ships.

## 1. Context

H18 + H19 made Stage 2 (Verify) MEASURED. Stage 3 (Index) is currently
DESIGNED_NOT_LIVE. The operator's intent (2026-05-28):

> Dema's role in Node0 is to process and clean and index the verified
> resources in BIZRA's Universal Resource Pool, using Proof of Impact
> for minting the first tokens for BIZRA based on the verified work
> in the last 3 years.

Indexing a corpus is not the same as verifying one receipt. The risk
class changes from "this artifact's signature is valid" to "this
collection of artifacts is composed in a way that makes claims about
the operator's body of work." Composition is a new claim surface.

## 2. URP-3.1 Intended Capability

```
dema urp index [--rebuild] [--json]
dema urp index list [--json]
```

Behavior:

- Read `DEMA_HOME/receipts/authorship-*.json`
- For each, run deep verify (using H19.3.0 kernel)
- For verified-only entries, write to `DEMA_HOME/urp/index.json`
- Each entry carries: receipt filename + artifact_sha256 + author_fingerprint + verdict + operator_tag (optional)
- Index is local-only. No share. No mint. No federation.

## 3. Non-Goals (Stage 3 boundary)

- No share/keep decision (that is Stage 4)
- No mint candidate (that is Stage 5)
- No federation (separate later stage)
- No PoI economic claim
- No legal identity assertion
- No production readiness claim
- No "this work is valuable" claim
- No automatic tagging or ML inference about resource content

## 4. Compositional Claim Risk Classification

The four risks Stage 3 introduces beyond Stage 2:

| #   | Risk                                                                                                | Mitigation                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Unverified entry pollution** — the index includes a resource that wasn't actually deep-verified   | Every index entry MUST carry the passport_hash of a verified Proof Passport. Index builder calls deep-verify on every candidate. FAILED receipts are excluded with a recorded reason.             |
| R2  | **Privacy leak via metadata** — operator's keep-only resources surface in the index                 | Index defaults to MARKED_LOCAL_ONLY. Only resources with explicit operator action move to MARKED_SHAREABLE (Stage 4). The index file lives at `DEMA_HOME/urp/index.json` with mode 0o600.         |
| R3  | **Federation overclaim** — operator or external tool reads the index as if it were a shareable pool | The index schema MUST embed `mode: "LOCAL_INDEX_ONLY"` and `truth_label: "LOCAL_VERIFIED_RESOURCE_INDEX"`. Any code that exports the index without operator consent is a Bridge Rule 6 violation. |
| R4  | **Premature mint wiring** — code reads the index as a list of mint candidates                       | The index entry schema MUST NOT contain any field named `mint_candidate`, `token_eligible`, or similar. Mint binding (Stage 5) requires Stage 4 SHARE decision first. Index is silent on mint.    |

## 5. Proposed Index Entry Schema

```json
{
  "schema": "bizra.dema.urp_local_index_entry.v0.1",
  "added_at": "<ISO8601>",
  "passport_hash": "<sha256 of stable passport body>",
  "receipt_filename": "authorship-<sha256>.json",
  "artifact_sha256": "<hex>",
  "author_fingerprint": "<sha256 of SPKI DER>",
  "verdict": "VERIFIED",
  "deep_verify_passed": true,
  "operator_tag": null,
  "share_status": "MARKED_LOCAL_ONLY",
  "truth_label": "LOCAL_VERIFIED_RESOURCE_INDEX"
}
```

Required fields:

- `passport_hash` — bridge back to Stage 2 evidence
- `share_status` — locked to `MARKED_LOCAL_ONLY` in URP-3.1; Stage 4 adds `MARKED_SHAREABLE` / `MARKED_KEEP`
- `deep_verify_passed: true` — only true entries get written

Forbidden fields:

- Raw artifact content
- Private key material
- Token mint candidate references
- Legal identity claims
- Cross-node references (federation is later)

## 6. Index File Properties

| Aspect       | Decision                                                        |
| ------------ | --------------------------------------------------------------- |
| Path         | `DEMA_HOME/urp/index.json`                                      |
| Format       | Single JSON document with `entries: []` and stable `index_hash` |
| File mode    | `0o600` (operator-only read/write)                              |
| Atomic write | Temp file + rename pattern (matches H18.3B receipt write)       |
| Rebuild      | `--rebuild` flag re-scans receipts dir; otherwise incremental   |
| Operator tag | Optional free-text; written by Stage 4 surface, not by indexer  |

## 7. Stage 3 Bridge Rules (composition discipline)

Adding to the 7 lifecycle bridge rules:

```
Rule 8.  Every index entry traces back to exactly one verified passport.
Rule 9.  Index never asserts value, importance, or impact — only existence
         of verified work.
Rule 10. Index file is read-only to non-Dema processes (0o600).
Rule 11. Index rebuild is idempotent: same receipts dir → same index_hash.
Rule 12. Entry removal requires explicit operator action; the index
         doesn't garbage-collect implicitly.
```

## 8. Acceptance Criteria for URP-3.1

All must pass before URP-3.1 can be considered complete:

- [ ] `dema urp index` populates `DEMA_HOME/urp/index.json` only from deep-verified receipts
- [ ] Failed deep-verify excludes entry with recorded reason
- [ ] Index file mode is `0o600`
- [ ] Index schema matches §5 (frozen object, no forbidden fields)
- [ ] No private key material in index
- [ ] No raw artifact content in index
- [ ] No mint candidate field
- [ ] `share_status` locked to `MARKED_LOCAL_ONLY` in v0.1
- [ ] `--rebuild` is idempotent (same receipts → same index_hash)
- [ ] `dema urp index list` is read-only
- [ ] No CLI flag exports the index to network or another node
- [ ] Tests cover: empty home, one verified receipt, one tampered receipt
      excluded, multi-receipt deterministic ordering, no-private-key leak,
      no-artifact-content leak, mode 0o600, idempotent rebuild
- [ ] Docs in `ARCHITECTURE.md` + `TESTING.md` updated
- [ ] CI green at the URP-3.1 commit

## 9. What This Preflight Does NOT Do

- Does not create the URP index file
- Does not write the indexer module
- Does not authorize sharing
- Does not enable Stage 4 (Choose)
- Does not enable Stage 5 (Mint)
- Does not assert any resource has economic value
- Does not federate with any other node

## 10. Boundary

```json
{
  "urp_3_0_preflight_boundary": {
    "code_written": false,
    "index_created": false,
    "share_enabled": false,
    "mint_enabled": false,
    "federation_enabled": false,
    "operator_action_required": false,
    "private_key_loaded": false,
    "network_used": false,
    "token_minted": false,
    "document_written": true,
    "risk_classified": true
  }
}
```

## 11. Next Step

After this preflight is remote-CI-sealed:

```
URP-3.1 — Local Index v0.1
```

Implementation scope per §8 acceptance criteria. No Stage 4 work
until URP-3.1 is sealed. No Stage 5 work until Stage 4 is sealed.

Last updated: 2026-05-28 at commit `5f8b4d3` (BIZRA Lifecycle bridge sealed).
