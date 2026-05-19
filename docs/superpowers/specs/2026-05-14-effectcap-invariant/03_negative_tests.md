# Phase 03 - Negative Tests

## Required negative test set

### NT1 - No ambient authority

Core agent/runtime modules must not gain raw side-effect imports. Approved
effect-worker boundaries may be introduced later, but ordinary modules may not
directly import raw filesystem mutation, HTTP clients, child processes, or
database drivers for effectful work.

Expected denial: `ambient_authority_forbidden`.

### NT2 - No caller-provided execution closure

`EffectCap.perform` accepts intent data only. The dangerous form is:

```ts
effectingOperation(cap, resourceId, action, exec)
```

because the caller can declare one action and execute another.

Expected denial: `caller_exec_closure_forbidden`.

### NT3 - Declared intent cannot diverge from execution

An intent with action `read` must never dispatch to a `write`, `execute`,
`call`, or `spend` implementation.

Expected denial: `declared_action_diverged`.

### NT4 - Revoked consent blocks mid-mission

A consent scope that was valid at mission start but later revoked must deny the
next effect.

Expected denial: `consent_revoked`.

### NT5 - Unknown operation denies

Missing sealed registry entries must fail closed.

Expected denial: `unknown_operation`.

### NT6 - Invalid params deny

Params must match the target registry schema before dispatch.

Expected denial: `invalid_params`.

### NT7 - High-risk Bash requires explicit human approval

Bash-like execution must remain denied unless exact human approval is present in
the active consent scope.

Expected denial: `explicit_human_approval_required`.

### NT8 - Policy DSL is data-only

Policy rules must not use `eval`, `Function`, shell interpolation, or executable
condition strings.

Expected denial: `policy_code_forbidden`.

## Completion gate

```bash
node --test tests/effectcap-invariant.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```
