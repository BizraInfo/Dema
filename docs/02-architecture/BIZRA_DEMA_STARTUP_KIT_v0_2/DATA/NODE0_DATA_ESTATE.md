# Node0 Data Estate v0.1

**Status:** DESIRED_STATE_MODEL / NO MIGRATION AUTHORITY

## Problem

Node0 owns a multi-year, multi-source R&D corpus spread across local disks, code repositories, Google Drive and historical chat/doc exports. A prior metadata census of `/data/bizra` measured roughly 1.57M files and ~783 GB, so full-content processing in one pass is the wrong first move.

## Strategy

Use progressive evidence:

1. metadata census;
2. deterministic File Cards;
3. logical zoning;
4. duplicate candidate identification;
5. bounded content hashing only where useful;
6. bounded content parsing/extraction;
7. Knowledge Cards and provenance graph;
8. Decision Graph;
9. Golden Set;
10. mission-scoped retrieval;
11. only then consider reversible physical reorganization.

## Preserve-original law

Original source bytes are never destructively “cleaned” as part of ordinary stewardship. Normalized text, summaries, embeddings, cards and indexes are derivatives and must point back to sources.

## Physical migration

Do not move hundreds of thousands of files to make the disk look tidy. First assign logical zones in the catalog. Migrate only bounded high-value shards where the benefit is measurable and undo is proven.
