# Receipt: NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A

Truth label: `NODE0_LOCAL_MISSION_HARNESS_PREVIEW_MEASURED_REPO`

## Slice

Operator-invoked local mission harness: reads one explicitly-named local file (metadata + hash, content only on separate consent), builds a mission packet, runs the pure mission-pulse kernel over a composition reference, and shapes a preview receipt artifact — fs confined to the CLI/adapter, kernel stays pure, no daemon, no network, no model, no mutation except the consented receipt.

```text
plan → build → verify → tamper-reject
```

## The first I/O boundary crossing

Two layers:

- **Pure kernel** (`packages/core/src/node0-local-mission-harness-preview.js`): reads NO file. Takes an
  INJECTED file-ref + an OPERATOR-SUPPLIED candidate + a composition reference, composes a mission
  packet, runs the pure mission pulse, shapes a preview receipt artifact. Purity asserted by a test.
- **CLI adapter** (`apps/cli/src/commands/mission.js`, `dema mission pulse <file>`): the effect layer —
  the only place fs happens.

## Proof Contract

The kernel gate must pass only while:

- the exact GO phrase matches byte-for-byte,
- the injected file-ref carries a `sha256:` content-hash and does not assert `raw_content_leaves_node0`,
- an excerpt is present ONLY when `content_read_performed` is true (excerpt consent given),
- the candidate {claim, task, boundary} is present and the pulse accepts it (no overclaim),
- the embedded pulse verdict re-verifies (→ composition → genesis signature anchor), so a
  forge-and-recompute of the chain is still rejected,
- the receipt artifact stays `committed_live: false`,
- the boundary stays all-false (no execution authority).

The CLI/adapter contract (`tests/node0-local-mission-harness-cli.test.js`): reads exactly the one
named file read-only; the source is byte-identical after the run; metadata+hash only by default; a
bounded excerpt enters the packet ONLY under the exact `--excerpt-consent` phrase; the receipt is
written ONLY with `--receipt` + the exact `--consent` phrase, atomically (tmp+rename, mode 0600) under
`$DEMA_HOME/mission/receipts`; it refuses a directory or a missing file.

**Honesty boundary:** the harness performs NO semantic extraction. The claim/task/boundary are the
operator's (CLI flags), not the machine's. No model is invoked.

## Boundary

`verified_preview_harness` verdict only. No live URP, no mint, no wallet, no settlement, no
federation, no daemon, no watcher, no directory crawl, no network, no model invocation, no
source-file mutation. `boundary` all-false · `authority_delta` 0 · `mint_allowed` false. The composition
reference is an ephemeral-key preview, not a live Node0 identity.

`npm run check` runs `node0-local-mission-harness-preview-check.mjs` and keeps `NODE0_LOCAL_MISSION_HARNESS_PREVIEW_1A` at `MEASURED_REPO`.

## Commands

```bash
node --test tests/node0-local-mission-harness-preview.test.js
node --test tests/node0-local-mission-harness-cli.test.js
node scripts/review/node0-local-mission-harness-preview-check.mjs --json
dema mission pulse <file> --consent "GO: node0 local mission harness preview" --claim "…" --task "…" --boundary "…"
npm run check
```
