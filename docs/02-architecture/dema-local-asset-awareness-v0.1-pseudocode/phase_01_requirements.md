# Phase 1 · Requirements · Edge Cases · Constraints

**Pseudocode-bundle file:** `phase_01_requirements.md`
**Maps to:** parent spec sections 1-5.
**Goal:** lock the B1 v0.1 contract before implementation.

## Functional Requirements

| ID | Requirement | Verified by |
| --- | --- | --- |
| FR-1 | `dema local-assets scan` defaults to `~/Downloads` when no root is supplied | TDD-01 |
| FR-2 | Tests can supply an isolated root without touching real `~/Downloads` | TDD-02 |
| FR-3 | Scanner emits schema `bizra.dema.local_asset_awareness_inventory.v0.1` | TDD-03 |
| FR-4 | Scanner writes exactly one artifact under `$DEMA_HOME/realm/local-assets/` | TDD-04 |
| FR-5 | Scanner never writes inside the scanned root | TDD-05 |
| FR-6 | [DECLARED] Scanner uses metadata only: no file contents, previews, OCR, or embeddings | TDD-06 |
| FR-7 | Scanner does not follow symlinks | TDD-07 |
| FR-8 | [DECLARED] Denylisted paths are skipped and represented only by reason + path hash | TDD-08 |
| FR-9 | Path traversal and resolved-outside-root paths are refused | TDD-09 |
| FR-10 | Scan is bounded by max depth, max entries, and truncation markers | TDD-10 |
| FR-11 | Records include stable `record_id` derived from canonical metadata | TDD-11 |
| FR-12 | Records classify common local assets into bounded categories | TDD-12 |
| FR-13 | Malformed or missing roots produce schema-tagged failure envelopes | TDD-13 |
| FR-14 | Artifact boundary honestly marks file write true and scanned-root mutation false | TDD-14 |
| FR-15 | [DECLARED] `dema realm world-map` reads only the artifact and never rescans disk | TDD-15 |
| FR-16 | Realm panel renders absent, stale, and ready inventory states honestly | TDD-16 |
| FR-17 | [DECLARED] Realm panel has an all-false read-only boundary | TDD-17 |
| FR-18 | CLI help documents both future commands and their boundaries | TDD-18 |

## Edge Cases

| ID | Case | Expected behavior |
| --- | --- | --- |
| EC-1 | Root does not exist | Emit `root_missing`, write no artifact unless explicitly requested as failure artifact |
| EC-2 | Root exists but cannot be read | Emit `permission_denied`, no crash |
| EC-3 | Directory vanishes during scan | Skip entry and record warning count |
| EC-4 | File name contains RTL or unusual Unicode | [DECLARED] Preserve display name as local-only metadata; IDs remain hash-based |
| EC-5 | Very long filename | Preserve name up to renderer-safe limit; full local metadata may remain in JSON |
| EC-6 | Hidden directory under root | [DECLARED] Skip if denylisted; otherwise include only metadata |
| EC-7 | Symlink points outside root | Do not follow; record `kind: symlink` and omit target |
| EC-8 | More than max entries | Stop deterministically and set `summary.truncated=true` |
| EC-9 | Artifact is malformed | Realm panel emits `INVENTORY_INVALID` and suggests re-scan |
| EC-10 | Artifact is older than freshness window | Realm panel emits `INVENTORY_STALE` but still shows counts |

## Non-Functional Constraints

| ID | Constraint |
| --- | --- |
| C-1 | No new runtime dependencies for B1A unless justified in the implementation plan |
| C-2 | Scanner core must be testable with injected root, `demaHome`, and clock |
| C-3 | Builder and renderer outputs must be frozen where repo patterns expect it |
| C-4 | Human renderer must fit within existing Realm terminal conventions |
| C-5 | Implementation files should stay under 500 lines each unless explicitly justified |
| C-6 | [DECLARED] No public claims, reward language, token language, or Shariah-compliance claims |

## Out Of Scope

- Recursive full-home scans.
- Continuous watch mode.
- Content indexing.
- Cloud sync.
- Automatic cleanup suggestions that imply deleting or moving files.
- Any economic or public network action.
