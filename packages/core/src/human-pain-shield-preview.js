// HUMAN-PAIN-SHIELD-PREVIEW-1A — Conviviality membrane (preview-only).
//
// Maps practitioner pain classes into fail-closed proposal audits:
//   1. Token / context bloat     → AoI token ceiling
//   2. Invisible-config blame    → epistemic visibility (refs ⊆ visible + prose scan)
//   3. Regression whack-a-mole   → soulbound feature pins
//   4. Outbound privacy leak     → pattern scrub on URP-bound text
//   5. Babysitting fatigue       → human-diff line budget
//
// PREVIEW_ONLY · NOT live PAT/SAT · NOT a model gateway · NOT URP submission.
// Callers inject a fully-formed packet; this kernel never reads the filesystem,
// never calls a model, and never mutates DEMA_HOME. Boundary stays all-false.
//
// Honest limits: pin checks are sync boolean predicates over a proposed state
// dict; async / non-boolean predicates are rejected as malformed. Token counts
// are caller-declared. Free-text service names without path tokens remain UNKNOWN.

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

export const DEFAULT_MAX_AOI_CONTEXT_TOKENS = 2000;
export const DEFAULT_MAX_HUMAN_REVIEW_LINES = 25;

const PRIVATE_PATTERNS = Object.freeze([
  // Accept "API key", "api-key", "api_key"
  { id: "secret_label", re: /(api[\s_-]?key|secret|password|bearer\s+[a-z0-9_\-.]+)/i },
  { id: "unix_home", re: /\/(?:Users|home)\/[A-Za-z0-9._-]+\// },
  { id: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
]);

/** Paths / filenames in prose, including `.env` and absolute `/etc/...` forms. */
const FILENAME_IN_PROSE_RE =
  /(?:\/[\w./-]+|(?:\.\.?\/)?\.?[\w-]+)\.(?:py|js|mjs|cjs|ts|tsx|jsx|conf|ya?ml|json|env|toml|rs|go|java|sh|md)\b|\.env\b/gi;

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
 * Extract path-like / filename tokens from diagnostic prose (incl. `.env`).
 * @param {string} prose
 * @returns {string[]}
 */
export function extractFilenameRefsFromProse(prose) {
  if (typeof prose !== "string" || !prose) return [];
  const found = prose.match(FILENAME_IN_PROSE_RE) ?? [];
  return [...new Set(found)];
}

/**
 * Canonical commitment over the audited packet (no functions).
 * @param {object} packet
 */
export function commitPainShieldPacket(packet) {
  if (!packet || typeof packet !== "object") return null;
  const body = {
    mission_id: packet.mission_id ?? null,
    context_tokens_loaded: packet.context_tokens_loaded ?? null,
    visible_artifacts: packet.visible_artifacts ?? null,
    referenced_in_diagnosis: packet.referenced_in_diagnosis ?? null,
    proposed_state_dict: packet.proposed_state_dict ?? null,
    outbound_urp_summary: packet.outbound_urp_summary ?? null,
    human_diff_lines: packet.human_diff_lines ?? null,
    diagnosis_prose: packet.diagnosis_prose ?? null,
  };
  return `sha256:${sha256Hex(stableStringify(body))}`;
}

function normalizePins(pins) {
  if (pins == null) return { ok: true, pins: [] };
  if (!Array.isArray(pins)) return { ok: false, reason: "pins_not_array" };
  const out = [];
  for (const pin of pins) {
    if (!pin || typeof pin !== "object") return { ok: false, reason: "pin_not_object" };
    if (typeof pin.pin_id !== "string" || !pin.pin_id) return { ok: false, reason: "pin_id_invalid" };
    if (typeof pin.regression_check_fn !== "function") {
      return { ok: false, reason: `pin_predicate_not_function:${pin.pin_id}` };
    }
    out.push(pin);
  }
  return { ok: true, pins: out };
}

/**
 * Audit one agent proposal packet against the human-pain shields.
 *
 * @param {object} packet
 * @param {{ pins?: object[], max_aoi_tokens?: number, max_human_review_lines?: number }} [opts]
 */
export function auditHumanPainShieldProposal(packet, opts = {}) {
  const maxTokens = Number.isFinite(opts.max_aoi_tokens)
    ? opts.max_aoi_tokens
    : DEFAULT_MAX_AOI_CONTEXT_TOKENS;
  const maxLines = Number.isFinite(opts.max_human_review_lines)
    ? opts.max_human_review_lines
    : DEFAULT_MAX_HUMAN_REVIEW_LINES;

  const pinNorm = normalizePins(opts.pins);
  if (!pinNorm.ok) {
    return seal("BLOCKED_MALFORMED_PACKET", [`malformed_pins:${pinNorm.reason}`], packet, [], maxTokens, maxLines, []);
  }
  const pins = pinNorm.pins;

  if (!packet || typeof packet !== "object") {
    return seal("BLOCKED_MALFORMED_PACKET", ["packet_not_object"], packet, pins, maxTokens, maxLines, []);
  }

  const malformed = [];
  if (typeof packet.mission_id !== "string" || !packet.mission_id) malformed.push("mission_id");
  if (!Number.isFinite(packet.context_tokens_loaded) || packet.context_tokens_loaded < 0) {
    malformed.push("context_tokens_loaded");
  }
  const visible = asStringTuple(packet.visible_artifacts);
  if (!visible) malformed.push("visible_artifacts");
  const referenced = asStringTuple(packet.referenced_in_diagnosis);
  if (!referenced) malformed.push("referenced_in_diagnosis");
  if (!packet.proposed_state_dict || typeof packet.proposed_state_dict !== "object" || Array.isArray(packet.proposed_state_dict)) {
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
      [],
    );
  }

  const violations = [];

  if (packet.context_tokens_loaded > maxTokens) {
    violations.push(
      `TOKEN_BLOAT: loaded ${packet.context_tokens_loaded} > AoI ceiling ${maxTokens}`,
    );
    return seal("BLOCKED_CONTEXT_TOKEN_BLOAT", violations, packet, pins, maxTokens, maxLines, []);
  }

  const visibleSet = new Set(visible);
  const proseRefs = extractFilenameRefsFromProse(packet.diagnosis_prose ?? "");
  const blamed = [...new Set([...referenced, ...proseRefs])];
  for (const ref of blamed) {
    if (!visibleSet.has(ref)) {
      violations.push(`UNSEEN_SPECULATION: blamed '${ref}' not in visible_artifacts`);
    }
  }
  if (violations.length) {
    return seal("BLOCKED_UNSEEN_CONFIG_SPECULATION", violations, packet, pins, maxTokens, maxLines, []);
  }

  const pinsChecked = [];
  for (const pin of pins) {
    pinsChecked.push(pin.pin_id);
    let result;
    try {
      result = pin.regression_check_fn(packet.proposed_state_dict);
    } catch {
      violations.push(`PIN_BROKEN [${pin.pin_id}]: predicate threw`);
      continue;
    }
    // Reject async / non-boolean — fail closed (do not treat Promise as success).
    if (typeof result !== "boolean") {
      return seal(
        "BLOCKED_MALFORMED_PACKET",
        [`malformed_pins:pin_predicate_non_boolean:${pin.pin_id}`],
        packet,
        pins,
        maxTokens,
        maxLines,
        pinsChecked,
      );
    }
    if (!result) {
      violations.push(
        `PIN_BROKEN [${pin.pin_id}]: ${pin.description ?? "pinned feature"}`,
      );
    }
  }
  if (violations.length) {
    return seal(
      "BLOCKED_REGRESSION_ON_PINNED_FEATURE",
      violations,
      packet,
      pins,
      maxTokens,
      maxLines,
      pinsChecked,
    );
  }

  for (const { id, re } of PRIVATE_PATTERNS) {
    if (re.test(packet.outbound_urp_summary)) {
      violations.push(`PRIVACY_BREACH: outbound matched ${id}`);
      return seal("BLOCKED_PRIVATE_DATA_LEAK", violations, packet, pins, maxTokens, maxLines, pinsChecked);
    }
  }

  if (packet.human_diff_lines > maxLines) {
    violations.push(
      `HUMAN_DIFF_FATIGUE: ${packet.human_diff_lines} lines > budget ${maxLines}`,
    );
    return seal("BLOCKED_HUMAN_DIFF_FATIGUE", violations, packet, pins, maxTokens, maxLines, pinsChecked);
  }

  return seal("SHIELD_PASSED", [], packet, pins, maxTokens, maxLines, pinsChecked);
}

function seal(verdict, violations, packet, pins, maxTokens, maxLines, pinsChecked) {
  const packet_commitment = commitPainShieldPacket(packet);
  const body = {
    schema: HUMAN_PAIN_SHIELD_PREVIEW_SCHEMA,
    truth_label: HUMAN_PAIN_SHIELD_PREVIEW_TRUTH_LABEL,
    verdict,
    violations: Object.freeze([...violations]),
    mission_id: packet?.mission_id ?? null,
    packet_commitment,
    pin_ids_checked: Object.freeze([...pinsChecked]),
    ceilings: Object.freeze({
      max_aoi_context_tokens: maxTokens,
      max_human_review_lines: maxLines,
    }),
    boundary: humanPainShieldPreviewBoundary(),
    what_this_proves:
      "Deterministic fail-closed audit of a caller-supplied proposal packet against AoI token, visibility, pin, privacy, and human-diff ceilings (preview).",
    what_this_does_not_prove:
      "Live PAT/SAT QA, real tokenizer binding, URP submission safety end-to-end, base64 secret evasion, or free-text service names without path tokens.",
    authority_delta: 0,
  };
  const observation_hash = `sha256:${sha256Hex(stableStringify(body))}`;
  return Object.freeze({ ...body, observation_hash });
}

/**
 * Independent re-derivation: re-run audit and require byte-stable observation_hash.
 * Forged clean verdicts fail. Pin predicates must be re-supplied by the caller
 * (functions are not serializable in the sealed report).
 *
 * @param {object} report
 * @param {object} packet
 * @param {{ pins?: object[], max_aoi_tokens?: number, max_human_review_lines?: number }} [opts]
 */
export function verifyHumanPainShieldPreview(report, packet, opts = {}) {
  if (!report || typeof report !== "object") {
    return Object.freeze({ ok: false, reason: "report_not_object" });
  }
  if (report.schema !== HUMAN_PAIN_SHIELD_PREVIEW_SCHEMA) {
    return Object.freeze({ ok: false, reason: "schema_mismatch" });
  }
  const derived = auditHumanPainShieldProposal(packet, opts);
  if (derived.observation_hash !== report.observation_hash) {
    return Object.freeze({
      ok: false,
      reason: "observation_hash_mismatch",
      expected: derived.observation_hash,
      got: report.observation_hash,
    });
  }
  if (derived.verdict !== report.verdict) {
    return Object.freeze({ ok: false, reason: "verdict_mismatch" });
  }
  return Object.freeze({ ok: true, reason: "rederived", observation_hash: derived.observation_hash });
}
