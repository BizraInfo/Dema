# NODE0-FATE-STAGED-EFFECT-1A

Truth label: `NODE0_FATE_STAGED_EFFECT_MEASURED_REPO`

## Purpose

G6 composition kernel: FATE exact-string consent gates a staged reversible effect with independent world observation and exactly-once crash recovery (effect_done_receipt_absent never re-executes)

## Input Contract

```js
runNode0FateStagedEffect({ consent, input })
```

Exact consent:

```text
GO: dema fate staged effect
```

## Output Contract

```text
schema
truth_label
ok
content_hash
boundary.execution_allowed (false)
blocked_by[]
```

## Verification

```js
verifyNode0FateStagedEffect(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority


## Composition laws (G6 groundwork)

```text
consent layering  kernel GO phrase (machinery) != REQUIRED_PHRASE (FATE subject)
stage record      binds fate phrase + action + before-digest INSIDE its hash
after-image       PREDICTABLE: rename preserves bytes -> after == before digest
journal           append-only JSONL, hash-linked, torn-tail tolerant
recovery table    effected -> observe+commit · staged -> execute once · else halt
contradiction     gate refuses undo on diverged world -> RECOVERY_REQUIRED (evidence kept)
```

Drift rulings pinned for P0:

1. Two-key consent: this slice\u2019s GO authorizes machinery only; the staged
   effect moves solely under the distinct REQUIRED_PHRASE bound in the stage.
2. Exactly-once counts the PRE-CRASH execution: recovered commits carry
   `effect_execution_count: 1`, never 2 \u2014 recounting would mint phantom work.
3. Recovery across a "backup-written, rename-not-done" gate window surfaces as
   RECOVERY_REQUIRED (stale `.node0-*` backup makes wx fail) \u2014 honest hold,
   manual clearance, never silent cleanup.
4. Scope: ONE sandboxed rename per journal; multi-action missions compose
   upward through the mission supervisor (spec phase 02), not here.

## Files

```text
packages/core/src/node0-fate-staged-effect.js
tests/node0-fate-staged-effect.test.js
scripts/review/node0-fate-staged-effect-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_FATE_STAGED_EFFECT_1A.md
docs/02-architecture/NODE0_FATE_STAGED_EFFECT_v0_1.md
```

## Commands

```bash
node --test tests/node0-fate-staged-effect.test.js
node scripts/review/node0-fate-staged-effect-check.mjs --json
npm test
npm run check
```
