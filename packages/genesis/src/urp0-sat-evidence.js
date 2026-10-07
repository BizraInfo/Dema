// BIZRA-GENESIS-G5B-1A — durable SAT evidence packet contract.
//
// Pure packet construction and validation. Filesystem persistence stays in the
// named genesis I/O adapter (scripts/genesis/urp0-store.mjs), so this module
// does not become a second state owner or a hidden writer.

import { canonicalizeJsonV1 } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { REQUIRED_EVIDENCE_KEYS } from "./urp0-sat5.js";

export const SAT_EVIDENCE_PACKET_SCHEMA = "bizra.genesis.sat_evidence_packet.v1";
export const SAT_EVIDENCE_PACKET_VERSION = "v1";

const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}

function contained(root, candidate) {
  if (typeof root !== "string" || typeof candidate !== "string" || root === "" || candidate === "") return false;
  const base = root.endsWith("/") ? root : root + "/";
  return candidate === root || candidate.startsWith(base);
}

function addDigestFailure(blocked_by, name, value) {
  if (!SHA256_DIGEST.test(value ?? "")) blocked_by.push("digest_malformed:" + name);
}

function eventBindings(evidence, mission_id, attempt_id, blocked_by) {
  if (!Array.isArray(evidence.events) || evidence.events.length === 0) return;
  const relevant = evidence.events.filter((event) => event?.payload?.attempt_id === attempt_id);
  if (relevant.length === 0) blocked_by.push("attempt_events_missing");
  for (const event of relevant) {
    const eventMission = event?.payload?.mission_id;
    if (eventMission !== undefined && eventMission !== mission_id) blocked_by.push("event_mission_id_mismatch");
  }
}

function bodyFor({ mission_id, attempt_id, evidence, judgment, journal_binding, effect_phase_declared_write_paths, control_plane_write_paths }) {
  return {
    schema: SAT_EVIDENCE_PACKET_SCHEMA,
    evidence_contract_version: SAT_EVIDENCE_PACKET_VERSION,
    mission_id,
    attempt_id,
    authority: {
      admission_contract: evidence.admission_contract,
      consent_context: evidence.consent_context,
      consent_context_hash: evidence.consent_context_hash,
      submitted_phrase: evidence.submitted_phrase,
      authorized_at_iso: evidence.authorized_at_iso,
    },
    execution: {
      sat_set: evidence.sat_set,
      resource_offer: evidence.resource_offer,
      contract: evidence.contract,
      contract_hash: evidence.contract_hash,
      observation: evidence.observation,
      result: evidence.result,
      result_hash: evidence.receipt_body.result_hash,
      provisional_receipt_body: evidence.receipt_body,
      provisional_receipt_hash: evidence.receipt_hash,
    },
    effects: {
      effect_phase_declared_write_paths,
      source_fingerprint_before: evidence.source_fingerprint_before,
      source_fingerprint_after: evidence.source_fingerprint_after,
    },
    state: {
      previous_state_root: evidence.previous_state_root,
      resulting_state_root: evidence.resulting_state_root,
      state_root_dir: evidence.state_root_dir,
    },
    journal_binding,
    control_plane_write_paths,
    judgment,
    judgment_hash: judgment.judgment_hash,
    // Keep the exact SAT input intact. Later G5B readers can pass this object
    // directly to judgeUrp0Mission without reconstructing it from summaries.
    evidence,
    digest_bindings: {
      contract_hash: evidence.contract_hash,
      consent_context_hash: evidence.consent_context_hash,
      result_hash: evidence.receipt_body.result_hash,
      provisional_receipt_hash: evidence.receipt_hash,
      previous_state_root: evidence.previous_state_root,
      resulting_state_root: evidence.resulting_state_root,
      source_fingerprint_before: evidence.source_fingerprint_before,
      source_fingerprint_after: evidence.source_fingerprint_after,
      judgment_hash: judgment.judgment_hash,
      journal_prefix_sha256: journal_binding.prefix_sha256,
    },
  };
}

function validateInput({ mission_id, attempt_id, evidence, judgment, journal_binding, effect_phase_declared_write_paths, control_plane_write_paths }) {
  const blocked_by = [];
  if (typeof mission_id !== "string" || mission_id === "") blocked_by.push("mission_id_missing");
  if (typeof attempt_id !== "string" || attempt_id === "") blocked_by.push("attempt_id_missing");
  if (!isObject(evidence)) blocked_by.push("evidence_missing");
  if (!isObject(judgment)) blocked_by.push("judgment_missing");
  if (!isObject(journal_binding)) blocked_by.push("journal_binding_missing");
  if (!Array.isArray(effect_phase_declared_write_paths)) blocked_by.push("effect_write_set_missing");
  else if (effect_phase_declared_write_paths.length === 0) blocked_by.push("effect_write_set_empty");
  if (!Array.isArray(control_plane_write_paths) || control_plane_write_paths.length === 0) blocked_by.push("control_write_set_missing");
  if (blocked_by.length > 0) return { blocked_by };

  const missing = REQUIRED_EVIDENCE_KEYS.filter((key) => evidence[key] === undefined || evidence[key] === null);
  if (missing.length > 0) blocked_by.push("evidence_missing:" + missing.join(","));
  if (!Array.isArray(evidence.events) || evidence.events.length === 0) blocked_by.push("events_malformed");
  if (isObject(evidence.observation) && (!Number.isInteger(evidence.observation.elapsed_ms) || evidence.observation.elapsed_ms < 0)) {
    blocked_by.push("observation_elapsed_ms_missing_or_invalid");
  }
  if (!isObject(evidence.contract) || evidence.contract.mission_id !== mission_id) blocked_by.push("contract_mission_id_mismatch");
  if (!isObject(evidence.consent_context) || evidence.consent_context.mission_id !== mission_id) blocked_by.push("consent_mission_id_mismatch");
  if (!isObject(evidence.receipt_body) || typeof evidence.receipt_body.result_hash !== "string") blocked_by.push("provisional_result_hash_missing");
  if (evidence.declared_write_paths && !sameArray(effect_phase_declared_write_paths, evidence.declared_write_paths)) {
    blocked_by.push("effect_write_set_mismatch");
  }
  if (typeof evidence.state_root_dir !== "string" || evidence.state_root_dir === "") blocked_by.push("state_root_dir_missing");

  for (const path of effect_phase_declared_write_paths ?? []) {
    if (typeof path !== "string" || !contained(evidence.state_root_dir, path)) blocked_by.push("effect_write_path_outside_state_root");
  }
  for (const path of control_plane_write_paths ?? []) {
    if (typeof path !== "string" || !contained(evidence.state_root_dir, path)) blocked_by.push("control_write_path_outside_state_root");
  }

  const eventCount = evidence.events?.length;
  if (journal_binding.event_count !== eventCount) blocked_by.push("journal_event_count_mismatch");
  const head = evidence.events?.[eventCount - 1]?.event_id;
  if (journal_binding.head_event_id !== head) blocked_by.push("journal_head_event_mismatch");
  if (typeof journal_binding.path !== "string" || !contained(evidence.state_root_dir, journal_binding.path)) {
    blocked_by.push("journal_path_outside_state_root");
  }
  addDigestFailure(blocked_by, "journal_binding.prefix_sha256", journal_binding.prefix_sha256);
  addDigestFailure(blocked_by, "judgment.judgment_hash", judgment.judgment_hash);

  const digestValues = {
    contract_hash: evidence.contract_hash,
    consent_context_hash: evidence.consent_context_hash,
    result_hash: evidence.receipt_body?.result_hash,
    provisional_receipt_hash: evidence.receipt_hash,
    previous_state_root: evidence.previous_state_root,
    resulting_state_root: evidence.resulting_state_root,
    source_fingerprint_before: evidence.source_fingerprint_before,
    source_fingerprint_after: evidence.source_fingerprint_after,
  };
  for (const [name, value] of Object.entries(digestValues)) addDigestFailure(blocked_by, name, value);
  eventBindings(evidence, mission_id, attempt_id, blocked_by);

  if (journal_binding.event_count < 1) blocked_by.push("journal_event_count_empty");
  if (!SHA256_DIGEST.test(head ?? "")) blocked_by.push("journal_head_event_id_malformed");
  if (judgment.judgment_hash !== undefined && judgment.judgment_hash !== evidence?.judgment_hash && evidence?.judgment_hash !== undefined) {
    blocked_by.push("judgment_hash_binding_mismatch");
  }

  return { blocked_by };
}

function semanticCommitment(body) {
  return sha256CanonicalJsonV1({
    domain: SAT_EVIDENCE_PACKET_SCHEMA,
    body,
  });
}

export function isTypedSha256(value) {
  return SHA256_DIGEST.test(value ?? "");
}

export function packetIdentityDigest({ mission_id, attempt_id }) {
  return sha256CanonicalJsonV1({
    schema: SAT_EVIDENCE_PACKET_SCHEMA,
    mission_id,
    attempt_id,
  });
}

export function buildSatEvidencePacket(input) {
  const validation = validateInput(input ?? {});
  if (validation.blocked_by.length > 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze([...new Set(validation.blocked_by)]), packet: null });
  }
  try {
    const body = bodyFor(input);
    const packet = {
      ...body,
      semantic_commitment: semanticCommitment(body),
    };
    // Force the same canonicalization used by persistence now, while the
    // producer still has the complete input, rather than failing later at I/O.
    canonicalizeJsonV1(packet);
    return Object.freeze({ ok: true, blocked_by: Object.freeze([]), packet: Object.freeze(packet) });
  } catch (error) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_canonicalizable:" + (error?.code ?? "unknown")]), packet: null });
  }
}

export function verifySatEvidencePacket(packet) {
  if (!isObject(packet)) return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_missing"]) });
  const { semantic_commitment, ...body } = packet;
  const rebuilt = buildSatEvidencePacket({
    mission_id: body.mission_id,
    attempt_id: body.attempt_id,
    evidence: body.evidence,
    judgment: body.judgment,
    journal_binding: body.journal_binding,
    effect_phase_declared_write_paths: body.effects?.effect_phase_declared_write_paths,
    control_plane_write_paths: body.control_plane_write_paths,
  });
  if (!rebuilt.ok) return rebuilt;
  try {
    const { semantic_commitment: rebuiltCommitment, ...rebuiltBody } = rebuilt.packet;
    const blocked_by = [];
    if (!isTypedSha256(semantic_commitment)) blocked_by.push("semantic_commitment_malformed");
    if (semantic_commitment !== rebuiltCommitment) blocked_by.push("semantic_commitment_not_rederivable");
    if (canonicalizeJsonV1(body) !== canonicalizeJsonV1(rebuiltBody)) blocked_by.push("packet_body_not_rederivable");
    return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
  } catch (error) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["packet_not_canonicalizable:" + (error?.code ?? "unknown")]) });
  }
}
