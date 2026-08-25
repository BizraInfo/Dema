# Google Knowledge System — BIZRA/Node0 v0.1

**Truth label:** PROPOSED_DESIGN_SPECIFICATION  
**Authority delta:** 0  
**Default Drive posture:** READ_ONLY

## Objective

Turn Google Drive from a pile of historical files into a provenance-preserving external knowledge plane for Node0 without making Drive, folder names, search results, or generated summaries authoritative.

The system must support the existing multi-year BIZRA research corpus, including duplicate versions and long chat/history artifacts, while preserving original source identity.

## Architecture

```text
Google Drive
    |
    v
Source Discovery
(file ID, title, MIME, modified time, parents)
    |
    v
Source Manifest / ISNAD binding
    |
    +--> optional bounded materialization --> raw SHA-256
    |
    v
Parser / Normalizer
    |
    v
Segments + source spans
    |
    v
Knowledge Objects
(claims, decisions, procedures, failures, receipts, questions)
    |
    v
Verification / contradiction graph
    |
    +--> Decision Graph
    +--> Golden Set
    +--> Knowledge Cards
    |
    v
Mission-scoped retrieval
    |
    v
DEMA working context
```

## Source identity contract

Every Drive-derived source record must retain:

- `drive_file_id`;
- title;
- MIME type;
- created/modified timestamps if available;
- source reference/URL;
- parent/folder references if useful;
- discovery time;
- local materialization path if copied;
- raw byte SHA-256 when materialized;
- parser/normalizer revision;
- derived object IDs;
- supersession/duplicate relationships.

A changed Drive object creates a **new source version**. Never silently replace an earlier version in Node0 lineage.

## Knowledge object types

- Claim Card
- Decision / ADR Candidate
- Architecture Invariant
- Procedure / Know-How
- Failure / Negative Control
- Benchmark Observation
- Receipt / Evidence Reference
- Open Question
- Golden Gem Candidate

Each object carries source refs, epistemic status, verification path, contradiction links, and currentness.

## Three-year corpus refinery

```text
Raw chat/doc
  -> source-bound segment
  -> claim/decision candidate
  -> evidence reconciliation
  -> Decision Graph node
  -> implementation/outcome link
  -> Golden Set regression case
  -> mission retrieval
```

### Decision Graph node

Bind:

- decision ID and date/version;
- problem/mission;
- alternatives considered;
- chosen path;
- rationale;
- evidence;
- implementation consequence;
- later contradiction/supersession;
- current status;
- current verification path.

### Golden Set case

Bind:

- context/input;
- expected invariant/outcome;
- forbidden false-green outcome;
- evidence anchor;
- reproducer/test if available;
- status and last verification date.

## Duplicate handling

Drive contains historical duplicates and near-duplicates. Treat:

- same title: weak candidate;
- same size: weak candidate;
- same materialized raw SHA-256: byte-identical;
- same normalized content hash: derivative-equivalence candidate;
- semantically similar summaries: not duplicates without provenance reconciliation.

Never delete Drive originals merely because a local duplicate relation exists.

## Retrieval law

Rank by:

1. Root/constitutional relevance;
2. current mission identity;
3. evidence quality;
4. currentness/recency;
5. decision leverage;
6. semantic relevance.

Load the minimum evidence-complete packet; do not inject the whole corpus.

## Writeback law

Local indexing does not grant Drive mutation authority. Create/update/move/delete on Drive requires an explicit separate authorization and postcondition verification.
