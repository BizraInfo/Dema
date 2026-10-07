# Receipt: OPENROUTER-ADMISSION-POLICY-COMPILER-1A

Truth label: `OPENROUTER_ADMISSION_POLICY_COMPILER_MEASURED_REPO`

## Slice

This pure compiler turns a supplied external OpenRouter route declaration into a
safe, non-executable request plan or an explicit refusal. It uses a static
synthetic fixture only; it does not contact OpenRouter or establish that any
model, provider, account, key, credit, or privacy setting is live.

```text
validate policy → compile plan → content-address → independently re-derive → tamper-reject
```

## Required admission policy

The only plan that can compile has all of these supplied conditions:

- `provider_id: openrouter` and an approved credential reference only;
- exact `provider/model` identifier, never `openrouter/free` random routing;
- `EXTERNAL` locality and `PROPOSAL_ONLY` authority;
- explicit non-empty underlying-provider allowlist;
- disabled fallback, denied data collection, required ZDR, and required routing metadata;
- free variants limited to `EXPERIMENTAL_EVALUATION`;
- `consent.required: true` and `consent.status: NOT_REQUESTED`.

The emitted plan deliberately lacks an `Authorization` header and carries no
prompt, key, credit, raw secret, provider response, or actual invocation trace.
Human consent remains a later runtime concern; this compiler cannot consent to
or initiate a remote request.

## Proof contract

- raw secret-bearing input is refused and never reflected in diagnostics;
- a missing privacy/routing condition, route expansion, random free router, or
  unapproved credential reference refuses;
- identical supplied inputs produce identical content-addressed plans;
- verifier requires independent input and rejects a rehashed authority escalation;
- all boundary effects remain false and `authority_delta` remains `0`.

## Commands

```bash
node --test tests/openrouter-admission-policy-compiler.test.js
node scripts/review/openrouter-admission-policy-compiler-check.mjs --json
npm run check
```
