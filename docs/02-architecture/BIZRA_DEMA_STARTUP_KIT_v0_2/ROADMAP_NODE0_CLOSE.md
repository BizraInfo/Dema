# Node0 Roadmap — From Current Candidate to Verified Closed Loop

## Governing objective

Reach one empirically closed Node0 loop before expanding to Node1, federation, public URP, token economy, or generalized PAT-7/SAT-5 execution.

The shortest legitimate route is:

`CANONICALIZE -> RECONCILE PROD-01/02/03 -> PROD-06 REAL EFFECT LOOP -> REMOTE_WRITE SETTLEMENT -> PROD-07 CAMPAIGN -> SEAL`

## Phase A — Canonicalize the qualified G6 candidate

**Goal:** convert `READY_FOR_COMMIT_GO` into one exact local commit without changing candidate bytes.

1. Freeze the source worktree. No startup-v0.2, data skill, TASK-080, or unrelated edits may enter this candidate.
2. Verify current parent:
   ```bash
   git rev-parse HEAD
   ```
   Must equal `b233539993ac394b66f28b9e392d187b1c3ec901` unless the candidate is explicitly requalified.
3. Verify Git object format:
   ```bash
   git rev-parse --show-object-format
   ```
4. Correct the candidate identity label. `8479c822a3a7f54ece75fa5903397fb167501023` is 40 hex. Treat it as a candidate Git tree OID only if the repository uses SHA-1 and the verifier proves that meaning.
5. Re-run `G6-CANONICAL-PROMOTION-1A` v0.2 over the frozen source and exact candidate materialization.
6. Confirm expected path set = 44, unexpected = 0, excluded TASK-080 scaffold absent.
7. Stage only the candidate paths.
8. Compare staged path set with the verifier allowlist.
9. Compute staged Git tree:
   ```bash
   git write-tree
   ```
10. It must equal the qualified candidate Git tree OID. If not, STOP and create a new candidate; do not “fix” after qualification.
11. Commit locally using the already-granted commit authority.
12. Verify:
    ```bash
    git rev-parse HEAD^
    git rev-parse HEAD^{tree}
    git status --porcelain=v2
    ```
    Parent must equal the qualified base; tree must equal the qualified candidate; working tree must contain no unexpected drift.
13. Create a commit receipt containing base SHA, commit SHA, tree OID, verifier version/hash, gate results, expected paths, exclusions, and authority_delta=0.
14. STOP. Push is a separate authority transition.

**DoD:** exact verified candidate bytes equal committed bytes; no unrelated content; no push occurred.

## Phase B — Reproduce the committed bytes

1. Create a fresh detached worktree or local clone from the new commit.
2. Run:
   ```bash
   npm test
   npm run check
   npm run llm:guidance
   git diff --check
   ```
3. Verify commit tree again.
4. Compare generated gate/receipt anchors with the pre-commit qualification.
5. If behavior differs, mark the commit `REPRODUCTION_FAILED`; do not push.
6. If green, mark `READY_FOR_PUSH_GO` and wait for explicit push authority.

## Phase C — Startup Kit v0.2 + DEMA Data Steward

Only after Phase A is sealed:

1. Create a new branch/slice from the canonicalized local commit.
2. Add this startup package as a new version; do not rewrite v0.1 history.
3. Install the `dema-data-steward` skill for the local agent.
4. Boot DEMA with memory slots and current-state reconciliation.
5. Run startup package validation and manifest verification.
6. No Node0 production effect is needed to complete this documentation/skill slice.

## Phase D — Reconcile PROD-01 / PROD-02 / PROD-03

### D1 PROD-01 — persistent Node0 runtime

Backlog state is still `In Progress` despite first-heartbeat evidence.

Complete every still-open acceptance item from TASK-075.02:

- real PID and localhost endpoint observed;
- durable, non-vacuous state survives process death;
- same mission identity reconstructs from authoritative storage;
- runtime identity chain verified;
- predecessor is dead;
- no human intervention needed for restart;
- authority_delta=0.

Do not close the task from heartbeat narrative alone. Produce one re-derived task-closure receipt.

### D2 PROD-02 — DEMA runtime observation + execution transport

Backlog still says `To Do`, while G2 truth binding has partial proof. Reconcile task state against evidence rather than simply editing status.

Remaining work:

- typed supervisor->runtime request with mission/contract/execution/eligible-action/authority/consent-FATE references;
- typed runtime->supervisor result with worker identity, typed result, observed effects, runtime receipt ref, failure code;
- runtime may not mutate mission contract;
- DEMA detects runtime loss and reports degraded truth, then observes recovery;
- no fabricated status can generate production-ready state.

### D3 PROD-03 — broker-mediated local model path

Direct local model invocation is measured. Finish:

- broker route actually invokes the selected model, not merely a direct probe;
- exact model identity observed through the end-to-end route;
- whitelist and prompt bounds;
- provider stop -> DEMA non-model-ready;
- provider restart -> observed recovery;
- timeout/unavailability produce explicit non-green outcome;
- authority_delta=0.

## Phase E — PROD-06: minimum real effect closed loop

This is the highest-value unfinished production slice.

Implement exactly one reversible consequential effect through:

`PROPOSED -> VERIFIED -> FATE_PERMITTED -> CONSENTED -> STAGED -> EXECUTED -> POSTCONDITION_VERIFIED -> COMMITTED -> RECEIPTED`

Acceptance sequence:

1. Preserve four separate questions: Season, FATE, human consent, nonce.
2. Choose one bounded reversible real-world effect.
3. Bind predecessor state and exact effect identity.
4. FATE evaluates constitutional permissibility.
5. Human consent binds exact context.
6. Atomic nonce guarantees one permitted use.
7. Stage effect with undo/recovery semantics.
8. Execute.
9. Use an independent observer to verify the world postcondition.
10. SAT final verdict occurs after observation.
11. Resolve trusted active signer identity and chain.
12. Commit only after full verification.
13. Seal trusted receipt.
14. Inject crashes at all specified crash windows.
15. Prove no crash can execute a consequential effect twice.
16. Prove restart never widens authority.
17. authority_delta=0.

## Phase F — `remote_write` closure

Current local state is UNKNOWN, which is correct while only reachability is measured.

1. Preserve listener findings as exposure context.
2. Build correlation evidence: listener -> owning process -> principal -> protocol/route -> write capability -> sovereign target -> authority bypass.
3. For every path classify:
   - no write capability;
   - governed write capability;
   - ungoverned write capability;
   - unresolved/UNKNOWN.
4. Independently measure sync mounts, writable state roots, immutable root-file mutability, and hash drift.
5. If a real ungoverned route exists: remediate host configuration, then reobserve.
6. If no route is established and every required facet is fully measured: emit qualifying clean observation.
7. Never convert missing correlation into SATISFIED.

## Phase G — PROD-07 operational campaign

Prerequisite: PROD-06 complete and closure ledger has no UNKNOWN/VIOLATED rows.

Run adversarial campaign for PAT/SAT/model/gateway/Dema/host crashes; corrupt receipt/checkpoint; duplicate request; stale/expired consent; scope widening; wrong signer/runtime identity; postcondition failure; model timeout; malformed output.

Then:

- observe local URP proof;
- run 72h local-only soak;
- false-green count must remain 0;
- no LIVE truth label without production evidence adapter;
- final evidence receipt binds exact spec/code identity;
- only then seal `NODE0_DEMA_PRODUCTION_ACTIVE`.

## Phase H — Data estate / Research Genome

Run in parallel only when it does not contaminate production-closure candidate bytes.

1. Fresh metadata census of a bounded pilot shard.
2. File Cards and logical zone assignment.
3. Exact duplicate detection using progressive hashing.
4. Google Drive source manifest + version lineage.
5. Content-aware extraction on bounded shards.
6. Decision Graph from three-year corpus.
7. Golden Set regression assets from verified decisions/failures/refusals.
8. Knowledge Cards + provenance graph.
9. Mission retrieval against minimum evidence-complete context.
10. Only after pilot DoD: scale to larger shards.

## Deferred until Node0 closes

- PAT-7 / SAT-5 live multiplication unless a specific mission requires it;
- Node1/2/3;
- federation/public URP;
- token mint / wallet / live PoI reward;
- full-corpus destructive cleanup;
- autonomous RSI affecting active policy;
- broad filesystem daemon with mutation authority.
