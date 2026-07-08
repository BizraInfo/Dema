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
→ IF consent === "GO: node0 local mission emit" AND emission.ok:
     atomic write of receipt.json + world_state_delta_preview.json + dema_report.json
     under $DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/ (tmp + rename, mode 0600)
```

The emission kernel's own build phrase gates only the **in-memory** preview build (a pure
step with no side effect). The operator's `GO: node0 local mission emit` phrase is the sole
gate on the **disk write**. Missing or wrong consent fails closed before any write — the
artifacts directory is not created.

## Boundary

The `--json` envelope surfaces `boundary` (all-false), `mint_allowed: false`,
`authority_delta: 0`, `run_id`, `content_hash`, `wrote`, `write_refused_reason`, and the
absolute `artifact_paths_written`. Every written artifact carries `committed_live: false`,
an all-false boundary, and a content hash equal to the kernel's.

Write scope is strictly `$DEMA_HOME/artifacts/proofs/node0-local-mission/<run_id>/`
(`DEMA_HOME` or `~/.dema`). Nothing is written outside that run-id directory, and the
source file is byte-identical after the run.

## What this proves

- Operators can run the full measured harness → emission path over one real local file with
  exact-string consent, and get exactly three atomically-written, content-addressed preview
  artifacts under `DEMA_HOME`.
- Fail-closed write discipline, atomic tmp+rename, mode 0600, and read-only source hold.

## What this does not prove

- No live model, network, daemon, mint, federation, or live URP is invoked.
- Writing three preview artifacts is not executing a mission: the world-state delta is
  declared (`applied: false`), not applied; the signature is an ephemeral in-memory preview
  (no persisted key, no DID, no live Node0 identity).
- The adapter re-implements no kernel logic.

Receipt: [`docs/receipts/NODE0_LOCAL_MISSION_EMIT_CLI_ADAPTER_1A.md`](../receipts/NODE0_LOCAL_MISSION_EMIT_CLI_ADAPTER_1A.md).
