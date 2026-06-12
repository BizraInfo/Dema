# Phase 4 · TDD Anchors

**Pseudocode-bundle file:** `phase_04_tdd_anchors.md`
**Goal:** define the red-green anchors for B1A/B1B implementation.

## B1A Scanner Tests

Target file:

```text
tests/local-asset-awareness.test.js
```

Required tests:

1. Emits schema `bizra.dema.local_asset_awareness_inventory.v0.1`.
2. Uses isolated test root and never touches real `~/Downloads`.
3. Writes artifact under `$DEMA_HOME/realm/local-assets/inventory-v0.1.json`.
4. Does not mutate scanned root before/after scan.
5. Classifies code, document, receipt/proof, media, archive, dataset, model, and unknown records.
6. Does not read file contents; test by monkey-patching or injected fs adapter.
7. [DECLARED] Does not follow symlinks; records symlink metadata only.
8. Denylisted `.env`, key, credential, `.git`, `node_modules`, and wallet-like paths are skipped.
9. Denied entries expose reason + path hash, not raw content.
10. Outside-root traversal is refused.
11. Max depth is enforced.
12. Max entries truncation is deterministic.
13. Missing root returns schema-tagged `root_missing` failure.
14. Permission failure returns schema-tagged `permission_denied` failure.
15. `record_id` is stable for same metadata and changes when material metadata changes.
16. Artifact write uses atomic temp-then-rename and mode `0o600`.
17. Write result boundary marks artifact write true and scanned-root mutation false.

## B1B Realm World Map Tests

Target file:

```text
tests/dema-realm-world-map.test.js
```

Required tests:

1. Missing artifact renders `INVENTORY_ABSENT`.
2. Malformed artifact renders `INVENTORY_INVALID` without raw JSON dump.
3. Boundary-invalid artifact renders `INVENTORY_BOUNDARY_INVALID`.
4. Fresh valid artifact renders `INVENTORY_READY`.
5. Old valid artifact renders `INVENTORY_STALE`.
6. [DECLARED] Clusters are derived from artifact categories only.
7. Renderer includes denied and truncated counters.
8. Renderer includes next safe action but performs no scan.
9. Boundary is all false for the Realm panel.
10. CLI `dema realm world-map --json` emits parseable schema-tagged JSON.
11. CLI `--no-color` output includes no ANSI sequences.

## Verification Ladder

```bash
node --test tests/local-asset-awareness.test.js
node --test tests/dema-realm-world-map.test.js
node --test tests/local-asset-awareness.test.js tests/dema-realm-world-map.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```

For a clean-tree delivery closeout, also run:

```bash
npm run pre-push:seal
npm run delivery:check
```

If those fail solely with `working_tree_dirty`, classify the result as a state
blocker and do not weaken the content verdict.
