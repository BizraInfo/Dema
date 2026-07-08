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
→ ONLY under exact write consent: atomic write of three preview artifacts
   plus one verification envelope (emission.json) under DEMA_HOME
```

Command:

```bash
dema mission emit <abs-file> --consent "GO: node0 local mission emit" \
  [--claim "…" --task "…" --boundary "…"] \
  [--excerpt-consent "GO: include local excerpt in mission packet"] [--json]
```

Written (only with exact consent + a verified emission) — three preview artifacts
plus one verification envelope:

```text
$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/receipt.json
$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/world_state_delta_preview.json
$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/dema_report.json
$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/emission.json   # verification envelope
```

`emission.json` is a **verification envelope**, not a fourth artifact. It wraps the
untouched, content-addressed emission payload (with `harness_result` intact — the exact
object the mission-pilot cockpit kernel re-verifies as its `input.emission`) under an
`emission` key, and mirrors the run id, the source-file / emission / harness content
hashes, the per-artifact hashes, the artifact relative paths, and the pulse ladder as
convenience fields **outside** that content-addressed body (so they never alter the
emission's own content hash). The future cockpit reader loads this one file to re-verify
the full chain (emission → harness → pulse → composition → signature-backed genesis
anchor) and render the gates panel from disk alone.

## Proof Contract (Proven)

- The exact operator phrase `GO: node0 local mission emit` gates the write; missing/wrong
  phrase writes nothing (fail-closed) — the artifacts directory is not even created.
- With consent + a verified emission, exactly the three named artifacts **plus the
  verification envelope** (`emission.json`) are written under the `<run_id>` directory
  (tmp + rename, mode `0600`), and nothing outside it.
- Each written artifact is valid JSON; its `content_hash` equals the emission kernel's.
- `boundary` all-false, `committed_live: false`, `mint_allowed: false`, `authority_delta: 0`
  on the emission, on every artifact, and on the envelope.
- **Sufficiency:** the on-disk `emission.json` re-verifies in the mission-pilot cockpit
  kernel — loading it and feeding its nested `emission` to
  `runNode0MissionPilotCockpitPreview` returns `ok:true` with a rendered cockpit view
  including the gates panel (this unblocks the `dema mission cockpit <run-id>` reader).
- **Exclusion:** the envelope carries no private-key material (`BEGIN … PRIVATE KEY`), no
  field literally named `private_key`, no `did:` secret, and no raw source content
  (a public-key PEM and all-false boundary attestation flags such as `private_key_exposed`
  are admissible metadata).
- The source file is byte-identical after the run (read-only, no mutation).
- Rejects a relative path, a missing file, a directory, and an absent file argument.
- The run id is deterministic for a fixed composition reference and the same input.

## Not Proven

- No live model, network, daemon, mint, federation, or live URP is invoked.
- Writing three preview artifacts plus a verification envelope is NOT executing a mission
  and applies no world-state: the world-state delta is declared (`applied: false`), not
  applied.
- The envelope adds no new intelligence: its convenience fields are a read-only projection
  of the nested content-addressed emission (the source of truth).
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
