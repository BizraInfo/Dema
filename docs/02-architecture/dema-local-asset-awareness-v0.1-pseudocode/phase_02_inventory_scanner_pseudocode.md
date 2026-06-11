# Phase 2 · Inventory Scanner Pseudocode

**Pseudocode-bundle file:** `phase_02_inventory_scanner_pseudocode.md`
**Goal:** define the bounded scanner and artifact writer.

## Module Target

```text
packages/core/src/local-asset-awareness.js
```

Expected exports:

```text
LOCAL_ASSET_INVENTORY_SCHEMA
buildLocalAssetInventory(options)
writeLocalAssetInventory(options)
classifyLocalAsset(record)
renderLocalAssetInventorySummary(inventory)
```

## Constants

```text
DEFAULT_ROOT = os.homedir() + "/Downloads"
DEFAULT_ARTIFACT = "$DEMA_HOME/realm/local-assets/inventory-v0.1.json"
MAX_DEPTH = 2
MAX_ENTRIES = 5000
FOLLOW_SYMLINKS = false
```

## Denylist

```text
DENY_DIR_NAMES:
  .git, .svn, .hg, node_modules, .venv, venv, target, dist, build,
  .ssh, .gnupg

DENY_NAME_PATTERNS:
  .env, .env.*, *secret*, *credential*, *password*, *token*,
  *.pem, *.key, id_rsa*, id_ed25519*, *.p12, *.pfx
```

## buildLocalAssetInventory(options)

```text
input:
  root = explicit root || DEMA_LOCAL_ASSET_ROOT || DEFAULT_ROOT
  demaHome = explicit DEMA_HOME || env DEMA_HOME || ~/.dema
  now = Date
  limits = optional overrides for tests

resolve root to absolute path
if root cannot be resolved inside itself:
  return failure envelope root_invalid

if root missing:
  return failure envelope root_missing

initialize queue with {path: root, depth: 0}
initialize records, denied, warnings

while queue not empty:
  if records.length + denied.length >= max_entries:
    mark truncated
    break

  pop next directory
  read directory entries with withFileTypes
  sort names ascending for determinism

  for each entry:
    absolute = join(parent, entry.name)
    resolved = resolve(absolute)

    if resolved is outside root:
      denied.push(redactedDenied("outside_root", resolved))
      continue

    if denylist matches:
      denied.push(redactedDenied(reason, resolved, entry kind))
      continue

    lstat absolute
    if lstat fails:
      warnings.push("entry_vanished")
      continue

    if lstat.isSymbolicLink():
      records.push(metadataRecord(kind="symlink", target=null))
      continue

    if lstat.isDirectory():
      records.push(metadataRecord(kind="directory"))
      if depth < max_depth:
        queue.push({path: absolute, depth: depth + 1})
      continue

    if lstat.isFile():
      records.push(metadataRecord(kind="file"))
      continue

    records.push(metadataRecord(kind="other"))

derive categories counts
derive summary counts
derive boundary with file_write_performed=false for builder
return frozen inventory envelope
```

## writeLocalAssetInventory(options)

```text
inventory = await buildLocalAssetInventory(options)

if inventory.valid is false and writeFailureArtifact is not true:
  return {written: false, inventory}

artifactPath = options.artifactPath || default under demaHome
assert artifactPath resolves under demaHome

mkdir dirname(artifactPath), recursive, mode 0o700
write JSON to temp path in same dir
chmod temp path 0o600
rename temp path to artifactPath

return envelope:
  schema: bizra.dema.local_asset_awareness_write_result.v0.1
  artifact_path
  written: true
  inventory_id
  boundary.file_write_performed=true
  boundary.scanned_root_mutated=false
```

## classifyLocalAsset(record)

```text
if directory contains package.json / pyproject.toml / Cargo.toml by metadata-only name:
  category = code_project
else if extension in .md .txt .pdf .docx .csv .xlsx:
  category = document
else if path/name contains receipt/proof/attestation and extension is json/md/pdf:
  category = receipt_or_proof
else if extension in media set:
  category = media
else if extension in archive set:
  category = archive
else if extension in data/model sets:
  category = dataset or model_artifact
else:
  category = unknown
```

No classification may read file contents.
