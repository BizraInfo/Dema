# DEMA-RECOVERY-MISSION-GATHERER-1B

Truth label: `DEMA_RECOVERY_MISSION_GATHERER_MEASURED_REPO`

## Purpose

Read-only gatherer + CLI adapter that turns the `DEMA-RECOVERY-MISSION-ENGINE-1A` kernel into a runnable Recovery Mission PREVIEW. It feeds real, boundary-enforced file METADATA (never content) into the already-shipped, reused `reconstructRecoveryCandidates` helper and exposes the result via `dema recovery preview`.

## Pipeline

```text
apps/cli/src/commands/recovery.js          (argv parsing, console output, exit code)
  -> packages/core/src/dema-recovery-mission-cli-adapter.js   (orchestration; gatherFiles injected)
    -> apps/cli/src/commands/dema-recovery-mission-fs-gatherer.js   (the ONLY fs surface: read-only metadata walk)
    -> packages/core/src/dema-recovery-mission-gatherer.js   (pure kernel: plan -> build -> verify -> run)
      -> packages/core/src/dema-recovery-mission-engine.js#reconstructRecoveryCandidates (reused, unmodified)
```

## Boundary Enforcement Law

For every injected row `{ root, relative_path, extension, size_bytes, mtime_iso }`:

1. `root` must be a member of `source_boundary.roots` (declared roots only).
2. `normalize(join(root, relative_path))` must stay under `root` (rejects `..` traversal escapes) — pure string arithmetic, `node:path` only, no fs.
3. The resolved path must not fall under any `source_boundary.exclusions` entry.

A row failing any check is EXCLUDED into `not_accessed_report` with reason `out_of_source_boundary` and is **never** constructed into an evidence item — it never reaches `reconstructRecoveryCandidates`, `chronology`, or `candidates`. This is a second, defense-in-depth layer ahead of `reconstructRecoveryCandidates`'s own (simpler, root-membership-only) `inBoundary` check.

## Metadata-Only Law

This slice reads no file CONTENT. A row carrying `content_read: true` fails the WHOLE request closed at `plan()` time (`content_read_claimed`) — it is refused, not silently dropped. Content access is a declared future step requiring separate consent.

## Input Contract

```js
runDemaRecoveryMissionGatherer({ consent, input })
```

```text
input.objective_text     non-empty string
input.source_boundary    { roots: [abs, ...], exclusions: [abs, ...] }
input.now_iso             valid ISO string
input.files                [{ root, relative_path, extension, size_bytes, mtime_iso|null }]
input.max_files            optional positive integer cap (fail-closed on overrun)
```

Exact consent:

```text
GO: dema recovery mission gather preview
```

## CLI Surface (ADR-012 space-subcommand, no new kebab name)

```text
dema recovery preview --root <abs> --mission "<objective>" --consent "<phrase>"
                       [--exclude <abs>]... [--max-files <n>] [--json]
```

READ-ONLY, no mutation, NO auto-selection — this previews candidates only. Human revival (choosing a candidate) is a separate governed step (`dema-recovery-mission-engine.js`'s `HUMAN_REVIVAL` event), out of scope for this slice.

## Effect Adapter (the ONLY fs surface)

`apps/cli/src/commands/dema-recovery-mission-fs-gatherer.js` walks one bounded root with `fs.readdirSync`/`fs.lstatSync`, collecting ONLY metadata. It never reads file content, never follows a symlink whose real target escapes the declared root, never lists outside the declared root, and fails closed (throws `RecoveryMissionGatherCapExceededError`) once the collected row count reaches `maxFiles` — never a silent partial result.

## Output Contract

```text
schema, truth_label, ok, content_hash
candidates[]  (<=7, ranked)
chronology[]  (best_evidence_time or literal "UNKNOWN")
contradiction_map[]  (verbatim, never synthesized)
not_accessed_report[]
boundary  (9-key, all-false)
blocked_by[]
```

## Verification

```js
verifyDemaRecoveryMissionGatherer(payload)
```

Body-bound re-derivation plus semantic invariants with stable block codes: schema, truth label, canonicalization algorithm, hash algorithm, text encoding, all-false boundary (exact declared key set, never vacuous), `content_read_allowed: false`, and candidate cap are each rejected even when the forger recomputes the hash.

Limits (declared, tested): independent authenticity is NOT proved (same declared limit as `DEMA-RECOVERY-MISSION-ENGINE-1A` / `NODE0-REALM-STATE-KERNEL-1A`). No relevance signal is derived from metadata — candidates tie-break alphabetically by `asset_id`.

## Boundaries

- Pure kernel (`dema-recovery-mission-gatherer.js`); no fs/network/clock/random
- CLI adapter (`dema-recovery-mission-cli-adapter.js`) has no direct fs import — `gatherFiles` is always caller-injected
- The ONLY fs surface is the effect adapter, read-only, bounded, cap-enforced
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant

## Files

```text
packages/core/src/dema-recovery-mission-gatherer.js
packages/core/src/dema-recovery-mission-cli-adapter.js
apps/cli/src/commands/dema-recovery-mission-fs-gatherer.js
apps/cli/src/commands/recovery.js
tests/dema-recovery-mission-gatherer.test.js
scripts/review/dema-recovery-mission-gatherer-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_RECOVERY_MISSION_GATHERER_1B.md
docs/02-architecture/DEMA_RECOVERY_MISSION_GATHERER_v0_1.md
```

## Commands

```bash
node --test tests/dema-recovery-mission-gatherer.test.js
node scripts/review/dema-recovery-mission-gatherer-check.mjs --json
node apps/cli/src/index.js recovery preview --root <abs> --mission "<objective>" --consent "GO: dema recovery mission gather preview" --json
npm test
npm run check
```
