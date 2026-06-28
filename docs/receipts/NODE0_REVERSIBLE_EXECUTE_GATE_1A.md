# Receipt: NODE0-REVERSIBLE-EXECUTE-GATE-1A

Truth label: `NODE0_REVERSIBLE_EXECUTE_SANDBOX_MEASURED`

## Slice

This slice closes the ACT hinge for sandbox-only execution:

```text
plan → execute → seal receipt → verify → undo → prove restoration
```

The kernel performs one governed reversible rename inside a caller-supplied sandbox. `#301` previewed eligibility; this slice performs the action under harder containment.

## Files

```text
packages/core/src/node0-reversible-execute-gate.js
tests/node0-reversible-execute-gate.test.js
scripts/review/node0-reversible-execute-gate-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
tests/dema-capability-truth-registry.test.js
docs/02-architecture/NODE0_REVERSIBLE_EXECUTE_GATE_v0_1.md
docs/receipts/NODE0_REVERSIBLE_EXECUTE_GATE_1A.md
docs/TESTING.md
docs/CURRENT_LIMITS.md
```

## Proof Contract

The default gate must pass only while:

- exact execute GO phrase matches byte-for-byte,
- a real sandbox rename executes with `before_hash === after_hash`,
- `content_hash` and `state_hash` recompute exactly,
- fs-aware verify anchors `state_hash` to disk and finds the receipt in the sealed log,
- undo is proven against the independent on-disk backup.

`npm run check` also runs `dema-capability-truth-registry-check.mjs`, which must keep `NODE0_REVERSIBLE_EXECUTE_GATE_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-reversible-execute-gate.test.js
node scripts/review/node0-reversible-execute-gate-check.mjs --json
node --test tests/dema-capability-truth-registry.test.js
node --test tests/kernel-purity-check.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```

## Boundaries

- Sandbox directory only — not operator data or `$DEMA_HOME`
- Exact-string execute consent
- No delete, network, secrets, daemon, token, wallet, federation
- No autonomous action outside the sandbox plan

## Promotion Rule

May not claim operator-wide execution, production mutation, or live governed runtime outside the sandbox without separate consent and proof gates.
