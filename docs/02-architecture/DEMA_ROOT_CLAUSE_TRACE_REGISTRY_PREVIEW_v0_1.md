# DEMA-ROOT-CLAUSE-TRACE-REGISTRY-PREVIEW-1A

Truth label: `DEMA_ROOT_CLAUSE_TRACE_REGISTRY_PREVIEW_ONLY`

## Purpose

PREVIEW_ONLY registry of hand-reviewed root clauses + a pure kernel that derives a
content-addressed `root_set_hash` from a selected clause set. It lets the shipped
root-bound consent envelope (DEMA-ROOT-BOUND-CONSENT-ENVELOPE-PREVIEW-1A) bind its
`root_set_hash` to ACTUAL named clauses drawn from the Three-Root Canon instead of
an opaque hash. Records/verifies a clause selection only — no optimizer, no model,
no network, no live mutation, no mint, no identity binding, no live governance.

Core law: **a valid root trace must carry at least one clause from EACH of the
three roots, and every carried clause_hash must match the registry's hash of that
clause's summary — otherwise the trace is BLOCKed.**

## The three roots

```text
MESSAGE     The Message / الرسالة      — human & spiritual root
SEED        The Seed / البذرة          — ethical & economic root
THIRD_FACT  The Third Fact             — public constitutional root
```

The authoritative, sealed root documents live under `docs/root-canon/source/` and
are pinned by `docs/root-canon/root-canon.manifest.json`. The registry summaries
are hand-reviewed **paraphrases** — NOT the authoritative encoding of the roots.

## Registry (`docs/canon/BIZRA_ROOT_CLAUSE_REGISTRY_v0_1.json`)

```text
schema         bizra.canon.root_clause_registry.v0.1
truth_label    PREVIEW_ONLY
required_roots [MESSAGE, SEED, THIRD_FACT]
clauses[]      { clause_id, root, summary, clause_hash }
               clause_hash = sha256 of the canonical summary text
```

12 clauses: MESSAGE (`MSG-DIGNITY-01`, `MSG-MERCY-PEACE-01`, `MSG-EQUALITY-01`,
`MSG-ACCOUNTABILITY-01`, `MSG-IHSAN-01`), SEED (`SEED-CONSENT-01`,
`SEED-HEART-MIND-01`, `SEED-MODERATION-01`, `SEED-NON-EXTRACTION-01`,
`SEED-SOLIDARITY-01`), THIRD_FACT (`TF-HUMAN-MISSION-01`, `TF-PROOF-CONSENT-01`).

## Trace schema

```text
schema           bizra.consent.root_trace.v0.1
truth_label      PREVIEW_ONLY
required_roots   [MESSAGE, SEED, THIRD_FACT]
clauses[]        { clause_id, root, clause_hash }   (sorted; NO raw summary)
root_set_hash    sha256 over the canonical { required_roots, clauses } set
boundary         canonical all-false preview boundary
authority_delta  0
```

`root_set_hash` is the value the consent envelope consumes as its `root_set_hash`.

## Functions

```js
loadClauseRegistry(registryObject)              // validate + normalize an injected registry
buildRootTrace({ clause_ids, registry })        // → content-addressed trace
verifyRootTrace({ trace, registry })            // → fail-closed verdict (alias: evaluateRootTrace)
runRootClauseTracePreview({ registry })         // orchestrator: permit valid, block incomplete
```

The registry is **injected** — the kernel never touches the filesystem. The review
gate and tests read the JSON and pass the parsed object in.

## Verdict contract

```text
schema           bizra.consent.root_trace_eval.v0.1
accepted         boolean
verdict          PERMIT_PREVIEW | BLOCK
reason           first block code, or root_trace_permitted
blocked_by[]     every failed check (deduped)
boundary         canonical all-false preview boundary
authority_delta  0
```

## Fail-closed blocks

`unknown_clause`, `three_root_set_incomplete`, `clause_hash_mismatch`,
`clause_root_mismatch`, `empty_clause_set`, `root_set_hash_missing`,
`root_set_hash_mismatch`, `schema_mismatch`, `boundary_invalid`,
`registry_empty`, `trace_invalid`.

## Boundaries

- Pure kernel; the registry is injected — no `fs`, `net`, `http`,
  `child_process`, `fetch`, no `Date.now`, no `Math.random`.
- Content addressing uses `node:crypto`; the boundary is the canonical all-false
  preview boundary (`packages/core/src/boundary-schema.js`).
- `authority_delta` is 0 in every trace and verdict — deriving/verifying a trace
  grants no authority.

## Does not prove

- The clause summaries do NOT authoritatively encode the roots (the sealed root
  PDFs under `docs/root-canon/` remain canonical).
- No live root-clause enforcement, no live governance, no live mutation.

## Files

```text
packages/consent/src/root-clause-trace-preview.js
docs/canon/BIZRA_ROOT_CLAUSE_REGISTRY_v0_1.json
tests/root-clause-trace-preview.test.js
scripts/review/root-clause-trace-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/DEMA_ROOT_CLAUSE_TRACE_REGISTRY_PREVIEW_1A.md
docs/02-architecture/DEMA_ROOT_CLAUSE_TRACE_REGISTRY_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/root-clause-trace-preview.test.js
node scripts/review/root-clause-trace-preview-check.mjs --json
npm test
npm run check
```
