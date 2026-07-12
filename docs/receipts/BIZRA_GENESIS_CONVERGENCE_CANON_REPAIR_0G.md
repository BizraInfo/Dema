# Receipt: BIZRA-GENESIS-CONVERGENCE-CANON-REPAIR-0G

- **Truth label:** `CANON_REPAIR_EVENT` — this receipt records a bounded documentation truth-surface repair on the source branch of PR #385. It does not claim any runtime, economy, federation, autonomy, or merge.
- **Authority:** exact operator card `GO — BIZRA-CANON-REPAIR-0G-ONLY · PR #385` (repair + evidence + fresh review; merge explicitly NOT authorized; maximum two new commits). This receipt authorizes nothing further. It does not claim its own containing commit SHA or its own file hash (unknowable at authoring time); the repaired head must be read from Git.
- **Date:** 2026-07-13.

## Commit lineage (durable anchors)

| Role | Value |
|---|---|
| Source PR | #385 |
| Base (`origin/main`) | `5c9d3111e6abf3c8315ee7e0d3ab21a7be94b4b4` |
| 0G starting head (= 0F attestation head) | `71b46f18c3d5f8c353255af6a2a0b241ab77e335` |
| 0G repair-content commit | `a495c583e4c69485a81d319fd8dfa8468ee765a1` |
| Source-tree SHA at the 0G content commit | `33db06f17e5a932b71b7b230122d7229bb6e9eb3` |
| 0F patch SHA-256 (`git diff ed8ac4c..71b46f1`) | `8c7f1b971bb0e9b9a0a5fa678b6473cc0f329e6144ae4d8a1f84dd7049cc5b7c` |
| 0G attestation commit (this receipt + pack hash rebind) | not self-claimed (next commit on the branch) |

All commit SHAs above are **source-branch event commits**; after a squash merge they may not be ancestors of `main`. Durable verification uses the PR number, tree SHA, patch hashes, and the file-content hashes below. The future squash commit and resulting `main` SHA must be captured by a separate merge receipt.

## What 0G repaired

1. **Repository lifecycle externalized from the posture** — the normative constitutional text no longer self-asserts any branch, pull-request, review, or merge state; promotion is derived from Git history, GitHub metadata, and event receipts. Volatile lifecycle language introduced by 0F was removed.
2. **Enforcement-state schema normalized** — the two 0F scope-qualified enum variants (`…_VIA_CONSUMER_TESTS`, `…_WITHIN_SANDBOX_BOUNDARY`) were removed as registered values; the vocabulary is again exactly the five base states, and every clause row now carries a four-field record: **base state · scope · evidence · known gap**. Scope narrows a base state; it never creates a new enum.
3. **Unsupported "verified" wording reclassified** — ignition-pack §6 (hardware/resource profile), §8 (corpus census), and §11 (model fits) are now `OPERATOR_ATTESTED_UNVERIFIED`; none is presented as reproducibly verified.
4. **Evidence-source salvage executed** (results below); receipt 0A records the outcome and retains `UNVERIFIED_CONTEXTUAL_INPUT · NOT_A_PROOF_SOURCE`.
5. **Docs index registration** — all six canon/receipt artifacts are registered in `docs/INDEX.md` with class, truth role, and an explicit no-runtime-load boundary.
6. **Squash-lineage durability** — receipt 0F now carries durable anchors (PR number, tree SHA, patch SHA-256) and an explicit statement that its commit SHAs are source-branch events, not mainline ancestry; the operator halt log is relabeled `OPERATOR_LOCAL_CONTEXT_NOT_REPOSITORY_PORTABLE`.
7. **Posture hash rebind** — 0G amended the posture, so the pack's §0 content-hash binding was re-derived in the same change, as the pack's own rebind rule requires.

Modified files (content commit): posture · ignition pack · receipt 0A · receipt 0F · `docs/INDEX.md`. The attestation commit adds this receipt and the pack's §0 hash rebind (rule-mandated by the posture amendment in the content commit).

## Evidence-source salvage (read-only, 2026-07-13)

| 0A evidence item | Search performed | Outcome |
|---|---|---|
| Market investigation ("Trust & Continuity Operating System for Autonomous Work") | filename `find` over `/data/bizra` (depth 3: `*trust*continuity*`, `*market*invest*`); content `grep -rl` over `/data/bizra/{logs,research,proofs}` | **NOT FOUND** — only self-referential quotes inside this repair session's own patch logs. Retained: `UNVERIFIED_CONTEXTUAL_INPUT · NOT_A_PROOF_SOURCE`. |
| Physical asset ledger audit (2026-07-12) | filename `find` (`*asset*ledger*`); `ls` of `/data/bizra/logs` filtered for date/audit terms | **NOT FOUND** as a retrievable artifact. Claim class: `OPERATOR_ATTESTED_UNVERIFIED`. |
| Wedge-capability maturity map (2026-07-12) | content `grep -rl "wedge-capability"` over `/data/bizra/{logs,research,proofs}` | **NOT FOUND** — self-referential hits only. Retained: `UNVERIFIED_CONTEXTUAL_INPUT`. |
| Corpus census (declared 613,744 files / 573.7 GB at `/data2/bizra-unified`, 2026-04-14) | census/manifest `find` over `/data/bizra` and `/data2` (depth 2) | **RELATED ARTIFACT FOUND:** `/data2/bizra-unified/dedup-manifest.jsonl` — SHA-256 `046d521bac4bd665d8d7cdebcd54b0194d37c23d401a83fd93a447d11b456223`, 301,871 lines, 118,035,457 bytes, dated 2026-04-14. Class: `OPERATOR_LOCAL_EVIDENCE_NOT_REPOSITORY_PORTABLE`. It does **not** reproduce the declared totals (301,871 ≠ 613,744); the census claim therefore remains `OPERATOR_ATTESTED_UNVERIFIED`. No path or hash was invented. |

## Claims reclassified from "verified"

| Location | Before | After |
|---|---|---|
| Pack §6 | "physically-present Node0 resources (verified 2026-07-12)" | "operator-attested Node0 resource profile (`OPERATOR_ATTESTED_UNVERIFIED` … no reproducible hardware-registry receipt exists)" + registry-receipt precondition for any execution GO |
| Pack §8 | "Source anchor on disk (verified): deduped census …" | "`OPERATOR_ATTESTED_UNVERIFIED` … declared … nearest found artifact … does **not** by itself reproduce those totals" |
| Pack §11 | "Verified fits/doesn't-fit …" | "Operator-attested fits/doesn't-fit … `OPERATOR_ATTESTED_UNVERIFIED` … re-measure before scheduling" |

Repository/test evidence that is directly reproducible (e.g. `fate.js` MEASURED, sat5 preview, reversible-gate tests) was **not** weakened.

## Resulting SHA-256 (post-0G) for the six artifacts

| File | SHA-256 |
|---|---|
| `docs/canon/BIZRA_CONSTITUTIONAL_POSTURE_ON_TRUTH_SERVICE_AND_CHOICE.md` | `b09833cb7006ab451553572907eaf5491a0a51b27f8f24a4c4f4438e42ad5906` |
| `docs/00-product-thesis/NODE0_IGNITION_1A_IGNITION_PACK.md` | `c225cd8f6ded48cf64d9ae6f0283a585cc0beef307f3e5cb7834c2a9d96241e9` (after §0 hash rebind) |
| `docs/receipts/BIZRA_GENESIS_CONVERGENCE_CANON_0A.md` | `249d3a5ed0caea85296ef70f15a1dd5f7e8ff279fd0f623903a5e919239e24ee` |
| `docs/receipts/BIZRA_GENESIS_CONVERGENCE_CANON_ATTESTATION_0B.md` | `876d90625c567318139222dae474891aecf2b0d7f6b959c1cc821cbed53705fc` (unchanged by 0G) |
| `docs/receipts/BIZRA_GENESIS_CONVERGENCE_CANON_REPAIR_0F.md` | `2a0aeb9fdc513e6cf3808eb09608432f4680760e272308dc65ae1a07ffe49f22` |
| `docs/INDEX.md` | `806de94a3a01b16e05bf84e5ce55d562f850da27360fa89f08ef1707f2b71f87` |

## Unresolved-thread mapping (the three open findings at 0G start)

| Finding | 0G disposition |
|---|---|
| Docs-index registration (Codex P2) | Repaired — all six artifacts registered in `docs/INDEX.md` |
| Squash-lineage durability of 0F (Codex P2) | Repaired — durable anchors + source-branch-event statement added to 0F |
| Unsupported "verified" hardware/corpus/model wording (Codex P2) | Repaired — reclassified `OPERATOR_ATTESTED_UNVERIFIED` (§6/§8/§11) |

## Gates (at the 0G content commit)

`npm test` 7436 pass / 0 fail · `npm run check` exit 0 (G8 clean) · `npm run llm:guidance` exit 0 · `git diff --check` clean. Gates re-run at the attestation commit; results recorded in the PR report.

## Boundaries (unchanged by this repair)

- `DEMA_RUNTIME_AWARE = NO`
- `NODE0_OPERATIONALLY_CLOSED = NO`
- `GOVERNED_LIVING_MEMORY = NO`
- `authority_delta: 0`
- Not merged; merging requires a fresh, exact human GO after inspection of the repaired diff and fresh review results.
