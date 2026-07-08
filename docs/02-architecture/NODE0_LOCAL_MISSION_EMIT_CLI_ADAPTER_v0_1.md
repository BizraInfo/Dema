# NODE0 Local Mission Emit — CLI Adapter v0.1

Truth label: `NODE0_LOCAL_MISSION_ARTIFACT_EMISSION_PREVIEW_MEASURED_REPO`

## Purpose

This slice wires the **already-measured** local-mission preview kernels
(NODE0-LOCAL-MISSION-HARNESS-PREVIEW-1A → NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW-1A)
into one operator command that produces a **written** proof bundle for one explicit
local file:

```bash
dema mission emit <abs-file> --consent "GO: node0 local mission emit" \
  [--claim "…" --task "…" --boundary "…"] \
  [--excerpt-consent "GO: include local excerpt in mission packet"] [--json]
```

It is the read-only-input / consent-gated-output adapter for the emission kernel — the
kernel writes nothing; this adapter performs the atomic filesystem write. It is **not**
BIZRA-DATA-LAKE Node0 activation.

## Flow

```text
argv[2] file (must be absolute)
→ stat + realpath (reject relative / missing / directory)
→ read bytes read-only → file_ref { path, size_bytes, mtime_iso, content_hash, content_read_performed:false, raw_content_leaves_node0:false }
→ candidate_extraction (operator --claim/--task/--boundary or a clearly-labeled preview default)
→ buildEphemeralCompositionRef() (fresh signed genesis anchor; ephemeral keys, no live identity)
→ buildNode0LocalMissionHarnessPreviewPayload(...)
→ runNode0LocalMissionArtifactEmissionPreview(...)  (re-verifies harness → pulse → composition → genesis signature)
→ buildEmissionEnvelope(...)  (wraps the content-addressed emission payload + convenience fields)
→ IF consent === "GO: node0 local mission emit" AND emission.ok:
     atomic write of THREE preview artifacts —
       receipt.json + world_state_delta_preview.json + dema_report.json —
     PLUS one verification envelope — emission.json —
     under $DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/ (tmp + rename, mode 0600)
```

## Verification envelope (`emission.json`)

`emission.json` is a **verification envelope**, not a fourth artifact. It wraps the
untouched, content-addressed emission payload (with `harness_result` intact — the exact
object the mission-pilot cockpit kernel re-verifies as its `input.emission`) under an
`emission` key, and mirrors the run id, the source-file / emission / harness content
hashes, the per-artifact hashes, the artifact relative paths, the pulse ladder + reached
stations, and the consent status as convenience fields **outside** that content-addressed
body — so they never alter the emission's own content hash.

**Sufficiency (the whole point):** the future `dema mission cockpit <run-id>` reader loads
this one file, feeds its nested `emission` to `runNode0MissionPilotCockpitPreview`, and
gets `ok:true` with a rendered cockpit view including the gates panel — i.e. it re-verifies
the full chain (emission → harness → pulse → composition → signature-backed genesis anchor)
and renders the gates from disk alone. A round-trip test in
`tests/node0-local-mission-emit-cli-adapter.test.js` proves this against the on-disk file.

The emission kernel's own build phrase gates only the **in-memory** preview build (a pure
step with no side effect). The operator's `GO: node0 local mission emit` phrase is the sole
gate on the **disk write**. Missing or wrong consent fails closed before any write — the
artifacts directory is not created.

## Boundary

The `--json` output surfaces `boundary` (all-false), `mint_allowed: false`,
`authority_delta: 0`, `run_id`, `content_hash`, `wrote`, `write_refused_reason`, the
absolute `artifact_paths_written` (the three artifacts), `envelope_path_written`
(`emission.json`), and the `emission_content_hash` / `source_file_content_hash`. Every
written artifact — and the envelope — carries `committed_live: false`, an all-false
boundary, and (for the artifacts) a content hash equal to the kernel's.

Write scope is strictly `$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/`
(`DEMA_HOME` or `~/.dema`). Nothing is written outside that run-id directory, and the
source file is byte-identical after the run.

## What this proves

- Operators can run the full measured harness → emission path over one real local file with
  exact-string consent, and get exactly three atomically-written, content-addressed preview
  artifacts **plus one verification envelope** under `DEMA_HOME`.
- The on-disk `emission.json` is sufficient for the mission-pilot cockpit kernel to
  re-verify the full chain and render the gates panel from disk alone.
- Fail-closed write discipline, atomic tmp+rename, mode 0600, and read-only source hold.

## What this does not prove

- No live model, network, daemon, mint, federation, or live URP is invoked.
- Writing three preview artifacts plus a verification envelope is not executing a mission:
  the world-state delta is declared (`applied: false`), not applied; the signature is an
  ephemeral in-memory preview (no persisted key, no DID, no live Node0 identity).
- The envelope adds no new intelligence — its convenience fields are a read-only projection
  of the nested content-addressed emission — and it carries no private key, DID secret,
  wallet, or raw source content.
- The adapter re-implements no kernel logic.

Receipt: [`docs/receipts/NODE0_LOCAL_MISSION_EMIT_CLI_ADAPTER_1A.md`](../receipts/NODE0_LOCAL_MISSION_EMIT_CLI_ADAPTER_1A.md).
