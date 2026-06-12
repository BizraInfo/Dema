# Phase 3 · Realm World Map Pseudocode

**Pseudocode-bundle file:** `phase_03_realm_world_map_pseudocode.md`
**Goal:** [DECLARED] define a read-only Realm panel over the inventory artifact.

## Module Target

```text
packages/core/src/dema-realm-world-map.js
```

Expected exports:

```text
DEMA_REALM_WORLD_MAP_SCHEMA
gatherDemaRealmWorldMap(options)
renderDemaRealmWorldMap(state, options)
```

## gatherDemaRealmWorldMap(options)

```text
input:
  demaHome = explicit DEMA_HOME || env DEMA_HOME || ~/.dema
  now = Date
  inventoryPath = optional test override

artifactPath = inventoryPath || demaHome/realm/local-assets/inventory-v0.1.json

if artifact does not exist:
  return state:
    status = INVENTORY_ABSENT
    inventory = null
    next_safe_action = "Run dema assets scan --root ~/Downloads"
    boundary all false

parse JSON
if parse fails or schema mismatch:
  return state:
    status = INVENTORY_INVALID
    inventory = null
    next_safe_action = "Re-run dema assets scan"
    boundary all false

validate artifact boundary:
  file_content_read false
  network_used false
  scanned_root_mutated false
  embedding_generated false
if invalid:
  return state INVENTORY_BOUNDARY_INVALID

derive freshness:
  if generated_at older than freshness window:
    status = INVENTORY_STALE
  else:
    status = INVENTORY_READY

derive clusters:
  group by category
  sort by count desc then category asc
  include counts, newest_mtime, total_size_bytes
  no file contents

return frozen state:
  schema: bizra.dema.realm_world_map.v0.1
  truth_label: LOCAL_REALM_WORLD_MAP
  status
  artifact_path
  root_display
  generated_at_iso
  summary
  clusters
  denied_count
  truncated
  next_safe_action
  boundary all false
```

## renderDemaRealmWorldMap(state, options)

```text
lines:
  DEMA REALM · WORLD MAP
  truth + status + generated time

if INVENTORY_ABSENT:
  show no inventory found
  show next safe action
  show boundary
  return

if invalid:
  show invalid/stale reason without dumping raw JSON
  show next safe action
  show boundary
  return

show root display
show total records, files, directories, symlinks
show top categories:
  code_project
  document
  receipt_or_proof
  media
  archive
  dataset
  model_artifact
  unknown
show denied count and truncation marker
show next safe action as preview text only
show boundary line:
  read-only · no scan · no mutation · no network · no content
```

## CLI Target

```text
dema realm world-map [--json] [--no-color]
```

[DECLARED] The CLI must not call the scanner. It only calls `gatherDemaRealmWorldMap`.
