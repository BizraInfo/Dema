# DEMA-ROOT-BOUND-CONSENT-ENVELOPE-PREVIEW-1A

Truth label: `DEMA_ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_ONLY`

## Purpose

PREVIEW_ONLY content-addressed consent-context envelope + fail-closed validator.
It binds an exact consent phrase to the exact action context so a valid phrase
cannot be replayed against a different payload, mission, action class, or scope.
Records/validates a consent binding only — no optimizer, no model, no network, no
live mutation, no mint, no identity binding. Core law: **a consent phrase
authorizes exactly one action context — nothing else.**

## Envelope Schema

```text
schema                 bizra.consent.context.v0.1
truth_label            PREVIEW_ONLY
proposal_hash          sha256 of the proposal the caller has already hashed
action_class           C0_OBSERVE | C1_READ | C2_DRAFT | C3_LOCAL_WRITE | C4_EXTERNAL | C5_IRREVERSIBLE
capability_scope_hash  sha256 of the capability scope
payload_hash           sha256 of the payload
root_set_hash          sha256 of the governing root set (non-empty required)
nonce                  single-use nonce (non-empty required)
expires_at             RFC3339 string
required_phrase        the exact consent phrase (non-empty required)
phrase_hash            DERIVED — sha256 of required_phrase
consent_context_hash   DERIVED — sha256 over the canonical body of all the above
```

Only whitelisted fields are carried. `phrase_hash` and `consent_context_hash` are
DERIVED, never caller-supplied. The caller hashes the underlying documents; the
kernel only ever binds hashes — never raw secrets or root-document text.

## Functions

```js
buildConsentContext(input)                                  // → content-addressed envelope
evaluateContextBoundConsent({ envelope, presented, now, usedNonces })  // → fail-closed verdict
```

`presented` carries what the caller is ACTUALLY about to do:

```text
proposal_hash, payload_hash, capability_scope_hash, action_class, root_set_hash, phrase
```

## Verdict Contract

```text
schema           bizra.consent.context_eval.v0.1
accepted         boolean
verdict          PERMIT_PREVIEW | BLOCK
reason           first block code, or context_bound_consent_permitted
blocked_by[]     every failed binding
escalation       true when presented action class outranks the envelope class
boundary         canonical all-false preview boundary
authority_delta  0
```

## Fail-closed blocks

`phrase_mismatch`, `proposal_hash_mismatch`, `payload_hash_mismatch`,
`capability_scope_hash_mismatch`, `action_class_mismatch`, `root_set_hash_mismatch`,
`root_set_missing`, `required_phrase_missing`, `nonce_missing`, `consent_expired`,
`now_invalid`, `expires_at_invalid`, `nonce_replayed`, `consent_context_hash_mismatch`.

## Boundaries

- Pure kernel; effects (`nonce`, `expires_at`, `now`) are injected — no `Date.now`,
  no `Math.random`. Time is compared with `Date.parse` (a pure parse, not a clock read).
- No fs, net, http, child_process, fetch, daemon, wallet, token, federation, or live
  execution.
- Boundary is the canonical all-false preview boundary (`packages/core/src/boundary-schema.js`).
- `authority_delta` is 0 in every verdict — evaluating consent grants no authority.

## Does not prove

- No live root-clause trace registry (deferred).
- No live governance / FATE-EffectCap runtime, no live mutation.

## Files

```text
packages/consent/src/root-bound-consent-envelope-preview.js
tests/root-bound-consent-envelope-preview.test.js
scripts/review/root-bound-consent-envelope-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_1A.md
docs/02-architecture/DEMA_ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/root-bound-consent-envelope-preview.test.js
node scripts/review/root-bound-consent-envelope-preview-check.mjs --json
npm test
npm run check
```
