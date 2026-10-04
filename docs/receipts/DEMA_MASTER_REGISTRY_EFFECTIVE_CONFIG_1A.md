# Receipt: DEMA-MASTER-REGISTRY-EFFECTIVE-CONFIG-1A

Truth label: `DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_MEASURED_REPO`

## Scope

This is a pure, repository-measured composition kernel. Given a declared MR
desired revision, a caller-supplied verified observation snapshot, a requested
role, and optional native/environment evidence, it returns exactly one of:

```text
EFFECTIVE  one declared primary binding is eligible
REFUSED    policy or configuration denies a route
UNKNOWN    the supplied observation cannot establish the route
```

It does not read a registry from disk, inspect environment variables, probe a
port, invoke a provider, or change provider state.

## Proof Contract

- The same supplied desired state, observation, request, and native input
  produce structurally identical output.
- An effective binding must be `ACTIVE`, `QUALIFIED`, role-allowed,
  locality-compliant, authority-class-compliant, `VERIFIED`, and `READY`.
- A missing, stale, unverified, or revision-mismatched observation remains
  `UNKNOWN`; it never selects a declared binding by itself.
- Native/environment input is non-authoritative. A mismatch with the MR primary
  returns `CONFIG_CONFLICT`, and matching input changes no route.
- Raw secret-bearing fields are rejected without reflecting their values.
- Fallback is exactly `DISABLED`; an unavailable primary remains unselected.
- Every result carries `authority_delta: 0` and an all-false boundary.
- `verify(payload, input)` needs independent supplied input and re-derives the
  content hash; an internally rehashed authority escalation still fails.

## Evidence Commands

```bash
node --test tests/dema-master-registry-effective-config.test.js
node scripts/review/dema-master-registry-effective-config-check.mjs --json
npm run check
```

## Limits

The review fixture proves the resolver’s deterministic contract only. It is not
a live model/provider observation, an MR persistence or pointer implementation,
a provider qualification, a secret store, a consent ceremony, a receipt-minting
path, or a Dema/Node0 runtime activation.
