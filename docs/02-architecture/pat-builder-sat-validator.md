# PAT-Builder / SAT-Validator Doctrine — v0.1

**Status:** doctrine, layered above [A4.5 Dema Autonomy Envelope](dema-autonomy-envelope.md). Truth label: **DECLARED**.

**Bound by:** [BIZRA Topology Canon](../canon/BIZRA_TOPOLOGY_CANON.md), [ADR-001](../06-adr/ADR-001-dema-is-one-face.md), [ADR-003](../06-adr/ADR-003-core-truth-lives-in-bizra-omega.md), [ADR-005](../06-adr/ADR-005-operator-actions-require-explicit-consent.md), the A4.5 envelope, and the repo invariants in [CLAUDE.md](../../CLAUDE.md).

**One-line summary:** PAT + Dema build. SAT validates. The operator sees Dema. **Even the operator cannot bypass SAT.**

> **PAT may build. Dema may face the user. SAT validates. FATE gates. Receipts witness. No actor, including the founder, bypasses the law.**

## Why this exists (and why now)

The Autonomy Envelope (A4.5, merged as PR #11) named *what* Dema may do at L0–L5. This doc names *which side of the BIZRA topology handles each level* and codifies the constitutional separation between local PAT authority and shared-URP SAT authority.

The Pi Verifier Agent ([ABSORPTION_NOTES_v2.md](../ABSORPTION_NOTES_v2.md)) gave Dema the doctrine-as-template pattern (V1) and the CONFIDENCE ladder (V2). But that reference project has no constitutional layer above persona — its own author can edit the persona file and silently weaken the rules. **PAT/SAT separation IS the constitutional layer the verifier-agent lacks.**

The need is now: SEED has just closed via ARTIFACT-011 (chain length > 0; gateway POST `/missions` returned PERMIT; local handoff receipt mirrored to `~/.dema/receipts/artifact-011.json`). SPROUT begins. The "operator cannot bypass system law, including me" invariant must be on disk *before* SPROUT's continuous bounded diagnostics start producing receipts that depend on it.

## The architecture: local PAT, shared-URP SAT

Per [BIZRA Topology Canon](../canon/BIZRA_TOPOLOGY_CANON.md), the authoritative sentence is:

> Each human node mints PAT-7 locally on their device and SAT-5 into one shared Universal Resource Pool. PAT serves the human. SAT serves the system. The membrane sits between them.

Earlier component lists that place PAT, SAT, DEMA, FATE, URP, RECEIPTS, and POI "inside" one node are historical shorthand. For topology decisions in this repo, the Topology Canon wins: PAT-7 is local per human, while each node contributes SAT-5 into the one shared URP.

The PAT-builder / SAT-validator separation is therefore a **membrane-mediated** separation of authority. PAT (with Dema as the visible bridge) builds and proposes locally; SAT validates and certifies from the shared URP side; the operator only sees Dema. SAT's verdict is mandatory for any L4+ act, and the operator cannot bypass it.

## The two sides

| Side | Role | Members | Visible to operator? | Authority |
|---|---|---|---|---|
| **PAT + Dema** | Builder | 7 PAT agents (`bizra-omega/bizra-agent/src/roster.rs:128`, `PAT_SIZE: usize = 7`) + Dema bridge | Yes — only Dema is surfaced | Proposes, executes reversible work, drafts |
| **SAT in shared URP** | Validator | 5 SAT agents per node contribution (S1 Validator, S2 Oracle [FROZEN], S3 Mediator, S4 Archivist, S5 Sentinel) live in the one shared URP | No — Dema does not surface SAT | Certifies. Cannot be bypassed. |

The Forge/Crown pattern at `SYSTEM_INSTRUCTION_CHAIN.md:189-194` (P3 Forge ≡ Builder; P5 Crown ≡ Verifier) is the existing pre-figuration of this split. PAT/SAT generalizes it to system-wide separation across the local node membrane and shared URP.

## The PAT/SAT × A4.5 level matrix

| A4.5 Level | PAT-Builder action | SAT-Validator action | Receipt? |
|---|---|---|---|
| **L0** Observe | PAT/Dema reads | SAT silent (read does not require certification) | No |
| **L1** Remember | PAT/Dema writes `~/.dema/` | SAT silent (local memory is builder-scoped) | No |
| **L2** Propose | PAT/Dema generates proposal (`executes:false`) | SAT silent (proposals are data, not acts) | The proposal IS the artifact |
| **L3** Reversible local | PAT/Dema edits/commits on feature branch | SAT silent (reversible, undoable) | Optional |
| **L4** Governed mutation | PAT/Dema submits via governed gateway boundary (`packages/node-adapter/src/gateway-http-adapter.js`) | **SAT in the shared URP runs admissibility chain** (`bizra-omega/bizra-cognition/src/admissibility_freeze_v1.rs`) — Ihsān ≥0.95, Adl, Guardian, Confidence ≥0.80; emits `GateVerdict::PERMIT` | **Required.** No PERMIT → no L4 receipt. |
| **L5** Irreversible | PAT/Dema prepares the act (push, PR, stamp, sign) | **SAT certifies + cross-references** the external commitment | Required + external ref |

The matrix's mechanic: **L4 is the constitutional crossing.** Below L4, PAT acts alone. At L4 and above, SAT must certify or no receipt is born.

## The Lamport framing

Cite `bizra-omega/bizra-agent/src/runtime.rs:6` (R1 = "chain is truth, graph is derived state"). The receipt chain implements Lamport-style happens-before: each receipt carries `prev_hash`; the chain enforces a total order over the system's history (Genesis → Entry1 → Entry2 …). Tampered chains fail `continuity_verification` (`receipts.rs:369`).

In Lamport terms: **an event has not "happened" in the system until it appears on the hash-chained receipt log.** PAT proposes (L2/L3 artifacts) → SAT validates (admissibility chain returns PERMIT) → chain appends (L4 receipt with `prev_hash`). Until that append, the act is unwitnessed and therefore *did not occur for the system*.

Contrast with the verifier-agent (per [ABSORPTION_NOTES_v2.md](../ABSORPTION_NOTES_v2.md) V1–V6): its `CONFIDENCE: VERIFIED` is a *report*, not a certification — the build proceeds either way. SAT's `PERMIT` is a *certification* — without it, no receipt, no system-recognized event. **This is the constitutional layer above persona that the verifier-agent does not have.**

## The "sovereign-bypass" anti-pattern

This extends [A4.5 §"Anti-patterns explicitly forbidden"](dema-autonomy-envelope.md) (which lists patterns 1–5). Add as **anti-pattern 6**:

> **Sovereign-bypass.** No actor — PAT agent, Dema bridge, gateway, or operator — may issue an L4+ receipt without SAT certification. Operator typing the consent phrase satisfies *gating* (per ADR-005); it does NOT satisfy *certification*. The two are independent: consent authorizes the *attempt*; SAT decides whether the *attempt* is admissible. An L4 receipt absent a SAT verdict is malformed and MUST be rejected by the chain reader. The receipt schema SHOULD carry a `sat_verdict` field with values from `GateVerdict` (`PERMIT` / `REJECT` / `REVIEW` / `SCORE_ONLY`); only `PERMIT` permits `truth_label: MEASURED` for the receipt.

This is the operator's own stated invariant codified: *"we will not accept any exception about system law, including me."*

## V1–V6 mapping (verifier-agent absorbed patterns → PAT/SAT positions)

| Pattern | Lives on | How |
|---|---|---|
| V1 doctrine-as-template | PAT side (Dema persona; future verifier sibling persona) | Builder agents have prompt templates; SAT does not — SAT is a chain of typed gates, not a persona |
| V2 CONFIDENCE ladder | PAT report shape | Builder emits CONFIDENCE; SAT emits GateVerdict — different vocabularies, both required |
| V3 unverifiable[] gaps | PAT receipt payload | Builder records what it could not verify; SAT records what it would not certify |
| V4 decomposition discipline | PAT side (CLAIM_MUST_BIND extended) | Builder breaks claims atomic; SAT certifies atom-by-atom |
| V5 three-layer bash defense | PAT side (L0 enforcement on Dema + verifier sibling) | SAT does not run bash — it consumes payloads |
| V6 max_loops escalation | PAT-side persona constant | After N corrective cycles without SAT PERMIT → escalate to operator |

**Conclusion: all six absorbed patterns live on the PAT side. SAT is a separate axis the verifier-agent did not have.**

## Receipt-chain shape (DECLARED, not MEASURED)

Three-step lifecycle:

1. **PAT proposes** → L2 proposal artifact (e.g. `dema mission propose`, `apps/cli/src/index.js`); `executes: false`.
2. **SAT validates** → admissibility chain (`bizra-omega/bizra-cognition/src/admissibility_freeze_v1.rs`, `AdmissibilityChain` fail-closed pipeline) returns `GateVerdict`.
3. **Chain appends** → L4 receipt to `~/.dema/receipts/` viewable via `dema receipts` (`packages/receipts/src/receipt-store.js`); receipt SHOULD include `sat_verdict`, `proposal_hash`, `consent_phrase_hash`, `prev_hash`.

**`sat_verdict` field status: DECLARED only.** No schema implementation in this doc's PR. Future receipt readers fall back to "absent → REVIEW required" until the field is wired through the receipt schema in `packages/receipts/`.

### FATE gate roles disambiguated

Today's docs occasionally conflate two distinct FATE gates. This doc draws the line:

- **Dema-side FATE** (`packages/fate/src/fate.js`) = **consent gate**. Operator authorization (exact-string phrase). Authorizes the *attempt* at L4.
- **Rust-side FATE** (4-gate chain: Ihsān ≥0.95, Adl, Guardian, Confidence ≥0.80) = **SAT's substrate**. Certifies the *admissibility* of the attempt at L4.

These are NOT the same gate. Consent and certification are independent. Both required.

## Where today's code sits

| Surface | Side | Notes |
|---|---|---|
| Dema CLI commands (`apps/cli/src/index.js`) | PAT-Builder | All L0–L2; one L4-gating surface (`mission propose`) |
| Gateway HTTP adapter (`packages/node-adapter/src/gateway-http-adapter.js`) | PAT-Builder transport | GET-only; submission path is upstream |
| `packages/fate/src/fate.js` | PAT-Builder consent gate | Authorizes the *attempt* at L4 |
| `~/.dema/memory/a5-niyyah.json` | PAT-Builder L1 declared intent | Operator's typed niyyah; L1 until SAT certifies its carrying receipt at L4 |
| `bizra-omega/bizra-cognition/src/admissibility_freeze_v1.rs` | SAT substrate (lives upstream) | Certifies admissibility at L4 |
| **SAT-5 Rust roster (S1–S5 structs)** | **GAP** — DECLARED in the [BIZRA Topology Canon](../canon/BIZRA_TOPOLOGY_CANON.md), not MEASURED | Follow-up for `bizra-data-lake`, NOT Dema scope |

Every Dema CLI surface today is **L0–L2**. ARTIFACT-011 was the first L4 act (issued via gateway POST /missions Path A; chain length 8). L4 lives upstream of this repo per CLAUDE.md invariant #1.

## The SAT-5 roster gap

PAT-7 has a Rust roster (`PAT_SIZE: usize = 7` at `bizra-omega/bizra-agent/src/roster.rs:128`). SAT-5 does not yet have an equivalent struct. This doc DECLARES the architecture; the Rust-side instantiation of SAT as a live roster is a `bizra-data-lake` concern, out of Dema scope.

| Artifact | Truth label |
|---|---|
| This doctrine doc | **DECLARED** |
| PAT-7 Rust roster | MEASURED |
| SAT-5 Rust roster | **PLANNED** (bizra-data-lake-scoped) |
| `sat_verdict` receipt field | **DECLARED** (no implementation in this PR) |

## How to confirm this doc landed cleanly

After this doc commits:

```bash
cd /home/bizra-operating-system/Downloads/Dema

# Exactly one new file under docs/02-architecture/, zero other modifications
git status -sb
git diff --stat HEAD~1   # 1 file changed

# Tests still pass (doc-only, no code surface change)
npm test

# CLI smoke gate still green
npm run check

# Manual link audit — every file:line citation resolves on disk
grep -nE 'roster\.rs:128|admissibility_freeze_v1|runtime\.rs:6|TOPOLOGY_CANON\.md|SYSTEM_INSTRUCTION_CHAIN\.md' \
  docs/02-architecture/pat-builder-sat-validator.md
# Confirm each cited path resolves under /data/bizra/repos/bizra-data-lake/
```

A4.5 compliance check: anti-pattern 6 (sovereign-bypass) is ADDITIVE only — it does not contradict A4.5's anti-patterns 1–5. Read both side-by-side to verify.

## Versioning

This document is v0.1.

- **Tightening edits** (more restrictive PAT/SAT separation, narrower L4 admissibility, additional forbidden patterns) → standard PR review.
- **Loosening edits** (e.g., allowing L4 receipt without `sat_verdict`, weakening sovereign-bypass) → require operator typed GO + new ADR. The "no exception, including the founder" invariant is itself unconditional in v0.1; if it ever needs an exception, that exception requires its own constitutional act.

## Cross-references

- [`docs/02-architecture/dema-autonomy-envelope.md`](dema-autonomy-envelope.md) — A4.5 levels
- [`docs/02-architecture/gateway-http-adapter.md`](gateway-http-adapter.md) — Dema's L4 transport (PR #10)
- [`docs/06-adr/ADR-001-dema-is-one-face.md`](../06-adr/ADR-001-dema-is-one-face.md) through [ADR-005](../06-adr/ADR-005-operator-actions-require-explicit-consent.md)
- [`docs/ABSORPTION_NOTES_v2.md`](../ABSORPTION_NOTES_v2.md) — V1–V6 source patterns
- [`docs/00-product-thesis/dema-one-face.md`](../00-product-thesis/dema-one-face.md)
- [`BIZRA_Third_Fact_v0_1_FINAL.pdf`](../../BIZRA_Third_Fact_v0_1_FINAL.pdf) — operator's constitutional source (§III, §VI, §IX, §X)
- Upstream (bizra-data-lake):
  - `bizra-omega/bizra-agent/src/roster.rs:128` (PAT_SIZE)
  - `bizra-omega/bizra-cognition/src/admissibility_freeze_v1.rs` (admissibility chain + GateVerdict)
  - `bizra-omega/bizra-agent/src/runtime.rs:6` (R1: chain is truth)
  - [`docs/canon/BIZRA_TOPOLOGY_CANON.md`](../canon/BIZRA_TOPOLOGY_CANON.md) (SAT-5 declaration)
  - `SYSTEM_INSTRUCTION_CHAIN.md:189-194` (Forge/Crown ≡ P3/P5 pre-figuration)

## Provenance note

This doc originated as the plan written to `~/.claude/plans/unified-finding-lamport.md` during a plan-mode session on 2026-05-06. The operator correctly noted that constitutional project memory does not belong in tooling state — it belongs in the repo where auditors can see it. This file is the migration. The original plan-file may be deleted or kept as a session artifact at the operator's discretion; the canonical doctrine lives here.
