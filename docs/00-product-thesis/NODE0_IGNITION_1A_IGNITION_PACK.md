# NODE0-IGNITION-1A — Ignition Pack (for review)

- **Truth label:** `DESIGNED_NOT_LIVE / PLANNING_ONLY` — this is a design document, preserved as a committed repository artifact for review. The *implementation* it describes is unbuilt, unrun, and not execution-authorized. It exists to be reviewed before any execution consent.
- **Program:** G0 · BIZRA Genesis Convergence (governing program above the technical targets T1–T4). The master roadmap companion `BIZRA_MASTER_ROADMAP_v0_1` is `PLANNED_COMPANION_NOT_YET_PRESENT` — a provisional dependency; the T1–T4 references here stand on this pack's own definitions until that roadmap exists.
- **Baseline:** `main` @ `5c9d3111` · authored on the operator's local space, 2026-07-12.
- **Authority scope:** planning only. Generating this pack authorizes **nothing else** — see §16.

---

## 0 · Constitutional Posture on Truth, Service and Choice

This pack is governed by the constitutional posture. Per the posture's own law — *one doctrine body, many references, never several editable copies* — this section **references** the canonical source instead of reproducing it:

- **Canonical source:** `docs/canon/BIZRA_CONSTITUTIONAL_POSTURE_ON_TRUTH_SERVICE_AND_CHOICE.md`
- **Content hash (SHA-256):** `b09833cb7006ab451553572907eaf5491a0a51b27f8f24a4c4f4438e42ad5906`
- **Truth label:** `DECLARED_CONSTITUTIONAL_CANDIDATE` · truth class `CONSTITUTIONAL_DECLARATION`
- **Hash binding:** re-derived at the 0G repair (0G amended the posture, so 0F's binding was re-derived in the same change, per this rule). If the posture is amended later, this reference must be re-derived in the same change; a mismatch means this pack must not be used for execution until rebound.

The binding duties this pack inherits by reference (never by copy): principled fallibilism, the ten invariants, the law of separation (PAT operates · SAT judges · FATE protects the human's choice · URP protects fairness of access · the human remains sovereign), evidence-independence, exit materiality, and the conflict-of-interest & reward law.

---

## 1 · The convergence thesis — four results, one motion

Activating Node0 and proving Node0 were never two tasks. A node is "closed" not when its code exists but when its agents execute one real, gated, receipted mission for its human. So the **first real mission is the activation.** The chosen mission — organize BIZRA's own multi-year research estate through the Genome/Foundry pipeline — produces four results in one campaign:

1. **Node0 operational closure v0.1** — the 12 governed roles demonstrably function end to end.
2. **The research estate becomes structured, evidence-graded intelligence** — the founder's actual pain, solved incrementally.
3. **Functional health proven** — the receipt chain of (1)+(2) *is* the health proof.
4. **First BIZRA Continuum product demonstration** — "turn your AI-era archive into evidence-graded, receipted knowledge," with the Vanishing-Agent kill-test runnable *during* a batch, not staged separately.

### Node0 Operational Closure v0.1 (honest definition)

Node0 v0.1 is **closed** only when **one** complete campaign: runs through Dema · uses all 12 governed roles · uses URP-Local scheduling · survives a **real** process restart · preserves mission authority + checkpoints · produces **independent** verification · emits a **signed** proof chain · returns a **useful founder-facing** result · performs **no unauthorized outward action.**

It remains: local-only · operator-invoked · consent-bound · non-federated · non-economic · non-tokenized · reversible where mutation occurs. The correct claim afterward is *"BIZRA Node0 v0.1 is a functional local proof system,"* **not** *"the complete BIZRA network is live."*

---

## 2 · Separation of powers (the corrected architecture)

```
                 Human sovereign (only consent behind FATE)
                              │
        ┌──────────── FATE (exact-string consent gate) ────────────┐
        │                                                           │
   PAT (operate)          Dema + URP services            SAT (judge, do not operate)
   7 builder roles        Router · Proof · Governor       5 judgment roles
   do the work            Checkpoint · Model Router        challenge the evidence
        │                        │                                  │
        └──────────► append-only receipt chain ◄───────────────────┘
```

**SAT judges; SAT does not operate.** These duties are **removed from SAT** and assigned to services (correcting the earlier draft that put them on SAT):

| Operational duty | Correct owner (NOT SAT) |
|---|---|
| Receipt sealing + chain writing | **Dema Proof Service** |
| CPU/GPU/RAM/token/thermal budgets | **URP-Local Governor** |
| Scheduling + role dispatch + pool admission | **Dema Mission Router / URP-Local** |
| Checkpoint execution + recovery | **Checkpoint Service** |
| Model/runtime selection | **provider-neutral Model Router** |

SAT may **inspect** service outputs but must not **produce or control** the objects it judges. This preserves the existing `sat5-constitutional-verifier-set-preview.js` contract (SAT judges Node0, does not serve it, grants no authority, mints nothing, activates no URP).

---

## 3 · The 12 role cards

**Law 1 — agents are role cards, not codebases.** Each agent is a frozen config object executed by *one* runner loop (§9), not a bespoke program. Schema:

```yaml
role_card:
  id:               # PAT-n / SAT-n
  name:
  team:             # PAT (operate) | SAT (judge)
  charge:           # one-sentence duty
  model_route:      # local model family + fallback (Model Router resolves)
  permits:          # read roots, write roots, network(false), tools
  input_schema:     # what it consumes
  output_schema:    # what it emits (immutable, hashed)
  truth_classes:    # labels it MAY assign (PAT) — e.g. USER_INTENT..OPEN_PROOF_GAP
  constitutional_constraints:  # e.g. "may not self-verify", "assigns no reward"
  emits_receipt:    # true
```

### Seven PAT builders (operate)

| ID | Name | Charge | Default model route |
|---|---|---|---|
| PAT-1 | Archivist / Source Steward | Inventory, hash, preserve, normalize sources → immutable vault + canonical ledger (Genome L0/L1) | CPU (parsing); nomic-embed for dedup |
| PAT-2 | Extractor / Conversation Normalizer | Preserve chronology/roles/providers/attachments; extract claims, hypotheses, decisions, requirements, unresolved tasks — each with a truth class | whiterabbitneo-v3:7b |
| PAT-3 | Cartographer / Concept-Lineage Mapper | Concept lineages, contradictions, supersession edges; reconnect renamed concepts across years | gemma4:e4b (long-context) |
| PAT-4 | Scout / Prior-Art | External papers/GitHub/prior art — *only through approved evidence packets*; ground "novel" claims | whiterabbitneo-v3:7b (network = **gated**, off by default) |
| PAT-5 | Applicability Engineer | Map candidates to the real Node0 fabric (16 GB VRAM + 128 GB RAM); verdict fits/doesn't-fit | whiterabbitneo-v3:7b |
| PAT-6 | Reproduction Engineer / Builder | Execute bounded microbenchmarks on Node0 — numbers, not opinions | qwen3-coder-next (CPU/offload — see §11) |
| PAT-7 | Scribe | Founder-facing summaries + evidence packets; the human-readable face of the day's receipts | gemma4:e4b |

### Five SAT judges (judge; do not operate) — bound to the existing SAT5 five-pass contract

| ID | Name | Judgment (what it verifies, never produces) |
|---|---|---|
| SAT-1 | Provenance / Receipt Integrity | Every claim points to exact immutable source hashes; receipt + hash integrity |
| SAT-2 | Consent / Authority Integrity | Consent preserved; FATE authority envelope intact; no authority expansion |
| SAT-3 | Impact Integrity | no-riba, no-zann, no premature economic claim; no simulated-impact-as-real, no cost-as-value |
| SAT-4 | Security / Privacy | secrets, PII, unsafe code, prompt-injection, external-transmission risk, blast radius; computes the **inert** `RESEARCH_PROMOTION_CANDIDACY_SCORE` (§12), not a PoI score |
| SAT-5 | Governance / Doctrine / Admissibility | canon alignment, reproducibility check, novelty/overclaim, final promote / defer / reject / requires-human verdict |

**Reward, corrected:** SAT **confirms reward *eligibility*; it does not issue, seize, or mint reward.** Flow: contribution → evidence → PAT receipt → independent SAT challenge → *eligibility* → constitutional economic rules → **human-governed** distribution. At Node0 v0.1 the economic rules are **dormant** — SAT-4's score is inert.

---

## 4 · Dema + URP service cards (NOT SAT, NOT PAT)

| Service | Duty | Current repository anchor / planned reuse |
|---|---|---|
| **Dema Mission Router** | Mission decomposition + role dispatch; carries the founder's voice; runs the daily stand | Current main anchor: existing CLI + mission primitives only (`apps/cli`). Planned reuse: `packages/mission/src/mission-corridor.js` (contract + journal) from draft PR #382 — `UNMERGED_DRAFT_CANDIDATE`, absent from current main and from this branch; reuse conditional on S2 reconciliation and merge |
| **FATE** | Exact-string consent + authority gate (not an agent; the human is the only consent behind it) | `packages/fate/src/fate.js` (MEASURED) |
| **Proof Service** | Canonical hashing, signing, receipt-chain writing | `canonical-receipt.js`, `node0-receipt-signing-ed25519.js`, `event-log.js` — needs the live-ledger write (roadmap T1) |
| **URP-Local Governor** | CPU/GPU/RAM/NVMe/thermal budgets; job cancellation; resource receipts | **new (build)** — §6 |
| **Checkpoint Service** | Restart, continuation, recovery | Planned reuse: Mission Corridor restart/resume derivation from draft PR #382 — `UNMERGED_DRAFT_CANDIDATE`, not present in current main; Checkpoint Service remains `DESIGNED_NOT_LIVE` until the reconciled corridor slice is merged and independently verified |
| **Model Router** | Select local/cloud runtime from measured policy; enforce verifier-on-different-family | `llm-adapter.js` `invokeLocalLLM()` (the one live path), `model-routing-preview.js` |

---

## 5 · The Genesis pipeline (Loop B) — what the campaign actually does

```
sources (chats · notes · docs · repos · experiments · papers · benchmarks)
  → PAT-1 source inventory + hash + immutable vault
  → SAT-4 privacy / secret / injection screening        (judge before ingest deepens)
  → PAT-1/2 canonical normalization
  → PAT-2 claim extraction (truth-classed claim cards)
  → PAT-3 concept + lineage + contradiction graph
  → PAT-4 prior-art + convergence mapping               (network gated)
  → PAT-5 Node0 hardware applicability verdict
  → PAT-6 reproduction microbenchmark (real numbers)
  → SAT-1..5 independent challenge (immutable candidate, separate identity)
  → SAT-5 promote / defer / reject / requires-human
  → FATE (human consent for any promotion)
  → Proof Service signed decision receipt
```

Three concentric loops: **A · Activate** (Dema → roles → FATE → URP-Local → checkpoints → receipts) · **B · Work** (the pipeline above) · **C · Improve** (a verified optimization the Genome surfaces → Foundry reproduces → SAT verifies → Node0 adopts → next campaign faster) — a *controlled* improvement cycle, never uncontrolled self-modification.

---

## 6 · URP-Local v0.1 (Node0 Resource Plane) — build spec

**Not** live federation / token settlement / public pooling / PoI. Manages only the **operator-attested Node0 resource profile** (`OPERATOR_ATTESTED_UNVERIFIED` — declared 2026-07-12; not yet content-addressed, no reproducible hardware-registry receipt exists): RTX 4090 **Laptop 16 GB VRAM**, ~128 GB RAM (registry to confirm), i9-14900HX, ~3.75 TB NVMe, local models, the corpus, Dema state, and the Fold6 as an *optional* consent/witness/kill-switch edge device (adb reachability **unverified** — treat as optional, not required). Binding a reproducible resource-registry receipt is a precondition for any execution GO that sets ceilings from these values.

Provides: hardware + runtime registry · model capability registry · task queue · resource budgets · GPU/RAM/CPU allocation · thermal + memory ceilings · job cancellation · mission checkpoints · role scheduling · **resource-use receipts** · restart/recovery. Does **not** provide (v0.1): blockchain settlement · remote pooling · public node discovery · token rewards · live PoI · economic federation.

---

## 7 · Mission + authority/permit schema

```yaml
mission:
  mission_id:            BIZRA-GENESIS-CONVERGENCE-0A
  slice_id:              SLICE-1-GENESIS-TWIN
  objective:             # bounded, single-sentence
  base_sha:
  created_at_iso:
  merge_policy:          checkpoint_required   # only legal value
  read_roots:            []   # exact source paths (e.g. /data2/bizra-unified/... , Downloads/Dema/...)
  write_roots:           []   # exact output paths under $DEMA_HOME/genome/ only
  repo_write_roots:      []   # exact repository paths a draft-PR build may touch (empty = no repo mutation)
  network:               false
  outward_actions:       forbidden
  time_budget_hours:
  resource_ceilings:     { vram_gib, ram_gib, cpu_pct, thermal_c, output_bytes }
  checkpoint_interval:
  kill_signal:           # stop-file path
  stop_conditions:       []
  permitted_roles:       [PAT-1..7, SAT-1..5]
  consent_hash:          # sha256 over the CANONICAL FILLED mission card — the GO phrase PLUS every
                         # boundary field above (read/write/repo roots, budgets, cadence, kill path,
                         # registry hash) — never the phrase alone, so consent cannot be replayed with
                         # swapped boundaries (root-bound-consent-envelope-preview.js is the merged law)
authority_delta:         0    # invariant; failure never widens it
```

Permits are **least-privilege**: a role's write_root is a subdirectory it owns; SAT roles get **read-only** access to PAT candidates + sources and their own verdict write_root. No role may write another role's outputs.

---

## 8 · Genesis Twin Slice manifest (SLICE-1) — origin + present

**Law 2 — slice first, forest later.** "Process all years" is a DoD that never closes. SLICE-1 pairs an origin half and a present half so the first run proves the *whole value chain* (idea → rename → debate → architecture → implementation → test → current proof gap):

**Origin half (early 2023):** earliest conversations around al-Bizrah / البذرة / Third Fact / proof / impact / sovereign agents (candidate anchor: the genesis chat export, memory `reference_genesis_chat_export_2023_lineage`, 406 conv · sha256 aa420789) + original notes/docs connected to them + ≥3 model-family perspectives where present.

**Present half (2026):** recent conversations around Mission Corridor / FATE / receipts / Node0 / Vanishing-Agent / the inference fabric + **one current implementation module** (current-tree candidate: `packages/core/src/dema-fde-dual-diagnostic.js` — verified present in this tree; future candidate: `packages/mission/src/mission-corridor.js` **only after** S2 reconciliation merges — `UNMERGED_DRAFT_CANDIDATE` on draft PR #382, not available for the first slice today) + its tests + its receipt + one external paper/repo + one bounded reproduction benchmark.

**Primary lineage to trace:** an early BIZRA concept from origin, through renaming and debate, into current architecture or an explicit proof gap. First expected machine-traced lineage: **البذرة → Third Fact → (current) FATE/receipt architecture**, with receipts.

Source anchor on disk — `OPERATOR_ATTESTED_UNVERIFIED`: deduped census at `/data2/bizra-unified` (declared 613,744 files / 573.7 GB, 2026-04-14). The nearest found artifact (`/data2/bizra-unified/dedup-manifest.jsonl`, SHA-256 `046d521bac4bd665d8d7cdebcd54b0194d37c23d401a83fd93a447d11b456223`, 301,871 lines, same date) is operator-local, not repository-portable, and does **not** by itself reproduce those totals. SLICE-1 draws a **bounded cut** (≈100 conversations + 1 repo + ~10 papers + 1 concept lineage), never the whole census.

---

## 9 · Runner-loop specification (one loop, all role cards)

```
for each role_card in mission.permitted_roles (scheduled by URP-Local):
  1. load role_card (frozen)               — Dema Mission Router
  2. resolve model route                   — Model Router (SAT family ≠ the PAT family it judges)
  3. gather inputs within permits          — read_roots only; hash every input
  4. execute (PAT: produce candidate | SAT: judge immutable candidate)  — invokeLocalLLM()
  5. write output within write_root         — append-only; immutable once written
  6. Proof Service seals a receipt          — content hash + prev_hash + Ed25519 (T1)
  7. checkpoint                             — Checkpoint Service
  8. on uncertainty / budget exhaustion → STOP + requires-human
```

**Independence enforcement (Law: evidence-independence is mandatory; model-family diversity is preferred + recorded, not sufficient):** a SAT judgment is valid only with **separate execution identity · the PAT candidate immutable · SAT gathering its own evidence from source · deterministic re-derivation/tests where possible · no candidate mutation · no shared mutable scratch · a separately sealed verdict receipt.** A convincing SAT model can still be wrong — deterministic tests outrank model voting. The Model Router pins SAT-1's family ≠ the PAT family (e.g. PAT whiterabbitneo → SAT gemma/deepseek) and **records** the pairing.

---

## 10 · Bounded absence batch contract (not a daemon)

**Law 3 corrected — the engine is an operator-started, contract-bounded absence batch, not a persistent steward.** Present Dema canon: no daemon, no hidden background agent, no general autonomy. The first ignition runtime must have: exact mission + source roots · max duration + resource ceilings · checkpoint cadence · kill control (stop-file/signal) · **network off by default** · **no outward action** · automatic stop on budget exhaustion **or** uncertainty · append-only progress receipts.

```
operator starts bounded batch  →  process works while founder is absent
   →  process stops within contract  →  founder returns to evidence
```

This may *later* mature into a persistent steward — but only after process leases, recovery, and kill controls are proven; it is not described as one before then.

---

## 11 · Model routing policy (bound to the real 16 GB card)

Operator-attested fits/doesn't-fit on the RTX 4090 Laptop (16 GB VRAM) — `OPERATOR_ATTESTED_UNVERIFIED`, from local model-inventory audits, not yet content-addressed; re-measure before scheduling against these values:

| Model | On-disk | Role fit | GPU? |
|---|---|---|---|
| whiterabbitneo-v3:7b | 4.4 GiB | PAT reasoning/extraction; SAT verify (as different family) | **fits** |
| gemma4:e4b | 9 GiB | long-context (PAT-3 lineage, PAT-7 scribe) | **fits** |
| deepseek-r1:7b | 4.4 GiB | SAT verifier alt family | **fits** |
| nomic-embed-text | 0.27 GiB | dedup/embeddings (PAT-1/3) | **fits** |
| qwen3-coder-next | 48 GiB | code/benchmark (PAT-6) | **CPU/offload only** (exceeds VRAM; 128 GB RAM allows slow CPU inference) — schedule off the GPU fast-lane |
| gemma4:26b | 16.75 GiB | — | **OOM on GPU** (do not GPU-schedule) |

URP-Local schedules one GPU fast lane (7B-class) + a CPU/offload deep lane (qwen3-coder for code) + CPU workers (parse/verify) so 12 *roles* share the fabric — **12 roles ≠ 12 loaded models.**

---

## 12 · RESEARCH_PROMOTION_CANDIDACY_SCORE (inert — replaces "PoI scoring")

SAT-4 computes an **advisory, inert** score — no mint, no reward, no authority, no automatic canon promotion, no claim of verified impact:

```
score = source_strength × independent_recurrence × reproducibility
        × architectural_relevance × measured_benefit
        − contradiction − speculation − implementation_risk
```

Promotion into canon still requires **FATE + explicit human consent.** The score orders a review queue; it never decides.

---

## 13 · Four receipts + Functional Health acceptance

The campaign emits four top-level, signed, chained receipts:

- **R1 `NODE0_ACTIVATION_RECEIPT`** — Dema routed the campaign; 7 PAT roles participated; 5 SAT judgments executed; URP-Local recorded resource use; FATE preserved authority.
- **R2 `RESEARCH_GENOME_RECEIPT`** — source inventory; immutable hashes; normalized turns; claim cards; concept lineages; privacy classification; full source traceability.
- **R3 `NODE0_FUNCTIONAL_HEALTH_RECEIPT`** — restart-from-checkpoint; no source corruption; no unauthorized writes; independent SAT challenge; bounded resource behavior; ≥1 reproducible result.
- **R4 `FOUNDER_VALUE_RECEIPT`** — *measures* utility (not just claims it): recovered high-value ideas · duplicate/superseded work detected · concepts linked to current code · unresolved contradictions exposed · benchmark candidates · **one highest-value next action**. Initial metrics: minutes-of-reconstruction-avoided (declared estimate) · duplicate investigations detected · unimplemented repeated recommendations found · unsupported claims exposed · decisions reduced to one next action.

**Functional Health acceptance table (Node0 v0.1 healthy iff all pass):**

| Dimension | Acceptance |
|---|---|
| Source integrity | every derived result links to immutable source hashes |
| Agent orchestration | 7 PAT roles complete assigned bounded work |
| Independent verification | 5 SAT functions challenge **real** PAT outputs (separate identity, immutable candidate) |
| Resource management | URP-Local records CPU/GPU/RAM/storage use |
| Continuity | campaign resumes from checkpoint after a **real** restart |
| Consent | outward/mutating actions blocked without exact GO |
| Security | secrets/private content never exposed externally |
| Reproducibility | ≥1 microbenchmark reruns independently |
| Utility | founder receives a usable decision summary |
| Receipts | every promotion decision signed + chained |
| Recovery | failed tasks do not corrupt campaign state |
| Authority | failure never widens permissions |

---

## 14 · SLICE-1 Definition of Done (weekend-scale proof)

Immutable source manifest · ≥95% turns normalized/parseable · privacy-risk report · ≥50 truth-classed source-backed claim cards · ≥5 concept lineages · ≥3 hardware applicability verdicts · ≥3 contradictions · ≥1 microbenchmark executed on Node0 · ≥1 independent SAT verdict on a **distinct model family** · ≥3 promote/defer/reject decisions consented at FATE · 100% receipts sealed + replayable · **0 ungated writes** · successful restart from checkpoint · **no authority expansion** · **no unauthorized external transmission** · one Founder Standing View returned.

**Completion is NOT "data was processed / agents ran."** It is: *the founder gave one bounded mission and received a verified reduction in confusion, duplication, and decision burden.*

---

## 15 · Reuse vs build (honest maturity binding)

**Reuse (exists on disk in the current tree, measured/preview — each path verified):** FATE consent (`fate.js`, MEASURED) · mission replay (`node0-mission-replay-preview.js`) · SAT five-pass judge (`sat5-constitutional-verifier-set-preview.js`, PREVIEW) · reversible action + undo (`node0-reversible-execute-gate.js`, sandbox-MEASURED) · one live local model call (`invokeLocalLLM()`, MEASURED, suggestion-only) · append-only journal (`event-log.js`) · signing crypto (`authorship-signature.js`, ephemeral keys).

**Conditional reuse (`UNMERGED_DRAFT_CANDIDATE` — exists only on draft PR #382, absent from current main; usable only after S2 reconciliation and merge):** continuity/checkpoint (`packages/mission/src/mission-corridor.js`, PREVIEW_ONLY on that branch). No execution plan may depend on this candidate before its merge is separately consented and verified.

**Build (absent / preview / must-harden):** URP-Local Governor (new) · the 12-role runner loop (new) · the 7 PAT builder roles (new) · the Genome pipeline stages (new) · the four campaign receipts (new) · live signed **operator** receipt ledger + persistent key custody (roadmap **T1**) · SAT moving from *injected* facts to *gathering real evidence* + acceptance tests (roadmap **T3**) · reversible action **beyond the sandbox** onto Genome outputs under `$DEMA_HOME` (roadmap **T4**). The cloud→local continuation (roadmap **T2**) is exercised by the Vanishing-Agent kill-test run *during* a batch.

**G0 sits above T1–T4; T1–T4 are the primitives G0 exercises in one motion.** The `FABRIC-BENCH` (qualified-model list) is **Phase 0** of G0 — PAT-6 needs it before the microbenchmark stage.

**Scope flag (held honestly):** "close Node0 + 12 agents + URP + full corpus" is the sentence-shape that historically preceded orbit. The three laws are the antidote — **if any result requires building something substantial before the first receipt, cut it.** SLICE-1's health proof is the loop *closing*, not the corpus *finishing*.

---

## 16 · Boundary — what this pack does NOT authorize

Generating/approving this pack authorizes **documentation + planning only.** It does **not** authorize: installing dependencies · downloading models · processing the corpus · starting background processes · changing runtime infrastructure · mutating repositories · committing/pushing/opening a PR · contacting anyone · publishing anything · destructive cleanup · model training · external upload of the raw corpus · token / PoI / wallet / federation / economic activation. **Each requires a separate, exact human GO.**

---

## 17 · The exact later EXECUTION consent card (to be issued separately, not now)

```
GO: execute NODE0-IGNITION-1A · SLICE-1 GENESIS TWIN (bounded absence batch)

Repository / space:  BizraInfo/Dema + Node0 local space
Base:                main @ <verified SHA — REQUIRED>
Slice:               SLICE-1-GENESIS-TWIN (origin 2023 + present 2026 halves)

Exact boundaries (every value REQUIRED, filled by the human BEFORE consent):
Read roots:          <exact enumerated source paths — REQUIRED>
Write root:          <one exact path under $DEMA_HOME/genome/ — REQUIRED>
Repo write roots:    <exact repository paths the draft-PR build may touch — REQUIRED>
Time budget:         <max wall-clock hours — REQUIRED>
Resource ceilings:   <vram_gib / ram_gib / cpu_pct / thermal_c / output_bytes — REQUIRED>
Checkpoint cadence:  <interval — REQUIRED>
Kill signal:         <stop-file path — REQUIRED>
Resource registry:   <content hash of the §6 resource-registry receipt — REQUIRED>

Template rule: a GO issued with any <REQUIRED> placeholder unfilled is VOID.
The runner may never derive a read root, write root, budget, ceiling, cadence,
or kill path after consent — boundaries are consented, not inferred.

Authorized:
- build URP-Local Governor + the 12-role runner + the 7 PAT roles + Genome pipeline
  behind draft PRs, touching only the repo write roots enumerated above
  (reversible; merges separately gated)
- run ONE operator-started bounded absence batch over the read roots enumerated
  above only, writing only under the consented write root, network OFF,
  checkpointed at the consented cadence, kill-switch armed at the consented path
- emit R1–R4 receipts; return the Founder Standing View
- run the independent SAT challenge on a distinct model family

Forbidden (each needs its own GO):
- processing beyond the SLICE-1 cut · any network / outward action · corpus upload
- any merge · any repo mutation outside the draft PRs · dependency install beyond
  the declared model runtimes · token/PoI/wallet/federation · destructive cleanup

Stop conditions:
- budget/thermal ceiling hit · uncertainty · authority-expansion attempt · ungated write
- base moved · any receipt fails to seal · kill-signal present

Delivery: return R1–R4 + Founder Standing View + exact resume point; stop.
Do not scale to further shards without a fresh GO.
```

---

*Return this pack for review. On a fresh, exact execution GO (§17) — and only then — the build begins as reversible draft-PR slices, SLICE-1 first, receipts as the DoD. We make our choice sincerely, preserve the evidence, invite the challenge, and keep peace with the possibility of being corrected.*
