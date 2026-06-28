# NODE0-REVERSIBLE-EXECUTE-GATE-1A

Truth label: `NODE0_REVERSIBLE_EXECUTE_SANDBOX_MEASURED`

## Purpose

`NODE0-REVERSIBLE-EXECUTE-GATE-1A` is the first **measured** filesystem mutation surface in this repo. It executes one low-risk sandbox rename that `#301` previewed — under exact execute consent, inode-contained paths, backup-before-action, sealed receipt, and proven undo.

This is sandbox-only execution. It does not mutate operator data, `$DEMA_HOME`, or production paths.

## Input Contract

```js
planReversibleRename({
  sandboxRoot,
  fileName,
  newName,
  goPhrase,
  actionType,
})
```

Exact execute consent:

```text
GO: execute governed reversible rename in sandbox
```

Supported action type:

```text
rename_preview_to_governed_action_candidate
```

## Output Contract

Executed receipts emit:

```text
schema
truth_label
executed
action_type
sandbox_root
from
to
before_hash
after_hash
measured_state
state_hash
content_hash
backup
undo
consent
executed_at
blocked_by
boundary
receipt_log_path
```

Hash split:

- `content_hash` — integrity over the declared receipt body (excluding `content_hash`, `state_hash`, `receipt_log_path`)
- `state_hash` — independent bind over `measured_state` (post-execute sandbox file snapshot)

## Review Gate Rules

1. Execute only inside a caller-supplied sandbox root with inode containment.
2. Require exact execute GO phrase (byte match, fail-closed).
3. Write backup before rename (exclusive create, no clobber).
4. Seal receipt to append-only sandbox log.
5. Prove undo against the on-disk backup, not receipt self-hash alone.
6. fs-aware verify must anchor `state_hash` to disk and require sealed-log presence.
7. No delete, network, secrets access, or path traversal escape.

## Boundary

Receipt boundary keys remain true/false explicitly, including:

```text
sandbox_only
network_used
delete_performed
secrets_accessed
path_traversal_blocked
sandbox_escape_blocked
reversible
file_renamed
backup_written
undo_available
```

## Residual (honest)

`content_hash` and `state_hash` are integrity binds, not authenticity. Full anti-forgery requires Ed25519 receipt signing (deferred; operator key is a §1 action). TOCTOU on the sandbox directory between lstat and write is out of scope for the single-operator local model.

## Proof Commands

```bash
node --test tests/node0-reversible-execute-gate.test.js
node scripts/review/node0-reversible-execute-gate-check.mjs --json
npm test
npm run check
```

## What This Proves

Dema can take one real, reversible, sandbox-contained rename with measured before/after/state hashes and backup-anchored undo.

## What This Does Not Prove

Operator-wide execution, production mutation, daemon runtime, network use, token mint, wallet access, or signed receipt authenticity.
