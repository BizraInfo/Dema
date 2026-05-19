# Phase 01 - Specification

## Scope

Specify the Dema actuator-boundary spine that keeps Bash, GUI automation, mobile
agents, filesystem mutation, network calls, and future spending actions behind
explicit consent and governed runtime handoff.

This spec covers Dema as the local product face. It does not authorize runtime
execution, background daemons, receipt minting, federation, SAT implementation,
token issuance, or Proof-of-Impact settlement inside this repo.

## Current facts

- `dema ambient` describes Bash as a maximal-risk actuator.
- `dema consent plan` drafts a preview-only `ConsentScope` shape from user
  intent and never records approval.
- `scripts/review/actuator-check.mjs` audits source for raw shell execution
  patterns in `apps`, `packages`, and `scripts`.
- Dema's current boundary is read-only or preview-only for these surfaces.
- Node0 and deeper EffectCap runtime remain governed handoff targets, not Dema
  local execution paths.

## Product objective

Give the operator a visible, testable answer to four questions before any risky
actuator can exist:

1. What actuator class is being requested?
2. What exact resource and action would be needed?
3. What consent proof shape would bind the request?
4. Which local gate proves Dema did not bypass the consent spine?

## Functional requirements

### FR1 - Actuator inventory

Dema must classify actuator classes consistently.

Required classes:

- `bash`: command/process/package/service/network actuator.
- `gui`: visible desktop or input automation actuator.
- `mobile_agent`: code/state movement across hosts or zones.
- `filesystem_mutation`: write/delete/move operation.
- `external_call`: service, API, webhook, or network call.
- `spend`: token, money, quota, credit, or budget action.

### FR2 - Consent spine

Every future effecting operation must be representable as:

```text
Intent -> MissionDraft -> ConsentScope -> PolicyDecision -> EffectCap -> OutcomeLog
```

Required consent fields:

- `mission_id`
- `agent_id`
- `resource_id`
- `action`
- `purpose`
- `expires_at`
- `commitment_hash`

### FR3 - Dema preview boundary

Dema may:

- observe local readiness;
- inventory local models;
- draft mission and consent plans;
- render risk warnings;
- run read-only review checks.

Dema must not:

- execute raw Bash;
- start background daemons;
- perform model inference without exact consent;
- mint artifacts or runtime receipts;
- connect Node1/Node2;
- claim economic reward or public federation.

### FR4 - Review gate

The review gate must reject high-risk raw shell patterns:

- `child_process.exec(...)`
- `child_process.execSync(...)`
- `spawn(...)` or `spawnSync(...)` with `shell: true`

Allowed patterns remain bounded:

- `execFile` or `execFileSync` with explicit argv arrays;
- `spawn` or `spawnSync` without shell expansion, when the caller has its own
  validation and failure handling.

### FR5 - Proof-of-Truth labels

Every actuator-boundary report must expose:

- formal status: what schema or gate constrains the action;
- cryptographic status: whether commitments exist or are deferred;
- empirical status: what local check or observation supports the claim;
- economic status: closed unless verified impact and governance exist.

## Edge cases

- Empty or vague intent must fail consent planning.
- Unsafe file references must be excluded from permissions.
- Audit-shaped tasks that request external delivery must be flagged.
- Raw shell helper code in tests must be permitted only as analyzer fixtures,
  not production code.
- A future subprocess surface must fail closed if target binary, script, or
  allowed arguments are invalid.
- Revoked or expired consent must block the next effect, not only future
  missions.

## Non-functional requirements

- Preserve zero runtime dependencies.
- Keep new files under 500 lines.
- Keep outputs schema-tagged when machine-readable.
- Keep all local state under `DEMA_HOME` or `~/.dema` if any state is later
  introduced.
- Do not hide failures behind broad catches or success-shaped defaults.
- Use proof-safe language: preview, read-only audit, governed runtime handoff.

## Out of scope

- Runtime EffectCap implementation.
- Bash sandbox implementation.
- URP/SAT execution.
- PoI/IMP/GOLD economic mechanics.
- CI workflow mutation.
- External service posting.

## Success criteria

- The spec decomposes into small implementation slices.
- Each slice has TDD anchors before code work.
- `npm test`, `npm run check`, `npm run llm:guidance`, and `git diff --check`
  remain the local completion gate for code changes.
