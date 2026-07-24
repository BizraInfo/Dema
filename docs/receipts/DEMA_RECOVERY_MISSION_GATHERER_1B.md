# Receipt: DEMA-RECOVERY-MISSION-GATHERER-1B

Truth label: `DEMA_RECOVERY_MISSION_GATHERER_MEASURED_REPO`

## Slice

Read-only gatherer + CLI adapter that turns the DEMA-RECOVERY-MISSION-ENGINE-1A kernel into a runnable Recovery Mission preview. Real file METADATA (no content) feeds `reconstructRecoveryCandidates` (reused unmodified) via a bounded, read-only fs effect adapter and the `dema recovery preview` CLI space-subcommand.

```text
plan → build (row boundary law → reconstructRecoveryCandidates) → verify → tamper-reject
```

## Proof Contract

The default gate must pass only while:

- the exact GO phrase matches byte-for-byte (`GO: dema recovery mission gather preview`),
- every row's declared `root` is a member of the declared `source_boundary.roots`, its resolved `root + relative_path` stays inside that root (no `..` traversal escape), and its resolved path is not under any declared exclusion — any row failing this is EXCLUDED into `not_accessed_report` with reason `out_of_source_boundary` and is never constructed into an evidence item,
- a row with a missing/`null` `mtime_iso` buckets under the literal `"UNKNOWN"` chronology sentinel (never interpolated),
- candidates are capped at 7 (delegated to `reconstructRecoveryCandidates`; overflow named `exceeds_candidate_cap`),
- a row claiming `content_read: true` fails closed at plan time — the whole request is refused, not silently dropped (`content_read_claimed`),
- `max_files` (when declared) fails closed on overrun (`max_files_exceeded`) rather than silently truncating,
- the payload is content-addressed (`bizra.canonical-json.v1`) and body-bound verified: schema, truth label, canonicalization identity triplet, all-false boundary (exact declared key set, never vacuous), `content_read_allowed: false`, and candidate cap are each rejected even when the forger recomputes the hash,
- the boundary stays all-false (no execution authority),
- the read-only fs effect adapter (`apps/cli/src/commands/dema-recovery-mission-fs-gatherer.js`) never follows a symlink whose real target escapes the declared root, and fails closed (throws) on a `max_files` overrun instead of returning a partial, unlabeled result.

**Known limit (declared, not hidden):** same as `DEMA-RECOVERY-MISSION-ENGINE-1A` / `NODE0-REALM-STATE-KERNEL-1A` — `verify()` checks internal semantic invariants only; independent authenticity is NOT proved (an attacker controlling every semantically permitted field and recomputing the hash still requires an external signature or anchor). No relevance signal is derivable from metadata alone — candidates tie-break alphabetically by `asset_id`, never a fabricated score. Human revival (selecting a candidate) is a separate governed step (the engine's `HUMAN_REVIVAL` event) — this slice previews candidates only, it never selects one.

`npm run check` runs `dema-recovery-mission-gatherer-check.mjs` and keeps `DEMA_RECOVERY_MISSION_GATHERER_1B` at `MEASURED_REPO`.

## Evidence

- Focused test: 28/28 (`node --test tests/dema-recovery-mission-gatherer.test.js`).
- Slice gate `--json`: `ok: true`, non-empty candidate set, malicious (`content_read:true`) fixture rejected.
- Real CLI smoke: `dema recovery preview --root <abs> --mission "<text>" --consent "GO: dema recovery mission gather preview" --json` against a scratch dir — `ok:true`, all-false boundary, content-addressed hash.
- `kernel-purity-check`: 0 violations (the pure kernel has no fs import; the CLI adapter in `packages/core/src` has no direct fs import either — the fs effect adapter is always caller-injected and lives in `apps/cli/src`, out of the kernel-purity scan). `canonical-json-v1-check`: PASS (registered consumer). `no-overclaim`: diffs `origin/main...HEAD`.

## Commands

```bash
node --test tests/dema-recovery-mission-gatherer.test.js
node scripts/review/dema-recovery-mission-gatherer-check.mjs --json
node apps/cli/src/index.js recovery preview --root <abs> --mission "<objective>" --consent "GO: dema recovery mission gather preview" --json
npm run check
```
