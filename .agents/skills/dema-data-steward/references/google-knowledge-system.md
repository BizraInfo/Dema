# Google Knowledge System — Node0 Intake Contract

## Role

Treat Google Drive as an external source plane and collaboration/archive surface. It is not Node0 authoritative memory, and folder position is not truth.

## Intake state machine

`DISCOVERED -> SOURCE_BOUND -> MATERIALIZED(optional) -> HASHED -> PARSED -> SEGMENTED -> CLAIM_EXTRACTED -> VERIFIED/BOUNDED -> INDEXED -> SERVED`

Alternative terminal/holding states: `UNKNOWN`, `DISPUTED`, `CONTRADICTED`, `SUPERSEDED`, `QUARANTINED`.

## Source identity

Every Drive item must retain:

- Drive file ID;
- title;
- MIME type;
- created/modified timestamps when available;
- source reference/URL;
- parent/folder identity when relevant;
- discovery timestamp;
- local materialization path if copied;
- raw SHA-256 of materialized bytes;
- parser/normalizer revision;
- derived object IDs.

If the Drive item changes after discovery, do not silently overwrite lineage. Create a new source version and link it with `supersedes` / `superseded_by`.

## Knowledge objects

Derive small, independently attributable objects rather than one giant summary:

- claims;
- decisions / ADR candidates;
- architectural invariants;
- procedures/know-how;
- failures and negative controls;
- benchmark results;
- receipts/evidence references;
- unresolved questions;
- reusable golden gems.

Each object retains source spans/references and epistemic status.

## Three-year history refinery

For historical BIZRA chats/docs, prefer this promotion path:

`Raw source -> Decision candidate -> Evidence reconciliation -> Decision Graph -> Golden Set case -> mission retrieval`

A Decision Graph node should bind: decision, date/version, alternatives, reason, evidence, implementation consequence, later contradiction/supersession, and current status.

Golden Set cases should be regression assets, not motivational memories. Each case should include input/context, expected law/outcome, forbidden false-green outcome, and evidence anchor.

## Retrieval

Mission retrieval should rank by:

1. constitutional/root relevance;
2. current mission identity;
3. evidence quality;
4. recency/currentness;
5. decision leverage;
6. semantic relevance.

Do not inject the entire Drive corpus into context. Retrieve the minimum evidence-complete packet.

## Writeback

Default: `READ_ONLY`.

Any create/update/move/delete in Drive requires a separate, explicit write authority and postcondition verification. Local indexing never implies permission to rewrite Drive.
