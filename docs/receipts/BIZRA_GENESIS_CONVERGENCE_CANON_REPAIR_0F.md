# Receipt: BIZRA-GENESIS-CONVERGENCE-CANON-REPAIR-0F

- **Truth label:** `DESIGNED_NOT_LIVE / PLANNING_ONLY` — this receipt records a documentation truth-state repair on remote draft PR #385. It does not claim any runtime, economy, federation, autonomy, or merge.
- **Repository promotion state:** `REMOTE_REPAIRED_CANON_CANDIDATE` — repaired on the remote draft; **NOT merged**. Merging requires a fresh, exact human GO issued after the repaired diff and fresh review results are inspected.
- **Authority:** exact card `GO — BIZRA-CANON-REPAIR-0F-ONLY · PR #385` (repair + evidence + fresh review; merge explicitly NOT authorized). This receipt authorizes nothing further; it does not claim its own containing commit SHA (unknowable at authoring time).

## Why the repair exists

The S0 merge card (`BIZRA-CANON-MERGE-0E`) halted at its final merge bind on 2026-07-12: the ready transition triggered bot reviews (Greptile, Copilot, CodeRabbit, Codex) that converged on genuine truth-surface defects — canon text that contradicted its own reference-by-hash law and lifecycle statements phrased as current state after they had become historical. Merging at the reviewed head `ed8ac4c` would have landed self-contradicting canon. Halt receipt: `/data/bizra/logs/S0_BIZRA-CANON-MERGE-0E_HALT_2026-07-12.md` — `OPERATOR_LOCAL_CONTEXT_NOT_REPOSITORY_PORTABLE`: retained as historical operator context only; a GitHub reviewer cannot retrieve it, so it is not remotely reproducible proof.

## Commit lineage

| Role | SHA |
|---|---|
| Source PR | #385 |
| Base (`origin/main`) | `5c9d3111e6abf3c8315ee7e0d3ab21a7be94b4b4` |
| Pre-repair reviewed head | `ed8ac4ce461570e5463dd819fe106f979fda2ff6` |
| Repair-content commit (0F) | `4667cac555231d0217c337916f341cb03868b9dc` |
| Repair-attestation head (0F) | `71b46f18c3d5f8c353255af6a2a0b241ab77e335` |
| Source-tree SHA at the 0F attestation head | `a60198ebd2fdff022244dc350b0062d2f48d567e` |
| SHA-256 of the 0F patch (`git diff ed8ac4c..71b46f1`) | `8c7f1b971bb0e9b9a0a5fa678b6473cc0f329e6144ae4d8a1f84dd7049cc5b7c` |

**Squash-lineage durability:** `4667cac` and `71b46f1` are **source-branch event commits**. After a squash merge they may not become ancestors of `main`; their SHAs record historical source events, not mainline ancestry. If the branch ref is pruned, verification falls back to the durable anchors above (PR number, tree SHA, patch hash) and to the SHA-256 file-content table below, which reproduces against the files as merged. The future squash commit and resulting `main` SHA must be captured by a **separate merge receipt** — they are deliberately not claimed here.

## Repairs applied (repair-content commit, 4 files, +24/−21)

1. **Reference, not copy** — `NODE0_IGNITION_1A_IGNITION_PACK.md` §0 no longer reproduces the posture text; it references the canonical source by path + SHA-256 + truth label, with an explicit rebind-on-amendment rule. (Greptile P1 · Copilot · CodeRabbit Major · Codex)
2. **As-of promotion states** — the posture and both receipts no longer present pre-push lifecycle states (`LOCAL_COMMITTED…`, `REVIEWED_LOCAL…`, "unpushed local branch") as current; they are marked historical with as-of binding, and the current rung is recorded here, not in canon text. (Greptile 2×P2 · Copilot ×3 · Codex)
3. **Enforcement labels registered** — `ENFORCED_AND_MEASURED_VIA_CONSUMER_TESTS` and `ENFORCED_AND_MEASURED_WITHIN_SANDBOX_BOUNDARY` are defined in the legend as scope-qualified (strictly narrower) states; the slash-pair `A / B` convention is defined. (Copilot ×2 · CodeRabbit Major) *(Historical record of the 0F event — superseded by 0G, which removed both variants and normalized every enforcement record to base state + scope + evidence + known gap; no value outside the five base states remains registered.)*
4. **Committed-artifact truth** — "Nothing here is built, run, or committed" corrected: the pack is a committed planning artifact; the *implementation* is unbuilt and not execution-authorized. (Copilot · CodeRabbit Minor)
5. **Evidence honesty** — 0A evidence sources relabeled `UNVERIFIED_CONTEXTUAL_INPUT` (no content addresses preserved); 0B's hash table marked as a historical record of commit `e1a1ea6`. (CodeRabbit Major)
6. **Provisional dependency** — the master roadmap companion is marked `PLANNED_COMPANION_NOT_YET_PRESENT`; T1–T4 references stand on the pack's own definitions until it exists. (CodeRabbit Minor)

No doctrinal clause was added, removed, or weakened. `authority_delta: 0`.

## Post-repair artifact hashes (SHA-256, at repair-content commit `4667cac`)

| File | SHA-256 |
|---|---|
| `docs/canon/BIZRA_CONSTITUTIONAL_POSTURE_ON_TRUTH_SERVICE_AND_CHOICE.md` | `bafe198956720cbe98e6554d225dd8744fdb79683e3e2a903295128a6e216121` |
| `docs/00-product-thesis/NODE0_IGNITION_1A_IGNITION_PACK.md` | `9681205376e61e490777ba522dd8780ffa925b1379c6990b4c7b6a3ceeb681fa` |
| `docs/receipts/BIZRA_GENESIS_CONVERGENCE_CANON_0A.md` | `ec9f93b02a52aeb22a822b7e7f9b88547f56d193ffd56bb59c0bb369a426e7e5` |
| `docs/receipts/BIZRA_GENESIS_CONVERGENCE_CANON_ATTESTATION_0B.md` | `876d90625c567318139222dae474891aecf2b0d7f6b959c1cc821cbed53705fc` |

## Known finding NOT repaired here (out of this card's authority)

- **Docs-index registration** (Codex P2): the new canon/receipt files are not linked from the docs index. Fixing this requires modifying a file outside the four authorized documents, so it is deliberately left open for the merge card (or a follow-up card) to decide.

## What this proves / does not prove

Proves: the canon candidate no longer contradicts its own reference law or lifecycle reality; every repair is bound to a reviewer finding and an exact commit; the promotion rung is recorded outside the doctrine text so canon cannot silently go stale again. Does not prove: merge fitness (fresh CI and reviews on the repaired head decide that), any runtime capability, or Dema runtime-awareness. Nothing merged, nothing published beyond the PR branch, no economy/token/PoI/federation activated. Boundary all-false; `authority_delta: 0`.
