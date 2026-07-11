# Receipt: DEMA-ROOT-BOUND-CONSENT-ENVELOPE-PREVIEW-1A

Truth label: `DEMA_ROOT_BOUND_CONSENT_ENVELOPE_PREVIEW_ONLY`

## Slice

PREVIEW_ONLY content-addressed consent-context envelope + fail-closed validator
that BINDS an exact consent phrase to the exact action context — proposal,
payload, capability scope, root set, action class, nonce, and expiry — so a valid
phrase cannot be replayed against a different payload, mission, action class, or
scope.

```text
build (content-addressed envelope) → evaluate (fail-closed) → replay-block self-check
```

Core law: **a consent phrase authorizes exactly one action context — nothing else.**

## Proof Contract

The default gate passes only while every one holds (22 tests + review gate):

- `buildConsentContext` emits a content-addressed envelope over the whitelisted
  fields; `phrase_hash` and `consent_context_hash` are DERIVED, never
  caller-supplied; identical input yields a deep-equal envelope and identical hash;
- **fail-closed evaluation** (`evaluateContextBoundConsent`) returns `accepted:false`
  / verdict `BLOCK` for each of: a phrase that is not an exact byte match; the same
  phrase presented against a different `proposal_hash` / `payload_hash` /
  `capability_scope_hash` / `root_set_hash`; an action-class mismatch (strict ladder
  equality — a `C1_READ` consent never authorizes a `C3_LOCAL_WRITE`); an expired
  consent (`now >= expires_at`); a reused nonce (present in `usedNonces`); a
  missing/empty envelope root set or required phrase; and any field mutated after
  the `consent_context_hash` was sealed;
- a fully matching presented context with an unused nonce and `now < expires_at`
  returns `accepted:true` / verdict `PERMIT_PREVIEW`;
- the envelope and verdict carry only hashes — no private key or raw root-document
  text — and smuggled input fields (private key, raw root body, extra keys) are
  dropped from the envelope by the field whitelist;
- every verdict carries `authority_delta: 0` and the canonical all-false boundary
  (deep-equal against `buildPreviewBoundary()`, not a vacuous `.every`).

## Does NOT prove

- Does not prove a **live root-clause trace registry** (deferred): the envelope binds
  a `root_set_hash`, but a live registry that traces each authorized effect back to
  its governing root clauses is future work.
- Does not prove **live governance / FATE-EffectCap runtime** or any **live mutation**:
  this records and validates a consent binding only.
- Does not run an optimizer, invoke a model, open a network, mint a token, start a
  daemon, or bind identity; boundary all-false, `authority_delta` 0.
- Time is compared via `Date.parse` over caller-supplied RFC3339 strings (`now`,
  `expires_at`) — a pure parse, not a clock read; effects (`nonce`, `expires_at`,
  `now`) are injected by the caller.

`npm run check` runs `root-bound-consent-envelope-preview-check.mjs`.

## Commands

```bash
node --test tests/root-bound-consent-envelope-preview.test.js
node scripts/review/root-bound-consent-envelope-preview-check.mjs --json
npm run check
```
