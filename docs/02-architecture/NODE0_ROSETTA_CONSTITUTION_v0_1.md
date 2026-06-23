# Node0 Rosetta Constitution v0.1

- **Truth label:** `NODE0_ROSETTA_CONSTITUTION_PREVIEW_ONLY` — preview-only, read-only doctrine.
- **Live source of truth:** `dema node0 map [--json]` → `packages/core/src/node0-rosetta-constitution-preview.js`. This document is a *pointer + semantics*, not a snapshot to keep refreshing.

## What it is

One frozen, anchor-bound map that becomes the honest northstar future BIZRA nodes inherit. It cross-walks three vocabularies — the Telescript mobile-agent model, Dema's own primitives, and the SYNAPSE-CORE operating doctrine — and labels **every** capability with its real status, bound to a file on disk:

- `IMPLEMENTED` — working code, unit-tested, actually runs the capability.
- `DECLARED` — a schema/shape/placeholder/preview exists; the live runtime is **not** wired.
- `DESIGNED_NOT_LIVE` — design/doc/spec only; no working artifact.
- `UNKNOWN` — could not be located.

Run `dema node0 map` for the current table; `dema node0 map --json` for the full frozen envelope (`bizra.dema.node0_rosetta_constitution_preview.v0.1`).

## Why it exists (anti-drift)

The labels are *derived from evidence*, never asserted — they come from the adversarially-verified audit [`docs/audits/NODE0_DEMA_NORTHSTAR_AUDIT_1A.md`](../audits/NODE0_DEMA_NORTHSTAR_AUDIT_1A.md) (41-agent, refute-by-default). The map's own verifier, `verifyNode0RosettaConstitution`, **fails closed** if any `IMPLEMENTED`/`DECLARED` row's anchor does not exist on disk, if the `anchorExists` predicate is omitted, if the boundary is not all-false, if the autonomy math doesn't reconcile, or if the status summary is tampered. The test backs the anchor check with the real filesystem, so CI cannot let a **phantom anchor** (a label pointing at a non-existent file) through.

**Scope of the guard, stated honestly:** it enforces *existence + internal consistency*, not *semantic fit*. It proves the cited files exist and the math/summary/boundary are untampered; it does **not** prove that an anchor file actually implements the capability its label claims, and a status *downgrade* (marking a live thing `DESIGNED_NOT_LIVE`) skips the anchor check by design. Semantic fit — does `IMPLEMENTED` truly mean working-and-tested — is **review-enforced** (the labels here survived an adversarial critic pass that re-anchored one mislabeled row). The combination — evidence-derived labels, an existence/tamper gate, and adversarial review — is what keeps Node0 from quietly promoting MCP / A2A / federation / PoI / token / an autopoietic runtime to "live."

## The translation (Telescript ↔ Dema ↔ SYNAPSE-CORE)

The Telescript primitives map onto Dema as: **Agent** → agent profile, **Place** → Node0/DEMA_HOME, **go** → bounded-task/mission lifecycle, **Ticket** → consent proof / typed GO, **Permit** → boundary block / autonomy gate, **Stub** → SAT verdict envelope, **Telesphere** → URP shared world / federation, and the Telescript principle *"state carries its proof, not arbitrary code"* → the proof-passport + receipt spine. See `dema node0 map` for each row's anchor and live status.

## The components ("shoulders of giants")

Most of what a flagship node would "integrate" already exists in-tree as **preview kernels** (`DECLARED`), not live runtimes: MCP capability descriptor, A2A envelope, Amana smart-contract registry, SNR scoring engine, RSI metric, the shoulder-of-giants protocol mapping, and the dual-token ledger. The autopoietic / autonomous self-modification loop is `DESIGNED_NOT_LIVE` by design (`not_autonomous_runtime: true`). The Constitution binds them all into one place so the gap between *preview* and *live* is always visible. The existing external-pattern registry (`packages/core/src/external-pattern-registry-preview.js`, the giants→primitives axis) is cross-linked, unchanged.

## Rest-protection metric — Autonomy Coverage Ratio

`autonomy_coverage = autonomous_action_classes / total_action_classes` over the SYNAPSE-CORE §1 FATE action-class table (the math is shown — numerator and denominator are in the envelope, no decimal without its basis). It measures how much Dema can do **without waking Mumu** (reversible classes) versus what requires a typed GO. The *definition* is `IMPLEMENTED` and unit-tested; any *live, fleet-wide measurement* is `DESIGNED_NOT_LIVE`. Ties to SYNAPSE-CORE §8/§12: the system protects rest by shedding reversible load autonomously while gating the irreversible.

## Boundary — what this is not

No runtime, no daemon, no network, no file write, no signing, no key generation, no mint, no MCP/A2A invocation, no federation, no live autopoietic loop, no PoI, no ZK. The envelope's `boundary` block is entirely `false` and verified so. The Constitution is a mirror of what exists, not a runtime that does anything.
