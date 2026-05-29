# AGENT-PROFILE-0 · Twelve-Agent Civilization Profile Preflight

**Status:** preflight design only; no runtime code; no key export; no autonomous agent execution; no public identity; no agent payments
**Sparse point:** after KEYCONSENT-1A pure kernel sealed (`89ad00b`) and after the receipt trust 3-tier hierarchy canon entry
**Pair-doc (future):** `AGENT_CLOSEOUT.md` (after AGENT-PROFILE-1A + AGENT-WALLET-1A + AGENT-SKILL-1A + REALM-XP-0 + XP replay verifier all sealed)
**Date:** 2026-05-30 (Dubai · GST)

## 1. Current weakness

Agent identities today are **decorative strings**. The names "Dema", "PAT", "SAT" appear across docs, receipts, and CLI surfaces, but no signed registry asserts that THIS agent is THIS role with THIS proof history. Specifically:

- No stable agent_id bound to a content-addressed profile.
- No XP, no skill ledger, no wallet binding, no service catalog.
- No failure-pattern record — an agent that failed a verification once cannot be queried for "show me your prior failures" because no such artifact exists.
- No way for an external verifier to distinguish "Verifier said X" from "anyone holding the operator's key called themselves Verifier and said X."

Concretely: across the existing receipt chain (verdict-receipts, urp-choose receipts, authorship receipts, consent proofs), the **signer** is always the operator's Ed25519 key. No receipt is attributable to a specific PAT or SAT role with proof-backed history; the agent layer is **nominal**, not **provable**.

AGENT-PROFILE-0 is the preflight for the slice that gives each of the twelve canonical agents a signed, content-addressed profile and binds every receipt back to that profile.

## 2. Target

Every agent in the canonical twelve-agent civilization gets a **stable signed profile envelope** linking to its proof-backed history. Agent levels become **traceable to receipts and verified contributions**, not vibes.

Twelve canonical agents:

- **PAT-7 (user-serving):** Dema (bridge, interface, mission steward) · Guardian (consent, safety, boundary enforcement) · Reasoner (planning, decomposition, graph thinking) · Builder (implementation, execution, tool use) · Critic (red-team, failure detection, anti-hype) · Archivist (receipts, checkpoints, continuity) · Teacher (learning extraction, skill growth).
- **SAT-5 (system-serving):** Verifier (proofs, tests, deterministic checks) · Compliance (claim discipline, consent law, forbidden fields) · Resource (hardware/data/tool boundaries) · Economist (PoI scoring, anti-gaming, reward validity) · Evolution (RSI safety, regression guard, improvement logic).

End-state property (in one line): _given a profile_proof_hash, a stranger with the operator's pubkey and this repo's rule code can confirm: this agent_id, this role, this XP total, this skill set, this service catalog, this failure history — all signed, all replayable from receipts._

## 3. Profile envelope schema

Proposed schema for the agent profile artifact:

```text
schema:                              "bizra.dema.agent_profile.v0.1"
agent_id:                            "<stable string id; e.g. pat.dema, sat.verifier>"
agent_class:                         "PAT" | "SAT"
agent_role:                          "Dema" | "Guardian" | "Reasoner" | "Builder" | "Critic" | "Archivist" | "Teacher"
                                     | "Verifier" | "Compliance" | "Resource" | "Economist" | "Evolution"
stable_profile_hash:                 "<sha256 of the immutable identity fields: schema + agent_id + agent_class + agent_role + created_at_iso>"
skills:                              ["<skill_id_1>", "<skill_id_2>", ...]
xp:                                  <uint; default 0>
wallet_id:                           "<string; default empty>"
service_catalog:                     ["<service_id_1>", "<service_id_2>", ...]
memory_log_path:                     "<relative path under $DEMA_HOME/agents/<agent_id>/memory.log>"
event_log_path:                      "<relative path under $DEMA_HOME/agents/<agent_id>/events.log>"
proof_references:                    ["<receipt_hash_1>", "<receipt_hash_2>", ...]
failure_patterns:                    ["<failure_pattern_id_1>", ...]
performance_contribution_score:      <number; computed off proof_references per REALM-XP-0 rules>
current_task_ownership:              "<mission_id>" | null
created_at_iso:                      "<ISO-8601 UTC timestamp>"
profile_signature_b64:               "<Ed25519 signature over stableStringify(body without _b64/profile_proof_hash fields), base64>"
profile_proof_hash:                  "<sha256 of stableStringify(body excluding profile_signature_b64 and profile_proof_hash)>"
```

The `body` for signing/hashing is the envelope **without** `profile_signature_b64` and **without** `profile_proof_hash` — same separation pattern as the consent proof, the verdict-receipt body, and the urp-choose decision body. Signature commits to all other fields; hash is the content address.

Two derived properties matter:

1. **Identity binding**: `profile_signature_b64` was producible only by the operator's signing key. A stranger cannot mint a valid profile for "Verifier" without operator-key possession.
2. **Stable identity vs. mutable state**: `stable_profile_hash` covers only the immutable identity fields (schema, agent_id, agent_class, agent_role, created_at_iso). The `profile_proof_hash` covers the full versioned snapshot, including mutable state (skills, xp, proof_references, etc.). Two profiles for the same agent at two points in time share `stable_profile_hash` but differ in `profile_proof_hash`.

## 4. How agents reference profile

Every action, learning, or lesson receipt produced by an agent carries TWO new fields:

```text
agent_id:                  "<stable string id of the agent>"
agent_profile_proof_hash:  "<sha256 of the agent's profile body AT THE TIME OF ACTION>"
```

This is an **immutable reference**. Later profile updates produce **new versions** (with new `profile_proof_hash`); the receipt's reference still points to the snapshot in force at the time of action. A stranger can therefore query: "what was Verifier's profile when it signed off this verdict?" and get a single content-addressed answer.

Updated receipt bundle shape (proposed extension):

```text
{
  body:                  <action body, including agent_id + agent_profile_proof_hash>,
  signature_b64:         <action signature>,
  signer_public_key_pem: <operator's pubkey; verifier still ignores this for trust>,
  input:                 <action's input, for replay>,
  consent_proof:         <consent proof envelope from KEYCONSENT-1A>,
  agent_profile:         <full agent profile envelope §3 (for the snapshot referenced by agent_profile_proof_hash)>
}
```

Profile-mutation actions (adding XP, registering a skill, updating service catalog) are themselves consent-gated. They reuse KEYCONSENT-1A's `consent_proof` envelope with `action_type = "MUTATE_AGENT_PROFILE"` and `action_scope.target_hash = sha256(stableStringify(new_profile_body))`.

## 5. Verification flow

A stranger with (bundle) + (operator's pubkey supplied SEPARATELY via `--pubkey`) + (this repo's rule code) verifies in this order:

1. **Profile signature** — verify `agent_profile.profile_signature_b64` over `stableStringify(profile body without signature + proof_hash)` using external `--pubkey`. On failure → `REJECTED:profile_signature_invalid`.
2. **Profile content-address** — recompute `profile_proof_hash` from the body; check it matches the envelope's `profile_proof_hash` AND matches the action body's `agent_profile_proof_hash`. On mismatch → `REJECTED:profile_proof_hash_mismatch`.
3. **Role canonicality** — `agent_role` must appear in the canonical 12-set (the 7 PAT + 5 SAT listed §2) AND `agent_class` must match the role's class. On failure → `REJECTED:agent_role_unknown` (fail-closed; unknown roles are rejected, not silently accepted).
4. **Referenced proof receipts exist** — for each `receipt_hash` in `proof_references`, the verifier confirms the receipt is locatable in the proof chain (the receipts package's existing index). Missing → `REJECTED:proof_reference_missing`.
5. **XP aggregation rule** — claimed `xp` must equal the sum of `xp_grant` values from the receipts in `proof_references`, computed per REALM-XP-0 grant rules. Mismatch → `REJECTED:xp_overclaim`.
6. **Stable identity binding** — recompute `stable_profile_hash` from the immutable identity fields; mismatch → `REJECTED:stable_identity_mismatch`.

If 1–6 all pass → `VERIFIED`. The agent is now a **persistent character with proof-backed history**, not a decorative label (PDF §10 DOD).

## 6. Non-goals

This preflight (AGENT-PROFILE-0) and the immediately-following kernel slice (AGENT-PROFILE-1A) DO NOT:

- Allow autonomous agent execution without operator consent.
- Open agent-to-agent payment, transfer, or settlement.
- Build an agent marketplace, listing service, or rate card.
- Emit a **public** agent identity — agents are Node0-local roles; their profiles never leave the operator's machine without explicit `dema share` consent.
- Open federation, peer transport, or cross-node agent exchange.
- Auto-instantiate LLM personas, role-play characters, or "agent voice" generators.
- Frame the agent as a human, employee, contractor, or legal person.
- Establish an employment relationship between operator and agent.
- Mint tokens, distribute rewards, or make economic claims on behalf of an agent.
- Replace the existing operator Ed25519 key store; the operator key continues to sign all profile artifacts.

## 7. Threat model

| Attacker                                   | Capability                                                                                                               | AGENT-PROFILE-1A status                                  | Why                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ghost-agent attacker**                   | Mints a profile claiming high XP without any backing receipts in `proof_references`.                                     | **BLOCKED**                                              | Verification step 5 (XP aggregation) sums `xp_grant` from referenced receipts and compares. Claimed `xp` without backing receipts → `xp_overclaim`.                                                                                                                               |
| **Role-impersonator**                      | Stranger (or compromised user-process) claims `agent_role = "Verifier"` without any verified-check history.              | **BLOCKED**                                              | Step 3 enforces role canonicality, step 4 requires `proof_references` to exist, step 5 requires those receipts to grant the role's XP per REALM-XP-0 rules. A Verifier with zero verifier-type receipts cannot reach a non-trivial XP claim.                                      |
| **Profile-fork attacker**                  | Mutates an agent profile mid-mission (e.g., to drop a failure_patterns entry that would otherwise gate a future action). | **BLOCKED**                                              | Profiles are immutable per version. Each mutation produces a NEW versioned snapshot with a new `profile_proof_hash`. Receipts always reference the snapshot in force at the time of action; the historical version remains content-addressed and replayable.                      |
| **Skill-padding attacker**                 | Adds `skill_id`s to the `skills` array without the repeated verified performance PDF §11 requires.                       | **BLOCKED (with AGENT-SKILL-1A)**                        | AGENT-SKILL-1A's skill ledger requires each `skill_id` to be backed by N≥k verified `skill_event` receipts. Claimed skills without backing → `skill_unbacked` at verification (joint AGENT-PROFILE-1A + AGENT-SKILL-1A rule).                                                     |
| **Performance-overclaim**                  | Inflates `performance_contribution_score` beyond what referenced receipts justify.                                       | **BLOCKED**                                              | `performance_contribution_score` is computed from `proof_references` per REALM-XP-0; verification step 5 catches any mismatch. The aggregation rule itself is deterministic and replayable (Level B for the aggregation; Level A for the profile signature).                      |
| **Wallet-substitution attacker**           | Swaps `wallet_id` mid-version to redirect future XP rewards.                                                             | **BLOCKED (with AGENT-WALLET-1A)**                       | `wallet_id` change requires a `MUTATE_AGENT_PROFILE` consent proof; the new version is signed; AGENT-WALLET-1A binds the wallet to the agent_id and refuses swap without consent proof.                                                                                           |
| **Disk-access attacker with operator key** | Has read access to the operator's signing key.                                                                           | **NOT BLOCKED — out of scope.**                          | If the attacker has the private key, no software-only profile scheme stops them from minting whatever profile they want. AGENT-PROFILE-1A raises the bar from "string in a doc" to "operator-key-signed content-addressed envelope," but does not protect against key compromise. |
| **Cross-machine replay**                   | Steals an agent profile from machine A and uses it to claim role authority on machine B.                                 | **NOT BLOCKED this slice; not a federation-stage goal.** | Agents are Node0-local roles per §6 non-goals. Cross-machine profile portability would require federation, which is explicitly out of scope.                                                                                                                                      |

## 8. Replay protection

Three layers, increasing in cost:

1. **Content-addressed immutability** (fundamental): profile snapshots are immutable per version. `profile_proof_hash` is a content address; mutating any field requires producing a new version with a new hash. Receipts reference the snapshot in force at the time of action. **In AGENT-PROFILE-1A.**
2. **Consent-bound mutation** (cheap, reused): every profile mutation requires a KEYCONSENT-1A consent proof with `action_type = "MUTATE_AGENT_PROFILE"` and `action_scope.target_hash = sha256(new_profile_body)`. A stale or stolen mutation cannot be replayed against a different profile target. **In AGENT-PROFILE-1A.**
3. **Mutation event log** (more cost, supports forensics): every successful mutation appends a `profile_mutation_event` to the agent's `event_log_path`; the log itself is hash-chained (same pattern as receipt index chains). **DEFERRED to AGENT-PROFILE-1B.** Enables "show me every profile version of Verifier since genesis" without scanning the full receipt corpus.

The default posture for AGENT-PROFILE-1A is layers 1 + 2 only. Layer 3 is a separate slice.

## 9. DOD for AGENT-PROFILE-1A (static registry kernel slice)

Exit criteria for the IMMEDIATELY-FOLLOWING implementation slice (NOT this preflight):

- [ ] `packages/agents/src/agent-profile.js` exports pure functions:
  - `buildAgentProfile({agentId, agentClass, agentRole, demaHome, skills?, xp?, walletId?, serviceCatalog?, proofReferences?, failurePatterns?, performanceContributionScore?, currentTaskOwnership?, createdAtIso?})` — fail-closed when role is unknown, class/role mismatch, or no signing key found; otherwise loads the key, signs the body, returns a frozen envelope per §3.
  - `verifyAgentProfile({agentProfile, pubkeyPem, expectedAgentId?, now?})` — performs §5 steps 1, 2, 3, 6 (signature, content-address, role canonicality, stable identity binding). Steps 4 + 5 (proof reference resolution + XP aggregation) require receipt-store access and are exposed via a separate `verifyAgentProfileAgainstReceipts({agentProfile, receiptStore, xpRules})` so the pure kernel stays receipt-store-free.
- [ ] **12 canonical agents seeded.** The package ships a `CANONICAL_AGENTS` frozen registry containing exactly the seven PAT roles and five SAT roles from §2; any role outside the set fails `agent_role_unknown` deterministically.
- [ ] **profile_proof_hash determinism.** Given identical inputs (including `createdAtIso` injected), `buildAgentProfile` produces byte-identical envelopes; two calls deep-equal. Test asserts this.
- [ ] **Fail-closed on unknown role.** Passing `agent_role = "MarketingAgent"` (or any non-canonical string) throws or returns a fail-closed result; never silently coerces.
- [ ] **Every field frozen.** Returned envelopes are deep-frozen (`Object.freeze` recursively, including nested arrays). Test attempts mutation; mutation throws in strict mode or no-ops in sloppy mode but never persists.
- [ ] **No private-key leak.** Test serializes the returned envelope via `JSON.stringify` and asserts it contains no substring matching the operator's PEM private-key markers (`PRIVATE KEY`, raw key bytes). Same posture as `feedback_writer_forbidden_field_check_before_hash_recompute.md`.
- [ ] **Reuses primitives.** Ed25519 + sha256 + stableStringify + KEYCONSENT-1A `buildConsentProof` + `verifyConsentProof` REUSED from existing modules — no duplication.
- [ ] **Tests** (`tests/agent-profile.test.js`):
  - happy path: build all 12 canonical agents, verify each → `verified: true`.
  - unknown role: `agent_role_unknown`.
  - tampered profile body: `profile_signature_invalid`.
  - wrong external pubkey: `profile_signature_invalid`.
  - tampered `xp` only (without re-sign): `profile_proof_hash_mismatch`.
  - deterministic when `createdAtIso` is injected: two calls deep-equal.
  - frozen envelope: mutation attempt does not change `profile_proof_hash`.
- [ ] **Status this slice.** Tests run inside `tests/*.test.js`; full suite stays green; smoke 42/42 stays green; `npm run check` clean; `git diff --check` clean. Does NOT integrate with `attestVerdict`, `signArtifact`, or `urp choose` — that integration is **AGENT-PROFILE-1B**.

## 10. DOD for AGENT-WALLET-1A + AGENT-SKILL-1A (sibling slices, gated on AGENT-PROFILE-1A sealed)

### AGENT-WALLET-1A (per-agent local wallet)

- [ ] `packages/agents/src/agent-wallet.js` exports pure functions:
  - `bindWalletToAgent({agentId, walletId, consentProof, demaHome})` — fail-closed unless `consentProof.action_type === "MUTATE_AGENT_PROFILE"` and `consentProof.action_scope.target_hash === sha256(new_profile_body_with_wallet)`.
  - `getWalletForAgent({agentId, demaHome})` — returns `{walletId, walletProofHash}` or `{walletId: null}` if unbound.
- [ ] **Local-only.** Wallets are records in `$DEMA_HOME/agents/<agent_id>/wallet.json`; no external chain, no transfer, no settlement.
- [ ] **No agent-to-agent payment.** Module deliberately exposes NO transfer surface. Test asserts the public API has no `transfer`, `pay`, or `settle` export.
- [ ] **Consent-gated bind.** Re-binding (swap) requires a fresh consent proof scoped to the new wallet body; replay of an old consent → `consent_scope_mismatch`.
- [ ] **Tests.** Happy path; swap-without-consent fails closed; swap-with-stale-consent fails closed; no-transfer-surface asserted.
- [ ] **Gated on AGENT-PROFILE-1A remote-CI-verified.** Does not start until kernel slice sealed.

### AGENT-SKILL-1A (skill ledger)

- [ ] `packages/agents/src/agent-skill.js` exports pure functions:
  - `recordSkillEvent({agentId, skillId, evidenceReceiptHash, consentProof, demaHome})` — fail-closed unless `evidenceReceiptHash` resolves to an existing receipt AND `consentProof.action_type === "MUTATE_AGENT_PROFILE"`.
  - `summarizeSkills({agentId, demaHome, thresholdK?})` — returns the deterministic list of `skill_id`s that have at least `thresholdK` distinct `skill_event` receipts (default `thresholdK = 3`).
- [ ] **No self-verification.** `evidenceReceiptHash` must point to a receipt whose `agent_id` is **NOT** the agent claiming the skill; same-agent evidence is rejected. Direct implementation of PDF §11 "No self-verification."
- [ ] **Repeated verified performance.** Skill appears in summary only after ≥ `thresholdK` distinct receipts. Direct implementation of PDF §11 "Skills require repeated verified performance."
- [ ] **No self-minting.** Module exposes no surface to grant a skill without an evidence receipt; test asserts this.
- [ ] **Tests.** Happy path with 3 distinct receipts; 2 receipts → not summarized; self-evidence rejected; stale-consent rejected; deterministic summary order.
- [ ] **Gated on AGENT-PROFILE-1A remote-CI-verified.** Does not start until kernel slice sealed.

## 11. Boundary

This preflight document is text-only. Its boundary block:

```json
{
  "runtime_code_changed": false,
  "private_key_exported": false,
  "network_used": false,
  "federation_used": false,
  "autonomous_agent_execution_allowed": false,
  "public_agent_identity_emitted": false,
  "agent_to_agent_payment_performed": false,
  "agent_as_human_claim_made": false
}
```

AGENT-PROFILE-1A, 1B, AGENT-WALLET-1A, AGENT-SKILL-1A, and REALM-XP-0 will each carry their own boundary blocks and tighter scope statements.

## 12. What this preflight does NOT do

- Does NOT change any existing receipt schema, consent gate, or CLI surface.
- Does NOT introduce any new envelope into a running flow.
- Does NOT modify the operator's `~/.dema/` directory.
- Does NOT make a security claim that agents are now provable characters (they are not, yet — this is a design doc, not a shipped feature).
- Does NOT promise an implementation timeline for AGENT-PROFILE-1A onward.
- Does NOT close any audit finding; closure requires AGENT-PROFILE-1A through AGENT-SKILL-1A + REALM-XP-0 + the XP replay verifier all sealed and remote-CI verified.
- Does NOT elevate the profile itself to Level B truth. The profile envelope is **Level A signed provenance**. Its referenced receipt chains are Level B where applicable. The profile's **summary** of an agent's level is a content-addressed claim, not a pure-function-derivable fact — but the **aggregation rule** for XP from receipts IS deterministic and Level B (REALM-XP-0 specifies the rule; the XP replay verifier proves any profile's XP claim against its `proof_references`).
- Does NOT establish federation, public-identity, agent payments, or autonomous-agent execution — all explicitly non-goals (§6).

## 13. Proof-of-truth convergence (this preflight)

| Lens          | Status                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formal        | DESIGNED — schema, envelope shape, verification flow, threat table, twelve-agent canonical set all named.                                                                             |
| Cryptographic | DESIGNED_NOT_LIVE — primitives identified (Ed25519 + sha256 + stableStringify + KEYCONSENT-1A `buildConsentProof`/`verifyConsentProof`, all already in repo); no new code yet.        |
| Empirical     | NOT YET — no tests because no kernel; AGENT-PROFILE-1A DOD lists the test set.                                                                                                        |
| Economic      | EXPLICITLY OUT OF SCOPE — no token, no PoI mint, no reward distribution, no agent-to-agent payment, no economic claim on behalf of any agent. XP is a proof-bound integer, not money. |

## 14. What unlocks next

After this preflight is committed and remote-CI verified, three sibling implementation slices can begin **in parallel**, all gated on AGENT-PROFILE-1A (static registry kernel) sealing first:

- **AGENT-PROFILE-1A** — the pure registry kernel: 12 canonical agents seeded, signed envelopes, fail-closed-on-unknown-role, deterministic `profile_proof_hash`.
- **AGENT-WALLET-1A** — per-agent local wallet binding, consent-gated, no transfer surface.
- **AGENT-SKILL-1A** — skill ledger, no self-verification, repeated-verified-performance threshold, no self-minting.

After all three are sealed, REALM-XP-0 (the XP / skill-tree economic rule preflight) and the XP replay verifier slice follow. Once those are remote-CI-verified, the canon glossary entry for "agent" can be promoted from DECLARED to MEASURED with cited test names as evidence, and the `AGENT_CLOSEOUT.md` pair-doc lands as the closeout record.
