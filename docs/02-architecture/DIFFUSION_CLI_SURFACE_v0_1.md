# Diffusion CLI Surface v0.1

- **Command:** `dema diffusion`
- **Kernel:** `packages/core/src/diffusion-reasoner.js`
- **Command module:** `apps/cli/src/commands/diffusion.js`
- **Status:** bounded CLI surface over `DIFFUSION-REASONER-KERNEL-1A`.

## What this adds

`dema diffusion` exposes the live diffusion reasoner kernel as a replayable local command:

```bash
dema diffusion refine --drafts "Maybe this is the ultimate claim\nThis claim is supported by evidence" --evidence docs/02-architecture/DIFFUSION_REASONER_v0_1.md
```

JSON mode:

```bash
dema diffusion refine --json --drafts "Maybe...\nEvidence-bound final claim" --evidence evidence-a,evidence-b
```

Verification mode:

```bash
dema diffusion verify /absolute/path/to/report.json --json
```

## Honest boundary

This CLI does **not** make diffusion neural, generative, stochastic, autonomous, or model-backed. It does not call a model, network, filesystem writer, signer, mint, PoI engine, MCP runtime, A2A runtime, or federation. It only wraps the deterministic kernel and prints either a human report or the underlying JSON envelope.

## Input contract

`refine` accepts either:

- `--drafts "<draft1>\n<draft2>\n..."`
- `--drafts-file /absolute/path/to/drafts.json`

`drafts.json` may be either a JSON array or `{ "drafts": [...] }`.

Evidence anchors are supplied with:

```bash
--evidence anchor-a,anchor-b
```

The CLI never verifies that the evidence anchors are true. The kernel binds the report to caller-supplied anchors and re-derives every load-bearing field during verification.

## How it is wired (ADR-012 space-subcommand, single binary)

`dema diffusion refine|verify` is wired into the **single** `dema` dispatcher (`apps/cli/src/index.js`) as a space-subcommand — `cmd_diffusion` is imported, registered in `COMMAND_TABLE` and the dispatch map, and documented in `docs/ARCHITECTURE.md`. There is **no** second binary: the draft's initial `bin/dema-diffusion` + `package.json` bin entry were dropped in favour of the conventional `dema <token>` surface, validated by the full local gate (`npm test` + `npm run check`).
