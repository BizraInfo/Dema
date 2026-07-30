// First Light pure consent-context construction and re-derivation.

import { createHash } from "node:crypto";

import { sha256CanonicalJsonV1 } from "../../../../packages/canon/src/sha256-canonical-json-v1.js";
import { buildConsentContext } from "../../../../packages/consent/src/root-bound-consent-envelope-preview.js";
import { buildLocalLlmProviderRoute } from "../../../../packages/core/src/local-llm-provider-router.js";

const ACTION_CLASS = "C3_LOCAL_WRITE";

function hashText(value) {
  return `sha256:${createHash("sha256")
    .update(String(value), "utf8")
    .digest("hex")}`;
}

function blocked(reason) {
  return { ok: false, blocked_by: [reason] };
}

export function buildFirstLightPreparedContext({
  scope,
  question,
  provider,
  model,
  dema_home,
  nonce,
  expires_at_iso,
}) {
  const route = buildLocalLlmProviderRoute({
    provider,
    model,
    prompt: "first-light-consent-preview",
  });
  const routeBlocked = [];
  if (route.router_status !== "preview_ready") {
    routeBlocked.push("provider_route_blocked");
  }
  if (route.target_is_localhost !== true) {
    routeBlocked.push("provider_not_localhost");
  }
  if (route.model_allowed !== true) routeBlocked.push("model_not_allowed");
  if (routeBlocked.length) {
    return { ok: false, blocked_by: routeBlocked };
  }

  const questionHash = hashText(question);
  const missionHash = sha256CanonicalJsonV1({
    root_set_hash: scope.root_set_hash,
    question_hash: questionHash,
    provider: route.selected_provider,
    model: route.model,
    state_root_hash: hashText(dema_home),
    nonce,
  }).slice("sha256:".length);
  const mission_id = `first-light-${missionHash.slice(0, 20)}`;
  const proposal_hash = sha256CanonicalJsonV1({
    mission_id,
    objective: "answer one grounded local-corpus question",
  });
  const capability_scope_hash = sha256CanonicalJsonV1({
    capabilities: [
      "read_selected_root",
      "index_local_text",
      "retrieve_bounded_excerpts",
      "invoke_named_local_model",
      "write_first_light_state_under_dema_home",
    ],
    state_root_path: dema_home,
  });
  const payload_hash = sha256CanonicalJsonV1({
    question_hash: questionHash,
    root_set_hash: scope.root_set_hash,
    provider: route.selected_provider,
    model: route.model,
    state_root_path: dema_home,
  });
  const envelope = buildConsentContext({
    proposal_hash,
    action_class: ACTION_CLASS,
    capability_scope_hash,
    payload_hash,
    root_set_hash: scope.root_set_hash,
    nonce,
    expires_at: expires_at_iso,
    required_phrase: route.consent_phrase,
  });
  return {
    ok: true,
    mission_id,
    question,
    provider: route.selected_provider,
    model: route.model,
    dema_home,
    target_endpoint: route.provider_base_url,
    required_phrase: route.consent_phrase,
    route,
    envelope,
  };
}

export function verifyFirstLightPreparedContext(prepared) {
  const scope = prepared?.scope;
  const envelope = prepared?.envelope;
  if (!scope || !envelope) return blocked("prepared_context_invalid");
  const { root_set_hash, ...scopeBody } = scope;
  try {
    if (sha256CanonicalJsonV1(scopeBody) !== root_set_hash) {
      return blocked("prepared_scope_hash_mismatch");
    }
  } catch {
    return blocked("prepared_scope_hash_mismatch");
  }
  if (root_set_hash !== envelope.root_set_hash) {
    return blocked("prepared_scope_context_mismatch");
  }
  let rebuilt;
  try {
    rebuilt = buildFirstLightPreparedContext({
      scope,
      question: prepared.question,
      provider: prepared.provider,
      model: prepared.model,
      dema_home: prepared.dema_home,
      nonce: envelope.nonce,
      expires_at_iso: envelope.expires_at,
    });
  } catch {
    return blocked("prepared_context_mismatch");
  }
  if (
    !rebuilt.ok ||
    rebuilt.mission_id !== prepared.mission_id ||
    rebuilt.envelope.consent_context_hash !== envelope.consent_context_hash ||
    rebuilt.required_phrase !== prepared.required_phrase ||
    rebuilt.dema_home !== prepared.dema_home ||
    rebuilt.target_endpoint !== prepared.target_endpoint
  ) {
    return blocked("prepared_context_mismatch");
  }
  return { ok: true, rebuilt };
}
