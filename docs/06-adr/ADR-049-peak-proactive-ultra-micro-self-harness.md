# ADR-049: Peak Proactive Ultra-Micro Self-Harness — what it can honestly be

**Status:** Proposed
**Date:** 2026-08-01
**Deciders:** Mumu (operator) · SAT review before any promotion
**Truth posture:** `DECLARED_DRAFT`. Every capability named here carries a disk label.
Nothing in this ADR promotes a surface. Promotion happens only through a slice with
tests + a same-slice `CURRENT_LIMITS.md` row.

---

## Context

The question: **what is the peak honest form of a proactive, ultra-micro, self-improving
harness for BIZRA — given what frontier models can actually do today?**

Three forces make this decidable now rather than speculative.

**Force 1 — the actor got long-horizon.** `SOURCE-BOUND` (2026-07 vendor talk): frontier
models now sustain multi-day autonomous runs (an 11-day language port, a 14-day rewrite
still running). The stated enabler in both cases was not intelligence — it was a
**verification substrate** the actor could check itself against (a large test suite;
a screenshot-and-compare loop written into the prompt). The same source names the
bottleneck plainly: *"verification is the single most important thing that people do
not get right."*

**Force 2 — capability does not install into weights cheaply.** `SOURCE-BOUND`
(two 2026-07 preprints): procedural knowledge is not low-rank — the effective rank
needed to install multi-step procedure approaches full fine-tuning, and LoRA-class
adapters produce agents that complete 95–99% of conversations while failing >50% of
tasks (the outer form without the inner method). Separately, atomic skills do not
self-compose: 93% → 0.8% → 0% as horizon lengthens. `D` — Procedure must live in the
habitat, not in the actor.

**Force 3 — what BIZRA already has.** `V` on disk: `peak-self-loop-preview.js` (26 KB)
composes eight existing kernels — craftsmanship witness, proof convergence, SNR/process
RSI, HHMM lifecycle preview, event hash table, shoulders protocol, agent-outside-sandbox
posture, bounded OODA + RSI proposal gate — with `action_executed_by_kernel: false` and
a `forbidden_outputs` list. `V` — `self-loop-ooda.js` forces `executed: false` at the ACT
phase. `V` — ~120 review gates, 8,307 tests, canonical all-false preview boundary.

The gap is precise: **BIZRA has a self-loop that observes, scores, and proposes. It has
no loop that acts, verifies its own act, and earns the right to act again.** Everything
downstream of PROPOSE is a human typing a phrase.

### Constraints that bound every option

Repo law, non-negotiable without an ADR of its own: no hidden daemon · exact-string
consent · no self-certification (proposer ≠ certifier) · authority never increases from
a failure · `dema away start` does not exist · economy frozen · localhost-only model
invocation. Operator bandwidth is the real scarce resource — roughly two GO phrases and
an hour per day, not eight.

---

## Decision

**Adopt Option C — the Earned-Autonomy Micro-Loop.** Build the smallest loop that can
close *without* a human in the middle, but only inside an authority envelope the human
issued once, where every cycle emits a receipt and the loop's own trust level is a
function of its receipted history.

Concretely: the peak honest form is **not** an autonomous agent. It is a
**verification-bounded reflex arc** — the habitat gains the ability to complete a
narrow, reversible, self-verifying cycle on its own, and to widen that ability only
through evidence it cannot forge.

Sequenced as: L0 (today) → L1 self-verifying single act → L2 chained acts under one
lease → L3 attunement-widened scope. **Each rung is a separate slice with its own
`CURRENT_LIMITS` row. No rung is entered before the previous one has receipts.**

---

## Options Considered

### Option A: Keep the preview loop, add more lenses

| Dimension | Assessment |
| --- | --- |
| Complexity | Low — pure kernels, existing pattern |
| Cost | Days |
| Scalability | None — every cycle still terminates at a human |
| Team familiarity | Total — this is what the repo does today |
| Risk to doctrine | Zero |

**Pros:** Cheap, safe, composes cleanly, extends a `MEASURED` surface. Adds analytic
depth (more lenses → sharper SNR, better proposals).
**Cons:** `D` — It does not close a loop. Ten more lenses produce ten better proposals
and zero completed work. The founder remains the executor. Against Force 1, this leaves
the entire multi-day-run capability of the actor unused. It is the local maximum the
repo is currently sitting on.

### Option B: Autonomous actuator daemon (the third-party consensus)

| Dimension | Assessment |
| --- | --- |
| Complexity | Very high — resident process, mission state machine, recovery engine |
| Cost | Months |
| Scalability | High in theory |
| Team familiarity | Low — no daemon exists; the repo forbids one |
| Risk to doctrine | **Violates no-hidden-daemon; violates Away Contract lane** |

**Pros:** Maximum autonomy; matches what four independent external evaluations
recommended; would use the frontier actor's full long-horizon capability.
**Cons:** `D` — Rejected on law, not on taste. A resident process that acts while the
operator is absent is exactly what the Away Contract ladder was designed to govern, and
that ladder deliberately has no `start` verb yet. Also rejected on sequencing: a daemon
that can act for days without a proven single-act verification loop is a machine for
producing 14 days of confident garbage (Force 1's counterfactual).

### Option C: Earned-Autonomy Micro-Loop — **CHOSEN**

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium — composes existing MEASURED kernels; one new gate |
| Cost | Weeks, sliced |
| Scalability | Grows with receipted history, not with code |
| Team familiarity | High — every component exists in some form |
| Risk to doctrine | Low — no daemon, consent-gated envelope, fail-closed |

**Pros:** Uses the actor's long-horizon capability where it is safe (inside a bounded,
self-verifying cycle) while keeping the habitat as the authority. Directly answers
Force 1: the loop *is* a verification substrate. Directly answers Force 2: procedure
lives in the typed cycle, not in weights. Every rung is independently falsifiable.
**Cons:** Slower than a daemon. Requires the lease kernel (currently a 13-line stub) and
a secret broker (greenfield) before it reaches useful scope. The first rung will feel
underwhelming relative to the doctrine's ambition — a single file rename that verifies
and receipts itself, unattended, is the whole of L1.

### Option D: Fine-tune a local model on BIZRA's own corpus

| Dimension | Assessment |
| --- | --- |
| Complexity | High |
| Cost | Weeks + hardware |
| Scalability | Poor — decays each model generation |
| Risk to doctrine | Medium — actor-side investment |

**Pros:** Uses the three-year receipted archive as training data.
**Cons:** `D` — Force 2 kills it directly: LoRA-class adaptation cannot install
procedure, and full fine-tuning is wiped by the next base model. This is scaffolding
that decays; the archive's honest use is as an **eval corpus** (PRD §16), which
compounds instead.

---

## The Architecture

```text
HUMAN issues ONE envelope (exact-string consent, scoped, expiring)
      │
      ▼
┌─ MICRO-LOOP (no resident process; invoked, then it runs the cycle) ─────────┐
│                                                                             │
│  PERCEIVE ── typed world facts, evidence-classed, never model narrative     │
│      ▼                                                                      │
│  PROPOSE ─── actor may reason freely; output is a typed intent atom         │
│      ▼                                                                      │
│  GATE ────── lease check: scope · expiry · budget · blast radius            │
│      ▼        (fail-closed; self-enlargement structurally impossible)       │
│  CHECKPOINT ─ backup before mutation; forbidden intermediate states named   │
│      ▼                                                                      │
│  ACT ─────── one typed reversible effect, sandbox-scoped at L1              │
│      ▼                                                                      │
│  VERIFY ──── SELF-CHECK the act: hash equality / restore test / suite green │
│      ▼        ← this edge is the whole ADR. Without it, nothing else is safe│
│  SEAL ────── receipt → chain → signed head                                  │
│      ▼                                                                      │
│  DECIDE ──── evidence says: continue cycle · stop clean · escalate          │
│      │                                                                      │
│      └──► loop, until budget exhausted / lease expires / verification fails │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
ATTUNEMENT ── the loop's authority tier is recomputed from its receipted history.
              Never from self-report. Never from the actor's confidence.
              A failure lowers it; it can never raise itself.
```

**The load-bearing claim:** the ultra-micro-ness is not in how small the *thoughts* are.
It is in how small the **verifiable unit of committed change** is. One act, one proof,
one receipt. Autonomy then means *many* such units under one envelope — never one large
unverified leap.

### Where each piece comes from

| Loop stage | Disk status | Source |
| --- | --- | --- |
| PERCEIVE | [SEED] | file steward, evidence source registry, monitor gatherer — all `MEASURED` |
| PROPOSE | [EXISTS·MEASURED] | task-decomposition intent atoms; `peak-self-loop` OODA |
| GATE | [STUB-RISK] | `fate.js` = 13 lines; seeds in blast-radius, effect-cap, L0–L5 runner |
| CHECKPOINT | [EXISTS·MEASURED] | backup-before-action inside the reversible execute gate |
| ACT | [EXISTS·MEASURED] | `node0-reversible-execute-gate` — sandbox-only governed rename |
| **VERIFY** | **[GREENFIELD]** | **the missing edge — see below** |
| SEAL | [EXISTS·MEASURED] | Ed25519 attestation → proof chain → signed chain head |
| DECIDE | [SEED] | `self-loop-ooda` (currently forced `executed:false`) |
| ATTUNEMENT | [SEED] | `skill-growth-governor` 5 promotion gates, `PREVIEW_ONLY` |

`D` — **Seven of nine stages already exist.** The peak engine is not a build; it is a
weld. The two real gaps are the lease kernel (consolidation, not invention) and the
self-verification edge (genuinely new).

### The self-verification edge — the actual missing component

An act may only be self-verified when its correctness is **judge-free**: derivable from
hashes, exit codes, or restore tests, never from an opinion. This is the admission
criterion for the whole loop.

Admissible verifiers (L1): hash equality after copy/move · restore-from-backup produces
byte-identical state · a named test suite exits 0 at an exact SHA · a schema validates ·
a re-derivation reproduces a content address.

Inadmissible, permanently: "the model judged the output good" · "the summary looks
right" · any LLM-as-judge · any metric the acting party computes about itself.

`D` — This criterion is what makes the loop safe to run unattended, and it is also what
bounds its scope. **The loop can only ever automate work whose success is checkable
without judgment.** That is a smaller set than "everything the founder does" — and it is
exactly the set where 14-day autonomous runs have been demonstrated to work.

---

## Trade-off Analysis

**Autonomy vs. provability.** Option B maximizes autonomy and can prove almost nothing
about what it did. Option A maximizes provability and does nothing. C accepts a narrow
action surface in exchange for every act being provable. `D` — For a product whose only
asset is trustworthy records, provability is the constraint and autonomy is the variable.

**Speed vs. compounding.** A daemon is faster to feel autonomous and does not compound —
its trust never grows because nothing measures it. The attunement rung means C gets
*more* autonomous the longer it runs correctly, without new code. Trust as machine state
is the compounding asset; that is why it is in the loop and not in a doc.

**Scaffolding vs. substrate** (the bitter-lesson test). Every stage above governs *what
may become true or take effect* — none of it tells the model how to think. `D` — A
stronger actor makes this loop more valuable, not less: an agent that can run for weeks
is precisely the thing that must not be taken at its word. Option D fails this test;
Option C passes it.

**Operator bandwidth.** A: unchanged (founder is executor forever). B: low steady-state
cost, high tail risk. C: one envelope replaces N approvals, and the Exception Desk
interrupts only on the three sovereign boundaries. `D` — C is the only option that makes
*drain* a falsifiable metric rather than a hope.

---

## Consequences

**Easier:** long-running work becomes safe because the loop verifies each step ·
`peak-self-loop`'s proposals gain a consumer instead of terminating at a human · trust
becomes measurable · the archive becomes an eval corpus rather than training data ·
the drain metric (C9) gets real numbers.

**Harder:** every automatable task must first be given a judge-free verifier — this is
real design work and it will reject tasks · the lease kernel must be consolidated before
scope widens beyond the sandbox · receipts multiply, so the shelf/compaction surfaces
become load-bearing · the temptation to admit "the model checked it" will be constant
and must be refused every time.

**To revisit:** if a future model makes some judgment provably reliable, the admission
criterion is the thing to re-open — with evidence, in a new ADR, never by softening this
one. Also revisit if the Away Contract lane matures: L2+ unattended cycles may
eventually belong there rather than in an operator-invoked loop.

---

## Action Items

1. [ ] **Do not start any of this before the witness send.** The current sprint owns the
   board; this ADR is a plan, not a task.
2. [ ] Land the **verification-admission criterion** as a pure kernel + tests: given a
   proposed act, decide `self_verifiable: true|false` and name the verifier. Fail closed
   on every judgment-based verifier. (First slice — it is the gate on everything else.)
3. [ ] **FATE consolidation** (C1a): one import source for effect/capability logic, zero
   behavior change, proven at an exact SHA.
4. [ ] **Capability lease schema** (C1b): scope · expiry · budget · revocation ·
   self-enlargement structurally rejected; tier derived only from receipted history.
5. [ ] **L1 slice — the first closed cycle:** one sandbox rename that checkpoints, acts,
   self-verifies by hash equality, seals a receipt, and decides to stop — with no human
   between PROPOSE and SEAL. DOD: kill the process mid-cycle and it resumes or rolls
   back; a forged verification fails; a lease-scope violation fails closed; zero
   authority increase on any failure path.
6. [ ] Only after L1 has receipts: L2 (chained acts under one envelope), then L3
   (attunement widening). Each its own slice, its own row.
7. [ ] Add the three 2026-07 sources (long-horizon runs · procedural-knowledge rank ·
   long-horizon planning physics) to the giants lineage as `SOURCE-BOUND` rows — cite the
   giants, claim only the synthesis.

## What this ADR does not prove

That any of it works. Seven of nine stages exist as separate surfaces; none have been
composed into a closing loop, and the self-verification edge does not exist at all. No
claim here promotes a `CURRENT_LIMITS` row. The economy, federation, and daemon lanes
remain frozen. `Disk wins.`
