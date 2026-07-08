# Receipt: NODE0-LOCAL-MISSION-EMIT-CLI-ADAPTER-1A

Truth label: `NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_MEASURED_REPO`

## Slice

One consent-gated operator CLI that turns the already-shipped local-mission preview
kernels into a written proof bundle for one explicit local file:

```text
read one ABSOLUTE file (read-only: size + mtime + sha256 content hash)
→ compose operator candidate (--claim/--task/--boundary or a labeled preview default)
→ ephemeral composition reference (no live Node0 identity / DID)
→ NODE0-LOCAL-MISSION-HARNESS-PREVIEW payload
→ NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW (re-verified)
→ ONLY under exact write consent: atomic write of 3 artifacts under DEMA_HOME
```

Command:

```bash
dema mission emit <abs-file> --consent "GO: node0 local mission emit" \
  [--claim "…" --task "…" --boundary "…"] \
  [--excerpt-consent "GO: include local excerpt in mission packet"] [--json]
```

Artifacts written (only with exact consent + a verified emission):

```text
$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/receipt.json
$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/world_state_delta_preview.json
$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/dema_report.json
```

## Proof Contract (Proven)

- The exact operator phrase `GO: node0 local mission emit` gates the write; missing/wrong
  phrase writes nothing (fail-closed) — the artifacts directory is not even created.
- With consent + a verified emission, exactly the three named artifacts are written under
  the `<run_id>` directory (tmp + rename, mode `0600`), and nothing outside it.
- Each written artifact is valid JSON; its `content_hash` equals the emission kernel's.
- `boundary` all-false, `committed_live: false`, `mint_allowed: false`, `authority_delta: 0`
  on the emission and on every artifact.
- The source file is byte-identical after the run (read-only, no mutation).
- Rejects a relative path, a missing file, a directory, and an absent file argument.
- The run id is deterministic for a fixed composition reference and the same input.

## Not Proven

- No live model, network, daemon, mint, federation, or live URP is invoked.
- Writing three preview artifacts is NOT executing a mission and applies no world-state:
  the world-state delta is declared (`applied: false`), not applied.
- The composition signature is an ephemeral in-memory preview — no persisted key, no DID,
  no real Node0 identity is bound.
- The adapter re-implements no kernel logic; it composes the shipped harness → emission path.

## Smoke

```bash
node --test tests/node0-local-mission-emit-cli-adapter.test.js
node scripts/review/node0-local-mission-emit-cli-adapter-check.mjs --json
npm run check
```

`npm run check` runs `node0-local-mission-emit-cli-adapter-check.mjs` and keeps
`NODE0_LOCAL_MISSION_EMIT_CLI_ADAPTER_1A` at `MEASURED_REPO`.
