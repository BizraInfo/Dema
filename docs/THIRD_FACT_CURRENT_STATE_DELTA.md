# Third Fact · Current-State Delta Register v0.1

> **Purpose:** Compare every load-bearing claim in `BIZRA_Third_Fact_v0_1_FINAL.pdf` (canonical markdown at [`docs/public/third-fact-v0.1.md`](public/third-fact-v0.1.md)) against the **current measurable state of this repository**. Each row gives a truth label, an evidence path, the risk if overstated, and the next verification action.
>
> **Why this register exists:** The Third Fact doctrine is powerful and load-bearing for every external BIZRA narrative — investor pitch, customer pilot, Ring-1 expansion, regulatory engagement, press contact. Some claims in that document are measurable today (Verified Refusal Pattern, local proof cockpit, μ-layer self-critique). Others are explicitly direction-only (mesh, federation, token economy, Proof-of-Impact, global impact projections). Without a per-claim truth label, external use of the doctrine risks overclaim drift — the exact failure mode the Third Fact itself forbids (Pillar 02 Humility · Pillar 03 Proof · ADR-005 consent).
>
> **What this register is not:** It is not new doctrine. It does not change the Third Fact text. It does not introduce new performance, economic, mesh, token, or global-impact claims. It is a controlled engineering governance artifact that classifies what each Third Fact claim *means* against the disk truth of this repo.
>
> **Scope:** This register tracks the 14 load-bearing claim families surfaced in the Third Fact (TF-001 through TF-014). It does not enumerate every sentence in the document — only the claims that bind external usage.
>
> **Last verified:** 2026-05-24 ~15:55 GST against `main @ 158f04f`.

---

## Truth label legend

The 7 labels are the canonical classification set for this register. They map onto (but extend) the 4-label set used in `docs/CURRENT_LIMITS.md`.

| Label | Definition | When applicable |
|---|---|---|
| **MEASURED** | Verifiable from the local code or a captured artifact at the cited path. Re-running the cited check today produces the same result. | The strongest available claim. Reserve for what disk truth can prove. |
| **PARTIAL** | Some surfaces of the claim are MEASURED; others are DESIGNED_NOT_LIVE or PLANNED. The claim cannot be promoted to MEASURED without further work that the next-verification column names. | Hybrid surfaces (e.g., MC-A bridge: JS side shipped, Python operator-side). |
| **DERIVED** | The claim is a discipline applied by the operator and inherited via documentation (CLAUDE.md anchors, doctrine memory, ADRs) rather than enforced by a runtime check. Real but not mechanically verifiable. | Ethical / constitutional anchors that bind operator behavior without code-level enforcement. |
| **PLANNED** | Design intent only. No code, no spec on disk yet. The roadmap row exists; the artifact does not. | Future work that has a clear name but no current substrate. |
| **ASPIRATIONAL** | Direction statement only. Projection of where the system *could* go after multiple proof gates beyond the current stage. Not a commitment, not a roadmap line. | Forest-stage descriptions, global-impact projections, civilization-scale framing. |
| **DESIGNED_NOT_LIVE** | Spec / schema / ADR exists. Runtime does not. Documented design intent with proof on disk that design work happened, but no execution. | Mesh, federation, PoI, public token economy — the items the Third Fact text itself explicitly marks as not-live. |
| **BLOCKED** | A specific halt-gate is enforced in code or doctrine, and execution is forbidden until the gate clears. | doctor-exits-1, activation gate BLOCKED, push to main without GO. |

---

## The Delta Table

| ID | Third Fact claim | Truth label | Current repo evidence | Risk if overstated | Next verification action |
|---|---|---|---|---|---|
| **TF-001** | Operating laws: *State before screen · Contract before runtime · Consent before capability · Evidence before trust · MoMo before mesh* | **MEASURED** (as applied discipline) + **DERIVED** (as canon) | [`CLAUDE.md`](../CLAUDE.md) (user-scope operator discipline · halt-gates) · [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) · [`docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md`](06-adr/ADR-005-operator-actions-require-explicit-consent.md) · [`docs/RELEASE_PROCESS.md`](RELEASE_PROCESS.md) §8 (halt-gates) | Treating the laws as runtime-enforced when they are operator-discipline-enforced. Reviewer asks "where in the code is this checked?" and gets no answer. | Author a doctrine-to-code map showing which laws have runtime gates (e.g., FATE exact-string consent) vs which are operator-discipline (e.g., halt before push to main). |
| **TF-002** | Dema is a working local proof cockpit · 60+ subcommands · stdlib-only · receipts read/list | **MEASURED** | [`docs/QUICKSTART.md`](QUICKSTART.md) (verified verbatim run) · 2618/2618 tests PASS · [`docs/TESTING.md`](TESTING.md) (135 KB) · `package.json` zero prod-deps · `packages/receipts/src/receipt-store.js` (read/list only, no mint) | Claiming the cockpit does more than show / list / preview — e.g., implying it mints receipts or invokes remote models. | Run the QUICKSTART commands monthly against the latest `main`; diff output against the canonical capture. |
| **TF-003** | Truth label matrix is in use across BIZRA artifacts | **MEASURED** (4-label set live · 7-label set used here) | [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) (MEASURED/DESIGNED_NOT_LIVE/PLANNED/LOCAL_ONLY) · [`docs/GTM_READINESS_MATRIX.md`](GTM_READINESS_MATRIX.md) (COMPLETE/PARTIAL/DRAFT/MISSING/OPERATOR-SIDE) · [`docs/CLAIM_REGISTER_v0_1.md`](CLAIM_REGISTER_v0_1.md) | Using a single label without naming the matrix it belongs to. "Claim X is verified" with no link to the artifact that classifies it. | Consolidate label sets across CURRENT_LIMITS, GTM_READINESS_MATRIX, and this register into a single canonical labels page; ensure each external artifact cites the matrix it uses. |
| **TF-004** | Verified Refusal Pattern · Dema refuses unsafe state, names the gap, prints the fix | **MEASURED** ★ (strongest measured product behavior) | `node bin/dema doctor` exits 1 on fresh DEMA_HOME and prints row-by-row fix hints (verified in this session, captured in [`docs/QUICKSTART.md`](QUICKSTART.md)) · μ-K1 self-critique harness (`~/.dema/bin/mu-test-all`, 15 PASS in pre-push) · ADR-005 exact-string consent gate (`packages/fate/src/fate.js`) · halt-gates enforced in CLAUDE.md · refusal-as-product N=2 memory (SMI spec fired its own discipline twice) | Calling this "AI safety" or "compliance." It is a product property — Dema refuses cleanly and tells you why — not a regulatory check. | None — this is already MEASURED and is the centerpiece of any external demo. Keep it. Promote it. |
| **TF-005** | MC-A memory bridge — `dema memory query` accesses BIZRA Omega AgentDB | **PARTIAL** | [`apps/cli/src/index.js`](../apps/cli/src/index.js) (memory query subcommand · landed PR #109 / commit `99ee45f` 2026-05-24) · 11 dedicated tests · operator-side Python wrapper at `~/.dema/bin/agent-db-query` (per ADR-022 doctrine; substrate stays out of repo) · graceful skip when python3 unavailable | Claiming "memory query works" without disclosing the operator-side wrapper requirement. A fresh-clone user cannot use this without setup outside the repo. | Author a `MEMORY_BRIDGE_OPERATOR_SETUP.md` documenting the wrapper install + `BIZRA_OMEGA_ROOT` env var; until then, every external mention of MC-A must qualify with "requires operator-side wrapper." |
| **TF-006** | EvidenceChain · receipts are tamper-evident, hash-chained, replayable | **PARTIAL** | ARTIFACT-011 receipt at `~/.dema/receipts/artifact-011.json` (issued by governed gateway 2026-05-06 · chain length 8 · admissibility verdict `Permit`) · `packages/receipts/src/receipt-store.js` (symlink-aware containment, max-files + max-bytes caps) · **NO mint surface in this repo** — minting is upstream gateway responsibility (ADR-006) · ADR-007 chain-mutation policy Accepted; A/B/C selection deferred | Claiming Dema mints receipts. It does not. It reads / lists. The mint surface lives in `bizra-omega` (per ADR-003) and is invoked by the governed gateway, not by Dema. | Per RELEASE_PROCESS §6 and ADR-007: select A/B/C resolution option for concurrent producers; until then every external receipt-chain claim must cite the session-scoped qualifier. |
| **TF-007** | C0-C5 micro-consent ladder · exact-string consent for every binding action | **PARTIAL** | μ-C1 enforcer (14/14 PASS in pre-push) · μ-C1 consent CLI (14/14 PASS) · ADR-005 exact-string consent canon · `packages/fate/src/fate.js` strict `===` byte match (fail-closed · 16 tests) · operator-side consent log at `~/.dema/lint/consent_grants.ndjson` · ladder mapping (C0..C5 per action class) not fully externalized | Implying the full C0-C5 ladder is documented + enforced. The exact-string consent gate IS enforced; the C0-C5 nomenclature mapping is partial. | Author `docs/CONSENT_AND_MICRO_CONSENT_POLICY.md` (GTM matrix row #18, currently MISSING) — explicit per-action mapping C0..C5 with μ-C1 enforcer cross-references. |
| **TF-008** | PAT-7 / SAT-5 / FATE — Personal/System agentic teams behind constitutional gate | **PARTIAL** | FATE: MEASURED — `packages/fate/src/fate.js` is the constitutional boundary gate; integrated with consent gate · SAT pipeline preview: PR #90 `orchestrator-verify v0.1` shipped SAT-1..5 CLI surface (per [`docs/ROADMAP.md`](ROADMAP.md) line 59) · PAT-7 full runtime: PLANNED · BIZRA Review Gate workflow references PAT/SAT in branch classes ([`docs/CI_CD_PIPELINE.md`](CI_CD_PIPELINE.md) §3) | Claiming "7 PAT agents and 5 SAT agents live and serving" when only FATE + SAT pipeline preview ship. The Third Fact text already qualifies these as "design"; external use must inherit that qualifier. | Author `docs/PAT_SAT_BOUNDARY.md` (GTM matrix row #8, currently MISSING) with concrete examples per surface; promote SAT-1..5 from preview to MEASURED via at least one end-to-end SAT capsule (ADR-021 candidate per ROADMAP §222). |
| **TF-009** | Ihsan gates · excellence as minimum, not aspiration | **DERIVED** | [`CLAUDE.md`](../CLAUDE.md) Islamic/ethical anchors block ("Ihsan · excellence as minimum") · [`docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md`](06-adr/ADR-005-operator-actions-require-explicit-consent.md) consequences (Daughter Test) · constitutional anchors memory · Pillar 04 الإحسان in Third Fact §IV | Claiming Ihsan is checked by code. It is a discipline anchored in operator-side review (Daughter Test) and CLAUDE.md, applied per-decision; no runtime predicate evaluates "is this Ihsan?" | None — DERIVED is the honest label. Do not over-engineer; do not under-state. Reviewer should be told "Ihsan is operator-discipline + Daughter Test, applied per-action, not a runtime predicate." |
| **TF-010** | HHMM four-tier operator audit model (SAPE / PoT / HHMM state) | **DERIVED** | Memory: `feedback_user_audit_register.md` (SAPE + PoT + HHMM state model) · referenced in [`docs/HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md`](HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md) · used in operator session framing (this session's `/SS` and `/SO` invocations) | Promoting HHMM to "runtime audit framework." It is operator-side audit discipline applied during sessions; there is no per-event HHMM runtime check. | If HHMM is to move from DERIVED → MEASURED, author an ADR specifying the runtime checks and a μ-block harness equivalent to μ-K1; until then it stays DERIVED. |
| **TF-011** | Ijtihad arbitration — disagreement resolution discipline | **PLANNED** | Third Fact §VI mentions "When assumption is unavoidable, we assume with Ihsan" · Law of Assumption canon-of-canons memory · No code, no spec on disk for an Ijtihad arbitration runtime | Treating "Ijtihad arbitration" as anything more than a design intent. The Third Fact text does not enumerate a runtime; this register must not invent one. | Decide first whether Ijtihad is a runtime concept (multi-agent disagreement resolution) or an operator-discipline concept (Law of Assumption + Daughter Test). Author the corresponding ADR before any external use. |
| **TF-012** | Mesh / node federation · Node1 and beyond | **DESIGNED_NOT_LIVE** | [`docs/02-architecture/dema-a2a-message-envelope-v0.1.md`](02-architecture/dema-a2a-message-envelope-v0.1.md) (envelope schema) · [`docs/ROADMAP.md`](ROADMAP.md) §205 federation parking-lot entry ("Why parked: Typed handshake; federation receipt is L5 by definition. Distant.") · [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) explicitly: "Nodes are synchronized → status today: DESIGNED_NOT_LIVE" · Third Fact §IX TREE stage labeled "Direction Only" · `NODE0_STATUS_PUBLIC_TRUTH_LABEL: NO FEDERATION CLAIM` | Any claim of "BIZRA mesh is live" or "nodes are synchronized." Third Fact text itself forbids this; Layer 1 artifact-safety scanner enforces it as a regression gate (per CURRENT_LIMITS.md "Hard non-claims"). | Federation requires typed-GO `GO author dema federation handshake v0.1 spec, no runtime` (per ROADMAP §207). No runtime push allowed before that GO. |
| **TF-013** | PoI · Proof-of-Impact ledger · economic reward logic | **DESIGNED_NOT_LIVE** | [`docs/06-adr/ADR-009-poi-proof-of-impact-design.md`](06-adr/ADR-009-poi-proof-of-impact-design.md) (Accepted 2026-05-19 via typed-GO · pre-implementation specification · **scaffold-only ship**) · [`docs/02-architecture/dema-urp-resource-offer-v0.1.md`](02-architecture/dema-urp-resource-offer-v0.1.md) · `NODE0_STATUS_PUBLIC_TRUTH_LABEL: NO PUBLIC ECONOMIC CLAIM` · Third Fact §VII: "This public draft makes no token, payout, income, IMP, or live economic claim." | Any claim of token, payout, income, IMP, or live economic activity. The Third Fact forbids it; CURRENT_LIMITS.md "Hard non-claims" enforces it; Layer 1 scanner is the regression gate. | ADR-009 is scaffold-only by accepted design. Promotion to MEASURED requires a separate ADR + runtime + at least one end-to-end PoI receipt minted by the governed gateway. No external economic claim allowed before then. |
| **TF-014** | Global impact projections — FOREST stage · civilization-scale framing | **ASPIRATIONAL** | Third Fact §IX FOREST stage explicitly labeled "Direction Only" · §X: "If BIZRA reaches the sky, it will not be because I built it alone" · No quantitative impact claim on disk for any year beyond present | Quoting Third Fact §X aspirational language as committed roadmap. Investor or press treating "infinite potential per seed" as forecast. | None — ASPIRATIONAL is the honest label. Aspirational language is permitted IF every external use carries the label inline. Strip aspirational claims from any artifact that requires MEASURED-only language (CURRENT_LIMITS, GTM matrix, AUDIT reports). |

---

## Highest-confidence MEASURED claims (promote these)

For any external demo, investor pitch, or Ring-1 conversation, lead with what is genuinely MEASURED. Promote freely; the disk truth backs every word.

1. **TF-004 Verified Refusal Pattern** ★ — Dema refuses unsafe state, names the gap, prints the fix. `doctor exits 1` on a fresh machine is the proof. This is the strongest single product behavior in the system today.
2. **TF-002 Local proof cockpit** — 60+ subcommands, 2618/2618 tests, stdlib-only, runs offline, isolates state under `~/.dema/`.
3. **TF-003 Truth label matrix** — every claim in CURRENT_LIMITS, GTM matrix, and this register is classified; no claim ships unclassified.
4. **TF-007 (partial) — exact-string consent gate** — `packages/fate/src/fate.js` enforces byte-match consent, fail-closed, 16 dedicated tests.

These four together compose the **defensible BIZRA story for 2026**: a system that refuses cleanly, runs locally, ships honest labels, and gates every binding action behind exact consent.

---

## Things explicitly NOT live

The Third Fact text itself names what is not live. External BIZRA artifacts must inherit those qualifiers. The 5 items below are the hard non-claims (also enforced by Layer 1 artifact-safety scanner per [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) "Hard non-claims" section):

| Item | Status | Where to find the parking row |
|---|---|---|
| Mesh / node federation | DESIGNED_NOT_LIVE | `docs/ROADMAP.md` §205 |
| Token economy | DESIGNED_NOT_LIVE / ASPIRATIONAL | `docs/CURRENT_LIMITS.md` "Hard non-claims" |
| Proof-of-Impact runtime | DESIGNED_NOT_LIVE | `docs/06-adr/ADR-009-poi-proof-of-impact-design.md` (scaffold-only) |
| URP shared / economic lane | DESIGNED_NOT_LIVE | `docs/CURRENT_LIMITS.md` (URP shared runtime is not live) |
| Global impact projections | ASPIRATIONAL | Third Fact §IX FOREST stage |

Every external mention of any item above must carry its label inline. The Third Fact text models this discipline correctly — extending it to derivative artifacts is the operator's responsibility.

---

## How to use this register

**For external use of the Third Fact:**
1. Read the relevant TF-XXX row before quoting any Third Fact claim externally.
2. Inherit the truth label in your communication. A "MEASURED" claim can be promoted; a "DESIGNED_NOT_LIVE" claim must be qualified.
3. Cite the evidence path the row lists, not the Third Fact text alone.

**For new doctrine work:**
1. Before adding a new TF row, verify it has a primary-source citation in the Third Fact text.
2. Before assigning **MEASURED**, point to a re-runnable check or a captured artifact at a disk path.
3. Before assigning **DERIVED**, ensure the discipline is named in CLAUDE.md, an ADR, or a constitutional-anchor memory entry.

**For audits:**
- Re-run this register against the current `main` head at least monthly.
- Update the **Last verified** line and `main @ <sha>` reference on every refresh.
- A MEASURED row that no longer passes its check is a regression — diagnose before continuing.

---

## Related artifacts

- [`docs/public/third-fact-v0.1.md`](public/third-fact-v0.1.md) — the canonical Third Fact text (markdown form of `BIZRA_Third_Fact_v0_1_FINAL.pdf`)
- [`docs/CURRENT_LIMITS.md`](CURRENT_LIMITS.md) — labeled-truth boundaries; companion truth-matrix
- [`docs/GTM_READINESS_MATRIX.md`](GTM_READINESS_MATRIX.md) — 25-doc GTM readiness; this register supports the GTM trust spine
- [`docs/QUICKSTART.md`](QUICKSTART.md) — first-run flow (verifies TF-002 + TF-004)
- [`docs/RELEASE_PROCESS.md`](RELEASE_PROCESS.md) — release discipline (encodes TF-001 halt-gates)
- [`docs/CI_CD_PIPELINE.md`](CI_CD_PIPELINE.md) — CI gate chain (encodes TF-001 evidence-before-trust)
- [`docs/06-adr/INDEX.md`](06-adr/INDEX.md) — ADR map (links per-TF ADRs)
- [`docs/TESTING.md`](TESTING.md) — test surface (proves TF-002 + TF-004 + TF-007)
- [`docs/CLAIM_REGISTER_v0_1.md`](CLAIM_REGISTER_v0_1.md) — related claim discipline artifact

---

## Update protocol

Re-refresh this register when:
- A TF-XXX claim's truth label changes (e.g., PARTIAL → MEASURED after a slice lands).
- A new Third Fact revision is published (this register is bound to v0.1; a v0.2 register would supersede it).
- A new ADR lands that materially shifts a row (e.g., ADR-009 promotion would move TF-013 from DESIGNED_NOT_LIVE).
- Quarterly cold review.
- Pre-GTM action (investor meeting, customer pitch, Ring-1 expansion, press contact, regulatory engagement).

Update the **Last verified** line and the `main @ <sha>` reference on every refresh. Add new TF rows only with primary-source citation from the Third Fact text.

---

## Honesty boundary

This register classifies what is true *today* about claims in the Third Fact. It does not weaken those claims; it grounds them. A doctrine cannot bind an ecosystem if its claims drift past disk truth — the Third Fact itself names this failure mode (Pillar 02 Humility · Pillar 03 Proof · §VI Proof-not-Assumption).

The goal of this register is the same as the goal of the Third Fact: **proof, not persuasion.**
