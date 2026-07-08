# NODE0 Mission-Pilot Cockpit — CLI Adapter v0.1

Truth label: `NODE0_MISSION_PILOT_COCKPIT_CLI_ADAPTER_MEASURED_REPO`

## Purpose

This slice wires the **already-measured** read-only cockpit kernel
(NODE0-MISSION-PILOT-COCKPIT-PREVIEW-1A) into one operator command that renders a truth view
of a run **from disk** — the read companion to `dema mission emit <file>`:

```bash
dema mission cockpit <run-id> [--dema-home <path>] [--json]
```

The emit writer produces a `<run_id>` directory; this reader loads it back and shows the
operator exactly what happened, what did **not** happen, and the one next safe action. It is
the read-only-input / no-output adapter for the cockpit kernel — the kernel takes an injected
emission and renders; this adapter loads the on-disk envelope, feeds it in, and independently
re-checks the artifact files. It is **not** BIZRA-DATA-LAKE Node0 activation.

## Flow

```text
argv[2] run-id
→ strict-validate against ^[0-9a-f]{16}$  (BEFORE building any path — rejects .., ../x, non-hex)
→ home = --dema-home | $DEMA_HOME | ~/.dema
→ dir = home/artifacts/proofs/node0-local-mission/<run_id>/
→ read dir/emission.json (read-only) → parsed.emission (nested content-addressed emission)
→ runNode0MissionPilotCockpitPreview({ consent: <GO phrase>, input: { emission } })
     (re-verifies emission → harness → pulse → composition → signature-backed genesis anchor;
      renders cockpit_view with the gates ladder)
→ for each of receipt / world_state_delta_preview / dema_report:
     read dir/<name>.json → strip content_hash → re-derive sha256 over the canonical body
     → compare to the file's embedded content_hash AND envelope.artifact_hashes[name]
     → refuse on mismatch (artifact_hash_mismatch:<name>) or missing file
→ ok = kernel-anchor ok AND every artifact-file re-check ok
→ render one operator cockpit view (human text + --json)   ·   WRITE NOTHING
```

## Why an independent artifact-file re-check?

The cockpit **kernel** re-derives the artifact hashes of the copies **embedded inside**
`emission.json`. That catches a tampered envelope. It does **not** catch a tamper of the
separate on-disk `receipt.json` / `world_state_delta_preview.json` / `dema_report.json` files,
because the kernel never reads them. The adapter therefore re-derives each on-disk artifact
file's `sha256` itself (a byte-for-byte copy of the kernel's canonical `stableStringify` +
`sha256`, kept local as an independent second witness) and refuses any mismatch. A test proves
that a tampered `receipt.json` file yields `artifact_hash_mismatch:receipt` while
`out.cockpit.ok` is still `true` — the file re-check is the thing that catches it.

## Boundary

Read-only. Writes nothing, mutates nothing. Reads ONLY the four files in the `<run_id>` dir —
no directory crawl beyond it, no source-file read. No model, network, daemon, mint, wallet,
federation, or live URP. `committed_live: false`, `authority_delta: 0`, `mint_allowed: false`,
boundary all-false — surfaced from the verified emission, not asserted by the reader. A
rendered view means the on-disk artifacts are content-addressed and internally consistent and
the upstream anchor verifies — NOT that the mission ran or that its claims are true.

## Evidence

- Source: `apps/cli/src/commands/mission.js` (`cockpit` subcommand + `runMissionCockpit`),
  `packages/core/src/node0-mission-pilot-cockpit-preview.js`
- Test: `tests/node0-mission-pilot-cockpit-cli-adapter.test.js` (17 tests)
- Review gate: `scripts/review/node0-mission-pilot-cockpit-cli-adapter-check.mjs`
- Receipt: `docs/receipts/NODE0_MISSION_PILOT_COCKPIT_CLI_ADAPTER_1A.md`
- Honesty map row: `docs/CURRENT_LIMITS.md` (NODE0-MISSION-PILOT-COCKPIT-CLI-ADAPTER-1A)
