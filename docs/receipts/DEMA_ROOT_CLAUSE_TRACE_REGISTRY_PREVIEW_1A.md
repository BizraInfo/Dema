# Receipt: DEMA-ROOT-CLAUSE-TRACE-REGISTRY-PREVIEW-1A

Truth label: `DEMA_ROOT_CLAUSE_TRACE_REGISTRY_PREVIEW_ONLY`

## Slice

PREVIEW_ONLY registry of 12 hand-reviewed root clauses drawn from the Three-Root
Canon — The Message / الرسالة, The Seed / البذرة, The Third Fact — plus a pure
kernel that derives a content-addressed `root_set_hash` from a selected clause
set. That `root_set_hash` is the value the already-shipped consent envelope
(DEMA-ROOT-BOUND-CONSENT-ENVELOPE-PREVIEW-1A) consumes as its `root_set_hash`,
so a consent binding can point at named clauses instead of an opaque hash. This
is the next layer above the consent envelope.

```text
load registry (injected JSON) → build trace (content-addressed) → verify (fail-closed)
```

Core law: **a valid root trace must carry at least one clause from EACH of the
three roots, and every carried clause_hash must match the registry's hash of that
clause's summary — otherwise the trace is BLOCKed.**

## Proof Contract

The default gate passes only while every one holds (15 tests + review gate):

- `buildRootTrace({ clause_ids, registry })` emits a content-addressed trace over
  the selected clauses; each carried clause is exactly `{clause_id, root,
  clause_hash}` (`clause_hash` derived from the registry summary, never the raw
  summary text); identical input yields a deep-equal trace and identical
  `root_set_hash`; selection order does not change the hash (canonical, sorted);
- **fail-closed verification** (`verifyRootTrace({ trace, registry })`) returns
  `accepted:false` / verdict `BLOCK` for each of: a `clause_id` not present in the
  registry (`unknown_clause`); a selection that does NOT include at least one
  clause from each of the three roots (`three_root_set_incomplete`); a clause whose
  `clause_hash` differs from the registry's hash of that summary
  (`clause_hash_mismatch`); an empty clause set (`empty_clause_set`); a recomputed
  `root_set_hash` that differs from the carried one (`root_set_hash_mismatch`);
- a valid selection covering all three roots returns `accepted:true` / verdict
  `PERMIT_PREVIEW` with a stable `root_set_hash`;
- the trace carries only clause ids, roots, and hashes — no raw root-document
  text and no secret material;
- every trace and verdict carries `authority_delta: 0` and the canonical all-false
  boundary (deep-equal against `buildPreviewBoundary()`, not a vacuous `.every`).

## Registry

`docs/canon/BIZRA_ROOT_CLAUSE_REGISTRY_v0_1.json` — a PREVIEW mapping of
`clause_id` → hand-reviewed one-sentence summary → `clause_hash` (sha256 of that
summary). The 12 summaries are human paraphrases used to make a consent
`root_set_hash` traceable to named clauses. They are **NOT** the authoritative
encoding of the roots and **NOT** the hash of the root PDFs. The authoritative,
sealed root documents live under `docs/root-canon/source/` and are pinned by
`docs/root-canon/root-canon.manifest.json`.

## Does NOT prove

- Does not prove the clause summaries **authoritatively encode the roots**: the
  sealed root PDFs under `docs/root-canon/` with their own manifest remain
  canonical; this registry is a hand-reviewed paraphrase layer.
- Does not prove **live root-clause enforcement**, **live governance**, or any
  **live mutation**: this records and verifies a clause selection only.
- Does not run an optimizer, invoke a model, open a network, mint a token, start a
  daemon, or bind identity; the registry is injected (no fs in the kernel);
  boundary all-false, `authority_delta` 0.

`npm run check` runs `root-clause-trace-preview-check.mjs`.

## Commands

```bash
node --test tests/root-clause-trace-preview.test.js
node scripts/review/root-clause-trace-preview-check.mjs --json
npm run check
```
