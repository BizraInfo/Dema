# Receipt: NODE0-MISSION-HARNESS-RETURN-REVIEW-PREVIEW-1A

Truth label: `NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_MEASURED_REPO`

## Slice

Pure preview-only return-review over a dema mission pulse receipt: verifies the receipt's structure + invariants, states what was proven and what was not, and recommends exactly one next safe action; reads no model/network/daemon, receipt read-only via the CLI adapter, kernel stays pure.

```text
plan → build → verify → tamper-reject
```

## The loop it closes

```text
local file → hash → mission packet → pulse → preview receipt → RETURN REVIEW
```

`dema mission review <receipt>` reads a receipt (read-only) → the pure kernel reviews it → proven / not-proven / one next safe action.

## Proof Contract

The gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the reviewed receipt's schema matches the harness schema, mission_id is present, file-ref and pulse content-hashes are well-formed `sha256:…`, `committed_live` is false, and a dema_report is present (else `receipt_ok` is false),
- **reviewing a bad receipt still completes** (the review's job is to report it): `run.ok` stays true while `receipt_ok` is false,
- the verdict is content-addressed and body-bound; verify rejects a tamper, an **ok-without-proof** forgery, and a **not-ok-but-claims-proof** forgery,
- the boundary stays all-false (no execution authority).

Honesty: it reads no file in the kernel (the CLI adapter does), judges NO semantic correctness, re-runs no pulse, and cannot re-derive the pulse→composition→genesis chain from the receipt SUMMARY alone (declared in `what_was_not_proven`). The single next action is a preview recommendation, not an execution.

## Boundary

`return_review_complete` verdict only. No live URP, mint, wallet, settlement, federation, daemon, model invocation, network, or source mutation. `boundary` all-false · `authority_delta` 0 · `grants_action` false · `mint_allowed` false.

`npm run check` runs `node0-mission-harness-return-review-preview-check.mjs` and keeps `NODE0_MISSION_HARNESS_RETURN_REVIEW_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-mission-harness-return-review-preview.test.js
node --test tests/node0-mission-harness-return-review-cli.test.js
node scripts/review/node0-mission-harness-return-review-preview-check.mjs --json
dema mission review <receipt-path>
npm run check
```
