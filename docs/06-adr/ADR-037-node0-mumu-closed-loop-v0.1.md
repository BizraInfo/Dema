# ADR-037 — Node0 Mumu Closed Loop v0.1 (Genesis Single-Node Active Network)

**Status:** [DECLARED] Proposed · spec-and-implementation · gate N0-MUMU-1 → N0-MUMU-ROOTED-1 (Root-Canon-aligned).
**Authored:** 2026-06-12 GST.
**Supersedes/relates:** [ADR-011 onboarding], B1A local asset awareness ([dema-local-asset-awareness-v0.1](../02-architecture/dema-local-asset-awareness-v0.1.md)), [BIZRA Root Canon](../root-canon/BIZRA_ROOT_CANON_v0_1.md).

## Layer 0 — Root Canon binding (N0-MUMU-ROOTED-1)

The loop loads the **IMMUTABLE** `docs/root-canon/root-canon.manifest.json` FIRST and re-derives the sha256 of all three source documents (The Message / The Seed / The Third Fact). If any source hash mismatches or the manifest is not `IMMUTABLE` with an all-`false` authority block, the loop **fails closed** (`root_canon_*`). On success it emits `canon/root-canon.v0.1.json`, `canon/root-source-receipt.v0.1.json` (the per-root sha256 binding), and `canon/root-canon-map.v0.1.md`, and `mumu-today.v0.1.md` carries a **Root Alignment** section (الرسالة mercy · البذرة service · Third Fact proof · prohibited claims · ihsan guardrail). Reading the canon source documents is project-integrity verification, distinct from the operator's metadata-only scanned root (`file_content_read` stays false). Golden invariant: _no Node0 component is valid unless it traces upward to architecture and downward to the three roots._

## Context

Node0/Dema has many proof organs but has not yet served its first operator end-to-end. This gate builds the first **local, private, offline** closed loop: Dema reads the operator's world (metadata only), surfaces strongest assets, picks one mission, assembles PAT/SAT, requires exact consent, writes a proof-backed action artifact, chains receipts, previews impact, reflects, and recommends the next step.

**Thesis:** if Node0 can empower one operator alone, BIZRA earns the right to scale. This gate does not attempt scale.

## Decision

Introduce **Genesis Single-Node Active Network mode** and a single command (`npm run node0`) that runs the loop over an operator-selected root.

### Network mode (`network-mode.v0.1.json`)

`GENESIS_SINGLE_NODE_ACTIVE_NETWORK`, `node_count: 1`, `external_federation_active: false`, `global_kernel_active_locally: true`, `local_urp_active: true`, `public_network_claim: false`, `token_minted: false`, `wallet_used: false`, `network_used: false`.

### Scope

- **In scope:** Mumu private production — local, offline, metadata-only, one operator.
- **Out of scope for this gate (DECLARED):** public living-proof demo; federation; multi-user; economic/token rails; Shariah/legal/security maturity claims.

### Roles

- **Dema:** the bridge/companion — composes the loop, reduces overwhelm, surfaces the humane next step.
- **PAT-7 (private, user-serving):** Cartographer, Strategist, Builder, Researcher, Auditor, Publisher, Companion. Each emits one short, actionable, quest-tied output. PAT serves the human privately and is never overridden by SAT.
- **SAT-5 (system-serving guardians):** Constitution, Security, Ihsan, PoI, URP. Registered as **passports** at `status: probation`, `authority_weight: 0`, `can_validate_local: true`, `can_validate_urp: false`, `can_read_private_file_content: false`, `can_override_user_private_pat: false`, `receipt_required: true`. **Born as guardians, not rulers** — shared-world authority is earned through proof, never granted by registration.

### Local URP membrane (default-deny)

Local resource classes (compute, storage, data, research, idea, code, time, review) and local shared-root patterns only. **No federation, no internet adapter.** URP is local soil; the membrane denies by default.

### Inventory (metadata-only, fail-closed)

Records relative path, basename, extension, size, mtime, class, depth. **Never reads file contents.** Skips dotfiles/dotfolders/symlinks and a denied-dir list (`.git`, `node_modules`, `.ssh`, `.gnupg`, `.aws`, `.config`, `.cache`, `target`, `dist`, `build`, `.next`, `.venv`, `venv`, `__pycache__`). **Skips and never records** secret-like names (`.env`, `id_rsa`, `id_ed25519`, `seed`, `seed-phrase`, `mnemonic`, `wallet`, `private_key`, `credential`, `secret`, `.pem`, `.key`, `.keystore`). `--max-files` (50000), `--max-depth` (8), `--metadata-only` required; truncation recorded safely.

### Consent gate

Canonical decision with `proposal_hash`, `decision_id`, and expected phrase `GO: START MUMU NODE0 QUEST <decision_id>`. Missing consent fails; bare `GO` fails; wrong `decision_id` fails. `--auto-consent-test` permitted **only** with `--test-mode`.

### Receipt chain (`receipt-chain.v0.1.jsonl`)

One receipt per transition (inventory, world_map, opportunity_register, quest, pat_panel, sat_review, covenant_decision, action_artifacts, poi_preview, reflection). Each binds `previous_receipt_hash`, `input_hash`, `output_hash`, `boundary_flags`, `receipt_hash` — hash-chained and replay-verifiable.

### PoI preview / dual-token preview

`simulation_only: true`; scores in [0,1]; **no real reward**. Dual-token preview carries `token_minted: false`, `wallet_used: false`, `network_used: false`, `note: "Simulation only. No token minted."`

### RSI

Levels **L0/L1 only** (observe + local reflection). No self-modification beyond local artifact emission.

## Prohibited claims

No public network claim · no token mint · no wallet · no network · no federation · no Shariah/legal/security maturity · no content-quality claim when content was not read (use "metadata suggests …") · no file-content read · no source-tree mutation · no upload · no push.

## Acceptance criteria

1. Full test-mode loop passes deterministically.
2. Normal mode without consent fails; bare `GO` fails; wrong `decision_id` fails; correct phrase passes.
3. Secret-like names skipped and **never recorded**; dotfiles skipped; denied dirs not descended; symlinks skipped.
4. No file content read; no output written inside the scanned root.
5. SAT blocks the loop if any boundary flag is unsafe (writes a blocked receipt).
6. Exactly 5 SAT passports; authority starts probation / weight 0; `token_minted` can never be true.
7. Replay passes on a clean chain and fails on any tampered artifact or receipt.
8. Node0 scripts import no network/shell modules (`http`, `https`, `net`, `dgram`, `child_process`, `worker_threads`, `cluster`).

## Implementation note (repo-convention corrections to the source spec)

- Package scripts: `node0` (loop) + `node0:replay` (replay) — no duplicate key; existing `test` left intact, focused run added as `node0:test`.
- Test files use `.test.js` (repo convention; included by the `tests/*.test.js` suite glob), not `.test.mjs`.
- Runtime artifacts live under `artifacts/node0/mumu/` and are not committed (runtime output, not source).
