# Phase 00 · Evidence Boundary (map-before-merge)

**Bundle:** `season-node0-habitat-genesis-1a-pseudocode`  
**Authority:** `authority_delta = 0` · map-only for Downloads · no silent ingest  
**Truth labels:** MEASURED | DECLARED | HELD | DESIGNED_NOT_LIVE

## Inputs (admissible)

| Source | Class | Notes |
| --- | --- | --- |
| `Dema-clean` git HEAD | MEASURED | Disk beats transcript |
| Season synthesis receipt under `/data/bizra/receipts/` | MEASURED_PARTIAL | `NODE0_CLOSED: false` |
| Gemini exports (local agents, Caliber, seed, Doublespeed, 1F7R4, audit, design) | DECLARED context | Wisdom extract only; no fake hashes |
| Last 6 Downloads PDFs by mtime | MIXED | See `phase_04_pdf_absorption_map.md` |
| Cartographer JSON under Downloads | BLOCKED | Artifacts absent at scan |

## Forbidden claims this season

- `NODE0_CLOSED`, `RSI_LIVE`, `SINGULARITY_LIVE`, live federation
- Invented terminal output or fabricated SHA-256
- Treating UI cockpit telemetry as MEASURED
- Absorbing malware research PDF as BIZRA doctrine

## Validation before Phase 01

```
IF git_status_dirty_unrelated AND not_in_slice THEN leave_untouched
IF cartographer_json_absent THEN status = BLOCKED; do_not_invent_intake
IF pdf_mtime_list_includes_foreign_corpus THEN classify OUTWARD_NOISE
EMIT evidence_boundary_receipt with authority_delta = 0
```

## Failure path

Missing consent → stop. Missing infrastructure → DEMA-FDE OUTWARD. Missing evidence → UNKNOWN, not GREEN.
