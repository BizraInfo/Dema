// Input boundary validator per NIST SSDF PO.4.1 and OWASP ASVS V5.1.
//
// Doctrine: Fail fast, fail closed. Every input from untrusted sources
// (CLI args, env vars, file paths, memory names, intent strings) must be
// validated before any processing occurs. This module provides deterministic,
// schema-tagged validation primitives that produce auditable rejection events.
//
// Design principles:
// - Zero dependencies (Node.js built-ins only)
// - Deterministic rejection (same input → same error)
// - Truth-labeled errors (DECLARED_REJECTION for audit trails)
// - Receipt-aware (rejection events can be logged as structured envelopes)
// - Composable validators (length, regex, allowlist, type guards)

const VALIDATION_SCHEMA = "bizra.dema.validation_verdict.v0.1";

/**
 * Validation verdict envelope — schema-tagged for observability.
 * @typedef {Object} ValidationVerdict
 * @property {string} schema - Always VALIDATION_SCHEMA
 * @property {boolean} accepted - True if input passes all checks
 * @property {string|null} rejected_reason - Null if accepted, else reason code
 * @property {string|null} rejected_detail - Human-readable explanation
 * @property {string} truth_label - Always "DECLARED_REJECTION" or "MEASURED_VALID"
 * @property {string} validated_at - ISO 8601 timestamp
 * @property {string|null} input_hash - SHA-256 of first 1KB of input (for audit)
 * @property {Record<string, any>} constraints - Applied constraints snapshot
 */

/**
 * Compute SHA-256 hash of a string (for audit trail, not cryptographic security).
 * @param {string} input 
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashInput(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input.slice(0, 1024)); // Hash first 1KB only
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a validation verdict envelope.
 * @param {Object} options
 * @param {boolean} options.accepted
 * @param {string|null} options.rejected_reason
 * @param {string|null} options.rejected_detail
 * @param {Record<string, any>} options.constraints
 * @param {string|null} options.inputHash
 * @returns {ValidationVerdict}
 */
function verdict({ accepted, rejected_reason, rejected_detail, constraints, inputHash = null }) {
  return {
    schema: VALIDATION_SCHEMA,
    accepted,
    rejected_reason: accepted ? null : rejected_reason,
    rejected_detail: accepted ? null : rejected_detail,
    truth_label: accepted ? "MEASURED_VALID" : "DECLARED_REJECTION",
    validated_at: new Date().toISOString(),
    input_hash: inputHash,
    constraints: Object.freeze(constraints)
  };
}

/**
 * Validate input length against maximum byte limit.
 * 
 * Economic rationale: Prevents DoS via massive intent strings that could:
 * - Exhaust memory during JSON parsing
 * - Cause hash computation delays (SHA-256 on MB strings)
 * - Overflow receipt storage quotas
 * 
 * @param {string} input - The input string to validate
 * @param {number} maxBytes - Maximum allowed byte length
 * @param {string} fieldName - Human-readable field name for error messages
 * @returns {Promise<ValidationVerdict>}
 */
export async function validateMaxLength(input, maxBytes, fieldName = "input") {
  const constraints = {
    field: fieldName,
    max_bytes: maxBytes,
    validation_type: "length_bound"
  };

  if (typeof input !== "string") {
    return verdict({
      accepted: false,
      rejected_reason: "type_mismatch",
      rejected_detail: `${fieldName} must be a string, got ${typeof input}`,
      constraints
    });
  }

  const byteLength = Buffer.byteLength(input, "utf8");
  
  if (byteLength > maxBytes) {
    const inputHash = await hashInput(input);
    return verdict({
      accepted: false,
      rejected_reason: "exceeds_max_length",
      rejected_detail: `${fieldName} exceeds maximum length of ${maxBytes} bytes (got ${byteLength} bytes)`,
      constraints,
      inputHash
    });
  }

  return verdict({
    accepted: true,
    rejected_reason: null,
    rejected_detail: null,
    constraints
  });
}

/**
 * Validate input against a regex pattern.
 * 
 * Security rationale: Ensures input conforms to expected format,
 * preventing path traversal, injection attacks, and malformed identifiers.
 * 
 * @param {string} input - The input string to validate
 * @param {RegExp} pattern - Regular expression to test against
 * @param {string} fieldName - Human-readable field name for error messages
 * @param {string} patternName - Human-readable name for the pattern (e.g., "safe memory name")
 * @returns {ValidationVerdict}
 */
export function validatePattern(input, pattern, fieldName = "input", patternName = "pattern") {
  const constraints = {
    field: fieldName,
    pattern_source: pattern.source,
    pattern_flags: pattern.flags,
    validation_type: "regex_match"
  };

  if (typeof input !== "string") {
    return verdict({
      accepted: false,
      rejected_reason: "type_mismatch",
      rejected_detail: `${fieldName} must be a string, got ${typeof input}`,
      constraints
    });
  }

  if (!pattern.test(input)) {
    return verdict({
      accepted: false,
      rejected_reason: "pattern_mismatch",
      rejected_detail: `${fieldName} must match ${patternName} pattern (letters, digits, hyphens, underscores only)`,
      constraints
    });
  }

  return verdict({
    accepted: true,
    rejected_reason: null,
    rejected_detail: null,
    constraints
  });
}

/**
 * Validate input against a closed allowlist.
 * 
 * Security rationale: Whitelist-based validation is inherently safer
 * than blacklist approaches (fail-closed vs fail-open).
 * 
 * @param {string} input - The input string to validate
 * @param {Set<string>} allowlist - Set of allowed values
 * @param {string} fieldName - Human-readable field name for error messages
 * @returns {ValidationVerdict}
 */
export function validateAllowlist(input, allowlist, fieldName = "input") {
  const constraints = {
    field: fieldName,
    allowed_values: Array.from(allowlist),
    validation_type: "allowlist_match"
  };

  if (typeof input !== "string") {
    return verdict({
      accepted: false,
      rejected_reason: "type_mismatch",
      rejected_detail: `${fieldName} must be a string, got ${typeof input}`,
      constraints
    });
  }

  if (!allowlist.has(input)) {
    return verdict({
      accepted: false,
      rejected_reason: "not_in_allowlist",
      rejected_detail: `${fieldName} must be one of: ${Array.from(allowlist).join(", ")}`,
      constraints
    });
  }

  return verdict({
    accepted: true,
    rejected_reason: null,
    rejected_detail: null,
    constraints
  });
}

/**
 * Validate autonomy level string (L0-L5 only).
 * 
 * Security rationale: Autonomy levels are security boundaries;
 * malformed values must fail-closed, not default to permissive.
 * 
 * @param {string} input - The autonomy level string
 * @returns {ValidationVerdict}
 */
export function validateAutonomyLevel(input) {
  const ALLOWED_LEVELS = new Set(["L0", "L1", "L2", "L3", "L4", "L5"]);
  const LEVEL_PATTERN = /^L[0-5]$/;
  
  const constraints = {
    field: "autonomy_level",
    allowed_values: Array.from(ALLOWED_LEVELS),
    pattern: LEVEL_PATTERN.source,
    validation_type: "autonomy_level_check"
  };

  if (typeof input !== "string") {
    return verdict({
      accepted: false,
      rejected_reason: "type_mismatch",
      rejected_detail: `autonomy_level must be a string, got ${typeof input}`,
      constraints
    });
  }

  // First check pattern (fast path)
  if (!LEVEL_PATTERN.test(input)) {
    return verdict({
      accepted: false,
      rejected_reason: "invalid_format",
      rejected_detail: `autonomy_level must match pattern L0-L5 (got "${input}")`,
      constraints
    });
  }

  // Then check allowlist (defense in depth)
  if (!ALLOWED_LEVELS.has(input)) {
    return verdict({
      accepted: false,
      rejected_reason: "not_in_allowlist",
      rejected_detail: `autonomy_level must be one of: ${Array.from(ALLOWED_LEVELS).join(", ")}`,
      constraints
    });
  }

  return verdict({
    accepted: true,
    rejected_reason: null,
    rejected_detail: null,
    constraints
  });
}

/**
 * Composite validator: applies multiple validation rules in sequence.
 * Fails fast on first rejection (short-circuit evaluation).
 * 
 * @param {string} input - The input string to validate
 * @param {Array<Function>} validators - Array of validator functions
 * @param {string} fieldName - Human-readable field name for error messages
 * @returns {Promise<ValidationVerdict>}
 */
export async function validateComposite(input, validators, fieldName = "input") {
  const constraints = {
    field: fieldName,
    validation_chain: validators.map(v => v.name || "anonymous"),
    validation_type: "composite"
  };

  let inputHash = null;

  for (const validator of validators) {
    const result = await Promise.resolve(validator(input));
    
    if (!result.accepted) {
      // Capture hash on first failure for audit trail
      if (typeof input === "string") {
        inputHash = await hashInput(input);
      }
      
      return verdict({
        accepted: false,
        rejected_reason: result.rejected_reason,
        rejected_detail: result.rejected_detail,
        constraints,
        inputHash
      });
    }
  }

  return verdict({
    accepted: true,
    rejected_reason: null,
    rejected_detail: null,
    constraints
  });
}

/**
 * Sanitize path components for safe display in error messages.
 * 
 * Security rationale: Prevents internal path leakage in error messages
 * that could aid reconnaissance attacks.
 * 
 * @param {string} path - Full path to sanitize
 * @returns {string} Basename only (last path component)
 */
export function sanitizePathForDisplay(path) {
  if (typeof path !== "string") return "[unknown]";
  
  // Extract basename (last path component)
  const lastSlash = path.lastIndexOf("/");
  const lastBackslash = path.lastIndexOf("\\");
  const separatorIndex = Math.max(lastSlash, lastBackslash);
  
  if (separatorIndex === -1) return path;
  return path.slice(separatorIndex + 1);
}

/**
 * Constants for common validation thresholds.
 * Exported for use across the codebase (DRY principle).
 */
export const VALIDATION_LIMITS = Object.freeze({
  MAX_INTENT_LENGTH: 10 * 1024,           // 10KB for intent strings
  MAX_MEMORY_NAME_LENGTH: 64,             // 64 bytes for memory entry names
  MAX_RECEIPT_SELECTOR_LENGTH: 256,       // 256 bytes for receipt selectors
  MAX_CONSENT_PHRASE_LENGTH: 512,         // 512 bytes for consent phrases
  MAX_ACTION_DESCRIPTION_LENGTH: 1024,    // 1KB for action descriptions
  MAX_ERROR_MESSAGE_LENGTH: 256,          // 256 bytes for error messages (prevent leakage)
  SAFE_MEMORY_NAME_PATTERN: /^[A-Za-z0-9_-]+$/,
  AUTONOMY_LEVEL_PATTERN: /^L[0-5]$/,
  UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
});

/**
 * Default export: namespace object for convenience.
 */
export default {
  validateMaxLength,
  validatePattern,
  validateAllowlist,
  validateAutonomyLevel,
  validateComposite,
  sanitizePathForDisplay,
  VALIDATION_LIMITS,
  VALIDATION_SCHEMA
};
