# DEMA-FDE-ISNAD-REPLAY-CAPSULE-PREVIEW-0A

Truth label: `DEMA_FDE_ISNAD_REPLAY_CAPSULE_PREVIEW_ONLY`

## Purpose

PREVIEW_ONLY content-addressed capsule that preserves WHY a mission stopped and
WHERE each claim came from — not only WHAT happened — and replays that verdict from
the capsule ALONE, without the model. It composes four already-shipped pieces —
evidence references, an Isnād lineage per claim, an FDE failure diagnosis, and a
routing decision derived from that diagnosis — under authority-monotonicity. Records
and replays a capsule only: no execution, no model, no network, no mint, no identity
binding. Core law: **the routing is a pure function of the diagnosis + evidence, and
the verdict replays from the capsule alone — the mission survives the model.**

## Capsule Schema

```text
schema               bizra.dema.fde_isnad_replay_capsule.v0.1
truth_label          PREVIEW_ONLY
event_hash           sha256 of the mission-stop event the caller has already hashed
source_lineage       array of Isnād steps: { step, ref_hash, role }
source_lineage_hash  DERIVED — sha256 over the canonical lineage array
diagnosis            an FDE class (dema-fde-dual-diagnostic vocabulary)
diagnosis_hash       DERIVED — sha256 of the diagnosis label
route                DERIVED from the diagnosis + evidence (see routing map)
route_hash           DERIVED — sha256 of the route label
authority_delta      0 always
execution_allowed    false always
mint_allowed         false always
replay_exact         true when the capsule's own replay reproduces
capsule_hash         DERIVED — sha256 over the whole body minus capsule_hash
```

`role ∈ origin | first_appearance | author_or_model | transformation | evidence |
counterevidence | verifier | status`. Only whitelisted body/step fields are carried;
the kernel binds hashes + enum labels only — never raw evidence text or a private key.

## Routing map (pure, DERIVED)

```text
boundary_violation                                   → stop   (HIGHEST precedence)
(no lineage evidence step)                           → insufficient_evidence_stop
implementation_defect | test_drift                   → patch_proposal
proof_gap | doc_drift                                → proof_repair_proposal
environment_gap | dependency_gap | permission_gap    → operator_or_environment_repair (outward — never a code patch)
github_actions_billing_lock                          → operator_or_environment_repair (outward vendor failure)
unknown | any unmapped class                         → insufficient_evidence_stop     (fail closed)
```

## Functions

```js
buildCapsule(input)                 // → content-addressed capsule (route DERIVED, effect guards forced off)
verifyCapsule({ capsule })          // → fail-closed verdict
replayCapsule(capsule)              // → model-free re-derivation of route + verdict; sets replay_exact
deriveCapsuleRoute(diagnosis, hasEvidence)  // → the pure routing map
sealCapsuleBody(fields)             // → content-address any body (used by build, tests, the review gate)
runFdeIsnadReplayCapsulePreview({ input })  // → orchestrator (build → verify → replay → forged-route self-probe)
```

## Verdict Contract

```text
schema           bizra.dema.fde_isnad_replay_capsule_eval.v0.1
accepted         boolean
verdict          PERMIT_PREVIEW | BLOCK
reason           first block code, or fde_isnad_capsule_permitted
blocked_by[]     every failed binding
boundary         canonical all-false preview boundary
authority_delta  0
```

## Fail-closed blocks

`invalid_schema`, `invalid_truth_label`, `event_hash_missing`,
`source_lineage_missing`, `invalid_lineage_role:<role>`,
`lineage_ref_hash_missing:<step>`, `missing_evidence`, `invalid_diagnosis_class`,
`source_lineage_hash_mismatch`, `diagnosis_hash_mismatch`, `route_hash_mismatch`,
`forged_route`, `authority_delta_not_zero`, `execution_allowed_not_false`,
`mint_allowed_not_false`, `capsule_hash_mismatch`.

`buildCapsule` additionally THROWS on an input `authority_delta > 0`,
`execution_allowed:true`, or `mint_allowed:true` — a failure may never increase
authority or unlock execution/mint.

## Boundaries

- Pure kernel; effects are injected (the caller supplies `event_hash` and every
  `ref_hash`) — no `Date.now`, no `Math.random`, no fs/net/http/child_process/fetch.
- No model invocation, no daemon, no wallet, no token, no federation, no live
  execution.
- Boundary is the canonical all-false preview boundary (`packages/core/src/boundary-schema.js`).
- `authority_delta` is 0, `execution_allowed` and `mint_allowed` are false, in every
  capsule and every verdict.

## Does not prove

- No live FDE runtime, no live mission, no live governance.
- No verified impact, no autopatch, no live remediation.
- The capsule is content-addressed, not Ed25519-signed (signing is a separate,
  already-shipped surface).

## Files

```text
packages/core/src/fde-isnad-replay-capsule-preview.js
tests/fde-isnad-replay-capsule-preview.test.js
scripts/review/fde-isnad-replay-capsule-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_FDE_ISNAD_REPLAY_CAPSULE_PREVIEW_0A.md
docs/02-architecture/DEMA_FDE_ISNAD_REPLAY_CAPSULE_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/fde-isnad-replay-capsule-preview.test.js
node scripts/review/fde-isnad-replay-capsule-preview-check.mjs --json
npm test
npm run check
```
