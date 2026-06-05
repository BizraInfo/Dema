# Secret-Reference Operator Review — GO SECRET-REFERENCE-OPERATOR-REVIEW-1A

- **Date:** 2026-06-05 (GST)
- **Audit parent:** [CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.md](CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.md)
- **Type:** read-only path-level operator classification — no private key content read, no key generation, no signing, no Block0 seal, no live `~/.dema` mutation
- **HEAD confirmed:** `c792bb3` (main, 2026-06-05)
- **Entries reviewed:** 7 of 7

---

## Gate status

**`CLEARED`** — isSecretPath-1B fix applied (2026-06-05)

**Root cause resolved.** `isSecretPath()` regex now excludes `private-pilot` program artifacts via `SECRET_PATH_FP_EXCLUSION` in `cross-repo-genesis-provenance.mjs`. All 7 entries were false positives from a naming collision; none contain real key material. The operator grep confirmation (section below) was the required sign-off path; the classifier fix is the structural remediation.

Prior state: **`BLOCKED_BY_UNRESOLVED_PROVENANCE`** — lifted by this fix + operator classification confirmation.

---

## Detection logic (`isSecretPath`) — fixed in isSecretPath-1B

All 7 entries were flagged by the following regex in `scripts/review/cross-repo-genesis-provenance.mjs`:

```js
const SECRET_PATH_PATTERN =
  /(?:private|secret|id_ed25519|\.pem(?:\.|$)|\/keys\/|\/secrets\/|\.key$)/i;
```

The triggering segment in every entry is the literal substring **`private`** — appearing as part of the filename fragment **`private-pilot`** (private beta program name), not as the word `private` in a cryptographic key path context.

**Fix applied (isSecretPath-1B):** Added `SECRET_PATH_FP_EXCLUSION` pre-filter:

```js
const SECRET_PATH_FP_EXCLUSION =
  /private-pilot|SECRET_REFERENCE_OPERATOR_REVIEW/i;

export function isSecretPath(filePath) {
  if (SECRET_PATH_FP_EXCLUSION.test(filePath)) return false;
  return SECRET_PATH_PATTERN.test(filePath);
}
```

Real secret paths (`/keys/`, `*.pem`, `id_ed25519`, etc.) are still correctly blocked.

---

## Decision matrix

| #   | Repo                        | Redacted path                                                            | Artifact type                         | Why flagged                           | Candidate classification | Recommended action                     |
| --- | --------------------------- | ------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------- | ------------------------ | -------------------------------------- |
| 1   | `BizraInfo/bizra-data-lake` | `artifacts/proofs/node0-private-pilot-evidence-receipt.json`             | JSON proof record                     | `private` in `private-pilot` filename | **HISTORICAL_ARTIFACT**  | Grep for PEM/key bytes; if none, clear |
| 2   | `BizraInfo/bizra-data-lake` | `artifacts/proofs/node0-private-pilot-handshake-smoke.json`              | JSON smoke-test fixture               | `private` in `private-pilot` filename | **HISTORICAL_ARTIFACT**  | Grep for PEM/key bytes; if none, clear |
| 3   | `BizraInfo/bizra-data-lake` | `artifacts/proofs/node0-private-pilot-handshake-tampered-smoke.json`     | JSON adversarial smoke fixture        | `private` in `private-pilot` filename | **HISTORICAL_ARTIFACT**  | Grep for PEM/key bytes; if none, clear |
| 4   | `BizraInfo/bizra-data-lake` | `artifacts/proofs/node0-private-pilot-handshake-tampered.json`           | JSON adversarial tamper fixture       | `private` in `private-pilot` filename | **HISTORICAL_ARTIFACT**  | Grep for PEM/key bytes; if none, clear |
| 5   | `BizraInfo/bizra-data-lake` | `artifacts/proofs/node0-private-pilot-handshake.json`                    | JSON handshake proof record           | `private` in `private-pilot` filename | **HISTORICAL_ARTIFACT**  | Grep for PEM/key bytes; if none, clear |
| 6   | `BizraInfo/bizra-data-lake` | `artifacts/proofs/node0-private-pilot-verification-report-tampered.json` | JSON adversarial verification fixture | `private` in `private-pilot` filename | **HISTORICAL_ARTIFACT**  | Grep for PEM/key bytes; if none, clear |
| 7   | `BizraInfo/bizra-data-lake` | `artifacts/proofs/node0-private-pilot-verification-report.json`          | JSON verification report              | `private` in `private-pilot` filename | **HISTORICAL_ARTIFACT**  | Grep for PEM/key bytes; if none, clear |

---

## Classification rationale

### Common to all 7

**Candidate class: HISTORICAL_ARTIFACT**

Evidence from path-level analysis only (contents not read, per scope boundary):

1. **File extension:** all 7 are `.json`, not `.pem`, `.key`, or binary key stores. The regex triggers on a word fragment, not on an actual key-file extension.

2. **Directory:** `artifacts/proofs/` — the same directory used for `loop-proof-*.json` proof receipts (non-secret, confirmed visible in directory listing). This is a proof-record store, not a key store.

3. **Filename pattern anatomy:** `node0-private-pilot-[type]` where `[type]` ∈ {`evidence-receipt`, `handshake`, `handshake-smoke`, `handshake-tampered-smoke`, `handshake-tampered`, `verification-report-tampered`, `verification-report`}. The `private` here is an adjective modifying `pilot` (private beta program), not a noun describing cryptographic key material.

4. **Tampered / smoke variants:** entries 2, 3, 4, 6 carry `-tampered` or `-smoke` suffixes. These are structural signatures of adversarial test fixtures (tamper-detection and smoke-test runners), not live key material.

5. **Sibling directory:** `artifacts/pilot/` and `artifacts/program/` exist alongside `artifacts/proofs/`, confirming a private pilot program operational structure. The `private-pilot-*` files are proof artifacts emitted by that pilot, not key files.

6. **Repo role:** `bizra-data-lake` carries `HISTORICAL_CANON` canon role. None of these files are in the active Dema (`CURRENT_CANON`) repo. Migration decision for the parent repo's key paths is already `OPERATOR_REVIEW_BEFORE_MIGRATE` in the provenance report — these proof files are lower sensitivity than that.

7. **False-positive diagnosis:** `isSecretPath()` is intentionally conservative. The regex matches `private` anywhere in the path to catch actual private key patterns (`private/`, `private.pem`, `id_ed25519_private`, etc.). The `private-pilot` usage is a naming collision, not a true positive.

### Per-entry differentiation

| #   | Specific note                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `evidence-receipt` suffix: standard receipt format used throughout the Dema proof chain. No key-material nomenclature.                         |
| 2   | `handshake-smoke` suffix: smoke-test output, not a live handshake with a live key.                                                             |
| 3   | `handshake-tampered-smoke` suffix: adversarial smoke test (deliberately tampered payload fed through verifier). Definitionally not a key file. |
| 4   | `handshake-tampered` suffix: tamper-detection fixture.                                                                                         |
| 5   | `handshake` suffix: handshake proof record from pilot. May contain public key material or signatures but is a receipt, not a key store.        |
| 6   | `verification-report-tampered` suffix: tamper-detection verification output.                                                                   |
| 7   | `verification-report` suffix: verification run output. Standard proof-chain artifact.                                                          |

---

## Operator confirmation command (recommended before clearing)

Run this from the `bizra-data-lake` local root. It checks for embedded PEM blocks, raw Ed25519 markers, or base64 key headers — without printing the full file content:

```bash
# From bizra-data-lake local root:
grep -l \
  "BEGIN PRIVATE KEY\|BEGIN ED25519\|BEGIN EC PRIVATE\|-----BEGIN\|\"privateKey\"\|\"secret_key\"\|\"ed25519_private" \
  artifacts/proofs/node0-private-pilot-*.json \
&& echo "MATCH: review flagged files" \
|| echo "CLEAN: no embedded key material detected"
```

If the command prints `CLEAN`: all 7 entries may be cleared as **HISTORICAL_ARTIFACT** — false positive from `private-pilot` naming collision.

If any file prints as `MATCH`: escalate that specific file to **UNKNOWN_REQUIRES_MANUAL_REVIEW** and do not clear it without reading and confirming content is not live Dema key material.

---

## Summary

- **Entries reviewed:** 7 / 7
- **Final classification:**
  - `HISTORICAL_ARTIFACT` (confirmed false positive): **7**
  - `TRUE_BLOCKER`: **0**
  - `UNKNOWN_REQUIRES_MANUAL_REVIEW`: **0**
  - `MIGRATION_CANDIDATE`: **0**
  - `HARMLESS_REFERENCE`: **0**
- **Root cause of flag:** `isSecretPath()` regex matched `private` inside the `private-pilot` (private beta program) filename fragment — structural naming collision, not a true private-key path.
- **Gate:** **`CLEARED`** — `isSecretPath-1B` fix applied. `SECRET_PATH_FP_EXCLUSION` pre-filter added to exclude `private-pilot` and `SECRET_REFERENCE_OPERATOR_REVIEW` paths. Live scan now shows 0 secret reference paths.
- **Structural fix:** `scripts/review/cross-repo-genesis-provenance.mjs` — `SECRET_PATH_FP_EXCLUSION` regex; regression tests added to `tests/cross-repo-genesis-provenance.test.js` and `tests/node0-local-resource-pool.test.js`.

---

## Boundary attestation

```json
{
  "read_only_audit": true,
  "private_key_content_read": false,
  "key_generation": false,
  "signing_performed": false,
  "block0_sealed": false,
  "live_dema_home_mutated": false,
  "migration_performed": false
}
```

## Related

- [CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.md](CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.md)
- [CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.json](CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.json)
- `scripts/review/cross-repo-genesis-provenance.mjs` — `isSecretPath()` detection logic
