# LOCAL-MODEL-PULSE-BINDING-PREVIEW-1A

Truth label: `LOCAL_MODEL_PULSE_BINDING_PREVIEW_MEASURED_REPO`

## Receipt

Binds an already-produced local-model invocation result into the Materialization Pulse evidence lane as
suggestion-only data. This is the **mind → Pulse** binding gate: model output enters the system only as
suggestion evidence, with zero authority. It invokes no model.

## Proven

- a local-model invocation result can be carried into the Pulse as suggestion-only evidence
- a completed invocation is admissible ONLY when prompt AND response verdicts are `PUBLIC_SAFE`
- blocked and failed invocations are recordable as failure evidence only (never suggestion)
- unsafe prompt/response verdicts and non-suggestion verdict roles are rejected
- runtime strict-false boundary violations are rejected
- model output never grants action authority
- public-claim, action, mint, wallet, federation, and authority laundering are rejected — even with a recomputed content hash
- content hash is deterministic; `verify` rejects tamper; `run()` self-probes tamper/authority/claim forgeries

## Not proven

- no model is invoked by this kernel
- no semantic truth is proven
- no execution is authorized
- no public claim is authorized
- no receipt is written, no mint, no wallet, no federation, no live URP

## Boundary

Preview-only. `authority_delta` 0. Boundary all-false. The model may suggest; the verifier remains authority.

## Gates

```bash
node --test tests/local-model-pulse-binding-preview.test.js
node scripts/review/local-model-pulse-binding-preview-check.mjs --json
npm test
npm run check
npm run coverage
```
