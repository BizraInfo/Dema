# DEMA-VERIFIED-ANSWER-RECEIPT-CACHE-PREVIEW-1A

Truth label: `DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_MEASURED_REPO`

## Purpose

Preview-only verified-answer receipt cache: stores previously verified answers as content-addressed records and reuses them only when fresh, in-scope, source-hash-matched, and truth_label verified; a cache hit reuses proof, never grants action, never mints, never turns saved cost into value.

## Input Contract

```js
runDemaVerifiedAnswerReceiptCachePreview({ consent, input })
```

Exact consent:

```text
GO: dema verified answer receipt cache preview
```

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Record model

```text
cache_id            content-addressed identity (question + answer_digest + source_hashes + scope)
canonical_question  normalized (trim, lowercase, collapse whitespace)
answer_digest       sha256 of the answer (the answer itself is not stored)
answer_summary      short human summary
source_refs[]       source identifiers   source_hashes[]  parallel sha256 of sources
consent_scope       "public" | "private:<owner>"
freshness_policy    { ttl_ms }           created_at / expires_at (created_at + ttl_ms, injected clock)
status              candidate | verified | stale | rejected | superseded
grants_action:false authority_delta:0    boundary: all-false
content_hash        sha256 over the whole body
```

## Domain API

```js
createVerifiedAnswerRecord(input)     // validates (throws on missing field) → content-addressed verified record
verifyVerifiedAnswerRecord(record)    // body-bound re-derivation + invariant checks
lookupVerifiedAnswer(query, cache)    // returns a hit ONLY if every gate passes (below)
compareFreshness(record, now)         // "fresh" | "stale" | "unknown"  (now injected)
supersedeRecord(oldRecord, newRecord) // immutable → new version, status "superseded", re-hashed
```

Lookup returns a hit only when a record is: integrity-valid · status `verified` · fresh
(`now < expires_at`) · exact consent-scope match (a `private:<owner>` scope requires
`operator_consent === owner`) · source-hash set match. Any miss returns `{ hit: false }`. A hit
reuses proof only — `grants_action: false`, `authority_delta: 0`.

## Verification

```js
verifyVerifiedAnswerRecord(record)
```

Body-bound re-derivation over the body-minus-hash. Rejects a tampered `content_hash`, a non-zero
`authority_delta`, a vacuous **or** flipped boundary (deep key check — `{}` does not pass), and an
unknown status.

**Limitation (not overclaimed):** integrity is content-addressing only, **not** cryptographic
tamper-resistance. A forge-**and**-recompute launder is not defended here — that needs an independent
signature/anchor. A hit **saves model cost; it does not create value and does not mint.**

## Boundaries

- Pure kernel; the clock (`created_at` / `now`) is injected — no fs / network / process / clock / random
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — cache/preview authority ≠ execution authority

## Files

```text
packages/core/src/dema-verified-answer-receipt-cache-preview.js
tests/dema-verified-answer-receipt-cache-preview.test.js
scripts/review/dema-verified-answer-receipt-cache-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_1A.md
docs/02-architecture/DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/dema-verified-answer-receipt-cache-preview.test.js
node scripts/review/dema-verified-answer-receipt-cache-preview-check.mjs --json
npm test
npm run check
```
