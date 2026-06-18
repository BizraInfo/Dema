// BIZRA-ADK-AGENT-CONTRACT-1A · allowed/forbidden effect policy.

export const ADK_CANONICAL_EFFECTS = Object.freeze([
  "READ_LOCAL_METADATA",
  "DRAFT_PATCH",
  "RUN_TESTS",
  "WRITE_FILE",
  "NETWORK",
  "KEY_GENERATION",
  "SIGN",
  "FEDERATE",
  "MINT_TOKEN",
  "EXPORT_PRIVATE_MEMORY",
  "SEND_RAW_MEMORY_TO_SAT",
  "RECEIVE_PAT_RAW_MEMORY",
  "READ_PAT_RAW_MEMORY",
  "VERIFY_RECEIPT",
  "REGISTER_PROOF",
  "CLASSIFY_RISK",
  "SCORE_IMPACT",
  "RENDER_SUMMARY",
]);

/** Forbidden on every ADK v0.1 agent unless explicitly overridden (validator refuses override). */
export const ADK_ALWAYS_FORBIDDEN_EFFECTS = Object.freeze([
  "SIGN",
  "FEDERATE",
  "MINT_TOKEN",
  "EXPORT_PRIVATE_MEMORY",
]);

/** PAT agents must never declare these — raw PAT memory cannot cross to SAT. */
export const PAT_SAT_FIREWALL_FORBIDDEN = Object.freeze([
  "SEND_RAW_MEMORY_TO_SAT",
  "EXPORT_PRIVATE_MEMORY",
  "RECEIVE_PAT_RAW_MEMORY",
]);

/** SAT agents must never receive raw PAT memory. */
export const SAT_RAW_MEMORY_FORBIDDEN = Object.freeze([
  "RECEIVE_PAT_RAW_MEMORY",
  "EXPORT_PRIVATE_MEMORY",
  "READ_PAT_RAW_MEMORY",
]);

function dedupeStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (typeof v !== "string" || !v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return Object.freeze(out);
}

export function normalizeStringList(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return dedupeStrings(value.filter((v) => typeof v === "string" && v.length > 0));
}

export function isCanonicalEffect(effect) {
  return ADK_CANONICAL_EFFECTS.includes(effect);
}

/**
 * Merge caller forbidden effects with always-forbidden defaults.
 * Allowed effects cannot include always-forbidden or unknown tokens.
 */
export function normalizeEffectPolicy({ allowed_effects, forbidden_effects } = {}) {
  const allowed = normalizeStringList(allowed_effects).filter((e) =>
    isCanonicalEffect(e),
  );
  const forbidden = dedupeStrings([
    ...ADK_ALWAYS_FORBIDDEN_EFFECTS,
    ...normalizeStringList(forbidden_effects),
  ]);

  return Object.freeze({
    allowed_effects: Object.freeze(allowed),
    forbidden_effects: forbidden,
  });
}
