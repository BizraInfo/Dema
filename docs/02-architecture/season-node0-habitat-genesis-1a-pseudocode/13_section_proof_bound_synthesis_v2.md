# Season Node0 / Dema-active — Proof-Bound Synthesis v2

**Date:** 2026-10-30 · **Branch:** `season/node0-dema-active-1a` · **HEAD:** `7758ee9f`  
**Authority:** `authority_delta = 0` · **NODE0_CLOSED:** false · **RSI / SINGULARITY:** not claimed (refused)

---

## 1. Executive signal

The season’s **architectural linchpin** is a double hinge:

1. **Habitat ≠ actor ≠ player** — BIZRA / Dema / Human (ontology PREVIEW).
2. **Inner kernel + outer gate** — TMPK drives one mission under attenuated leases; the autopoietic trace gate process-mines the Truth Spine and **never applies a system change** without exact consent — and even then stays PREVIEW_ONLY (no mutation).

Without the inward/outward razor, safety is paralysis. Without consent-gated outer loop, “self-evolving” is ambient authority. **Both** are now on disk as minimum special cases. Convergence: TMPK **3** (tested+observed this host); ontology/gate **2–3** local; RSI/singularity **0**.

## 2. Evidence boundary

| Claim | Level | Evidence |
| --- | --- | --- |
| Habitat≠actor ontology | 2–3 | `habitat-actor-party-ontology.js` + 7 tests (prior) |
| TMPK happy + outward | 3 | pytest 5/5; CLI under `/data/bizra/logs/tmpk-runs/` |
| Truth Spine chain | 3 | measured hashes in tmpk receipt |
| Autopoietic trace gate | 2→3 | this slice code + focused tests |
| HHMM / GoT / diffusion | 1–2 | **representation** over chain types — not neural engines |
| RSI / singularity pulse | 0 | refused by gate + ontology |
| Cartographer JSON intake | BLOCKED | artifacts absent |
| G8 floors 95/84 | OPEN | separate |
| PR #497 | MERGED | season branch post-merge note only |

## 3. Current system map

```
Player (Human) ──consent──► Dema (Avatar) ──PAT-7── Hometown
       │                         │
       │                    TMPK (inner) ──leases──► workdir effects
       │                         │
       │                    Truth Spine chain.jsonl
       │                         │
       └──────────────► Autopoietic Trace Gate (outer)
                              parse → mine → hypothesis → ONE proposal
                              apply? exact GO → still PREVIEW no mutation
Habitat = BIZRA · Village Gate · URP · SAT-5 (equal law)
```

Related owners (already shipped PREVIEW): `framework-constellation-preview`, `peak-self-loop-preview`, `loop-emulator`, `dema-home-node-space-ontology`.

## 4. Multi-lens findings

| Lens | Finding |
| --- | --- |
| Formal | SIGNAL→SNR→…→RECEIPT is an observable state machine; HHMM labels are aliases |
| Cryptographic | Chain + gate_digest sha256 are tamper-*evident*; unsigned; not trust-conferring |
| Empirical | TMPK + gate tests are the only level≥2 promotions this season for the weld |
| Economic | E=ΔG/(1+h+c) still proxy — no value oracle |
| AX | Exact-string consent + one blocker > agent swarm theater |
| Security | Python/JS FATE objects ≠ OS capability — red-team §12 |

## 5. SAPE findings

- **S**ignal: Harness paralysis named; inverse = inward/outward + attenuated R(M).  
- **A**mplify: Process-mine real chains; do not invent terminal output.  
- **P**rune: Discard RSI/singularity banners, Carbanak OUTWARD noise, fake H1..H5 hashes.  
- **E**xtract: One kernel · one contract · one trace · one blocker · one consent gate.

## 6. Hidden-state hypotheses

| Id | Hypothesis | Surface |
| --- | --- | --- |
| H1 | Docs still conflate PAT/SAT | `refuseNamingDrift` |
| H2 | Lease bypass via raw open() | OS FATE / Landlock — unbuilt |
| H3 | Trace→insight without corroboration | gate keeps hypotheses ADMISSIBLE≠true |
| H4 | Consent phrase drift across modules | exact `CONSENT_PHRASE` constant |
| H5 | Branch dirty uncommitted → PR vacuum | commit+new PR GO required |

## 7. SNR-ranked golden gems

**Tier 1 (moat):** habitat≠actor; inward/outward; single-use path lease; anti-paralysis; Truth Spine ≠ oracle; exact consent; simulated impact cannot mint.

**Tier 2:** single-blocker rule; convergence ladder 0–5; effectiveness proxy honesty; map-before-merge Downloads.

**Tier 3 (not claimed live):** autopoietic hypothesis generator beyond type mining; SNR solver with scored ΔG; OS FATE; signed seals; HHMM-as-engine.

**Lost-in-noise:** “Human owns intent/judgment/consent; runtime owns control flow”; “retry ≠ repair”; “composition is the moat”; Close loop = Harness → Loops → Graphs.

## 8. DEMA-FDE failure classification

| Item | Class | Verdict |
| --- | --- | --- |
| Prior TMPK emulation with fake hashes | FABRICATION | VOIDED |
| Missing Cartographer JSON | OUTWARD | BLOCKED |
| Inject-outward missing input | OUTWARD | TMPK blocks once |
| Naming drift PAT/SAT | INWARD | ontology refuse |
| Claiming RSI from preview compose | OUTWARD laundering | gate refuseOverclaim |
| G8 coverage shortfall | INWARD | separate slice |

## 9. Minimum provable spearpoint (this turn)

**Special case:** Given a TMPK `chain.jsonl`, mine types → SNR-rank → emit ONE proposal that **requires** exact consent and **never** mutates — prove outer loop without claiming RSI.

Files: `packages/core/src/autopoietic-trace-gate.js` + `tests/autopoietic-trace-gate.test.js`.

## 10. Implementation or exact blocker

| Done | Blocked |
| --- | --- |
| Ontology PREVIEW | Cartographer JSON |
| TMPK level-3 this host | OS FATE / signed receipts |
| Autopoietic gate PREVIEW | Commit + open PR (needs GO) |
| Spec phases 00–06 + v1/v2 synthesis | G8 floors; live models |

## 11. Tests and acceptance results

Recorded only after execution this turn (see receipt). Expected suite: `node --test tests/autopoietic-trace-gate.test.js`.

## 12. Open proof gaps

Same as TMPK §12 plus: gate does not verify hash linkage (defers to TMPK `verify_chain`); no hypergraph RAG; no agent RL reward; no process mining beyond type counts; no DEMA_HOME write path.

## 13. Receipt

See `/data/bizra/receipts/` after measured run — unsigned campaign receipt; not economic mint.

---

## What This Does NOT Prove & How to Break It

- Does **not** prove RSI, singularity, NODE0_CLOSED, or live agent spawn.  
- Does **not** prove proposal truth — only type-presence mining.  
- Does **not** prove OS-enforced FATE.  
- Does **not** prove consent cannot be forged by a caller who already has process control.  
- **Break:** feed a rewritten chain from genesis; gate will still “succeed” mining — need independent verify_chain + signatures.  
- **Break:** mark BLOCKED as inward in a forked TMPK — gate trusts chain types.  
- **Break:** claim HHMM engine from phase labels — refuse; representation only.

**Razor:** If the reader cannot falsify it in five minutes on their machine, it is prose — not evidence.
