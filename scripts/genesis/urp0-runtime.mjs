// BIZRA-GENESIS-NODE0-URP-LOCAL-IGNITION-1A · GENESIS_RUNTIME_SPINE_1A.0
//
// I/O TIER — the composition seam. This is the module that turns the existing
// BIZRA organs into one running loop:
//
//   HUMAN-0 -> DEMA -> FATE -> URP-0 -> BOUNDED LOCAL EXECUTION
//           -> SAT-1..SAT-5 -> RECEIPT -> WORLD-STATE TRANSITION
//           -> RESTART AND REPLAY -> BLOCK0 LOCAL CANDIDATE
//
// It owns no law of its own: every decision is delegated to a pure kernel, and
// every write goes through the store.

import { cpus, totalmem } from "node:os";
import { randomUUID } from "node:crypto";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import { evaluateConsent } from "../../packages/fate/src/fate.js";
import {
  URP0_HUMAN_ID,
  URP0_HUMAN_ROLES,
  URP0_MISSION_ID,
  URP0_NODE_ID,
  URP0_RESOURCE_OFFER_ID,
  URP0_SAT_LANES,
  URP0_TRUTH_LABEL,
  reduceUrp0Events,
  urp0Boundary,
} from "../../packages/genesis/src/urp0-kernel.js";
import {
  admissionConsentPhrase,
  buildAdmissionContract,
  buildConsentCard,
  buildConsentContext,
  buildMissionContract,
  buildMissionReceipt,
  deriveMissionResult,
} from "../../packages/genesis/src/urp0-mission-kernel.js";
import {
  SAT5_STATUS,
  buildBlock0Candidate,
  judgeUrp0Mission,
  verifyBlock0Candidate,
  verifyUrp0Judgment,
} from "../../packages/genesis/src/urp0-sat5.js";
import { buildSatEvidencePacket } from "../../packages/genesis/src/urp0-sat-evidence.js";
import { canonicaliseRoot, fingerprintTree, scanMetadataOnly } from "./urp0-scan.mjs";
import {
  appendEvent,
  declaredWritePaths,
  journalPrefixBinding,
  loadEvents,
  persistSatEvidencePacket,
  readArtifact,
  reconstruct,
  statePermissions,
  satEvidencePacketPath,
  writeArtifact,
  writeLogLength,
} from "./urp0-store.mjs";

// A consent card may not be issued with an arbitrary validity window: the
// operator's browser supplies the card back at authorization time, so an
// unbounded expiry would be a self-issued forever-token.
export const CONSENT_WINDOW_SECONDS = 300;

// Node0 offers a conservative FRACTION of what it possesses. Never the machine.
export function measurePossessed() {
  return { cpu_threads: Math.max(1, cpus().length), memory_bytes: totalmem() };
}

export function conservativeOffer(possessed) {
  return {
    cpu_threads: Math.max(1, Math.min(possessed.cpu_threads - 1, Math.floor(possessed.cpu_threads / 4))),
    memory_bytes: Math.floor(possessed.memory_bytes / 8),
    storage_write_bytes: 8 * 1024 * 1024,
    wall_clock_seconds: 30,
    max_entries: 50000,
    max_depth: 24,
  };
}

export function admissionCard() {
  const contract = buildAdmissionContract({
    human_id: URP0_HUMAN_ID,
    node_id: URP0_NODE_ID,
    roles: [...URP0_HUMAN_ROLES],
  });
  return {
    schema: "bizra.genesis.admission_card.v0.1",
    contract: contract.body,
    contract_hash: contract.contract_hash,
    required_phrase: admissionConsentPhrase({
      human_id: URP0_HUMAN_ID,
      node_id: URP0_NODE_ID,
      contract_hash: contract.contract_hash,
    }),
    founder_bypass: false,
    writes_performed: false,
  };
}

// Human-0 admission. Exact FATE consent, SAT-2-style context verification, an
// admission receipt, and the resulting URP state root. Idempotent: a second
// admission is refused by the kernel, not silently re-applied.
export function admitHuman0(stateRootDir, { phrase, now_iso }) {
  const card = admissionCard();
  const fate = evaluateConsent({ phrase, requiredPhrase: card.required_phrase });
  if (!fate.accepted) {
    return { ok: false, blocked_by: ["exact_consent_not_matched"], required_phrase: card.required_phrase };
  }
  const receipt = {
    schema: "bizra.genesis.admission_receipt.v0.1",
    human_id: URP0_HUMAN_ID,
    node_id: URP0_NODE_ID,
    admission_contract_hash: card.contract_hash,
    consent_verdict: fate.verdict,
    admitted_at_iso: now_iso,
    founder_bypass: false,
  };
  const consent_receipt_hash = hashOf(receipt);

  const human = appendEvent(stateRootDir, "HUMAN_REGISTERED", {
    human_id: URP0_HUMAN_ID,
    roles: [...URP0_HUMAN_ROLES],
    founder_bypass: false,
    self_approval: false,
    sat_exemption: false,
    mint_authority: false,
    treasury_authority: false,
    unbounded_resource_authority: false,
    admission_contract_hash: card.contract_hash,
    consent_receipt_hash,
  });
  if (!human.ok) return { ok: false, blocked_by: human.blocked_by };

  const node = appendEvent(stateRootDir, "NODE_REGISTERED", { node_id: URP0_NODE_ID, owner: URP0_HUMAN_ID });
  if (!node.ok) return { ok: false, blocked_by: node.blocked_by };

  const sat = appendEvent(stateRootDir, "SAT_SET_REGISTERED", {
    lanes: URP0_SAT_LANES.map((l) => ({ id: l.id, lane: l.lane })),
    implementation: "DETERMINISTIC_CONSTITUTIONAL_VERIFIERS",
    autonomous_agents: false,
  });
  if (!sat.ok) return { ok: false, blocked_by: sat.blocked_by };

  const possessed = measurePossessed();
  const allowed = conservativeOffer(possessed);
  const offer = appendEvent(stateRootDir, "RESOURCE_OFFER_REGISTERED", {
    resource_offer_id: URP0_RESOURCE_OFFER_ID,
    allowed,
    possessed,
    network: false,
    unrestricted_shell: false,
    unrestricted_filesystem: false,
    per_mission_consent: true,
    revocable: true,
    receipt_required: true,
  });
  if (!offer.ok) return { ok: false, blocked_by: offer.blocked_by };

  writeArtifact(stateRootDir, "admission-receipt.json", receipt);
  return {
    ok: true,
    blocked_by: [],
    admission_receipt: receipt,
    consent_receipt_hash,
    state_root: offer.replay.state_root,
  };
}

// One hashing rule everywhere: the canonical byte contract.
const hashOf = sha256CanonicalJsonV1;

// Derive the consent card. WRITES NOTHING. EXECUTES NOTHING. The nonce and the
// window are minted here and handed to the operator; the journal only learns of
// them when the operator comes back with the exact phrase.
export function missionConsentCard(stateRootDir, { root, now_iso }) {
  const state = reconstruct(stateRootDir);
  if (!state.replay.ok) return { ok: false, blocked_by: state.replay.blocked_by };
  const offer = state.replay.state?.resource_offer;
  if (!offer) return { ok: false, blocked_by: ["resource_offer_not_registered"] };

  const canon = canonicaliseRoot(root);
  if (!canon.ok) return { ok: false, blocked_by: canon.blocked_by };

  const limits = {
    max_entries: offer.allowed.max_entries,
    max_depth: offer.allowed.max_depth,
    wall_clock_seconds: offer.allowed.wall_clock_seconds,
    storage_write_bytes: offer.allowed.storage_write_bytes,
  };
  const contract = buildMissionContract({ mission_id: URP0_MISSION_ID, canonical_root: canon.canonical_root, limits });
  const consent = buildConsentContext({
    mission_id: URP0_MISSION_ID,
    canonical_root: canon.canonical_root,
    contract_hash: contract.contract_hash,
    nonce: randomUUID(),
    created_at_iso: now_iso,
    expires_at_iso: new Date(Date.parse(now_iso) + CONSENT_WINDOW_SECONDS * 1000).toISOString(),
  });
  return {
    ok: true,
    blocked_by: [],
    card: buildConsentCard({ contract: contract.body, contract_hash: contract.contract_hash, consent }),
    contract: contract.body,
    contract_hash: contract.contract_hash,
    consent_context: consent.context,
    consent_context_hash: consent.consent_context_hash,
  };
}

// The bound act. Everything from here is journaled, judged and receipted.
export function authorizeAndExecute(stateRootDir, { consent_context, phrase, now_iso }) {
  const blocked = [];
  // Mark the write log here: everything after this point is a write THIS mission
  // performed, and SAT-4 judges exactly that set.
  const writeMark = writeLogLength();
  if (!consent_context || typeof consent_context !== "object") return refuse(["consent_context_missing"]);

  // Re-derive the contract from the context's own claims, then re-derive the
  // context hash from the contract. A client-supplied hash is never trusted.
  const canon = canonicaliseRoot(consent_context.canonical_root);
  if (!canon.ok) return refuse(canon.blocked_by);
  if (canon.canonical_root !== consent_context.canonical_root) return refuse(["root_not_canonical"]);

  const state0 = reconstruct(stateRootDir);
  if (!state0.replay.ok) return refuse(state0.replay.blocked_by);
  const offer = state0.replay.state?.resource_offer;
  if (!offer) return refuse(["resource_offer_not_registered"]);

  const limits = {
    max_entries: offer.allowed.max_entries,
    max_depth: offer.allowed.max_depth,
    wall_clock_seconds: offer.allowed.wall_clock_seconds,
    storage_write_bytes: offer.allowed.storage_write_bytes,
  };
  const contract = buildMissionContract({
    mission_id: consent_context.mission_id,
    canonical_root: canon.canonical_root,
    limits,
  });
  const consent = buildConsentContext({
    mission_id: consent_context.mission_id,
    canonical_root: canon.canonical_root,
    contract_hash: contract.contract_hash,
    nonce: consent_context.nonce,
    created_at_iso: consent_context.created_at_iso,
    expires_at_iso: consent_context.expires_at_iso,
  });

  // Bound the self-issued window. A card the operator never saw cannot be
  // stretched into a forever-authorization.
  const issued = Date.parse(consent_context.created_at_iso);
  const expires = Date.parse(consent_context.expires_at_iso);
  const acting = Date.parse(now_iso);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || !Number.isFinite(acting)) {
    return refuse(["consent_timestamps_unparseable"]);
  }
  if (expires - issued > CONSENT_WINDOW_SECONDS * 1000) return refuse(["consent_window_too_wide"]);
  if (issued > acting) return refuse(["consent_issued_in_future"]);

  const fate = evaluateConsent({ phrase, requiredPhrase: consent.required_phrase });

  // The attempt id IS the consent nonce: one card, one attempt, one outcome.
  const attempt_id = consent.context.nonce;

  const declared = appendEvent(stateRootDir, "MISSION_DECLARED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    contract_hash: contract.contract_hash,
    canonical_root: canon.canonical_root,
    metadata_only: true,
    network: false,
  });
  if (!declared.ok) return refuse(declared.blocked_by);

  const requested = appendEvent(stateRootDir, "CONSENT_REQUESTED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    consent_context_hash: consent.consent_context_hash,
    required_phrase: consent.required_phrase,
    nonce: consent.context.nonce,
    created_at_iso: consent.context.created_at_iso,
    expires_at_iso: consent.context.expires_at_iso,
    permitted_operation: consent.context.permitted_operation,
  });
  if (!requested.ok) return refuse(requested.blocked_by);

  // A near-match dies HERE, after the request is on the record and before any
  // authority is granted. The refusal is itself part of the history.
  if (!fate.accepted) {
    return refuse(["exact_consent_not_matched"], { required_phrase: consent.required_phrase, consent_recorded: true });
  }

  const consent_receipt = {
    schema: "bizra.genesis.consent_receipt.v0.1",
    mission_id: consent_context.mission_id,
    consent_context_hash: consent.consent_context_hash,
    consent_verdict: fate.verdict,
    authorized_at_iso: now_iso,
    permitted_operation: consent.context.permitted_operation,
  };
  const consent_receipt_hash = hashOf(consent_receipt);

  const authorized = appendEvent(stateRootDir, "MISSION_AUTHORIZED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    consent_context_hash: consent.consent_context_hash,
    exact_phrase_matched: true,
    authorized_at_iso: now_iso,
    consent_receipt_hash,
  });
  if (!authorized.ok) return refuse(authorized.blocked_by);

  const previous_state_root = authorized.replay.state_root;

  // --- bounded local execution -------------------------------------------
  const source_fingerprint_before = fingerprintTree(canon.canonical_root, limits);
  const observation = scanMetadataOnly({ canonical_root: canon.canonical_root, limits });
  const source_fingerprint_after = fingerprintTree(canon.canonical_root, limits);

  const derived = deriveMissionResult({ contract: contract.body, contract_hash: contract.contract_hash, observation });
  if (!derived.ok) return refuse(derived.blocked_by);

  const executed = appendEvent(stateRootDir, "MISSION_EXECUTED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    result_hash: derived.result_hash,
    metadata_only: true,
    source_mutated: false,
    symlinks_followed: 0,
    network_used: false,
  });
  if (!executed.ok) return refuse(executed.blocked_by);
  const resulting_state_root = executed.replay.state_root;

  // --- SAT-5 judgment ------------------------------------------------------
  // Judged over the PROVISIONAL receipt (judgment_hash null): the sealed receipt
  // differs only by that field, and the journal binds it independently in
  // RECEIPT_RECORDED, so there is no circular hash dependency.
  const provisional = buildMissionReceipt({
    mission_id: consent_context.mission_id,
    contract_hash: contract.contract_hash,
    consent_context_hash: consent.consent_context_hash,
    consent_receipt_hash,
    result_hash: derived.result_hash,
    judgment_hash: null,
    previous_state_root,
    executed_at_iso: now_iso,
  });

  const events = loadEvents(stateRootDir);
  const evidence = {
    events,
    admission_contract: buildAdmissionContract({
      human_id: URP0_HUMAN_ID,
      node_id: URP0_NODE_ID,
      roles: [...URP0_HUMAN_ROLES],
    }).body,
    sat_set: state0.replay.state.sat_set,
    resource_offer: offer,
    contract: contract.body,
    contract_hash: contract.contract_hash,
    consent_context: consent.context,
    consent_context_hash: consent.consent_context_hash,
    submitted_phrase: phrase,
    authorized_at_iso: now_iso,
    observation,
    result: derived.result,
    receipt_body: provisional.body,
    receipt_hash: provisional.receipt_hash,
    previous_state_root,
    resulting_state_root,
    source_fingerprint_before,
    source_fingerprint_after,
    declared_write_paths: declaredWritePaths(writeMark),
    state_root_dir: stateRootDir,
  };

  const judgment = judgeUrp0Mission(evidence);
  const judgmentCheck = verifyUrp0Judgment({ evidence, judgment });
  if (!judgmentCheck.ok) return refuse(judgmentCheck.blocked_by, { judgment });
  if (!judgment.admissible) {
    return refuse(["sat5_refused", ...judgment.failing_verifiers.map((v) => `failing:${v}`)], { judgment });
  }

  // Persist the complete evidence packet before recording the SAT event. The
  // effect-phase write set is frozen above; the packet path is control-plane
  // evidence and must never silently become part of that effect set.
  const journal = journalPrefixBinding(stateRootDir, events);
  if (!journal.ok) return refuse(journal.blocked_by, { judgment });
  const packetPath = satEvidencePacketPath(stateRootDir, {
    mission_id: consent_context.mission_id,
    attempt_id,
  });
  const packet = buildSatEvidencePacket({
    mission_id: consent_context.mission_id,
    attempt_id,
    evidence,
    judgment,
    journal_binding: journal.binding,
    effect_phase_declared_write_paths: evidence.declared_write_paths,
    control_plane_write_paths: [packetPath],
  });
  if (!packet.ok) return refuse(packet.blocked_by, { judgment });
  const persistedPacket = persistSatEvidencePacket(stateRootDir, packet.packet);
  if (!persistedPacket.ok) return refuse(persistedPacket.blocked_by, { judgment });

  const judged = appendEvent(stateRootDir, "SAT_JUDGMENT_RECORDED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    judgment_hash: judgment.judgment_hash,
    verifier_verdicts: judgment.verifier_verdicts.map((v) => ({ id: v.id, lane: v.lane, verdict: v.verdict })),
    admissible: true,
  });
  if (!judged.ok) return refuse(judged.blocked_by, { judgment });

  const sealed = buildMissionReceipt({
    mission_id: consent_context.mission_id,
    contract_hash: contract.contract_hash,
    consent_context_hash: consent.consent_context_hash,
    consent_receipt_hash,
    result_hash: derived.result_hash,
    judgment_hash: judgment.judgment_hash,
    previous_state_root,
    executed_at_iso: now_iso,
  });

  const receipted = appendEvent(stateRootDir, "RECEIPT_RECORDED", {
    mission_id: consent_context.mission_id,
    attempt_id,
    receipt_hash: sealed.receipt_hash,
    result_hash: derived.result_hash,
    judgment_hash: judgment.judgment_hash,
  });
  if (!receipted.ok) return refuse(receipted.blocked_by, { judgment });

  writeArtifact(stateRootDir, "consent-receipt.json", consent_receipt);
  writeArtifact(stateRootDir, "mission-contract.json", contract.body);
  writeArtifact(stateRootDir, "mission-result.json", derived.result);
  writeArtifact(stateRootDir, "sat5-judgment.json", judgment);
  writeArtifact(stateRootDir, "mission-receipt.json", sealed.body);
  writeArtifact(stateRootDir, "source-non-mutation-proof.json", {
    schema: "bizra.genesis.source_non_mutation_proof.v0.1",
    canonical_root: canon.canonical_root,
    fingerprint_before: source_fingerprint_before,
    fingerprint_after: source_fingerprint_after,
    equal: source_fingerprint_before === source_fingerprint_after,
    source_files_created: 0,
    source_files_deleted: 0,
    source_files_renamed: 0,
    source_contents_modified: 0,
    source_permissions_modified: 0,
    symlinks_followed: 0,
  });

  return {
    ok: true,
    blocked_by: [],
    contract: contract.body,
    contract_hash: contract.contract_hash,
    consent_receipt,
    consent_receipt_hash,
    result: derived.result,
    result_hash: derived.result_hash,
    judgment,
    receipt: sealed.body,
    receipt_hash: sealed.receipt_hash,
    observation,
    previous_state_root,
    resulting_state_root: receipted.replay.state_root,
    source_fingerprint_before,
    source_fingerprint_after,
    sat_evidence_packet: persistedPacket.packet,
    sat_evidence_packet_path: persistedPacket.path,
    sat_evidence_packet_sha256: persistedPacket.byte_hash,
  };

  function refuse(codes, extra = {}) {
    return { ok: false, blocked_by: [...blocked, ...codes], ...extra };
  }
}

// Replay from persisted evidence alone, in this process but from the bytes on
// disk. Proves the journal is self-sufficient before Block0 binds it.
export function replayFromDisk(stateRootDir) {
  const events = loadEvents(stateRootDir);
  const replay = reduceUrp0Events(events);
  const kinds = events.map((e) => e.kind);
  const countOf = (k) => kinds.filter((x) => x === k).length;
  return {
    ok: replay.ok,
    blocked_by: replay.blocked_by,
    state_root: replay.state_root,
    events_applied: replay.events_applied,
    duplicate_human_registration: countOf("HUMAN_REGISTERED") > 1,
    duplicate_node_registration: countOf("NODE_REGISTERED") > 1,
    duplicate_mission_admission: countOf("MISSION_AUTHORIZED") > 1,
  };
}

export function sealBlock0(stateRootDir, { repository_base_commit, implementation_commit, constitution_source_hash, topology_source_hash }) {
  const state = reconstruct(stateRootDir);
  if (!state.replay.ok) return { ok: false, blocked_by: state.replay.blocked_by };
  const s = state.replay.state;
  // Seal the attempt that actually reached RECEIPTED. Refused attempts stay on
  // the record and are never sealed over.
  const receipted = Object.values(s.missions).filter((m) => m.status === "RECEIPTED");
  if (receipted.length === 0) return { ok: false, blocked_by: ["mission_not_receipted"] };
  if (receipted.length > 1) return { ok: false, blocked_by: ["multiple_receipted_attempts"] };
  const mission = receipted[0];

  const judgment = readArtifact(stateRootDir, "sat5-judgment.json");
  if (!judgment?.judgment_hash) return { ok: false, blocked_by: ["judgment_artifact_missing"] };

  const disk = replayFromDisk(stateRootDir);
  if (!disk.ok) return { ok: false, blocked_by: ["journal_not_replayable_from_disk"] };

  const block0 = buildBlock0Candidate({
    constitution_source_hash,
    topology_source_hash,
    repository_base_commit,
    implementation_commit,
    human: s.human,
    node: s.node,
    urp_state_root: disk.state_root,
    judgment,
    resource_offer_receipt_hash: s.resource_offer.offer_hash,
    contract_hash: mission.contract_hash,
    consent_receipt_hash: mission.consent_receipt_hash,
    result_hash: mission.result_hash,
    receipt_hash: mission.receipt_hash,
    restart_replay: {
      state_root_preserved: true,
      receipt_replay_verified: true,
      duplicate_human_registration: disk.duplicate_human_registration,
      duplicate_node_registration: disk.duplicate_node_registration,
      duplicate_mission_admission: disk.duplicate_mission_admission,
    },
  });

  const check = verifyBlock0Candidate(block0);
  if (!check.ok) return { ok: false, blocked_by: check.blocked_by };

  const sealedEvent = appendEvent(stateRootDir, "BLOCK0_CANDIDATE_SEALED", {
    mission_id: mission.mission_id,
    attempt_id: mission.attempt_id,
    block0_hash: block0.block0_hash,
    truth_label: URP0_TRUTH_LABEL,
    live_mint: false,
    token_created: false,
    internet_gateway: false,
    node1_admission: false,
  });
  if (!sealedEvent.ok) return { ok: false, blocked_by: sealedEvent.blocked_by };

  writeArtifact(stateRootDir, "block0-local-candidate.json", block0.body);
  return { ok: true, blocked_by: [], block0: block0.body, block0_hash: block0.block0_hash, state_root: sealedEvent.replay.state_root };
}

// The authoritative world state the DEMA World Map renders. Generated from the
// journal on every request — never asserted, never cached into a snapshot.
export function worldState(stateRootDir) {
  const { events, replay } = reconstruct(stateRootDir);
  const worldCell = replay.state?.world_cell ?? null;
  const satEvidence = worldCell
    ? Object.freeze({
        schema: "bizra.genesis.sat_evidence_ref.v0.1",
        mission_id: worldCell.dema_mission_id,
        attempt_id: worldCell.urp_attempt_id,
        source_event: "SAT_JUDGMENT_RECORDED",
        judgment_sha256: `sha256:${worldCell.sat5_judgment_hash}`,
      })
    : null;
  return {
    schema: "bizra.genesis.world_state.v0.1",
    truth_label: URP0_TRUTH_LABEL,
    ok: replay.ok,
    blocked_by: replay.blocked_by,
    urp: {
      urp_id: replay.state?.urp_id ?? "URP-0",
      state: replay.state?.urp_state ?? "INITIALIZING",
      state_root: replay.state_root,
      events_applied: replay.events_applied,
      journal_length: events.length,
    },
    ...(replay.state?.system_plane ? { system_plane: replay.state.system_plane } : {}),
    human: replay.state?.human ?? null,
    node: replay.state?.node ?? null,
    dema: {
      role: "face",
      status: worldCell ? "HEALTHY_LOCAL" : (replay.state?.system_plane ? "HEALTH_UNPROVEN" : "ACTIVE_LOCAL"),
      ...(worldCell ? { mission_id: worldCell.mission_id, receipt_hash: `sha256:${worldCell.urp_receipt_sha256}` } : {}),
    },
    pat: worldCell
      ? { status: "PAT7_OPERATIONAL_NODE0_LOCAL", autonomous_agent: false, count: worldCell.pat7_count, evidence_sha256: `sha256:${worldCell.pat7_evidence_sha256}` }
      : { status: "DESIGNED_NOT_LIVE", autonomous_agent: false },
    fate: { status: "ACTIVE_LOCAL", mode: "EXACT_STRING_CONSENT_ONLY" },
    sat: {
      ...SAT5_STATUS,
      lanes: URP0_SAT_LANES.map((l) => ({ ...l })),
      registered: replay.state?.sat_set ?? null,
      ...(replay.state?.system_plane ? {
        owner: "BIZRA_SYSTEM", principal: "CONSTITUTIONAL_SYSTEM_PLANE", logical_home: "URP-0",
        status: worldCell ? "SAT5_OPERATIONAL_URP_GENESIS" : "REGISTERED_NOT_MISSION_QUALIFIED",
        inventory: URP0_SAT_LANES.map(l => ({ role_id: l.id, instance_id: `URP-0/${l.id}`,
          verdict_contract: l.lane, owner: "BIZRA_SYSTEM", management: "SYSTEM_CONTRACT",
          evidence_scope: "MISSION_CONTRACT_ONLY", status: worldCell ? "MISSION_VERIFIED" : "REGISTERED_NOT_MISSION_QUALIFIED",
          ...(worldCell ? { verdict: "PASS", evidence_ref: { ...satEvidence, lane: l.id } } : {}) })),
      } : {}),
    },
    resource_offer: replay.state?.resource_offer ?? null,
    missions: replay.state?.missions ?? {},
    receipts: replay.state?.receipts ?? {},
    block0: replay.state?.block0 ?? null,
    world_cell: worldCell,
    boundary: urp0Boundary(),
    state_permissions: statePermissions(stateRootDir),
    journal: events.map((e) => ({ seq: e.seq, kind: e.kind, event_id: e.event_id, prev_event: e.prev_event })),
  };
}

// Operator bootstrap entry point; intentionally absent from the human HTTP API.
// Root bytes and the human authority source are verified by the bootstrap caller.
export function bindWorldCellSystemPlane(stateRootDir, { authority_source_sha256, root_bindings, now_iso }) {
  return appendEvent(stateRootDir, "SYSTEM_PLANE_BOUND", {
    system_id: "BIZRA-GENESIS-SYSTEM", owner: "BIZRA_SYSTEM",
    principal: "CONSTITUTIONAL_SYSTEM_PLANE", logical_home: "URP-0",
    bootstrap_role: "FOUNDER_GENESIS_BOOTSTRAP_ROLE", user_role: "NODE0_HUMAN_USER_ROLE",
    human_id: "HUMAN-0", founder_authority_inherited: false,
    authority_source_sha256, root_bindings, bound_at: now_iso,
  });
}
