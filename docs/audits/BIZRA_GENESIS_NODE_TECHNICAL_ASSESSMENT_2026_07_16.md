# BIZRA Genesis Node / Dema Technical Assessment

- **Assessment date:** 2026-07-16 GST
- **Repository:** `BizraInfo/Dema`
- **Measured base HEAD:** `403c674ce2ab4e65b340a20beff88b710d923374`
- **Environment:** Linux 6.17.0-40-generic x86_64 · Node v22.22.2 · npm 10.9.7
- **Final truth label:** `LOCALLY_IMPLEMENTED`
- **Release posture:** `BLOCKED`
- **Scope:** Dema repository only. This is the local product face, not a
  certification of the wider BIZRA ecosystem, governed Node0 runtime, remote
  CI, federation, economy, or public release.
- **Worktree boundary:** pre-existing untracked `artifacts/m5/` and
  `bizra-genesis-convergence/` content was excluded and not modified.
- **Size rationale:** the requested cross-dimension audit and delivery blueprint
  stay in one frozen evidence record so scores, blockers, and recommendations
  share one measurement boundary.

## Executive Assessment

Dema is a large, unusually evidence-conscious local-first JavaScript system
with strong deterministic kernels, explicit authority boundaries, extensive
tests, zero npm dependencies, pinned CI actions, exact-consent surfaces, and a
substantial receipt and review-gate discipline.

The current checkout is **not release-ready**. Two independently reproduced
integrity defects are release blockers:

1. the consent nonce registry permits concurrent replay and treats a corrupt
   registry as empty; and
2. the `npm run check` wrapper can report a clean result after a later non-TAP
   gate has failed.

Performance is also context-sensitive: isolated boot measurements passed the
150 ms budget at roughly 88-98 ms, while the same boot surface measured roughly
275-290 ms after larger gate sequences. The structural release-readiness audit
still returned 100/100 because it measures configured controls rather than
fresh execution evidence.

**Overall grade: B (82/100).** The codebase has A-range proof discipline and
test depth, but release integrity cannot score above B while replay protection
and the aggregate gate can fail open. Against the narrower target of a
preview-only, local proof kernel, the architecture is B+/A-. Against a
production delivery system, the current state remains blocked.

## 1. Evidence Boundary

### VERIFIED

- Source, tests, docs, workflows, manifests, and review scripts were inspected
  from the current checkout.
- The focused FDE suite, capability registry, integration check, and document
  gates passed after the bounded hardening in this assessment.
- The initial full-suite baseline passed before hardening with 7,488 tests and
  zero failures; the final post-hardening suite passed with 7,498 tests and
  zero failures.
- Coverage passed its configured thresholds.
- The nonce replay race, corrupt-registry behavior, and late-gate false green
  were reproduced locally.

### MEASURED_LOCAL

| Metric | Current measurement |
| --- | ---: |
| Tracked plus this assessment's new files | 1,981 |
| JavaScript / MJS files | 1,329 |
| Tracked JavaScript / MJS LOC | 295,313 |
| App/package/bin source files | 530 |
| Test files | 597 |
| Full-suite tests | 7,498 passing · 0 failing · 358 suites |
| Coverage | 95.29% lines · 84.20% branches · 97.76% functions |
| Coverage floors | 95% lines · 84% branches · 95% functions |
| Markdown docs | 418 |
| Markdown LOC | 82,020 |
| ADRs | 48 |
| Architecture docs | 117 |
| Receipt docs | 98 |
| Review-gate files | 133 |
| Sequential commands in `scripts/check.mjs` | 190 |
| GitHub Actions workflows | 5 |
| Declared npm runtime/dev dependencies | 0 / 0 |
| Package manifests | 2 |
| Commits reachable from HEAD | 1,106 |
| Commits in prior 30 days | 389 |
| Isolated Dema CLI smoke | 7/7 checks passing |
| Self-loop preview | SNR 0.75 · `PARTIAL_PLACEHOLDER` · 0/4 claims converged · all boundaries false |

### UNKNOWN / NOT MEASURED

- Remote CI status for the uncommitted working tree.
- Independent reproduction on another machine.
- Production SLOs, error budgets, recovery time, deployment frequency, and
  change-failure rate.
- Live federation, Node1/Node2 connectivity, public safety, economic value,
  token or reward operation, and governed-runtime receipt issuance.
- Formal external security, SLSA, NIST, SOC 2, ISO, or Sharia certification.

## 2. Architecture Assessment

### Strengths

1. **The product/runtime boundary is explicit.** Dema is the local product face;
   governed effects remain outside preview kernels
   (`docs/ARCHITECTURE.md`, `docs/LLM_SYSTEM_FLOW.md`).
2. **Effect claims have a canonical all-false vocabulary.**
   `packages/core/src/boundary-schema.js` defines and validates the frozen
   preview boundary.
3. **Local adapters are bounded.** The gateway adapter accepts loopback HTTP,
   uses timeouts, and probes a fixed endpoint set
   (`packages/node-adapter/src/gateway-http-adapter.js:20-104`).
4. **Important local storage paths are defensive.** Receipt enumeration checks
   lexical and real-path containment, while authorship keys use restrictive
   modes and no-follow/exclusive open behavior
   (`packages/receipts/src/receipt-store.js`,
   `packages/receipts/src/authorship-key-store.js`).
5. **The CLI has moved toward command modules.** About 100 command modules now
   sit behind a command table rather than one monolithic switch.

### Risks

1. **Package boundaries are organizational, not mechanically enforced.**
   Twenty-three package directories share two manifests and import each
   other's `src` internals directly. Observed cycles include core↔receipts and
   core↔mission.
2. **`packages/core` is a catch-all.** It contains roughly 67% of package source
   files and reaches into consent, receipts, mission, installer, models,
   memory, and verifier concerns.
3. **CLI startup has a wide load blast radius.** The central entry imports most
   command handlers eagerly before command selection
   (`apps/cli/src/index.js:2-96,1220-1379`).
4. **Effect/state access is dispersed.** Dozens of modules independently resolve
   `DEMA_HOME`, environment variables, files, processes, and network ports.
5. **Local scale is bounded rather than indexed.** Receipt and model discovery
   rely on capped scans. This is appropriate today, but repeated O(N) traversal
   becomes a visible limit as local history grows.

### Architecture score

**84/100 (B+).** The conceptual boundaries are strong; mechanical dependency
boundaries and effect isolation lag the conceptual model.

## 3. Functionality and Testing

### Strengths

- 7,498 tests passed with zero failures in the measured full suite.
- Native Node coverage floors are enforced at 95/84/95.
- Test files outnumber many production surfaces and include refusal,
  tamper, replay, malformed-input, schema, CLI, and end-to-end cases.
- `docs/TESTING.md` is wired to an integration check so test files cannot land
  undocumented.
- The FDE verifier re-derives the diagnosis from its carried input, rejecting
  forged-and-rehashed derived fields.

### Risks

- Branch coverage has only about **0.19 percentage points** of headroom above
  the configured floor.
- The canonical FDE review script exercises one default fixture; the test suite,
  not the script alone, carries the adversarial matrix.
- The full suite and coverage are repeatedly invoked across local and CI
  aggregators, increasing latency and noisy-neighbor exposure.
- Several runtime-shaped surfaces remain intentionally preview-only. Passing
  tests prove the preview contracts, not live autonomous behavior.

### Functionality score

**91/100 (A-).** Behavior coverage is extensive and current tests are green.
The deduction reflects intentionally non-live capability surfaces and the gate
integrity defects described below.

## 4. Reliability, Error Handling, and Gate Integrity

### Strengths

- Most kernels fail closed with named blockers rather than silent defaults.
- Hashes, frozen envelopes, explicit truth labels, and whole-body or
  input-bound re-derivation are common.
- The harness classifier rejects missing, empty, truncated, and unknown TAP
  failures.
- Timeouts and bounded input sizes appear throughout adapters and walkers.

### Release blocker R1 — aggregate check can false-green

`package.json` pipes `scripts/check.mjs` through `tee`, discards that process
status, and lets `classify-known-harness-failures.mjs` decide the final status.
The classifier understands TAP and coverage failures, but not arbitrary
non-TAP failures after a successful test summary.

Reproduction:

```text
complete TAP summary
performance-budget: FAIL cli_boot_latency_ms 300 > 150
→ classifier_exit=0
```

This means a late review, smoke, documentation, security, or performance gate
can fail after TAP has completed and still be reported as clean.

### Release blocker R2 — readiness is configuration evidence

`scripts/release-readiness.mjs` records whether required commands are present in
workflow text. It returned **100/100 and no risks** while the measured
performance gate and `delivery:check` failed. The audit is useful as a
structural inventory, but it is not fresh release evidence.

### Performance variance

| Context | Boot latency | 150 ms local ceiling |
| --- | ---: | --- |
| Isolated `perf:json` baseline | 94.60 ms | PASS |
| Five later isolated samples | 91.61-98.35 ms | PASS |
| Three later budget-gate samples | 88.20-91.66 ms | PASS |
| Full `npm run check` sequence | 290.22 ms | FAIL |
| `npm run delivery:check` sequence | 287.10 ms | FAIL |
| Independent quality-lens budget run | 274.85 ms | FAIL |

The evidence supports **context sensitivity**, not a stable regression and not
a stable pass. Current artifacts lack a commit-bound baseline and p99.

### Reliability score

**76/100 (B-).** Deterministic kernel reliability is strong, but aggregate
delivery evidence is not trustworthy enough for release promotion.

## 5. Security Assessment

### Strengths

1. **Zero npm dependency surface** is enforced by a review gate.
2. **All observed GitHub Actions references are immutable-SHA pinned.**
3. **CodeQL and gitleaks** are dedicated CI rails; gitleaks verifies the scanner
   binary hash and redacts findings.
4. **Exact-string consent** is a canonical requirement, and many mutating
   commands declare consent mechanisms in the consent matrix.
5. **Private-key handling** uses restrictive permissions, no-follow behavior,
   and external public-key verification.
6. **Core preview boundaries** default false and reject missing or extra keys.

### Release blocker S1 — consent nonce replay fails open

`packages/receipts/src/consent-nonce-registry.js` catches missing, unreadable,
and malformed registry state and returns `{}`. Consumption then performs an
unlocked read-modify-rename sequence.

Measured reproduction:

```json
{
  "race_trials": 20,
  "double_recorded": 20,
  "corrupt_registry_recorded": true
}
```

Twenty of twenty concurrent same-nonce trials returned two successful
consumptions. A deliberately malformed existing registry was treated as empty
and overwritten by a successful consumption. `verdict-attest.js` consumes this
nonce immediately before rule execution and receipt signing, so this is an
authority-path defect, not documentation drift.

### Additional high-confidence risks

- Loopback-only gateway and model probes validate the initial URL but allow
  default HTTP redirects. A local endpoint can redirect off-host. The live
  talk path already demonstrates the safer `redirect: "error"` pattern.
- `dema talk --receipt` uses the invocation consent string to write a local
  receipt even when invocation is refused; the consent matrix does not declare
  the local write effect.
- Some local-state writers rely on ambient umask or do not re-verify restrictive
  modes consistently.
- Adapter coercion uses permissive boolean/number conversion in places and can
  silently fall back to a legacy executable path.
- A prototype reward-receipt writer uses lexical containment without real-path
  protection and has success-shaped behavior after permission/hash failures.

### Security score

**72/100 (C+/B-).** The design has strong security intent and many concrete
controls, but the reproduced replay defect directly weakens exact-consent
authority. No release or identity-bound operation should rely on this registry
until it is fixed and independently replay-tested.

## 6. Dependency and Supply-Chain Management

### Strengths

- Root and CLI manifests declare no runtime or development dependencies.
- Node's minimum engine is explicit (`>=20`).
- CI actions are SHA-pinned.
- Gitleaks is versioned and hash-verified.
- No package lock is currently needed for an empty dependency graph.

### Risks

- If the first dependency lands, current `npm install --no-audit` workflow
  steps need an accompanying lockfile, `npm ci`, dependency review, and
  provenance policy.
- Direct internal-source imports make package versioning and independent
  replacement difficult.
- The zero-dependency posture reduces supply-chain risk but increases the amount
  of custom security-sensitive infrastructure that must be maintained locally.

### Dependency score

**93/100 (A).** Excellent current supply-chain minimization, with a clear
transition risk if dependencies are introduced later.

## 7. Documentation and Governance

### Strengths

- Canonical read order, ADRs, claim register, current limits, testing matrix,
  delivery spine, architecture docs, receipts, and proof-safe vocabulary are
  unusually comprehensive.
- Documentation gates prevent hardcoded total-test counts in selected living
  docs and check selected navigation links.
- Claims are explicitly separated into measured, preview, designed-not-live,
  unknown, and forbidden classes.

### Risks

- Several canonical docs describe earlier repository states. The Delivery
  Spine still says tests are outside `npm run check`, delivery automation is
  deferred, and performance authority is future, while all three now exist.
- The canonical Third Fact markdown remains a tracked pending target and is
  referenced multiple times.
- Date headers are report-only, so stale current-state headers do not block.
- The existing `ELITE_FULL_STACK_BLUEPRINT.md` contains stale hardcoded metrics
  and unqualified maturity superlatives that are not current execution
  evidence.
- Documentation volume is high; without generated status surfaces, discovery
  cost and contradictory snapshots will continue to grow.

### Documentation score

**82/100 (B).** Breadth, transparency, and governance are strong. Freshness and
single-source generation need further automation.

## 8. Scalability and Performance Design

Dema is intentionally a local-first, no-daemon product face. Distributed
service scaling is therefore not a current acceptance criterion.

### Current scalable properties

- Fixed-size input caps, timeouts, bounded scans, pagination, and all-false
  network/federation boundaries.
- Stateless deterministic kernels are easy to parallelize in tests.
- Content-addressed artifacts support replay and deduplication.

### Current limits

- The 190-command sequential check stack is expensive and exposed to thermal
  and process-load variance.
- CI repeats full tests/coverage/check across overlapping workflows.
- Eager CLI imports increase boot time and couple command availability.
- Receipt history uses bounded rescans rather than an append-only index.
- There are no service SLOs, queueing, sharding, backpressure, or fleet
  observability because the corresponding runtime is not live.

### Performance/scalability score

**76/100 (B-).** The local algorithms are bounded, but current performance
evidence is unstable and the verification pipeline is not cost-efficient.

## 9. Proof-of-Truth Convergence

| Axis | Assessment | Evidence boundary |
| --- | --- | --- |
| Formal | Strong | Versioned schemas, frozen values, deterministic state machines, explicit blockers and boundaries |
| Cryptographic | Moderate/strong but blocked | SHA-256, Ed25519, hash chains, input re-derivation; nonce replay registry currently fails open |
| Empirical | Strong local | 7,498 passing tests and thresholded native coverage |
| Economic | Intentionally blocked | Simulated impact, cost, PoI, token, reward, wallet, and mint surfaces do not prove value |

No arithmetic combination of these axes is treated as certification. Economic
absence does not reduce the authority boundary; it prevents economic claims.

## 10. SAPE and Rare-Circuit Review

### Signal

Highest-SNR findings are the nonce replay race, aggregate-check false green,
performance context sensitivity, nominal package boundaries, and stale
configuration-based readiness.

### Architecture

The higher-order abstraction is **authority monotonicity**:

```text
missing evidence or failure
→ preserve evidence
→ reduce or freeze authority
→ request the narrow repair
```

No classifier, wrapper, receipt writer, or readiness report may turn failure
into greater authority.

The deterministic `peak-self-loop` preview remained `preview_only`, reported
SNR 0.75 / `PARTIAL_PLACEHOLDER`, had no fully converged claim, and kept every
effect boundary false. It is not live autopoiesis, model training, agent RL, or
verified reward.

### Proof

Rarely exercised circuits were probed directly:

- simultaneous billing-lock and forbidden-boundary evidence;
- concurrent presentation of one consent nonce;
- corrupt existing nonce state;
- a non-TAP gate failure after complete green TAP;
- isolated versus full-sequence performance;
- tracked-pending documentation links.

### Ethics / Execution

The Ihsan check is satisfied only by stating the blockers plainly. Calling the
repository release-ready, autonomous, economically verified, or externally
certified would contradict the measured evidence.

## 11. Implemented Minimum Provable Special Case

### `DEMA-FDE-BOUNDARY-PRECEDENCE-1C`

The existing `DEMA-FDE-DUAL-DIAGNOSTIC-1A` misclassified mixed evidence:
genuine GitHub billing lock plus forbidden wallet/token language became a
billing repair instead of a boundary stop. Billing lock also appeared in the
inward code/proof lens.

The bounded hardening:

1. evaluates boundary markers before billing markers;
2. makes `boundary_violation` dominate primary classification;
3. restricts billing lock to the outward lens;
4. preserves measured billing status without manufacturing inward evidence;
5. requires positive boundary evidence, checks every action occurrence, rejects
   negated sentinels/actions, and keeps positive autopatch fields as hard stops;
6. versions new semantics as v0.2 while preserving v0.1 as integrity-only,
   never authority-eligible historical evidence;
7. binds historical founder-impact `fde_summary` fields to the embedded report;
8. adds mixed-signal, all-false, negation, all-occurrence, outward-only, and
   compatibility regressions;
9. updates architecture, testing, limits, registry evidence, and a receipt.

This change does not patch failures, invoke a model, use a network, start a
daemon, mint, access a wallet, or expand execution authority.

## 12. Professional Full-Stack Delivery Blueprint

### Phase 0 — Integrity stop: atomic consent nonce consumption

**Owner:** security/reliability maintainer  
**Priority:** P0 · next bounded slice  
**Objective:** exactly one successful consumption of a nonce per `DEMA_HOME`,
including concurrent processes and corrupt-state conditions.

Recommended shape:

```text
DEMA_HOME/consent/used-nonces/<nonce>.json
```

Create each record atomically with exclusive-create semantics (`wx`, `0o600`)
inside a `0o700` directory. Existing nonce file means replay. Malformed or
unreadable state means stop, never “unused.” Persist and verify consumption
before signing or executing the governed rule.

Acceptance:

- 100 concurrent same-nonce presentations produce exactly one success.
- Malformed, unreadable, symlinked, or permission-denied state fails closed.
- Existing valid legacy registry data is migrated or checked without replay
  loss.
- A signing failure after consumption cannot make the nonce reusable.
- Focused tests, full tests, direct gate execution, and boundary review pass.

Rollback:

- retain the existing registry read-only until migration proves parity;
- feature-select the new store internally without changing consent phrases;
- on failure, stop identity-bound issuance rather than returning to fail-open
  consumption.

### Phase 1 — Proof-pipeline exit integrity

- Preserve the real `scripts/check.mjs` exit status across `tee`.
- Let known environmental masking operate only on the test/coverage commands it
  understands.
- Add a regression where complete green TAP is followed by a failing non-TAP
  gate; the wrapper must exit non-zero.
- Make release readiness consume fresh SHA-bound gate receipts rather than
  workflow command presence.

### Phase 2 — Deterministic performance QA

- Split correctness and performance processes so prior workload does not
  contaminate cold-start measurement.
- Record commit SHA, hardware/context, sample count, p50/p95/p99, baseline,
  target, and artifact hash.
- Use repeated samples and a regression rule robust to one noisy observation.
- Treat standalone and post-suite boot as different named metrics.

### Phase 3 — Enforceable architecture

- Generate a package dependency graph and reject forbidden cycles.
- Extract neutral canonicalization/boundary primitives into leaf packages.
- Replace eager command imports with dynamic command loaders.
- Introduce one injected `DemaContext` for home, filesystem, clock, network, and
  process ports.
- Add an append-only receipt index before the scan cap becomes an operator pain.

### Phase 4 — Local security hardening

- Set `redirect: "error"` and verify final response locality for every loopback
  probe.
- Require an action-specific consent phrase for `talk --receipt` and declare
  its `local_write` effect.
- Standardize `0700` directories and `0600` private local state.
- Strictly validate adapter booleans, finite numbers, arrays, enums, and mode
  selection; reject unknown adapter modes.
- Repair prototype writers so containment, exclusive create, mode setting, and
  read-back verification all fail closed.

### Phase 5 — CI/CD and governance

- Deduplicate repeated full-suite runs through reusable workflow jobs.
- Add explicit job timeouts and shard only after preserving deterministic
  ordering evidence.
- Keep four primary rails independent: check, BIZRA Review Gate, CodeQL, and
  gitleaks. Aggregation may report them but never synthesize a missing rail.
- Generate current-state metrics from machine artifacts; keep historical audits
  frozen.
- Reconcile Delivery Spine and Elite Blueprint wording with the actual pipeline.

### MBOK / PMBOK control map

| Domain | Required control |
| --- | --- |
| Integration | One SHA-bound release evidence bundle joining gates without synthesizing missing proof |
| Scope | One invariant per slice; P0 nonce integrity before unrelated cleanup |
| Schedule | Exit criteria and evidence gates, not aspirational dates |
| Cost | Verification CPU-minutes and dependency cost measured explicitly |
| Quality | Targeted tests → full suite → direct aggregate gate → independent review |
| Resource | Bounded local scans/processes; no hidden daemon or unbounded workload |
| Communications | Truth labels, blocker codes, owner, next evidence, and non-claims |
| Risk | P0/P1 register with fail-closed stop conditions and rollback |
| Procurement | Immutable action pins; dependency justification, lock, and review on first addition |
| Stakeholder | Exact operator consent separated from reviewer approval and public claims |

## 13. Priority Register

| Priority | Finding | Required disposition |
| --- | --- | --- |
| P0 | Concurrent/corrupt consent nonce registry fails open | Fix before identity-bound signing or release |
| P0 | Aggregate check can false-green after late non-TAP failure | Preserve real exit status before release promotion |
| P1 | Readiness 100/100 does not bind fresh gate results | Consume SHA-bound evidence |
| P1 | Performance passes isolated and fails after full gates | Separate metrics and stabilize methodology |
| P1 | Loopback probes can follow redirects | Refuse redirects and verify final URL |
| P1 | Talk receipt write lacks separate exact write consent | Add `local_write` consent contract |
| P2 | Package cycles and core concentration | Add dependency-layer gate and extract leaves |
| P2 | CI repeats expensive full gates | Reuse jobs and remove duplicate executions |
| P2 | Canonical docs contain stale automation statements | Reconcile or generate current-state sections |
| P3 | Receipt/model history relies on bounded rescans | Add local append-only indexes when thresholds are approached |

## 14. Final Truth State

1. **CURRENT TRUTH STATE:** Locally tested preview product with extensive proof
   controls; not release-ready because replay and gate-exit integrity are open.
2. **MINIMUM PROVABLE SPECIAL CASE:** FDE boundary precedence hardening.
3. **EXACT NEXT POINT STEP:** Atomic, fail-closed consent nonce consumption.
4. **INPUTS:** Current nonce registry, consent-proof fields, injected
   `DEMA_HOME`, concurrency fixtures, corrupt/unreadable-state fixtures.
5. **OUTPUTS:** One atomic nonce-consumption result, replay refusal evidence,
   focused tests, review receipt, and no change to existing consent phrases.
6. **OWNER:** Security/reliability maintainer under operator review.
7. **DEPENDENCIES:** Node stdlib filesystem primitives, existing consent proof,
   current verdict-attest integration, and a defined legacy migration path.
8. **AUTHORITY REQUIRED:** Local source/test/doc edits only; no push, merge,
   publish, key issuance, runtime activation, or external action.
9. **FORBIDDEN ACTIONS:** Do not weaken replay tests, bypass corrupt state, treat
   performance noise as proof, mint, publish, or mark readiness from configured
   commands alone.
10. **ACCEPTANCE TESTS:** Exactly one winner under 100 concurrent presentations;
    malformed/unreadable/symlinked state refuses; legacy nonce remains spent;
    signing failure cannot restore reuse; focused and repository gates run.
11. **EVIDENCE ARTIFACTS:** Focused TAP, direct gate exit, registry review JSON,
    boundary review, and a receipt naming what is and is not proven.
12. **ROLLBACK:** Revert the bounded source/test/doc diff; no external state was
   changed by this assessment.
13. **STOP CONDITION:** Any duplicate success, corrupt-state success, permission
    ambiguity, failed focused test, or failed direct gate keeps issuance blocked.
14. **WHAT THIS PROVES:** The repository has strong local proof discipline, the
   FDE hardening works locally, and the named blockers are reproducible.
15. **WHAT THIS DOES NOT PROVE:** Remote CI, production readiness, independent
   certification, live autonomy, federation, economic value, or public safety.
16. **FINAL TRUTH LABEL:** `LOCALLY_IMPLEMENTED`.
