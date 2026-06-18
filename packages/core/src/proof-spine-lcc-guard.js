// PROOF-SPINE-GUARD-1A · read-only LCC/G-ladder reference guard
//
// Verifies that declared proof-layer references resolve to tracked local files
// and that delivery-check markers still exist in the orchestrator source.
// No registry writer, no claim-map mutation, no remote witness collection.
// Pure-with-exists-injection: caller supplies exists() — no node:fs here.

import { join } from "node:path";

export const PROOF_SPINE_LCC_GUARD_SCHEMA =
  "bizra.dema.proof_spine_lcc_guard.v0.1";

const FILE_REFS = Object.freeze([
  "boundary_ref",
  "test_scaffold_ref",
  "mock_ref",
]);

function defaultExists() {
  throw new Error("exists_required");
}

function markerPresent(source, marker) {
  if (!marker || typeof source !== "string") return false;
  if (source.includes(marker)) return true;
  const base = marker.replace(/:\s*PASS$/i, "").trim();
  return base.length > 0 && source.includes(base);
}

/**
 * @param {object} opts
 * @param {string} opts.root
 * @param {Array<object>} opts.layers
 * @param {string} opts.deliveryCheckSource
 * @param {(path:string)=>boolean} [opts.exists]
 */
export function auditProofSpineLayers({
  root,
  layers,
  deliveryCheckSource,
  exists = defaultExists,
} = {}) {
  const findings = [];

  if (!Array.isArray(layers) || layers.length === 0) {
    findings.push({
      layer_id: "(manifest)",
      field: "layers",
      code: "layers_required",
    });
  } else {
    for (const layer of layers) {
      for (const field of FILE_REFS) {
        const rel = layer?.[field];
        if (!rel) {
          findings.push({
            layer_id: layer?.layer_id ?? "(unknown)",
            field,
            code: "missing_ref",
          });
          continue;
        }
        const abs = join(root, rel);
        if (!exists(abs)) {
          findings.push({
            layer_id: layer.layer_id,
            field,
            code: "missing_file",
            path: rel,
          });
        }
      }

      const marker = layer?.delivery_check_marker;
      if (!markerPresent(deliveryCheckSource, marker)) {
        findings.push({
          layer_id: layer?.layer_id ?? "(unknown)",
          field: "delivery_check_marker",
          code: "marker_not_in_delivery_check",
          marker: marker ?? null,
        });
      }

      if (layer?.claim_map_status !== "BOUNDARY_NON_CLAIM_ONLY") {
        findings.push({
          layer_id: layer?.layer_id ?? "(unknown)",
          field: "claim_map_status",
          code: "invalid_claim_map_status",
          value: layer?.claim_map_status ?? null,
        });
      }
    }
  }

  return Object.freeze({
    schema: PROOF_SPINE_LCC_GUARD_SCHEMA,
    ok: findings.length === 0,
    layer_count: Array.isArray(layers) ? layers.length : 0,
    findings: Object.freeze([...findings]),
  });
}
