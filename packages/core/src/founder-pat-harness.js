// W5 · isolated deterministic PAT-7 candidate harness.
//
// This is a pure candidate-record kernel. It makes no model, network,
// filesystem, clock, runtime, consent, authority, or receipt-ledger call.
// Caller-supplied seat outputs are treated as unverified proposals and are
// admitted to synthesis only when they cite permitted mission evidence.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { AGENT_FLEET_ROLES } from "./node0-agent-fleet-roles.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const FOUNDER_PAT_HARNESS_SCHEMA =
  "bizra.dema.founder_pat_harness_candidate.v0.1";
export const FOUNDER_PAT_HARNESS_TRUTH_LABEL =
  "CANDIDATE_HARNESS_PROPOSAL_ONLY";
export const FOUNDER_PAT_HARNESS_SYNTHESIS_SCHEMA =
  "bizra.dema.founder_pat_harness_synthesis.v0.1";

const PAT_TEAM = "PAT";
const CANDIDATE_STATUS = "CANDIDATE_HARNESS_PROPOSAL_ONLY";
const INVOCATION_STATUS = "NOT_INVOKED_CANDIDATE";
const TRACE_STATUS = "NOT_EXECUTED_CANDIDATE";
const SEAT_RECEIPT_SCHEMA = "bizra.dema.founder_pat_seat_receipt.v0.1";
const INVOCATION_SCHEMA = "bizra.dema.founder_pat_invocation.v0.1";
const RESULT_SCHEMA = "bizra.dema.founder_pat_result.v0.1";
const TRACE_SCHEMA = "bizra.dema.founder_pat_trace.v0.1";

const UNSUPPORTED_ENTITY_PATTERN =
  /\b(?:Demarc Co\.?|Demaroot Foundation|John Smith|freelancers?|business association|school districts?)\b/i;

export const FOUNDER_PAT_SEAT_ROLE_CONTRACTS = Object.freeze(
  AGENT_FLEET_ROLES.filter((contract) => contract?.team === PAT_TEAM),
);

const CANONICAL_ROLE_BY_ID = new Map(
  FOUNDER_PAT_SEAT_ROLE_CONTRACTS.map((contract) => [contract.role_id, contract]),
);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  }
  return value;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return [...new Set(values.map(text).filter(Boolean))];
}

function entries(value) {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  return Object.entries(value).map(([evidence_ref, details]) =>
    isObject(details) ? { ...details, evidence_ref } : { evidence_ref, source_ref: details },
  );
}

function normalizeEvidenceEntry(entry) {
  if (typeof entry === "string") {
    const evidence_ref = text(entry);
    return evidence_ref
      ? { evidence_ref, source_ref: null, source_sha256: null, provenance: { evidence_ref } }
      : null;
  }
  if (!isObject(entry)) return null;
  const evidence_ref = text(entry.evidence_ref ?? entry.ref);
  if (!evidence_ref) return null;
  return {
    evidence_ref,
    source_ref: text(entry.source_ref ?? entry.source) || null,
    source_sha256: text(entry.source_sha256) || null,
    provenance: clone(entry),
  };
}

function normalizeMission(input) {
  const mission = isObject(input.mission) ? input.mission : {};
  const mission_id = text(input.mission_id ?? mission.mission_id);
  const rawEvidence =
    input.permitted_evidence ??
    input.mission_evidence ??
    mission.permitted_evidence ??
    mission.evidence ??
    [];
  const normalizedEvidence = entries(rawEvidence)
    .map(normalizeEvidenceEntry)
    .filter(Boolean);
  const explicitRefs =
    input.permitted_evidence_refs ?? mission.permitted_evidence_refs;
  const permitted_evidence_refs = strings(
    explicitRefs ?? normalizedEvidence.map((evidence) => evidence.evidence_ref),
  );
  const evidenceByRef = new Map(
    normalizedEvidence.map((evidence) => [evidence.evidence_ref, evidence]),
  );
  const permitted_evidence = permitted_evidence_refs.map(
    (evidence_ref) =>
      evidenceByRef.get(evidence_ref) ?? {
        evidence_ref,
        source_ref: null,
        source_sha256: null,
        provenance: { evidence_ref },
      },
  );
  return { mission_id, permitted_evidence_refs, permitted_evidence };
}

function normalizeSeatOutputs(value) {
  return entries(value)
    .map((entry) => {
      if (!isObject(entry)) return null;
      return {
        role_id: text(entry.role_id ?? entry.seat_id),
        output_text: text(entry.output_text ?? entry.output ?? entry.text) || null,
        evidence_refs: strings(
          entry.evidence_refs ?? entry.grounded_evidence_refs ?? entry.provenance_refs,
        ),
      };
    })
    .filter(Boolean);
}

function validateRoleContracts(value) {
  const blocked_by = [];
  if (!Array.isArray(value)) return { blocked_by: ["role_contracts_not_array"] };
  if (value.length !== FOUNDER_PAT_SEAT_ROLE_CONTRACTS.length) {
    blocked_by.push(`role_contract_count:${value.length}`);
  }
  const seen = new Set();
  for (const contract of value) {
    const role_id = text(contract?.role_id);
    if (seen.has(role_id)) blocked_by.push(`duplicate_role_contract:${role_id}`);
    seen.add(role_id);
    const canonical = CANONICAL_ROLE_BY_ID.get(role_id);
    if (!canonical) {
      blocked_by.push(`unknown_pat_role_contract:${role_id || "missing"}`);
    } else if (sha256CanonicalJsonV1(contract) !== sha256CanonicalJsonV1(canonical)) {
      blocked_by.push(`role_contract_mismatch:${role_id}`);
    }
  }
  const suppliedIds = new Set(value.map((contract) => text(contract?.role_id)));
  for (const contract of FOUNDER_PAT_SEAT_ROLE_CONTRACTS) {
    if (!suppliedIds.has(contract.role_id)) {
      blocked_by.push(`missing_pat_role_contract:${contract.role_id}`);
    }
  }
  return { blocked_by: [...new Set(blocked_by)] };
}

function correlationId(kind, mission_id, role_id) {
  return `pat7.${kind}.${mission_id}.${role_id}`;
}

function buildBlocked(blocked_by) {
  const body = {
    schema: FOUNDER_PAT_HARNESS_SCHEMA,
    truth_label: FOUNDER_PAT_HARNESS_TRUTH_LABEL,
    mode: "candidate_harness",
    status: "BLOCKED",
    blocked_by: Object.freeze([...new Set(blocked_by)]),
    mission_id: null,
    subtask_refs: Object.freeze([]),
    synthesis_refs: Object.freeze([]),
    seat_contracts: Object.freeze([]),
    seat_receipts: Object.freeze([]),
    synthesis: null,
    authority_delta: 0,
    boundary: buildPreviewBoundary(),
    what_this_proves: Object.freeze([]),
    what_this_does_not_prove: Object.freeze([
      "This blocked candidate is not a live PAT runtime.",
      "No model, network, runtime, authority, or canonical receipt was used.",
    ]),
  };
  return deepFreeze({ ...body, content_hash: sha256CanonicalJsonV1(body) });
}

function buildSeatReceipt({ mission, contract, seatOutput, seat_index }) {
  const role_id = contract.role_id;
  const subtask_ref = `${mission.mission_id}/pat/${role_id}`;
  const invocation_id = correlationId("invocation", mission.mission_id, role_id);
  const result_id = correlationId("result", mission.mission_id, role_id);
  const trace_id = correlationId("trace", mission.mission_id, role_id);
  const inputBody = {
    mission_id: mission.mission_id,
    role_id,
    subtask_ref,
    permitted_evidence_refs: mission.permitted_evidence_refs,
  };
  const input_hash = sha256CanonicalJsonV1(inputBody);

  const evidenceByRef = new Map(
    mission.permitted_evidence.map((evidence) => [evidence.evidence_ref, evidence]),
  );
  const evidence_refs = seatOutput?.evidence_refs ?? [];
  const grounded_evidence_refs = evidence_refs.filter((ref) =>
    evidenceByRef.has(ref),
  );
  const rejected_evidence_refs = evidence_refs.filter(
    (ref) => !evidenceByRef.has(ref),
  );
  const output_text = seatOutput?.output_text ?? null;
  const unsupported_entity = Boolean(
    output_text && UNSUPPORTED_ENTITY_PATTERN.test(output_text),
  );
  const grounding_status = unsupported_entity
    ? "QUARANTINED_UNSUPPORTED_ENTITY"
    : rejected_evidence_refs.length > 0
      ? "QUARANTINED_UNPERMITTED_EVIDENCE"
      : !output_text
        ? "QUARANTINED_EMPTY_RESULT"
        : grounded_evidence_refs.length === 0
          ? "QUARANTINED_NO_PERMITTED_EVIDENCE"
          : "GROUNDED_PROPOSAL";
  const evidence_provenance = grounded_evidence_refs.map((evidence_ref) => {
    const evidence = evidenceByRef.get(evidence_ref);
    return {
      evidence_ref,
      source_ref: evidence.source_ref,
      source_sha256: evidence.source_sha256,
    };
  });

  const invocationBody = {
    schema: INVOCATION_SCHEMA,
    invocation_id,
    role_id,
    mission_id: mission.mission_id,
    subtask_ref,
    status: INVOCATION_STATUS,
    input_hash,
    result_id,
    trace_id,
  };
  const invocation = {
    ...invocationBody,
    permitted_evidence_refs: mission.permitted_evidence_refs,
  };

  const resultBody = {
    schema: RESULT_SCHEMA,
    result_id,
    role_id,
    invocation_id,
    trace_id,
    status: "CANDIDATE_RESULT",
    truth_label: FOUNDER_PAT_HARNESS_TRUTH_LABEL,
    output_text,
    evidence_refs,
    grounded_evidence_refs,
    rejected_evidence_refs,
    grounding_status,
    unsupported_entity,
    provenance: {
      mission_id: mission.mission_id,
      subtask_ref,
      evidence_provenance,
    },
  };
  const result = {
    ...resultBody,
    result_hash: sha256CanonicalJsonV1(resultBody),
  };

  const traceBody = {
    schema: TRACE_SCHEMA,
    trace_id,
    role_id,
    invocation_id,
    result_id,
    invocation_status: INVOCATION_STATUS,
    status: TRACE_STATUS,
    input_hash,
    result_hash: result.result_hash,
    evidence_refs: grounded_evidence_refs,
  };
  const trace = { ...traceBody, trace_hash: sha256CanonicalJsonV1(traceBody) };

  return {
    schema: SEAT_RECEIPT_SCHEMA,
    receipt_status: "CANDIDATE_RECORD_ONLY",
    seat_index,
    role_id,
    subtask_ref,
    role_contract: contract,
    invocation,
    result,
    trace,
  };
}

function buildSynthesis(mission_id, seat_receipts) {
  const grounded = seat_receipts.filter(
    (seat) => seat.result.grounding_status === "GROUNDED_PROPOSAL",
  );
  const source_result_ids = grounded.map((seat) => seat.result.result_id);
  const source_trace_ids = grounded.map((seat) => seat.trace.trace_id);
  const evidence_refs = [
    ...new Set(
      grounded.flatMap((seat) => seat.result.grounded_evidence_refs),
    ),
  ];
  const output_text = grounded.length
    ? grounded
        .map(
          (seat) =>
            `${seat.role_id} · ${seat.subtask_ref} · ${seat.result.output_text} · evidence=${seat.result.grounded_evidence_refs.join(",")}`,
        )
        .join("\n")
    : "NO_MISSION_GROUNDED_PROPOSALS";
  const body = {
    schema: FOUNDER_PAT_HARNESS_SYNTHESIS_SCHEMA,
    synthesis_id: `pat7.synthesis.${mission_id}`,
    status: grounded.length
      ? "GROUNDED_PROPOSAL_ONLY"
      : "NO_GROUNDED_PROPOSALS",
    truth_label: FOUNDER_PAT_HARNESS_TRUTH_LABEL,
    deterministic: true,
    mission_id,
    output_text,
    source_result_ids,
    source_trace_ids,
    evidence_refs,
    provenance: {
      mission_id,
      source_result_ids,
      source_trace_ids,
      evidence_refs,
    },
  };
  return { ...body, synthesis_hash: sha256CanonicalJsonV1(body) };
}

/**
 * Build one deterministic, candidate-only PAT-7 run record.
 *
 * `seat_outputs` are pasted or fixture data, never an invocation hook. Every
 * canonical PAT seat receives exactly one planned invocation, result record,
 * and trace record whether its supplied proposal is admitted or quarantined.
 */
export function buildFounderPatHarnessCandidate(input = {}) {
  const mission = normalizeMission(input);
  const roleContracts =
    input.role_contracts === undefined
      ? FOUNDER_PAT_SEAT_ROLE_CONTRACTS
      : input.role_contracts;
  const roleCheck = validateRoleContracts(roleContracts);
  const seatOutputs = normalizeSeatOutputs(
    input.seat_outputs ?? input.seat_results ?? [],
  );
  const blocked_by = [...roleCheck.blocked_by];

  if (!mission.mission_id) blocked_by.push("mission_id_required");
  if (mission.permitted_evidence_refs.length === 0) {
    blocked_by.push("permitted_evidence_required");
  }
  const seenOutputRoles = new Set();
  for (const seatOutput of seatOutputs) {
    if (!CANONICAL_ROLE_BY_ID.has(seatOutput.role_id)) {
      blocked_by.push(`unknown_seat_output:${seatOutput.role_id || "missing"}`);
    } else if (seenOutputRoles.has(seatOutput.role_id)) {
      blocked_by.push(`duplicate_seat_output:${seatOutput.role_id}`);
    }
    seenOutputRoles.add(seatOutput.role_id);
  }
  if (blocked_by.length > 0) return buildBlocked(blocked_by);

  const seatOutputByRole = new Map(
    seatOutputs.map((seatOutput) => [seatOutput.role_id, seatOutput]),
  );
  const seat_receipts = FOUNDER_PAT_SEAT_ROLE_CONTRACTS.map((contract, index) =>
    buildSeatReceipt({
      mission,
      contract,
      seatOutput: seatOutputByRole.get(contract.role_id),
      seat_index: index + 1,
    }),
  );
  const synthesis = buildSynthesis(mission.mission_id, seat_receipts);
  const synthesis_refs = [
    ...synthesis.source_result_ids,
    ...synthesis.source_trace_ids,
    ...synthesis.evidence_refs,
  ];
  const body = {
    schema: FOUNDER_PAT_HARNESS_SCHEMA,
    truth_label: FOUNDER_PAT_HARNESS_TRUTH_LABEL,
    mode: "candidate_harness",
    status: CANDIDATE_STATUS,
    mission_id: mission.mission_id,
    mission: {
      mission_id: mission.mission_id,
      permitted_evidence_refs: mission.permitted_evidence_refs,
      permitted_evidence: mission.permitted_evidence,
    },
    seat_count: seat_receipts.length,
    all_seats_correlated: seat_receipts.length === 7,
    subtask_refs: seat_receipts.map((seat) => seat.subtask_ref),
    synthesis_refs,
    seat_contracts: FOUNDER_PAT_SEAT_ROLE_CONTRACTS,
    seat_receipts,
    synthesis,
    authority_delta: 0,
    boundary: buildPreviewBoundary(),
    what_this_proves: [
      "Seven distinct canonical PAT role contracts are represented.",
      "Each seat has one candidate invocation, result, and trace correlation.",
      "Only outputs citing permitted mission evidence enter the deterministic synthesis.",
    ],
    what_this_does_not_prove: [
      "This is not a live PAT runtime or a model invocation.",
      "No network, filesystem, runtime execution, consent consumption, authority grant, or canonical receipt mint occurred.",
      "Grounded output remains an unverified proposal and does not establish semantic truth or task completion.",
    ],
  };
  return deepFreeze({ ...body, content_hash: sha256CanonicalJsonV1(body) });
}

function checkBoundary(boundary) {
  return (
    boundary &&
    typeof boundary === "object" &&
    Object.keys(boundary).length === Object.keys(buildPreviewBoundary()).length &&
    Object.values(boundary).every((value) => value === false)
  );
}

function addCorrelationChecks(blocked_by, seat_receipts, mission_id, permittedRefs) {
  const invocationIds = new Set();
  const resultIds = new Set();
  const traceIds = new Set();
  const resultHashes = new Set();
  for (const seat of seat_receipts) {
    const prefix = `seat:${seat?.role_id ?? "missing"}`;
    const canonical = CANONICAL_ROLE_BY_ID.get(seat?.role_id);
    if (!canonical) {
      blocked_by.push(`${prefix}:role_unknown`);
      continue;
    }
    if (sha256CanonicalJsonV1(seat.role_contract) !== sha256CanonicalJsonV1(canonical)) {
      blocked_by.push(`${prefix}:role_contract_mismatch`);
    }
    if (seat.role_contract.role_id !== seat.role_id) {
      blocked_by.push(`${prefix}:role_contract_id_mismatch`);
    }
    const invocation = seat.invocation;
    const result = seat.result;
    const trace = seat.trace;
    if (!invocation || !result || !trace) {
      blocked_by.push(`${prefix}:correlation_record_missing`);
      continue;
    }
    if (invocation.result_id !== result.result_id || invocation.trace_id !== trace.trace_id) {
      blocked_by.push(`${prefix}:invocation_correlation_mismatch`);
    }
    if (result.invocation_id !== invocation.invocation_id || result.trace_id !== trace.trace_id) {
      blocked_by.push(`${prefix}:result_correlation_mismatch`);
    }
    if (trace.invocation_id !== invocation.invocation_id || trace.result_id !== result.result_id) {
      blocked_by.push(`${prefix}:trace_correlation_mismatch`);
    }
    if (invocation.status !== INVOCATION_STATUS) blocked_by.push(`${prefix}:invocation_status_invalid`);
    if (trace.status !== TRACE_STATUS) blocked_by.push(`${prefix}:trace_status_invalid`);
    if (invocation.role_id !== seat.role_id || result.role_id !== seat.role_id || trace.role_id !== seat.role_id) {
      blocked_by.push(`${prefix}:role_correlation_mismatch`);
    }
    if (invocationIds.has(invocation.invocation_id)) blocked_by.push(`${prefix}:duplicate_invocation_id`);
    if (resultIds.has(result.result_id)) blocked_by.push(`${prefix}:duplicate_result_id`);
    if (traceIds.has(trace.trace_id)) blocked_by.push(`${prefix}:duplicate_trace_id`);
    invocationIds.add(invocation.invocation_id);
    resultIds.add(result.result_id);
    traceIds.add(trace.trace_id);
    if (resultHashes.has(result.result_hash)) blocked_by.push(`${prefix}:duplicate_result_hash`);
    resultHashes.add(result.result_hash);

    const expectedSubtask = `${mission_id}/pat/${seat.role_id}`;
    if (seat.subtask_ref !== expectedSubtask || invocation.subtask_ref !== expectedSubtask) {
      blocked_by.push(`${prefix}:subtask_ref_mismatch`);
    }
    if (invocation.mission_id !== mission_id) blocked_by.push(`${prefix}:mission_ref_mismatch`);
    if (!invocation.permitted_evidence_refs.every((ref) => permittedRefs.includes(ref))) {
      blocked_by.push(`${prefix}:invocation_evidence_scope_mismatch`);
    }
    if (!result.grounded_evidence_refs.every((ref) => permittedRefs.includes(ref))) {
      blocked_by.push(`${prefix}:result_evidence_scope_mismatch`);
    }
    if (!trace.evidence_refs.every((ref) => permittedRefs.includes(ref))) {
      blocked_by.push(`${prefix}:trace_evidence_scope_mismatch`);
    }
    const { result_hash, ...resultBody } = result;
    if (result_hash !== sha256CanonicalJsonV1(resultBody)) {
      blocked_by.push(`${prefix}:result_hash_mismatch`);
    }
    const { trace_hash, ...traceBody } = trace;
    if (trace_hash !== sha256CanonicalJsonV1(traceBody)) {
      blocked_by.push(`${prefix}:trace_hash_mismatch`);
    }
    if (trace.result_hash !== result.result_hash) blocked_by.push(`${prefix}:trace_result_hash_mismatch`);
    const expectedInputHash = sha256CanonicalJsonV1({
      mission_id,
      role_id: seat.role_id,
      subtask_ref: expectedSubtask,
      permitted_evidence_refs: permittedRefs,
    });
    if (invocation.input_hash !== expectedInputHash || trace.input_hash !== expectedInputHash) {
      blocked_by.push(`${prefix}:input_hash_mismatch`);
    }
    if (result.unsupported_entity && result.grounding_status !== "QUARANTINED_UNSUPPORTED_ENTITY") {
      blocked_by.push(`${prefix}:unsupported_entity_admitted`);
    }
  }
  if (invocationIds.size !== 7 || resultIds.size !== 7 || traceIds.size !== 7) {
    blocked_by.push("seven_seat_correlations_required");
  }
}

/** Re-derive the candidate-only invariants without invoking anything. */
export function verifyFounderPatHarnessCandidate(candidate) {
  const blocked_by = [];
  if (!isObject(candidate)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["candidate_not_object"]) });
  }
  if (candidate.schema !== FOUNDER_PAT_HARNESS_SCHEMA) blocked_by.push("schema_mismatch");
  if (candidate.truth_label !== FOUNDER_PAT_HARNESS_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (candidate.status !== CANDIDATE_STATUS) blocked_by.push("status_not_candidate_only");
  if (candidate.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (!checkBoundary(candidate.boundary)) blocked_by.push("boundary_not_all_false");
  if (candidate.seat_count !== 7 || candidate.seat_receipts?.length !== 7) {
    blocked_by.push("seat_count_not_seven");
  }
  if (candidate.all_seats_correlated !== true) blocked_by.push("seats_not_correlated");
  if (typeof candidate.mission_id !== "string" || !candidate.mission_id) blocked_by.push("mission_id_missing");

  const { content_hash, ...body } = candidate;
  if (content_hash !== sha256CanonicalJsonV1(body)) blocked_by.push("content_hash_mismatch");
  if (!Array.isArray(candidate.seat_receipts)) {
    blocked_by.push("seat_receipts_not_array");
    return deepFreeze({ ok: false, blocked_by: [...new Set(blocked_by)] });
  }

  const permittedRefs = Array.isArray(candidate.mission?.permitted_evidence_refs)
    ? candidate.mission.permitted_evidence_refs
    : [];
  if (candidate.mission?.mission_id !== candidate.mission_id) blocked_by.push("mission_id_mismatch");
  if (new Set(permittedRefs).size !== permittedRefs.length) blocked_by.push("permitted_evidence_duplicate");
  addCorrelationChecks(blocked_by, candidate.seat_receipts, candidate.mission_id, permittedRefs);

  const expectedSubtaskRefs = candidate.seat_receipts.map((seat) => seat.subtask_ref);
  if (sha256CanonicalJsonV1(candidate.subtask_refs ?? []) !== sha256CanonicalJsonV1(expectedSubtaskRefs)) {
    blocked_by.push("subtask_refs_mismatch");
  }
  const expectedSynthesis = buildSynthesis(candidate.mission_id, candidate.seat_receipts);
  if (sha256CanonicalJsonV1(candidate.synthesis ?? null) !== sha256CanonicalJsonV1(expectedSynthesis)) {
    blocked_by.push("synthesis_mismatch");
  }
  const expectedSynthesisRefs = [
    ...expectedSynthesis.source_result_ids,
    ...expectedSynthesis.source_trace_ids,
    ...expectedSynthesis.evidence_refs,
  ];
  if (sha256CanonicalJsonV1(candidate.synthesis_refs ?? []) !== sha256CanonicalJsonV1(expectedSynthesisRefs)) {
    blocked_by.push("synthesis_refs_mismatch");
  }
  const expectedContracts = FOUNDER_PAT_SEAT_ROLE_CONTRACTS;
  if (sha256CanonicalJsonV1(candidate.seat_contracts ?? []) !== sha256CanonicalJsonV1(expectedContracts)) {
    blocked_by.push("seat_contracts_mismatch");
  }

  return deepFreeze({
    ok: blocked_by.length === 0,
    schema: FOUNDER_PAT_HARNESS_SCHEMA,
    truth_label: FOUNDER_PAT_HARNESS_TRUTH_LABEL,
    blocked_by: [...new Set(blocked_by)],
  });
}
