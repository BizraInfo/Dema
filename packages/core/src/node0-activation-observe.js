// NODE0-ACTIVATION-OBSERVE-1A — pure read-only observation kernel (Issue #243).
//
// Turns CALLER-GATHERED observations of the already-running local sovereign
// runtime into a deterministic, content-addressed, truth-labeled report. This
// kernel does ZERO I/O — all probing happens in the apps/cli gatherer, which
// passes a plain `observations` object in. The boundary block is ALL false on
// every path: this surface observes, it does not act.
//
// identity_status is derived from key-file PRESENCE only and is NEVER promoted
// to "VERIFIED" — that would require reading/validating key content, a boundary
// cross. This intentionally diverges from packages/core/src/dema-realm-home.js
// (which maps presence -> VERIFIED). Presence != content-validation; the
// stricter mapping here is the safer truth for an activation-observe surface.
//
// Mirrors the self-loop-ooda.js kernel shape: sha256/stableStringify content
// address, all-false CANONICAL_BOUNDARY, and a verify() that re-derives the
// load-bearing invariants so a recomputed report_hash cannot launder them.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const NODE0_ACTIVATION_OBSERVE_SCHEMA = "bizra.dema.node0_activation_observe.v0.1";
export const NODE0_ACTIVATION_OBSERVE_TRUTH_LABEL = "NODE0_ACTIVATION_OBSERVE_READ_ONLY";
const MODE = "READ_ONLY_OBSERVATION";

export const IDENTITY_STATES = Object.freeze(["UNKNOWN", "UNINITIALIZED", "LOCAL_ONLY", "VERIFIED"]);

// The 8 boundary keys from Issue #243's schema — all false, always.
const CANONICAL_BOUNDARY = Object.freeze({
  key_generated: false,
  signature_created: false,
  token_minted: false,
  federation_used: false,
  daemon_started_or_stopped: false,
  private_content_read: false,
  home_scan_performed: false,
  runtime_claim_promoted: false,
});

const WHAT_THIS_PROVES = Object.freeze([
  "Caller-gathered observations of the local Node0 runtime normalize into a deterministic, content-addressed, read-only snapshot.",
  "The snapshot binds key-file presence, sovereign liveness/readiness, and local-model reachability under one truth label.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "It is NOT autonomous; it starts, stops, or controls no daemon or runtime.",
  "It does not generate keys, sign, mint, reward, federate, or promote any runtime claim to live.",
  "It reads no private content and performs no home-directory scan; key-file presence is observed, never key content.",
  "Key-file presence does not prove a verified identity — identity_status is never promoted to VERIFIED here.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const text = (v) => (typeof v === "string" ? v.trim() : "");
const boolOrNull = (v) => (v === true ? true : v === false ? false : null);
const numOrNull = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const idList = (v) => (Array.isArray(v) ? Object.freeze([...new Set(v.map(text).filter(Boolean))].sort()) : Object.freeze([]));

function normalizeDemaRepo(d = {}) {
  return {
    git_present: d.git_present === true,
    package_name: text(d.package_name) || null,
    command_surface_count: numOrNull(d.command_surface_count),
  };
}

function normalizeSovereign(s = {}) {
  return {
    probed: s.probed === true,
    base_url: text(s.base_url) || null,
    live: boolOrNull(s.live),
    ready: boolOrNull(s.ready),
    http_status: numOrNull(s.http_status),
    error_class: text(s.error_class) || null,
  };
}

function normalizeProvider(p = {}) {
  return { probed: p.probed === true, reachable: p.reachable === true, model_ids: idList(p.model_ids) };
}

function normalizeLocalModels(m = {}) {
  return { lm_studio: normalizeProvider(m.lm_studio), ollama: normalizeProvider(m.ollama) };
}

function normalizeRoots(roots) {
  if (!Array.isArray(roots)) return Object.freeze([]);
  const out = roots
    .filter((r) => r && typeof r === "object")
    .map((r) => ({ path: text(r.path), exists: r.exists === true }))
    .filter((r) => r.path);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return Object.freeze(out);
}

// PRESENCE-only. Never returns "VERIFIED" (that requires key-content validation).
function deriveIdentityStatus(identity) {
  if (!identity || typeof identity !== "object") return "UNKNOWN";
  if (identity.key_file_present === true) return "LOCAL_ONLY";
  if (identity.key_file_present === false) return "UNINITIALIZED";
  return "UNKNOWN";
}

function deriveActivationGapMap({ sovereign, localModels, identityStatus }) {
  const gaps = [];
  if (sovereign.live !== true || sovereign.ready !== true) {
    gaps.push({
      gap: "sovereign_not_live_ready",
      observed: sovereign.error_class || `live=${sovereign.live} ready=${sovereign.ready}`,
      suggestion: "Start the sovereign runtime via its governed entrypoint; Dema observes it, it does not start it.",
    });
  }
  const anyModel = localModels.lm_studio.reachable || localModels.ollama.reachable;
  if (!anyModel) {
    gaps.push({
      gap: "no_local_model_reachable",
      observed: "lm_studio + ollama both unreachable or empty",
      suggestion: "Load a model in your local provider (LM Studio / Ollama / llama.cpp); observation only.",
    });
  }
  if (identityStatus === "UNINITIALIZED") {
    gaps.push({ gap: "identity_uninitialized", observed: "no key file present", suggestion: "Key creation is operator-only and out of scope for this read-only surface." });
  }
  if (identityStatus === "UNKNOWN") {
    gaps.push({ gap: "identity_unknown", observed: "key presence not observed", suggestion: "Re-run with a resolvable key path; this surface checks presence only." });
  }
  return Object.freeze(gaps.map((g) => Object.freeze(g)));
}

// Cognition liveness — distinguishes "sovereign up" from "Node0 is actually
// thinking" (a model loaded in VRAM and/or the seed engine active). Pure: derives
// only from caller-gathered observations. This is the signal whose absence let
// cognition sit dormant unnoticed for days behind a healthy-looking API.
function deriveCognitionStatus(cognition = {}) {
  const c = cognition && typeof cognition === "object" ? cognition : {};
  const loaded =
    typeof c.models_loaded_in_vram === "number" ? c.models_loaded_in_vram : null;
  const seed =
    typeof c.seed_engine_active === "boolean" ? c.seed_engine_active : null;
  const loaded_model_ids = Array.isArray(c.loaded_model_ids)
    ? c.loaded_model_ids.filter((x) => typeof x === "string")
    : [];
  let verdict;
  if (loaded === null && seed === null) verdict = "UNKNOWN";
  else if ((loaded ?? 0) >= 1 || seed === true) verdict = "LIVE_THINKING";
  else verdict = "DORMANT_LISTENING";
  return Object.freeze({
    probed: c.probed === true,
    verdict,
    models_loaded_in_vram: loaded,
    seed_engine_active: seed,
    loaded_model_ids: Object.freeze(loaded_model_ids),
  });
}

function deriveNextSafeAction({ sovereign, cognition, gapCount }) {
  if (sovereign.live !== true) {
    return `Sovereign not confirmed live at ${sovereign.base_url || "the configured URL"}; start it via its governed entrypoint. Dema will not start it.`;
  }
  if (cognition && cognition.verdict === "DORMANT_LISTENING") {
    return "Sovereign live but cognition DORMANT (no model in VRAM, seed engine inactive) — wake it with a consent-gated local model call, e.g. `dema talk --consent`. Observation only.";
  }
  if (sovereign.ready === true && gapCount === 0) {
    return "Sovereign live and ready; observation only — no action needed.";
  }
  return "Observation surfaced gaps above; each carries a read-only suggestion. No action is taken by this command.";
}

export function buildNode0ActivationObserve(observations = {}) {
  const dema_repo_status = normalizeDemaRepo(observations.dema_repo);
  const sovereign_runtime_status = normalizeSovereign(observations.sovereign);
  const local_model_status = normalizeLocalModels(observations.local_models);
  const canonical_roots = normalizeRoots(observations.canonical_roots);
  const identity_status = deriveIdentityStatus(observations.identity);
  const cognition_status = deriveCognitionStatus(observations.cognition);
  const activation_gap_map = deriveActivationGapMap({
    sovereign: sovereign_runtime_status,
    localModels: local_model_status,
    identityStatus: identity_status,
  });
  const next_safe_action = deriveNextSafeAction({
    sovereign: sovereign_runtime_status,
    cognition: cognition_status,
    gapCount: activation_gap_map.length,
  });

  const body = {
    schema: NODE0_ACTIVATION_OBSERVE_SCHEMA,
    truth_label: NODE0_ACTIVATION_OBSERVE_TRUTH_LABEL,
    mode: MODE,
    dema_repo_status,
    sovereign_runtime_status,
    local_model_status,
    cognition_status,
    canonical_roots,
    identity_status,
    activation_gap_map,
    next_safe_action,
    boundary: { ...CANONICAL_BOUNDARY },
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  };

  return deepFreeze({ ...body, report_hash: sha256(stableStringify(body)) });
}

export function verifyNode0ActivationObserve(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return deepFreeze({ valid: false, rejected: true, reason_code: "report_malformed" });
  }
  const blocked_by = [];
  if (report.schema !== NODE0_ACTIVATION_OBSERVE_SCHEMA) blocked_by.push("schema_mismatch");
  if (report.truth_label !== NODE0_ACTIVATION_OBSERVE_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (report.mode !== MODE) blocked_by.push("mode_mismatch");

  // Boundary must be present and EVERY value false — re-checked independent of the hash.
  if (!report.boundary || typeof report.boundary !== "object") blocked_by.push("boundary_missing");
  else {
    for (const key of Object.keys(CANONICAL_BOUNDARY)) {
      if (report.boundary[key] !== false) blocked_by.push(`boundary_not_false:${key}`);
    }
  }

  // identity_status must be in the enum AND never the promoted "VERIFIED" — the
  // kernel never emits it, so its presence (even with a recomputed hash) is a
  // laundering attempt.
  if (!IDENTITY_STATES.includes(report.identity_status)) blocked_by.push("identity_status_invalid");
  if (report.identity_status === "VERIFIED") blocked_by.push("identity_status_promoted");

  // Re-derive the load-bearing attestation prose — verify must not trust stored text.
  if (stableStringify(report.what_this_proves) !== stableStringify(WHAT_THIS_PROVES)) blocked_by.push("what_this_proves_mismatch");
  if (stableStringify(report.what_this_does_not_prove) !== stableStringify(WHAT_THIS_DOES_NOT_PROVE)) blocked_by.push("what_this_does_not_prove_mismatch");

  // next_safe_action is a suggestion STRING — never an executed action.
  if (typeof report.next_safe_action !== "string") blocked_by.push("next_safe_action_not_string");

  const { report_hash, ...body } = report;
  if (!report_hash || sha256(stableStringify(body)) !== report_hash) blocked_by.push("report_hash_mismatch");

  if (blocked_by.length > 0) {
    return deepFreeze({ valid: false, rejected: true, reason_code: "node0_activation_observe_invalid", blocked_by });
  }
  return deepFreeze({ valid: true, rejected: false, reason_code: "node0_activation_observe_valid", report_hash });
}
