# Phase 01 - Specification

## Scope

Define the pre-runtime EffectCap invariants for BIZRA Node0 and Dema. This is a
specification and negative-test slice only. It does not implement runtime
execution, Bash sandboxing, receipt minting, federation, PoI, IMP, GOLD, or URP
activation.

Truth label: `EFFECTCAP_INVARIANT_SPEC_PRE_RUNTIME`.

## Core thesis

BIZRA Node0 is an Intent Verification Machine:

```text
declared intent -> consent -> lawful execution -> evidence -> impact
```

The actuator must be governed before the actor is empowered. Bash and similar
tools are universal actuators, so no side-effect path may bypass the consent
spine.

## Object-capability law

```text
No raw actuator path.
No side effect without EffectCap.
No EffectCap without ConsentScope.
No caller-provided execution closure.
No impact claim without EvidenceChain.
No economic mint without verified ImpactEvent.
```

## Required data model

```ts
type Action = "read" | "write" | "execute" | "call" | "spend";

interface Intent {
  resourceId: string;
  action: Action;
  params: unknown;
}

interface EffectCap {
  perform(intent: Intent): Promise<Outcome | Denied>;
}
```

## Sealed registry requirement

The trusted runtime owns the implementation registry:

```text
(resourceId, action) -> param schema -> trusted implementation
```

Agents may submit only intent data. They must never pass an `exec` callback,
closure, function body, shell string, policy code, or implementation pointer.

## Consent requirements

An EffectCap request must bind:

- `mission_id`
- `agent_id`
- `resource_id`
- `action`
- `purpose`
- `expires_at`
- `commitment_hash`
- current consent version

Consent may be active, expired, revoked, or missing. Only active consent can
reach the sealed registry.

## Policy requirements

Policy must be data-only. Rules may use structured operators such as:

```json
{
  "all": [
    {
      "field": "mission.category",
      "op": "not_in",
      "value": ["speculation", "riba"]
    }
  ]
}
```

Rules must not use `eval`, `Function`, shell interpolation, or arbitrary code
strings.

## Runtime denial requirements

The runtime must deny:

1. unknown `(resourceId, action)` registry entries;
2. invalid params for the target schema;
3. mismatched intent/action pairs;
4. revoked or expired consent;
5. high-risk Bash execution without explicit human approval;
6. any caller-provided execution closure.

## Proof-of-Truth channel mapping

- Formal: finite action enum, sealed registry, schema validation, negative tests.
- Cryptographic: future EffectLog and EvidenceChain hash commitments.
- Empirical: one-node diagnostic proves actual effects match declared intent.
- Economic: closed until verified ImpactEvent governance exists.

## Out of scope

- Implementing the EffectCap runtime.
- Granting any capability.
- Running Bash or external tools.
- Issuing receipts.
- Creating or publishing PRs.
- Activating Node1, Node2, URP, PoI, IMP, or GOLD.
