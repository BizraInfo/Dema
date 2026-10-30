# Phase 04 · Downloads PDF Absorption Map (mtime order)

**Rule:** map-before-merge · no silent ingest · authority_delta = 0  
**Extracts:** `/data/bizra/logs/sparc-spec-pseudocode/pdf-extract/` (when present)

## Inventory (MEASURED mtime 2026-10-30 — last 6 by `ls -lt ~/Downloads/*.pdf`)

| # | mtime | Artifact | Class | Absorb? |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-30 04:32 | `62c2ad29…pdf` FireEye CARBANAK | OUTWARD_NOISE | **No** |
| 2 | 2026-10-29 22:00 | `BIZRA_PAT_Cartographer_Peak_Synthesis_2026-10-29 (1).pdf` | DECLARED | Yes (dup of #3) |
| 3 | 2026-10-29 21:58 | `BIZRA_PAT_Cartographer_Peak_Synthesis_2026-10-29.pdf` | DECLARED | Yes — naming drift, ports |
| 4 | 2026-10-29 20:27 | `BIZRA_Peak_Synthesis_Burst_Report_2026-10-29.pdf` | DECLARED | Yes — One Law / SNR |
| 5 | 2026-10-29 18:26 | `BIZRA_zcode_burst_2026-10-26_Proof-Bound_Synthesis.pdf` | DECLARED | Yes — stubs honesty |
| 6 | 2026-10-29 18:25 | `body.pdf` | DECLARED twin | Map only |

Parked (7th by mtime, still gold): `BIZRA_Peak_System_Wisdom_Unified_Excavation_v2_2026-10-29.pdf` @ 14:45 — F-I..F-III, retry≠repair.

## Golden gems retained

1. **retry ≠ repair** — spin loops are not progress (F-I)
2. **One Law** — authority_delta measurable; consent exact-string
3. **PAT/SAT roster drift** (9 vs 7 / 8 vs 5 lists in docs) — refuse conflation
4. **Port honesty** — 7421/3000/4301 may be unbound; 3000 may mean three services
5. **Witness vs display** — SAT composite 0.95 vs 0.99 / 59 vs 5 → never launder into GREEN
6. **Placeholder site hashes ending in “sign”** — DESIGNED_NOT_LIVE
7. **We do not claim the forest before we prove the seed**

## Lost-in-noise (discard or park)

- Carbanak PDF as BIZRA doctrine
- Gemini crown.html simulated tok/s / 68k-file parses as MEASURED
- Doublespeed phone-farm clone as product path
- Instant 1M-node / 5M-SAT LIVE claims

## Intake gate (future)

```
WHEN cartographer_*.json EXISTS under Downloads
  THEN run map-only intake (phase cartographer JSON) under typed GO if mutating
ELSE status = BLOCKED; keep this map
```
