// Routed Invocation Verifier — deterministic invariant checker for saved
// invocation envelopes (PR #85 invocation-result-save output).
//
// IMPORTANT NAMING (architect-locked 2026-05-21):
//   This is DETERMINISTIC PREVIEW VERIFICATION, not the canonical SAT-1..5
//   chain-bound verification (`packages/core/src/sat-*-verifier.js`). It
//   does NOT invoke another model. It does NOT call the governed gateway.
//   It does NOT advance any chain. It does NOT mint receipts. It produces
//   a JSON verification envelope and exits.
//
// Boundary:
//   - reads exactly one file (the saved invocation envelope)
//   - no network call
//   - no model invocation
//   - no mutation (verification is read-only at v0.1; future v0.2+ may add
//     a --save-verification flag, out of scope here)
//   - no chain advance / no governed-gateway handoff
//
// Bounded-read pattern (mirrors PR #82 + PR #85): open + bounded read into
// fixed Buffer + close. Closes TOCTOU race AND prevents memory exhaustion.

import { createHash } from "node:crypto";
import { open, stat, readdir } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { homedir } from "node:os";

export const ROUTED_INVOCATION_VERIFICATION_SCHEMA =
  "bizra.dema.local_model_routed_invocation_verification.v0.1";

const ENVELOPE_SCHEMA = "bizra.dema.local_model_routed_invocation_result.v0.1";
const ROUTE_RECEIPT_SCHEMA = "bizra.dema.local_model_route_receipt.v0.1";

const CANONICAL_ENVELOPE_BOUNDARY_KEYS = Object.freeze([
  "federation",
  "localhost_only",
  "mint",
  "model_invocation",
  "network_used",
  "remote_provider",
  "runtime",
  "token_economy",
  "urp_networking"
]);

const MAX_ENVELOPE_FILE_BYTES = 1024 * 1024;

// ─── Bounded read + source path resolution ───────────────────────────────────

function defaultDemaHome() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export async function resolveLatestInvocationPath({ demaHome } = {}) {
  const home = demaHome || defaultDemaHome();
  const receiptsDir = join(home, "receipts");
  let entries;
  try {
    entries = await readdir(receiptsDir);
  } catch {
    return null;
  }
  const invocationFiles = entries.filter(
    (f) => f.startsWith("invocation-") && f.endsWith(".json")
  );
  if (invocationFiles.length === 0) return null;
  const withMtimes = await Promise.all(
    invocationFiles.map(async (f) => {
      const fp = join(receiptsDir, f);
      try {
        const s = await stat(fp);
        return { path: fp, mtimeMs: s.mtimeMs };
      } catch {
        return null;
      }
    })
  );
  const usable = withMtimes.filter(Boolean);
  if (usable.length === 0) return null;
  usable.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return usable[0].path;
}

export async function readEnvelopeFromFile(filePath) {
  if (typeof filePath !== "string" || filePath.length === 0) {
    throw new Error("readEnvelopeFromFile: filePath required");
  }
  if (!isAbsolute(filePath)) {
    throw new Error("readEnvelopeFromFile: filePath must be absolute");
  }
  let fh = null;
  try {
    fh = await open(filePath, "r");
    const buffer = Buffer.alloc(MAX_ENVELOPE_FILE_BYTES + 1);
    const { bytesRead } = await fh.read(buffer, 0, MAX_ENVELOPE_FILE_BYTES + 1, 0);
    if (bytesRead > MAX_ENVELOPE_FILE_BYTES) {
      throw new Error(`envelope file too large: exceeds ${MAX_ENVELOPE_FILE_BYTES} bytes`);
    }
    const raw = buffer.subarray(0, bytesRead).toString("utf8");
    const sourceHash = createHash("sha256").update(raw).digest("hex");
    const envelope = JSON.parse(raw);
    return { envelope, sourceHash, raw };
  } finally {
    if (fh) {
      try { await fh.close(); } catch { /* swallow */ }
    }
  }
}

// ─── 17 deterministic invariant probes ────────────────────────────────────────
// Each probe returns { satisfied, evidence }. Probes that are not applicable
// to a given envelope state (e.g., completed_has_response when the envelope
// is failed) return satisfied=true by default with evidence.applicable=false.

function probeEnvelopeIsObject(envelope) {
  const isPlainObject =
    envelope !== null &&
    typeof envelope === "object" &&
    !Array.isArray(envelope);
  return {
    satisfied: isPlainObject,
    evidence: { actual_type: Array.isArray(envelope) ? "array" : typeof envelope }
  };
}

function probeEnvelopeSchemaMatches(envelope) {
  const actual = envelope?.schema ?? null;
  return {
    satisfied: actual === ENVELOPE_SCHEMA,
    evidence: { expected: ENVELOPE_SCHEMA, actual }
  };
}

function probeRouteReceiptPresent(envelope) {
  const ok = envelope?.route_receipt !== null &&
    typeof envelope?.route_receipt === "object" &&
    !Array.isArray(envelope?.route_receipt);
  return {
    satisfied: ok,
    evidence: { route_receipt_type: Array.isArray(envelope?.route_receipt) ? "array" : typeof envelope?.route_receipt }
  };
}

function probeRouteReceiptSchemaMatches(envelope) {
  const actual = envelope?.route_receipt?.schema ?? null;
  return {
    satisfied: actual === ROUTE_RECEIPT_SCHEMA,
    evidence: { expected: ROUTE_RECEIPT_SCHEMA, actual }
  };
}

function probeSelectedModelIdConsistent(envelope) {
  const envelopeSelected = envelope?.selected_model_id ?? null;
  const routeSelected = envelope?.route_receipt?.selected_model_id ?? null;
  return {
    satisfied: envelopeSelected === routeSelected,
    evidence: { envelope_value: envelopeSelected, route_value: routeSelected }
  };
}

function probeBoundaryShape9Key(envelope) {
  const boundary = envelope?.boundary;
  if (!boundary || typeof boundary !== "object") {
    return { satisfied: false, evidence: { reason: "boundary_missing_or_not_object" } };
  }
  const actualKeys = Object.keys(boundary).sort();
  const expectedKeys = Array.from(CANONICAL_ENVELOPE_BOUNDARY_KEYS);
  const matches = actualKeys.length === expectedKeys.length &&
    actualKeys.every((k, i) => k === expectedKeys[i]);
  return {
    satisfied: matches,
    evidence: { actual_keys: actualKeys, expected_keys: expectedKeys }
  };
}

function makeBoundaryFalseProbe(flagName) {
  return function probe(envelope) {
    const actual = envelope?.boundary?.[flagName];
    return {
      satisfied: actual === false,
      evidence: { flag: flagName, expected: false, actual }
    };
  };
}

function probeBoundaryLocalhostOnlyTrue(envelope) {
  const actual = envelope?.boundary?.localhost_only;
  return {
    satisfied: actual === true,
    evidence: { flag: "localhost_only", expected: true, actual }
  };
}

function probeInvocationStatusShape(envelope) {
  const result = envelope?.invocation_result;
  // When result is null (no selected model), the shape check is N/A → pass.
  if (result === null || result === undefined) {
    return {
      satisfied: true,
      evidence: { applicable: false, reason: "invocation_result_is_null" }
    };
  }
  const status = result?.invocation_status;
  const ok = status === "completed" || status === "failed";
  return {
    satisfied: ok,
    evidence: { applicable: true, actual: status, allowed: ["completed", "failed"] }
  };
}

function probeCompletedHasResponse(envelope) {
  const result = envelope?.invocation_result;
  if (!result || result.invocation_status !== "completed") {
    return { satisfied: true, evidence: { applicable: false } };
  }
  const responseLen =
    typeof result.response_length_chars === "number" ? result.response_length_chars : 0;
  const preview = typeof result.response_text_preview === "string" ? result.response_text_preview : "";
  const ok = responseLen > 0 || preview.length > 0;
  return {
    satisfied: ok,
    evidence: { applicable: true, response_length_chars: responseLen, preview_length: preview.length }
  };
}

function probeFailedHasErrorReason(envelope) {
  const result = envelope?.invocation_result;
  if (!result || result.invocation_status !== "failed") {
    return { satisfied: true, evidence: { applicable: false } };
  }
  const reason = result?.error_reason;
  const ok = typeof reason === "string" && reason.length > 0;
  return {
    satisfied: ok,
    evidence: { applicable: true, error_reason_present: ok, actual: reason }
  };
}

function probeNoSelectedModelMeansNullResult(envelope) {
  const sel = envelope?.selected_model_id ?? null;
  const result = envelope?.invocation_result;
  if (sel === null) {
    const ok = result === null;
    return { satisfied: ok, evidence: { applicable: true, selected_model_id: null, invocation_result_is_null: result === null } };
  }
  return { satisfied: true, evidence: { applicable: false } };
}

function probeParsedObjectIsPlain(envelope) {
  // After JSON.parse, a valid envelope is a plain object (not frozen by
  // parse). This probe confirms the parsed value is a plain object with
  // no surprising prototype.
  if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { satisfied: false, evidence: { reason: "not_a_plain_object" } };
  }
  const proto = Object.getPrototypeOf(envelope);
  const ok = proto === Object.prototype || proto === null;
  return { satisfied: ok, evidence: { prototype_is_canonical: ok } };
}

const INVARIANT_PROBES = Object.freeze([
  { name: "envelope_is_object", probe: probeEnvelopeIsObject },
  { name: "envelope_schema_matches", probe: probeEnvelopeSchemaMatches },
  { name: "route_receipt_present", probe: probeRouteReceiptPresent },
  { name: "route_receipt_schema_matches", probe: probeRouteReceiptSchemaMatches },
  { name: "selected_model_id_consistent", probe: probeSelectedModelIdConsistent },
  { name: "boundary_shape_9key", probe: probeBoundaryShape9Key },
  { name: "boundary_localhost_only_true", probe: probeBoundaryLocalhostOnlyTrue },
  { name: "boundary_remote_provider_false", probe: makeBoundaryFalseProbe("remote_provider") },
  { name: "boundary_federation_false", probe: makeBoundaryFalseProbe("federation") },
  { name: "boundary_mint_false", probe: makeBoundaryFalseProbe("mint") },
  { name: "boundary_token_economy_false", probe: makeBoundaryFalseProbe("token_economy") },
  { name: "boundary_urp_networking_false", probe: makeBoundaryFalseProbe("urp_networking") },
  { name: "invocation_status_shape", probe: probeInvocationStatusShape },
  { name: "completed_has_response", probe: probeCompletedHasResponse },
  { name: "failed_has_error_reason", probe: probeFailedHasErrorReason },
  { name: "no_selected_model_means_null_result", probe: probeNoSelectedModelMeansNullResult },
  { name: "parsed_object_is_plain", probe: probeParsedObjectIsPlain }
]);

export const INVARIANT_NAMES = Object.freeze(INVARIANT_PROBES.map((p) => p.name));

// ─── Summaries + next_step decision ──────────────────────────────────────────

function determineEvidenceQuality(invariants) {
  const satisfied = invariants.filter((i) => i.satisfied).length;
  const total = invariants.length;
  if (satisfied === total) return "high";
  if (satisfied / total >= 0.7) return "medium";
  return "low";
}

function determineInvocationStatusSummary(envelope) {
  const sel = envelope?.selected_model_id ?? null;
  if (sel === null) return "no_selection";
  const status = envelope?.invocation_result?.invocation_status;
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "unknown";
}

function determineNextStep({ verdict, invocationStatusSummary, errorReason, selectedModelId }) {
  if (verdict === "non_compliant") return "investigate_invariant_failures_in_verification_envelope";
  if (verdict === "inconclusive") return "investigate_source_envelope_readability";
  // compliant
  if (selectedModelId === null || invocationStatusSummary === "no_selection") {
    return "populate_operator_registry_with_active_local_models";
  }
  if (invocationStatusSummary === "completed") return "review_response_in_saved_envelope";
  if (invocationStatusSummary === "failed") {
    const reason = typeof errorReason === "string" ? errorReason : "";
    if (reason.includes("consent_phrase_mismatch")) return "retry_with_correct_invoke_consent_for_selected_model";
    if (reason.includes("model_not_in_whitelist")) return "update_operator_registry_to_use_whitelisted_model";
    if (reason.includes("prompt_empty") || reason.includes("prompt_too_long")) return "adjust_prompt_length_or_content";
    if (reason.includes("aborted") || reason.includes("timeout") || reason.includes("AbortError")) {
      return "increase_timeout_ms_or_check_local_model_load_state";
    }
    return "review_error_reason_in_saved_envelope";
  }
  return "review_saved_envelope_for_unknown_status";
}

function buildSelfCritique(invariants) {
  const failures = invariants.filter((i) => !i.satisfied);
  return failures.map((i) => `${i.name}: not satisfied`);
}

function buildRouteConsistencySummary(envelope) {
  return Object.freeze({
    envelope_selected_model_id: envelope?.selected_model_id ?? null,
    route_receipt_selected_model_id: envelope?.route_receipt?.selected_model_id ?? null,
    match: (envelope?.selected_model_id ?? null) === (envelope?.route_receipt?.selected_model_id ?? null)
  });
}

function buildBoundaryConsistencySummary(envelope) {
  const b = envelope?.boundary;
  if (!b || typeof b !== "object") {
    return Object.freeze({ boundary_present: false });
  }
  return Object.freeze({
    boundary_present: true,
    runtime: b.runtime === true,
    localhost_only: b.localhost_only === true,
    remote_provider: b.remote_provider === false,
    federation: b.federation === false,
    mint: b.mint === false,
    token_economy: b.token_economy === false,
    urp_networking: b.urp_networking === false
  });
}

// ─── Main verifier entry point ───────────────────────────────────────────────

export function verifyRoutedInvocationEnvelope(envelope, { source } = {}) {
  const invariants = INVARIANT_PROBES.map(({ name, probe }) => {
    const result = probe(envelope);
    return Object.freeze({
      name,
      satisfied: result.satisfied === true,
      evidence: Object.freeze(result.evidence ?? {})
    });
  });

  const satisfiedCount = invariants.filter((i) => i.satisfied).length;
  const verdict = satisfiedCount === invariants.length ? "compliant" : "non_compliant";

  const invocationStatusSummary = determineInvocationStatusSummary(envelope);
  const errorReason = envelope?.invocation_result?.error_reason ?? null;
  const selectedModelId = envelope?.selected_model_id ?? null;

  const nextStep = determineNextStep({
    verdict,
    invocationStatusSummary,
    errorReason,
    selectedModelId
  });

  const warnings = [];
  if (invocationStatusSummary === "failed") {
    warnings.push(`invocation_failed: ${errorReason ?? "unknown_reason"}`);
  }
  if (invocationStatusSummary === "no_selection") {
    warnings.push("no_selected_model_id_in_envelope");
  }

  return Object.freeze({
    schema: ROUTED_INVOCATION_VERIFICATION_SCHEMA,
    verified_at: new Date().toISOString(),
    source: Object.freeze(source ?? null),
    verdict,
    invariants: Object.freeze(invariants),
    invariants_satisfied_count: satisfiedCount,
    invariants_total_count: invariants.length,
    route_consistency: buildRouteConsistencySummary(envelope),
    boundary_consistency: buildBoundaryConsistencySummary(envelope),
    invocation_status_summary: invocationStatusSummary,
    evidence_quality: determineEvidenceQuality(invariants),
    self_critique: Object.freeze(buildSelfCritique(invariants)),
    warnings: Object.freeze(warnings),
    next_step: nextStep,
    boundary: Object.freeze({
      runtime: true,
      file_io: true,
      network_used: false,
      model_invocation: false,
      mutation: false,
      federation: false,
      mint: false,
      token_economy: false,
      urp_networking: false
    })
  });
}
