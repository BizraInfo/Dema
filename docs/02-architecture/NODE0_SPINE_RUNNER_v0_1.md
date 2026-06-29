# NODE0 Spine Runner v0.1

Truth label: `NODE0_MEASURED_PROOF_SPINE_SANDBOX_RUN`

## Purpose

This slice wires the **already-measured** #306–#309 kernels into one operator
command:

```bash
dema node0 spine run --consent "GO: run measured proof spine in sandbox" [--sandbox <dir>] [--json]
```

It is the first Dema-local bridge from discrete review gates to a single
consent-gated sandbox run. It is **not** BIZRA-DATA-LAKE Node0 activation.

## Flow

```text
plan (spine consent)
→ #306 execute + verify receipt
→ #307 sign + verify + bind attestation
→ #308 build + verify chain (anchor = execute content_hash)
→ #309 sign + verify + bind chain head
→ JSON summary (+ heavy artifacts stripped from CLI --json)
```

Inner stage consents are the canonical fixed phrases from each kernel; the spine
GO phrase authorizes the composed run. Inner module GO phrases are composed
programmatically — they are not user-supplied bypass paths. Missing or wrong
wrapper consent fails closed before any mutation, signing, or chain step.

## Reversibility

The operator CLI **performs the sandbox mutation** and retains the resulting
sandbox state. It does **not** auto-rollback by default.

The JSON envelope exposes:

- `reversibility.backup_written` / `backup_path`
- `reversibility.undo_manifest_present` / `undo_available`
- `reversibility.execute_receipt_verified`
- `reversibility.undo_proof_status` (`not_run` for CLI; `proven` when the review
  gate runs with `proveUndo`)

Undo can be executed separately via the #306 `undoReversibleRename` path using the
sealed execute receipt.

## What this proves

- Operators can run the full measured spine once with exact-string consent.
- Sandbox containment and signing≠execution boundaries hold across the stack.

## What this does not prove

- Live Node0 activation (`GATED_OPERATOR_ONLY` in DATA-LAKE).
- Arbitrary real-time tasks, federation, or mutation outside the sandbox root.

Receipt: [`docs/receipts/NODE0_SPINE_RUNNER_CLI_1A.md`](../receipts/NODE0_SPINE_RUNNER_CLI_1A.md).
