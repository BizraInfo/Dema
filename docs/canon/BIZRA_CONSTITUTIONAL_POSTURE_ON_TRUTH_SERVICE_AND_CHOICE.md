# BIZRA Constitutional Posture on Truth, Service and Choice

- **Document status:** `DECLARED_CONSTITUTIONAL_CANDIDATE` — declared by the founder as constitutional doctrine.
- **Truth class:** `CONSTITUTIONAL_DECLARATION` — chosen by the human sovereign; not presented as an empirical measurement; binding on the system once validly adopted; open to challenge and correction; amendable **only** through explicit constitutional consent; never silently altered by a model, agent, or implementation detail. It does not claim that any runtime, economy, federation, or autonomy is live.
- **Repository promotion state:** `LOCAL_COMMITTED_CANON_CANDIDATE` — committed on an unpushed local branch. It is **not** `REMOTE_DRAFT_CANON_CANDIDATE`, `MERGED_REPOSITORY_CANON`, `DEMA_RUNTIME_AWARE`, or `GOVERNED_LIVING_MEMORY`. Human declaration and repository promotion are distinct concepts: the doctrine is *declared*; its repository status is *not yet merged canon*.
- **Canonical source, not a copy.** This document is the authoritative constitutional text. Subordinate documents (the master roadmap, ignition packs, product docs) **reference** it by path + content hash + truth label — they must not reproduce it as an independently editable copy. *One doctrine body, many references — never several editable copies.*
- **Companion:** `docs/00-product-thesis/NODE0_IGNITION_1A_IGNITION_PACK.md` (the Genesis Convergence program that operationalizes this posture); receipt `docs/receipts/BIZRA_GENESIS_CONVERGENCE_CANON_0A.md`. The master roadmap companion (`docs/00-product-thesis/BIZRA_MASTER_ROADMAP_v0_1.md`) is `PLANNED_COMPANION_NOT_YET_PRESENT`.
- **Amendments:** 2026-07-12 — ratified three additions: **Exit Materiality**, the **Conflict-of-Interest & Reward Law**, and per-clause **Enforcement Status** labels (declaration is distinguished from enforcement).

---

## The posture

BIZRA exists to **expand humanity's field of dignified choices — not to decide one compulsory truth for all humanity.**

Node0 does not claim infallibility. It makes an explicit, sincere choice about what its founders and participants believe is just, beneficial, and true, and it accepts the possibility of being wrong — with peace in the heart and mind while the evidence continues to unfold.

Node0's constitutional choice favors:

- consent over coercion;
- evidence over unsupported assumption;
- verified contribution over manufactured value;
- fairness over extraction;
- shared opportunity over concentrated control;
- non-riba alternatives over systems structurally dependent on interest-bearing debt;
- peaceful correction over defensive certainty.

BIZRA does not fight Web2, Web3, debt-based economics, or centralized systems by becoming another system that imposes one answer. Its purpose is to create a credible, voluntary **alternative** — ownership instead of extraction, consent instead of silent control, verified contribution instead of speculative value, shared access instead of artificial exclusion, cooperation instead of permanent debt dependency, evidence instead of assumption, peaceful choice instead of ideological coercion.

Every human retains the right to enter, decline, inspect, challenge, contribute, leave, or choose another system. **A sovereign ecosystem must even protect the freedom not to choose BIZRA.** The purpose is not to replace one monopoly of choice with another; it is to create space where more humane choices can exist.

## Exit materiality

> **The right to leave includes leaving with what is yours.** A participant's keys, private data, portable mission history, and independently verifiable receipts remain under that participant's control and must be exportable **without requiring BIZRA's continued permission or presence.** Exit must not be punished through loss of identity, evidence, earned history, or access to one's own records.

*(Enforcement status: `CONSTITUTIONAL_DECLARATION / DESIGNED_NOT_LIVE`. Promotion to enforced requires an independently tested export-and-verification fixture — a third party must be able to verify the exported records without BIZRA present.)*

## The ten invariants

1. Every strong claim must remain challengeable.
2. Every important action must preserve evidence.
3. Every verifier must be independent from the work it judges.
4. Uncertainty must be declared rather than hidden.
5. Disagreement must not be treated as disloyalty.
6. No model majority constitutes truth.
7. No node, founder, agent, or institution is above verification.
8. Failure must never widen authority.
9. Participation must remain voluntary.
10. Every human retains the right to choose another path.

## The law of separation

> **PAT works for the human. SAT protects the truth of the work. FATE protects the human's choice. URP protects fairness of access. BIZRA serves humanity by offering a voluntary, evidence-bearing alternative — while remaining humble enough to be corrected.**

- **PAT** performs bounded useful work and contributes. PAT operates the mission.
- **SAT** challenges, verifies, and confirms admissibility and eligibility. **SAT judges; SAT does not operate the mission, control the object it judges, reward itself, or manufacture truth.** SAT serves BIZRA's *integrity*, and through that integrity BIZRA serves humanity.
- **FATE** preserves sovereign consent — the human is the only consent behind the gate.
- **URP** allocates resources under transparent rules.
- **The human** remains sovereign over promotion and authority.

## On contribution and eligibility

Recognition or reward may become **eligible** only through: contribution → evidence → PAT receipt → independent SAT challenge → verified support → constitutional rules → human-governed distribution.

SAT may confirm that the work happened, that the claimed outcome is supported, that consent was preserved, that no fabricated impact exists, that no hidden debt or riba mechanism is present, that no manipulation or authority expansion occurred, and that a contribution is eligible for recognition.

SAT must never manufacture impact, reward itself, control the treasury it audits, change the rules during judgment, convert uncertainty into certainty, or treat agreement among models as proof. At Node0 v0.1 the economic rules remain dormant; any candidacy score is advisory and inert, and promotion into canon requires FATE plus explicit human consent.

### Conflict-of-interest & reward law

Four authorities are separated; **no party may complete the whole chain alone:**

1. **PAT** produces the contribution.
2. **SAT** confirms admissibility and reward *eligibility*.
3. **Constitutional economic rules** calculate an eligible *range*.
4. A **separately governed distribution mechanism** executes allocation.

> **No party may unilaterally govern the distribution of a reward it is eligible to receive. No participant may simultaneously (1) produce a contribution, (2) verify it, (3) determine its reward, and (4) execute its distribution. At minimum, the verification and distribution authorities must be independent from the beneficiary.**

**SAT does not mint, hold, or distribute the reward it judges.** This generalizes beyond the founder — it prevents future capture by any agent, validator, council, or treasury operator. The **founder no-mint oath** is classified `DECLARED_OATH` until a separate evidence record establishes its duration and technical enforcement.

## Independence, stated precisely

Independent verification is **mandatory**; model-family diversity is **preferred and recorded**, but is not by itself sufficient. Independence requires: separate execution identity · the candidate immutable · independent evidence gathering from source · deterministic re-derivation and tests where possible · no candidate mutation · no shared mutable scratch state · a separately sealed verdict. A verifier that disagrees convincingly can still be wrong — deterministic re-derivation and empirical tests outrank model voting.

## Enforcement status — declaration is not enforcement

A declared commitment is not a working control. Every clause carries one of these states, and none may be labeled enforced until tests prove it:

- `CONSTITUTIONAL_DECLARATION` — chosen and binding, no code enforcement yet.
- `DECLARED_AND_PARTIALLY_ENFORCED` — declaration with partial architectural support.
- `ENFORCED_IN_PREVIEW_CODE` — a preview kernel enforces it (not yet a live-runtime measure).
- `ENFORCED_AND_MEASURED` — enforced and measured on disk.
- `DESIGNED_NOT_LIVE` — designed, not implemented/live.

`ENFORCED_IN_CODE(path)` may be cited **only** where the named implementation enforces the *complete* clause.

| Clause | Honest current state |
|---|---|
| Exact-string consent (FATE), no fuzzy consent | `ENFORCED_AND_MEASURED_VIA_CONSUMER_TESTS` — `packages/fate/src/fate.js`, exercised via `tests/node0-mumu-loop.test.js` + `tests/status.test.js`; **remaining test gap:** no dedicated `tests/fate.test.js` |
| Fail-closed SAT verdict; SAT judgments inert | `ENFORCED_IN_PREVIEW_CODE` — `packages/core/src/sat5-constitutional-verifier-set-preview.js` |
| Mint / unverified-impact / cost-as-value tripwires | `ENFORCED_IN_PREVIEW_CODE` — sat5 preview |
| SAT grants no authority (`authority_delta: 0`) | `ENFORCED_IN_PREVIEW_CODE` — sat5 preview |
| Reversible action + proven undo (backup-anchored) | `ENFORCED_AND_MEASURED_WITHIN_SANDBOX_BOUNDARY` — `node0-reversible-execute-gate.js` (15 tests: real execute + proven byte-restore + measured before/after/state hashes, inode containment). **Limitation:** proven only inside a caller-supplied sandbox; valuable operator data and general filesystem authority are **NOT** proven. |
| "No agent may self-verify" | `CONSTITUTIONAL_DECLARATION` (partial architectural support; no live runner enforces it) |
| "A different model family must verify PAT" | `DESIGNED_NOT_LIVE` (no runner enforces routing yet) |
| Live SAT agent separation (gather-and-test real results) | `DESIGNED_NOT_LIVE` (sat5 judges *declared* facts today) |
| Exit materiality (export keys/data/history/receipts) | `CONSTITUTIONAL_DECLARATION / DESIGNED_NOT_LIVE` (no export-verification fixture yet) |
| Conflict-of-interest reward-chain separation | `CONSTITUTIONAL_DECLARATION` (economy dormant; nothing distributes) |
| Founder no-mint oath | `DECLARED_OATH` (until independently evidenced + technically enforced) |
| Living Dema runtime memory (user-bonded companion) | `DESIGNED_NOT_LIVE` (built by the Genesis Convergence campaign, gated) |

Do not label model-family independence, material exit, live SAT separation, reward distribution, or living Dema memory as enforced until tests prove them.

---

*We make our choice sincerely, preserve the evidence, invite the challenge, and keep peace with the possibility of being corrected.*
