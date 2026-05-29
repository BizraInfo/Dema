# KEYCONSENT-2 · Single-use Nonce Registry / Replay Protection Preflight

**Status:** preflight design only; no runtime code; no key export; no federation; no public ledger; no cross-machine protection
**Sparse point:** after KEYCONSENT-1A pure kernel sealed (`89ad00b`), KEYCONSENT-1B verdict-attest gate (`b94c448`), and KEYCONSENT-1C CLI surfaces (local-complete in this session)
**Pair-doc (future):** `KEYCONSENT_2_CLOSEOUT.md` after KEYCONSENT-2A + 2B both sealed AND integrated into all three existing fail-closed gates (verdict-attest, authorship-sign, urp-choose)
**Date:** 2026-05-30 (Dubai · GST)

## 1. Current weakness

KEYCONSENT-1A consent proofs are protected by **scope binding** (`action_scope.target_hash` ties one consent to one input) and **expiration** (`expires_at_iso`, typically 5 minutes from `created_at_iso`) — and nothing else. Inside that validity window, the _same_ consent proof can be presented to the gate an arbitrary number of times. Each presentation re-passes structural validity, signature verification, scope match, and freshness — because all four checks are stateless functions of the envelope and the operator's pubkey.

For low-value mutations and short windows this is acceptable. For:

- high-stakes mutations (mint a verdict that commits to expensive downstream work),
- longer validity windows configured for slower workflows,
- any future workflow where consent is captured once and consumed in a multi-step gate,

…the lack of single-use semantics is a real gap. An attacker (or an honest-but-buggy caller) who has captured one valid consent bundle can replay it against the same target multiple times within the window.

The current verifier has **no record** that `"this nonce was already consumed for this action_type + target_hash"`. The `nonce` field exists on the envelope (32 bytes hex, generated fresh per `buildConsentProof` call) but is never consulted as a uniqueness key — it exists only to keep the signature material non-deterministic across calls.

KEYCONSENT-2 is the preflight for the slice that closes that gap _within one Node0_.

## 2. Target

Single-use semantics. Every consent proof binds to a globally-unique `nonce`. The registry records the nonces that have already been consumed. Presenting a previously-consumed nonce to the gate returns `consent_nonce_already_used` and the mutation is **rejected** — no receipt, no side effect, no chain advance.

Mechanism (in one line): _the first presentation of a consent proof's nonce wins; every subsequent presentation, even with otherwise-valid signature/scope/freshness, fails closed._

## 3. Registry schema

Two artifacts; no schema change to `bizra.dema.consent_proof.v0.1`.

**3.1 On-disk registry** — `$DEMA_HOME/consent/used-nonces.json`. JSON object mapping `nonce_hex` to a small record:

```text
{
  "<nonce_hex>": {
    "action_type":        "<e.g., SIGN_AUTHORSHIP_RECEIPT, MINT_VERDICT_RECEIPT, MARK_URP_SHAREABLE>",
    "target_hash":        "<sha256 hex of the consent's bound action_scope.target_hash>",
    "consumed_at_iso":    "<ISO-8601 UTC timestamp; recorded once at first consumption>",
    "consent_proof_hash": "<sha256 hex of the consent body — anchors the registry entry to the exact envelope>"
  },
  ...
}
```

File format rules:

- Atomic writes via `tmp + rename` (same pattern as `packages/urp/src/local-index-writer.js`).
- File mode `0o600` on first write and on every rewrite (writer must `fs.chmodSync` post-rename).
- Stable key order: nonce keys are emitted in insertion order; reader treats it as an unordered map.
- Containing directory `$DEMA_HOME/consent/` is created with mode `0o700` if missing.

**3.2 Consent envelope** — unchanged. The `nonce` field on `bizra.dema.consent_proof.v0.1` is already 32 bytes of hex per §3 of `KEYCONSENT_PREFLIGHT.md`. KEYCONSENT-2 only adds a new _reader_ of that field; the _writer_ (`buildConsentProof`) is untouched.

## 4. How action receipts reference nonce consumption

The action receipts that ride on a consent proof (verdict-attest, authorship-sign, urp-choose) gain ONE new boundary-block flag:

```text
consent_nonce_consumed: true
```

This appears in the **boundary block** of the action receipt body (the same boundary block the receipt already carries), not as a new top-level field. Verifiers that don't know about nonce consumption ignore the flag; verifiers that do know about it can cross-check the registry entry.

On a successful first consumption, the gate's CLI-mode response (the JSON the gate prints on stdout / writes to the bundle's sidecar) includes:

```text
registry_entry_hash: "<sha256 hex of stableStringify({nonce, action_type, target_hash, consumed_at_iso, consent_proof_hash})>"
```

This `registry_entry_hash` is a content-address of the registry record at consumption time. It is NOT signed by the operator's key (the action signature already covers the action body; the registry is a local fact, not a witness-class artifact). It exists so the operator-side audit can detect post-hoc tampering of `used-nonces.json` by recomputing the hash from the registry record and comparing.

## 5. Verification flow

A stranger who receives a bundle continues to use the KEYCONSENT-1A verification flow (steps 1–6 of `KEYCONSENT_PREFLIGHT.md §5`). The nonce check is **additive and optional**:

1. **Standard KEYCONSENT verification** — action signature, consent signature, consent→action binding, scope match, freshness. As in 1A. On any failure → reject with the existing reason code.
2. **Registry cross-check (if registry is supplied alongside the bundle)** — the verifier resolves `bundle.consent_proof.nonce`:
   - If the nonce is **NOT** in the supplied registry → consent has never been consumed on this Node0; if the action receipt nonetheless carries `consent_nonce_consumed: true`, reject with `consent_registry_inconsistent`.
   - If the nonce **IS** in the registry, the registry entry's `consent_proof_hash` must equal `sha256(stableStringify(consent_proof body excluding sig + proof_hash))` AND the entry's `target_hash` must equal `consent_proof.action_scope.target_hash`. On mismatch → `consent_registry_mismatch`.
3. **Verifier without registry** — verification continues to pass under KEYCONSENT-1A rules alone. The registry is local context; a stranger without it gets the 1A guarantees, no more, no less.

> **NOTE:** Cross-machine nonce replay is fundamentally a federation-class problem. A nonce consumed on Node0-A is not visible to Node0-B. This slice protects only within ONE Node0 (one `$DEMA_HOME`). Closing the cross-machine gap requires a shared, append-only, public nonce ledger — explicitly out of scope here and routed to a future federation slice.

## 6. Non-goals

This slice (KEYCONSENT-2, with sub-slices 2A and 2B) DOES NOT:

- Share nonces across machines or peers (requires federation; explicitly out of scope).
- Emit a public nonce ledger (no broadcast, no replication, no append-only chain published anywhere).
- Bind nonces to tokens, devices, or hardware (no TPM, no enclave, no per-device salt).
- Time-lock nonces beyond the consent proof's own `expires_at_iso` (registry has no TTL of its own; entries persist until the operator manually prunes).
- Automatically rotate, expire, or garbage-collect entries from `used-nonces.json` (no background job; no growth bound; pruning is operator-side and manual this slice).
- Provide a "reserve a nonce" API (commit-first only — `recordConsentNonce` is called AFTER the consent proof verifies and BEFORE the mutation persists; pre-reservation creates its own replay surface and is explicitly avoided).
- Associate nonces with any economic, commercial, or payment concept (no fees, no per-nonce cost, no marketplace).
- Add network calls of any kind (registry is a local file).
- Change the `bizra.dema.consent_proof.v0.1` schema.

## 7. Threat model

| Attacker                                      | Capability                                                                                                                  | KEYCONSENT-2 status                       | Why                                                                                                                                                                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Within-window replayer**                    | Captures one valid bundle; presents it to the same gate twice within the consent's validity window.                         | **BLOCKED**                               | First call records the nonce; second call reads the registry, sees the nonce, returns `consent_nonce_already_used`. No mutation.                                                                                                                             |
| **Registry-corruption replayer**              | Mangles `used-nonces.json` so it cannot be parsed; hopes the gate falls open and re-accepts a previously-consumed nonce.    | **BLOCKED (fail-closed)**                 | Reader treats `JSON.parse` failure as `nonce_registry_unavailable`; the gate refuses to record OR consume; the mutation is rejected. Operator must restore the registry before the gate proceeds.                                                            |
| **Nonce pre-emption attacker**                | Knows the nonce the operator is about to use; writes a registry entry first so the operator's real consent is rejected.     | **MITIGATED, not BLOCKED**                | The pre-emption requires write access to `$DEMA_HOME/consent/used-nonces.json`. Operator-side filesystem ACL is the defense. The registry file is mode `0o600`, owned by the operator UID, in a `0o700` parent. Same trust boundary as the private key file. |
| **Registry-tampering attacker**               | Alters an existing registry record (e.g., changes `target_hash`) to bind a previously-consumed nonce to a different target. | **DETECTABLE**                            | Operator-side audit recomputes `registry_entry_hash` from the on-disk record and compares against the value the action receipt embedded at consumption time. Mismatch surfaces tampering. Filesystem ACL is still the live-defense layer.                    |
| **Registry-deletion attacker**                | Wipes `$DEMA_HOME/consent/used-nonces.json` entirely.                                                                       | **FAIL-CLOSED (not silently re-allowed)** | Reader returns `nonce_registry_unavailable`; gate refuses to consume; the operator must explicitly rebuild OR explicitly accept the empty-registry state. The gate does NOT silently treat "missing file" as "all nonces are fresh."                         |
| **Cross-machine replay**                      | Captures a bundle on Node0-A; presents it to Node0-B (different `$DEMA_HOME`).                                              | **NOT BLOCKED — out of scope.**           | Node0-B's registry has no record of Node0-A's nonce; the bundle passes 2's local check. Cross-machine protection requires a federation-class shared ledger. Routed to a future slice.                                                                        |
| **Stale-window replayer (within expiration)** | Bundle captured; presented hours later while still within `expires_at_iso`; before this slice would have succeeded.         | **BLOCKED**                               | First presentation consumed the nonce. Second presentation fails with `consent_nonce_already_used` regardless of how much of the validity window remains.                                                                                                    |
| **Compromised-key attacker**                  | Has the operator's signing key; mints new consents with fresh nonces at will.                                               | **NOT BLOCKED — out of scope.**           | If the attacker holds the private key, the entire KEYCONSENT layer collapses. Filesystem ACL on `$DEMA_HOME/keys/node0-ed25519.pem` is the live defense, as called out in KEYCONSENT-0 §7.                                                                   |

## 8. Replay protection layers

Four layers now, increasing in cost and scope:

1. **Scope binding** — `action_scope.target_hash` ties one consent to one input. Cheap, fundamental. _In KEYCONSENT-1A._
2. **Expiration** — `expires_at_iso` time-bounds the consent. Cheap. _In KEYCONSENT-1A._
3. **One-process atomic ban (single-use nonce registry)** — `$DEMA_HOME/consent/used-nonces.json` records consumed nonces; the gate refuses repeat presentation within ONE `$DEMA_HOME`. _This slice (KEYCONSENT-2)._
4. **Cross-machine ledger** — shared, append-only registry across Node0 instances. **DEFERRED, federation-class.** Out of scope here; routed to a future slice paired with peer transport.

The default posture after KEYCONSENT-2 ships is layers 1 + 2 + 3. Layer 4 remains future work.

## 9. DOD for KEYCONSENT-2A (registry kernel slice)

Exit criteria for the IMMEDIATELY-FOLLOWING implementation slice (NOT this preflight). Nine testable items:

- [ ] **9.1** `packages/receipts/src/consent-nonce-registry.js` exports `recordConsentNonce({nonce, actionType, targetHash, consentProofHash, demaHome, consumedAtIso?})`. First call with a given `nonce` returns `{recorded: true, registry_entry_hash: "<sha256 hex>"}`. Repeat call with the SAME `nonce` returns `{recorded: false, error: "consent_nonce_already_used", existing_entry: {action_type, target_hash, consumed_at_iso, consent_proof_hash}}`. The existing entry is NOT overwritten on the repeat call.
- [ ] **9.2** Registry path resolution uses tmpdir-aware DEMA_HOME (`process.env.DEMA_HOME || path.join(os.homedir(), ".dema")`), matching every other writer in the repo. Tests inject a tmpdir-based `demaHome` and never touch the operator's real `~/.dema/`.
- [ ] **9.3** Atomic write: registry is written to `$DEMA_HOME/consent/used-nonces.json.tmp.<pid>.<rand>` first, then `fs.renameSync` onto the canonical path. No reader ever observes a half-written file. Containing dir is created with mode `0o700` if absent. (Same pattern as `packages/urp/src/local-index-writer.js`.)
- [ ] **9.4** Reader function `isConsentNonceUsed({nonce, demaHome})` returns `boolean`. Missing registry file returns `false` (the consent gate has its own separate fail-closed handling for `nonce_registry_unavailable` — the reader itself is pure and stateless and only answers "is this nonce on the list").
- [ ] **9.5** No private key material is read, derived, embedded, or referenced in the registry file. The registry stores only nonce + action_type + target_hash + consumed_at_iso + consent_proof_hash. (`grep -F -- "-----BEGIN" $DEMA_HOME/consent/used-nonces.json` always empty.)
- [ ] **9.6** `consumed_at_iso` is captured at consumption time and stored in the registry. It does NOT leak into action receipt envelopes that claim **Level B determinism** — registry timestamps are non-deterministic and stay in the registry, not in any receipt body that a determinism replay test diffs. The `registry_entry_hash` in §4 is allowed into the action receipt boundary block because it is a content-address (a hash), not a wall-clock claim.
- [ ] **9.7** Registry file mode is `0o600` after every write (writer `fs.chmodSync(path, 0o600)` post-rename). Test verifies `fs.statSync(path).mode & 0o777 === 0o600`.
- [ ] **9.8** Determinism: same inputs (`nonce`, `actionType`, `targetHash`, `consentProofHash`, injected `consumedAtIso`) → byte-identical registry bytes across runs. Test fixture injects `consumedAtIso` and asserts `fs.readFileSync(path)` deep-equals the expected buffer.
- [ ] **9.9** Crash safety: if the process dies between the `tmp` write and the `rename`, the canonical `used-nonces.json` remains in its last-good state and the orphaned `*.tmp.*` file is harmless. Test simulates this by writing a tmp file directly, then invoking the reader and asserting the registry's effective state is unchanged.

Full Node test suite stays green; smoke suite stays green; CI green required before 2B begins.

## 10. DOD for KEYCONSENT-2B (integration into existing gates)

Gated on 2A sealed AND remote-CI-verified. Six exit criteria:

- [ ] **10.1** `packages/receipts/src/verdict-attest.js` calls `recordConsentNonce` **AFTER** the consent proof verifies (existing KEYCONSENT-1B path) and **BEFORE** the verdict receipt is persisted. On `consent_nonce_already_used` → fail-closed, no receipt written, no chain advance, exit code 1, error printed to stderr.
- [ ] **10.2** `packages/receipts/src/authorship-sign-command.js` (current typed-phrase gate is acknowledged out of scope for the typed-shibboleth fix and remains until KEYCONSENT-1B-bis) — IF and only IF authorship-sign has been upgraded to consume a consent proof by the time 2B lands, the same call pattern from 10.1 wires in here. Otherwise this DOD item is documented as deferred to KEYCONSENT-1B-bis + 2B-bis pair.
- [ ] **10.3** `packages/urp/src/choose-decision.js` — same pattern as 10.1, gated on urp-choose having migrated to consent-proof input (KEYCONSENT-1B-ter). Otherwise also documented as deferred.
- [ ] **10.4** All three gates pass exactly the boundary flag `consent_nonce_consumed: true` into the receipt body on successful first consumption. Test fixtures verify the flag is present on success and absent on every failure path.
- [ ] **10.5** A pre-existing valid receipt that was written before KEYCONSENT-2B (i.e. a receipt without `consent_nonce_consumed`) MUST still verify under the KEYCONSENT-1A flow. The registry check in §5 step 2 is gated on the action receipt actually claiming `consent_nonce_consumed: true`. Backward-compatibility test: load a sealed pre-2B bundle, verify it under the new verifier with no registry supplied → still `VERIFIED`.
- [ ] **10.6** Smoke suite gains exactly one new case: present the same consent proof bundle twice to a verdict-attest in `--json` mode; assert first attempt prints a sealed receipt and exit 0, second attempt prints `consent_nonce_already_used` on stderr and exits 1, and the verdict chain has advanced by exactly one entry.

## 11. Boundary

This preflight document is text-only. Its boundary block:

```json
{
  "runtime_code_changed": false,
  "private_key_exported": false,
  "network_used": false,
  "federation_used": false,
  "cross_machine_replay_protection_added": false,
  "automatic_nonce_rotation_performed": false,
  "public_nonce_ledger_emitted": false,
  "token_or_economic_association_added": false
}
```

KEYCONSENT-2A and 2B will each carry their own boundary blocks and tighter scope statements.

## 12. What this preflight does NOT do

- Does NOT solve cross-machine replay. A bundle stolen from Node0-A and presented to Node0-B will still pass — the registry is local. Closing this requires federation.
- Does NOT close the open audit finding that `authorship-sign` and `urp-choose` still gate on a typed phrase rather than on a consent proof. Those slices are **KEYCONSENT-1B-bis** (authorship-sign migration to consent-proof input) and **KEYCONSENT-1B-ter** (urp-choose migration). 2B can only wire the registry into a gate that already verifies a consent proof; the typed-phrase gates must be upgraded first.
- Does NOT add a CLI surface for the registry. There is no `dema consent registry ls`, no `dema consent registry prune`, no `dema consent registry verify`. Read-only inspection is operator-side `ls ~/.dema/consent/` and `cat ~/.dema/consent/used-nonces.json`. Pruning is operator-side manual edit (with the understanding that pruning re-enables replay of any pruned nonce within its remaining validity window).
- Does NOT change the `bizra.dema.consent_proof.v0.1` schema.
- Does NOT modify the operator's `~/.dema/` directory (this is a design doc; the writer in 2A will use injected `demaHome` pointing at tmpdirs in tests).
- Does NOT make a security claim that replay is now closed for production (it is closed within one Node0 only, after 2A + 2B ship and remote-CI verifies).
- Does NOT promise an implementation timeline for 2A or 2B.

## 13. What unlocks next

After this preflight is committed and remote-CI verifies green, **KEYCONSENT-2A** (the registry kernel — write/read primitives, atomic file handling, mode 0o600, determinism tests) begins. After 2A is sealed and remote-CI-verified, **KEYCONSENT-2B** (integration into the existing fail-closed gates that already verify a consent proof — verdict-attest first, then authorship-sign and urp-choose as they migrate off the typed-phrase shibboleth) follows. Once 2A + 2B are both sealed, remote-CI-verified, and wired into all three gates, the within-machine replay surface called out in `KEYCONSENT_PREFLIGHT.md §5 step 7` and `§8 layer 3` is closed, and the `KEYCONSENT_2_CLOSEOUT.md` pair-doc is written.

PDF Section 6 (KEYCONSENT-2 — replay protection): single-use nonce registry, expiration enforcement, scope binding, receipt linkage, replay rejection tests — all five checkboxes addressed across §3 (registry), KEYCONSENT-1A §3+§5 (expiration + scope, reused), §4 (receipt linkage), and §10.6 (rejection smoke test).

PDF Section 22 Final Law applies: every mutation that reaches a 2B-wired gate is **consented** (consent proof), **verified** (signature + scope + freshness + registry), **replayable** (registry + receipt are local files), **traced-to-proof** (`registry_entry_hash` content-addresses the registry record from inside the receipt boundary block), **approved** (first-consumption-wins; repeats rejected), **measured** (CI test fixtures cover happy path, repeat, corruption, deletion, crash), **bounded** (no federation, no public ledger, no economic association, no schema drift, one local file).
