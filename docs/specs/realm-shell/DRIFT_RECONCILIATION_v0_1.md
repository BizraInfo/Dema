# BIZRA-DRS v0.1 Drift Reconciliation Note

**Status:** `RECONCILIATION_PINNED_SOURCES_ABSENT` · `authority_delta:0` · TASK-079.07
**Provenance:** rulings below are operator-pinned in TASK-079.07 itself; the
spec bodies they reconcile are attested but not present on this machine
(see `LANDING_MANIFEST.md`). Nothing here quotes spec text — it records
rulings about it.

## Pinned drift rulings (operator-authoritative)

| # | Conflict | Ruling |
|---|---|---|
| 1 | TTL default: spec text `2500` vs TRD example `2000` | **2500 wins as the default.** The TRD value is an example, not law. Implemented surface: `socket_spec::RECONNECT_BACKOFF` stays separate; presence TTL consumers must use 2500 when landed. |
| 2 | Async trait shape: 3-method async trait vs SDD `show_presence` | **The async 3-method trait supersedes the SDD's single `show_presence`.** The wrapper/QML contract surfaces the trait; SDD readers map old→new via this row. |
| 3 | Label source: raw label vs `accessible_label_key` | **`accessible_label_key` i18n wins.** Raw strings never cross into the shell; keys follow the `presence.*` grammar already frozen in the reducer law. |
| 4 | Canonicalization | **canonical-json-v1 wins** — the repo's single canonical byte contract (`scripts/review/canonical-json-v1-check.mjs` registry). No parallel canonicalizer may be introduced in any realm-shell component. |

## IF-01..IF-07 ↔ DRS-TR-* crosswalk

Attested: the ICD defines 7 interfaces `IF-01..IF-07` plus reserved `IF-R1`
(BIZRA_ELITE_FULLSTACK_BLUEPRINT_v0_2, ICD row). The `DRS-TR-*`
identifier set is **not present in any accessible source**, so the mapping
below is deliberately left unresolved rather than invented:

| Interface | Attested role | DRS-TR-* id |
|---|---|---|
| IF-01 | Node0 truth projection wire (realm shell feed) | `UNKNOWN:tr_set_unavailable` |
| IF-02..IF-06 | defined in ICD §(interface chapters) | `UNKNOWN:tr_set_unavailable` |
| IF-07 | defined in ICD | `UNKNOWN:tr_set_unavailable` |
| IF-R1 | reserved | n/a |

Resolution path: land the five specs per `LANDING_MANIFEST.md`, extract the
TR table mechanically, replace each `UNKNOWN:tr_set_unavailable`.

## What this note does not claim

It does not claim the specs were read, that the rulings were derived from
spec text, or that the crosswalk is complete. It records four binding
rulings and one structured gap. `authority_delta` 0 throughout.
