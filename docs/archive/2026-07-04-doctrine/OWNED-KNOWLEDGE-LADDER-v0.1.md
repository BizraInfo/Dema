# OWNED-KNOWLEDGE LADDER — v0.1 (brainstorm capture)
**Deposited:** Saturday 2026-07-04 (GST) · **Sediment target:** `docs/archive/` · **Status:** DOCTRINE DRAFT, pre-GO
**Pain point (product-grade):** unstructured data spread across every local and cloud surface — unmanageable, unprocessable, value invisible. Same pattern as the Absence capability: real pain → capability → users come.

---

## 0 · The two laws this design obeys

**Law 1 — The map is the move, not the territory.** Originals are never relocated, renamed, or "reorganized." Every attempt to physically reorganize before indexing dies at 30% (the Great Reorganization trap). The unified thing is the *index*, not a folder.

**Law 2 — One source of truth = the manifest chain, not a location.** Truth is the census of what exists plus the hashes that identify it. Files stay where life put them; the census makes them one estate.

---

## 1 · The Ladder (his pipeline, hardened)

| L | Name | What happens | Output · truth label | Exit criteria | First slice |
|---|---|---|---|---|---|
| 0 | **PROTECT** | rsync mirror of ~/Downloads to /data2 + full-tree sha256 manifest | `MANIFEST` · MEASURED | mirror verified on distinct device; manifest sealed | operator command (already defined, §8 of SAPE review) |
| 1 | **CENSUS** | Metadata-only walk: path, size, mtime, ext. Plus system census: hardware, OS, packages, apps (≈5 commands). **Zero content reads.** | `census.jsonl` · METADATA_ONLY | counts by type/root known; "who and what lives in my home" answerable | `CENSUS-1A` |
| 2 | **IDENTITY** | Content hash (sha256/BLAKE3) per file → content-addressed identity. Dedupe becomes a *report*, never an action | hash index + duplication report · MEASURED | % duplicate bytes known; **deletions are proposals only** (rung IV, human) | `IDENTITY-1A` |
| 3 | **ATLAS** | Virtual type-tree *view* over hashes (all PDFs, all images, all code...). Originals untouched | atlas map · DERIVED_VIEW | every hash reachable via a type path | `ATLAS-1A` |
| 4 | **EXTRACT** | Per-type derivation to text/features **with derivation receipts**: (source_hash, extractor@version, output_hash). Originals immutable; derived text is re-derivable cache | derived layer · DERIVED_REPLAYABLE | re-running extractor reproduces output_hash | `EXTRACT-pdf-1A` etc. |
| 5 | **GRAPH** | Claims, entities, edges — every edge bound to chunk hashes and an evidence class. Cross-session recurrence = first hyperedge type (the EXCAV heuristic, formalized) | knowledge graph · EVIDENCE_BOUND | no edge exists without a source hash | `GRAPH-1A` |
| 6 | **VERIFY** | Claim receipts → verified knowledge → a Proof-of-Impact event class | verified-claim receipts · MEASURED | census/dedupe/extraction receipts accrue PoI eligibility | `VERIFY-1A` |

**Answering the open fork ("process in original type or convert to text"):** both, layered. L0–L3 never read content. L4 derives text *beside* the original with a receipt naming the extractor version — so when better local models arrive, everything re-derives cheaply and provably. Nothing is ever converted *in place*.

**Answering "knowledge graph or hypergraph RAG":** graph is L5 and earns nothing until L1–L4 are boring and green. Hypergraph is justified naturally: a concept recurring across N sessions is one hyperedge over N sources — recurrence-ranks-value becomes a query.

---

## 2 · Census domains & order

| Domain | Scope | Cost | Consent surface |
|---|---|---|---|
| SYSTEM | hardware, OS, packages, apps (lsblk, dpkg -l, ...) | minutes | local, receipted |
| LOCAL DATA | the /data2 **mirror** first (never the live tree), then /data, /data2, live Downloads | hours (hashing) | local, receipted |
| CLOUD | Google Drive, Gmail (6 accounts), other drives — via connectors, metadata-first | per-source | **one explicit GO per source**; index stored locally only |

---

## 3 · Risks (named now, not discovered later)

1. **The index is more radioactive than any file it lists.** A complete census of a life is a surveillance artifact if it leaks. Census lives under `$DEMA_HOME`, mode 0600; any cloud sync of the *index* is a separate consent gate. Credential-rotation P0 intersects here: index + stolen keys = catastrophe. Rotation precedes cloud census.
2. **Auto-dedupe deletion is forbidden by ladder law.** Identical hashes → report → human-approved proposals. The queue spine's vocabulary already refuses EXECUTING states; dedupe inherits it.
3. **Text-conversion loss.** Images/audio/video flattened to text lose evidence. Derivation receipts + immutable originals are the antidote.
4. **Premature database.** JSONL + hashes until queries demand more. SQLite/vector stores are L4+ decisions.
5. **Model temptation.** No LLM touches content in L0–L3. Models enter at L4, local-first (BUILD-PHASE doctrine), consent-gated.

---

## 4 · The flywheel insight (why this feeds everything)

Indexing your own estate is the **first verifiable contribution any human node can make on day one** — no skill required, pure sovereignty, fully receipted. The census is the genesis quest: *your first verified impact is knowing what you own.* Census → receipts → PoI eligibility → the economy's first honest event class. Product pain relief and economic bootstrapping are the same act.

---

## 5 · Sequencing law (unchanged, with teeth)

```
Backup (operator, L0)
  → INSPECT existing bizra-data-lake corpus modules   ← the export's own correction:
    + merge-review PR #242 (archive-metadata audit,      brownfield before greenfield
      open since Jun 24 — this lane's tooling, 80% built)
  → CENSUS-1A (system, then mirror)
  → IDENTITY-1A (hashes + dup report)
  → one layer per cycle thereafter. WIP=1.
```

Candidate CLI surface when it earns one: `dema census` — "who and what lives in my home."

---

*Capture of the 2026-07-04 brainstorm. Doctrine draft — nothing here is a capability claim; every layer ships only as its own receipted slice.*
