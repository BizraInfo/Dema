# Node0 Data Estate Contract

## Purpose

Organize Node0 as a sovereign evidence estate without forcing immediate physical migration.

## Desired logical zones

| Zone | Purpose | Mutation posture |
|---|---|---|
| `00_root` | immutable constitutional/genesis anchors | no ordinary writes |
| `01_runtime` | Node0 runtime state, identity pointers, checkpoints | governed runtime only |
| `02_missions` | mission envelopes, state, recovery checkpoints | mission authority only |
| `03_receipts` | canonical receipts and verification evidence | append/seal |
| `04_memory` | governed L3 memory objects | derived from verified state |
| `05_knowledge/raw` | immutable source material / local mirrors | preserve original |
| `05_knowledge/normalized` | normalized derivatives | reproducible derivative |
| `05_knowledge/cards` | File Cards, Knowledge Cards, claims | derived, versioned |
| `05_knowledge/indexes` | search/vector/graph indexes | rebuildable |
| `06_research_genome` | R&D extraction, decision graph, golden sets | promotion-gated |
| `07_models` | local model artifacts and manifests | supply-chain governed |
| `08_code` | repositories and source snapshots | Git governs canon |
| `09_imports` | newly arrived/unclassified material | quarantine-first |
| `10_external/google_drive` | optional local materializations from Drive | source-bound cache |
| `11_quarantine` | malformed, disputed, unknown, unsafe inputs | no promotion |
| `12_archive` | superseded but retained originals | append/retention |
| `tmp` | ephemeral working data | never authoritative |

Physical directories may differ. Maintain a logical `zone` field in File Cards until migration is separately authorized.

## Atomic File Card

A File Card should include at minimum:

- `file_id` — content-addressed or deterministic local identity;
- `source_system` and `source_id`;
- `root_id` and relative path;
- object type, bytes, mtime, mode;
- symlink status;
- SHA-256 when content hashing is authorized;
- logical zone;
- provenance parents;
- duplicate/supersession relationships;
- content-read status;
- truth/admissibility status;
- last verification time;
- receipt references.

## Deduplication law

1. Same name: weak hint only.
2. Same size: candidate only.
3. Same normalized text hash: derivative equivalence candidate.
4. Same raw SHA-256: byte-identical.
5. Never delete all aliases: preserve provenance and at least one immutable source instance.

## Migration law

Catalog first. Preview second. Reversible move/rename third. Destructive cleanup is a separate future contract.
