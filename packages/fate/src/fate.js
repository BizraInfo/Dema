import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const FATE_EFFECT_ADMISSION_SCHEMA = "bizra.dema.fate.effect_admission.v1";
export const FATE_EFFECT_ADMISSION_REQUEST_SCHEMA = "bizra.dema.fate.effect_admission_request.v1";
export const FATE_EFFECT_POLICY = Object.freeze({
  schema: "bizra.fate.policy.v1",
  version: "1",
  default: "REFUSE",
  effect_classes: Object.freeze({
    LOCAL_CONSEQUENTIAL: Object.freeze({
      human_grant_class: "CURRENT_TURN_GRANT",
      protected_acts: Object.freeze(["DEPLOY"]),
      network_scope: "LOOPBACK_ONLY",
    }),
  }),
  forbidden_effects: Object.freeze([
    "gateway_mutation",
    "bridge_mutation",
    "real_DEMA_HOME_mutation",
    "public_network",
    "remote_git",
    "keys_signers",
    "economic_effect",
  ]),
  fail_closed_on: Object.freeze([
    "unknown_policy",
    "expired_authority",
    "scope_mismatch",
    "missing_required_evidence",
    "authority_widening",
  ]),
});
export const FATE_EFFECT_POLICY_DIGEST = sha256CanonicalJsonV1(FATE_EFFECT_POLICY);

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const SUPPORTED_EFFECT_CLASS = "LOCAL_CONSEQUENTIAL";

export function evaluateConsent({ phrase, requiredPhrase }) {
  const accepted = phrase === requiredPhrase;
  return {
    schema: "bizra.dema.fate_consent.v0.1",
    accepted,
    verdict: accepted ? "PERMIT_PREVIEW" : "BLOCK",
    truthLabel: "MEASURED",
    reason: accepted
      ? "Exact consent phrase matched."
      : "Exact consent phrase not provided.",
    requirement: "Exact phrase match; no fuzzy consent.",
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function check(name, ok, reason) {
  return Object.freeze({ name, ok: ok === true, reason: ok === true ? null : reason });
}

function targetPath(target) {
  if (typeof target === "string") return target;
  if (isRecord(target) && typeof target.path === "string") return target.path;
  return null;
}

function forbiddenTarget(target) {
  const value = String(target ?? "").toLowerCase();
  const normalized = value.replaceAll("\\", "/");
  // DEMA_HOME is a reserved path token, not an arbitrary filename prefix.
  // Keep product/service names such as `dema-homebase.service.d` admissible.
  const realDemaHome = /(?:^|\/)(?:\.dema|dema[-_]home)(?:\/|$)/i.test(normalized);
  return /(gateway|bridge|cloud|dns|public|remote|signer|key|economic|token)/i.test(value) || realDemaHome;
}

function loopbackScope(scope) {
  if (!isRecord(scope) || scope.mode !== "LOOPBACK_ONLY" || scope.external !== false) return false;
  if (scope.host !== undefined && !["127.0.0.1", "::1"].includes(scope.host)) return false;
  if (Array.isArray(scope.addresses) && !scope.addresses.every((address) => ["127.0.0.1", "::1"].includes(address))) return false;
  return true;
}

function failureReasons(checks) {
  return Object.freeze(checks.filter((item) => !item.ok).map((item) => item.reason));
}

function verdictRef(body) {
  return sha256CanonicalJsonV1(body);
}

function normalizeAdmissionInput(input) {
  if (!isRecord(input)) return input;
  const effect = isRecord(input.effect) ? input.effect : {};
  const human = isRecord(input.human_grant)
    ? input.human_grant
    : isRecord(input.human?.grant)
      ? input.human.grant
      : input.human_grant;
  return {
    ...input,
    effect_class: input.effect_class ?? effect.class ?? effect.effect_class,
    protected_acts: input.protected_acts ?? effect.protected_acts,
    targets: input.targets ?? effect.targets,
    network_scope: input.network_scope ?? effect.network_scope,
    forbidden_effects: input.forbidden_effects ?? effect.forbidden_effects,
    human_grant: human,
  };
}

function buildAdmissionVerdict({ status, input, checks, blockedBy, testOnly }) {
  const grant = isRecord(input?.human_grant) ? input.human_grant : {};
  const policy = isRecord(input?.policy) ? input.policy : {};
  const body = {
    schema: FATE_EFFECT_ADMISSION_SCHEMA,
    status,
    situation_commitment: typeof input?.situation_commitment === "string" ? input.situation_commitment : null,
    action_commitment: typeof input?.action_commitment === "string" ? input.action_commitment : null,
    human_grant_ref: typeof grant.grant_ref === "string" ? grant.grant_ref : null,
    human_grant_class: typeof grant.grant_class === "string" ? grant.grant_class : null,
    protected_acts: Array.isArray(input?.protected_acts) ? [...input.protected_acts] : [],
    policy: {
      version: typeof policy.version === "string" ? policy.version : null,
      digest: typeof policy.digest === "string" ? policy.digest : null,
    },
    checks: checks.map(({ name, ok, reason }) => ({ name, ok, reason })),
    blocked_by: [...blockedBy],
    test_only: testOnly === true,
    authority_delta: 0,
  };
  return Object.freeze({
    ...body,
    verdict_ref: verdictRef(body),
    truth_label: "MEASURED_FATE_EFFECT_POLICY_EVALUATION",
  });
}

/**
 * Evaluate an already-structured effect proposal. This is policy admission,
 * not consent collection, execution, or proof of effect completion.
 */
export function evaluateEffectAdmission(input = {}) {
  const normalized = normalizeAdmissionInput(input);
  const grant = isRecord(normalized?.human_grant) ? normalized.human_grant : {};
  const policy = isRecord(normalized?.policy) ? normalized.policy : {};
  const targets = Array.isArray(normalized?.targets) ? normalized.targets.map(targetPath) : [];
  const targetScope = Array.isArray(grant.target_scope) ? grant.target_scope : [];
  const declaredForbidden = Array.isArray(normalized?.forbidden_effects) ? normalized.forbidden_effects : [];
  const declaredEffects = Array.isArray(normalized?.effects) ? normalized.effects : [];
  const checks = [
    check("request_schema", normalized?.schema === FATE_EFFECT_ADMISSION_REQUEST_SCHEMA, "request_schema_invalid"),
    check("situation_commitment", HASH_RE.test(normalized?.situation_commitment ?? ""), "situation_commitment_missing"),
    check("action_commitment", HASH_RE.test(normalized?.action_commitment ?? ""), "action_commitment_missing"),
    check("human_grant_present", isRecord(normalized?.human_grant), "human_grant_missing"),
    check("human_grant_ref", typeof grant.grant_ref === "string" && grant.grant_ref.length > 0, "human_grant_ref_missing"),
    check("human_grant_class", grant.grant_class === "CURRENT_TURN_GRANT", "human_grant_class_invalid"),
    check("human_scope_match", grant.scope_match === true, "human_scope_not_matched"),
    check("grant_covers_deploy", Array.isArray(grant.protected_acts) && grant.protected_acts.length === 1 && grant.protected_acts[0] === "DEPLOY", "human_grant_does_not_cover_deploy"),
    check("grant_action_binding", grant.action_commitment === normalized?.action_commitment, "human_grant_action_mismatch"),
    check("grant_situation_binding", grant.situation_commitment === normalized?.situation_commitment, "human_grant_situation_mismatch"),
    check("grant_status", grant.status === "CURRENT", "human_grant_stale"),
    check("effect_class", normalized?.effect_class === SUPPORTED_EFFECT_CLASS, "effect_class_unrecognized"),
    check("protected_acts", Array.isArray(normalized?.protected_acts) && normalized.protected_acts.length === 1 && normalized.protected_acts[0] === "DEPLOY", "protected_act_mismatch"),
    check("targets_present", targets.length > 0 && targets.every((target) => typeof target === "string" && target.length > 0), "targets_missing_or_malformed"),
    check("target_scope", targets.length > 0 && targets.every((target) => targetScope.includes(target)), "target_scope_mismatch"),
    check("network_scope", loopbackScope(normalized?.network_scope), "network_scope_not_loopback_only"),
    check("forbidden_effects_declared", FATE_EFFECT_POLICY.forbidden_effects.every((name) => declaredForbidden.includes(name)), "forbidden_effects_incomplete"),
    check("forbidden_targets_absent", targets.every((target) => !forbiddenTarget(target)), "forbidden_target_scope"),
    check("forbidden_effects_absent", declaredEffects.every((effect) => !FATE_EFFECT_POLICY.forbidden_effects.includes(effect)), "forbidden_effect_present"),
    check("authority_delta", normalized?.authority_delta === 0 && grant.authority_delta === 0, "authority_widening"),
    check("policy_identity", policy.version === FATE_EFFECT_POLICY.version && policy.digest === FATE_EFFECT_POLICY_DIGEST, "unknown_policy"),
  ];

  if (grant.expires_at !== undefined) {
    const evaluatedAt = Date.parse(grant.evaluated_at ?? "");
    const expiresAt = Date.parse(grant.expires_at);
    checks.push(check("grant_freshness", Number.isFinite(evaluatedAt) && Number.isFinite(expiresAt) && expiresAt > evaluatedAt, "human_grant_expired_or_unbound"));
  }

  const blockedBy = failureReasons(checks);
  const status = blockedBy.length === 0 ? "ADMITTED" : "REFUSED";
  return buildAdmissionVerdict({
    status,
    input: normalized,
    checks,
    blockedBy,
    testOnly: grant.test_only === true || String(grant.grant_ref ?? "").startsWith("TEST_ONLY:"),
  });
}

/** Execute-phase correspondence check. It never executes an effect. */
export function validateEffectAdmissionForExecution({ admission, proposal } = {}) {
  if (!isRecord(admission) || admission.schema !== FATE_EFFECT_ADMISSION_SCHEMA) {
    return Object.freeze({ ok: false, blocked_by: ["fate_verdict_missing"] });
  }
  if (admission.status !== "ADMITTED") {
    return Object.freeze({ ok: false, blocked_by: ["fate_not_admitted", ...(admission.blocked_by ?? [])] });
  }
  const grant = isRecord(proposal?.human_grant) ? proposal.human_grant : {};
  if (admission.test_only === true || grant.test_only === true || String(grant.grant_ref ?? "").startsWith("TEST_ONLY:")) {
    return Object.freeze({ ok: false, blocked_by: ["test_fixture_not_runtime_authorization"] });
  }
  if (grant.attested_by !== "MUMU") {
    return Object.freeze({ ok: false, blocked_by: ["human_grant_not_attested"] });
  }
  const recomputed = evaluateEffectAdmission(proposal);
  const mismatches = [];
  if (recomputed.status !== "ADMITTED") mismatches.push("fate_recomputation_refused");
  if (recomputed.verdict_ref !== admission.verdict_ref) mismatches.push("fate_verdict_stale");
  if (admission.action_commitment !== proposal?.action_commitment) mismatches.push("fate_action_commitment_mismatch");
  if (admission.situation_commitment !== proposal?.situation_commitment) mismatches.push("fate_situation_commitment_mismatch");
  if (admission.human_grant_ref !== grant.grant_ref) mismatches.push("fate_human_grant_mismatch");
  return Object.freeze({ ok: mismatches.length === 0, blocked_by: Object.freeze(mismatches), verdict_ref: admission.verdict_ref });
}
