# Receipt: DEMA-VERIFIED-ANSWER-RECEIPT-CACHE-PREVIEW-1A

Truth label: `DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_MEASURED_REPO`

## Slice

Preview-only verified-answer receipt cache: stores previously verified answers as content-addressed
records and reuses them only when the record is status `verified`, fresh (against an injected `now`),
consent-scope matched, and source-hash matched. A cache **hit reuses proof**; it never grants action,
never mints, and never turns saved model cost into value.

```text
create → verify → lookup(gate ×5) → supersede
plan   → build  → verify → tamper-reject   (review-gate loop)
```

## Proof Contract

Verified by 26 focused tests + the review gate. The contract holds only while:

- the exact GO phrase matches byte-for-byte, and `plan` positively validates the record ontology
  (question, answer, source_refs, parallel source_hashes, consent_scope, freshness_policy, created_at);
- each record is content-addressed — `cache_id` binds identity (question + answer_digest + source_hashes
  + scope); `content_hash` binds the whole body;
- `lookupVerifiedAnswer` returns a hit **only** when every gate passes: status `verified`, fresh
  (`now < expires_at`), exact consent-scope match (a `private:<owner>` scope requires
  `operator_consent === owner`), and source-hash set match — any miss returns no hit;
- a superseded or rejected record never hits; `compareFreshness` and `supersede` are pure and
  clock-injected;
- `verify` re-derives the hash over the body-minus-hash and rejects a tampered `content_hash`, a
  non-zero `authority_delta`, a vacuous **or** flipped boundary (deep key check — `{}` does not pass),
  and an unknown status;
- a hit reuses proof only: `grants_action: false`, `authority_delta: 0`, boundary all-false.

## What this does NOT prove

- **Not cryptographic tamper-resistance.** Integrity is body-bound content-addressing only. A
  forge-**and**-recompute launder (change a field *and* re-derive the hash so the body is self-consistent)
  is **not** defended here — that needs an independent anchor (a signature over the record, or an
  externally measured state hash). Do not claim launder-resistance until that anchor lands.
- No operator execution, daemon runtime, network use, wallet access, or live federation.
- A hit **saves model cost; it does not create value and does not mint.** Cost saved is not impact.

`npm run check` runs `dema-verified-answer-receipt-cache-preview-check.mjs` and keeps
`DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/dema-verified-answer-receipt-cache-preview.test.js
node scripts/review/dema-verified-answer-receipt-cache-preview-check.mjs --json
npm run check
```
