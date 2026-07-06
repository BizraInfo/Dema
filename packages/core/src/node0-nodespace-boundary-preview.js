// NODE0-NODESPACE-BOUNDARY-PREVIEW-1A — Metadata-only Node0 homebase boundary kernel.
//
// PREVIEW_ONLY. NOT ML. NOT runtime. This kernel composes the *missing boundary
// layer* of the Node0 body from injected metadata only:
//   1. hardware specifications (cpu/gpu/ram/storage + serial_hash), and
//   2. an OS tree (host -> guest VM / container -> filesystem-root ownership),
// classified as inside / outside / unknown of the Node0 homebase.
//
// It deliberately does NOT re-implement device/data inventory. The device rows
// (device_id / device_type / trust_level) are shaped to align with
//   packages/core/src/node0-multi-device-urp-resource-manifest-preview.js
//   packages/core/src/multi-device-asset-awareness.js
// so the boundary layer and the existing manifest/asset layers COMPOSE by
// device_id rather than duplicate. This slice adds only the two absent
// dimensions (hardware spec + OS tree).
//
// Pure kernel: no fs / network / process / clock / random. It consumes provided
// metadata only. It does not scan devices, read file content, list real
// directories, hash real files, sync devices, upload, mint, touch wallets,
// activate URP, federate, invoke models, train, run RSI, or start a daemon.
// The boundary is all-false and authority_delta is 0.

import { createHash } from "node:crypto";

export const NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA =
  "bizra.dema.node0_nodespace_boundary_preview.v0.1";
export const NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL =
  "NODE0_NODESPACE_BOUNDARY_PREVIEW_MEASURED_REPO";
export const NODE0_NODESPACE_BOUNDARY_PREVIEW_GO_PHRASE =
  "GO: node0 nodespace boundary preview";
export const NODE0_NODESPACE_BOUNDARY_PREVIEW_MODE = "metadata_only_preview";
export const NODE0_NODESPACE_BOUNDARY_PREVIEW_VERIFICATION_RESULT =
  "PREVIEW_VERIFIED_METADATA_ONLY";

// Closed vocabularies — anything outside these is a positively-named block.
export const HARDWARE_BOUNDARY_STATUS = Object.freeze([
  "inside_homebase",
  "outside_homebase",
  "unknown",
]);
export const VIRTUALIZATION_ROLES = Object.freeze([
  "host",
  "guest_vm",
  "container",
  "mobile_os",
]);
export const NODESPACE_SCAN_SCOPES = Object.freeze([
  "metadata_only",
  "blocked",
  "future_consent_required",
]);

// Raw serials must never enter the body. Only serial_hash is admitted. Any of
// these keys present on a hardware row is a hard, named block.
export const RAW_SERIAL_FORBIDDEN_KEYS = Object.freeze([
  "serial",
  "serial_number",
  "serialNumber",
  "raw_serial",
  "device_serial",
  "serial_no",
]);

// Fields hashed into the content_hash. Kept as a single source so build and
// verify agree byte-for-byte on the hashed core body.
export const CORE_BODY_KEYS = Object.freeze([
  "schema",
  "truth_label",
  "mode",
  "node_id",
  "hardware_assets",
  "os_tree",
  "boundary_summary",
  "homebase_device_count",
  "os_count",
  "filesystem_root_count",
  "authority_delta",
  "boundary",
  "previous_state_hash",
  "what_this_proves",
  "what_this_does_not_prove",
]);

const WHAT_THIS_PROVES = Object.freeze([
  "A Node0 homebase boundary can be composed from injected hardware-spec + OS-tree metadata into a deterministic, content-addressed snapshot.",
  "Every OS binds to a known hardware device_id; every guest VM / container binds to a parent OS; every filesystem root binds to a known owner OS.",
  "Inside / outside / unknown homebase counts are re-derived from the primary arrays, so a forged summary carrying a recomputed hash is still rejected.",
  "Raw serial numbers are refused at plan and verify; only serial_hash is admitted.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "It does not scan any real device, read any file content, or list any real directory.",
  "It does not prove the injected metadata is truthful; a fully self-consistent fabricated inventory is out of scope without external device attestation.",
  "It does not activate URP, mint, touch a wallet, federate, invoke a model, or start any live runtime; the boundary is all-false and authority_delta is 0.",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function isSerialHash(value) {
  return typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);
}

// All-false boundary invariant. Flipping any flag is an execution claim.
export function node0NodespaceBoundaryPreviewBoundary() {
  return Object.freeze({
    content_read_performed: false,
    file_mutation_performed: false,
    device_scan_performed: false,
    network_used: false,
    upload_performed: false,
    urp_write_performed: false,
    token_minted: false,
    wallet_accessed: false,
    model_invocation_performed: false,
    model_training_or_rl_performed: false,
    daemon_started: false,
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  const canonical = node0NodespaceBoundaryPreviewBoundary();
  const expected = Object.keys(canonical).sort();
  const actual = Object.keys(boundary).sort();
  if (expected.length !== actual.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) return false;
    if (boundary[expected[i]] !== false) return false;
  }
  return true;
}

// Positive validation — the ONLY source of "well-formed" truth. Absence of a
// block is never validation; every precondition is checked explicitly and each
// failure pushes a named block. Shared by plan and verify.
export function nodespaceBoundaryValidationBlocks(input) {
  const blocked = [];
  if (!input || typeof input !== "object") {
    blocked.push("input_not_object");
    return blocked;
  }

  const hardware = input.hardware_assets;
  const osTree = input.os_tree;

  if (!Array.isArray(hardware) || hardware.length === 0) {
    blocked.push("hardware_assets_missing");
  }
  if (!Array.isArray(osTree) || osTree.length === 0) {
    blocked.push("os_tree_missing");
  }

  const deviceIds = new Set();
  if (Array.isArray(hardware)) {
    for (const d of hardware) {
      if (!d || typeof d !== "object") {
        blocked.push("hardware_row_not_object");
        continue;
      }
      const id = typeof d.device_id === "string" ? d.device_id : "?";
      for (const key of RAW_SERIAL_FORBIDDEN_KEYS) {
        if (Object.prototype.hasOwnProperty.call(d, key)) {
          blocked.push(`raw_serial_field_present:${id}:${key}`);
        }
      }
      if (typeof d.device_id !== "string" || d.device_id.length === 0) {
        blocked.push("hardware_device_id_missing");
        continue;
      }
      deviceIds.add(d.device_id);
      if (typeof d.device_type !== "string" || d.device_type.length === 0) {
        blocked.push(`hardware_device_type_missing:${id}`);
      }
      if (!isSerialHash(d.serial_hash)) {
        blocked.push(`serial_hash_missing_or_malformed:${id}`);
      }
      if (!HARDWARE_BOUNDARY_STATUS.includes(d.boundary_status)) {
        blocked.push(`hardware_boundary_status_invalid:${id}`);
      }
      if (
        d.boundary_status === "inside_homebase" &&
        (typeof d.trust_level !== "string" || d.trust_level.length === 0)
      ) {
        blocked.push(`inside_homebase_without_trust_level:${id}`);
      }
    }
  }

  const osIds = new Set();
  if (Array.isArray(osTree)) {
    for (const o of osTree) {
      if (o && typeof o === "object" && typeof o.os_id === "string" && o.os_id.length > 0) {
        osIds.add(o.os_id);
      }
    }
    for (const o of osTree) {
      if (!o || typeof o !== "object") {
        blocked.push("os_row_not_object");
        continue;
      }
      const oid = typeof o.os_id === "string" ? o.os_id : "?";
      if (typeof o.os_id !== "string" || o.os_id.length === 0) {
        blocked.push("os_id_missing");
        continue;
      }
      if (!deviceIds.has(o.device_id)) {
        blocked.push(`os_references_unknown_device:${oid}:${o.device_id ?? "?"}`);
      }
      if (typeof o.os_family !== "string" || o.os_family.length === 0) {
        blocked.push(`os_family_missing:${oid}`);
      }
      if (!VIRTUALIZATION_ROLES.includes(o.virtualization_role)) {
        blocked.push(`os_virtualization_role_invalid:${oid}`);
      }
      if (
        (o.virtualization_role === "guest_vm" || o.virtualization_role === "container") &&
        (typeof o.parent_os_id !== "string" || o.parent_os_id.length === 0)
      ) {
        blocked.push(`guest_without_parent_os:${oid}`);
      }
      if (
        typeof o.parent_os_id === "string" &&
        o.parent_os_id.length > 0 &&
        !osIds.has(o.parent_os_id)
      ) {
        blocked.push(`parent_os_unknown:${oid}:${o.parent_os_id}`);
      }
      if (!NODESPACE_SCAN_SCOPES.includes(o.scan_scope)) {
        blocked.push(`os_scan_scope_invalid:${oid}`);
      }
      const roots = o.filesystem_roots;
      if (!Array.isArray(roots)) {
        blocked.push(`filesystem_roots_not_array:${oid}`);
      } else {
        for (const r of roots) {
          if (!r || typeof r !== "object") {
            blocked.push(`root_not_object:${oid}`);
            continue;
          }
          const rid = typeof r.root_id === "string" ? r.root_id : "?";
          if (typeof r.root_id !== "string" || r.root_id.length === 0) {
            blocked.push(`root_id_missing:${oid}`);
          }
          if (!osIds.has(r.owner_os_id)) {
            blocked.push(`root_references_unknown_os:${rid}:${r.owner_os_id ?? "?"}`);
          }
          if (r.content_read_allowed !== false) {
            blocked.push(`root_content_read_allowed_true:${rid}`);
          }
          if (!HARDWARE_BOUNDARY_STATUS.includes(r.boundary_status)) {
            blocked.push(`root_boundary_status_invalid:${rid}`);
          }
          if (!NODESPACE_SCAN_SCOPES.includes(r.scan_scope)) {
            blocked.push(`root_scan_scope_invalid:${rid}`);
          }
        }
      }
    }
  }

  return blocked;
}

// Independent re-derivation anchor: the summary/counts are a function of the
// primary arrays. verify recomputes them from the arrays, so a forged summary
// with a recomputed content_hash is still rejected (it disagrees with its own
// source arrays).
export function deriveNodespaceBoundarySummary(hardware, osTree) {
  const counts = { inside_homebase: 0, outside_homebase: 0, unknown: 0 };
  for (const d of hardware) {
    if (d && counts[d.boundary_status] !== undefined) counts[d.boundary_status] += 1;
  }
  let filesystem_root_count = 0;
  for (const o of osTree) {
    if (o && Array.isArray(o.filesystem_roots)) {
      filesystem_root_count += o.filesystem_roots.length;
    }
  }
  return {
    boundary_summary: Object.freeze({ ...counts }),
    homebase_device_count: counts.inside_homebase,
    os_count: osTree.length,
    filesystem_root_count,
  };
}

// Fail-closed plan. Exact GO-phrase byte match plus positive input validation.
export function planNode0NodespaceBoundaryPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_NODESPACE_BOUNDARY_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  blocked_by.push(...nodespaceBoundaryValidationBlocks(input));
  return Object.freeze({
    schema: NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA,
    truth_label: NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function pickCoreBody(source) {
  const core = {};
  for (const key of CORE_BODY_KEYS) core[key] = source[key];
  return core;
}

// Exposed so forgery tests hash exactly as build/verify do (no divergent copy):
// the content_hash is sha256 over the canonical stringification of the core body.
export function computeNode0NodespaceContentHash(coreBodyLike) {
  return `sha256:${sha256(stableStringify(pickCoreBody(coreBodyLike)))}`;
}

// Canonical, content-addressed payload. content_hash binds the whole core body;
// inventory_snapshot_hash is the operator-facing alias of the same digest.
export function buildNode0NodespaceBoundaryPreviewPayload(input) {
  const hardware = Array.isArray(input?.hardware_assets) ? input.hardware_assets : [];
  const osTree = Array.isArray(input?.os_tree) ? input.os_tree : [];
  const summary = deriveNodespaceBoundarySummary(hardware, osTree);
  const previous_state_hash =
    typeof input?.previous_state_hash === "string" ? input.previous_state_hash : null;

  const coreBody = {
    schema: NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA,
    truth_label: NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL,
    mode: NODE0_NODESPACE_BOUNDARY_PREVIEW_MODE,
    node_id: typeof input?.node_id === "string" ? input.node_id : null,
    hardware_assets: hardware,
    os_tree: osTree,
    boundary_summary: summary.boundary_summary,
    homebase_device_count: summary.homebase_device_count,
    os_count: summary.os_count,
    filesystem_root_count: summary.filesystem_root_count,
    authority_delta: 0,
    boundary: node0NodespaceBoundaryPreviewBoundary(),
    previous_state_hash,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  };

  const content_hash = `sha256:${sha256(stableStringify(coreBody))}`;

  return freezeDeep({
    ...coreBody,
    content_hash,
    inventory_snapshot_hash: content_hash,
    receipt_chain_preview: {
      previous_state_hash,
      inventory_snapshot_hash: content_hash,
      verification_result: NODE0_NODESPACE_BOUNDARY_PREVIEW_VERIFICATION_RESULT,
    },
  });
}

// Body-bound re-derivation verifier. Rejects: hash tamper, forged summary
// (re-derivation from the primary arrays), any true boundary flag, nonzero
// authority_delta, raw serials, content-read-allowed roots, and broken
// snapshot-hash aliasing.
export function verifyNode0NodespaceBoundaryPreview(payload) {
  const blocked_by = [];

  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }

  const content_hash = payload.content_hash;
  if (typeof content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(content_hash)) {
    blocked_by.push("content_hash_malformed");
  } else {
    const recomputed = `sha256:${sha256(stableStringify(pickCoreBody(payload)))}`;
    if (recomputed !== content_hash) blocked_by.push("content_hash_mismatch");
  }

  // Structural re-validation of the primary arrays (catches forged raw serials /
  // dangling refs even when the hash was recomputed to match).
  blocked_by.push(...nodespaceBoundaryValidationBlocks(payload));

  // Independent summary re-derivation from the primary arrays.
  const hardware = Array.isArray(payload.hardware_assets) ? payload.hardware_assets : [];
  const osTree = Array.isArray(payload.os_tree) ? payload.os_tree : [];
  const derived = deriveNodespaceBoundarySummary(hardware, osTree);
  if (stableStringify(derived.boundary_summary) !== stableStringify(payload.boundary_summary)) {
    blocked_by.push("boundary_summary_not_rederivable");
  }
  if (derived.homebase_device_count !== payload.homebase_device_count) {
    blocked_by.push("homebase_device_count_not_rederivable");
  }
  if (derived.os_count !== payload.os_count) {
    blocked_by.push("os_count_not_rederivable");
  }
  if (derived.filesystem_root_count !== payload.filesystem_root_count) {
    blocked_by.push("filesystem_root_count_not_rederivable");
  }

  if (!boundaryAllFalse(payload.boundary)) blocked_by.push("boundary_not_all_false");
  if (payload.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (payload.mode !== NODE0_NODESPACE_BOUNDARY_PREVIEW_MODE) blocked_by.push("mode_invalid");

  if (payload.inventory_snapshot_hash !== content_hash) {
    blocked_by.push("inventory_snapshot_hash_mismatch");
  }
  const rcp = payload.receipt_chain_preview;
  if (!rcp || typeof rcp !== "object") {
    blocked_by.push("receipt_chain_preview_missing");
  } else {
    if (rcp.inventory_snapshot_hash !== content_hash) {
      blocked_by.push("receipt_chain_snapshot_hash_mismatch");
    }
    if (rcp.verification_result !== NODE0_NODESPACE_BOUNDARY_PREVIEW_VERIFICATION_RESULT) {
      blocked_by.push("receipt_chain_verification_result_invalid");
    }
    if ((rcp.previous_state_hash ?? null) !== (payload.previous_state_hash ?? null)) {
      blocked_by.push("receipt_chain_previous_state_hash_mismatch");
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA,
    truth_label: NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL,
    content_hash: typeof content_hash === "string" ? content_hash : null,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Runtime launder probe: forge a summary count, recompute the hash so the body
// is internally self-consistent, and assert verify STILL rejects it (because the
// re-derived count from the arrays disagrees). Proves launder-resistance on
// every run rather than only in tests.
function tamperProbeRejects(payload) {
  const forgedCore = {
    ...pickCoreBody(payload),
    homebase_device_count: payload.homebase_device_count + 1,
  };
  const forgedHash = `sha256:${sha256(stableStringify(forgedCore))}`;
  const forged = freezeDeep({
    ...forgedCore,
    content_hash: forgedHash,
    inventory_snapshot_hash: forgedHash,
    receipt_chain_preview: {
      previous_state_hash: forgedCore.previous_state_hash,
      inventory_snapshot_hash: forgedHash,
      verification_result: NODE0_NODESPACE_BOUNDARY_PREVIEW_VERIFICATION_RESULT,
    },
  });
  return verifyNode0NodespaceBoundaryPreview(forged).ok === false;
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject.
export function runNode0NodespaceBoundaryPreview({ consent, input } = {}) {
  const boundary = node0NodespaceBoundaryPreviewBoundary();
  const base = {
    schema: NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA,
    truth_label: NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL,
    mode: NODE0_NODESPACE_BOUNDARY_PREVIEW_MODE,
    boundary,
  };

  const plan = planNode0NodespaceBoundaryPreview({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({ ...base, ok: false, blocked_by: plan.blocked_by });
  }

  const payload = buildNode0NodespaceBoundaryPreviewPayload(input);
  const verified = verifyNode0NodespaceBoundaryPreview(payload);
  const blocked_by = [...verified.blocked_by];
  if (!tamperProbeRejects(payload)) blocked_by.push("tamper_probe_did_not_reject");

  if (blocked_by.length > 0) {
    return Object.freeze({ ...base, ok: false, blocked_by: Object.freeze(blocked_by) });
  }

  return Object.freeze({
    ...base,
    ok: true,
    node_id: payload.node_id,
    content_hash: payload.content_hash,
    inventory_snapshot_hash: payload.inventory_snapshot_hash,
    boundary: payload.boundary,
    boundary_summary: payload.boundary_summary,
    homebase_device_count: payload.homebase_device_count,
    os_count: payload.os_count,
    filesystem_root_count: payload.filesystem_root_count,
    authority_delta: payload.authority_delta,
    receipt_chain_preview: payload.receipt_chain_preview,
    what_this_proves: payload.what_this_proves,
    what_this_does_not_prove: payload.what_this_does_not_prove,
    blocked_by: Object.freeze([]),
  });
}

// Canonical fixtures — shared by the review gate and the mirrored test so the
// proof loop and the tests bind to the same well-formed and malicious inputs.
export const NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE = freezeDeep({
  node_id: "node0:mumu",
  hardware_assets: [
    {
      device_id: "dev:laptop-primary",
      device_type: "laptop_node",
      cpu_summary: "Intel Core i9-14900HX 32-thread",
      gpu_summary: "NVIDIA RTX 4090 Laptop 16GB",
      ram_bytes: 137_438_953_472,
      storage_devices: [
        { storage_id: "disk:nvme0", kind: "nvme_ssd", capacity_bytes: 4_000_000_000_000 },
      ],
      serial_hash: `sha256:${"a".repeat(64)}`,
      trust_level: "paired_trusted",
      boundary_status: "inside_homebase",
    },
    {
      device_id: "dev:mobile-primary",
      device_type: "mobile_node",
      cpu_summary: "mobile soc (unspecified)",
      gpu_summary: "mobile gpu (unspecified)",
      ram_bytes: 12_884_901_888,
      storage_devices: [],
      serial_hash: `sha256:${"b".repeat(64)}`,
      trust_level: "paired_high_trust",
      boundary_status: "inside_homebase",
    },
    {
      device_id: "dev:external-archive",
      device_type: "external_drive",
      cpu_summary: "n/a",
      gpu_summary: "n/a",
      ram_bytes: 0,
      storage_devices: [
        { storage_id: "disk:usb0", kind: "usb_hdd", capacity_bytes: 8_000_000_000_000 },
      ],
      serial_hash: `sha256:${"c".repeat(64)}`,
      trust_level: "unverified",
      boundary_status: "unknown",
    },
  ],
  os_tree: [
    {
      os_id: "os:linux-host",
      device_id: "dev:laptop-primary",
      os_family: "Linux",
      os_version: "Ubuntu 25.04",
      kernel_version: "6.17.0-35-generic",
      virtualization_role: "host",
      parent_os_id: null,
      scan_scope: "metadata_only",
      filesystem_roots: [
        {
          root_id: "root:linux:home",
          path_label: "/home/<user>",
          owner_os_id: "os:linux-host",
          boundary_status: "inside_homebase",
          scan_scope: "metadata_only",
          content_read_allowed: false,
        },
      ],
    },
    {
      os_id: "os:win-guest",
      device_id: "dev:laptop-primary",
      os_family: "Windows",
      os_version: "Windows 11 Pro",
      kernel_version: "10.0.26100",
      virtualization_role: "guest_vm",
      parent_os_id: "os:linux-host",
      scan_scope: "future_consent_required",
      filesystem_roots: [
        {
          root_id: "root:win:users",
          path_label: "C:\\Users\\<user>",
          owner_os_id: "os:win-guest",
          boundary_status: "inside_homebase",
          scan_scope: "blocked",
          content_read_allowed: false,
        },
      ],
    },
    {
      os_id: "os:mobile",
      device_id: "dev:mobile-primary",
      os_family: "Android",
      os_version: "Android 16",
      kernel_version: "unknown",
      virtualization_role: "mobile_os",
      parent_os_id: null,
      scan_scope: "blocked",
      filesystem_roots: [],
    },
  ],
  previous_state_hash: null,
});

// Malicious fixture: a raw serial number smuggled onto a hardware row. The gate
// must reject it (raw serials are forbidden; only serial_hash is admitted).
export const NODE0_NODESPACE_BOUNDARY_MALICIOUS_FIXTURE = freezeDeep({
  node_id: "node0:mumu",
  hardware_assets: [
    {
      device_id: "dev:laptop-primary",
      device_type: "laptop_node",
      cpu_summary: "Intel Core i9-14900HX",
      gpu_summary: "NVIDIA RTX 4090",
      ram_bytes: 137_438_953_472,
      storage_devices: [],
      serial_hash: `sha256:${"a".repeat(64)}`,
      serial_number: "PF-REAL-SERIAL-0001",
      trust_level: "paired_trusted",
      boundary_status: "inside_homebase",
    },
  ],
  os_tree: [
    {
      os_id: "os:linux-host",
      device_id: "dev:laptop-primary",
      os_family: "Linux",
      os_version: "Ubuntu 25.04",
      kernel_version: "6.17.0",
      virtualization_role: "host",
      parent_os_id: null,
      scan_scope: "metadata_only",
      filesystem_roots: [],
    },
  ],
  previous_state_hash: null,
});
