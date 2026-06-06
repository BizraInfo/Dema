// Eval Layer 2 · Verdict Validator v0.1 — pure, two-layer validator for the
// operator's paste-back judge verdict envelope.
//
// Layer A (structural): delegates to envelope-schema-validator.validateAgainstRegistry,
//   which routes by the envelope's `schema` field against the known-schemas
//   registry. Catches missing required fields, wrong types, bad enum values,
//   bad regex patterns (e.g., non-hex sha256), etc.
//
// Layer B (semantic): adds checks the JSON Schema cannot express.
//   - rubric_id must cross-reference the live RUBRIC_IDS export (catches
//     drift between schema enum and rubric module if either is bumped
//     without the other).
//   - evidence_excerpt must be non-empty after trim (schema only requires
//     `type: "string"`; trim-non-empty is enforced here).
//   - schema field must match the expected verdict schema id (defense
//     against an envelope routing into the wrong validator).
//
// Note: `score` (must be 0|1|2) and `judged_artifact_sha256` (64-hex
// pattern) are enforced entirely by the structural layer via the schema
// enum and pattern — they are NOT re-checked here. The structural layer
// returns `enum_mismatch` / `pattern_mismatch` codes which downstream
// surfaces (the CLI report) already render clearly.
//
// Result envelope: bizra.dema.eval_layer2_verdict_validator.v0.1 with
// truth_label ∈ {"MEASURED", "VALIDATION_FAILED", "SEMANTIC_VIOLATION",
// "SCHEMA_UNKNOWN"}. Deep-frozen. No I/O. No write surface.

import { validateAgainstRegistry } from "./envelope-schema-validator.js";
import { RUBRIC_IDS } from "./eval-layer2-rubrics.js";

export const EVAL_LAYER2_VERDICT_VALIDATOR_SCHEMA =
  "bizra.dema.eval_layer2_verdict_validator.v0.1";

const EXPECTED_VERDICT_SCHEMA = "bizra.dema.eval_layer2_judge_verdict.v0.1";

const BOUNDARY = Object.freeze({
  read_only: true,
  network: false,
  mint: false,
  external_send: false,
  urp_runtime: false,
  filesystem_write_performed: false,
});

export const SEMANTIC_ERROR_CODES = Object.freeze({
  UNKNOWN_RUBRIC: "semantic_unknown_rubric",
  EMPTY_EVIDENCE: "semantic_empty_evidence",
  WRONG_SCHEMA_FIELD: "semantic_wrong_schema_field",
});

function err(path, code, message) {
  return Object.freeze({ path, code, message });
}

function semanticChecks(verdict) {
  const errors = [];

  if (verdict.schema !== EXPECTED_VERDICT_SCHEMA) {
    errors.push(
      err(
        "$.schema",
        SEMANTIC_ERROR_CODES.WRONG_SCHEMA_FIELD,
        `expected ${EXPECTED_VERDICT_SCHEMA}, got ${JSON.stringify(verdict.schema)}`,
      ),
    );
  }

  if (
    typeof verdict.rubric_id === "string" &&
    !RUBRIC_IDS.includes(verdict.rubric_id)
  ) {
    errors.push(
      err(
        "$.rubric_id",
        SEMANTIC_ERROR_CODES.UNKNOWN_RUBRIC,
        `rubric_id ${JSON.stringify(verdict.rubric_id)} is not in v0.1 RUBRIC_IDS (${JSON.stringify([...RUBRIC_IDS])})`,
      ),
    );
  }

  if (
    typeof verdict.evidence_excerpt === "string" &&
    verdict.evidence_excerpt.trim().length === 0
  ) {
    errors.push(
      err(
        "$.evidence_excerpt",
        SEMANTIC_ERROR_CODES.EMPTY_EVIDENCE,
        "evidence_excerpt is empty after trim",
      ),
    );
  }

  // v0.1 judge_origin restriction: the schema enum is now restricted to
  // ["external_paste_back"] so any non-supported value is caught structurally
  // as `enum_mismatch`. No semantic re-check needed. v0.2 will bump the
  // schema id and add additional supported invocation surfaces.

  return errors;
}

export function validatePastedJudgeVerdict(parsedJson) {
  // Hostile-input shielding: only objects can be validated.
  if (
    parsedJson === null ||
    typeof parsedJson !== "object" ||
    Array.isArray(parsedJson)
  ) {
    return Object.freeze({
      schema: EVAL_LAYER2_VERDICT_VALIDATOR_SCHEMA,
      envelope_schema: null,
      recognized: false,
      ok: false,
      truth_label: "VALIDATION_FAILED",
      errors: Object.freeze([
        err(
          "$",
          "wrong_type",
          `expected object envelope, got ${parsedJson === null ? "null" : typeof parsedJson}`,
        ),
      ]),
      boundary: BOUNDARY,
    });
  }

  const structural = validateAgainstRegistry(parsedJson);

  if (!structural.recognized) {
    return Object.freeze({
      schema: EVAL_LAYER2_VERDICT_VALIDATOR_SCHEMA,
      envelope_schema:
        typeof parsedJson.schema === "string" ? parsedJson.schema : null,
      recognized: false,
      ok: false,
      truth_label: "SCHEMA_UNKNOWN",
      errors: Object.freeze([]),
      boundary: BOUNDARY,
    });
  }

  const structuralErrors = [...structural.errors];

  // Semantic checks only run when structural fields are present; otherwise
  // we surface structural errors first and let the operator fix shape.
  const semanticErrors = structural.ok ? semanticChecks(parsedJson) : [];

  const allErrors = [...structuralErrors, ...semanticErrors];
  const ok = allErrors.length === 0;

  let truth_label;
  if (ok) {
    truth_label = "MEASURED";
  } else if (semanticErrors.length > 0 && structuralErrors.length === 0) {
    truth_label = "SEMANTIC_VIOLATION";
  } else {
    truth_label = "VALIDATION_FAILED";
  }

  return Object.freeze({
    schema: EVAL_LAYER2_VERDICT_VALIDATOR_SCHEMA,
    envelope_schema: parsedJson.schema,
    recognized: true,
    ok,
    truth_label,
    errors: Object.freeze(allErrors),
    boundary: BOUNDARY,
  });
}

export function formatVerdictReport(result) {
  const lines = [
    "DEMA · Eval Layer 2 · Verdict Validator",
    "",
    `Schema:           ${result.schema}`,
    `Envelope schema:  ${result.envelope_schema ?? "(none)"}`,
    `Recognized:       ${result.recognized}`,
    `OK:               ${result.ok}`,
    `Truth label:      ${result.truth_label}`,
  ];
  if (result.errors.length === 0) {
    lines.push("Errors:           (none)");
  } else {
    lines.push("Errors:");
    for (const e of result.errors) {
      lines.push(`  [${e.code}] ${e.path}: ${e.message}`);
    }
  }
  lines.push(
    "",
    `Boundary: read_only=${result.boundary.read_only}, network=${result.boundary.network}, mint=${result.boundary.mint}, external_send=${result.boundary.external_send}, urp_runtime=${result.boundary.urp_runtime}, filesystem_write_performed=${result.boundary.filesystem_write_performed}`,
  );
  return lines.join("\n");
}

export const EVAL_LAYER2_VERDICT_VALIDATOR_BOUNDARY = BOUNDARY;
