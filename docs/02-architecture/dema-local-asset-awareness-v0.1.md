# Dema Local Asset Awareness v0.1

**Status:** [DECLARED] Proposed · spec-only · pre-implementation.
**Authored:** 2026-06-11 GST.
**Trigger:** `GO: B1 SPEC DEMA LOCAL ASSET AWARENESS V0.1`.

This spec defines the next local-value slice after Covenant proof-integrity:

```text
Dema sees my local work without touching it.
```

[DECLARED] The feature is a bounded, metadata-only inventory of a user-selected local root
[DECLARED] that feeds a read-only Realm World Map panel. It does not read file contents,
does not embed, does not call the network, and does not move, delete, rename, or
write inside the scanned root.

## 1. Scope

### In scope for v0.1

- Default root: `~/Downloads`.
- Test override root: `DEMA_LOCAL_ASSET_ROOT` or an explicit `--root`.
- Bounded scanner future command: `dema local-assets scan --root <path> [--json]`.
- [DECLARED] Read-only Realm panel future command: `dema realm world-map [--json] [--no-color]`.
- [DECLARED] Metadata-only records for files, directories, and symlinks.
- One local artifact JSON written under:

```text
$DEMA_HOME/realm/local-assets/inventory-v0.1.json
```

- Atomic artifact write with parent directory mode `0o700` and file mode `0o600`.
- No writes outside the artifact path.

### Out of scope for v0.1

- Embeddings or vector indexes.
- File-content reads, previews, summaries, hashes of contents, OCR, or media parsing.
- Network calls, cloud sync, external upload, or public sharing.
- Moving, deleting, renaming, deduplicating, compressing, or opening files.
- Full-disk indexing or background daemon scanning.
- [DECLARED] Node1/Node2, URP sharing, reward, token, marketplace, or public economic claims.

## 2. Boundary Contract

The scanner may call `lstat`, `readdir`, and path-normalization helpers. It must
not call `readFile`, shell out, follow symlinks, or open file descriptors for
content. Symlinks are recorded as `kind: "symlink"` with target omitted.

The artifact boundary must state:

```json
{
  "file_write_performed": true,
  "write_scope": "DEMA_HOME/realm/local-assets/inventory-v0.1.json",
  "scanned_root_mutated": false,
  "file_content_read": false,
  "network_used": false,
  "embedding_generated": false,
  "model_invoked": false,
  "symlink_followed": false,
  "delete_or_move_performed": false,
  "federation_used": false,
  "economic_claim_made": false
}
```

[DECLARED] The Realm World Map panel reads only the artifact and has an all-false read-only
boundary.

## 3. Inventory Artifact Shape

The scanner emits:

```json
{
  "schema": "bizra.dema.local_asset_awareness_inventory.v0.1",
  "truth_label": "LOCAL_METADATA_MEASURED",
  "mode": "metadata_only",
  "generated_at_iso": "2026-06-11T00:00:00.000Z",
  "root": {
    "display": "~/Downloads",
    "path_hash": "sha256:<hash>",
    "exists": true
  },
  "limits": {
    "max_depth": 2,
    "max_entries": 5000,
    "follow_symlinks": false
  },
  "summary": {
    "records_count": 0,
    "files_count": 0,
    "dirs_count": 0,
    "symlinks_count": 0,
    "denied_count": 0,
    "truncated": false
  },
  "categories": {},
  "records": [],
  "denied": [],
  "boundary": {}
}
```

[DECLARED] Each `records[]` entry includes only metadata:

```json
{
  "record_id": "sha256:<hash>",
  "kind": "file | directory | symlink | other",
  "category": "code_project | document | receipt_or_proof | media | archive | dataset | model_artifact | app_or_install | unknown",
  "name": "report.pdf",
  "relative_path": "reports/report.pdf",
  "extension": ".pdf",
  "size_bytes": 12345,
  "mtime_iso": "2026-06-11T00:00:00.000Z",
  "risk_flags": [],
  "content_hash": null,
  "content_preview": null
}
```

Denied entries must never expose content and should prefer redacted metadata:

```json
{
  "reason": "secret_or_key_pattern",
  "path_hash": "sha256:<hash>",
  "kind": "file"
}
```

## 4. Denylist Rules

Skip, do not recurse into, and do not expose raw details for:

- `.git`, `.svn`, `.hg`, `node_modules`, `.venv`, `venv`, `target`, `dist`, `build`.
- `.ssh`, `.gnupg`, wallet directories, password-manager exports.
- [DECLARED] `.env`, `.env.*`, `*secret*`, `*credential*`, `*password*`, `*token*`.
- Private key material: `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `*.p12`, `*.pfx`.
- Any path that resolves outside the selected root.

The denylist is a safety interlock, not a claim that non-denied paths are safe.

## 5. Realm World Map

[DECLARED] `dema realm world-map` is a read-only consumer of the inventory artifact. It must
not rescan disk. Missing or malformed artifact states are rendered honestly:

- `INVENTORY_ABSENT`: no artifact yet; suggest `dema local-assets scan`.
- `INVENTORY_STALE`: artifact exists but is older than the freshness window.
- `INVENTORY_READY`: artifact parses, schema matches, and boundary is valid.

The initial panel shows:

- root display and generated time,
- counts by category,
- top local work clusters by category and recency,
- denied/truncated counters,
- [DECLARED] next safe action as a preview suggestion only.

## 6. Implementation Bundle

Detailed pseudocode and TDD anchors live in:

- [dema-local-asset-awareness-v0.1-pseudocode/README.md](dema-local-asset-awareness-v0.1-pseudocode/README.md)

## 7. Verification Gates For Implementation GO

The implementation gate must run at minimum:

```bash
node --test tests/local-asset-awareness.test.js tests/dema-realm-world-map.test.js
npm test
npm run check
npm run llm:guidance
git diff --check
```

[DECLARED] `npm run delivery:check` is useful only when the working tree is otherwise clean;
if it fails on `working_tree_dirty`, classify that as a state blocker rather than
a content failure.
