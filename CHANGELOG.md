# Changelog

All dates UTC. Entries are split into two sections so a reader can
tell at a glance which versions exist as immutable git tags and
which are logical groupings of work that landed without their own
tag:

- **Tagged releases** — versions that exist as git tags
  (`git tag --list`) and, when published, as GitHub releases.
- **Logical milestones (untagged)** — version-numbered groupings
  of work that landed in the git log without their own tag.
  Maintained for reviewer clarity; promote to "Tagged releases"
  when/if a tag is minted.

The current **pending tag** is `v0.3.1`, awaiting PR #16
(interactive approval gate) merge to `main`. Tagging is an L5
act per the A4.5 autonomy envelope and requires explicit
in-the-moment GO from the operator at merge time.

---

## Tagged releases

### 0.3.0 — 2026-05-06 (tag `v0.3.0`)

- Active Command Kernel — `dema` (no args) becomes the entry point.
  Composes operator profile + node stage + gateway state + receipt
  count into a banner with one suggested next safe task.
- Adds `packages/core/src/banner.js` and the bare `runActiveKernel`
  in `apps/cli/src/index.js`.
- `dema chat` opens an interactive shell over the same dispatch
  surface (no separate command set).
- Adds `packages/tasks/src/downloads-audit-preview.js` — first
  registered task: read-only `~/Downloads` audit, writes one local
  receipt with payload digest, mutates nothing.
- Adds `packages/verifier/src/sat-placeholder.js` — honest SAT
  placeholder. Emits `PARTIAL_PLACEHOLDER` for well-shaped receipts
  and `REJECT` for receipts that try to over-claim. Real SAT-5
  verifier sibling lands in v0.3.2 / upstream `bizra-data-lake`.

### 0.2.7 — 2026-05-06 (tag `v0.2.7`, docs)

- PAT-builder / SAT-validator doctrine v0.1
  ([`docs/02-architecture/pat-builder-sat-validator.md`](docs/02-architecture/pat-builder-sat-validator.md)).
  Codifies the internal separation of authority within one node:
  PAT/Dema builds and proposes; SAT validates and certifies; the
  operator only sees Dema; **even the operator cannot bypass SAT**
  (anti-pattern 6: sovereign-bypass).
- Names the SAT-5 Rust roster gap (DECLARED here, PLANNED upstream).

### 0.2.0 — 2026-05-05 (tag `v0.2.0-alpha`)

- Imports R1 doctrine + engineering discipline + CI matrix.
- Adds `docs/ENGINEERING_DISCIPLINE.md` — five rules (small edits,
  explicit assumptions, no invented commands, testable success,
  stop at ambiguity) and the halt-gate matrix that overrides
  auto-mode.
- CI workflow `.github/workflows/check.yml` — Node 20.x + 22.x
  matrix, `fail-fast: false`, `npm test` + `npm run check`.
- Scopes `npm test` to `tests/*.test.js`; gitignores `.artifacts/`.

---

## Logical milestones (untagged)

### 0.3.1 — 2026-05-06 (pending tag — awaiting PR #16 merge)

- Interactive approval gate per the A4.5 autonomy envelope (B1.2 design).
  Implements the L0–L5 matrix: L0/L1/L2 auto-approve; L3 prompts
  `Approve <action>? [y/N]:` (case-insensitive `y`/`yes`/`proceed`,
  silence/EOF/ambiguous = deny); L4 routes through FATE
  `evaluateConsent` for byte-for-byte phrase match; L5 unconditionally
  refuses from the interactive shell.
- Adds `packages/core/src/approval-gate.js` (~120 LOC) and
  `tests/approval-gate.test.js` (16 tests covering every level path).
- `task` subcommand consults the gate when a registered task's
  `autonomy_level` is `>= L3` before dispatch.
- Shell hardening: dual-Ctrl+C exit (first warns; second within 2s
  exits clean), `tokenize` error handling, graceful `rl.close`.

### 0.2.6 — 2026-05-06 (untagged, docs)

- ABSORPTION_NOTES_v2 — pi-verifier-agent V1–V6 patterns mapped onto
  the PAT/SAT axes; clarifies what lives on the builder side vs the
  validator side.

### 0.2.5 — 2026-05-06 (untagged, docs)

- Dema Autonomy Envelope v0.1 (A4.5 — pre-A5 doctrine,
  [`docs/02-architecture/dema-autonomy-envelope.md`](docs/02-architecture/dema-autonomy-envelope.md)).
  Defines the L0–L5 levels, gating, reversibility, receipt
  requirements, and five named anti-patterns including
  cloud-side-authorization-laundering and shadow-consent-surfaces.
- Ships *before* A5 (the first ARTIFACT-011) so that the first
  receipt is born inside a declared autonomy constitution rather
  than implied by precedent.
- Also pins SPROUT state ([`SPROUT_PIN.md`](SPROUT_PIN.md)) capturing
  the gateway-issued ARTIFACT-011 mirror (chain length 8, head
  `9391e6fe…`, admissibility verdict PERMIT). Dema's role is read /
  list — issuance occurred upstream via gateway POST `/missions`.

### 0.2.4 — 2026-05-05 → 2026-05-06 (untagged)

- Gateway HTTP adapter — Dema reads live Node0 state from
  `bizra-cognition-gateway` per ADR-003.
- Adds `packages/node-adapter/src/gateway-http-adapter.js` —
  GET-only, four endpoints in parallel (`/health`, `/chain`,
  `/poi/summary`, `/resources/list`); composes
  `bizra.dema.node0_status.v0.2`. Fields the gateway does not expose
  surface as `unknown[]` with a `_truth: "NOT_EXPOSED_BY_GATEWAY"`
  marker — never fabricated.
- `createNode0Adapter()` dispatches on `DEMA_NODE0_ADAPTER` env
  (or the `adapterMode` option). Default falls through to the
  legacy shellout / `defaultStatus()` path.

### 0.2.3 — 2026-05-05 (untagged)

- Persistent memory awareness — Dema knows the operator.
- Adds `packages/memory/src/memory-store.js` — read-only viewer
  over `~/.dema/profile.json` and `~/.dema/memory/*.json`. Excludes
  `today.json` (operational, not memory).
- New `dema memory` and `dema memory show <name>` subcommands.
- `dema today` now embeds a memory summary alongside the tick.
- Adds Node0 activation roadmap ([`docs/NODE0_ACTIVATION_ROADMAP.md`](docs/NODE0_ACTIVATION_ROADMAP.md))
  — SEED → SPROUT → … → FOREST stages.

### 0.2.2 — 2026-05-05 (untagged)

- Proof-of-priority — `bizra.priority-anchor.v1` algorithm and a
  reproducible SHA-256 Merkle root over the three founding PDFs
  (`themassage.pdf`, `bizra.pdf`, `BIZRA_Third_Fact_v0_1_FINAL.pdf`).
- Algorithm spec ([`docs/PRIORITY_ANCHOR.md`](docs/PRIORITY_ANCHOR.md))
  + script ([`scripts/priority-anchor.mjs`](scripts/priority-anchor.mjs))
  + canonical pin ([`proof-of-priority/PIN.md`](proof-of-priority/PIN.md))
  + per-file `.ots` insurance receipts.
- Stamp lifecycle: `PENDING` → **`STAMPED`** (OpenTimestamps
  submission accepted) → **`UPGRADED`** (Bitcoin block-header
  attestations embedded across blocks 948027 + 948028 + 948029,
  same-day batching). Independent verification needs no BIZRA
  infrastructure: `npm run priority-anchor:verify` reproduces root
  `45aa2789…` from this repo alone.

### 0.2.1 — 2026-05-05 (untagged, docs)

- Mission-centric product thesis ([`docs/00-product-thesis/mission-centric-thesis.md`](docs/00-product-thesis/mission-centric-thesis.md))
  and Hermes / OpenClaw absorption notes (v1).

### 0.1.0-alpha.0 — 2026-04 (untagged, initial bootstrap)

- Initial Dema product repo bootstrap.
- README rewritten as a product landing page for the first 60 seconds.
- Added first-run wizard and receipts documentation.
- Added `dema welcome` first-run orientation.
- Hardened setup output with created/existing paths and untouched
  runtime boundaries.
- CLI setup/status/today/doctor/mission/receipts/monetize alpha shell.
- Node0 adapter contract with measured onboarding status normalization.
- Receipt list/read viewer.
- Mission/FATE boundary with exact ARTIFACT-011 consent preview and
  no runtime execution.
- Installer architecture docs.
- Local setup writes profile/config folders without starting a daemon.
