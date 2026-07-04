# Dema Node0 Space Index 1A Design

Status: Working artifact

## Purpose

`DEMA-NODE0-SPACE-INDEX-1A` starts the Node0 onboarding spine by producing a bounded census of a selected local root. It prepares the later deduplication and type-reorganization slices without moving, deleting, uploading, summarizing, or exposing file contents.

The operator-facing shape is a tutorial quest: "scan the world map." The technical shape is a deterministic, resumable index envelope.

## Approved Approach

Use Approach A: two-phase command behavior.

The default command is metadata-only:

```bash
dema node0-index --root <path> --json
```

Content hashing is opt-in because it opens file bytes:

```bash
dema node0-index --root <path> --hash-content --consent "I CONSENT: HASH NODE0 SPACE <root_hash>"
```

The consent phrase binds to the normalized root hash. Broad phrases such as `GO`, `yes`, `y`, or `proceed` must be rejected.

## Scope

In scope:

- Iterative, chunked directory walk with bounded file, depth, byte, and time budgets.
- Resume checkpoint under `$DEMA_HOME/node0-index/checkpoints/`.
- Default exclusions: `.git`, `node_modules`, `target`, `dist`, `build`, model/checkpoint/voice folders, archive mirrors, and secret-pattern paths.
- Per-entry metadata: relative path, kind, size, mtime, extension, content class, and path hash.
- Optional streamed SHA-256 content hash for regular files only after exact consent.
- Duplicate candidate groups from content hash when hashing is enabled.
- Counts by content class and total indexed bytes.

Out of scope:

- Deduplication apply, quarantine, hardlinking, deletion, or move plans.
- Reorganization apply or SAT-visible summaries.
- Content preview, OCR, embedding, model invocation, network calls, secret reads, wallet behavior, minting, reward activation, federation, or daemon behavior.

## Architecture

Create a focused core module:

```text
packages/core/src/node0-space-index.js
```

Export:

```js
NODE0_SPACE_INDEX_SCHEMA
buildNode0SpaceIndex(options)
verifyNode0SpaceIndex(envelope)
```

The builder accepts injected filesystem functions for tests. It must not read process-global state except through explicit options passed by the CLI wrapper.

Create a CLI wrapper:

```text
apps/cli/src/commands/node0-index.js
```

Wire it into `apps/cli/src/index.js` and the CLI consent matrix.

## Envelope Shape

The output schema is:

```text
bizra.dema.node0_space_index.v0.1
```

Required top-level fields:

- `schema`
- `truth_label: "NODE0_LOCAL_SEED"`
- `mode: "metadata_only_index" | "content_hash_index"`
- `root`
- `limits`
- `checkpoint`
- `summary`
- `content_classes`
- `records`
- `duplicate_candidate_groups`
- `consent`
- `blocked_effects`
- `boundary`

Boundary truth must distinguish metadata from hashing:

```js
{
  filesystem_write_performed: false,
  checkpoint_write_performed: false,
  scanned_root_mutated: false,
  file_content_read: false,
  content_hash_performed: false,
  network_used: false,
  model_invocation_performed: false,
  delete_or_move_performed: false,
  receipt_mint_performed: false,
  federation_invoked: false
}
```

When checkpoint persistence is enabled, only `checkpoint_write_performed` may become true. When `--hash-content` is consented, `file_content_read` and `content_hash_performed` may become true and must be reflected honestly.

## Content Classes

Classify by extension and filename only:

- `code`
- `doc`
- `data`
- `media`
- `archive`
- `binary`
- `model_artifact`
- `secret_metadata_only`
- `unknown`

Secret-pattern paths are metadata-only denied entries. Their contents must not be opened, even during hash mode.

## Checkpoint And Resume

The checkpoint stores progress, not content:

- normalized root hash,
- queue cursor,
- records already emitted,
- denied entries,
- duplicate hash table when hash mode is active,
- schema version,
- checkpoint hash.

Resume is valid only when the root hash, schema, mode, and consent binding match. Otherwise the command starts a new index envelope and marks the old checkpoint incompatible.

## Error Handling

Fail closed:

- Missing root returns `root_missing`.
- Non-directory root returns `root_not_directory`.
- Permission-denied root returns `permission_denied`.
- Entry read failure records a warning and continues.
- Secret-pattern paths are denied without raw content.
- Symlinks are recorded but never followed.
- Hash errors mark that file `hash_status: "unavailable"` and do not crash the whole index.

## Testing Requirements

Use TDD for implementation. Required tests:

- Schema, truth label, and mode are exact.
- Metadata-only mode never opens file content.
- Hash mode rejects broad consent and accepts only the exact root-hash phrase.
- Hash mode streams SHA-256 and detects synthetic duplicate groups.
- Secret-pattern files are never opened in either mode.
- Exclusions skip known large or unsafe directories.
- Checkpoint resume is deterministic.
- Boundary fields reflect metadata-only, checkpoint-write, and hash-content modes honestly.
- CLI emits parseable JSON and correct exit codes.
- Command table and consent matrix include `node0-index`.

Minimum verification before closeout:

```bash
node --test tests/node0-space-index.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```

## Achievement Micro-Compliance

North star: complete the first safe onboarding quest for turning an unknown Node0 space into measured local evidence.

Lead KPIs:

- focused tests pass,
- boundary false/true values match mode,
- no secret content path is opened.

Lag KPIs:

- full repo gates pass,
- the index envelope can feed Slice 2 dedup/reorg planning,
- process-mining can consume real index metrics.

Minimum viable daily action: keep Slice 1 to the spec and plan gate until the implementation plan is approved.

## Success Criteria

The slice is ready for planning when this spec is reviewed and approved. The slice is ready for implementation closeout only after the command can index a fixture tree, resume safely, detect content-hash duplicates with exact consent, and prove it performed no mutation, no network, no model call, no mint, and no federation.
