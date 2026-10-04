# DEMA-MASTER-REGISTRY-EFFECTIVE-CONFIG-1A

Truth label: `DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_MEASURED_REPO`

## Purpose

MR-1A is the smallest configuration-composition seam for First-Human Node0. It
does not create a registry service. It deterministically resolves supplied
inputs into an effective route or an explicit non-route.

```text
MR desired revision       verified observation snapshot
        authoritative              observational
                \                  /
                 \                /
                  pure resolver
                       |
        EFFECTIVE | REFUSED | UNKNOWN
```

Native provider settings, environment variables, and credentials remain outside
this resolver. They may be represented only as a supplied non-authoritative
native-config observation; they cannot silently alter an MR decision.

## Input Planes

### Desired plane

The required MR input has one revision and a disabled fallback policy:

```js
{
  schema: "bizra.dema.master_registry.desired.v0.1",
  revision: { id, content_hash },
  policy: { fallback: "DISABLED", locality: "LOCAL_ONLY" },
  bindings: [{
    id, capability_class, model_id,
    admission_state, qualification_state,
    roles, locality, authority_class,
  }],
  routes: [{ role, primary_binding_id, fallback: "DISABLED" }],
}
```

`capability_class` is currently explicit as `INFERENCE_PROVIDER` or
`AGENT_CLIENT`; this preserves the distinction between a served inference
endpoint and an agent CLI. A model build tool belongs in a later schema unless
it has a separately observed serving binding.

### Observation plane

The supplied observation binds itself to the desired revision and declares its
freshness explicitly. The pure kernel has no clock, so it refuses to invent a
freshness judgement.

```js
{
  schema: "bizra.dema.master_registry.observation.v0.1",
  mr_revision: { id, content_hash },
  freshness_state: "FRESH" | "STALE" | "UNKNOWN",
  bindings: [{ binding_id, model_id, observation_state, runtime_state }],
}
```

`STALE`, `UNKNOWN`, absent, unverified, and revision-mismatched observations
never turn a declared route into `EFFECTIVE`.

### Native/secret plane

`native_config` is optional evidence only. It may state a requested binding or
model but never wins route selection. Matching values are reported as
non-authoritative; material mismatch gives `CONFIG_CONFLICT`; raw secret-bearing
fields are refused and never copied to output. Secret references are not stored
or dereferenced in this slice.

## Eligibility

For one requested role, the resolver selects only the declared route’s explicit
primary binding when all conditions hold:

```text
admission_state      == ACTIVE
qualification_state  == QUALIFIED
observation_state    == VERIFIED
runtime_state        == READY
role                 matches request
locality             matches LOCAL_ONLY request
authority_class      matches request
MR revisions         match exactly
fallback             == DISABLED
```

No candidate search, health probe, automatic fallback, or invocation occurs.

## Output and Verification

The resolver returns a safe decision envelope; it excludes raw desired,
observation, and native inputs. `build...Payload(input)` content-addresses that
envelope. `verify(payload, input)` first checks its canonical body hash and then
independently re-derives the expected payload from the separately supplied
inputs. This detects a rehashed change to the selected route as well as a
rehashed authority increase.

This is re-derivation of a supplied input contract, not proof that a provider
was actually observed or that a desired revision was persistent or signed.

## Boundary

All output boundaries remain false:

```text
no filesystem | no network | no provider call | no provider state change
no Dema runtime | no Node0 runtime | no fallback | no consent | no receipt
authority_delta = 0
```

`TASK-075.04 / PROD-03` may consume this resolver only after this slice’s
independent proof is complete. Its later provider observation and exact-consent
work remains separate and is not authorized here.
