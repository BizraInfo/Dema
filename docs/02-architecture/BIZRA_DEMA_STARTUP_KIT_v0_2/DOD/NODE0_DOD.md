# Node0 Definition of Done — Production Closure v0.2

**Status:** CONSOLIDATED_DOD / does not itself close Node0.

Node0 is **not Done** because a document says so. Node0 is Done only when the production evidence contract is true on exact current bytes and current host state.

## Gate 0 — Canonicalization

- [ ] Qualified G6 candidate committed from exact verified bytes.
- [ ] Candidate identity uses structurally correct digest/OID labels.
- [ ] Commit parent equals qualified base.
- [ ] `HEAD^{tree}` equals qualified Git tree OID.
- [ ] Fresh reproduction on commit bytes passes `npm test`, `npm run check`, `npm run llm:guidance`, `git diff --check`.
- [ ] No unrelated TASK-080 scaffold in candidate.
- [ ] Commit receipt sealed.
- [ ] Push/remote update performed only under separate authority.

## Gate 1 — PROD-01 persistent runtime

- [ ] Real PID observed.
- [ ] Real localhost endpoint observed.
- [ ] Durable non-vacuous state survives process death.
- [ ] Same mission identity reconstructs after restart.
- [ ] Runtime identity chain verified.
- [ ] Predecessor process confirmed dead.
- [ ] Restart requires no human intervention.
- [ ] `authority_delta = 0`.

## Gate 2 — PROD-02 DEMA binding / transport

- [ ] DEMA derives identity, health, mission, receipt head, recovery state from real runtime observations.
- [ ] Execution request is typed and binds mission/contract/execution/action/authority/consent-FATE refs.
- [ ] Execution response is typed and binds worker/result/observed effects/runtime receipt/failure code.
- [ ] Runtime cannot mutate mission contract.
- [ ] Kill/restart produces truthful DEGRADED -> RECOVERED observation, never stale GREEN.
- [ ] Fabricated status cannot become production-ready state.
- [ ] `authority_delta = 0`.

## Gate 3 — PROD-03 local model path

- [ ] Provider process observed.
- [ ] Exact model identity observed.
- [ ] Broker-mediated invocation passes end to end.
- [ ] DEMA-observed provider/model matches reality.
- [ ] Whitelist/prompt/timeout bounds enforced.
- [ ] Provider stop -> explicit non-ready state.
- [ ] Provider restart -> observed recovery.
- [ ] No hardcoded model-health GREEN.
- [ ] `authority_delta = 0`.

## Gate 4 — PROD-04 / PROD-05

- [x] Real model conduction through mission runtime proven.
- [x] One real PAT proposes without commitment authority.
- [x] Independent deterministic SAT acceptance law proven.
- [x] Executor/LLM self-certification negative control proven.
- [x] `authority_delta = 0` for measured slices.

## Gate 5 — PROD-06 full effect loop

- [ ] Season, FATE, human consent, and nonce remain separate predicates.
- [ ] One real reversible transaction walks every lifecycle state in order.
- [ ] Command exit 0 never equals COMMITTED.
- [ ] Effect is reversible/bounded until COMMITTED.
- [ ] Independent observer verifies postcondition.
- [ ] SAT final verdict occurs after independent observation.
- [ ] Active trusted signer/generation/pointer/succession/fingerprint verified.
- [ ] Durable state uses atomic write discipline.
- [ ] Every crash point has legal/forbidden recovery behavior defined and tested.
- [ ] No crash causes duplicate consequential effect.
- [ ] One complete `PROPOSED -> ... -> RECEIPTED` real transaction exists.
- [ ] `authority_delta = 0`.

## Gate 6 — Closure ledger / remote_write

- [ ] All required deployment facets measured by a qualifying observer.
- [ ] Listener exposure is not promoted to write authority without correlation.
- [ ] Every relevant listener is mapped to process/principal/route/write-capability/target/bypass or explicit no-write evidence.
- [ ] Sync/network mounts over sovereign state are classified.
- [ ] State-root mutability is measured.
- [ ] Root-file immutability/hash integrity is measured.
- [ ] `remote_write = SATISFIED` on fresh qualifying host observation.
- [ ] Entire closure ledger = all SATISFIED, zero VIOLATED, zero UNKNOWN.

## Gate 7 — PROD-07 operational seal

- [ ] Adversarial matrix passes: PAT/SAT/model/gateway/Dema/host crashes; corrupt receipt/checkpoint; duplicates; stale/expired consent; scope widening; wrong signer/runtime identity; postcondition failure; model timeout; malformed output.
- [ ] Local URP is live and independently observed.
- [ ] 72h local-only soak completes green.
- [ ] False-green count = 0.
- [ ] Every LIVE label is derived from runtime evidence adapter.
- [ ] Production closure equation evaluates TRUE.
- [ ] Final receipt binds exact spec/code/runtime identities.
- [ ] `NODE0_DEMA_PRODUCTION_ACTIVE` sealed.
- [ ] `authority_delta = 0`.

## Final law

Any UNKNOWN, unresolved contradiction, failed independent observation, untrusted signer, duplicate-effect possibility, or candidate-byte drift keeps Node0 OPEN.
