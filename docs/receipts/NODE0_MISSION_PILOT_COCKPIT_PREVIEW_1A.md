# Receipt: NODE0-MISSION-PILOT-COCKPIT-PREVIEW-1A

Truth label: `NODE0_MISSION_PILOT_COCKPIT_PREVIEW_MEASURED_REPO`

## Slice

Read-only truth cockpit: verifies the three emitted mission artifacts (receipt, world-state delta, DEMA report) by content hash and renders one operator view — mission status, accepted/rejected gates, delta preview, DEMA report, and next safe action; refuses tampered artifacts.

```text
plan → build → verify → tamper-reject
```

## Proof Contract

The kernel takes ONE injected emission result (the three content-addressed mission
artifacts from `NODE0-LOCAL-MISSION-ARTIFACT-EMISSION-PREVIEW-1A`) and renders a
read-only cockpit view. The default gate passes only while:

- the exact GO phrase matches byte-for-byte,
- the emission re-verifies (transitively harness -> pulse -> composition -> signature-backed genesis anchor),
- EACH artifact's `content_hash` is independently re-derived and matches (tampered artifacts refused, per-artifact),
- the rendered `cockpit_view` is content-addressed and re-derives from the source emission,
- the cockpit payload is content-addressed and verify rejects any field tamper (recomputed-hash forgery included, via the emission anchor),
- the boundary stays all-false, `authority_delta` 0, `mint_allowed` false, `committed_live` false.

`npm run check` runs `node0-mission-pilot-cockpit-preview-check.mjs` and keeps
`NODE0_MISSION_PILOT_COCKPIT_PREVIEW_1A` at `MEASURED_REPO`.

## What this PROVES

- A pure viewer can turn three already-verified emission artifacts into one operator
  cockpit view — `mission_status`, `run_id`, `receipt_hash`, accepted/rejected pulse
  `gates` (+ furthest `reached_station`), the `applied:false` world-state delta summary,
  the DEMA report (`status` + `next_safe_action`), and the three operator lines
  (`what_happened`, `what_did_not_happen`, `next_safe_action`).
- The view is content-addressed and deterministic: the same emission renders the same
  view hash and the same cockpit `content_hash`.
- Tampering ANY artifact body (receipt, world-state delta, or DEMA report) is refused
  by independent per-artifact hash re-derivation; a broken upstream emission/harness/
  genesis anchor is refused via the re-run emission verify.

## What this does NOT prove

- No new intelligence: the cockpit re-derives no artifact from the harness and asserts
  nothing the verified artifacts do not already state — it is display, not judgment.
- A rendered view means the artifacts are content-addressed and internally consistent
  and the upstream anchor verifies — NOT that the mission ran or its claims are true.
- No execution, no world-state applied, nothing recorded live; no model, network,
  daemon, wallet, mint, or federation. The three JSON artifacts are loaded by the CLI/
  adapter, never by this kernel.

## Smoke

```bash
node --test tests/node0-mission-pilot-cockpit-preview.test.js   # 54 tests green
node scripts/review/node0-mission-pilot-cockpit-preview-check.mjs        # PASS, boundary_all_false: true
node scripts/review/node0-mission-pilot-cockpit-preview-check.mjs --json # full cockpit_view
node scripts/review/kernel-purity-check.mjs                     # 0 violations
node scripts/review/no-overclaim.mjs                            # ok: true
npm run check
```
