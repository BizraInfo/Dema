# AGENTS.md

This file is the repo-local entry point for Codex-style agents.

## Canonical LLM flow

Read and follow [docs/LLM_SYSTEM_FLOW.md](docs/LLM_SYSTEM_FLOW.md) before making changes.

That file is the single source for:

- Dema's safe local lifecycle,
- BIZRA/Node0 boundaries,
- non-runtime invariants,
- proof-safe language,
- verification commands,
- historical/noise classification.

## Codex-specific note

User-scope `~/AGENTS.md` still applies. This repo file only adds Dema-specific routing.

If user-scope guidance and repo guidance overlap, use the repo-local rule for Dema behavior and the user-scope rule for execution discipline.

## Fast invariant compression

```text
Dema is the face, not the whole system.
No runtime execution in this repo.
No hidden daemon.
Exact-string consent only.
All local state stays under DEMA_HOME or ~/.dema.
Receipts are read/list here; governed runtime issues.
Node1/Node2 remain preview-only until proof gates pass.
```

## Required local checks

```bash
npm test
npm run check
npm run llm:guidance
git diff --check
```

## Learned User Preferences

- Require an explicit GO before bounded mission submit/replay, commits, pushes, or any public/economic/Node1 path.
- Prefer throwaway in-memory gateway state for bounded Node0 proofs; stop the gateway after verify and keep proof logs under `/data/bizra/logs/`.
- Do not claim a clean Dema working tree without measuring; treat large pre-existing dirty trees as unrelated until a GO introduces delta.
- Classify outcomes as SHIPPED / WIRED_PARTIAL / BLOCKED; keep `ready: false` honest when gateway-http reads chain without SPROUT closure.
- Use Dema `status:json` (colon subcommand), not `status --json`, for gateway-http Node0 status reads.
- Do not use Dema Node.js to POST `/mission` unless a documented adapter exists and the GO explicitly authorizes it.

## Learned Workspace Facts

- Dema repo: `/home/bizra-operating-system/Downloads/Dema` (HEAD `b8a94be`); Data Lake: `/data/bizra/repos/bizra-data-lake` (HEAD `271390c`, symlink from `~/BIZRA Node0/bizra-data-lake`).
- Dema is the face/proof cockpit; Data Lake is the Node0 runtime body (Python sovereign stack, Rust `bizra-omega`, cognition gateway).
- Node0 gateway read: `DEMA_NODE0_ADAPTER=gateway-http` and `DEMA_GATEWAY_URL=http://127.0.0.1:7421`; status schema `bizra.dema.node0_status.v0.2`.
- Mission submit goes through Data Lake `POST /mission` or Rust `dema activate --json` (`bizra-omega/bizra-cognition-gateway/src/bin/dema.rs`), not Dema Node.js POST.
- Rust CLI mission body uses `build_mission_request()` aligned to gateway `SubmitMissionRequest` (64-char hex `operatorSessionId`, state hashes, `evidenceHash`, `derivesFromCanonical`, `faceOnly`).
- Bounded local gateway on `127.0.0.1:7421` supports in-memory chain when `BIZRA_SOVEREIGN_STATE_PATH` is unset; one mission can grow chain length 0→8.
- Node0 minimum body loop is witnessed: intent → gateway admit (Permit) → chain update → Dema `status:json` reads head/length/`missionExecuted`.
- Public/economic/Node1/reward/token/marketplace/URP-public/Shariah-production scoring paths remain BLOCKED without separate explicit GO.
- Proof artifacts live under `/data/bizra/logs/` (e.g. `node0-mission-replay-*`, `rust-dema-cli-realign-*`, `node0-gateway-read-loop-*`).
