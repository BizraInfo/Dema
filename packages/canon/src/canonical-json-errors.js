// CANONICAL-JSON-V1-0A — closed error-code registry for the canonical JSON v1
// contract. Every rejection maps to exactly one code here; verifiers pin
// vectors against these codes. Adding a code is a contract change.

export const CANONICAL_JSON_V1_ERROR_CODES = Object.freeze([
  "value_undefined",
  "value_function",
  "value_symbol",
  "value_bigint",
  "number_not_finite",
  "number_unsafe_integer",
  "string_lone_surrogate",
  "string_bytes_exceeded",
  "array_sparse",
  "array_length_exceeded",
  "object_not_plain",
  "object_symbol_keys",
  "object_keys_exceeded",
  "object_accessor_property",
  "object_non_enumerable_property",
  "circular_reference",
  "depth_exceeded",
  "total_bytes_exceeded",
]);

const CODE_SET = new Set(CANONICAL_JSON_V1_ERROR_CODES);

export class CanonicalJsonV1Error extends Error {
  constructor(code, message, path) {
    if (!CODE_SET.has(code)) {
      throw new Error(`unregistered canonical-json-v1 error code: ${code}`);
    }
    super(`${code}: ${message}${path ? ` at ${path}` : ""}`);
    this.name = "CanonicalJsonV1Error";
    this.code = code;
    this.path = path ?? "$";
  }
}
