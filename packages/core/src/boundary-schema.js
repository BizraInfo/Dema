// BOUNDARY-VOCAB-UNIFICATION-1A — single canonical source for the universal
// preview-boundary key list. preview-boundary.js re-exports this surface and
// adds runtime-emission helpers. Domain-specific vocabs live in their modules
// and are registered in boundary-vocab-registry.js + ADR.

export const PREVIEW_BOUNDARY_CANONICAL_KEYS = Object.freeze([
  "filesystem_write_performed",
  "network_used",
  "runtime_execution_performed",
  "model_loaded",
  "model_invocation_performed",
  "prompt_executed",
  "external_call_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "public_network_used",
  "consent_collected",
  "content_read",
]);

export function buildPreviewBoundary() {
  const entries = PREVIEW_BOUNDARY_CANONICAL_KEYS.map((key) => [key, false]);
  return Object.freeze(Object.fromEntries(entries));
}

function checkCanonicalShape(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  const actualKeys = Object.keys(boundary).sort();
  const expectedKeys = [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length) return false;
  for (let i = 0; i < expectedKeys.length; i++) {
    if (actualKeys[i] !== expectedKeys[i]) return false;
    if (boundary[expectedKeys[i]] !== false) return false;
  }
  return true;
}

export function isCanonicalBoundary(boundary) {
  if (!checkCanonicalShape(boundary)) return false;
  if (!Object.isFrozen(boundary)) return false;
  return true;
}

export function isCanonicalBoundaryShape(boundary) {
  return checkCanonicalShape(boundary);
}

export function buildAllFalseBoundaryFromKeys(keys) {
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, false])));
}
