# Node0 World Map 1A Design

Status: Working artifact

## Purpose

`NODE0-WORLD-MAP-1A` makes the Node0 onboarding spine honest about scope:
Node0 is the whole local machine and connected evidence surface, not the Dema
repository and not the Downloads folder. The slice composes existing measured
metadata into one local world-map envelope so later hashing, deduplication,
reorganization, SAT summaries, Proof-of-Impact review, and no-mint decisions
start from the same source of truth.

This slice is a map composer, not a new broad scanner. It reads already-built
metadata envelopes and operator-provided metadata summaries. It does not open
private file contents, reorganize data, submit anything to SAT, verify impact,
or mint tokens.

## Approved Approach

Use Approach A: composer-first.

The kernel accepts lane inputs from existing safe surfaces:

```text
node0-space-index envelopes
node0-evidence-source-registry payload
node0-local-resource-pool summary
GitHub repository metadata
Google Drive metadata
public domain metadata
future device and model metadata summaries
```

It normalizes those inputs into a single world map with lane status,
coverage metrics, blocked gates, and root-specific next actions.

## Scope

In scope:

- Pure composer module with deterministic, schema-tagged output.
- Lane status classification: `covered`, `truncated`, `stale`, `missing`,
  `blocked`, or `unmeasured`.
- Whole-Node0 lane inventory for local assets, proofs, docs, repos, cloud
  archives, GitHub metadata, Drive metadata, public domains, models, devices,
  secret-denied paths, and generated-noise surfaces.
- Root-specific hash consent phrase preservation from each supplied
  `node0-space-index` envelope.
- Coverage summary across all lanes: records, files, directories, bytes,
  denied entries, duplicate candidates, and truncation.
- Explicit next gates for hash consent, dedup plan, reorg plan, apply receipt,
  SAT metadata summary, PoI review, and blocked mint.
- CLI preview command that emits JSON and human-readable summary without
  scanning roots by default.

Out of scope:

- Whole-computer recursive scan from the world-map command.
- Content hashing unless a prior lane envelope already proves exact
  root-bound hash consent.
- Dedup apply, quarantine apply, hardlinking, deletion, or move execution.
- SAT publish, URP submission, PoI verification, wallet access, token mint,
  federation, daemon start, model invocation, or live agent RL.

## Architecture

Create a focused core module:

```text
packages/core/src/node0-world-map.js
```

Export:

```js
NODE0_WORLD_MAP_SCHEMA
NODE0_WORLD_MAP_TRUTH_LABEL
buildNode0WorldMap(input)
verifyNode0WorldMap(payload)
```

Add a CLI wrapper only after the design is converted into an implementation
plan:

```text
apps/cli/src/commands/node0-world-map.js
```

Recommended CLI shape:

```bash
dema node0-world-map --json
```

The command should compose known local envelopes and summaries. It must not
walk `/`, `/data`, or `/data2` by default. Future explicit scan collection stays
owned by `dema node0-index --root <path>`.

## Lane Contract

Each lane must use this minimal shape:

```js
{
  lane_id: "local_assets",
  source_type: "node0_space_index",
  status: "covered",
  privacy_level: "private_local",
  evidence_ref: "sha256:...",
  root: {
    display: "/data2/BIZRA-ASSET",
    normalized_path_hash: "sha256:...",
    hash_consent_phrase: "I CONSENT: HASH NODE0 SPACE sha256:..."
  },
  metrics: {
    records_count: 0,
    files_count: 0,
    dirs_count: 0,
    symlinks_count: 0,
    denied_count: 0,
    total_indexed_bytes: 0,
    weak_duplicate_candidate_group_count: 0,
    strong_duplicate_candidate_group_count: 0
  },
  gates: {
    hash_consent: "available" | "not_applicable" | "missing",
    dedup_plan: "blocked_until_hash_scan",
    reorg_plan: "blocked_until_dedup_plan",
    sat_summary: "blocked_until_apply_receipt",
    poi_review: "blocked_until_evidence_review",
    mint: "blocked_no_live_mint"
  }
}
```

Lane identifiers:

```text
local_assets
proofs
docs
repos
cloud_archive
github_metadata
drive_metadata
public_domains
models
devices
secrets_denied
generated_noise
```

## Output Contract

Schema:

```text
bizra.dema.node0_world_map.v0.1
```

Truth label:

```text
NODE0_WORLD_MAP_METADATA_ONLY
```

Required top-level fields:

- `schema`
- `truth_label`
- `world_map_status`
- `operator_topology`
- `coverage`
- `lanes`
- `pipeline`
- `next_actions`
- `impact_queue`
- `mint`
- `boundary`
- `content_hash`

`world_map_status` is one of:

```text
EMPTY
PARTIAL_METADATA_MAP
READY_FOR_HASH_CONSENT
READY_FOR_DEDUP_PLAN
BLOCKED_BY_INVALID_INPUT
```

## Pipeline Law

The pipeline order is fixed:

```text
source_registry
metadata_lane_map
content_hash_scan
dedup_plan
reorg_plan
apply_reorg
sat_metadata_summary
proof_of_impact
mint
```

SAT visibility is metadata-only and blocked until an apply receipt exists.
PoI remains review-only. Mint is always blocked in this slice.

## Boundary

The world-map boundary must remain all false:

```js
{
  filesystem_write_performed: false,
  scanned_root_mutated: false,
  file_content_read: false,
  content_hash_performed: false,
  network_used: false,
  model_invocation_performed: false,
  delete_or_move_performed: false,
  hardlink_performed: false,
  sat_submission_performed: false,
  poi_verification_performed: false,
  token_minted: false,
  wallet_accessed: false,
  federation_invoked: false,
  daemon_started: false
}
```

If an input lane was built from a content-hash index, the lane may report that
hashing happened in that source envelope. The world-map composer itself must
still report `file_content_read: false` and `content_hash_performed: false`.

## Error Handling

Fail closed:

- Missing input returns `EMPTY`, not a fake map.
- Invalid lane schema marks that lane `blocked`.
- Stale lane hash or payload mismatch marks the map `BLOCKED_BY_INVALID_INPUT`.
- Duplicate lane IDs are rejected.
- Economy simulations are excluded from `impact_queue`.
- Any lane with `mint_allowed: true` is rejected.
- Any attempt to promote `token_minted`, `wallet_accessed`, `sat_submission`,
  or `poi_verification` fails verification even if the content hash is
  recomputed.

## Testing Requirements

Use TDD for implementation. Required tests:

- Schema, truth label, and status are exact.
- Empty input produces an honest empty map with all-false boundary.
- Multiple fixture `node0-space-index` envelopes compose into separate lanes.
- Truncated indexes remain visible as `truncated`, not `covered`.
- Root-specific hash consent phrases are preserved per lane.
- Metadata-only lanes produce `READY_FOR_HASH_CONSENT`.
- Content-hash lanes produce `READY_FOR_DEDUP_PLAN` without SAT or mint.
- GitHub, Drive, and public-domain metadata lanes do not count as content
  ingestion or impact verification.
- Economy simulation is excluded from impact queue.
- Duplicate lane IDs fail closed.
- Self-consistent forged live mint fails verification.
- CLI emits parseable JSON and human-readable next actions.
- Existing `dema realm world-map` remains local-assets-only and is not promoted
  as whole-Node0 truth.

Minimum verification before closeout:

```bash
node --test tests/node0-world-map.test.js
node scripts/review/node0-world-map-check.mjs --json
npm test
npm run check
npm run llm:guidance
git diff --check
```

## Achievement Micro-Compliance

North star: give Dema a truthful whole-Node0 map so one human and one machine
can move from messy local assets to verified impact receipts without false
claims or unsafe mutation.

Lead KPIs:

- lane count by source family,
- percent of key Node0 roots represented by measured metadata,
- count of root-specific hash consent phrases available,
- number of blocked or stale lanes surfaced.

Lag KPIs:

- dedup planning can start from content-hash lanes,
- reorg planning stays plan-only,
- SAT receives no raw content,
- PoI queue contains only review candidates,
- mint remains blocked until verified impact and external review.

Minimum viable daily action: produce this world-map spec, review it, then
convert it into a test-first implementation plan only after approval.

## Success Criteria

The design is ready for implementation planning when this spec is reviewed and
approved. The implementation is ready for closeout only when Dema can compose a
whole-Node0 metadata map from fixture lanes and measured local envelopes while
proving no root mutation, no content read, no network call, no model invocation,
no SAT submission, no PoI verification, no wallet access, and no token mint.
