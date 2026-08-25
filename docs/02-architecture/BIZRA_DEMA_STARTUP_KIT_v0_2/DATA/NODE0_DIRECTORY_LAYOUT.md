# Node0 Desired Logical Directory / Zone Layout

This is a **logical classification model first**, not an instruction to mass-move current files.

```text
/data/bizra/
  00_root/                  immutable/root constitutional anchors
  01_runtime/               Node0 runtime state and identity pointers
  02_missions/              mission envelopes/checkpoints
  03_receipts/              canonical receipts/evidence
  04_memory/                governed L3 memory objects
  05_knowledge/
    raw/                    immutable local source copies
    normalized/             reproducible normalized derivatives
    cards/                  File/Knowledge Cards
    indexes/                rebuildable search/vector/graph indexes
  06_research_genome/       extracted R&D decisions/gems/golden sets
  07_models/                model artifacts/manifests
  08_code/                  Git-managed source repositories/snapshots
  09_imports/               newly arrived/unclassified material
  10_external/
    google_drive/           optional source-bound Drive materializations
  11_quarantine/            malformed/disputed/unsafe/unknown
  12_archive/               superseded retained originals
  tmp/                      ephemeral, never authoritative
```

## Rules

- Root/receipts/runtime state must never be mixed with bulk research imports.
- Build artifacts, caches and vendor directories should be identified as rebuildable/non-knowledge before indexing.
- Git repositories remain Git-governed; do not deduplicate files inside repositories by external deletion.
- Drive mirrors retain Drive identity and version metadata.
- Indexes are disposable derivatives; sources and provenance are not.
