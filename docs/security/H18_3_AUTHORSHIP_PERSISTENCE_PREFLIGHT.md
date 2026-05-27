# H18.3 Authorship Persistence Preflight

Security risk classification for Ed25519 key persistence. This document
must pass before any private key touches disk.

## 1. Evidence Snapshot

| Field              | Value                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| Base commit        | `874e689` (remote CI verified)                                             |
| H18.1 commit       | `d35e606` (Ed25519 authorship signature core)                              |
| H18.2 commit       | `464deeb` (authorship verify + demo CLI)                                   |
| Local tests        | 3052/3052 PASS                                                             |
| Remote CI          | gitleaks SUCCESS, CodeQL SUCCESS, check SUCCESS, BIZRA Review Gate SUCCESS |
| Open CodeQL alerts | 17 (classified in section 5)                                               |
| Harness            | CLEAN / 5 gates / 3 probes / 6 hooks                                       |

## 2. H18.3 Intended Capability

```
dema authorship sign <artifact-path> --consent "SIGN AUTHORSHIP RECEIPT"
```

Behavior:

- Read the artifact at the given path.
- Compute SHA-256 of the artifact content.
- Load or generate an Ed25519 keypair from `DEMA_HOME/keys/`.
- Build an authorship payload using `stableStringify`.
- Sign the payload.
- Write the signed receipt to `DEMA_HOME/receipts/authorship-<sha256>.json`.
- Report the receipt path and verification status.

## 3. Non-Goals

- No federation or cross-node key sharing.
- No token issuance or economic claim.
- No network call of any kind.
- No automatic or batch signing.
- No reusable broad consent (one phrase = one signing act).
- No private key export in normal flow.
- No key derived from password or passphrase (pure Ed25519 random).
- No HSM or TPM integration (local file only for v0.1).

## 4. Key Storage Proposal

| Aspect               | Decision                                                       | Rationale                                                                                                                                             |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Path                 | `DEMA_HOME/keys/node0-ed25519.pem`                             | Single key per node. Follows DEMA_HOME isolation.                                                                                                     |
| Format               | PKCS#8 PEM (Node.js native)                                    | `crypto.createPrivateKey()` reads PKCS#8 directly. No custom format.                                                                                  |
| File permissions     | `0o600` (owner read/write only)                                | Standard private key permission. Enforced at write time via `fs.writeFile` mode.                                                                      |
| Encryption at rest   | None for v0.1                                                  | Node.js `generateKeyPairSync` does not support passphrase for Ed25519. Disk encryption is the operator's responsibility. Documented as a known limit. |
| Rotation             | Manual only for v0.1                                           | `dema authorship rotate-key --consent "ROTATE AUTHORSHIP KEY"` is a future H18.4+ feature. Old key archived, not deleted.                             |
| Recovery             | No automatic recovery                                          | If key is lost, generate a new one. Old receipts remain verifiable via embedded public key.                                                           |
| Delete               | `dema authorship delete-key --consent "DELETE AUTHORSHIP KEY"` | Future H18.4+. Must confirm zero pending receipts or accept orphaned history.                                                                         |
| Public key companion | `DEMA_HOME/keys/node0-ed25519.pub.pem`                         | Written alongside private key. Used by `dema authorship verify` for local lookups.                                                                    |

## 5. CodeQL Alert Classification

17 open alerts at commit `464deeb`, classified against H18.3 key persistence risk.

| #   | Rule                                 | File                                 | Line | Relevant to H18.3? | Blocking? | Reason                                                                                                                                                                              |
| --- | ------------------------------------ | ------------------------------------ | ---- | ------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `js/file-system-race`                | `receipt-store.js`                   | 141  | Yes                | No        | TOCTOU between stat and read. Receipt store is read-only list/show. H18.3 uses a separate write path with atomic rename (witness-receipt pattern). Does not affect key persistence. |
| 2   | `js/file-system-race`                | `index.js`                           | 2466 | No                 | No        | Dashboard HTML injection. Unrelated to authorship or keys.                                                                                                                          |
| 3   | `js/redos`                           | `integration-check.mjs`              | 73   | No                 | No        | Regex in CI review script. Not in runtime path. Not reachable from CLI.                                                                                                             |
| 4   | `js/incomplete-sanitization`         | `first-run.test.js`                  | 116  | No                 | No        | Test helper. Not in production code.                                                                                                                                                |
| 5   | `js/incomplete-sanitization`         | `first-run.test.js`                  | 125  | No                 | No        | Test helper. Not in production code.                                                                                                                                                |
| 6   | `js/superfluous-trailing-arguments`  | `sat-boundary-verifier.js`           | 173  | No                 | No        | Extra arg to function call. No security impact. Not in authorship path.                                                                                                             |
| 7   | `js/useless-assignment-to-local`     | `profile-foundation-preview.test.js` | 238  | No                 | No        | Unused assignment in test. No security impact.                                                                                                                                      |
| 8   | `js/useless-assignment-to-local`     | `profile-foundation-preview.test.js` | 224  | No                 | No        | Same as above.                                                                                                                                                                      |
| 9   | `js/useless-assignment-to-local`     | `onboarding-lifecycle.test.js`       | 262  | No                 | No        | Unused assignment in test.                                                                                                                                                          |
| 10  | `js/useless-assignment-to-local`     | `node-registry-preview.test.js`      | 294  | No                 | No        | Unused assignment in test.                                                                                                                                                          |
| 11  | `js/useless-assignment-to-local`     | `node-registry-preview.test.js`      | 287  | No                 | No        | Unused assignment in test.                                                                                                                                                          |
| 12  | `js/useless-assignment-to-local`     | `node0-state-preview.test.js`        | 71   | No                 | No        | Unused assignment in test.                                                                                                                                                          |
| 13  | `js/useless-assignment-to-local`     | `homebase-language-picker.js`        | 300  | No                 | No        | Unused assignment in production code but not in authorship/receipt path.                                                                                                            |
| 14  | `js/useless-assignment-to-local`     | `homebase-language-picker.js`        | 296  | No                 | No        | Same as above.                                                                                                                                                                      |
| 15  | `js/identity-replacement`            | `chat-router.js`                     | 253  | No                 | No        | Replace '-' with '-' is a no-op. Not in authorship path.                                                                                                                            |
| 16  | `js/unvalidated-dynamic-method-call` | `active-kernel-banner.test.js`       | 25   | No                 | No        | Dynamic method in test. Not in production code.                                                                                                                                     |
| 17  | `js/unvalidated-dynamic-method-call` | `gateway-http-adapter.test.js`       | 60   | No                 | No        | Dynamic method in test. Not in production code.                                                                                                                                     |

**Summary: 0 alerts are blocking for H18.3.**

The one alert with relevance (`js/file-system-race` in `receipt-store.js`)
is in the read path, not the write path. H18.3's write path will follow the
`witness-receipt.js` atomic-rename pattern (write to temp file with `wx`
flag, then `rename`), which is not subject to this TOCTOU.

## 6. Threat Model

| #   | Threat                                     | Severity | Probability | Mitigation                                                                                              | Test Required                                              |
| --- | ------------------------------------------ | -------- | ----------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| T1  | Private key leaked to stdout/logs          | High     | Low         | Never log or print `private_key_pem`. Redact in all JSON output.                                        | Test: receipt JSON does not contain private key substring. |
| T2  | Private key written with wrong permissions | High     | Low         | Use `fs.writeFile` with `{ mode: 0o600 }`. Verify after write.                                          | Test: stat key file, assert mode is `0o600`.               |
| T3  | Path traversal in artifact path            | High     | Low         | Reject artifact paths containing `..` or absolute paths outside repo. Resolve and check prefix.         | Test: `../../../etc/passwd` rejected.                      |
| T4  | Signing without consent                    | High     | Low         | Exact-string consent gate. No fuzzy match, no prefix, no clipboard.                                     | Test: missing consent exits 1. Wrong phrase exits 1.       |
| T5  | Tampered receipt accepted as valid         | High     | Low         | `verifyPayload` uses `stableStringify` canonical form. Any mutation invalidates signature.              | Already tested in H18.1 (tamper detection test).           |
| T6  | Key file overwritten silently              | Medium   | Medium      | Check existence before generate. Require `--force` or rotate command.                                   | Test: second generate without `--force` exits 1.           |
| T7  | Receipt written outside DEMA_HOME          | Medium   | Low         | Receipt path computed from `DEMA_HOME/receipts/` only. No user-supplied output path in v0.1.            | Test: receipt lands under DEMA_HOME.                       |
| T8  | Race condition on key file                 | Low      | Low         | Key generation is a one-time operation. Single operator, single node. No concurrent generation in v0.1. | Not required for v0.1. Document as known limit.            |

## 7. Consent Gate

```
Exact phrase: "SIGN AUTHORSHIP RECEIPT"
Freshness:    one signing act per consent invocation
Scope:        signs exactly the artifact at the given path
Revocation:   not applicable (consent is per-act, not persistent)
```

Key generation consent (first-time only):

```
Exact phrase: "GENERATE AUTHORSHIP KEY"
Freshness:    one-time per key lifecycle
Scope:        generates keypair and writes to DEMA_HOME/keys/
```

## 8. Acceptance Criteria for H18.3

All must pass before H18.3 can be considered complete:

- [ ] `blocking_count == 0` in this preflight (verified: 0)
- [ ] Private key never appears in stdout, JSON output, or logs
- [ ] Key file written with mode `0o600`
- [ ] `dema authorship verify` remains read-only (no regression)
- [ ] `dema authorship sign` requires exact consent phrase
- [ ] Key generation requires separate exact consent phrase
- [ ] Saved receipt is content-addressed (`authorship-<sha256>.json`)
- [ ] Receipt JSON contains embedded public key PEM (for independent verification)
- [ ] Tests include: tamper, wrong key, missing consent, path traversal, permission check
- [ ] `npm test`, `npm run check`, smoke, and harness remain green
- [ ] No new CodeQL alerts introduced

## 9. Boundary

```json
{
  "h18_2_1_boundary": {
    "key_generated": false,
    "key_persisted": false,
    "receipt_signed": false,
    "receipt_saved": false,
    "network_used": false,
    "federation_used": false,
    "token_minted": false,
    "runtime_authority_expanded": false,
    "document_written": true,
    "risk_classified": true
  }
}
```
