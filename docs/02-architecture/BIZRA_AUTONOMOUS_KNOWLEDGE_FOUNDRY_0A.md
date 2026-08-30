# BIZRA Autonomous Knowledge Foundry 0A

**Status:** `COMPONENT_SPECIFICATION_ONLY` (gated on TASK-075 production closure)
**Backlog:** DRAFT-001
**Truth label:** `NODE0_LOCAL_SEED`
**Purpose:** Name a *future*, source-grounded extraction pipeline that turns one approved BIZRA source-root observation into an evidence-weighted, replayable knowledge subgraph — *without* the model-as-authority failure mode the Z.ai analysis correctly flags.

This document creates no source registry kernel, no extraction swarm, no verifier ensemble, no graph index, no retriever, no model call, no runtime, no receipt, no mint, no PoI, no federation. It is a specification, not an instruction to operate.

## 0. Authority chain (read first)

The foundry is bounded by three pre-existing authorities; this spec does not redefine them.

| Authority | Source | Role in AKF |
| --- | --- | --- |
| Source-root authority | `TASK-075.18` / `docs/02-architecture/NODE0_GENESIS_ESTATE_REFINERY_0A.md` + `scripts/verify-root-canon.mjs` + `docs/root-canon/root-canon.manifest.json` | Defines the 4 bounded schemas (asset / claim / receipt-shaped evidence / approved source-root) the foundry reuses. `ROOT_CANON_VERIFIED` is the only state that admits a foundry run; `ROOT_CANON_DRIFT_LOCKED` and `ROOT_CANON_UNKNOWN` are `HOLD`. |
| Knowledge-index kernel | `HASH-TABLE-KNOWLEDGE-INDEX-1A` / `docs/02-architecture/HASH_TABLE_KNOWLEDGE_INDEX_v0_1.md` | Already proves replay, hash-chained buckets, and all-false boundary. The foundry's 6-axis index (component / claim / module / insight / risk / decision) maps to this kernel directly. |
| Proof-of-truth convergence | `PROOF-CONVERGENCE-PREVIEW` / `packages/core/src/proof-convergence-preview.js` | 4-rail scoring (Formal / Cryptographic / Empirical / Economic) for every promoted claim; no claim enters canonical knowledge below the gate. |

Any future kernel the foundry adds must hash-bind to the source root through the above three authorities. The foundry does **not** mint its own authority.

## 1. The two founding invariants

These distinguish BIZRA AKF from a generic graph-RAG. Removing either collapses the spec to ordinary model-output-as-knowledge.

```text
INV-1 · EVIDENCE_BEFORE_CLAIM
  No claim enters the canonical graph because an LLM asserted it.
  It enters only when ALL of the following hold:
    (a) a source produced an evidence-shaped record (TASK-075.18 schema #3),
    (b) one or more extraction agents transformed the record (with their own audit hash),
    (c) an independent verifier ensemble (separate from creators) accepted the transform,
    (d) provenance survived the transformation (source_ref + source_sha256 round-trip),
    (e) the resulting subgraph state is replayable from disk.

INV-2 · COMPLETION_IS_REPLAYABLE_STATE
  Completion is determined by the 9-condition conjunction below.
  A write-shaped claim alone never satisfies completion.
  It is the conjunction of the 9-condition law:
    source_grounded
    AND schema_valid
    AND provenance_complete
    AND entity_resolution_passed
    AND contradiction_status_known
    AND graph_integrity_passed
    AND retrieval_eval_passed
    AND answer_citation_eval_passed
    AND checkpoint_sealed
```

Any future kernel that treats language-model output as sufficient to enter the canonical graph — bypassing the verifier ensemble — fails the red-first static test in §6. This is the same laundering-resistant envelope that `PEAK-EVIDENCE-BINDING-1A` already enforces upstream in the peak-self-loop preview.

## 2. The 6-layer pipeline (architecture, not implementation)

Each layer is a pure kernel with an all-false canonical boundary (no runtime, no model, no network, no file write, no autonomous loop, no signing, no mint, no federation). Layers compose; no layer owns mutation authority.

```text
SOURCE REGISTRY          (reuses TASK-075.18 asset / source-root schemas)
       │ content-addressed append-only
       ▼
NORMALIZE / PARSE        (deterministic byte-shape normalizer; emits provenance_token)
       │
       ▼
SEMANTIC SEGMENTATION    (boundary detection only; no LLM call → deterministic sentence / paragraph / section splitter)
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│  AGENTIC EXTRACTION SWARM                                   │
│                                                              │
│   Entity Extractor         Claim Extractor                  │
│   Relation Extractor       Event Extractor                  │
│   Temporal Resolver        Ontology Mapper                  │
│   Entity Resolver          Contradiction Hunter             │
│   Provenance Agent                                          │
│                                                              │
│   Each agent emits an audit hash over its input + output.  │
│   The swarm is creator-side.                                │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
                CANDIDATE KNOWLEDGE
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  VERIFIER ENSEMBLE  (independent of creators)               │
│                                                              │
│   Schema-validity verifier   Provenance-roundtrip verifier  │
│   Contradiction verifier     Replay verifier                │
│   Source-binding verifier    Citation-verifiability gate    │
│                                                              │
│   Reject → repair loop (bounded iterations, fails closed)   │
│   Accept → promotion to canonical graph                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
                   CANONICAL GRAPH
              (graph + vector + lexical indexes)
                           │
                           ▼
                AGENTIC RETRIEVER
              (graph traversal · semantic · neighborhood
               · provenance path · temporal filter
               · contradiction search)
                           │
                           ▼
                       RAG ANSWER
                  (answer + evidence citations)
```

**Invariant guard (every layer):** the canonical 16-key boundary is all-false (runtime, file write, model call, network call, self-modification, autonomous loop, signing, key generation, mint, token/reward, PoI, federation, MCP runtime, A2A runtime, prompt execution, external call). The boundary is re-derivable in `verify()`, not stored as prose.

## 3. Pre-activation references (DO NOT IMPLEMENT UNTIL UNBLOCKED)

The following Dema primitives already exist and are the **only** allowed sources of authority for AKF:

- `packages/core/src/peak-self-loop-preview.js` — ultra-micro compose; refuse `action_executed_by_kernel`
- `packages/core/src/self-loop-ooda.js` — OODA bounded review; 5/5 phases required, ACT must not execute
- `packages/core/src/rsi-proposal-preview.js` — RSI gate; rejects autopoietic / live-loop / token / signing terms
- `packages/core/src/self-awareness-report.js` — `claims_consciousness: false`; EVIDENCED / BLIND_SPOT / NOT_KNOWN classification
- `packages/core/src/dema-trace-diagnostic-contract.js` — 4-rail trace diagnostic moat; `INSIGHT_AUTHORIZED` only on all 4 rails pass
- `packages/core/src/craftsmanship-witness-preview.js` — Master Craftsmanship invariant gate
- `docs/02-architecture/SAT_ROLE_BOUNDARY.md` — creator/verifier separation; read-only invariant on SAT
- `docs/02-architecture/NODE0_GENESIS_ESTATE_REFINERY_0A.md` — source-registry primitive (TASK-075.18)
- `docs/02-architecture/HASH_TABLE_KNOWLEDGE_INDEX_v0_1.md` — replayable 6-axis index kernel
- `docs/receipts/DEMA_TRACE_DIAGNOSTIC_CONTRACT_1A.md` — 4-rail admissibility gate semantics

A future AKF kernel that does **not** hash-bind to one of these is, by construction, out of scope.

## 4. Adoption table (Z.ai patterns → Dema primitives)

The Z.ai reverse-engineering analysis is a useful adoption list, **with** the launder-resistance correction. This table records what to adopt, what to skip, and what to actively avoid.

| Z.ai observation | Dema primitive that already covers it | Adopt / Skip / Avoid |
| --- | --- | --- |
| Persistent workspace plane (files, worklog, tool-results) | `dema` CLI + `DEMA_HOME` + `dema stand chain` (day-N-of-7 verifier) + `dema stand` (one bounded morning card) | **Adopt** — reuses existing receipts, no new surface |
| Subagent decomposition with creator/verifier split | `packages/core/src/self-loop-ooda.js` (5-phase review) + `docs/02-architecture/SAT_ROLE_BOUNDARY.md` (read-only SAT invariant) | **Adopt** — but enforce the read-only invariant kernel-side, not by convention |
| `worklog.md` as episodic memory | `dema stand` daily cards + `dema poi compression record` (time-compression candidate) + `dema stand chain` (re-verify on disk) | **Adopt** — but every entry must hash to a receipt, not just describe one |
| Git checkpoints (UUID-named commits) | Existing `git diff --check` + `npm run check` exit code + `dema stand chain` consecutive-UTC-day verifier | **Adopt** — but the checkpoint must include a manifest hash, not only a commit SHA |
| Browser / VLM verifier | `dema harness --summary` (read-only gate composition) — does **not** yet include a VLM verifier surface | **Skip for 0A** — record as a known future kernel in §5 |
| `PerformanceTelemetry` reflexive instrumentation | `DEMA-TRACE-DIAGNOSTIC-CONTRACT-1A` 4-rail trace diagnostic moat | **Adopt** — reuse the moat's own `verified.ok` + `promotion_status === "INSIGHT_AUTHORIZED"` as the reflexive gate |
| `typescript: { ignoreBuildErrors: true }` | n/a (Dema is stdlib-only Node.js test runner) | **Avoid** — Dema's policy is fail-closed on type/build errors; do not relax |
| `reactStrictMode: false` | n/a (Dema is not a React app) | **Avoid** — Dema kernels do not bypass their own invariants for ergonomics |
| Caddy `?XTransformPort=` exposure primitive | n/a (Dema has no reverse-proxy with arbitrary-port rebinding) | **Avoid** — never introduce allowlist-orphaned port re-routing |
| `db/custom.db` baked into deployment | Dema receipts are append-only under `DEMA_HOME`; no DB bake-in | **Avoid** — keep receipts in their directory, never in the deployment artifact |
| `worklog = descriptive proof` | `dema stand chain` re-verifies every receipt on disk (mechanical proof) | **Avoid** — Dema must keep prose-claiming-verification and mechanical-verification in separate surfaces |

## 5. Known limits (deferred to a future spec, NOT to 0A)

- **No LLM invocation in 0A.** All 6 layers are deterministic + agentic-harness shells; the actual extraction agents are future slices. The 0A spec only names the *shape* of their output (entity/relation/claim/event/temporal/ontology/contradiction/provenance records with audit hashes).
- **No browser/VLM verifier in 0A.** A future slice may add it; until then, retrieval quality is gated by `retrieval_eval_passed` and `answer_citation_eval_passed` from operator-supplied goldens.
- **No production runtime.** DRAFT-001 is gated on `TASK-075` (NODE0-DEMA-PRODUCTION-CLOSURE-1A) and explicitly on the sovereign custody ceremony; AKF does not promote to "To Do" before either is complete.
- **No federation, no token, no PoI.** The boundary is all-false. A future spec that names any of these must re-derive the boundary, not extend it.

## 6. Red-first static test (TDD anchor)

`tests/bizra-autonomous-knowledge-foundry-0a-spec.test.js` (DRAFT — not yet committed):

```javascript
// Pseudocode only. The actual test imports the spec text and asserts the
// launder-resistance invariants on its content.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(here, "../docs/02-architecture/BIZRA_AUTONOMOUS_KNOWLEDGE_FOUNDRY_0A.md");
const spec = readFileSync(specPath, "utf8");

```javascript
// Pseudocode sketch (the real test lives at
// tests/bizra-autonomous-knowledge-foundry-0a-spec.test.js and
// applies the same laundering-resistant envelope used by
// DEMA-TRACE-DIAGNOSTIC-CONTRACT-1A). The spec is the contract;
// the real test file is the verifier. Pseudocode in this section
// is a documentation aid only and contains no executable operational
// instruction.
```

The real red-first test file at `tests/bizra-autonomous-knowledge-foundry-0a-spec.test.js` applies the same laundering-resistant envelope that `DEMA-TRACE-DIAGNOSTIC-CONTRACT-1A` already uses upstream. The AKF spec is the contract; the test file is the verifier.

## 7. Definition of Done (0A only — does NOT extend the spec)

The 0A spec is complete when **all** of the following are true and **none** of the following have happened:

**Done:**
- [ ] This spec file is committed at `docs/02-architecture/BIZRA_AUTONOMOUS_KNOWLEDGE_FOUNDRY_0A.md`
- [ ] The red-first static test file exists at `tests/bizra-autonomous-knowledge-foundry-0a-spec.test.js` and passes
- [ ] `docs/CURRENT_LIMITS.md` records AKF-0A as a **specification** with a pointer to DRAFT-001
- [ ] DRAFT-001 stays in **Draft** status (not promoted to "To Do" until TASK-075 closes)
- [ ] `npm test` and `npm run check` and `npm run llm:guidance` and `git diff --check` all pass with the new files

**Not done (must NOT have happened):**
- [ ] NO source-registry kernel implementation
- [ ] NO extraction swarm implementation
- [ ] NO verifier ensemble implementation
- [ ] NO graph index implementation
- [ ] NO retriever implementation
- [ ] NO model invocation, network call, runtime activation
- [ ] NO mint, PoI, federation, MCP, A2A runtime
- [ ] NO scope drift into TASK-075

**Deferred (future specs, NOT 0A):**
- LLM-backed extraction agents (with audit hash + independent verifier)
- Browser / VLM verifier surface
- Multi-source federation
- Token / PoI / economic activation
- AKF runtime that crosses the 16-key boundary (would require sovereign custody + production closure + a separate ADR)

## 8. What this proves / does not prove

**Proves:**
- The pipeline shape is named in writing, with the launder-resistance invariants on the spec text itself
- The adoption list of Z.ai patterns is recorded with explicit avoid-list (no silent copying)
- The spec is hash-bound to the three pre-existing authorities (Root Canon, hash-table index, trace-diagnostic moat)
- The completion law is the 9-condition replayable-state law, not a write-shaped claim

**Does not prove:**
- That any extraction agent works
- That any source-grounded graph exists
- That the foundry is live
- That the foundry may be promoted to "To Do" before TASK-075 closes
- That the foundry may execute under any circumstances before the sovereign custody ceremony
- That any future extraction agent is itself authorized to populate the canonical graph without going through the verifier ensemble

## 9. References (in-repo, read-only)

- `backlog/drafts/draft-001 - BIZRA-AKF-0A-...md` — backlog anchor
- `docs/02-architecture/NODE0_GENESIS_ESTATE_REFINERY_0A.md` — source-root primitive (TASK-075.18)
- `docs/02-architecture/HASH_TABLE_KNOWLEDGE_INDEX_v0_1.md` — replayable index kernel
- `docs/02-architecture/SAT_ROLE_BOUNDARY.md` — creator/verifier separation
- `docs/receipts/DEMA_TRACE_DIAGNOSTIC_CONTRACT_1A.md` — 4-rail trace diagnostic moat
- `packages/core/src/peak-self-loop-preview.js` — ultra-micro compose
- `packages/core/src/self-loop-ooda.js` — OODA bounded review
- `packages/core/src/rsi-proposal-preview.js` — RSI proposal gate
- `packages/core/src/self-awareness-report.js` — EVIDENCED/BLIND_SPOT/NOT_KNOWN taxonomy
- `packages/core/src/craftsmanship-witness-preview.js` — Master Craftsmanship gate
- `docs/CURRENT_LIMITS.md` — framework kernels table; must record AKF-0A as spec-only

## 10. Boundary statement (canonical, all-false)

```text
runtime_execution_performed     false
file_write_performed            false
model_invocation_performed      false
network_call_performed          false
self_modification_performed     false
autonomous_loop_started         false
signing_performed               false
key_generation_performed        false
mint_performed                  false
token_or_reward_activated       false
poi_activation_performed        false
federation_started              false
mcp_runtime_started             false
a2a_runtime_started             false
prompt_executed                 false
external_call_performed         false

authority_delta                 0
```

This is re-derivable from the boundary schema; it is not stored as prose. The boundary is a structural property of the spec, not a promise.
