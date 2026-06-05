# Cross-Repo Genesis Provenance Audit — CROSS-REPO-GENESIS-PROVENANCE-1A

- **Date:** 2026-06-05 (GST)
- **Branch:** `feat/block0-live-readiness`
- **Type:** read-only provenance audit — no key generation, private-key read, signing, migration, Block0 seal, federation, or public economy claim
- **Schema:** `bizra.dema.cross_repo_genesis_provenance.v0.1`
- **Machine summary:** [CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.json](CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.json)

## Replay

```bash
# Live Dema home precheck (read-only)
node scripts/block0-live-readiness.mjs --json

# Cross-repo inventory (uses gh API + optional local clones)
node scripts/review/cross-repo-genesis-provenance.mjs

# Hermetic unit tests
node --test tests/cross-repo-genesis-provenance.test.js

# Key ceremony preflight (read-only — does not generate keys)
node scripts/node0-genesis-key-ceremony-preflight.mjs --json
```

Set `CROSS_REPO_SKIP_GH=1` to run without GitHub code search (local path scan + fixtures only).

## Scope

Six repositories:

| Repo                            | Visibility | Archived | Canon role                                                    |
| ------------------------------- | ---------- | -------- | ------------------------------------------------------------- |
| `BizraInfo/Dema`                | PUBLIC     | no       | **CURRENT_CANON** — active product face + Block0 proof kernel |
| `BizraInfo/bizra-data-lake`     | PUBLIC     | no       | **HISTORICAL_CANON** + omega/runtime substrate                |
| `BizraInfo/BIZRA-OS`            | PRIVATE    | no       | **IMPLEMENTATION_CANDIDATE** — future runtime UI              |
| `BizraInfo/bizra-genesis-node`  | PRIVATE    | yes      | **ARCHIVED_REFERENCE** (distinct from canon archive below)    |
| `BizraInfo/bizra-node0-genesis` | PUBLIC     | yes      | **ARCHIVED_REFERENCE** — Dema three-repo canon archive        |
| `BizraInfo/bizra_scaffold`      | PUBLIC     | yes      | **ARCHIVED_REFERENCE** — bootstrap scaffold                   |

**Naming trap (verified):** `bizra-genesis-node` and `bizra-node0-genesis` are **different** archived repositories. Dema canon ([THREE_REPO_PRODUCT_STACK_CANON_v0_1.md](../THREE_REPO_PRODUCT_STACK_CANON_v0_1.md)) names `bizra-node0-genesis` as the archive authority.

## Repo metadata (measured 2026-06-05)

| Repo                | Default branch | Last push (UTC)      | Local root used         | gh code index              |
| ------------------- | -------------- | -------------------- | ----------------------- | -------------------------- |
| Dema                | main           | 2026-06-04T23:29:56Z | workspace               | 262 artifacts              |
| bizra-data-lake     | main           | 2026-05-08T21:45:24Z | `<LOCAL_PATH_REDACTED>` | 602 artifacts              |
| BIZRA-OS            | main           | 2026-01-26T02:16:01Z | none                    | metadata only (rate limit) |
| bizra-genesis-node  | main           | 2026-03-04T16:01:55Z | none                    | metadata only (rate limit) |
| bizra-node0-genesis | main           | 2026-02-19T17:44:38Z | none                    | metadata only (rate limit) |
| bizra_scaffold      | main           | 2026-03-12T20:31:07Z | none                    | metadata only (rate limit) |

**Limitation:** GitHub code search hit API rate limits mid-scan. Artifact counts above are complete for Dema + bizra-data-lake; archive/private repos retain metadata via `gh repo view` only in this run. Re-run the scanner after rate reset for a full six-repo code index.

## Dema live-home reconciliation

Measured against operator `DEMA_HOME` (default `~/.dema`):

| Signal                             | Value       | Truth label                     |
| ---------------------------------- | ----------- | ------------------------------- |
| `operator_pubkey_present`          | **false**   | MEASURED (live home)            |
| `poi_rule_verifiable`              | **false**   | MEASURED (no pubkey / drift)    |
| `ceremony_required`                | **true**    | MEASURED                        |
| Slots needing operator private key | **11 / 12** | MEASURED (Block0 kernel design) |
| Only verifier-only slot now        | `poi_rule`  | MEASURED                        |

**Professional correction:** “Node0 genesis Ed25519 key is missing” is **true for the current Dema live home**. It is **not** a claim that BIZRA never had identity/key architecture — historical substrate and archive repos contain genesis/key implementations (see highlights below).

## Artifact summary

| Status class                 | Count (indexed) |
| ---------------------------- | --------------- |
| CURRENT_CANON                | 187             |
| HISTORICAL_CANON             | 159             |
| IMPLEMENTATION_CANDIDATE     | 411             |
| TEST_FIXTURE                 | 100             |
| SECRET_REFERENCE_DO_NOT_READ | 7               |

Secret references: **path-only**, contents not read.

## Highlighted cross-repo artifacts

| Repo                | Path                                                    | Class                    | Migration decision             |
| ------------------- | ------------------------------------------------------- | ------------------------ | ------------------------------ |
| Dema                | `packages/genesis/src/block0-live-readiness.js`         | CURRENT_CANON            | INHERIT_ACTIVE                 |
| Dema                | `scripts/block0-live-readiness.mjs`                     | CURRENT_CANON            | INHERIT_ACTIVE                 |
| Dema                | `packages/genesis/src/block0-judge-from-proofs.js`      | CURRENT_CANON            | INHERIT_ACTIVE                 |
| Dema                | `tests/block0-seal-readiness.test.js`                   | TEST_FIXTURE             | IGNORE                         |
| bizra-data-lake     | `runtime/src/sovereignty/key.rs`                        | IMPLEMENTATION_CANDIDATE | OPERATOR_REVIEW_BEFORE_MIGRATE |
| bizra-data-lake     | `bizra-omega/bizra-resourcepool/src/genesis.rs`         | HISTORICAL_CANON         | REFERENCE_ONLY                 |
| bizra-data-lake     | `bizra-node0/docs/GENESIS_100_GATE.md`                  | HISTORICAL_CANON         | REFERENCE_ONLY                 |
| bizra-data-lake     | `docs/GENESIS_STATE.md`                                 | HISTORICAL_CANON         | REFERENCE_ONLY                 |
| BIZRA-OS            | `components/GenesisProofCard.tsx`                       | IMPLEMENTATION_CANDIDATE | OPERATOR_REVIEW_BEFORE_MIGRATE |
| BIZRA-OS            | `README.md` (Genesis Block 0 / Merkle claims)           | SPEC_ONLY                | REFERENCE_ONLY                 |
| bizra-node0-genesis | (archive — marketing/docs drift flagged in prior audit) | ARCHIVED_REFERENCE       | IGNORE_UNLESS_OPERATOR_REVIEW  |
| bizra-genesis-node  | (archive — multi-agent consensus prototype)             | ARCHIVED_REFERENCE       | IGNORE_UNLESS_OPERATOR_REVIEW  |

Full index (864 rows) available by re-running the scanner; committed JSON is a **summary** without secret content.

## Decision matrix

| Category                           | Action                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| **Inherit (active)**               | Dema Block0 kernel, live-readiness assessor, authorship/H19 surfaces already in Dema tests  |
| **Reference only**                 | data-lake genesis docs, GENESIS_100 gate material, absorbed provenance ledger               |
| **Operator review before migrate** | data-lake `sovereignty/key.rs`, BIZRA-OS genesis UI — do not auto-import                    |
| **Ignore unless operator review**  | archived `bizra-genesis-node`, `bizra-node0-genesis`, `bizra_scaffold`                      |
| **Blocks key ceremony**            | 7 secret-reference paths — operator must confirm no duplicate live keys before any ceremony |

## Next gate

**`BLOCKED_BY_UNRESOLVED_PROVENANCE`**

Reason: 7 `SECRET_REFERENCE_DO_NOT_READ` artifacts were discovered across the cross-repo inventory. Unresolved secret references require operator review — confirm no duplicate live keys exist before any key ceremony proceeds.

**Required action:** Operator must review each secret-reference path listed in the decision matrix (`secret_reference_count: 7`), confirm none contain live Dema key material, then re-run the provenance scanner. Once the scan reports zero secret-reference or live-proof-candidate artifacts that block the ceremony, the next gate will advance to `NODE0-GENESIS-KEY-CEREMONY-1A`.

**Preflight (read-only):** run `node scripts/node0-genesis-key-ceremony-preflight.mjs` before `dema authorship key init`. The preflight reads the committed provenance JSON; it will remain blocked until the gate is resolved.

**Not yet:**

- Block0 seal ceremony
- Automatic migration from archive repos
- Treating data-lake readiness tiers or omni-audit claims as Dema-live MEASURED truth

## Boundary attestation

```json
{
  "read_only_audit": true,
  "runtime_execution": false,
  "mutation_performed": false,
  "private_key_read": false,
  "signing_performed": false,
  "migration_performed": false,
  "block0_sealed": false
}
```

## Related canon

- [THREE_REPO_PRODUCT_STACK_CANON_v0_1.md](../THREE_REPO_PRODUCT_STACK_CANON_v0_1.md)
- [REPO_TRUTH_CLASSIFICATION.md](../canon/REPO_TRUTH_CLASSIFICATION.md)
- [\_absorbed/BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md](../_absorbed/BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md)
- [security/BLOCK0_0_PREFLIGHT.md](../security/BLOCK0_0_PREFLIGHT.md)
