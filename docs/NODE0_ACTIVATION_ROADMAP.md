# Node0 Activation Roadmap

End-to-end path from current SEED-stage Dema to a fully activated Node0 capable of issuing real receipts, federating with peers, and propagating as a public network. Every step has explicit requirements, concrete actions, measurable KPIs, and a verifiable definition of done.

**Scope:** this roadmap is logical sequence, not schedule. Steps progress when their preconditions are met, never on a clock.

**Truth labels** (carried into KPIs):

- `MEASURED` — observed on disk / verified by command
- `DERIVED` — computed from MEASURED inputs
- `DECLARED` — stated by the operator
- `PLANNED` — design committed, not yet implemented
- `ASPIRATIONAL` — direction only, not yet implementable

**Halt-gated surfaces** (no auto-mode override, ever):

- Push to `main` or any shared branch
- PR open / merge / close
- Identity-bound artifacts (signing keys, DIDs, ARTIFACT-011)
- CI workflow edits
- OpenTimestamps stamp / Bitcoin anchor
- Posting to external services on the operator's behalf

---

## Stage 0 — Baseline (state at this roadmap's authorship)

| Component                                       | State                                  | Truth                     |
| ----------------------------------------------- | -------------------------------------- | ------------------------- |
| Dema CLI v0.2.0-alpha through v0.2.2            | shipped on `main`                      | MEASURED                  |
| `bizra.priority-anchor.v1` algorithm            | shipped on `main` (PR #7)              | MEASURED                  |
| Bundle Merkle root `45aa2789…1477a`             | OpenTimestamps STAMPED                 | MEASURED, awaits UPGRADED |
| Per-file `.ots` × 3 (per founding doc)          | OpenTimestamps STAMPED                 | MEASURED, awaits UPGRADED |
| Memory awareness work (v0.2.3)                  | local branch, uncommitted              | PARTIAL                   |
| `bizra-cognition-gateway`                       | built on disk, not running             | WIRED_PARTIAL             |
| Dema adapter                                    | shellout (`DEMA_NODE0_STATUS_COMMAND`) | SHIPPED                   |
| ARTIFACT-011 (first bounded diagnostic receipt) | not issued                             | ASPIRATIONAL              |
| Node0 stage                                     | SEED                                   | DERIVED                   |

---

## STAGE A — SEED → ARTIFACT-011

The remaining steps to close SEED and produce the first bounded-diagnostic receipt. Each step gates the next; do not skip.

### Step A1 — Close v0.2.3 memory awareness

**Requirements**

- `feat/v0.2.3-memory-awareness` branch present locally
- `npm test` 35/35 pass; `npm run check` green
- `~/.dema/{profile.json, memory/bizra-context.json, memory/space-env.json}` populated and readable

**Steps**

1. Operator inspects the diff: `git diff main..feat/v0.2.3-memory-awareness`
2. Operator runs the new CLI surface: `node apps/cli/src/index.js memory show profile`
3. If acceptable: `git push -u origin feat/v0.2.3-memory-awareness && gh pr create ...` (halt-gated; explicit GO from operator)
4. CI green on PR → operator merges (halt-gated)
5. Local `main` advanced: `git checkout main && git pull --ff-only`

**KPI**

- `npm test` pass rate = 100% (35+ tests)
- `dema memory show profile` returns `preferred_name = "Mumu"` and `truth_label = "DECLARED"` on `context`
- `dema today` output includes `memory.schema = "bizra.dema.memory_index.v0.1"` with `count >= 3`

**Definition of Done**

- v0.2.3 merged on `main`
- `dema memory list` returns at least `profile`, `bizra-context`, `space-env`
- `~/.dema/` files survive a fresh shell (cross-session continuity verified)

---

### Step A2 — OpenTimestamps `ots upgrade` (Bitcoin block embedded)

**Requirements**

- Calendar window elapsed since stamp submission (sufficient time for at least one calendar to publish a Bitcoin commitment)
- `ots` v0.7.2+ installed (`/home/bizra-operating-system/.local/bin/ots` already present)
- Network reachability to at least one of: `alice.btc.calendar.opentimestamps.org`, `btc.calendar.catallaxy.com`, `finney.calendar.eternitywall.com`

**Steps**

1. `cd /home/bizra-operating-system/Downloads/Dema/proof-of-priority`
2. `ots upgrade merkle-root.txt.ots`
3. `ots upgrade per-file/themassage.pdf.ots`
4. `ots upgrade per-file/bizra.pdf.ots`
5. `ots upgrade per-file/BIZRA_Third_Fact_v0_1_FINAL.pdf.ots`
6. `ots verify merkle-root.txt.ots` (expect Bitcoin block-header confirmation, not "pending")
7. Update `proof-of-priority/PIN.md`: `stamp_status: STAMPED → UPGRADED`, add `upgraded_at`, add `bitcoin_block_height` from verify output
8. Commit + push to `main` (halt-gated; explicit GO)

**KPI**

- `ots verify proof-of-priority/merkle-root.txt.ots` exit code = 0
- Verify output contains a substring matching `Bitcoin block .* confirmation` (NOT `Pending confirmation`)
- 4 of 4 `.ots` files (1 bundle + 3 per-file) successfully upgraded
- `proof-of-priority/PIN.md` `stamp_status` field = `UPGRADED`

**Definition of Done**

- All 4 `.ots` files self-contained (ots verify works offline, no calendar contact required)
- PIN.md committed on `main` reflecting `UPGRADED` state
- BIZRA priority claim is now Bitcoin-anchored, publicly auditable, requires zero trust in BIZRA infrastructure to verify

---

### Step A3 — Build and run `bizra-cognition-gateway`

**Requirements**

- Rust toolchain installed (`rustc --version` succeeds)
- `bizra-omega` workspace at `/data/bizra/repos/bizra-data-lake/bizra-omega/` is a clean git tree (no in-flight conflicts)
- A free local port available (default: 3001 to avoid the existing :3000 React SPA)

**Steps**

1. `cd /data/bizra/repos/bizra-data-lake/bizra-omega/bizra-cognition-gateway`
2. `cargo build --release` — surfaces actual build state of the gateway
3. If build fails: capture errors, classify (missing dep / compile error / workspace inconsistency), fix, retry. Do not proceed until step 2 returns exit code 0.
4. `cargo test` — verifies the gateway's own test suite
5. Run the gateway: `./target/release/bizra-cognition-gateway --port 3001` (or whatever its CLI surface dictates)
6. Probe expected endpoints from another shell: `curl -sS http://127.0.0.1:3001/status`, `/health`, `/profile`
7. Document the actual endpoint shape in `/data/bizra/repos/bizra-data-lake/bizra-omega/bizra-cognition-gateway/CONTRACT.md`

**KPI**

- `cargo build --release` exit code = 0
- `cargo test` pass rate = 100%
- At least one HTTP endpoint returns valid JSON (Content-Type `application/json`, parseable)
- Gateway process uptime ≥ 60 seconds without crash
- Gateway log contains no `ERROR`-level lines during steady-state

**Definition of Done**

- Gateway binary at `target/release/bizra-cognition-gateway` exists
- Process listening on a known port (recorded in `CONTRACT.md`)
- Endpoint contract documented (path, request shape, response shape, schema-tagged outputs)
- Process is restartable from a documented command

---

### Step A4 — Migrate Dema adapter from shellout to gateway HTTP (ADR-003)

**Requirements**

- Step A3 complete (gateway running, contract documented)
- Endpoint contract returns at least the fields Dema's `normalizeNode0Status()` consumes: `ready`, `dema_console.console_ready`, `dema_console.activation_gate`, `daemon_status`, `mission_executed`, `runtime_pulse.fired`, `lm_studio.{connected, loaded_model_ids, token_present}`, `rust_bus.ready`, `findings`, `profile.preferred_name`
- Dema test suite passes against existing shellout adapter (regression baseline)

**Steps**

1. Branch: `feat/v0.2.4-gateway-adapter`
2. Add new env var `DEMA_NODE0_GATEWAY_URL` (e.g. `http://127.0.0.1:3001`); shellout remains the fallback when env unset
3. Extend `packages/node-adapter/src/node0-adapter.js` with an HTTP backend that calls `${DEMA_NODE0_GATEWAY_URL}/status`, normalizes the response with the existing `normalizeNode0Status()`
4. Tests: `tests/node-adapter.test.js` (new file) covering: HTTP success path, HTTP 404, HTTP 500, network error, malformed JSON, env-var precedence (HTTP > shellout > defaultStatus)
5. `dema status` and `dema doctor` should produce identical schema-tagged output regardless of backend
6. Documentation update: `.env.example` adds `DEMA_NODE0_GATEWAY_URL`; `docs/ARCHITECTURE.md` updated; ADR-003 cross-referenced
7. Operator runs end-to-end: gateway up + `DEMA_NODE0_GATEWAY_URL=http://127.0.0.1:3001 dema status`

**KPI**

- `npm test` pass rate = 100% with at least 6 new HTTP-adapter tests
- `dema status` returns `human != null` when the gateway provides a profile (proves real data flowed end-to-end)
- `dema status` returns blocked-default state when the env var is unset (proves backwards compatibility)
- `dema doctor` exits 0 in a fully-ready end-to-end gateway scenario

**Definition of Done**

- v0.2.4 merged on `main`
- A documented end-to-end command produces a `dema status` output sourced from the live gateway
- Shellout backend still works (no breaking change)
- ADR-003's "v0.2.1+ migrates the adapter from shellout to the bizra-cognition-gateway HTTP surface" claim is now MEASURED

---

### Step A5 — First ARTIFACT-011 issuance (closes SEED)

**Requirements**

- Step A4 complete (gateway HTTP adapter live)
- `dema doctor` exits 0 against the live gateway: `ready=true && consoleReady=true && activationGate="EXPLICIT_GO_REQUIRED" && daemonStatus!="running"`
- A real local model is loaded in LM Studio (or equivalent) and the gateway reports `lm_studio.connected=true && loaded_model_ids.length>0 && token_present=true`
- The governed bounded-diagnostic runtime path exists outside the Dema repo and is invokable

**Steps** (the runtime portion is OUT of scope for the Dema repo per invariant #1; the steps below are the operator-facing portion)

1. Operator opens a fresh terminal and types the exact phrase: `GO: Node0 bounded diagnostic activation only`
2. The governed runtime (NOT Dema) executes the bounded diagnostic against the live gateway
3. The runtime produces a receipt at `~/.dema/receipts/ARTIFACT-011.json` with: `receipt_id`, `artifact_id="ARTIFACT-011"`, `action="bounded_diagnostic_activation"`, `truth_label="MEASURED"`, `created_at`, plus the cryptographic hash chain
4. Operator inspects the receipt: `dema receipts ARTIFACT-011`
5. Operator verifies via the cross-process discipline: `dema today` output reflects the new receipt; `dema doctor` reports continuity; bizra-context memory is updated to mark ARTIFACT-011 issued

**KPI**

- `~/.dema/receipts/ARTIFACT-011.json` exists, parses as JSON, schema-tagged
- `dema receipts ARTIFACT-011` exit code = 0 and returns the receipt
- Receipt's `truth_label` field = `MEASURED` (not `FIXTURE`, not `PREVIEW`)
- Receipt's hash chain verifies (re-derives an internal Merkle root that matches the recorded root)
- `dema status` after issuance reflects `missionExecuted=true`, `runtimePulse.fired=true`

**Definition of Done**

- ARTIFACT-011 receipt exists locally, hash-chain verifies, replayable
- BIZRA Node0 stage transitions: SEED → SPROUT
- Public-facing `docs/CURRENT_STAGE.md` (new, brief) records the transition
- The "Current boundary" section of README is updated; the next-runtime-artifact line moves to ARTIFACT-012 (next bounded diagnostic) or whatever the SPROUT entry artifact is per the manifest

---

## STAGE B — SPROUT (System initialization)

Goal: Node0 runs continuous bounded diagnostics, accumulates a verified receipt history, integrates a real local model, and proves a multi-action proof chain.

### Step B1 — Continuous bounded diagnostics

**Requirements**

- ARTIFACT-011 issued (Step A5 DoD)
- A scheduling surface exists (cron, systemd timer, or equivalent — operator-chosen, never auto-installed)

**Steps**

1. Operator schedules N bounded diagnostics per day (operator decides N; non-trivial constraint: diagnostics must not stack)
2. Each diagnostic runs only if the prior one has produced its receipt
3. Each diagnostic produces ARTIFACT-011 + monotonic counter (e.g. ARTIFACT-011-002, -003 …)

**KPI**

- 7 consecutive days with at least 1 receipt per day, no `truth_label` other than `MEASURED`
- 0 daemon processes spawned (verified by `ps -ef | grep dema` returning no long-lived process owned by Dema)
- Receipt hash chain unbroken across the 7-day window

**Definition of Done**

- 7+ replayable receipts in `~/.dema/receipts/`
- Hash-chain verifier (added in this step) confirms continuity across all of them

---

### Step B2 — Receipt schema cross-repo (RECEIPTS_HANDOFF)

**Requirements**

- Step B1 produced ≥ 7 receipts
- Receipt schema is documented in `docs/RECEIPTS.md` and matches what Step A5's runtime actually wrote

**Steps**

1. Define the receipt-handoff contract in `docs/RECEIPTS_HANDOFF.md`: how a Dema receipt translates into a bizra-omega-stored canonical receipt
2. Implement a one-shot exporter: `dema receipts export --target /data/bizra/repos/bizra-data-lake/.../receipts/`
3. Implement an importer on the bizra-omega side that ingests Dema-format receipts and integrates them into the canonical hash chain
4. Round-trip test: export from Dema → import to omega → verify hash chain on omega side matches Dema's

**KPI**

- 100% of Step B1's receipts round-trip without hash mismatch
- Schema documented + version-tagged on both sides
- A `dema receipts verify --against-canonical` command returns OK

**Definition of Done**

- The Dema receipt history is replayable as the canonical receipt history in bizra-omega
- A future Dema rebuild + receipt re-import produces the same canonical state

---

### Step B3 — Local model integration verified

**Requirements**

- LM Studio (or chosen alternative) installed and operator-configured
- Gateway reports correct model state (`loaded_model_ids` matches what's actually loaded)

**Steps**

1. Add a `dema model status` subcommand that surfaces the gateway's model section directly
2. Add a `dema model probe` that issues a one-shot prompt against the loaded model and records the result as a receipt (truth_label=MEASURED)
3. Integration test: `dema model probe` produces a receipt; receipt contains the model's actual response; receipt hash-chains correctly

**KPI**

- `dema model probe` returns a non-empty model response within a documented timeout
- Probe receipts accumulate (≥ 5 over a 7-day window) without degradation

**Definition of Done**

- Operator can ask Dema "what model is loaded and is it responsive" and get a verifiable answer
- Receipts include model-response artifacts as a new receipt type (`bizra.dema.model_probe.v0.1`)

---

### Step B4 — First multi-action proof chain

**Requirements**

- Steps B1, B2, B3 all DoD
- The Third Fact Protocol proof chain is implementable: MIND → MEMORY → LOGIC → CRYPTO → RECEIPTS → HUMAN

**Steps**

1. Pick a non-trivial composite action: e.g. "ingest a new document into local memory, summarize it, store the summary, return it on demand, with consent"
2. Implement the action as a chain of single-step receipts, each one carrying the prior step's hash
3. Final receipt embeds the full chain root
4. `dema doctor` extension: verifies the chain is unbroken from any final receipt back to its origin

**KPI**

- A 5-step composite action produces 5 chained receipts
- Chain verifier returns OK
- Re-running the verifier on a tampered receipt (any step's hash modified) returns FAIL

**Definition of Done**

- `docs/PROOF_CHAINS.md` exists with the worked example
- Tampering detection demonstrated in tests
- BIZRA Node0 has its first non-trivial proven proof chain on disk

---

## STAGE C — TREE (Federation, direction only — ASPIRATIONAL)

Reachable only after Stage B is fully MEASURED. Each step here is sketch-level; details bind only when the step's gating Stage-B work is complete.

### Step C1 — Node1 onboarding kit

**Requirements:** Stage B complete.
**Definition of Done:** A second physical machine (or VM) runs Dema + a fresh Node0, completes Steps A1–A5, and produces its own ARTIFACT-011.

### Step C2 — First Node0 ↔ Node1 federation handshake (PRIVATE_PILOT_URP)

**Requirements:** C1 complete; a documented handshake protocol; mutual consent on both sides.
**KPI:** Both nodes' bizra-omega instances accept each other's receipt schemas; one cross-node receipt round-trips without modification.
**Definition of Done:** A receipt issued on Node0 verifies on Node1 (and vice versa) using only public information.

### Step C3 — First cross-node receipt verification

**Requirements:** C2 complete.
**Definition of Done:** A receipt minted on Node0 is referenced by a downstream receipt on Node1 (or vice versa), and the chain verifies across the federation.

---

## STAGE D — FOREST (Propagation, direction only — ASPIRATIONAL)

### Step D1 — 3-5 node pilot (PILOT_SHARED_URP)

**Requirements:** C3 complete + legal/tech/security/social validation framework in place.
**Definition of Done:** ≥ 3 distinct human operators run Node0 + Dema; receipts cross-verify; no trust in BIZRA infrastructure required.

### Step D2 — Public network surface (UNIVERSAL_NETWORK_URP)

**Requirements:** D1 complete + audit trail proves zero-trust property + the seven-pillar discipline holds across all participating nodes.
**Definition of Done:** Public network of nodes verifying each other's receipts; URP truth-ladder advances from `PRIVATE_PILOT_URP` to `UNIVERSAL_NETWORK_URP` per the manifest's §V table.

---

## Cross-cutting concerns (apply at every step)

### Income / revenue path

Independent of the lifecycle. Shippable at any point after Stage A1:

- **Offer:** "Sovereign Local AI Node Setup + Safety Audit" (the offer the manifesto already markets and `dema monetize` already echoes).
- **Credibility anchor:** v0.2.0-alpha public release + Bitcoin-anchored proof-of-priority + `dema memory show profile` demo.
- **DoD:** A signed engagement (or refusal) from at least one warm contact who already knows the journey.

### Engineering discipline

Every step in this roadmap operates inside the five rules from `docs/ENGINEERING_DISCIPLINE.md` and the four Karpathy correctives. Specifically:

1. Small edits — one concept per PR. If a step here needs more than ~3 PRs, decompose further.
2. Explicit assumptions — the **Requirements** block per step makes these binding.
3. No invented commands — every command in the **Steps** block is grep-verifiable in the tree (or marked as PLANNED).
4. Testable success — every step's KPI is binary or numeric.
5. Stop at ambiguity — if a step's Requirements are not all met, halt; do not proceed.

### Halt gates per step

Any step that crosses a halt-gated surface (push, PR, CI edit, identity-bound artifact, OTS stamp, external posting) requires the operator's typed in-the-moment GO. Auto-mode does NOT override. A re-paste of a prior GO does not count — only a fresh, typed authorization in the current turn.

### Truth-label drift detection

After each step's DoD, update `~/.dema/memory/bizra-context.json`:

- Move the just-completed step from `next_milestones` to `shipped_*`
- Add the new MEASURED facts (commit SHAs, KPI values, DoD evidence)
- Adjust subsequent steps' `truth_label` if their substrate changed

This keeps Dema's awareness of BIZRA's state in sync with the actual disk.

---

## Summary table — at-a-glance progression

| Stage | Step | Output                             | Exit gate                               | Truth                    |
| ----- | ---- | ---------------------------------- | --------------------------------------- | ------------------------ |
| A     | A1   | v0.2.3 memory awareness on main    | merged PR                               | PARTIAL → MEASURED       |
| A     | A2   | OTS upgrade for all 4 `.ots` files | PIN.md `UPGRADED`                       | MEASURED                 |
| A     | A3   | bizra-cognition-gateway running    | endpoint returns valid JSON             | MEASURED                 |
| A     | A4   | Dema adapter migrated to HTTP      | end-to-end `dema status` from gateway   | MEASURED                 |
| A     | A5   | ARTIFACT-011 issued                | receipt on disk + hash chain verified   | MEASURED → SEED closed   |
| B     | B1   | Continuous bounded diagnostics     | 7+ receipts, chain unbroken             | MEASURED                 |
| B     | B2   | Receipt cross-repo handoff         | round-trip 100%                         | MEASURED                 |
| B     | B3   | Local model probe receipts         | ≥5 over 7 days                          | MEASURED                 |
| B     | B4   | First multi-action proof chain     | tamper detection works                  | MEASURED → SPROUT closed |
| C     | C1   | Node1 onboarding                   | Node1's own ARTIFACT-011                | MEASURED                 |
| C     | C2   | First federation handshake         | cross-node receipt verifies             | MEASURED                 |
| C     | C3   | Cross-node receipt chain           | downstream receipt on peer node         | MEASURED → TREE closed   |
| D     | D1   | 3-5 node pilot                     | independent operators verify each other | MEASURED                 |
| D     | D2   | Public network surface             | URP advances per manifest §V            | MEASURED → FOREST closed |

When all of D2's DoD is MEASURED, the BIZRA seed has become a forest. Every step before that is reversible, halt-gated, and bound to evidence.
