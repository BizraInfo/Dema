# Threat Model — Dema (Local-First Sovereign Node)

- **Date:** 2026-06-02 (GST) · **Commit:** `b3e34af`
- **Method:** STRIDE applied to Dema's actual trust boundary. Controls cited are `[M]` measured in source on 2026-06-02; residual risks are stated, not minimized.

## 1. System boundary & assets

Dema is a **local-first CLI** with **no network runtime** and **no daemon**. Its only outbound socket target in source is `http://127.0.0.1:7421` — a gateway probe that is **unreachable-by-design** (the runtime gateway is not part of this repo). All persistent state lives under `DEMA_HOME` (default `~/.dema`).

**Trust boundary:** the line between (a) the operator's local machine + `DEMA_HOME` and (b) everything else (other processes, the filesystem outside `DEMA_HOME`, untrusted input strings, external AI artifacts pasted in).

**Assets to protect:**

| Asset                        | Why it matters                                                        |
| ---------------------------- | --------------------------------------------------------------------- |
| Author private key (Ed25519) | Binds identity to authorship receipts; compromise = forged provenance |
| Receipt / ledger chain       | Tamper-evidence for all strong claims (hash-chained)                  |
| Consent records              | Authorization for any mutating action (exact-string)                  |
| `DEMA_HOME` integrity        | All local sovereign state                                             |
| Claim discipline             | "no fake live/secure/validated/economic/federated claim before proof" |

**Sovereignty model:** PAT serves the user · SAT serves the system · Dema bridges · FATE guards. (SAT ×228, PAT ×158, FATE ×22 references in source `[M]`.)

## 2. STRIDE analysis

### S — Spoofing

- **Threat:** forged authorship or a fake node identity.
- **Controls `[M]`:** Ed25519 keypairs (`generateKeyPair` ×2); authorship receipts bind a `public_key_fingerprint = sha256(...)`; verification re-derives and checks the signature against the external public key.
- **Residual:** identity binding (key generation / DID) is gated behind explicit operator GO (halt-gate), but a compromised local account can still generate keys. Out of scope for a local-first model; mitigated by OS-level user isolation.

### T — Tampering

- **Threat:** alteration of receipts, ledgers, or consent records.
- **Controls `[M]`:** SHA-256 content addressing (×431); hash chains (`prev_hash` ×105, `chain_root` ×21); `stableStringify` canonicalization **before** hashing prevents serialization-malleability; 1,892 `Object.freeze` calls block in-memory mutation of issued artifacts; receipt-store **symlink containment** (writes confined under `DEMA_HOME`).
- **Residual:** chains are **linear, not Merkle** — tamper-evidence is per-chain, not batch-aggregated. A Merkle root over receipt batches (already computed for proof-of-priority) would strengthen this. The writer recomputes the body hash _after_ a forbidden-field check, so injected fields cannot silently change body bytes.

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
- **Residual:** no runtime resource governor beyond static caps; a malicious local actor with filesystem access is out of scope (they already own the machine).

### E — Elevation of Privilege

- **Threat:** performing a mutating/identity/network action without authorization.
- **Controls `[M]`:** exact-string consent (`exact_lookup_only`) — broad "proceed" does not authorize mutate/commit/push; fail-closed default (wrong consent → no mutation); typed-GO human approval for identity-binding and shared-system actions; tool boundaries declared and attested; anti-prompt-injection defenses (refuse fetch-and-execute + silent-fact-change) present in 7+ modules and tests.
- **Residual:** enforcement of some assumption-gates is "invoked-not-enforcing" in preview surfaces (declaration, not runtime block) — correctly **not overclaimed** as live enforcement.

## 3. Anti-prompt-injection (agentic-specific)

External AI artifacts (pasted plans/code) are treated as **context, not authority**: every command/path/function is verified before use; "fetch-and-execute" and "silent fact change" requests are refused. The Qwen-branch screen is a worked example — third-party AI code was screened, rejected wholesale, and only two ideas salvaged via local TDD.

## 4. Out-of-scope (by design)

- Network/transport security (no network runtime).
- Multi-tenant isolation (single sovereign operator).
- Federation/custody proofs (gated; `federation_started=false`).
- OS / hardware compromise (assumed-trusted local machine).

## 5. Open hardening items (no overclaim)

1. Merkle-aggregate receipt batches for cross-receipt tamper-evidence.
2. Structured, redaction-aware local logging with `correlation_id`.
3. Formal enforcement (not just declaration) of assumption-gates in mutating paths.
4. Signed package releases (Sigstore / npm provenance) when published.

## 6. Status label

`MEASURED` for all cited controls (verified in source 2026-06-02). Residual risks and §5 items are stated gaps, deliberately unclosed.
