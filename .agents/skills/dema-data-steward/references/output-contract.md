# Steward Run Output Contract

Use this default structure.

## Executive signal
State the highest-SNR result and whether any mutation occurred.

## Evidence boundary
- roots/sources inspected;
- excluded paths;
- content-read authority;
- mutation authority;
- unavailable sources.

## Inventory
- counts by type;
- bytes;
- unreadable/error count;
- manifest hashes.

## Findings
For each major finding: status, evidence, impact, uncertainty, next verification step.

## Duplicate map
Separate `EXACT_HASH_MATCH`, `HASH_REQUIRED`, `SEMANTIC_CANDIDATE`, and `NOT_DUPLICATE`.

## Knowledge promotion
List new File Cards, Knowledge Cards, Decision Graph nodes, Golden Set candidates, and rejected/held items.

## Organization plan
List proposed logical zone, proposed rename/move, reason, collision risk, reversibility, and consent requirement.

## Execution
If no exact GO: `PREVIEW_ONLY`.
If executed: identify exact action surface, receipts, pre/post state hashes, and undo evidence.

## Open proof gaps
Explicit UNKNOWN/CONTRADICTION items.

## Receipt
Include run id, inputs, script versions/hashes if available, output hashes, and `authority_delta`.
