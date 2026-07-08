# Receipt: NODE0-MISSION-PILOT-COCKPIT-CLI-ADAPTER-1A

Truth label: `NODE0_MISSION_PILOT_COCKPIT_CLI_ADAPTER_MEASURED_REPO`

## Slice

One **read-only** operator CLI — the read companion to `dema mission emit`. It loads the
on-disk `emission.json` verification envelope a prior emit wrote and renders one operator
truth view of that run, re-verifying the full chain and independently re-checking every
artifact FILE on disk:

```text
validate <run-id> against ^[0-9a-f]{16}$  (BEFORE any path is built — path-traversal guard)
→ resolve $DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/
→ read emission.json (read-only) → take .emission (nested content-addressed emission)
→ runNode0MissionPilotCockpitPreview({ input: { emission } })
     (re-verifies emission → harness → pulse → composition → signature-backed genesis anchor;
      renders the cockpit_view with the gates ladder)
→ INDEPENDENTLY re-derive each on-disk artifact file's sha256 and compare to the file's own
     embedded content_hash AND the envelope's recorded artifact_hashes
→ render one operator cockpit view (human text + --json); write nothing
```

Command:

```bash
dema mission cockpit <run-id> [--dema-home <path>] [--json]
```

Reads ONLY the four files the emit writer produced under the `<run_id>` directory
(`emission.json` + `receipt.json` + `world_state_delta_preview.json` + `dema_report.json`).
No directory crawl, no source-file read, no write, no mutation.

## Proof Contract (Proven)

- Emit → cockpit end-to-end renders a `cockpit_view` with a **non-empty gates ladder**;
  `status: verified_preview_cockpit` on an untampered run.
- `<run-id>` is strict-validated against `^[0-9a-f]{16}$` **before any fs op** — `..`,
  `../x`, non-hex, wrong-length ids are all refused with `invalid_run_id` and no path is
  built (`run_dir: null`); a missing argument is `missing_run_id`. Both map to non-zero exit.
- A missing `emission.json` → `emission_envelope_not_found`; invalid JSON →
  `emission_envelope_not_valid_json`; an envelope with no nested emission →
  `emission_envelope_missing_nested_emission`.
- A **tampered artifact FILE** (bytes changed) is refused with `artifact_hash_mismatch:<name>`
  by the independent re-derivation — **even though the copy embedded in `emission.json` (which
  the kernel checks) is untouched, so `out.cockpit.ok` is still true**. The independent file
  re-check is what catches the on-disk tamper.
- A **missing artifact file** → `missing_artifact_file:<name>`.
- A **tampered `emission.json`** (nested emission mutated) is refused by the kernel anchor
  (`content_hash_mismatch`).
- The cockpit **writes ZERO files**: the run dir file set is byte-identical before and after
  the read (three artifacts + `emission.json`), and nothing new appears under the mission root.
- `boundary` all-false, `committed_live: false`, `mint_allowed: false`, `authority_delta: 0`;
  the world-state delta summary shows `applied: false`.
- Real-binary tests: `--json` renders a cockpit view and exits 0 on a valid run (disk unchanged);
  exits non-zero on a missing run-id argument and on a path-traversal run-id.

## Not Proven

- No live model, network, daemon, mint, federation, or live URP is invoked.
- Reading and rendering the emitted artifacts is NOT executing a mission and applies no
  world-state: the delta is declared (`applied: false`), not applied.
- A rendered view means the on-disk artifacts are content-addressed and internally consistent
  and the upstream anchor verifies — NOT that the mission ran or its claims are true.
- The adapter adds no new intelligence and re-implements no kernel logic; it composes the
  shipped cockpit kernel over one file loaded from disk.

## Smoke

```bash
node --test tests/node0-mission-pilot-cockpit-cli-adapter.test.js
node scripts/review/node0-mission-pilot-cockpit-cli-adapter-check.mjs --json
npm run check
```

`npm run check` runs `node0-mission-pilot-cockpit-cli-adapter-check.mjs` and keeps
`NODE0_MISSION_PILOT_COCKPIT_CLI_ADAPTER_1A` at `MEASURED_REPO`.
