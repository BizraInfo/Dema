// HUMAN-PAIN-SHIELD-PREVIEW-1A — Conviviality membrane (preview-only).
//
// Maps four 2026 practitioner pain classes into fail-closed proposal audits:
//   1. Token / context bloat     → AoI token ceiling
//   2. Invisible-config blame    → epistemic visibility (refs ⊆ visible set + prose scan)
//   3. Regression whack-a-mole   → soulbound feature pins
//   4. Outbound privacy leak     → structural / pattern scrub on URP-bound text
//
// PREVIEW_ONLY · NOT live PAT/SAT · NOT a model gateway · NOT URP submission.
// Callers inject a fully-formed packet; this kernel never reads the filesystem,
// never calls a model, and never mutates DEMA_HOME. Boundary stays all-false.
//
// Honest limits: pin checks are caller-supplied predicates over a proposed
// state dict; token counts are caller-declared (binding them to a real tokenizer
// is a later slice). Free-text diagnosis is scanned for filename-like tokens
// and cross-checked against visible_artifacts — prose without filenames can
// still hallucinate services by name alone (documented UNKNOWN).

import { createHash } from "node:crypto";

export const HUMAN_PAIN_SHIELD_PREVIEW_SCHEMA = "bizra.dema.human_pain_shield_preview.v0.1";
export const HUMAN_PAIN_SHIELD_PREVIEW_TRUTH_LABEL = "HUMAN_PAIN_SHIELD_PREVIEW_ONLY";
export const HUMAN_PAIN_SHIELD_PREVIEW_GO_PHRASE = "GO: human pain shield preview";

export const PAIN_SHIELD_VERDICTS = Object.freeze([
  "SHIELD_PASSED",
  "BLOCKED_CONTEXT_TOKEN_BLOAT",
  "BLOCKED_UNSEEN_CONFIG_SPECULATION",
  "BLOCKED_REGRESSION_ON_PINNED_FEATURE",
  "BLOCKED_PRIVATE_DATA_LEAK",
  "BLOCKED_HUMAN_DIFF_FATIGUE",
  "BLOCKED_MALFORMED_PACKET",
]);

/** Default AoI ceiling — far below typical 32k–82k MCP schema dumps. */
export const DEFAULT_MAX_AOI_CONTEXT_TOKENS = 2000;

/** Soft 4-touch / exception-only attention budget (lines the human must read). */
export const DEFAULT_MAX_HUMAN_REVIEW_LINES = 25;

const PRIVATE_PATTERNS = Object.freeze([
  { id: "secret_label", re: /(api[_-]?key|secret|password|bearer\s+[a-z0-9_\-.]+)/i },
  { id: "unix_home", re: /\/(?:Users|home)\/[A-Za-z0-9._-]+\// },
  { id: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
]);

/** Filename-like tokens extracted from free-text diagnosis (I13 patch). */
const FILENAME_IN_PROSE_RE =
  /\b[\w./-]+\.(?:py|js|mjs|cjs|ts|tsx|jsx|conf|ya?ml|json|env|toml|rs|go|java|sh|md)\b/gi;

const BOUNDARY_KEYS = Object.freeze([
  "execution_allowed",
  "network_used",
  "model_invocation_performed",
  "filesystem_write_performed",
  "consent_collected",
  "receipt_mint_performed",
  "federation_invoked",
  "urp_submission_performed",
  "token_mint_performed",
]);

export function humanPainShieldPreviewBoundary() {
  return Object.freeze(Object.fromEntries(BOUNDARY_KEYS.map((k) => [k, false])));
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function asStringTuple(value) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== "string" || !item) return null;
    out.push(item);
  }
  return Object.freeze(out);
}

/**
 * Extract path-like / filename tokens from diagnostic prose for visibility checks.
 * @param {string} prose
 * @returns {string[]}
 */
export function extractFilenameRefsFromProse(prose) {
  if (typeof prose !== "string" || !prose) return [];
  const found = prose.match(FILENAME_IN_PROSE_RE) ?? [];
  return [...new Set(found)];
}

/**
 * @typedef {object} PainShieldPin
 * @property {string} pin_id
 * @property {string} description
 * @property {number} epoch_locked
 * @property {(state: Record<string, unknown>) => boolean} regression_check_fn
 */

/**
 * @typedef {object} PainShieldPacket
 * @property {string} mission_id
 * @property {number} context_tokens_loaded
 * @property {string[]} visible_artifacts
 * @property {string[]} referenced_in_diagnosis
 * @property {Record<string, unknown>} proposed_state_dict
 * @property {string} outbound_urp_summary
 * @property {number} human_diff_lines
 * @property {string} [diagnosis_prose]
 */

/**
 * Audit one agent proposal packet against the four human-pain shields.
 *
 * @param {PainShieldPacket} packet
 * @param {{ pins?: PainShieldPin[], max_aoi_tokens?: number, max_human_review_lines?: number }} [opts]
 */
export function auditHumanPainShieldProposal(packet, opts = {}) {
  const maxTokens = Number.isFinite(opts.max_aoi_tokens)
    ? opts.max_aoi_tokens
    : DEFAULT_MAX_AOI_CONTEXT_TOKENS;
  const maxLines = Number.isFinite(opts.max_human_review_lines)
    ? opts.max_human_review_lines
    : DEFAULT_MAX_HUMAN_REVIEW_LINES;
  const pins = Array.isArray(opts.pins) ? opts.pins : [];

  const malformed = [];
  if (!packet || typeof packet !== "object") {
    return seal("BLOCKED_MALFORMED_PACKET", ["packet_not_object"], packet, pins, maxTokens, maxLines);
  }
  if (typeof packet.mission_id !== "string" || !packet.mission_id) malformed.push("mission_id");
  if (!Number.isFinite(packet.context_tokens_loaded) || packet.context_tokens_loaded < 0) {
    malformed.push("context_tokens_loaded");
  }
  const visible = asStringTuple(packet.visible_artifacts);
  if (!visible) malformed.push("visible_artifacts");
  const referenced = asStringTuple(packet.referenced_in_diagnosis);
  if (!referenced) malformed.push("referenced_in_diagnosis");
  if (!packet.proposed_state_dict || typeof packet.proposed_state_dict !== "object") {
    malformed.push("proposed_state_dict");
  }
  if (typeof packet.outbound_urp_summary !== "string") malformed.push("outbound_urp_summary");
  if (!Number.isFinite(packet.human_diff_lines) || packet.human_diff_lines < 0) {
    malformed.push("human_diff_lines");
  }
  if (packet.diagnosis_prose != null && typeof packet.diagnosis_prose !== "string") {
    malformed.push("diagnosis_prose");
  }
  if (malformed.length) {
    return seal(
      "BLOCKED_MALFORMED_PACKET",
      malformed.map((k) => `malformed:${k}`),
      packet,
      pins,
      maxTokens,
      maxLines,
    );
  }

  const violations = [];

  // 1. AoI token ceiling
  if (packet.context_tokens_loaded > maxTokens) {
    violations.push(
      `TOKEN_BLOAT: loaded ${packet.context_tokens_loaded} > AoI ceiling ${maxTokens}`,
    );
    return seal("BLOCKED_CONTEXT_TOKEN_BLOAT", violations, packet, pins, maxTokens, maxLines);
  }

  // 2. Epistemic visibility — explicit refs + filenames mined from prose
  const visibleSet = new Set(visible);
  const proseRefs = extractFilenameRefsFromProse(packet.diagnosis_prose ?? "");
  const blamed = [...new Set([...referenced, ...proseRefs])];
  for (const ref of blamed) {
    if (!visibleSet.has(ref)) {
      violations.push(
        `UNSEEN_SPECULATION: blamed '${ref}' not in visible_artifacts`,
      );
    }
  }
  if (violations.length) {
    return seal("BLOCKED_UNSEEN_CONFIG_SPECULATION", violations, packet, pins, maxTokens, maxLines);
  }

  // 3. Soulbound pins
  for (const pin of pins) {
    if (!pin || typeof pin.pin_id !== "string" || typeof pin.regression_check_fn !== "function") {
      continue;
    }
    let stillWorks = false;
    try {
      stillWorks = Boolean(pin.regression_check_fn(packet.proposed_state_dict));
    } catch {
      stillWorks = false;
    }
    if (!stillWorks) {
      violations.push(
        `PIN_BROKEN [${pin.pin_id}]: ${pin.description ?? "pinned feature"}`,
      );
    }
  }
  if (violations.length) {
    return seal("BLOCKED_REGRESSION_ON_PINNED_FEATURE", violations, packet, pins, maxTokens, maxLines);
  }

  // 4. Outbound privacy patterns (regex — base64 evasion remains DA'IF / documented)
  for (const { id, re } of PRIVATE_PATTERNS) {
    if (re.test(packet.outbound_urp_summary)) {
      violations.push(`PRIVACY_BREACH: outbound matched ${id}`);
      return seal("BLOCKED_PRIVATE_DATA_LEAK", violations, packet, pins, maxTokens, maxLines);
    }
  }

  // 5. Human review fatigue (exception-only attention budget)
  if (packet.human_diff_lines > maxLines) {
    violations.push(
      `HUMAN_DIFF_FATIGUE: ${packet.human_diff_lines} lines > budget ${maxLines}`,
    );
    return seal("BLOCKED_HUMAN_DIFF_FATIGUE", violations, packet, pins, maxTokens, maxLines);
  }

  return seal("SHIELD_PASSED", [], packet, pins, maxTokens, maxLines);
}

function seal(verdict, violations, packet, pins, maxTokens, maxLines) {
  const body = {
    schema: HUMAN_PAIN_SHIELD_PREVIEW_SCHEMA,
    truth_label: HUMAN_PAIN_SHIELD_PREVIEW_TRUTH_LABEL,
    verdict,
    violations: Object.freeze([...violations]),
    mission_id: packet?.mission_id ?? null,
    pin_ids_checked: Object.freeze(
      pins.filter((p) => p && typeof p.pin_id === "string").map((p) => p.pin_id),
    ),
    ceilings: Object.freeze({
      max_aoi_context_tokens: maxTokens,
      max_human_review_lines: maxLines,
    }),
    boundary: humanPainShieldPreviewBoundary(),
    what_this_proves:
      "Deterministic fail-closed audit of a caller-supplied proposal packet against AoI token, visibility, pin, privacy, and human-diff ceilings (preview).",
    what_this_does_not_prove:
      "Live PAT/SAT QA, real tokenizer binding, URP submission safety end-to-end, or that free-text service names without filenames are caught.",
    authority_delta: 0,
  };
  const observation_hash = `sha256:${sha256Hex(stableStringify(body))}`;
  return Object.freeze({ ...body, observation_hash });
}
