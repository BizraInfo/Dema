# LEARN-0 · Verified Learning Preflight (House of Wisdom Gate)

**Status:** preflight design only; no runtime code; no key export; no model invocation; no automatic policy update
**Sparse point:** After the receipt trust 3-tier hierarchy canon entry (2026-05-29) and after KEYCONSENT-1A pure kernel sealed (`89ad00b`)
**Pair-doc (future):** `LEARN_CLOSEOUT.md` (after HOW-1A + LEARN-1A + LEARN-2 are sealed)
**Date:** 2026-05-30 (Dubai · GST)

## 1. Current weakness

Dema's "memory" today is content-addressed receipts — sha256 hashes pointing at frozen envelopes on disk (Level 0 per the receipt trust taxonomy canon entry, 2026-05-29). Receipts record **what happened**, not **what was learned from what happened**. The think loop (H14A → H17 season) can emit reflection text, but raw LLM output is non-deterministic and CANNOT achieve Level B grounded verification per the architectural insight from the 2026-05-29 trust audit:

> LLM outputs are non-deterministic. A pure rule cannot re-derive an LLM response. Therefore the think loop's theoretical frontier is Level A provenance; NOT Level B re-derivable verdict.

**The exact threat**: Dema today cannot tell verified learning apart from hallucinated learning. A reflection asserting "I learned X from situation Y" has no proof chain. Anyone (including Dema's own non-deterministic think loop) can mint reflection text with no backing experience; without a discipline that binds the lesson to a real receipt, a real review, and a real operator approval, the House of Wisdom would be a memory of fictions.

The House of Wisdom needs a discipline that turns "experience" into "verified knowledge" through a **witnessed proof chain** — so that future Dema runs can cite a lesson and a stranger can re-derive that the lesson came from a real event, was reflected on, was reviewed by SAT, and was explicitly approved by MuMu.

LEARN-0 is the preflight for the slice family that closes that gap.

## 2. Target

Turn House of Wisdom entries from "remembered text" into **proof-chained, operator-approved lessons**. Every lesson entry must reference, by hash, the full four-step provenance chain:

1. **A real experience receipt** — the witnessed event the lesson is derived from (Level A or Level B).
2. **A reflection generated from that receipt** — the think-loop or operator-written reflection text whose hash commits to the source receipt.
3. **A SAT review attestation** — a receipt produced by Dema's SAT review pass confirming the reflection was examined (not silently auto-accepted).
4. **A MuMu approval signature** — a KEYCONSENT consent proof with `action_type = "APPROVE_LESSON"` and `target_hash = lesson_hash`, signed by the operator's Ed25519 key.

Without **all four** present and hash-resolvable, the candidate stays a candidate. It does NOT enter the House of Wisdom; it does NOT influence future policy or skill updates.

Mechanism (in one line): _the lesson content is signed; the lesson FLOW (experience → reflection → SAT → MuMu) is what carries Level B grounded verification._

## 3. Lesson envelope schema

Proposed schema for the House of Wisdom lesson artifact:

```text
schema:                              "bizra.dema.house_of_wisdom_lesson.v0.1"
lesson_id:                           "<stable id; e.g., short sha of lesson_hash>"
experience_receipt_hash:             "<sha256 hex of the witnessed source receipt>"
reflection_text:                     "<the reflection derived from the experience>"
reflection_hash:                     "<sha256 hex of reflection_text>"
sat_review_receipt_hash:             "<sha256 hex of the SAT review attestation receipt>"
mumu_approval_consent_proof_hash:    "<sha256 hex of the KEYCONSENT consent proof body that approved this lesson>"
lesson_text:                         "<the canonical lesson statement; the thing future runs may cite>"
lesson_hash:                         "<sha256 hex of lesson_text>"
policy_or_skill_target:              "<string; e.g., 'policy.refusal.fetch_and_execute' or 'skill.urp.choose'>"
share_status:                        "local_only"
created_at_iso:                      "<ISO-8601 UTC timestamp>"
operator_public_key_fingerprint:     "<sha256 hex of the operator's Ed25519 pubkey, DER form>"
lesson_signature_b64:                "<Ed25519 signature over stableStringify(body without _b64/proof_hash fields), base64>"
lesson_proof_hash:                   "<sha256 of stableStringify(body excluding lesson_signature_b64 and lesson_proof_hash)>"
```

The `body` for signing/hashing is the envelope **without** `lesson_signature_b64` and **without** `lesson_proof_hash` — same separation pattern as KEYCONSENT-1A consent proof, URP-3.1A local index, URP-4.1A choose decision, and the verdict-receipt body (re-derivable; the signature commits to all other fields, the hash is the content address).

Three derived properties matter:

1. **Provenance binding**: the lesson body commits to FOUR external hashes (`experience_receipt_hash`, `reflection_hash`, `sat_review_receipt_hash`, `mumu_approval_consent_proof_hash`). A stranger resolves each in the bundle; missing any → unverifiable.
2. **Content/flow separation**: `lesson_text` is the human-meaningful claim (content, signed); `lesson_proof_hash` is the content-address (flow, hashed). The CHAIN is Level B grounded; the CONTENT is Level A signed.
3. **Default-locality**: `share_status` defaults to `"local_only"`. Federation is explicitly out of scope this slice; promotion requires a later slice and a separate consent action.

## 4. How future surfaces reference the lesson

Dema policy/skill update receipts gain ONE new optional field:

```text
learned_from_lesson_hash:  "<sha256 of the House of Wisdom lesson body>"
```

This is a **hash reference**, not an inclusion. The full lesson envelope ships in the policy-update bundle (or remains discoverable in `$DEMA_HOME/house-of-wisdom/`). Lessons that influence future runs become traceable: a stranger reading a future policy receipt can follow the `learned_from_lesson_hash` back to the lesson envelope, then through the four provenance hashes to the original experience.

Updated policy-update bundle shape (proposed, for the LEARN-2 slice):

```text
{
  body:                  <policy/skill update body, including learned_from_lesson_hash>,
  signature_b64:         <action signature>,
  signer_public_key_pem: <action signer's pubkey; verifier still ignores this for trust>,
  lesson:                <the full House of Wisdom lesson envelope from §3>,
  consent_proof:         <the KEYCONSENT consent proof authorizing the policy update itself>
}
```

Policy body commits to `learned_from_lesson_hash`; bundle ships the lesson alongside. Cleanly mirrors the input/input_hash and consent_proof_hash/consent_proof patterns the verdict-receipt and KEYCONSENT slices already established.

## 5. Verification flow

A stranger with (bundle) + (operator's pubkey, supplied SEPARATELY via `--pubkey`) + (this repo's rule code) verifies in this order:

1. **Lesson signature** — verify `lesson.lesson_signature_b64` over `stableStringify(lesson body without lesson_signature_b64 and lesson_proof_hash)` using external `--pubkey`. On failure → `REJECTED:lesson_signature_invalid`.
2. **Lesson proof hash recomputable** — `sha256(stableStringify(lesson body excluding sig + proof_hash)) == lesson.lesson_proof_hash`. On mismatch → `REJECTED:lesson_proof_hash_mismatch`.
3. **Experience receipt resolves** — `lesson.experience_receipt_hash` resolves to a real receipt in the bundle (or via `$DEMA_HOME/receipts/`); that receipt is itself verifiable (Level B or A as applicable per the receipt trust taxonomy). On failure → `REJECTED:experience_receipt_unresolved` or `REJECTED:experience_receipt_invalid`.
4. **Reflection hash matches text** — `sha256(lesson.reflection_text) == lesson.reflection_hash`. On mismatch → `REJECTED:reflection_hash_mismatch`.
5. **SAT review receipt resolves** — `lesson.sat_review_receipt_hash` resolves to a real SAT review attestation receipt in the bundle (or store). On failure → `REJECTED:sat_review_unresolved`.
6. **MuMu approval consent proof valid** — `lesson.mumu_approval_consent_proof_hash` resolves to a KEYCONSENT consent proof envelope with `action_type == "APPROVE_LESSON"` and `target_hash == lesson.lesson_hash`; the consent proof itself verifies per the KEYCONSENT-1A verifier (signature with same `--pubkey`, scope match, freshness). On failure → `REJECTED:mumu_approval_invalid` or `REJECTED:mumu_approval_scope_mismatch`.
7. **Lesson hash matches text** — `sha256(lesson.lesson_text) == lesson.lesson_hash`. On mismatch → `REJECTED:lesson_hash_mismatch`.
8. **Lesson proof hash recomputable from stable body** — re-derived per step 2 (final integrity check; ties together all referenced hashes which are body fields).

If steps 1–8 all pass → `VERIFIED`. The lesson is now grounded **AND** provenance-bound **AND** operator-approved.

## 6. Non-goals

This slice (LEARN-0) and the immediately-following implementation slices (HOW-1A, LEARN-1A) DO NOT:

- Permit **automatic learning** — operator approval (MuMu consent) is mandatory; no lesson enters the House of Wisdom without an explicit `APPROVE_LESSON` consent proof.
- Permit **LLM-only lessons** — every lesson must be derived from a real experience receipt; reflection-without-receipt is rejected at step 3 of the verifier.
- Permit **public sharing** — `share_status` defaults to `"local_only"`; LEARN-3 (out of scope) may consider broader visibility.
- Open **federation** — no cross-node lesson exchange, no shared House of Wisdom; LEARN-2 may consider it later if and only if a public consent-and-attestation surface is built first.
- Emit **fine-tuning data** — no training corpus is constructed; no JSONL is written for ingestion by an external model trainer.
- Modify **model weights** — Dema's policy/skill table is data, not weights; this layer never touches a model file.
- Perform **automatic policy update** — even when a lesson is VERIFIED, the policy/skill table is NOT updated by this slice; closure requires the LEARN-2 wiring slice and an independent operator consent action authorizing the specific update.
- Make a **Shariah / legal certification claim** — verification is over hash chains and signatures, not over normative correctness of the lesson content.

## 7. Threat model

| Attacker                                   | Capability                                                                                                                                | LEARN-1A status                       | Why                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hallucinated-experience liar**           | Crafts a lesson envelope referencing an `experience_receipt_hash` that does NOT resolve to any real receipt on disk or in the bundle.     | **BLOCKED**                           | Verifier step 3 fails with `experience_receipt_unresolved`. Lessons without a real witnessed event are rejected.                                                                                                                                                                 |
| **Reflection-without-receipt attacker**    | Supplies reflection_text and lesson_text but binds them to a receipt whose hash matches a real receipt of a DIFFERENT, unrelated event.   | **PARTIALLY BLOCKED — operator-side** | Verifier accepts that the referenced receipt is verifiable; semantic relevance is a SAT-review and MuMu-approval responsibility. The CHAIN is intact; CONTENT correctness is gated by SAT (step 5) and MuMu (step 6). Mitigation is human review, not cryptographic.             |
| **SAT-skipping attacker**                  | Builds a lesson with experience + reflection + MuMu approval, but omits `sat_review_receipt_hash` or points it at a non-existent receipt. | **BLOCKED**                           | Verifier step 5 fails with `sat_review_unresolved`. The four-step chain is enforced structurally; you cannot skip the review attestation.                                                                                                                                        |
| **MuMu-impersonator**                      | Knows the canonical `APPROVE_LESSON` phrase; does NOT have the operator's Ed25519 private key.                                            | **BLOCKED**                           | Verifier step 6 fails: the MuMu approval consent proof's `consent_signature_b64` cannot be produced without the key. Reuses the KEYCONSENT-1A binding directly.                                                                                                                  |
| **Share-status escalation attacker**       | Mints a lesson with `share_status: "public"` (or any non-default value) bypassing operator intent.                                        | **BLOCKED via consent scope**         | The `share_status` field is part of the signed body; changing it after signing breaks the signature (step 1). Setting it to non-default at minting requires a separate, future consent slice with `action_type = "SHARE_LESSON"`. Default-locality is enforced by signing scope. |
| **Lesson-replay attacker**                 | Takes a previously-approved lesson and re-mints it (or re-applies it to a new policy update) without fresh MuMu approval.                 | **PARTIALLY BLOCKED — deferred**      | Re-minting an identical `lesson_text` produces an identical `lesson_hash` (intentionally — content-address). Single-use `lesson_hash` registry (refuse re-mint of identical lesson) is deferred to LEARN-2. Until then, replay protection is scope + KEYCONSENT freshness only.  |
| **Disk-access attacker with operator key** | Has read access to `$DEMA_HOME/keys/node0-ed25519.pem`.                                                                                   | **NOT BLOCKED — out of scope.**       | Inherits the same operator-side mitigation boundary as KEYCONSENT-1A. If the attacker has the private key, no software-only learning gate stops them from minting whatever lesson they want. Mitigation is filesystem ACLs and OS keychain migration (later slice).              |

## 8. Replay protection

Three layers, increasing in cost:

1. **Scope binding** (cheap, fundamental): every MuMu approval consent proof carries `action_scope.target_hash = lesson_hash`. The verifier checks this in step 6. Re-using an approval for a different lesson fails with `mumu_approval_scope_mismatch`. **In LEARN-1A** (via KEYCONSENT-1A reuse).
2. **Expiration** (cheap, time-bounded): the MuMu approval consent proof's `expires_at_iso` is set at consent creation (default: created_at + 5 minutes from generation to approval). Verifier uses its own clock. **In LEARN-1A** (via KEYCONSENT-1A reuse).
3. **Single-use lesson_hash registry** (more cost, optional): `$DEMA_HOME/house-of-wisdom/used-lesson-hashes.json` records minted lesson hashes; the writer refuses to re-mint an identical `lesson_text`. **DEFERRED to LEARN-2.** Required when the same lesson must not be re-stamped with a new approval and re-applied to a different policy update without operator intent.

The default posture for HOW-1A + LEARN-1A is layers 1 + 2 only. Layer 3 is a separate slice.

## 9. DOD for HOW-1A (House of Wisdom writer slice — pure module)

Exit criteria for the IMMEDIATELY-FOLLOWING pure-writer implementation slice (NOT this preflight):

- [ ] `packages/receipts/src/house-of-wisdom-writer.js` exports a pure function `buildLessonEnvelope({experienceReceiptHash, reflectionText, satReviewReceiptHash, mumuApprovalConsentProofHash, lessonText, policyOrSkillTarget, demaHome, createdAtIso?, shareStatus?})` — fail-closed when any of the four provenance hashes is empty/malformed, when `reflectionText` or `lessonText` is empty, when no signing key is found, or when `shareStatus` is non-default and no `SHARE_LESSON` consent proof is supplied (deferred field, rejected this slice); otherwise loads the key, computes `reflection_hash` and `lesson_hash`, signs the body, returns a frozen envelope per §3.
- [ ] All Ed25519 + sha256 + stableStringify primitives REUSED from existing modules (`packages/receipts/src/sign-payload.js`, `packages/receipts/src/stable-stringify.js`, the KEYCONSENT-1A primitives) — no duplication.
- [ ] `share_status` defaults to `"local_only"`; any other value rejected this slice.
- [ ] Output envelope is `Object.freeze`-d; deterministic when `createdAtIso` is injected; two calls deep-equal.
- [ ] Tests (`tests/house-of-wisdom-writer.test.js`): happy path (all four provenance hashes supplied, valid texts, signing key present) → frozen envelope per §3; empty `experienceReceiptHash` → `experience_receipt_required`; empty `reflectionText` → `reflection_required`; empty `satReviewReceiptHash` → `sat_review_required`; empty `mumuApprovalConsentProofHash` → `mumu_approval_required`; empty `lessonText` → `lesson_required`; no signing key → `no_authorship_key`; `shareStatus !== "local_only"` → `share_status_not_permitted_this_slice`; deterministic when `createdAtIso` is injected.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; smoke harness stays green.
- [ ] Does NOT yet integrate with the think loop, SAT review pass, or any policy/skill update — those are LEARN-2 and later.
- [ ] No new CLI surface this slice — `dema lesson mint ...` is HOW-1C (later).

## 10. DOD for LEARN-1A (lesson proof verifier slice)

Exit criteria for the lesson-verifier implementation slice (NOT this preflight):

- [ ] `packages/receipts/src/lesson-verifier.js` exports a pure function `verifyLessonProof({lesson, pubkeyPem, resolveReceiptHash, now?})` — performs §5 steps 1, 2, 4, 6, 7, 8 directly; delegates step 3 (experience receipt resolution + validity) and step 5 (SAT review resolution) to the `resolveReceiptHash` callback so the verifier stays pure. Returns either `{verified: true, ...}` or `{verified: false, reason: "<first failing reason>"}`.
- [ ] Reuses `verifyConsentProof` from KEYCONSENT-1A directly for step 6; no duplication of consent verification logic.
- [ ] Tests (`tests/lesson-verifier.test.js`): happy path (all chain steps resolve, all signatures valid) → `{verified: true}`; tampered lesson body → `lesson_signature_invalid`; `lesson_proof_hash` mismatch → `lesson_proof_hash_mismatch`; `experience_receipt_hash` unresolved → `experience_receipt_unresolved`; `reflection_hash` does not match `sha256(reflection_text)` → `reflection_hash_mismatch`; `sat_review_receipt_hash` unresolved → `sat_review_unresolved`; MuMu approval `target_hash != lesson_hash` → `mumu_approval_scope_mismatch`; MuMu approval expired → `mumu_approval_invalid` (with injected `now()`); `lesson_hash` does not match `sha256(lesson_text)` → `lesson_hash_mismatch`.
- [ ] Tests run inside `tests/*.test.js`; full suite stays green; smoke harness stays green.
- [ ] Does NOT yet wire into policy/skill update flow — that is LEARN-2.

## 11. Boundary

This preflight document is text-only. Its boundary block:

```json
{
  "runtime_code_changed": false,
  "private_key_exported": false,
  "network_used": false,
  "federation_used": false,
  "model_weights_modified": false,
  "automatic_policy_update_performed": false,
  "share_published": false,
  "non_deterministic_lesson_accepted": false
}
```

HOW-1A, LEARN-1A, and LEARN-2 will each carry their own boundary blocks and tighter scope statements.

## 12. What this preflight does NOT do

- Does NOT change any existing receipt, consent, or think-loop behavior.
- Does NOT introduce any new schema into a running envelope.
- Does NOT modify the operator's `~/.dema/` directory.
- Does NOT create a `$DEMA_HOME/house-of-wisdom/` directory or any lesson file.
- Does NOT invoke any LLM; does NOT emit reflection text; does NOT consume the think loop's output.
- Does NOT make a security claim that Dema now learns safely (it does not, yet — this is a design doc, not a shipped feature).
- Does NOT close the gap that Dema's policy/skill table still updates manually; closure requires HOW-1A + LEARN-1A + LEARN-2 sealed.
- Does NOT promise a specific implementation timeline for HOW-1A onward.

## 13. What unlocks next

After this preflight is committed and remote-CI verified, **HOW-1A (the pure House of Wisdom writer kernel) can begin**. Downstream, **LEARN-1A (the lesson proof verifier)** follows once HOW-1A is sealed. After HOW-1A + LEARN-1A + LEARN-2 (the policy/skill binding wire-up) are all sealed and remote-CI verified, the "verified learning vs hallucinated learning" gap identified in the 2026-05-29 trust audit is closed, the canon glossary entry for "House of Wisdom" can be promoted from DECLARED to MEASURED with cited test names as evidence, and the pair-doc `LEARN_CLOSEOUT.md` is written.

---

## House of Wisdom Checklist (from PDF Section 13)

> **Principle:** The House of Wisdom is verified knowledge, not raw memory.
>
> **Required flow:** experience → receipt → reflection → lesson candidate → SAT review → MuMu approval → House of Wisdom entry → future policy/skill update
>
> **Required:**
>
> - [ ] LEARN-0 verified learning preflight.
> - [ ] HOW-1A local lesson writer.
> - [ ] Lesson proof references.
> - [ ] Lesson approval gate.
> - [ ] Local-only default.
> - [ ] Share-status field.
> - [ ] Lesson replay verifier.
> - [ ] Skill/policy update linkage.
>
> **DOD:** Dema learns only when a lesson is proof-backed and approved.
