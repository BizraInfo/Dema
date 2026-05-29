// Rule: canonical-shape.v0.1
//
// PURE function: evaluate(input) -> { verdict, computed }.
// No I/O, no Date.now, no Math.random, no network, no global state.
// Re-derivable: a verifier holding only this file + the input can
// reconstruct the verdict bit-for-bit. This is the public rule code
// referenced by bizra.dema.verdict_receipt.v0.1.
//
// Verdict: pass iff input is a plain JSON object AND has every key
// in REQUIRED_KEYS AND no key outside ALLOWED_KEYS. Allowlist, not
// denylist. Reconstructible: computed returns the key-sets so any
// stranger can recompute.

export const RULE_ID = "canonical-shape.v0.1";

export const REQUIRED_KEYS = Object.freeze(["name", "value"]);
export const ALLOWED_KEYS = Object.freeze(["name", "value", "note"]);

function failEnvelope(error) {
  return Object.freeze({
    verdict: "fail",
    computed: Object.freeze({
      input_keys: Object.freeze([]),
      required_keys: REQUIRED_KEYS,
      allowed_keys: ALLOWED_KEYS,
      missing_required: REQUIRED_KEYS,
      disallowed_keys: Object.freeze([]),
      error,
    }),
  });
}

export function evaluate(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failEnvelope("input_not_canonical_json_object");
  }

  const inputKeys = Object.freeze(Object.keys(input).sort());
  const missing = Object.freeze(
    REQUIRED_KEYS.filter((k) => !inputKeys.includes(k)),
  );
  const disallowed = Object.freeze(
    inputKeys.filter((k) => !ALLOWED_KEYS.includes(k)),
  );

  const verdict =
    missing.length === 0 && disallowed.length === 0 ? "pass" : "fail";

  return Object.freeze({
    verdict,
    computed: Object.freeze({
      input_keys: inputKeys,
      required_keys: REQUIRED_KEYS,
      allowed_keys: ALLOWED_KEYS,
      missing_required: missing,
      disallowed_keys: disallowed,
    }),
  });
}
