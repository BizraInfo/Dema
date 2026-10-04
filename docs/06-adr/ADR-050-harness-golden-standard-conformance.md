# ADR-050: Loop + Harness vs. the 2026 Market Golden Standard

**Status:** Proposed
**Date:** 2026-07-31
**Deciders:** Mumu (operator) · SAT review before any promotion
**Truth posture:** `DECLARED_DRAFT`. This ADR audits; it promotes nothing.
Evidence classes: `V` = verified on disk/receipt this week · `D` = derived
· `SOURCE-BOUND` = external market source, cited at end.

---

## Context

Question asked: are the BIZRA loop (ADR-049 Earned-Autonomy Micro-Loop) and
harness (filefactory/GenomeFS habitat + Dema kernels + MPSC-002 spine)
engineered to the current market golden standard?

`SOURCE-BOUND` — the 2026 consensus harness decomposes into five stable
layers: execution runtime (event loop, session manager, checkpointing,
recovery) · sandbox boundary · policy/approval gates · observability/tracing
· memory/state scope. The composition doctrine is "policy, sandbox,
monitoring, recovery"; long-running agents additionally require durable
state outside the model, secret brokering, and cost limits. OpenTelemetry
GenAI semantic conventions (v1.41, still marked Development) are the
emerging observability interop layer. Revocable resource-and-effect
capability tokens for coding agents are current research, not yet shipped
practice.

## Decision

**Verdict: the loop design is at-or-above golden standard; the harness
implementation matches on 5 axes, exceeds on 4, and trails on 4.** Adopt the
conformance scorecard below as the gap register, and sequence the four
trailing axes into ADR-049's existing slice ladder rather than as a separate
program. No axis requires abandoning a BIZRA position; every gap is an
implementation deficit, not a design defect.

## Conformance Scorecard

| # | Axis (market golden standard) | Market bar | BIZRA state | Verdict |
|---|---|---|---|---|
| 1 | State outside the model ("Agent = Model + Harness") | durable session state, typed world | `V` typed effects, receipts, capsules, "disk wins" doctrine; procedure lives in habitat (Force 2) | **EXCEEDS** |
| 2 | Approval gates before boundary crossing | intercept + static/dynamic policy checks | `V` exact-string consent, fail-closed AWAITING_CONSENT proven 4× this week, consent recorded in receipt chain | **EXCEEDS** — market gates rarely produce a consent-bound receipt chain |
| 3 | Verification of agent work | tests + policy; market median still leans LLM-as-judge | `V/D` ADR-049 judge-free admission criterion (hash, exit code, restore test); proposer ≠ certifier; SAT independence proven (SAT-XVERIFY caught dirty-tree overclaim) | **EXCEEDS** — ahead of market median, aligned with best research |
| 4 | Recovery / reversibility | checkpoint + rollback path | `V` checkpoint-before-mutation, executed undo corridors (CORRIDOR undo 100%, JRNL rollback), quarantine-not-delete | **EXCEEDS** |
| 5 | Checkpoint/resume for long runs | restore into fresh env from last checkpoint | `V` JRNL-PARTIAL resume, DP stage cache; `D` loop-level kill-mid-cycle resume is ADR-049 L1 DOD, **[GREENFIELD]** | **PARTIAL** |
| 6 | Fresh-context workers, isolation of attempts | fresh containers per task | `V` fresh-context sandboxes, No Echo Only Forks; but copies, not containers | **MATCHES** (pattern) |
| 7 | Sandbox boundary technology | container/microVM, snapshot-rehydrate, blast-radius containment | `V` directory-copy sandboxes + mount physics; no container isolation, no snapshot-rehydrate | **TRAILS** |
| 8 | Observability interop | OTel GenAI semconv: invoke_agent/execute_tool spans, duration + token metrics | `V` receipts are audit-grade evidence (stronger than traces) but not OTel-emittable; no metrics pipeline | **TRAILS** on interop, exceeds on evidential quality |
| 9 | Secret brokering | broker issues scoped short-lived credentials; agent never holds secrets | `D` named in ADR-049 as greenfield; nothing on disk | **TRAILS** |
| 10 | Authority model | research frontier: revocable resource-and-effect capabilities | `D` lease design (scope·expiry·budget·revocation, tier from receipted history) matches the research frontier; `V` fate.js = 13-line stub | **MATCHES design / TRAILS implementation** |
| 11 | Cost & budget limits | per-session cost ceilings enforced | `V` wall-clock recorded in receipts; budgets declared in mission/lease schemas, not enforced | **PARTIAL** |
| 12 | Eval harness & regression lifecycle | short-lived benchmarks, regression suites, eval-vs-training discipline | `V` 8,307-test floor + coverage gate (currently RED at 93.03%/78.26% — a working gate, honestly failing); archive-as-eval-corpus is planned only | **PARTIAL** |
| 13 | Prompt-injection boundary | documents are data, never authority | `V` doctrine + FTS quoting fix; no adversarial test suite for it | **MATCHES**, untested |

## Trade-off Analysis

`D` — The market optimizes for **autonomy throughput** (more unattended
hours per approval); BIZRA optimizes for **provability per act**. Where the
two conflict — LLM-as-judge verification, resident daemons — ADR-049 already
chose correctly against the market median, and the market's own best sources
agree ("verification is the single most important thing people do not get
right"). The trailing axes (7, 8, 9, 10-impl) are exactly the ones where the
market is ahead *without* doctrinal conflict: containers, OTel emission,
secret brokering, and lease enforcement all strengthen the BIZRA position
and compromise nothing.

One deliberate divergence to keep: golden-standard harnesses treat the
audit log as telemetry; BIZRA treats it as the product (receipts). Emit OTel
*from* receipts — never replace receipts with spans.

## Consequences

**Easier:** the gap register is short (4 axes) and every one maps onto an
already-sequenced ADR-049 slice or a bounded add-on. **Harder:** container
isolation on the sovereign local node needs a technology decision (rootless
podman/bubblewrap vs. microVM) — its own mini-ADR. **Revisit:** axis 8 when
OTel GenAI semconv leaves Development status; axis 3 only per ADR-049's
re-open rule (evidence, new ADR, never softening).

## Action Items (sequenced into the existing ladder — no new program)

1. [ ] Fold into ADR-049 slice #2 (admission kernel): no change — already
   golden-standard-plus. Ship as specified.
2. [ ] ADR-049 slice C1b (lease kernel): adopt the revocable
   resource-and-effect capability shape from current research as the schema
   reference; keeps design at frontier while consolidating fate.js.
3. [ ] New bounded slice **OBS-1**: a pure emitter that renders existing
   receipts as OTel GenAI spans (invoke_agent, execute_tool, duration).
   Read-only over receipts; zero doctrine risk.
4. [ ] New mini-ADR **SBX-1**: container-grade sandbox for ACT at L2+
   (rootless podman vs. bubblewrap vs. microVM). L1's copy-sandbox is
   acceptable for a single reversible rename; chained acts are not.
5. [ ] New bounded slice **SEC-1**: secret broker stub — agent-visible
   credentials = 0, broker-issued short-lived tokens only. Precondition for
   any L2 scope touching authenticated surfaces.
6. [ ] Enforce declared budgets: lease/mission budget ceilings checked in
   GATE, exhaustion = clean stop with receipt (closes axis 11).
7. [ ] Restore the coverage gate to green before it is cited as a VERIFY
   substrate (93.03% < 95% lines, 78.26% < 84% branches — currently an
   honest RED).

## What this ADR does not prove

That any trailing axis is closed. It is a conformance snapshot bound to
this week's receipts and to July-2026 market sources. `Disk wins.`

---

### Market sources (SOURCE-BOUND rows)

- Long-Running AI Agent Runtime 2026 — sessions, sandboxes, checkpoints, harnesses (slavadubrov.github.io)
- Harness Engineering: Making AI Coding Agents Work in 2026 (faros.ai)
- AI Agent Harnesses Explained — architecture, ecosystem (boringbot.substack.com)
- Runtime Verification for AI Agents 2026 — policies, sandboxes, safe execution (thebackenddevelopers.substack.com)
- OpenAI Agents SDK — sandboxing + model harness upgrade (devops.com)
- Lingering Authority: Revocable Resource-and-Effect Capabilities for Coding Agents (arxiv 2606.22504)
- OpenTelemetry GenAI semantic conventions status (opentelemetry.io; greptime.com; techbytes.app)
