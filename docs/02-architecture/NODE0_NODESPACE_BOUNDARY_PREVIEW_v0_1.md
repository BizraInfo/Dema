# NODE0-NODESPACE-BOUNDARY-PREVIEW-1A

Truth label: `NODE0_NODESPACE_BOUNDARY_PREVIEW_MEASURED_REPO`

## Purpose

Metadata-only Node0 homebase boundary kernel. It composes the **missing boundary
layer** of the Node0 body from injected metadata only:

1. **hardware specifications** (cpu/gpu/ram/storage + `serial_hash`), and
2. an **OS tree** — host → guest VM / container → filesystem-root ownership,

classified as inside / outside / unknown of the Node0 homebase. It answers only:
*what hardware exists, which OS owns which roots, and what is inside or outside
the homebase boundary.* It is not an inventory of everything and it does not scan
the machine.

## Composition (not duplication)

This slice deliberately does **not** re-implement device/data inventory. Device
rows (`device_id` / `device_type` / `trust_level`) are shaped to align with the
already-shipped surfaces so they compose by `device_id`:

- `packages/core/src/node0-multi-device-urp-resource-manifest-preview.js` (device resource body / unstructured-data rows)
- `packages/core/src/multi-device-asset-awareness.js` (device constellation, metadata-first)

The boundary layer adds only the two absent dimensions (hardware spec + OS tree);
the resource/data dimensions stay in the manifests above.

## Input Contract

```js
runNode0NodespaceBoundaryPreview({ consent, input })
```

Exact consent: `GO: node0 nodespace boundary preview`

```text
input.node_id
input.hardware_assets[]  { device_id, device_type, cpu_summary, gpu_summary,
                           ram_bytes, storage_devices[], serial_hash,
                           trust_level, boundary_status }
input.os_tree[]          { os_id, device_id, os_family, os_version,
                           kernel_version, virtualization_role, parent_os_id,
                           scan_scope, filesystem_roots[] }
  filesystem_roots[]     { root_id, path_label, owner_os_id, boundary_status,
                           scan_scope, content_read_allowed:false,
                           scan_policy{ selected_mode, allowed_modes[],
                             content_read_allowed_now:false,
                             future_user_consent_required:true } }
input.previous_state_hash            (optional; bound into the snapshot)
```

Hard rule: raw serial fields are refused — only `serial_hash` (`sha256:<64hex>`)
is admitted. `boundary_status ∈ {inside_homebase, outside_homebase, unknown}`;
`virtualization_role ∈ {host, guest_vm, container, mobile_os}`;
`scan_scope ∈ {metadata_only, blocked, future_consent_required}`.

## Output Contract

```text
ok
schema · truth_label · mode="metadata_only_preview" · node_id
boundary_summary { inside_homebase, outside_homebase, unknown }
homebase_device_count · os_count · filesystem_root_count
content_hash · inventory_snapshot_hash (== content_hash)
receipt_chain_preview { previous_state_hash, inventory_snapshot_hash, verification_result }
authority_delta = 0
boundary (all false: content_read_performed, file_mutation_performed,
  device_scan_performed, network_used, upload_performed, urp_write_performed,
  token_minted, wallet_accessed, model_invocation_performed,
  model_training_or_rl_performed, daemon_started)
what_this_proves[] · what_this_does_not_prove[]
blocked_by[]
```

## Scan-policy law (metadata-only is the default, not the final law)

Metadata-only is the **safe default** and this preview's execution boundary — it
is not the final BIZRA law. The final node inventory must let the node owner
choose scan depth per root:

```text
metadata_only · content_hash_only · selective_content_index
full_local_content_index · blocked_never_scan
```

Hard law (encoded as a tamper-proof kernel constant `content_scan_policy_preview`):

- The node owner may choose to scan all local content.
- No model, SAT, Dema process, URP process, or other node may choose that for the user.
- Content scan is local-first, consent-scoped, receipt-bound, and revocable.
- Only **receipts** cross nodes by default; **raw content** crosses only under separate explicit consent.

This preview performs no content scan: every root carries `content_read_allowed_now: false`
and `future_user_consent_required: true`, and `current_slice_performed_content_scan` is false.
A forged `user_is_sole_authority_for_scan_depth: false` is rejected by `verify`.

## Verification

```js
verifyNode0NodespaceBoundaryPreview(payload)
```

Body-bound re-derivation. Tampering any field breaks the bind.

## Boundaries

- Pure kernel; any effect is injected and documented in the kernel header
- No network, daemon, wallet, token, federation, or live execution
- All-false boundary invariant — signing/preview authority ≠ execution authority

## Files

```text
packages/core/src/node0-nodespace-boundary-preview.js
tests/node0-nodespace-boundary-preview.test.js
scripts/review/node0-nodespace-boundary-preview-check.mjs
scripts/check.mjs
packages/core/src/dema-capability-truth-registry.js
docs/receipts/NODE0_NODESPACE_BOUNDARY_PREVIEW_1A.md
docs/02-architecture/NODE0_NODESPACE_BOUNDARY_PREVIEW_v0_1.md
```

## Commands

```bash
node --test tests/node0-nodespace-boundary-preview.test.js
node scripts/review/node0-nodespace-boundary-preview-check.mjs --json
npm test
npm run check
```
