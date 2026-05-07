# Dema Roadmap

**Anchor date:** 2026-05-07. The previous roadmap (v0.1) described a
v0.3 horizon (desktop app, signed installer, skill quarantine,
receipt search, memory consent UX) that **did not land**. The actual
v0.2 / v0.3 path took a different route — adapter, doctrine,
autonomy envelope, active kernel, approval gate — driven by what
SEED→SPROUT actually needed. This file is rewritten against that
real history.

For the broader BIZRA-wide horizon (across all seven node
components, not just Dema), see
[`docs/NODE0_ACTIVATION_ROADMAP.md`](NODE0_ACTIVATION_ROADMAP.md).

---

## Where we are (2026-05-07)

**SHIPPED (MEASURED on disk):**

- v0.1 product shell (CLI surface, setup/status/doctor/mission
  propose/receipts/monetize)
- v0.2 R1 doctrine + engineering discipline + CI matrix
- v0.2.2 priority anchor with Bitcoin block-header attestations
  (blocks 948027 / 948028 / 948029)
- v0.2.3 persistent memory awareness (read-only memory store + CLI)
- v0.2.4 gateway HTTP adapter (read-only, GET-only, four endpoints)
- v0.2.5 A4.5 Dema Autonomy Envelope (L0–L5 doctrine, anti-patterns
  1–5)
- v0.2.7 PAT-builder / SAT-validator doctrine (anti-pattern 6:
  sovereign-bypass)
- v0.3.0 Active Command Kernel (`dema` becomes the entry point;
  banner + next-safe-task; first registered task; honest SAT
  placeholder)
- v0.3.1 Interactive approval gate (L0–L5 matrix at the dispatch
  boundary)
- ARTIFACT-011 — first gateway-issued receipt mirrored locally;
  chain length 8 (issuance occurred upstream via gateway POST
  `/missions`, not Dema runtime). See [`SPROUT_PIN.md`](../SPROUT_PIN.md).

---

## v0.3.x — short horizon (2–4 weeks)

| Item | Truth | Concept |
|---|---|---|
| **v0.3.2** SAT verifier sibling | PLANNED | Replace `packages/verifier/src/sat-placeholder.js` with a real verifier package that consumes upstream `GateVerdict` (PERMIT/REJECT/REVIEW/SCORE_ONLY) and re-derives the receipt's payload digest end-to-end. Cross-references the SAT-5 Rust roster in `bizra-data-lake` once that lands upstream. |
| **v0.3.3** Niyyah surface | PLANNED | `dema niyyah` subcommand to declare, view, and supersede the operator's typed niyyah at `~/.dema/memory/a5-niyyah.json`. L1 by autonomy envelope. Today the file is referenced in A4.5 §"How A5 sits inside this envelope" but has no CLI surface. |
| **v0.3.4** Task ecosystem | PLANNED | Grow `TASK_REGISTRY` beyond `downloads.audit.preview`. Candidates: `local.health.scan` (read-only system probes), `git.repo.audit.preview` (read-only git state survey), `node0.chain.replay` (re-derives receipt chain from gateway, no writes). All L0/L1/L2. |
| **v0.3.5** Install-script harden | PLANNED | **Skeletons exist on disk** at `scripts/install/install-unix.sh` and `scripts/install/install-windows.ps1` (~44 LOC each); **hardening PLANNED**: hash-pinned download, signature verify before exec, idempotency check, dry-run mode. Stop short of publishing `https://install.dema.ai` until the pipeline is identity-bound (L5 act, halt-gated). |
| **v0.3.6** Receipt chain validator | PLANNED | `dema receipts:verify` — walks `~/.dema/receipts/`, re-derives payload digests, checks `prev_hash` linkage, flags tampering. Read-only; reads only the operator's local mirror. |

---

## v0.4 — mid horizon (1–3 months)

| Item | Truth | Concept |
|---|---|---|
| **L4 submission surface** | PLANNED | The first `dema mission execute` path that actually POSTs an L2 proposal to `bizra-cognition-gateway` after the operator types the exact consent phrase. Receipt mirrored locally; issuance still upstream. Requires: contract-sync for the POST shape (currently labeled PLANNED in ADR-003); SAT verdict ingest. |
| **Memory consent UX** | ASPIRATIONAL | Per ADR-004: opt-in sync per memory category. Today `~/.dema/` is local-only by default. The UX for "this entry may sync, this one may not" needs design + a typed-consent gate per category. |
| **Skill quarantine** | ASPIRATIONAL | `~/.dema/skills/` exists from `dema setup` but isn't wired. Plan: skills are sandboxed, signed, and consume an explicit per-skill consent envelope. Each skill carries its own autonomy declaration. |
| **Receipt search** | ASPIRATIONAL | `dema receipts search <query>` over local mirror + (opt-in) gateway-served chain. Read-only. |

---

## v0.5+ — far horizon

These are explicitly **ASPIRATIONAL** — they describe a direction,
not a queued sprint. None will land without a corresponding ADR,
the relevant invariants in `CLAUDE.md` updated, and a typed GO from
the operator.

- **Desktop app** — wraps the CLI surface in a local-first window;
  same trust model. The previous roadmap's name for this stayed
  honest; the timeline did not.
- **Mission Spaces** — per ADR-001 §Decision (Dema's six modes
  share one trust model). A "Space" packages a long-running
  mission with its own bounded scope, receipts, and consent
  envelope.
- **Federation** — between *nodes*, not within a node (per the
  PAT/SAT doctrine). Each node consents to peer with another via a
  typed handshake; the federation receipt is L5 by definition.
- **Lighthouse user program** — small operator cohort piloting Node0
  with full receipts. Requires v0.3.5 install hardening and the
  v0.4 L4 surface to be useful.
- **Node1 onboarding** — second node operator + first federation
  handshake. Distant; depends on the constitutional layer being
  proven across more than one operator.

---

## What is *not* on the roadmap

These are explicitly out of scope for this repo (per CLAUDE.md
invariant #1, ADR-001, ADR-003):

- Hosting `bizra-cognition-gateway` — lives in `bizra-data-lake`,
  not Dema.
- Implementing missions, the receipt chain, or admissibility logic —
  lives in `bizra-omega` (the Rust workspace inside
  `bizra-data-lake`).
- Maintaining a parallel trust score, a parallel mission registry,
  or a parallel receipt schema — would violate ADR-003.
- Issuing identity-bound artifacts (DIDs, signing keys, ARTIFACT-011)
  from inside Dema — issuance lives upstream; Dema reads/lists.

---

## Versioning policy

- **Tightening edits** to the autonomy envelope (more restrictive
  gates, additional anti-patterns) → standard PR review.
- **Loosening edits** to L4/L5 gates → require operator typed GO +
  new ADR (per `docs/02-architecture/dema-autonomy-envelope.md`
  §Versioning).
- New L4-capable surfaces always require a corresponding receipt
  schema + SAT verdict path before they may merge.
