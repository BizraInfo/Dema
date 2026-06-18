# Threat Model — Dema (Local-First Sovereign Node)

- **Date:** 2026-06-18 (GST) · **Commit:** `8b71682` · **Refresh:** `THREAT-MODEL-REFRESH-1A`
- **Method:** STRIDE applied to Dema's actual trust boundary. Controls cited as `[M]` were measured in source on the cited date; residual risks are stated, not minimized.
- **Baseline:** 2026-06-02 STRIDE pass (`b3e34af`) retained; this refresh adds 1A proof-spine and uninstall-containment controls landed through PR #179–#180.

## 1. System boundary & assets

Dema is a **local-first CLI** with **no public-network runtime** and **no daemon**. Its network-capable surfaces are local loopback only: the Node0 gateway probe/adapter at `http://127.0.0.1:7421` (gateway runtime is outside this repo), optional Ollama model probes/invocation at `http://localhost:11434` / `http://127.0.0.1:11434`, and LM Studio inventory/safety checks at `http://127.0.0.1:1234` where model commands are used. These are local operator endpoints, not federation or public transport. All persistent state lives under `DEMA_HOME` (default `~/.dema`).

**Trust boundary:** the line between (a) the operator's local machine + `DEMA_HOME` and (b) everything else (other processes, the filesystem outside `DEMA_HOME`, untrusted input strings, external AI artifacts pasted in).

**Assets to protect:**

| Asset                        | Why it matters                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Author private key (Ed25519) | Binds identity to authorship receipts; compromise = forged provenance             |
| Receipt / ledger chain       | Tamper-evidence for all strong claims (hash-chained)                              |
| Consent records              | Authorization for any mutating action (exact-string)                              |
| `DEMA_HOME` integrity        | All local sovereign state                                                         |
| Claim discipline             | "no fake live/secure/validated/economic/federated claim before proof"             |
| Proof-spine closure          | Fail-closed rails before advance/settle on genesis, signature, pulse, fresh-state |

**Sovereignty model:** PAT serves the user · SAT serves the system · Dema bridges · FATE guards. (SAT ×228, PAT ×158, FATE ×22 references in source `[M]` on 2026-06-02 baseline.)

## 2. STRIDE analysis

### S — Spoofing

- **Threat:** forged authorship or a fake node identity.
- **Controls `[M]`:** Ed25519 keypairs (`generateKeyPair` ×2); authorship receipts bind a `public_key_fingerprint = sha256(...)`; verification re-derives and checks the signature against the external public key.
- **Residual:** identity binding (key generation / DID) is gated behind explicit operator GO (halt-gate), but a compromised local account can still generate keys. Out of scope for a local-first model; mitigated by OS-level user isolation.

### T — Tampering

- **Threat:** alteration of receipts, ledgers, or consent records.
- **Controls `[M]`:** SHA-256 content addressing (×431); hash chains (`prev_hash` ×105, `chain_root` ×21); `stableStringify` canonicalization **before** hashing prevents serialization-malleability; 1,892 `Object.freeze` calls block in-memory mutation of issued artifacts; receipt-store **symlink containment** (writes confined under `DEMA_HOME`).
- **Controls `[M]` (1A refresh):** `PROOF-SPINE-GUARD-1A` fail-closed reason codes on canonical receipt build/verify (`packages/receipts/src/canonical-receipt.js`, `canonical-ledger.js`): empty genesis body, empty signature, quarantined pulse decisions blocked from settle/mint paths.
- **Controls `[M]` (1A refresh):** read-only combined validator `validateProofSpineGuard` (`packages/receipts/src/proof-spine-guard.js`, schema `bizra.dema.proof_spine_guard.v0.1`) returns `allowed_to_advance` / `allowed_to_settle` / `refusal_receipt_allowed` with substrate-parity codes: `GENESIS_RECEIPT_EMPTY`, `LEDGER_SIGNATURE_EMPTY`, `PULSE_QUARANTINED_NO_SETTLEMENT`, `FRESH_STATE_RECEIPT_UNSIGNED` (with `UNSIGNED_DEV_ONLY` / `UNSIGNED_FALLBACK` escape hatch for dev-only unsigned fresh-state).
- **Controls `[M]` (1A refresh):** LCC/G-ladder reference guard `auditProofSpineLayers` (`packages/core/src/proof-spine-lcc-guard.js`) verifies declared proof-layer `boundary_ref` / `test_scaffold_ref` / `mock_ref` resolve on disk, `delivery_check_marker` strings still appear in `scripts/delivery-check.mjs`, and `claim_map_status === BOUNDARY_NON_CLAIM_ONLY`; orchestrated read-only in `scripts/review/proof-spine-guard.mjs` and wired into `npm run check`.
- **Residual:** chains are **linear, not Merkle** — tamper-evidence is per-chain, not batch-aggregated. LCC audit currently consumes the canonical G-ladder **example manifest** (`scripts/g-ladder-layer-index-mock.mjs`), not a live registry writer — drift between manifest and production registry is an audit gap until a registry-backed source ships. The writer recomputes the body hash _after_ a forbidden-field check, so injected fields cannot silently change body bytes.

### R — Repudiation

- **Threat:** operator or system denies having performed an action.
- **Controls `[M]`:** durable receipts for strong claims; `audit_trail` (×77), `attestation` (×257), `EVIDENCE_INDEX` (×18); boundary-attestation keys recorded per action (`mutation_performed`, `runtime_execution_performed`, etc.).
- **Residual:** no centralized timestamp authority for _every_ receipt (OpenTimestamps anchors document priority, not each runtime receipt). Acceptable for local scope.

### I — Information Disclosure

- **Threat:** secrets or private data leaking via output, logs, or receipts.
- **Controls `[M]`:** secrets read only from `process.env` (no hardcoded secrets — heuristic scan clean); redaction surfaces (×95); forbidden-field validators reject e.g. `private_key` in serialized bodies; boundary attestations assert `network_used=false` by default; JSON mode writes machine output to stdout and human/intro text to **stderr** to keep stdout parseable and leak-free.
- **Residual:** 326 ad-hoc `console.*` calls are the disclosure surface to audit; no structured-logging redaction layer. A `correlation_id`-tagged structured log with a redaction filter would harden this (see Observability gap).

### D — Denial of Service

- **Threat:** unbounded work from hostile input (huge files, catastrophic regex, infinite loops).
- **Controls `[M]`:** bounded-by-design caps throughout — `MAX_ITERATIONS` (×37), `maxFiles` (×27), `maxDepth` (×13), `MAX_PROMPT_LENGTH`, `MAX_*_BYTES`, `timeoutMs` (×47); a prior ReDoS finding was fixed by linearizing the integration-check regex; a sync intent-length DoS bound was added via TDD. Oversized lines/files are skipped, not processed.
- **Controls `[M]` (1A refresh):** `dema uninstall` / `removeSetup` rejects unsafe remove roots (`unsafe_remove_root`) before any dry-run or destructive path — blocks repo root, filesystem root, home directory, and paths inside `process.cwd()` even when `DEMA_HOME` is mis-set (`packages/installer/src/setup.js`; `tests/setup-lifecycle.test.js`, `tests/setup-uninstall-cli.test.js`).
- **Residual:** no runtime resource governor beyond static caps; a malicious local actor with filesystem access is out of scope (they already own the machine).

### E — Elevation of Privilege

- **Threat:** performing a mutating/identity/network action without authorization.
- **Controls `[M]`:** exact-string consent (`exact_lookup_only`) — broad "proceed" does not authorize mutate/commit/push; fail-closed default (wrong consent → no mutation); typed-GO human approval for identity-binding and shared-system actions; tool boundaries declared and attested; anti-prompt-injection defenses (refuse fetch-and-execute + silent-fact-change) present in 7+ modules and tests.
- **Controls `[M]` (1A refresh):** proof-spine guard refuses advance/settle when genesis, signature, pulse quarantine, or unsigned fresh-state preconditions fail; signed refusal receipts remain valid non-settling proof (`refusal_receipt_allowed`).
- **Controls `[M]` (1A refresh):** uninstall requires exact consent phrase **and** `validateRemoveRoot` pass — prevents elevation to delete the working tree or operator home via misconfigured `DEMA_HOME`.
- **Residual:** enforcement of some assumption-gates is "invoked-not-enforcing" in preview surfaces (declaration, not runtime block) — correctly **not overclaimed** as live enforcement. `validateProofSpineGuard` is read-only/composable — not yet wired into every mutating runtime path in Dema face; check-gate coverage ≠ full runtime interception.

## 3. Anti-prompt-injection (agentic-specific)

External AI artifacts (pasted plans/code) are treated as **context, not authority**: every command/path/function is verified before use; "fetch-and-execute" and "silent fact change" requests are refused. The Qwen-branch screen is a worked example — third-party AI code was screened, rejected wholesale, and only two ideas salvaged via local TDD.

## 4. Proof-spine 1A guard matrix (read-only audit surface)

| Reason code                       | Meaning                                    | Primary surfaces                                                             |
| --------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `GENESIS_RECEIPT_EMPTY`           | Empty/missing genesis receipt object       | `validateProofSpineGuard`, canonical receipt build/verify                    |
| `LEDGER_SIGNATURE_EMPTY`          | Missing/blank signature                    | `validateProofSpineGuard`, canonical ledger verify                           |
| `PULSE_QUARANTINED_NO_SETTLEMENT` | Quarantined/rejected/review pulse decision | `validateProofSpineGuard`, canonical receipt build                           |
| `FRESH_STATE_RECEIPT_UNSIGNED`    | Fresh-state key missing without dev marker | `validateProofSpineGuard` (`UNSIGNED_DEV_ONLY` / `UNSIGNED_FALLBACK` exempt) |

**Check gate:** `node scripts/review/proof-spine-guard.mjs` (also in `npm run check`). **Tests:** `tests/proof-spine-guard.test.js` (7 tests). **Boundary:** no signing, no key generation, no claim-map writes, no delivery-check rewrite.

## 5. Out-of-scope (by design)

- Public network/transport security (Dema exposes no public-network runtime; loopback endpoint hardening is local-operator scope).
- Multi-tenant isolation (single sovereign operator).
- Federation/custody proofs (gated; `federation_started=false`).
- OS / hardware compromise (assumed-trusted local machine).
- Substrate parity in `bizra-data-lake` (separate consent gate: `FIX PROOF-SPINE-GUARD-1A IN BIZRA-DATA-LAKE`).

## 6. Open hardening items (no overclaim)

1. Merkle-aggregate receipt batches for cross-receipt tamper-evidence.
2. Structured, redaction-aware local logging with `correlation_id`.
3. Formal enforcement (not just declaration) of assumption-gates in mutating paths.
4. Signed package releases (Sigstore / npm provenance) when published.
5. LCC ref audit: constrain layer refs to repo-relative paths before `join()` (review finding PR #180).
6. `validateProofSpineGuard`: fail-closed on non-object/null input instead of throw (review finding PR #180).
7. `validateProofSpineGuard`: accept canonical receipt field aliases from `buildCanonicalReceipt` / ledger loaders (review finding PR #180).
8. Registry-backed G-ladder manifest for LCC audit (replace mock example input).

## 7. Status label

`MEASURED` for all cited controls verified on the cited dates. 1A refresh controls verified in source and tests on 2026-06-18 (`8b71682`). Legacy quantitative counts in §2 marked 2026-06-02 are retained as baseline unless re-audited. Residual risks and §6 items are stated gaps, deliberately unclosed.
