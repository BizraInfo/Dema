// Envelope Schema Validator v0.1 — stdlib-only structural validator for Dema
// envelope shapes. Validates a JSON value against a JSON-Schema-subset
// definition. Pure validation functions take a schema-def as input; the
// module also auto-loads the known schemas from packages/core/schemas/
// at module init for the registry-based router.
//
// Subset of JSON Schema 2020-12 supported:
//   - type (string · number · integer · boolean · object · array · null;
//     or an array of those for unions)
//   - const  (literal exact-match)
//   - enum   (literal in-set match)
//   - required (array of property names; only when value is an object)
//   - properties (per-property sub-schemas; only when value is an object)
//   - items (per-element sub-schema; only when value is an array)
//   - pattern (regex; only when value is a string)
//
// Out of scope for v0.1: $ref, anyOf/oneOf/allOf, additionalProperties,
// dependentRequired, format, conditional schemas. Add when a real envelope
// shape demands one.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ENVELOPE_SCHEMA_VALIDATOR_SCHEMA =
  "bizra.dema.envelope_schema_validator.v0.1";

const BOUNDARY = Object.freeze({
  read_only: true,
  network: false,
  mint: false,
  external_send: false,
  urp_runtime: false,
  filesystem_write_performed: false
});

const ERROR_CODES = Object.freeze({
  MISSING_REQUIRED: "missing_required",
  WRONG_TYPE: "wrong_type",
  CONST_MISMATCH: "const_mismatch",
  ENUM_MISMATCH: "enum_mismatch",
  PATTERN_MISMATCH: "pattern_mismatch"
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_SCHEMAS_DIR = join(__dirname, "..", "schemas");

function actualType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesSingleType(value, type) {
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  return false;
}

function matchesType(value, type) {
  if (Array.isArray(type)) return type.some((t) => matchesSingleType(value, t));
  return matchesSingleType(value, type);
}

function pushError(errors, path, code, message) {
  errors.push(Object.freeze({ path, code, message }));
}

function walk(value, schema, path, errors) {
  if (!schema || typeof schema !== "object") return;

  if (Object.prototype.hasOwnProperty.call(schema, "const")) {
    if (value !== schema.const) {
      pushError(
        errors,
        path,
        ERROR_CODES.CONST_MISMATCH,
        `expected constant ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`
      );
      return;
    }
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((opt) => opt === value)) {
      pushError(
        errors,
        path,
        ERROR_CODES.ENUM_MISMATCH,
        `value ${JSON.stringify(value)} is not in enum ${JSON.stringify(schema.enum)}`
      );
      return;
    }
  }

  if (schema.type !== undefined) {
    if (!matchesType(value, schema.type)) {
      pushError(
        errors,
        path,
        ERROR_CODES.WRONG_TYPE,
        `expected type ${JSON.stringify(schema.type)}, got ${actualType(value)}`
      );
      return;
    }
  }

  if (
    typeof schema.pattern === "string" &&
    typeof value === "string"
  ) {
    const re = new RegExp(schema.pattern);
    if (!re.test(value)) {
      pushError(
        errors,
        path,
        ERROR_CODES.PATTERN_MISMATCH,
        `string ${JSON.stringify(value)} does not match pattern /${schema.pattern}/`
      );
    }
  }

  const isObject =
    value !== null && typeof value === "object" && !Array.isArray(value);

  if (Array.isArray(schema.required) && isObject) {
    for (const key of schema.required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        pushError(
          errors,
          `${path}.${key}`,
          ERROR_CODES.MISSING_REQUIRED,
          `required property "${key}" is missing`
        );
      }
    }
  }

  if (schema.properties && isObject) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        walk(value[key], subSchema, `${path}.${key}`, errors);
      }
    }
  }

  if (schema.items && Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      walk(value[i], schema.items, `${path}[${i}]`, errors);
    }
  }
}

export function validateEnvelope(envelope, schemaDef) {
  const errors = [];
  walk(envelope, schemaDef, "$", errors);
  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors)
  });
}

function loadKnownSchemasFromDir(dir) {
  const entries = readdirSync(dir);
  const map = new Map();
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const raw = readFileSync(join(dir, name), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.$id === "string") {
      map.set(parsed.$id, Object.freeze(parsed));
    }
  }
  return map;
}

export function loadKnownSchemas({ dir = DEFAULT_SCHEMAS_DIR } = {}) {
  return loadKnownSchemasFromDir(dir);
}

export const KNOWN_SCHEMAS = (() => {
  try {
    const loaded = loadKnownSchemasFromDir(DEFAULT_SCHEMAS_DIR);
    return Object.freeze(loaded);
  } catch {
    return Object.freeze(new Map());
  }
})();

export function validateAgainstRegistry(
  envelope,
  { registry = KNOWN_SCHEMAS } = {}
) {
  const declared =
    envelope && typeof envelope === "object" && !Array.isArray(envelope)
      ? envelope.schema
      : null;
  const schemaDef =
    typeof declared === "string" ? registry.get(declared) : undefined;
  const recognized = Boolean(schemaDef);
  let truth_label;
  let errors;
  let ok;

  if (!recognized) {
    truth_label = "SCHEMA_UNKNOWN";
    errors = [];
    ok = false;
  } else {
    const result = validateEnvelope(envelope, schemaDef);
    errors = result.errors;
    ok = result.ok;
    truth_label = ok ? "MEASURED" : "VALIDATION_FAILED";
  }

  return Object.freeze({
    schema: ENVELOPE_SCHEMA_VALIDATOR_SCHEMA,
    envelope_schema: typeof declared === "string" ? declared : null,
    recognized,
    ok,
    truth_label,
    errors: Object.freeze([...errors]),
    boundary: BOUNDARY
  });
}

export { BOUNDARY as ENVELOPE_SCHEMA_VALIDATOR_BOUNDARY, ERROR_CODES };
