// Canonical Preview Boundary — UNIVERSAL effect-class safety vocabulary
// for preview modules in @bizra/dema-core.
//
// Canonical keys live in boundary-schema.js (single source). This module adds
// runtime-emission boundary helpers per ADR-018 §C3.
//
// Domain-specific vocabs (step7 consent ceremony, behavioral modulation, etc.)
// are intentional divergences — see boundary-vocab-registry.js and
// docs/06-adr/ADR-BOUNDARY-VOCAB-UNIFICATION-1A.md.

import {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
  isCanonicalBoundary,
  isCanonicalBoundaryShape,
} from "./boundary-schema.js";

export {
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
  buildPreviewBoundary,
  isCanonicalBoundary,
  isCanonicalBoundaryShape,
};

const RUNTIME_EMISSION_PERMISSIVE_KEYS = Object.freeze([
  "runtime_execution_performed",
  "model_loaded",
  "model_invocation_performed",
  "prompt_executed",
  "network_used",
  "consent_collected",
  "content_read",
]);

const RUNTIME_EMISSION_STRICTLY_FALSE_KEYS = Object.freeze([
  "public_network_used",
  "external_call_performed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "filesystem_write_performed",
]);

export const RUNTIME_EMISSION_BOUNDARY_KEYS = PREVIEW_BOUNDARY_CANONICAL_KEYS;
export const RUNTIME_EMISSION_PERMISSIVE_KEY_SET =
  RUNTIME_EMISSION_PERMISSIVE_KEYS;
export const RUNTIME_EMISSION_STRICTLY_FALSE_KEY_SET =
  RUNTIME_EMISSION_STRICTLY_FALSE_KEYS;

export function buildRuntimeEmissionBoundary(observed = {}) {
  const out = Object.create(null);
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    if (RUNTIME_EMISSION_PERMISSIVE_KEYS.includes(key)) {
      out[key] = observed[key] === true;
    } else {
      out[key] = false;
    }
  }
  return Object.freeze(out);
}

function checkRuntimeEmissionShape(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  const actualKeys = Object.keys(boundary).sort();
  const expectedKeys = [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length) return false;
  for (let i = 0; i < expectedKeys.length; i++) {
    if (actualKeys[i] !== expectedKeys[i]) return false;
    const v = boundary[expectedKeys[i]];
    if (typeof v !== "boolean") return false;
  }
  for (const key of RUNTIME_EMISSION_STRICTLY_FALSE_KEYS) {
    if (boundary[key] !== false) return false;
  }
  return true;
}

export function isRuntimeEmissionBoundary(boundary) {
  if (!checkRuntimeEmissionShape(boundary)) return false;
  if (!Object.isFrozen(boundary)) return false;
  return true;
}

export function isRuntimeEmissionBoundaryShape(boundary) {
  return checkRuntimeEmissionShape(boundary);
}
