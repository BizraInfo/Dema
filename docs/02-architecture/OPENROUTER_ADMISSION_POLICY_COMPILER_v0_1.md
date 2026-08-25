# OPENROUTER-ADMISSION-POLICY-COMPILER-1A

Truth label: `OPENROUTER_ADMISSION_POLICY_COMPILER_MEASURED_REPO`

## Purpose

OpenRouter is an external capability aggregator, not Dema's implicit fallback.
This slice compiles the minimum remote-route policy that a future governed
runtime would need before it can ask a human for exact external-inference
consent. It makes no API request and does not modify MR-1A's local-only route
resolver.

```text
future MR external declaration
        +
explicit OpenRouter privacy/routing policy
        |
        v
pure admission compiler
        |
        +--> ADMITTED non-executable plan
        |
        +--> REFUSED diagnostic
```

## Input boundary

The compiler accepts a caller-supplied MR revision reference, route declaration,
and OpenRouter policy. It does not read an MR file, environment variable, native
provider configuration, or credential store.

```js
{
  mr_revision: { id, content_hash },
  route: {
    binding_id,
    model_id: "provider/model" | "provider/model:free",
    locality: "EXTERNAL",
    authority_class: "PROPOSAL_ONLY",
    purpose: "EXPERIMENTAL_EVALUATION" | "EXTERNAL_SPECIALIST",
  },
  policy: {
    provider_id: "openrouter",
    credential_ref: "native_auth/openrouter",
    underlying_provider_allowlist: ["one-explicit-provider"],
    fallback: "DISABLED",
    data_collection: "DENY",
    zero_data_retention: "REQUIRED",
    router_metadata: "REQUIRED",
  },
}
```

`openrouter/free` is refused because it can select a changing random model.
An explicit `:free` model form is permitted only for experimental evaluation;
it is still an external, non-authoritative route and is not a production
continuity, PAT, SAT, FATE, or receipt claim.

## Compiled plan

For an admitted declaration, the plan is a value—not a request. It contains the
OpenRouter chat-completions endpoint, a POST method, the exact model identifier,
the credential reference, `X-OpenRouter-Metadata: enabled`, and the restrictive
provider policy:

```js
{
  only: ["one-explicit-provider"],
  allow_fallbacks: false,
  data_collection: "deny",
  zdr: true,
}
```

The plan never contains `Authorization`, a key, prompt, completion, cost,
provider response, or state-changing capability. The eventual runtime must
resolve the credential locally, demand exact human consent bound to a mission,
make the network call, record actual route metadata, and independently verify
the result. Those behaviors are not implemented or authorized here.

## Consent and self-harness boundary

```text
human consent required     = true
human consent requested    = false
human consent consumed     = false
self-consent               = impossible in this compiler
```

The compiler has no `consent` input field. Supplying one makes the input invalid.
The deterministic harness can reject an unsafe route, but it cannot authorize,
execute, or self-improve the route.

## Boundary

```text
no filesystem | no network | no credential read | no provider call
no provider state change | no Dema/Node0 runtime | no fallback
no consent request/consumption | no cost/credit action | no receipt mint
authority_delta = 0
```

## Dependency and next boundary

This slice depends on MR-1A only. It does not start or alter `TASK-075.04`.
The next possible live step remains a separately authorized external-invocation
slice after local-model qualification, external-data classification, exact human
consent, and a real provider observation contract.
