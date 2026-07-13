# BIZRA Master Roadmap v0.1

- **Truth label:** `PLANNING_ONLY` — this roadmap authorizes nothing; every execution step behind it requires its own exact human GO. It binds current measured state to the build sequence; it does not promote any capability.
- **Authority:** exact operator card `GO — BIZRA-MASTER-ROADMAP-0B · PLANNING_ONLY` (from the ratified sprint roadmap), executed after S0/S1/S2 merged as the card's timing clause required.
- **Fresh-state bind:** 2026-07-13T10:57Z, `origin/main @ f80e3b6b01ffc4cc9173426ff8b1c6f10f4319cb`. Disk wins over remembered values; one remembered value was contradicted and is recorded as such (Part 1).
- **Repository lifecycle: EXTERNALIZED** — this document does not self-assert its branch/PR/merge state; derive it from Git, GitHub, and the receipt `docs/receipts/BIZRA_MASTER_ROADMAP_0A.md`.
- **Authority delta:** `authority_delta: 0` — planning changes no permission surface; failure never widens authority.

## Part 0 · Constitutional binding (by path + hash + truth label — never duplicated)

| Canon | Path | SHA-256 (at bind) | Truth label |
|---|---|---|---|
| Constitutional Posture on Truth, Service and Choice | `docs/canon/BIZRA_CONSTITUTIONAL_POSTURE_ON_TRUTH_SERVICE_AND_CHOICE.md` | `b09833cb7006ab451553572907eaf5491a0a51b27f8f24a4c4f4438e42ad5906` | `CONSTITUTIONAL_DECLARATION` / merged repository canon |
| NODE0-IGNITION-1A Ignition Pack | `docs/00-product-thesis/NODE0_IGNITION_1A_IGNITION_PACK.md` | `6aa026de03b6816510713f16175cb6752ff86910bd3ae04f2fef0b7fa9a960aa` | `DESIGNED_NOT_LIVE / PLANNING_ONLY` / merged |

This roadmap is subordinate to the posture: PAT operates · SAT judges · FATE protects the human's choice · URP protects fairness of access · the human remains sovereign · failure never widens authority.

## Part 1 · Measured current state (every row labeled)

| Surface | State | Label |
|---|---|---|
| main | `f80e3b6` — S0 (#385) + S1 (#384) + S2 (#386, #387) merged; #382 closed as superseded provenance | `VERIFIED_REPO` |
| Test suite | 7,457 pass / 0 fail on main (+2 pending in PR #388, tests-only) | `MEASURED_LOCAL` |
| Capability truth registry | 64 capabilities, `MEASURED_REPO_ONLY`, 5 blocked live surfaces | `VERIFIED_REPO` |
| Review gates | 131 `scripts/review/*.mjs` in `npm run check`; 5 CI workflows (check, CodeQL, gitleaks, Review Gate, Socket) | `VERIFIED_REPO` |
| Dependencies | 0 runtime, 0 dev | `VERIFIED_REPO` |
| Mission Corridor | contract + hash-chained journal + derived status/resume + fresh-process reconstruction + root-bound two-step consent + atomic nonce reservation, PREVIEW_ONLY on main; registry row deferred to first-campaign promotion | `VERIFIED_REPO` (fixture-`MEASURED_LOCAL`) |
| Root-bound consent envelope | merged preview kernel; corridor is its first write-path consumer | `VERIFIED_REPO` |
| FATE exact-string consent | `packages/fate/src/fate.js`, consumer-tested | `VERIFIED_REPO` |
| Local model fleet | RTX 4090 Laptop 16 GiB VRAM · i9-14900HX 32 threads · 125 GiB RAM; ollama: whiterabbitneo-v3:7b (4.7 GB), gemma4:e4b (9.6 GB), deepseek-r1:7b (4.7 GB), nomic-embed (274 MB), qwen3-coder-next (51 GB, CPU/offload), gemma4:26b + 26b-bizra-16k (17 GB, GPU-OOM class) | `MEASURED_LOCAL` |
| Disk | /data 1.9 T (809 G used) · /data2 938 G (68 G used) · / 937 G (426 G used) | `MEASURED_LOCAL` |
| **Research corpus** | Remembered census said 613,744 files / 573.7 GB at `/data2/bizra-unified`; **current disk measures that path at 439 MB and all of /data2 at 68 GB** — the declared census is `CONTRADICTED_BY_CURRENT_DISK`. Actual corpus location/size: **UNKNOWN — requires operator confirmation before any Genesis slice enumerates read roots** | `UNKNOWN` (was `USER_DECLARED`) |
| Dema runtime canon awareness | no runtime module loads `docs/canon`; `DEMA_RUNTIME_AWARE = NO` | `VERIFIED_REPO` (absence verified) |
| 12-role runner / URP-Local / Proof+Checkpoint services | not built | `DESIGNED_NOT_LIVE` |
| Economy / tokens / PoI / federation / Node1+ | dormant; preview simulations only (`live_mint:false`) | `DESIGNED_NOT_LIVE` |
| Open PR surface | #388 (tests, in flight) + 9 older open PRs (#370, #353, #313, #242, #161, #150, #149, #147, #42) needing triage | `VERIFIED_REPO` |
| Known CI instability | G8 branch coverage at 84.13% vs 84.00% threshold — 5 rerun-cleared strikes; jitter driven by nondeterministic branch execution (timing/race tests); de-edge slice required | `MEASURED_LOCAL` |

## Part 2 · Product thesis and first-user pain

BIZRA's first product truth is Node0: one real human (the founder) whose three years of fragmented work must become continuously usable without surrendering ownership or authority to an AI provider. The pain is concrete: work resets when sessions end, providers change, and history sits unindexed. The wedge is the **Vanishing-Agent guarantee**: the intelligence provider can disappear while the mission, authority, evidence, and recovery path remain intact. (`USER_DECLARED` pain, `VERIFIED_REPO` primitives.)

## Part 3 · Genesis Convergence — one mission, four results

G0: Node0's first real mission is organizing its own research estate. One bounded campaign yields (1) Node0 operational closure v0.1, (2) evidence-graded intelligence from the estate, (3) functional-health proof via the receipt chain, (4) the first product demonstration. Detail: ignition pack §1–§17 (`VERIFIED_REPO`, `DESIGNED_NOT_LIVE`). **Precondition discovered at bind:** the corpus location must be re-confirmed by the operator (Part 1) before SLICE-1 read roots can be enumerated.

## Part 4 · Architecture (current anchor per component)

Dema CLI (`VERIFIED_REPO`) · FATE (`VERIFIED_REPO`) · PAT 7 roles (`DESIGNED_NOT_LIVE`, lanes defined) · SAT 5 judges (sat5 preview `VERIFIED_REPO`; live gather-and-test `DESIGNED_NOT_LIVE`) · URP-Local Governor (`DESIGNED_NOT_LIVE`) · Proof Service (canonical hashing + signing primitives `VERIFIED_REPO`; live operator ledger `DESIGNED_NOT_LIVE`, T1) · Checkpoint Service (corridor resume derivation `VERIFIED_REPO`; service wrapper `DESIGNED_NOT_LIVE`) · Model Router (`invokeLocalLLM()` suggestion-path `VERIFIED_REPO`; routing policy enforcement `DESIGNED_NOT_LIVE`).

## Part 5 · Research Genome and Foundry

The DEMA Cognitive Foundry (11 layers: authority contract → immutable vault → inventory → extraction → segmentation → 7 PAT lanes → provenance graph → 5 SAT lanes → asset factories → promotion ladder → serving → governed self-improvement) is the corpus refinery. Gem lifecycle `RAW_CANDIDATE → … → VERIFIED_GOLDEN_GEM`; ABSTAIN blocks promotion; originals never destructively cleaned. Status: fragments exist (golden-gems tooling, foundry stages, mission replay — `VERIFIED_REPO` as parts); integrated Foundry `DESIGNED_NOT_LIVE`. Giants law: reuse mature parsers/stores/schedulers; original effort only in constitutional composition.

## Part 6 · Vanishing-Agent proof ladder

1. Mission state survives process death (corridor fresh-process reconstruction — `MEASURED_LOCAL` via fixtures/e2e). 2. Session survives operator terminal loss (same). 3. Mission survives model swap (different local model resumes from contract+journal — `DESIGNED_NOT_LIVE`). 4. Mission survives provider loss (cloud → local continuation mid-campaign — `DESIGNED_NOT_LIVE`, T2 kill-test). 5. Node survives BIZRA itself (material exit: export + third-party verify — `CONSTITUTIONAL_DECLARATION / DESIGNED_NOT_LIVE`).

## Part 7 · Execution roadmap

| Step | Objective | State |
|---|---|---|
| T0 hygiene | branch-coverage de-edge slice · open-PR triage (9 stale) · corpus-location confirmation | `PLANNING_ONLY`, next |
| S4 | Dema runtime canon-awareness: manifest + loader + mission-scoped context packet; fail-closed on hash mismatch; acceptance test per its card | `PLANNING_ONLY` |
| T1 | live signed operator receipt ledger + key custody | `PLANNING_ONLY` |
| S5 | NODE0-IGNITION-KERNEL-1B: one runner + 12 role cards + URP-Local v0.1 + 4 receipt schemas (no corpus execution) | `PLANNING_ONLY` |
| T2 | Vanishing-Agent kill-test during a bounded batch | `PLANNING_ONLY` |
| T3 | SAT from injected facts → gathering real evidence | `PLANNING_ONLY` |
| T4 | reversible action beyond sandbox onto Genome outputs under `$DEMA_HOME` | `PLANNING_ONLY` |
| S6 | BIZRA-GENESIS-TWIN-SLICE-0A: bounded corpus campaign through all 7 stages + 5 SAT judgments + 4 receipts + Founder Standing View | `PLANNING_ONLY` |

Each step = its own exact card; merges separately gated; draft PRs only.

## Part 8 · Priority law, governing sentence, non-goals, stops

**Priority law (locked):** 70% Vanishing-Agent + continuity proof · 20% design-partner/compliance preparation (no outreach without GO) · 10% Mission Seed + product-spec extraction.

**Governing sentence:** "By day 90, BIZRA must prove that the intelligence provider can disappear while the human mission, authority, evidence, and recovery path remain intact."

**Non-goals now:** token sale/wallet/live mint · federation · public claims of Shariah compliance · full-corpus processing · autonomous daemon · model training · Node1 onboarding.

**Human gates:** every merge · every execution GO (§17-class, boundaries filled before consent) · every canon amendment · every promotion to `MEASURED`.

**Stop/pivot conditions:** stop or pivot if provider-neutral continuity cannot be demonstrated within the defined window · stop or reduce scope if the first bounded Genesis slice cannot produce useful founder value · no full-corpus processing before the proof shard succeeds · no economy or federation before trust and continuity are measured · no runtime migration during the first kill-test unless the current runtime blocks the proof · **halt Genesis planning that depends on corpus paths until the operator confirms the real corpus location (Part 1 contradiction).**

---

*Planning only. Nothing here is authorized, live, or measured beyond the labels above. We make our choice sincerely, preserve the evidence, invite the challenge, and keep peace with the possibility of being corrected.*
