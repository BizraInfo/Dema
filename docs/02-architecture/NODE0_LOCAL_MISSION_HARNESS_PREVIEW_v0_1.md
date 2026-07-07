# NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A

Truth label: `NODE0_LOCAL_MISSION_HARNESS_PREVIEW_MEASURED_REPO`

## Purpose

The **first I/O boundary crossing** — the rung above `NODE0-FIRST-REAL-LOCAL-MISSION-PULSE-PREVIEW-1A`
(#344). It connects one operator-invoked local file to the pure mission pulse, splitting cleanly into
two layers so the kernel stays pure and all filesystem access is explicit and consent-scoped:

- **Pure kernel** `packages/core/src/node0-local-mission-harness-preview.js` — reads NO file. Given an
  INJECTED file-ref, an OPERATOR-SUPPLIED candidate, and a composition reference, it composes a
  mission packet, runs the pure pulse, and shapes a preview receipt artifact.
- **CLI adapter** `apps/cli/src/commands/mission.js` (`dema mission pulse <file>`) — the effect layer;
  the only place `fs` happens (read-only source read + consented receipt write).

**Honesty boundary:** NO semantic extraction. The claim/task/boundary are the operator's (CLI flags),
not the machine's; no model is invoked.

## CLI

```text
dema mission pulse <file> \
  --consent "GO: node0 local mission harness preview" \
  --claim "…" --task "…" --boundary "…" \
  [--receipt] \
  [--excerpt-consent "GO: include local excerpt in mission packet"] \
  [--json]
```

- Reads exactly one named file **read-only** to compute its `sha256` + metadata. Default: metadata +
  hash only. A bounded excerpt (≤280 chars) enters the mission packet ONLY under the exact
  `--excerpt-consent` phrase (`content_read_performed: true`); it stays local.
- The receipt is written ONLY with `--receipt` + the exact `--consent` phrase — atomically (tmp +
  rename, mode 0600) under `$DEMA_HOME/mission/receipts/<mission_id>.json`. The source file is never
  mutated. No daemon, no watcher, no directory crawl, no network, no model.

## Kernel Input Contract

```js
runNode0LocalMissionHarnessPreview({ consent, input })
// input = {
//   file_ref: { path, size_bytes, mtime_iso, content_hash: "sha256:…", content_read_performed, excerpt?, raw_content_leaves_node0:false },
//   composition_ref: <composition verdict payload>,   // signature-backed genesis anchor
//   candidate_extraction: { claim, task, boundary },   // operator-supplied
//   now_iso? // injected; kernel has no clock
// }
```

Exact consent: `GO: node0 local mission harness preview`

## Output Contract

```text
schema · truth_label · ok · status (verified_preview_harness | blocked_preview_harness)
content_hash · harness_ready
receipt_artifact_preview (committed_live:false) · receipt_target_relpath · dema_report
boundary (all-false) · mint_allowed:false · authority_delta:0 · blocked_by[]
```

## Verification

```js
verifyNode0LocalMissionHarnessPreview(payload)
```

Body-bound re-derivation over the whole verdict, PLUS re-verification of the embedded pulse verdict —
which embeds the composition verdict, which embeds the signature-backed genesis anchor. A
forge-and-recompute of the harness body that tampers that chain is still rejected. The receipt must
stay `committed_live: false`.

## What this does NOT prove

No live runtime, no model intelligence, no real founder-data ingestion at scale, no mint, no
federation, no daemon, no network, no public readiness. The composition reference is an ephemeral-key
preview, not a live Node0 identity.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-local-mission-harness-preview.js
tests/node0-local-mission-harness-preview.test.js
scripts/review/node0-local-mission-harness-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_LOCAL_MISSION_HARNESS_PREVIEW_1A.md
docs/02-architecture/NODE0_LOCAL_MISSION_HARNESS_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-local-mission-harness-preview.test.js
node scripts/review/node0-local-mission-harness-preview-check.mjs --json
npm test
npm run check
```
