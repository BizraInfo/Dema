// BIZRA-GENESIS-NODE0-URP-LOCAL-IGNITION-1A · GENESIS_RUNTIME_SPINE_1A.0
//
// SAT-5 constitutional runtime — five DETERMINISTIC VERIFIERS, not agents.
//
//   SAT-1  Receipt and Provenance Integrity
//   SAT-2  Consent and FATE
//   SAT-3  Impact, Ethics and No-Riba
//   SAT-4  Security and Blast Radius
//   SAT-5  Governance and Doctrine
//
// The load-bearing rule: every verifier judges evidence it RE-DERIVES from the
// actual execution. A caller-supplied `receipt_valid: true` is not proof and is
// never read. Where this file accepts a boolean from the runtime it is treated
// as a CLAIM and checked against a recomputed value — the claim can only ever
// lose.
//
// Aggregation fails closed: one missing result, one malformed result, or one
// failed verifier REFUSES the whole judgment.
//
// PURE KERNEL: no fs / net / http / child_process / clock / random.

import { canonicalizeJsonV1 } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { evaluateConsent } from "../../fate/src/fate.js";
import {
  URP0_BLOCK0_ID,
  URP0_HUMAN_DENIED_POWERS,
  URP0_SAT_LANES,
  URP0_TRUTH_LABEL,
  reduceUrp0Events,
  urp0Boundary,
  urp0EventId,
  urp0MissionConsentPhrase,
} from "./urp0-kernel.js";
import { deriveMissionResult, MISSION_PERMITTED_OPERATION } from "./urp0-mission-kernel.js";

export const SAT5_JUDGMENT_SCHEMA = "bizra.genesis.sat5_judgment.v0.1";
export const BLOCK0_SCHEMA = "bizra.genesis.block0_local_candidate.v0.1";

export const SAT5_STATUS = Object.freeze({
  status: "ACTIVE_LOCAL",
  implementation: "DETERMINISTIC_VERIFIER",
  autonomous_ai_agent: false,
});

// The world is founded exactly once, in exactly this order.
const CANONICAL_REGISTRATION_PREFIX = Object.freeze([
  "HUMAN_REGISTERED",
  "NODE_REGISTERED",
  "SAT_SET_REGISTERED",
  "RESOURCE_OFFER_REGISTERED",
]);

// Each mission ATTEMPT walks exactly this path. Checked per attempt rather than
// by global journal position, because a refused attempt legitimately sits in the
// journal between the registration prefix and a later successful attempt.
const CANONICAL_ATTEMPT_PATH = Object.freeze([
  "MISSION_DECLARED",
  "CONSENT_REQUESTED",
  "MISSION_AUTHORIZED",
  "MISSION_EXECUTED",
]);

// Substrings that must never appear in the canonical bytes of the result or the
// receipt. Checked against the ACTUAL serialized evidence, so a forbidden claim
// smuggled into any nested field is caught wherever it hides.
const FORBIDDEN_ECONOMIC_TOKENS = Object.freeze([
  "token_minted\":true",
  "live_mint\":true",
  "mint_allowed\":true",
  "token_price",
  "market_value",
  "reward_allocated",
  "founder_valuation",
  "interest_rate",
  "yield_bearing",
]);

const FORBIDDEN_REACH_TOKENS = Object.freeze([
  "federation_used\":true",
  "public_gateway_enabled\":true",
  "node1_admitted\":true",
  "network_used\":true",
  "autonomous_ai_agent\":true",
  "live_sat_agent\":true",
]);

function verdict(id, lane, failures) {
  const reasons = Object.freeze([...failures]);
  return Object.freeze({ id, lane, verdict: reasons.length === 0 ? "PASS" : "FAIL", reasons });
}

function laneOf(id) {
  return URP0_SAT_LANES.find((l) => l.id === id).lane;
}

// ---------------------------------------------------------------------------
// SAT-1 — Receipt and Provenance Integrity
// Re-derives: mission result hash, receipt body hash, event-journal linkage,
// contract hash, previous state root, resulting state root.
// ---------------------------------------------------------------------------
function sat1(ev) {
  const f = [];
  const { events, contract, result, receipt_body, receipt_hash, previous_state_root, resulting_state_root } = ev;

  const rederivedContractHash = sha256CanonicalJsonV1(contract);
  if (receipt_body.contract_hash !== rederivedContractHash) f.push("contract_hash_not_rederivable");
  if (result.contract_hash !== rederivedContractHash) f.push("result_contract_hash_mismatch");

  const rederivedResultHash = sha256CanonicalJsonV1(result);
  if (receipt_body.result_hash !== rederivedResultHash) f.push("result_hash_not_rederivable");

  if (sha256CanonicalJsonV1(receipt_body) !== receipt_hash) f.push("receipt_hash_not_rederivable");

  // Every link in the chain, recomputed. A tampered payload anywhere in the
  // journal breaks its own event_id and every prev_event after it.
  let prev = "GENESIS";
  let executedIndex = -1;
  for (const [i, e] of events.entries()) {
    if (e.prev_event !== prev) { f.push(`event_chain_broken_at_seq:${e.seq}`); break; }
    let id;
    try {
      id = urp0EventId({ seq: e.seq, kind: e.kind, payload: e.payload, prev_event: e.prev_event });
    } catch { f.push(`event_not_canonicalizable_at_seq:${e.seq}`); break; }
    if (id !== e.event_id) { f.push(`event_id_not_rederivable_at_seq:${e.seq}`); break; }
    if (e.kind === "MISSION_EXECUTED") executedIndex = i;
    prev = e.event_id;
  }
  if (executedIndex === -1) f.push("mission_executed_event_absent");

  // The two state roots either side of the transition, recomputed by replay.
  if (executedIndex >= 0) {
    const before = reduceUrp0Events(events.slice(0, executedIndex));
    const after = reduceUrp0Events(events.slice(0, executedIndex + 1));
    if (!before.ok) f.push("previous_state_not_replayable");
    else if (before.state_root !== previous_state_root) f.push("previous_state_root_mismatch");
    if (!after.ok) f.push("resulting_state_not_replayable");
    else if (after.state_root !== resulting_state_root) f.push("resulting_state_root_mismatch");
  }

  return verdict("SAT-1", laneOf("SAT-1"), f);
}

// ---------------------------------------------------------------------------
// SAT-2 — Consent and FATE
// Re-derives: the exact phrase, the consent-context hash, the selected root, the
// nonce, the expiry, the permitted operation, and the replay status.
// ---------------------------------------------------------------------------
function sat2(ev) {
  const f = [];
  const { events, contract, consent_context, consent_context_hash, submitted_phrase, authorized_at_iso } = ev;

  const rederivedContextHash = sha256CanonicalJsonV1(consent_context);
  if (rederivedContextHash !== consent_context_hash) f.push("consent_context_hash_not_rederivable");

  // The required phrase is a FUNCTION of the mission, the root and the contract
  // — recomputed here, never read from the request.
  const required = urp0MissionConsentPhrase({
    mission_id: contract.mission_id,
    canonical_root: contract.canonical_root,
    contract_hash: sha256CanonicalJsonV1(contract),
  });
  const fate = evaluateConsent({ phrase: submitted_phrase, requiredPhrase: required });
  if (fate.accepted !== true) f.push("exact_consent_not_matched");
  if (consent_context.canonical_root !== contract.canonical_root) f.push("consent_root_mismatch");
  if (consent_context.permitted_operation !== MISSION_PERMITTED_OPERATION) f.push("permitted_operation_mismatch");
  if (typeof consent_context.nonce !== "string" || consent_context.nonce === "") f.push("consent_nonce_absent");

  // Act-time expiry. Judged against the recorded authorization timestamp, never
  // against a live clock — otherwise a valid past authorization would rot into a
  // failure the moment the window closed.
  if (typeof authorized_at_iso !== "string" || authorized_at_iso === "") f.push("authorized_at_absent");
  else {
    if (authorized_at_iso > consent_context.expires_at_iso) f.push("consent_expired_at_act_time");
    if (authorized_at_iso < consent_context.created_at_iso) f.push("consent_used_before_issue");
  }

  // Replay status, re-derived from the journal itself: one offer of this nonce,
  // one authorization against this context.
  const requests = events.filter((e) => e.kind === "CONSENT_REQUESTED");
  const authorizations = events.filter((e) => e.kind === "MISSION_AUTHORIZED");
  const nonceUses = requests.filter((e) => e.payload.nonce === consent_context.nonce).length;
  if (nonceUses !== 1) f.push(`consent_nonce_replayed:${nonceUses}`);
  const contextAuths = authorizations.filter((e) => e.payload.consent_context_hash === consent_context_hash).length;
  if (contextAuths !== 1) f.push(`consent_context_authorized_times:${contextAuths}`);
  const matchedRequest = requests.find((e) => e.payload.consent_context_hash === consent_context_hash);
  if (!matchedRequest) f.push("consent_request_absent_from_journal");
  else if (matchedRequest.payload.required_phrase !== required) f.push("journal_required_phrase_mismatch");

  return verdict("SAT-2", laneOf("SAT-2"), f);
}

// ---------------------------------------------------------------------------
// SAT-3 — Impact, Ethics and No-Riba
// Judged on the canonical BYTES of the result and receipt, so a forbidden claim
// cannot hide in a nested field the structural checks do not know about.
// ---------------------------------------------------------------------------
function sat3(ev) {
  const f = [];
  const { contract, result, receipt_body } = ev;

  let bytes;
  try {
    bytes = `${canonicalizeJsonV1(result)}${canonicalizeJsonV1(receipt_body)}`;
  } catch {
    return verdict("SAT-3", laneOf("SAT-3"), ["evidence_not_canonicalizable"]);
  }
  for (const token of FORBIDDEN_ECONOMIC_TOKENS) {
    if (bytes.includes(token)) f.push(`economic_claim:${token}`);
  }
  if (receipt_body.token_minted !== false) f.push("mint_claimed");

  // A bounded, useful, declared purpose — not "we spent effort, therefore value".
  if (contract.type !== "BOUNDED_METADATA_INVENTORY") f.push("purpose_not_declared_bounded");
  if (contract.metadata_only !== true) f.push("purpose_exceeds_metadata_only");
  if (!Number.isInteger(contract.limits?.max_entries) || contract.limits.max_entries <= 0) f.push("purpose_unbounded");

  // No fabricated impact: every reported count must be a real non-negative
  // integer, and the byte total cannot be positive with zero files observed.
  const counts = result.counts;
  for (const key of ["files", "directories", "symlinks", "skipped"]) {
    if (!Number.isInteger(counts?.[key]) || counts[key] < 0) f.push(`impact_count_invalid:${key}`);
  }
  if (Number.isInteger(counts?.files) && counts.files === 0 && result.total_file_bytes > 0) {
    f.push("impact_bytes_without_files");
  }
  // The histogram must account for exactly the files observed — an inflated
  // inventory is caught by arithmetic, not by trust.
  const histTotal = Object.values(result.type_histogram ?? {}).reduce((a, b) => a + b, 0);
  if (histTotal !== counts?.files) f.push("impact_histogram_does_not_reconcile");

  return verdict("SAT-3", laneOf("SAT-3"), f);
}

// ---------------------------------------------------------------------------
// SAT-4 — Security and Blast Radius
// Re-derives containment, non-mutation and ceiling compliance from the raw
// observation, then checks the derived result actually follows from it.
// ---------------------------------------------------------------------------
function sat4(ev) {
  const f = [];
  const { contract, contract_hash, observation, result, resource_offer, source_fingerprint_before, source_fingerprint_after, declared_write_paths, state_root_dir } = ev;

  // The result is not accepted as given: it is recomputed from the raw
  // observation. If the two disagree, the reported result was edited.
  const rederived = deriveMissionResult({ contract, contract_hash, observation });
  if (!rederived.ok) f.push(...rederived.blocked_by.map((b) => `observation_rejected:${b}`));
  else if (sha256CanonicalJsonV1(rederived.result) !== sha256CanonicalJsonV1(result)) {
    f.push("result_not_derivable_from_observation");
  }

  if (resource_offer?.network !== false) f.push("offer_network_enabled");
  if (contract.network !== false) f.push("contract_network_enabled");
  if (observation.network_used !== false) f.push("network_used");
  if (resource_offer?.unrestricted_shell !== false) f.push("unrestricted_shell_offered");
  if (resource_offer?.unrestricted_filesystem !== false) f.push("unrestricted_filesystem_offered");

  if (observation.entries_outside_root !== 0) f.push("root_containment_violated");
  if (observation.symlinks_followed !== 0) f.push("symlink_followed");
  if (observation.contents_read !== false) f.push("file_contents_read");
  if (observation.contents_hashed !== false) f.push("file_contents_hashed");

  // Source non-mutation, proved by comparing a metadata-only fingerprint taken
  // before and after the walk. Equal fingerprints, or it did not happen.
  if (typeof source_fingerprint_before !== "string" || source_fingerprint_before === "") f.push("source_fingerprint_before_absent");
  if (typeof source_fingerprint_after !== "string" || source_fingerprint_after === "") f.push("source_fingerprint_after_absent");
  if (source_fingerprint_before !== source_fingerprint_after) f.push("source_mutated");

  // Ceilings, recomputed against what was actually observed.
  const limits = contract.limits;
  const observed = (result.counts?.files ?? 0) + (result.counts?.directories ?? 0) + (result.counts?.symlinks ?? 0);
  if (!Number.isInteger(limits?.max_entries)) f.push("entry_ceiling_absent");
  else if (observed > limits.max_entries) f.push("entry_ceiling_exceeded");
  if (!Number.isInteger(limits?.wall_clock_seconds)) f.push("time_ceiling_absent");
  else if (observation.elapsed_ms > limits.wall_clock_seconds * 1000) f.push("time_ceiling_exceeded");
  if (observation.limits_honored !== true) f.push("limits_not_honored");

  // No hidden durable writes: every path the runtime declares it wrote must sit
  // beneath the authorized state root, and the source root must not appear.
  if (!Array.isArray(declared_write_paths)) f.push("declared_write_paths_absent");
  else {
    if (typeof state_root_dir !== "string" || state_root_dir === "") f.push("state_root_dir_absent");
    else {
      for (const p of declared_write_paths) {
        if (typeof p !== "string" || !p.startsWith(`${state_root_dir}/`)) f.push("write_outside_state_root");
      }
    }
    for (const p of declared_write_paths) {
      if (typeof p === "string" && p.startsWith(`${contract.canonical_root}/`)) f.push("write_inside_source_root");
    }
  }

  // No secret output: the result carries counters and the one consented root,
  // never a per-entry path inventory.
  for (const key of Object.keys(result)) {
    if (Array.isArray(result[key])) f.push(`result_contains_list:${key}`);
  }

  return verdict("SAT-4", laneOf("SAT-4"), f);
}

// ---------------------------------------------------------------------------
// SAT-5 — Governance and Doctrine
// The meta-judge. Checks the founder took the ordinary path and that every
// truth label the system displays is the one the evidence supports.
// ---------------------------------------------------------------------------
function sat5(ev) {
  const f = [];
  const { events, admission_contract, sat_set, result, receipt_body, consent_context } = ev;

  // Founder bypass false — in the signed admission contract AND in the event the
  // journal actually recorded. Both, because either alone can be forged.
  const humanEvent = events.find((e) => e.kind === "HUMAN_REGISTERED");
  if (!humanEvent) f.push("human_registration_absent");
  for (const power of URP0_HUMAN_DENIED_POWERS) {
    if (admission_contract?.[power] !== false) f.push(`admission_contract_privilege:${power}`);
    if (humanEvent && humanEvent.payload?.[power] !== false) f.push(`journal_privilege:${power}`);
  }

  // The world is founded once, in order.
  const kinds = events.map((e) => e.kind);
  for (const [i, expected] of CANONICAL_REGISTRATION_PREFIX.entries()) {
    if (kinds[i] !== expected) { f.push(`registration_path_deviated_at:${i}:${kinds[i] ?? "absent"}`); break; }
  }
  for (const once of CANONICAL_REGISTRATION_PREFIX) {
    if (kinds.filter((k) => k === once).length !== 1) f.push(`registration_not_singular:${once}`);
  }

  // This attempt walks the ordinary path — no step skipped, no step reordered.
  const attempt_id = consent_context?.nonce;
  if (typeof attempt_id !== "string" || attempt_id === "") f.push("attempt_id_absent");
  else {
    const attemptKinds = events.filter((e) => e.payload?.attempt_id === attempt_id).map((e) => e.kind);
    for (const [i, expected] of CANONICAL_ATTEMPT_PATH.entries()) {
      if (attemptKinds[i] !== expected) { f.push(`attempt_path_deviated_at:${i}:${attemptKinds[i] ?? "absent"}`); break; }
    }
  }

  // Truth labels accurate — the UI may only say what this proves.
  if (sat_set?.implementation !== "DETERMINISTIC_CONSTITUTIONAL_VERIFIERS") f.push("sat_implementation_mislabelled");
  if (sat_set?.autonomous_agents !== false) f.push("autonomous_sat_overclaimed");
  if (sat_set?.count !== 5) f.push("sat_count_not_five");
  if (sat_set?.status !== "ACTIVE_LOCAL") f.push("sat_status_mislabelled");

  // No federation, no public network, no unsupported economic claim — checked on
  // the canonical bytes so a nested overclaim cannot slip through.
  let bytes;
  try {
    bytes = `${canonicalizeJsonV1(result)}${canonicalizeJsonV1(receipt_body)}`;
  } catch {
    return verdict("SAT-5", laneOf("SAT-5"), [...f, "evidence_not_canonicalizable"]);
  }
  for (const token of FORBIDDEN_REACH_TOKENS) {
    if (bytes.includes(token)) f.push(`reach_claim:${token}`);
  }

  return verdict("SAT-5", laneOf("SAT-5"), f);
}

// The required evidence surface. A missing key is a REFUSAL, never a default.
const REQUIRED_EVIDENCE_KEYS = Object.freeze([
  "events", "admission_contract", "sat_set", "resource_offer", "contract", "contract_hash",
  "consent_context", "consent_context_hash", "submitted_phrase", "authorized_at_iso",
  "observation", "result", "receipt_body", "receipt_hash",
  "previous_state_root", "resulting_state_root",
  "source_fingerprint_before", "source_fingerprint_after",
  "declared_write_paths", "state_root_dir",
]);

// Run all five lanes and aggregate fail-closed. The judgment is content-addressed
// so the journal binds the exact verdicts that were reached.
export function judgeUrp0Mission(evidence) {
  const missing = REQUIRED_EVIDENCE_KEYS.filter((k) => evidence?.[k] === undefined || evidence?.[k] === null);
  if (missing.length > 0) {
    return sealJudgment(
      URP0_SAT_LANES.map((l) => verdict(l.id, l.lane, [`evidence_missing:${missing.join(",")}`])),
      false,
    );
  }
  if (!Array.isArray(evidence.events) || evidence.events.length === 0) {
    return sealJudgment(URP0_SAT_LANES.map((l) => verdict(l.id, l.lane, ["events_malformed"])), false);
  }

  // A verifier that throws is a malformed result, which refuses — it never
  // silently degrades into a pass.
  const lanes = [sat1, sat2, sat3, sat4, sat5];
  const verdicts = lanes.map((fn, i) => {
    const id = URP0_SAT_LANES[i].id;
    try {
      return fn(evidence);
    } catch (error) {
      return verdict(id, laneOf(id), [`verifier_threw:${error?.message ?? "unknown"}`]);
    }
  });
  return sealJudgment(verdicts, true);
}

function sealJudgment(verifier_verdicts, evidence_complete) {
  const admissible = evidence_complete && verifier_verdicts.length === 5 && verifier_verdicts.every((v) => v.verdict === "PASS");
  const body = {
    schema: SAT5_JUDGMENT_SCHEMA,
    subject: "NODE0",
    ...SAT5_STATUS,
    evidence_complete,
    verifier_verdicts: Object.freeze(verifier_verdicts),
    failing_verifiers: Object.freeze(verifier_verdicts.filter((v) => v.verdict !== "PASS").map((v) => v.id)),
    set_verdict: admissible ? "ADMISSIBLE" : "REFUSED",
    admissible,
    judges_node0: true,
    serves_node0: false,
  };
  return Object.freeze({ ...body, judgment_hash: sha256CanonicalJsonV1(body) });
}

// Independent re-derivation of a judgment: recompute every verdict from the same
// evidence and require byte equality. A forged ADMISSIBLE with a recomputed hash
// still fails here, because the verdicts themselves are derived, not stored.
export function verifyUrp0Judgment({ evidence, judgment }) {
  const rederived = judgeUrp0Mission(evidence);
  const blocked_by = [];
  if (rederived.judgment_hash !== judgment?.judgment_hash) blocked_by.push("judgment_hash_not_rederivable");
  if (rederived.admissible !== judgment?.admissible) blocked_by.push("admissibility_not_rederivable");
  if (judgment?.autonomous_ai_agent !== false) blocked_by.push("autonomous_agent_claimed");
  if (judgment?.judges_node0 !== true) blocked_by.push("must_judge_node0");
  if (judgment?.serves_node0 !== false) blocked_by.push("must_not_serve_node0");
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by), rederived_hash: rederived.judgment_hash });
}

// ---------------------------------------------------------------------------
// BIZRA-BLOCK0-LOCAL-CANDIDATE
// ---------------------------------------------------------------------------
export function buildBlock0Candidate({
  constitution_source_hash,
  topology_source_hash,
  repository_base_commit,
  implementation_commit,
  human,
  node,
  urp_state_root,
  judgment,
  resource_offer_receipt_hash,
  contract_hash,
  consent_receipt_hash,
  result_hash,
  receipt_hash,
  restart_replay,
}) {
  const body = {
    schema: BLOCK0_SCHEMA,
    block0_id: URP0_BLOCK0_ID,
    truth_label: URP0_TRUTH_LABEL,
    sources: {
      constitution_source_hash,
      topology_source_hash,
      repository_base_commit,
      implementation_commit,
    },
    human: {
      human_id: human.human_id,
      roles: human.roles,
      founder_bypass: false,
    },
    node: { node_id: node.node_id, owner: node.owner },
    urp_state_root,
    sat5: {
      verifier_verdicts: judgment.verifier_verdicts,
      judgment_hash: judgment.judgment_hash,
      admissible: judgment.admissible,
      implementation: SAT5_STATUS.implementation,
      autonomous_ai_agent: false,
    },
    resource_offer_receipt_hash,
    mission: { contract_hash, consent_receipt_hash, result_hash, receipt_hash },
    restart_replay: {
      state_root_preserved: restart_replay.state_root_preserved,
      receipt_replay_verified: restart_replay.receipt_replay_verified,
      duplicate_human_registration: restart_replay.duplicate_human_registration,
      duplicate_node_registration: restart_replay.duplicate_node_registration,
      duplicate_mission_admission: restart_replay.duplicate_mission_admission,
    },
    economy: {
      live_mint: false,
      token_created: false,
      founder_asset_valuation: "NOT_STARTED",
      genesis_allocation: "NOT_EVALUATED",
      urp_treasury_balance: 0,
      public_market_value_claimed: false,
    },
    network: { internet_gateway: false, node1_admission: false },
    boundary: urp0Boundary(),
  };
  return Object.freeze({ body: Object.freeze(body), block0_hash: sha256CanonicalJsonV1(body) });
}

// Block0 verification re-derives the hash over the whole body and re-asserts the
// invariants that may never be negotiated, whatever the body claims.
export function verifyBlock0Candidate({ body, block0_hash }) {
  const blocked_by = [];
  if (!body || typeof body !== "object") return Object.freeze({ ok: false, blocked_by: Object.freeze(["body_not_object"]) });
  if (sha256CanonicalJsonV1(body) !== block0_hash) blocked_by.push("block0_hash_not_rederivable");
  if (body.schema !== BLOCK0_SCHEMA) blocked_by.push("schema_mismatch");
  if (body.truth_label !== URP0_TRUTH_LABEL) blocked_by.push("truth_label_not_local_candidate");
  for (const forbidden of ["MAINNET", "PUBLIC_GENESIS", "FINAL_NETWORK_BLOCK0"]) {
    if (canonicalizeJsonV1(body).includes(forbidden)) blocked_by.push(`forbidden_label:${forbidden}`);
  }
  if (body.economy?.live_mint !== false || body.economy?.token_created !== false) blocked_by.push("mint_claimed");
  if (body.economy?.urp_treasury_balance !== 0) blocked_by.push("treasury_nonzero");
  if (body.economy?.founder_asset_valuation !== "NOT_STARTED") blocked_by.push("founder_valuation_started");
  if (body.network?.internet_gateway !== false) blocked_by.push("gateway_claimed");
  if (body.network?.node1_admission !== false) blocked_by.push("node1_claimed");
  if (body.human?.founder_bypass !== false) blocked_by.push("founder_bypass_claimed");
  if (body.sat5?.admissible !== true) blocked_by.push("sealed_without_admissible_judgment");
  if (body.sat5?.autonomous_ai_agent !== false) blocked_by.push("autonomous_sat_claimed");
  const expectedBoundary = urp0Boundary();
  const boundary = body.boundary;
  const boundaryOk =
    boundary && typeof boundary === "object" &&
    Object.keys(expectedBoundary).length === Object.keys(boundary).length &&
    Object.keys(expectedBoundary).every((k) => boundary[k] === false);
  if (!boundaryOk) blocked_by.push("boundary_not_canonical_all_false");
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}
