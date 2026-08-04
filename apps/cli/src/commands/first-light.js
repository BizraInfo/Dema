// NODE0-FIRST-LIGHT-0A — consented local folder → retrieval → model → proof.
//
// The adapter joins existing consent and local-model rails. Filesystem effects
// are isolated in first-light-storage.js; deterministic truth kernels stay in
// packages/core.

import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { evaluateContextBoundConsent } from "../../../../packages/consent/src/root-bound-consent-envelope-preview.js";
import {
  DEMA_TALK_LOOP_LIVE_RESULT_SCHEMA,
  invokeDemaTalkLive,
} from "../../../../packages/core/src/dema-talk-loop-live.js";
import { isRuntimeEmissionBoundaryShape } from "../../../../packages/core/src/preview-boundary.js";
import {
  buildFirstLightIndex,
  retrieveFirstLightSources,
  buildFirstLightPrompt,
  composeFirstLightAnswer,
  buildFirstLightReceipt,
  buildFirstLightProofCard,
} from "../../../../packages/core/src/node0-first-light.js";
import {
  firstLightBlocked,
  gatherFirstLightScope,
  reserveFirstLightNonce,
  readFirstLightDocuments,
  persistFirstLightMission,
  finalizeFirstLightMission,
} from "./first-light-storage.js";
import { resumeFirstLightMission } from "./first-light-resume.js";
import {
  buildFirstLightPreparedContext,
  verifyFirstLightPreparedContext,
} from "./first-light-context.js";

export { resumeFirstLightMission };

export async function prepareFirstLightMission({
  root_path,
  question,
  provider = "ollama",
  model = "qwen3:4b",
  dema_home,
  nonce,
  now_iso,
  expires_at_iso,
} = {}) {
  if (typeof question !== "string" || question.trim().length === 0) {
    return firstLightBlocked("question_required");
  }
  if (typeof nonce !== "string" || nonce.length === 0) {
    return firstLightBlocked("nonce_required");
  }
  if (Number.isNaN(Date.parse(now_iso ?? ""))) {
    return firstLightBlocked("now_invalid");
  }
  if (
    Number.isNaN(Date.parse(expires_at_iso ?? "")) ||
    Date.parse(now_iso) >= Date.parse(expires_at_iso)
  ) {
    return firstLightBlocked("expires_at_invalid");
  }
  const scoped = await gatherFirstLightScope(root_path);
  if (!scoped.ok) return scoped;
  const demaHome = resolve(
    dema_home || process.env.DEMA_HOME || join(homedir(), ".dema"),
  );
  const overlaps = (parent, candidate) => {
    const rel = relative(parent, candidate);
    return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
  };
  if (
    overlaps(scoped.scope.root_path, demaHome) ||
    overlaps(demaHome, scoped.scope.root_path)
  ) {
    return firstLightBlocked("state_root_overlaps_corpus");
  }
  let context;
  try {
    context = buildFirstLightPreparedContext({
      scope: scoped.scope,
      question: question.trim(),
      provider,
      model,
      dema_home: demaHome,
      nonce,
      expires_at_iso,
    });
  } catch {
    return firstLightBlocked("prepared_context_not_canonicalizable");
  }
  return context.ok ? { ...context, scope: scoped.scope, now_iso } : context;
}

function presentedFor(prepared, phrase) {
  const envelope = prepared.envelope;
  return {
    phrase,
    proposal_hash: envelope.proposal_hash,
    payload_hash: envelope.payload_hash,
    capability_scope_hash: envelope.capability_scope_hash,
    action_class: envelope.action_class,
    root_set_hash: envelope.root_set_hash,
  };
}

function verifyModelResult(modelResult, prepared) {
  if (
    modelResult?.invocation_status !== "completed" ||
    typeof modelResult.response_text !== "string"
  ) {
    return firstLightBlocked(
      modelResult?.error_reason || "model_invocation_incomplete",
    );
  }
  const blocked = [];
  if (modelResult.schema !== DEMA_TALK_LOOP_LIVE_RESULT_SCHEMA) {
    blocked.push("model_result_schema_mismatch");
  }
  if (modelResult.truth_label !== "MEASURED") {
    blocked.push("model_result_truth_label_mismatch");
  }
  if (modelResult.provider !== prepared.provider) {
    blocked.push("model_result_provider_mismatch");
  }
  if (modelResult.model !== prepared.model) {
    blocked.push("model_result_model_mismatch");
  }
  if (modelResult.target_endpoint !== prepared.target_endpoint) {
    blocked.push("model_result_endpoint_mismatch");
  }
  if (
    modelResult.consent_phrase_verified !== true ||
    modelResult.required_consent !== prepared.required_phrase
  ) {
    blocked.push("model_result_consent_unverified");
  }
  if (
    modelResult.prompt_safety_verdict !== "LOCAL_TALK_OK" ||
    modelResult.response_safety_verdict !== "LOCAL_TALK_OK"
  ) {
    blocked.push("model_result_safety_blocked");
  }
  if (modelResult.verdict_role !== "suggestion") {
    blocked.push("model_result_role_mismatch");
  }
  const boundary = modelResult.boundary;
  if (
    !isRuntimeEmissionBoundaryShape(boundary) ||
    boundary.network_used !== true ||
    boundary.runtime_execution_performed !== true ||
    boundary.model_loaded !== true ||
    boundary.model_invocation_performed !== true ||
    boundary.prompt_executed !== true ||
    boundary.consent_collected !== true ||
    boundary.content_read !== false
  ) {
    blocked.push("model_result_boundary_mismatch");
  }
  return blocked.length ? firstLightBlocked(blocked) : { ok: true };
}

export async function executeFirstLightMission({
  prepared,
  presented_phrase,
  now_iso,
  dema_home,
  model_invoker = invokeDemaTalkLive,
} = {}) {
  try {
    prepared = structuredClone(prepared);
  } catch {
    return firstLightBlocked("prepared_context_invalid");
  }
  if (!prepared?.ok || !prepared.envelope || !prepared.scope) {
    return firstLightBlocked("prepared_context_invalid");
  }
  const preparedVerdict = verifyFirstLightPreparedContext(prepared);
  if (!preparedVerdict.ok) return preparedVerdict;
  const verdict = evaluateContextBoundConsent({
    envelope: prepared.envelope,
    presented: presentedFor(prepared, presented_phrase),
    now: now_iso,
    usedNonces: [],
  });
  if (!verdict.accepted) return firstLightBlocked(verdict.blocked_by);

  const rescoped = await gatherFirstLightScope(prepared.scope.root_path);
  if (!rescoped.ok) return rescoped;
  if (rescoped.scope.root_set_hash !== prepared.scope.root_set_hash) {
    return firstLightBlocked("root_set_changed_after_consent");
  }

  const demaHome = resolve(dema_home || prepared.dema_home);
  if (demaHome !== prepared.dema_home) {
    return firstLightBlocked("state_root_context_mismatch");
  }
  const reserved = await reserveFirstLightNonce(demaHome, prepared, now_iso);
  if (!reserved.ok) return reserved;
  const read = await readFirstLightDocuments(prepared.scope);
  if (!read.ok) return read;

  const index = buildFirstLightIndex({
    mission_id: prepared.mission_id,
    root_path: prepared.scope.root_path,
    documents: read.documents,
    indexed_at_iso: now_iso,
  });
  if (index.rejected) return firstLightBlocked(index.blocked_by);
  const retrieval = retrieveFirstLightSources({
    index,
    documents: read.documents,
    question: prepared.question,
    max_sources: 5,
  });
  if (retrieval.rejected) return firstLightBlocked(retrieval.blocked_by);
  const prompt = buildFirstLightPrompt({
    question: prepared.question,
    retrieval,
  });
  if (prompt.rejected) return firstLightBlocked(prompt.blocked_by);

  let modelResult;
  try {
    modelResult = await model_invoker({
      provider: prepared.provider,
      model: prepared.model,
      prompt: prompt.prompt_text,
      consentPhrase: prepared.required_phrase,
      includeResponseText: true,
    });
  } catch {
    return firstLightBlocked("model_invocation_threw");
  }
  const modelVerdict = verifyModelResult(modelResult, prepared);
  if (!modelVerdict.ok) return modelVerdict;
  const answer_text = composeFirstLightAnswer({
    response_text: modelResult.response_text,
    retrieval,
  });
  const receipt = buildFirstLightReceipt({
    mission_id: prepared.mission_id,
    root_path: prepared.scope.root_path,
    root_set_hash: prepared.scope.root_set_hash,
    consent: {
      verified: true,
      action_class: prepared.envelope.action_class,
      consent_context_hash: prepared.envelope.consent_context_hash,
      phrase_hash: prepared.envelope.phrase_hash,
    },
    index,
    question: prepared.question,
    retrieval,
    prompt,
    model_result: {
      provider: modelResult.provider,
      model: modelResult.model,
      target_endpoint: modelResult.target_endpoint,
      response_text: modelResult.response_text,
    },
    answer_text,
    observed_at_iso: now_iso,
  });
  if (receipt.rejected) return firstLightBlocked(receipt.blocked_by);
  const proof_card = buildFirstLightProofCard(receipt);
  if (proof_card.rejected) return firstLightBlocked(proof_card.blocked_by);
  const persisted = await persistFirstLightMission({
    demaHome,
    prepared,
    index,
    receipt,
    card: proof_card,
    nowIso: now_iso,
  });
  if (!persisted.ok) return persisted;
  const provisional = await resumeFirstLightMission({
    dema_home: demaHome,
    mission_id: prepared.mission_id,
    allow_provisional: true,
  });
  if (
    !provisional.ok ||
    provisional.verification_state !== "PROVISIONAL_VERIFIED"
  ) {
    return firstLightBlocked(
      "persisted_verification_failed",
      provisional.blocked_by,
    );
  }
  const finalized = await finalizeFirstLightMission({
    demaHome,
    mission_id: prepared.mission_id,
    receipt_id: receipt.receipt_id,
    completedAtIso: now_iso,
  });
  if (!finalized.ok) return finalized;
  const resumed = await resumeFirstLightMission({
    dema_home: demaHome,
    mission_id: prepared.mission_id,
  });
  if (!resumed.ok) {
    return firstLightBlocked("persisted_verification_failed", resumed.blocked_by);
  }
  return {
    ok: true,
    blocked_by: [],
    mission_id: prepared.mission_id,
    answer_text,
    index,
    receipt,
    proof_card,
    paths: persisted.paths,
    verification_state: resumed.verification_state,
  };
}
