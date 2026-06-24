# Hash-Table Knowledge Index v0.1

Status: live imported kernel, deterministic index only.  
Schema: `bizra.dema.hash_table_knowledge_index.v0.1`.

## Purpose

`HASH-TABLE-KNOWLEDGE-INDEX-1A` turns the V2 hash-table framework from metaphor into a small, replayable kernel. It organizes caller-supplied knowledge entries into six deterministic axes:

```text
component
claim
module
insight
risk
decision
```

The kernel is a local in-memory index over supplied data. It is not a database, crawler, vector store, memory daemon, or autonomous retrieval loop.

## What it does

- Normalizes entries with `id`, `axis`, `key`, `title`, `summary`, `evidence`, `tags`, and `status`.
- Requires at least one evidence anchor for each entry.
- Computes a deterministic `entry_hash` for every normalized entry.
- Builds deterministic buckets by `axis + key`.
- Computes `bucket_hash` and `index_hash` for replayable review.
- Provides `queryHashTableKnowledgeIndex` for local lookup.
- Provides `verifyHashTableKnowledgeIndex` for schema, hash, evidence, duplicate-id, axis, and boundary checks.

## What it does not do

- It does not read or write files.
- It does not call a network.
- It does not invoke a model.
- It does not start a daemon.
- It does not create a persistent database.
- It does not sign, mint, reward, activate PoI, or federate.
- It does not prove semantic truth; it indexes claims and evidence anchors supplied by the caller.

## Boundary

Every index carries an all-false boundary for runtime, file write, model call, network call, self-modification, autonomous loop, signing, key generation, mint, reward/token, PoI, federation, MCP runtime, and A2A runtime.

## Failure posture

The kernel fails closed on:

```text
entries_must_be_array
entry_malformed
axis_unknown
key_required
evidence_required
duplicate_entry_id
index_malformed
schema_mismatch
truth_label_mismatch
axes_mismatch
entry_hash_mismatch
index_hash_mismatch
boundary_not_false
```

## Relationship to HHMM

HHMM models lifecycle transitions. The hash-table index organizes the evidence, claims, risks, and decisions that may later feed lifecycle observations. They are separate kernels: HHMM does not retrieve knowledge, and this index does not transition lifecycle state.

## Ihsan alignment

- No evidence, no entry.
- No silent persistence.
- No semantic truth overclaim.
- No autonomous retrieval claim.
- Boundaries are explicit before use.
