// Canonical Preview Boundary — single safety vocabulary for every preview
// module in @bizra/dema-core.
//
// Every preview-emitting builder (state, profiles, consent-card, mission-loop,
// evidence-event, llm-router, and any future slice) embeds a `boundary` object
// derived from this single source. The keys form the canonical set of
// "effect-not-performed" booleans that machine-check the preview-only claim.
//
// Operating law: Before adding new capability surfaces, standardize the
// safety vocabulary they all depend on.
//
// Rules for adding a new key:
//   1. The key MUST express a concrete effect that COULD happen at runtime
//      (e.g. "model_invocation_performed"), not a category ("model_stuff").
//   2. The default value MUST be false.
//   3. Existing keys MUST NOT be renamed — only added or deprecated with
//      explicit deprecation cycle.
//   4. Tests in tests/preview-boundary.test.js MUST assert any new key.

const CANONICAL_BOUNDARY_KEYS = Object.freeze([
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
  "consent_collected"
]);

export function buildPreviewBoundary() {
  const entries = CANONICAL_BOUNDARY_KEYS.map((key) => [key, false]);
  return Object.freeze(Object.fromEntries(entries));
}

function checkCanonicalShape(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  const actualKeys = Object.keys(boundary).sort();
  const expectedKeys = [...CANONICAL_BOUNDARY_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length) return false;
  for (let i = 0; i < expectedKeys.length; i++) {
    if (actualKeys[i] !== expectedKeys[i]) return false;
    if (boundary[expectedKeys[i]] !== false) return false;
  }
  return true;
}

// Strict: structure + values + freeze. Use on in-process emitter output.
export function isCanonicalBoundary(boundary) {
  if (!checkCanonicalShape(boundary)) return false;
  if (!Object.isFrozen(boundary)) return false;
  return true;
}

// Shape-only: structure + values, no freeze requirement. Use on boundaries
// recovered from JSON round-trip (e.g. CLI subprocess output, persisted
// receipts), where freeze cannot survive serialization.
export function isCanonicalBoundaryShape(boundary) {
  return checkCanonicalShape(boundary);
}

export const PREVIEW_BOUNDARY_CANONICAL_KEYS = CANONICAL_BOUNDARY_KEYS;
