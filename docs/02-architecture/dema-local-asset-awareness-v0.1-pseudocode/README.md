# Dema Local Asset Awareness v0.1 · SPEC-PSEUDOCODE bundle

**Status:** [DECLARED] Proposed · pseudocode-only · pre-implementation.
**Authored:** 2026-06-11 GST.
**Origin:** B1 spec gate after C1/C2 Covenant proof-integrity hardening.

This bundle decomposes the B1 contract into implementation-ready modules without
shipping the scanner or the Realm panel yet.

## Phase index

| File | Scope | Audience |
| --- | --- | --- |
| [phase_01_requirements.md](phase_01_requirements.md) | Requirements, edge cases, constraints | reviewer, implementer |
| [phase_02_inventory_scanner_pseudocode.md](phase_02_inventory_scanner_pseudocode.md) | Bounded metadata scanner and artifact writer | implementer |
| [phase_03_realm_world_map_pseudocode.md](phase_03_realm_world_map_pseudocode.md) | Artifact reader and Realm panel renderer | implementer |
| [phase_04_tdd_anchors.md](phase_04_tdd_anchors.md) | Test anchors and verification ladder | implementer, reviewer |

## Scope discipline

| In scope | Out of scope |
| --- | --- |
| [DECLARED] Metadata-only scan of `~/Downloads` or explicit test root | File-content reads |
| Safe denylist and path containment | Symlink following |
| Single JSON artifact under `DEMA_HOME` | Writes inside scanned root |
| [DECLARED] Realm World Map reads artifact only | Background daemon or live watcher |
| No embeddings, no network, no model call | Node1/Node2, URP sharing, economic claims |

## Cross-references

- Parent spec: [../dema-local-asset-awareness-v0.1.md](../dema-local-asset-awareness-v0.1.md)
- Existing flat preview: [../../../packages/tasks/src/downloads-audit-preview.js](../../../packages/tasks/src/downloads-audit-preview.js)
- Realm status pattern: [../../../packages/core/src/dema-realm-status.js](../../../packages/core/src/dema-realm-status.js)
- ADR-001: [../../06-adr/ADR-001-dema-is-one-face.md](../../06-adr/ADR-001-dema-is-one-face.md)
- ADR-002: [../../06-adr/ADR-002-no-shadow-state.md](../../06-adr/ADR-002-no-shadow-state.md)
- [DECLARED] ADR-004: [../../06-adr/ADR-004-local-first-memory.md](../../06-adr/ADR-004-local-first-memory.md)
- ADR-005: [../../06-adr/ADR-005-operator-actions-require-explicit-consent.md](../../06-adr/ADR-005-operator-actions-require-explicit-consent.md)

## Next implementation GO

```text
GO: B1A IMPLEMENT LOCAL ASSET INVENTORY SCANNER V0.1
```

Do not implement the Realm World Map until the scanner artifact shape is proven
by tests.
