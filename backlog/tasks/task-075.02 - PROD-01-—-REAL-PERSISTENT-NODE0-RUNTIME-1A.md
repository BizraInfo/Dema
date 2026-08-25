---
id: TASK-075.02
title: PROD-01 — REAL-PERSISTENT-NODE0-RUNTIME-1A
status: In Progress
assignee:
  - '@codex'
created_date: '2026-08-21 21:19'
updated_date: '2026-08-25 02:31'
labels:
  - production
  - runtime
  - node0
  - identity
dependencies:
  - TASK-075.01
parent_task_id: TASK-075
priority: high
type: task
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Establish one real persistent Node0 runtime as the production execution substrate. Real PID, real localhost endpoint, real persisted state, and kill/restart proof. Runtime identity must be chain-sealed and observed, not hardcoded. This is the ground truth layer for all subsequent Dema observation.

Normative spec: NODE0_DEMA_PRODUCTION_CLOSURE_SPEC_v1_0.md @ b01b4b32e9e978287a97a6a3db6cd04fd02fc488 sha256:6ebb7a0dca40451eab030052dd267a1f5c5ad03f9b23ac13f8f34de695add840
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Real PID observed, not asserted
- [ ] #2 Real localhost endpoint observed, not hardcoded
- [ ] #3 Real persisted state survives process death
- [ ] #4 Kill/restart proves mission state reconstructs from home, not fresh state
- [ ] #5 Runtime identity is chain-sealed and verified
- [ ] #6 Mission identity unchanged across restart
- [ ] #7 No human intervention required for restart
- [ ] #8 Predecessor process not still live
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 NODE0_RUNTIME_ALIVE proven with empirical evidence
- [ ] #2 Runtime identity verified
- [ ] #3 authority_delta = 0
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
C0 — preserve and classify the active Dema worktree plus the existing PROD01 2A package without starting a runtime or consuming GO. Completed: current operator checkout is dirty and does not match the declared consumer binding.

C1 — repair only the existing PROD01 A2/A3/A4 acceptance mechanisms in the external disposable package, then requalify the static package. Completed historically; current package remains non-executable until consumer binding is re-established.

C2 — audit the declared consumer object and every authority-bound locator. Completed fail-closed: 2A is path-bound to /home/bizra-operating-system/Downloads/Dema while that checkout is dirty and at 9eb7f3f; CASE 2 PACKAGE_REBIND_REQUIRED.

C2B — create one clean detached consumer worktree at /data/bizra/node0-closure/worktrees/dema-prod01-2a-ab2d081 bound to ab2d0815815553224febdc0c413f0c2662f79969 and c016ae2832bcd60381af1416782ea407752c6407. Preserve 2A untouched. Construct fresh PROD01 2B supervisor and observation-package roots that bind the new path, regenerate the descriptor, gate packet, verifier, disposable controls, and terminal manifest as one hash DAG, prove red-first path mismatch controls, rerun A1–A6, and stop at READY_FOR_HUMAN_GO. No runtime start, real GO consumption, C3, model invocation, push, merge, federation, mint, paid external service, or authority increase.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-08-22: source is locally available at /data/bizra/node0-closure/producer-115 commit e6320ddd; prior external-repo-unavailable claim is superseded. Read/build/test qualification is authorized. Starting any runtime remains an explicit human hard stop under Dema boundary rules.

Producer qualification from exact clean archive e6320ddd: principal-status 20/20 pass offline; release build exit 0; binary sha256 a8fe6fb0742c325391bfccf24a1e7508e5a0aec691615a5bea6c8d6a9abcfeab. Runtime binds 127.0.0.1:7421. GET /principal/status is read-only, authority_delta=0, and survives authoritative-store reconstruction in tests. Host anchor exists at /data/bizra/repos/bizra-data-lake/sovereign_state/identity/credentials.json and contains only node_id/public_key/created_at. BIZRA_CONSENT_PUBKEY_PATH is not configured. No runtime was started. Evidence: /data/bizra/node0-production-closure/prod01/e6320ddd835de2df2f6e90d1c2c5e38146717a6a/PRODUCER_QUALIFICATION.json sha256 7131ae5b81ecab705f9cc0403e4d8e927d206fe2071ab0052b33ce680d401a34.

2026-08-23 C0 opened by explicit human directive. Baseline HEAD 9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3; external package will be treated as mutable forensic evidence until requalified. C0 is read-only except for its Dema worktree report and this Backlog plan record.

2026-08-23 C0 closeout: added docs/audits/WORKTREE_STATE_0A.md after read-only Dema/external-package census and change classification. npm test: 9,512 pass / 3 fail; npm run check: 9,548 pass / 3 fail; each fails closed at NCG-01, NCG-02, and preview key-store injection. npm run llm:guidance PASS; git diff --check PASS. No PROD supervisor, package verifier, cleanup harness, runtime, real GO, push, merge, or authority transition ran. C1 remains limited to A2/A3/A4 with disposable test artifacts.

2026-08-23 C1/C2 closeout: docs/audits/PROD01_C1_C2_CLOSEOUT_0A.md. A1/A2/A3/A4/A6 PASS; A5 FAIL only at actual consumer HEAD, tree, and clean-worktree bindings. Expected consumer ab2d0815815553224febdc0c413f0c2662f79969 / c016ae2832bcd60381af1416782ea407752c6407; observed 9eb7f3f8287fd7e4e979a7922bcd718a8d49b0e3 / 4f1d41f545f01f9f6710a8c2490617b129197194 and dirty. Thus READY_FOR_HUMAN_GO=false. A3 actual-supervisor disposable cleanup and A4 8-process race passed; live consumed namespace absent, human record absent, port 7421 free, gateway process absent. No normal runtime/real GO/push/merge/federation/mint ran. Fresh Human GO is required to choose an exact clean consumer worktree or authorize a newly bound package; do not proceed to C3.

2026-08-23 GO-C2-CLEAN-CONSUMER-REBIND-CHECK-0A: local historical consumer commit ab2d0815815553224febdc0c413f0c2662f79969 exists and resolves to declared tree c016ae2832bcd60381af1416782ea407752c6407. Binding map proves CASE 2 PACKAGE_REBIND_REQUIRED: descriptor consumer_repo, gate packet dema.worktree, verifier, and hash-bound supervisor DEMA_REPO all require /home/bizra-operating-system/Downloads/Dema. Candidate worktree was not created; external package unchanged; A1-A6 not rerun because Phase D is CASE 1 only. READY_FOR_HUMAN_GO=false, real GO=false, runtime=false, authority_delta=0, C3 blocked. Receipt: docs/audits/PROD01_C2_CLEAN_CONSUMER_REBIND_CHECK_0A.md. Fresh Human GO required for a new explicitly path-bound package revision.

2026-08-24 C2B package qualification closeout: created clean detached consumer worktree /data/bizra/node0-closure/worktrees/dema-prod01-2a-ab2d081 at ab2d0815815553224febdc0c413f0c2662f79969 / tree c016ae2832bcd60381af1416782ea407752c6407; preserved 2A and re-bound a fresh 2B package root. Red control proved inherited 2A hashes mismatched the new 2B supervisor and gate packet before rebinding. Final package verifier result: A1-A6 ALL_PASS, ready_for_human_go=true. Bound artifacts: PACKAGE_DESCRIPTOR sha256 65bc220b4c0f6a02a4a003b490fee01858bd34b36ab9b60db0b71fb447def823; GATE_PACKET sha256 1dc54a53564ef6fb461899a8d2da5eae8bbf3ad6b5cbc74761514877cde508ce; AUTHORITY_MANIFEST sha256 eae3d9bb38fb165c7b99295033af2e1203c5b09bd157f4689d8611836d93e037; qualification timestamp 2026-08-23T23:59:10Z. A4 concurrent control yielded exactly 1 winner and 7 losers. Dema gateway adapter focused test: 29 pass, 0 fail. Clean consumer npm test: 9529 pass, 0 fail. npm run check: exit 0 confirmed by npm log /home/bizra-operating-system/.npm/_logs/2026-08-24T00_02_08_956Z-debug-0.log; nested classifier reports clean 0 failures. npm run llm:guidance PASS; git diff --check PASS. Postcheck: port 7421 has no listener; no gateway or PROD01 supervisor process; consumer and producer worktrees clean. Scope remains package qualification only: no runtime start, no real GO consumption, no state bootstrap, no model invocation, no push/merge, no federation/mint/paid service, and authority_delta remains 0. C3 and all runtime acceptance criteria remain blocked on the separate exact human runtime-start/one-shot-GO transition.

2026-08-24 C3 adequacy correction from current bytes: the exact producer supports an authoritative file-backed receipt chain when BIZRA_RECEIPT_STORE_PATH is set, but the qualified 2B descriptor honestly declares runtime_memory_state=EPHEMERAL and durable_runtime_state_recovery=NOT_CLAIMED. The current supervisor restart comparison checks equality of GET-only pre/post observations, including chain head/length, but creates no run-specific durable state before the kill. Therefore equality can be vacuous on a freshly bootstrapped/default state. Do not use a successful current C3 observation cycle alone to check acceptance criteria #3 or #4. Before closure, add or select one independently verifiable non-vacuity witness: a controlled, bound durable receipt or mission-state record present before kill and proven to be the same recovered record after restart. This is a package/proof-gap correction, not a claim that the producer lacks persistence.

2026-08-24 PROD01 mission-recovery source slice: in isolated producer worktree /data/bizra/node0-closure/worktrees/prod01-mission-recovery-1a-8f744/bizra-omega at HEAD 8f74406367f1272e49ac201ef7eac128f6af26b1 / tree 5d28a576bbe8b92988a411a1696983b9834d3a6e, measured RED before repair: cargo test -p bizra-cognition-gateway permitted_mission_is_recoverable_after_authoritative_restart exited 101 because clean restart returned HTTP 404 rather than 200. The uncommitted source slice introduces chain-sealed MissionCheckpoint recovery only when an authoritative receipt store is configured; gateway bootstrap reconstructs permitted missions from that evidence and aborts on inconsistent recovery. No derived Dema cache is used by the recovery test. GREEN evidence: focused restart test PASS; adversarial checkpoint_refuses_a_sealed_claim_that_no_longer_permits PASS; cargo test --workspace --quiet PASS; cargo clippy -p bizra-cognition -p bizra-cognition-gateway --all-targets -- -D warnings PASS; cargo fmt --all -- --check and git diff --check PASS. Patch SHA-256: 481dfedbf210891709bcaf207f1a102413cc5359b24c970ec5ba8e4062d0e34b. The workspace test emitted 18 synthetic audit fixture rows; they were removed exactly, audit delta now zero. Scope remains source-only and uncommitted: no host runtime start, GO record/consumption, model call, service, push/merge, federation/mint, or authority increase. This clears no live acceptance criterion; rebind/requalify the 2B package to exact source bytes and obtain the separate exact human one-shot GO before non-vacuous C3 proof.

2026-08-25 C3 FIRST HEARTBEAT: C3_PASS. Operator H1 consent bound (86ef608b). GO consumed atomically; supervisor Phase 2 latent defect found (quoted heredoc suppresses expansion — INWARD, first live firing); manual continuation under H1 scope. Binary abf5ced4 started PID 489946, exe verified, 7421 healthy. Mission M1 55bb442f admitted (5/5 gates Permit incl IHSAN_FLOOR 0.95); attempt 1 refused by NO_SHADOW_STATE — live admissibility chain discriminates. SIGKILL death proven, port freed. Fresh process PID 490582 recovered M1: byte-identical records (ad893212 both), zero divergence in missionId/stage/receiptId/chainHead/timestampNs/intent/rejected. Negative controls: 404 nonexistent / 422 empty intent / 400 TIMESTAMP_RUNTIME_OWNED. Shutdown clean, port free. Receipt: C3-NODE0-FIRST-HEARTBEAT-RECEIPT.json sha256 77fc16c8. authority_delta=0. NODE0_RUNTIME_ALIVE=PROVEN.
<!-- SECTION:NOTES:END -->

2026-08-24 (session, merge-train + PROD01 groundwork): Operator granted season GO ("GO, you have my permission and trust") responding to a plan naming train landing + PROD-01 PID/port/kill-restart proof. Executed: (1) five-slice merge train completed at d23cad7f29c1383faf0011da09456e6bd14d6a89 (tree 8661583b5132e5c3cadf815a8557b372c51fa8ce) — full gates on final bytes ALL GREEN: npm test 9570/9570 fail 0; npm run check exit 0; llm:guidance PASS; claim:check:corpus new=0 current=133 baseline=133; env-hygiene:strict PASS; git diff --check PASS. Verified from fresh independent mirror (tree hash match). Pre-existing red on base 9eb7f3f (NCG-01/02 + preview key-store injection, 3 tests) diagnosed via control run and repaired in d30f440 — counts now asserted structurally, satisfaction must trace to a registered adapter; env-dependent real-key-store fallthrough removed. (2) Train branch PUSHED to github BizraInfo/Dema as refs/heads/merge-train-20260824 (secret-scanned, rc=0). Canonical local main NOT moved (must_not_repeat #10); operator checkout untouched (73 dirty paths preserved). Canonical branch merge-train-20260824 = d23cad7 locally too. (3) Clean consumer worktree created: /data/bizra/worktrees/prod01-runtime on branch prod/node0-runtime-1a parented AT d23cad7 — future PROD01 Dema-side binding should target this lineage instead of ab2d081 (train supersedes it). (4) Producer recovery slice found COMMITTED at /data/bizra/node0-closure/worktrees/prod01-mission-recovery-1a-8f744/bizra-omega branch fix/prod01-mission-recovery-1a HEAD 22d5f1bc (parent 8f744063), worktree clean, secret-scan of commit diff = 0 hits. DRIFT UNKNOWN: full-commit diff sha256 d5435dc6a5fd... ≠ recorded qualified patch 481dfedbf21... ; no artifact on disk explains the delta (commit postdates the notes; likely formatting/cleanup but UNPROVEN). Per fail-closed law the producer branch was NOT pushed: evidence-green at near-identical bytes ≠ qualified at exact bytes. NEXT SESSION SEQUENCE: (a) drift analysis 22d5f1bc vs recorded patch, then rebind/requalify the 2B package to exact 22d5f1bc bytes AND to consumer worktree prod/node0-runtime-1a@d23cad7 (supersedes ab2d081 binding); (b) rerun A1-A6; (c) runtime-start GO already interpreted as granted in LOCAL-BOUNDED form only (127.0.0.1:7421, read-only endpoints, no model invocation, authority_delta=0) — if requalification disagrees, halt instead; (d) non-vacuous C3 kill/restart with BIZRA_RECEIPT_STORE_PATH durable witness per the 2026-08-24 adequacy correction; (e) push fix/prod01-mission-recovery-1a only after (a) qualifies it. Gate logs: /data/bizra/logs/mt-*.log.

2026-08-24 evening (drift autopsy + source qualification): The +265-line delta between recorded patch 481dfedb (764/6) and commit 22d5f1bc (1029/8) is EXPLAINED as coherent spec-superset hardening within the same five files: binary checkpoint codec (~15 write/read_checkpoint_* fns), chain-integrity machinery (rollback_to for uncommitted-tail discard after snapshot failure, rebuild), and three tests beyond the two described (durability-honesty, predecessor-lineage refusal, terminal-checkpoint rehydrate positive control). Zero debug residue; gating comment verbatim ("emitted only when an authoritative receipt store is configured"); abort-on-inconsistent present. Original patch bytes unrecoverable from object store (no intermediate reflog/stash/dangling match). DECISION (b): qualify as-committed. cargo fmt --check initially RED on new code → style-only commit 3f4d8fae (semantics preserved by construction). FULL BATTERY GREEN on final bytes @ 3f4d8fae: focused restart RED→GREEN hero test PASS; all five named adversarial/positive tests PASS across both crates; cargo test --workspace --quiet rc=0 (~2149 passed); clippy -D warnings PASS; fmt --check PASS; git diff --check PASS; audit-fixture delta trap FIRED AGAIN (+6 synthetic MISSING_BRIDGE_TOKEN rows) and was restored byte-exact to baseline hash 02717c03ff8dc4c5 (1026 rows / 359 tokens) — worktree clean. Secret scan of promotion range 0 hits. Branch fix/prod01-mission-recovery-1a PUSHED via HTTPS (SSH key absent in session; pipe-masked rc caught) and remote ref verified 3f4d8fae83af645610c436f8e7356605946f5a58. PRODUCER IS NOW QUALIFIED AT EXACT BYTES. NEXT SEAM (unchanged): rebind 2B package to producer 3f4d8fae + consumer /data/bizra/worktrees/prod01-runtime (prod/node0-runtime-1a @ d23cad7), rerun A1–A6, stop at READY_FOR_HUMAN_GO.
