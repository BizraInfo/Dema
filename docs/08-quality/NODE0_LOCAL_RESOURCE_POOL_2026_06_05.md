# Node0 Local Resource Pool — NODE0-LOCAL-RESOURCE-POOL-1A

- **Date:** 2026-06-05 (GST)
- **HEAD:** `c792bb3` (main)
- **Type:** read-only local resource pool indexer — no key generation, private-key read, signing, migration, Block0 seal, public network, token claims, or secret file content reads
- **Schema:** `bizra.dema.node0_local_resource_pool.v0.1`
- **Machine summary:** [NODE0_LOCAL_RESOURCE_POOL_2026_06_05.json](NODE0_LOCAL_RESOURCE_POOL_2026_06_05.json)

---

## Replay

```bash
# Live scan (redacted local paths, no network)
node scripts/review/node0-local-resource-pool.mjs

# Hermetic unit tests
node --test tests/node0-local-resource-pool.test.js

# Full test gate
npm test
```

Set `NODE0_POOL_SKIP_SCAN=1` to run in hermetic mode (fixture-only, no filesystem walk).

---

## Gate status

**`DEMA-AGENT-REGISTRY-1A`** ✓ cleared by isSecretPath-1B (2026-06-05)

`isSecretPath()` now excludes `private-pilot` program artifacts and `SECRET_REFERENCE_OPERATOR_REVIEW` doc labels via `SECRET_PATH_FP_EXCLUSION` in `cross-repo-genesis-provenance.mjs`.  
Live scan: **0 secret reference paths**. All 7 prior `private-pilot` FPs and the 1 doc-label FP are now correctly classified as non-secret.

Operator sign-off: confirmed — root cause was classifier naming collision, not real key material. See [SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md](SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md).

---

## Scope

Six repositories from the provenance catalog, plus `DEMA_HOME` local state:

| Repo                            | Visibility | Archived | Canon role                   | Local status   |
| ------------------------------- | ---------- | -------- | ---------------------------- | -------------- |
| `BizraInfo/Dema`                | PUBLIC     | no       | **CURRENT_CANON**            | FOUND          |
| `BizraInfo/bizra-data-lake`     | PUBLIC     | no       | **HISTORICAL_CANON**         | FOUND          |
| `BizraInfo/BIZRA-OS`            | PRIVATE    | no       | **IMPLEMENTATION_CANDIDATE** | NOT_CONFIGURED |
| `BizraInfo/bizra-genesis-node`  | PRIVATE    | yes      | **ARCHIVED_REFERENCE**       | NOT_CONFIGURED |
| `BizraInfo/bizra-node0-genesis` | PUBLIC     | yes      | **ARCHIVED_REFERENCE**       | NOT_CONFIGURED |
| `BizraInfo/bizra_scaffold`      | PUBLIC     | yes      | **ARCHIVED_REFERENCE**       | NOT_CONFIGURED |

---

## Repo file counts (measured 2026-06-05)

| Repo               | Files scanned | Truncated | Languages (top 3)     | Proof assets | Test surfaces | Secret refs |
| ------------------ | ------------- | --------- | --------------------- | ------------ | ------------- | ----------- |
| Dema               | 847           | no        | `.md`, `.js`, `.json` | 50           | 50            | 0           |
| bizra-data-lake    | 2000          | yes       | `.json`, `.md`, `.py` | 50           | 0             | 0           |
| DEMA_HOME          | —             | —         | mixed                 | —            | —             | 0           |
| 4 × NOT_CONFIGURED | —             | —         | —                     | 0            | 0             | 0           |

**Total files indexed:** 3,847 (bizra-data-lake scan truncated at 2,000; full count higher).

---

## Artifact category distribution

| Category                           | Count |
| ---------------------------------- | ----- |
| `LOCAL_ASSET`                      | 356   |
| `LOCAL_PROOF`                      | 417   |
| `LOCAL_REPO`                       | 0     |
| `LOCAL_DATASET`                    | 146   |
| `LOCAL_COMPUTE_CAPABILITY`         | 495   |
| `HISTORICAL_ARTIFACT`              | 634   |
| `MIGRATION_CANDIDATE`              | 1,366 |
| `SECRET_REFERENCE_DO_NOT_READ`     | 0     |
| `UNKNOWN_REQUIRES_OPERATOR_REVIEW` | 175   |

**Migration candidates** (1,366) are predominantly code files in `bizra-data-lake` classified under `HISTORICAL_CANON`. They require `OPERATOR_REVIEW_BEFORE_MIGRATE` per the provenance decision matrix. No automatic migration is performed.

---

## Secret reference map (path-only — no content read)

**0 entries.** All prior false positives resolved by `isSecretPath-1B` classifier fix (2026-06-05).

| Prior FP                                                                  | Resolution                                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 7 × `artifacts/proofs/node0-private-pilot-*.json` (`bizra-data-lake`)     | `SECRET_PATH_FP_EXCLUSION` now excludes `private-pilot` program names                 |
| `docs/08-quality/SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md` (`Dema`) | `SECRET_PATH_FP_EXCLUSION` now excludes `SECRET_REFERENCE_OPERATOR_REVIEW` doc labels |

See [SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md](SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md) for full classification rationale and operator sign-off.

---

## Proof assets (sample)

Top proof assets found in `BizraInfo/Dema` (path-level metadata only, content not read):

- `PROOF_SUMMARY.md` / `PROOF_SUMMARY.md.ots`
- `artifacts/proofs/node0-local-urp/` — 7+ URP proof records
- `proof-of-priority/PIN.md` and associated artifacts
- `docs/08-quality/` — quality gate records including provenance and secret-reference reviews

---

## Migration candidates (sample)

Top migration candidates from `bizra-data-lake` (code in `HISTORICAL_CANON` role, 20 shown of 1,366 total):

- `UNIFIED-NODE-INSTALLER/` — Python bootstrap and core (PAT engine, network node, main)
- `archive/downloads-files-7-2026-04-17/` — Rust crates (`admissibility_freeze_v1.rs`, `eval_v1.rs`, `dema_cli_v02_organize.rs`) and Python scripts

Decision: `OPERATOR_REVIEW_BEFORE_MIGRATE` — no automatic migration performed.

---

## Next recommended gate

**`DEMA-AGENT-REGISTRY-1A`**

> NODE0-LOCAL-RESOURCE-POOL-1A complete; no secret reference blockers detected. Suggest DEMA-AGENT-REGISTRY-1A as next gate per delivery spine.

Cleared by `isSecretPath-1B` fix (2026-06-05). Live scan: 0 secret reference paths. Operator sign-off confirmed per [SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md](SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md).

---

## Boundary attestation

```json
{
  "read_only": true,
  "network_used": false,
  "secret_content_read": false,
  "mutation_performed": false,
  "key_generated": false,
  "signing_performed": false,
  "block0_sealed": false,
  "federation_started": false
}
```

---

## Related

- [SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md](SECRET_REFERENCE_OPERATOR_REVIEW_2026_06_05.md) — operator review of the 7 private-pilot secret-reference false positives
- [CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.md](CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.md) — parent provenance audit
- `scripts/review/node0-local-resource-pool.mjs` — scanner implementation
- `tests/node0-local-resource-pool.test.js` — 21 hermetic tests
