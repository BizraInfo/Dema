# Node0 Data Processing Pipeline

## Stage 0 — Authority and root binding

Record exact root, exclusions, content-read permission, mutation permission, and run identity.

## Stage 1 — Metadata inventory

No content reads. Capture relative path, type, size, mtime, mode, inode/device, symlink target, errors.

Outputs: `inventory.jsonl`, `summary.json`, inventory SHA-256.

## Stage 2 — File Cards

Create deterministic File Cards from metadata. Assign `UNCLASSIFIED` logical zone initially.

## Stage 3 — Dedupe planning

- group by size for `HASH_REQUIRED` candidates;
- content-hash only candidate groups or selected high-value shards;
- byte-identical iff raw SHA-256 matches;
- preserve provenance and aliases.

## Stage 4 — Content refinery

On a bounded authorized shard:

- parse text/document structure;
- normalize reproducibly;
- segment with source spans;
- extract claims/decisions/procedures/failures/benchmarks/open questions;
- attach epistemic status.

## Stage 5 — Knowledge graph planes

Maintain three separate planes:

1. semantic/knowledge relationships;
2. provenance/ISNAD lineage;
3. responsibility/authority/effect relationships where relevant.

## Stage 6 — Decision Graph / Golden Set

Promote verified historical decisions and regression-worthy failures/refusals.

## Stage 7 — Retrieval

Build rebuildable lexical/vector/graph indexes. Retrieve minimum evidence-complete packets for current missions.

## Stage 8 — Organization preview

Propose logical zones, names, merges, archive candidates and duplicate relationships. No mutation yet.

## Stage 9 — Reversible action

Use DEMA reversible file-steward execution only with exact consent. Backup, no-clobber, containment and undo are mandatory.

## Stage 10 — Postcondition verification

Freshly re-inventory affected scope. Verify only intended changes, then seal run receipt.
