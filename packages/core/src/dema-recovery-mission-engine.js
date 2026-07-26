// DEMA-RECOVERY-MISSION-ENGINE-1A — Deterministic human-gated Recovery Mission state machine: declare -> reconstruct -> candidates -> human revival -> use -> verify -> seal; every transition guarded, no auto-selection, worker output is evidence not authority.
//
// Pure kernel over an INJECTED event history: events are an injected array — no
// fs / network / process / clock / random. Durable storage is NOT implemented;
// the derived mission state exists only for the duration of a call. Any defect
// halts the reduction fail-closed with a named, canonicalizable block and no
// partial state. A worker's "done" claim (WORKER_RESULT) is evidence only — it
// can only move the mission to VERIFYING, never to SEALED by itself. Only a
// HUMAN_REVIVAL event can advance a mission out of AWAITING_HUMAN — there is no
// auto-selection path.

// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy. Unsupported values (undefined, NaN, sparse arrays,
// accessors, ...) fail closed inside packages/canon with registered error
// codes. The scaffold auto-registers this kernel's path in
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS (scripts/review/canonical-json-v1-check.mjs);
// review that one-line diff in this slice's PR.
import { CANONICAL_JSON_V1_ALGORITHM, canonicalizeJsonV1 } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const DEMA_RECOVERY_MISSION_ENGINE_SCHEMA = "bizra.dema.dema_recovery_mission_engine.v0.1";
export const DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL = "DEMA_RECOVERY_MISSION_ENGINE_MEASURED_REPO";
export const DEMA_RECOVERY_MISSION_ENGINE_GO_PHRASE = "GO: dema recovery mission engine preview";

export const DEMA_RECOVERY_MISSION_GENESIS_EVENT_ID = "GENESIS";

export const DEMA_RECOVERY_MISSION_EVENT_KINDS = Object.freeze([
  "MISSION_DECLARED",
  "RECONSTRUCTED",
  "AWAIT_HUMAN",
  "HUMAN_REVIVAL",
  "WORKER_RESULT",
  "VERIFIER_VERDICT",
  "STOP",
]);

// Declared state vocabulary (spec phase_03). RECONSTRUCTING is named by the
// spec but unreached by the transition table below: RECONSTRUCTED moves
// DECLARED straight to CANDIDATES_READY in one guarded step — it is kept here
// as documentation of the full state name space, not as a reachable value of
// `current_state`.
export const DEMA_RECOVERY_MISSION_STATES = Object.freeze([
  "DECLARED",
  "RECONSTRUCTING",
  "CANDIDATES_READY",
  "AWAITING_HUMAN",
  "IN_USE_MISSION",
  "VERIFYING",
  "SEALED",
  "STOPPED",
]);

const STOP_CAUSES = Object.freeze([
  "missing_source_identity",
  "privacy_ambiguity",
  "budget_exhausted",
  "authority_exceeded",
]);

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function demaRecoveryMissionEngineBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// Bounded schema-local deep freeze: walks own enumerable properties of plain
// objects/arrays (the only shapes this schema emits or accepts as canonical).
// ponytail: cycle-safe via seen-set; not a repository-wide abstraction.
function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Object.keys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

// One hashing rule for events, shared by producers, tests and the verifier:
// event_id = sha256 over the canonical bytes of {seq, kind, payload, prev_event}.
// The returned event (payload included) is deep-frozen so hash-bound content
// cannot drift after construction.
export function makeDemaRecoveryMissionEvent({ seq, kind, payload, prev_event }) {
  const core = { seq, kind, payload, prev_event };
  return deepFreeze({ ...core, event_id: sha256CanonicalJsonV1(core) });
}

function genesisState() {
  return {
    mission_id: null,
    current_state: null,
    objective_text: null,
    source_boundary: null,
    success_definition: null,
    chronology: null,
    contradiction_map: null,
    candidates: null,
    not_accessed_report: null,
    chosen_asset_id: null,
    worker_result: null,
    verifier_verdict: null,
    stop_cause: null,
    seal_receipt: null,
    head: { seq: 0, event_id: DEMA_RECOVERY_MISSION_GENESIS_EVENT_ID },
  };
}

function freezeState(state) {
  return deepFreeze({
    mission_id: state.mission_id,
    current_state: state.current_state,
    objective_text: state.objective_text,
    source_boundary: state.source_boundary,
    success_definition: state.success_definition,
    chronology: state.chronology,
    contradiction_map: state.contradiction_map,
    candidates: state.candidates,
    not_accessed_report: state.not_accessed_report,
    chosen_asset_id: state.chosen_asset_id,
    worker_result: state.worker_result,
    verifier_verdict: state.verifier_verdict,
    stop_cause: state.stop_cause,
    seal_receipt: state.seal_receipt,
    head: { ...state.head },
  });
}

// Deterministic fail-closed reduction: events -> mission state. Halts at the
// first defect with a named block and the offending seq; exposes NO partial
// state on failure. Same events in, same state out — no clock, no randomness.
export function reduceDemaRecoveryMissionEvents(events) {
  const halt = (blocked_by, seq, applied) =>
    Object.freeze({
      ok: false,
      blocked_by: Object.freeze(blocked_by),
      halted_at_seq: seq,
      events_applied: applied,
    });

  if (!Array.isArray(events)) return halt(["events_not_array"], null, 0);

  const state = genesisState();
  let applied = 0;

  for (const event of events) {
    const expectedSeq = state.head.seq + 1;
    if (!event || typeof event !== "object") return halt(["event_not_object"], expectedSeq, applied);
    const { seq, kind, payload, prev_event, event_id } = event;
    if (!Number.isInteger(seq)) return halt(["seq_not_integer"], null, applied);
    if (seq !== expectedSeq) return halt(["seq_not_contiguous"], seq, applied);
    if (!DEMA_RECOVERY_MISSION_EVENT_KINDS.includes(kind)) return halt(["kind_unknown"], seq, applied);
    if (!payload || typeof payload !== "object") return halt(["payload_not_object"], seq, applied);
    if (prev_event !== state.head.event_id) return halt(["prev_event_mismatch"], seq, applied);
    // Non-canonical event content (undefined, NaN, cycles, accessors, non-plain
    // objects, ...) is a named replay defect, not an escaping exception. Only
    // the canon contract's coded errors are absorbed; anything else rethrows.
    let rederivedId = null;
    try {
      rederivedId = sha256CanonicalJsonV1({ seq, kind, payload, prev_event });
    } catch (error) {
      if (typeof error?.code !== "string") throw error;
      return halt(["event_not_canonicalizable"], seq, applied);
    }
    if (event_id !== rederivedId) return halt(["event_id_mismatch"], seq, applied);

    // Terminal states accept no further events of any kind (checked before the
    // kind-specific switch so the terminal reason always wins).
    if (state.current_state === "SEALED" || state.current_state === "STOPPED") {
      return halt(["mission_already_terminal"], seq, applied);
    }

    if (kind === "MISSION_DECLARED") {
      // First event only: unreachable a second time because mission_id is set
      // by the first successful MISSION_DECLARED and never cleared.
      if (state.mission_id !== null) return halt(["mission_already_declared"], seq, applied);
      if (typeof payload.mission_id !== "string" || payload.mission_id === "") {
        return halt(["mission_id_missing"], seq, applied);
      }
      if (typeof payload.objective_text !== "string" || payload.objective_text === "") {
        return halt(["objective_text_missing"], seq, applied);
      }
      const sb = payload.source_boundary;
      const sbValid =
        sb &&
        typeof sb === "object" &&
        Array.isArray(sb.roots) &&
        sb.roots.every((r) => typeof r === "string" && r !== "") &&
        Array.isArray(sb.exclusions) &&
        sb.exclusions.every((r) => typeof r === "string");
      if (!sbValid) return halt(["source_boundary_invalid"], seq, applied);
      if (typeof payload.success_definition !== "string" || payload.success_definition === "") {
        return halt(["success_definition_missing"], seq, applied);
      }
      state.mission_id = payload.mission_id;
      state.objective_text = payload.objective_text;
      state.source_boundary = { roots: [...sb.roots], exclusions: [...sb.exclusions] };
      state.success_definition = payload.success_definition;
      state.current_state = "DECLARED";
    } else if (kind === "RECONSTRUCTED") {
      if (state.current_state !== "DECLARED") return halt(["reconstruct_requires_declared_state"], seq, applied);
      // Exact-string consent discipline: a non-empty consent_id field, not a
      // truthiness check.
      if (typeof payload.consent_id !== "string" || payload.consent_id === "") {
        return halt(["consent_id_missing"], seq, applied);
      }
      if (!Array.isArray(payload.chronology)) return halt(["chronology_not_array"], seq, applied);
      if (!Array.isArray(payload.contradiction_map)) return halt(["contradiction_map_not_array"], seq, applied);
      if (!Array.isArray(payload.candidates)) return halt(["candidates_not_array"], seq, applied);
      if (payload.candidates.length > 7) return halt(["candidates_exceed_cap"], seq, applied);
      for (const c of payload.candidates) {
        const shapeOk =
          c &&
          typeof c === "object" &&
          typeof c.asset_id === "string" &&
          c.asset_id !== "" &&
          Array.isArray(c.source_lineage) &&
          typeof c.limitations === "string";
        if (!shapeOk) return halt(["candidate_shape_invalid"], seq, applied);
        // No orphan content: every candidate must carry at least one lineage entry.
        if (c.source_lineage.length === 0) return halt(["candidate_source_lineage_empty"], seq, applied);
        for (const l of c.source_lineage) {
          if (!l || typeof l !== "object" || typeof l.root !== "string" || l.root === "" || typeof l.ref !== "string" || l.ref === "") {
            return halt(["candidate_source_lineage_invalid"], seq, applied);
          }
        }
      }
      if (payload.not_accessed_report === undefined || payload.not_accessed_report === null) {
        return halt(["not_accessed_report_missing"], seq, applied);
      }
      state.chronology = payload.chronology;
      state.contradiction_map = payload.contradiction_map;
      state.candidates = payload.candidates;
      state.not_accessed_report = payload.not_accessed_report;
      state.current_state = "CANDIDATES_READY";
    } else if (kind === "AWAIT_HUMAN") {
      if (state.current_state !== "CANDIDATES_READY") return halt(["await_human_requires_candidates_ready_state"], seq, applied);
      state.current_state = "AWAITING_HUMAN";
    } else if (kind === "HUMAN_REVIVAL") {
      // NO auto-selection: this is the only event that can advance out of
      // AWAITING_HUMAN, and it requires a human-supplied chosen_asset_id that
      // was actually surfaced as a candidate.
      if (state.current_state !== "AWAITING_HUMAN") return halt(["human_revival_requires_awaiting_human_state"], seq, applied);
      const chosen = payload.chosen_asset_id;
      if (typeof chosen !== "string" || chosen === "") return halt(["chosen_asset_id_missing"], seq, applied);
      if (!state.candidates.some((c) => c.asset_id === chosen)) return halt(["revival_asset_not_a_candidate"], seq, applied);
      state.chosen_asset_id = chosen;
      state.current_state = "IN_USE_MISSION";
    } else if (kind === "WORKER_RESULT") {
      // Evidence only: this transition can only reach VERIFYING, never SEALED.
      if (state.current_state !== "IN_USE_MISSION") return halt(["worker_result_requires_in_use_mission_state"], seq, applied);
      if (typeof payload.worker_id !== "string" || payload.worker_id === "") return halt(["worker_id_missing"], seq, applied);
      if (typeof payload.result_ref !== "string" || payload.result_ref === "") return halt(["result_ref_missing"], seq, applied);
      state.worker_result = { worker_id: payload.worker_id, result_ref: payload.result_ref, at_seq: seq };
      state.current_state = "VERIFYING";
    } else if (kind === "VERIFIER_VERDICT") {
      if (state.current_state !== "VERIFYING") return halt(["verifier_verdict_requires_verifying_state"], seq, applied);
      if (typeof payload.verifier_id !== "string" || payload.verifier_id === "") return halt(["verifier_id_missing"], seq, applied);
      if (payload.verdict !== "PASS" && payload.verdict !== "FAIL") return halt(["verdict_invalid"], seq, applied);
      if (typeof payload.used_asset_id !== "string" || payload.used_asset_id === "") return halt(["used_asset_id_missing"], seq, applied);
      if (payload.verdict === "PASS") {
        // Verifier independence: the verifier may not be the same actor as the
        // worker who generated the result under review.
        if (payload.verifier_id === state.worker_result.worker_id) return halt(["verifier_is_generator"], seq, applied);
        // Gate 2: the asset actually used in the mission must be the one the
        // human chose — a verdict on an unused asset seals nothing.
        if (payload.used_asset_id !== state.chosen_asset_id) return halt(["asset_not_used_in_mission"], seq, applied);
        state.seal_receipt = Object.freeze({
          asset_id: state.chosen_asset_id,
          verifier_id: payload.verifier_id,
          worker_id: state.worker_result.worker_id,
          sealed_at_seq: seq,
        });
        state.current_state = "SEALED";
      } else {
        state.verifier_verdict = { verifier_id: payload.verifier_id, verdict: "FAIL", used_asset_id: payload.used_asset_id, at_seq: seq };
        state.stop_cause = "verify_failed";
        state.current_state = "STOPPED";
      }
    } else if (kind === "STOP") {
      if (state.current_state === null) return halt(["mission_not_declared"], seq, applied);
      if (!STOP_CAUSES.includes(payload.cause)) return halt(["stop_cause_invalid"], seq, applied);
      state.stop_cause = payload.cause;
      state.current_state = "STOPPED";
    }

    state.head = { seq, event_id };
    applied += 1;
  }

  return Object.freeze({
    ok: true,
    blocked_by: Object.freeze([]),
    halted_at_seq: null,
    events_applied: applied,
    state: freezeState(state),
  });
}

// Pure derivation helper (spec §3): raw evidence -> chronology + contradiction_map
// + ranked candidates + not_accessed_report. This is the RECONSTRUCTED event
// payload's builder — a standalone function so it can be tested directly.
//
// Never emits content whose root falls outside `source_boundary` (roots minus
// exclusions): excluded evidence is named in `not_accessed_report`, never
// silently dropped and never surfaced in chronology or candidates. Unknown-time
// evidence is bucketed under the literal "UNKNOWN" sentinel — NEVER interpolated
// or guessed into an ordered slot. Candidate `rank` is a labeled integer
// position (1-based), never a decimal relevance score; only the top 7 by rank
// are returned — the rest are named in not_accessed_report with reason
// "exceeds_candidate_cap".
export function reconstructRecoveryCandidates(items) {
  const evidence = Array.isArray(items?.evidence) ? items.evidence : [];
  const source_boundary = items?.source_boundary;
  const roots = Array.isArray(source_boundary?.roots) ? source_boundary.roots : [];
  const exclusions = Array.isArray(source_boundary?.exclusions) ? source_boundary.exclusions : [];
  const inBoundary = (root) => roots.includes(root) && !exclusions.includes(root);

  const notAccessed = [];
  const accepted = [];
  for (const item of evidence) {
    if (inBoundary(item.root)) {
      accepted.push(item);
    } else {
      notAccessed.push({ asset_id: item.asset_id, root: item.root, ref: item.ref, reason: "out_of_source_boundary" });
    }
  }

  const known = accepted
    .filter((i) => typeof i.best_evidence_time === "string" && i.best_evidence_time !== "")
    .slice()
    .sort((a, b) =>
      a.best_evidence_time === b.best_evidence_time
        ? a.asset_id.localeCompare(b.asset_id)
        : a.best_evidence_time < b.best_evidence_time
        ? -1
        : 1,
    );
  const unknownTime = accepted.filter((i) => !(typeof i.best_evidence_time === "string" && i.best_evidence_time !== ""));
  const chronology = [
    ...known.map((i) => ({ asset_id: i.asset_id, root: i.root, ref: i.ref, best_evidence_time: i.best_evidence_time })),
    ...unknownTime.map((i) => ({ asset_id: i.asset_id, root: i.root, ref: i.ref, best_evidence_time: "UNKNOWN" })),
  ];

  // Declared conflicts carried through VERBATIM — never synthesized or
  // inferred. Dropped only if the referenced asset fell outside the boundary
  // (a dangling reference to excluded content, not interpolated either).
  const acceptedIds = new Set(accepted.map((i) => i.asset_id));
  const contradiction_map = [];
  for (const item of accepted) {
    for (const conflict of Array.isArray(item.conflicts_with) ? item.conflicts_with : []) {
      if (acceptedIds.has(conflict.asset_id)) {
        contradiction_map.push({
          asset_a: item.asset_id,
          claim_a: item.claim,
          asset_b: conflict.asset_id,
          claim_b: conflict.claim,
        });
      }
    }
  }

  // Group accepted evidence by asset_id: rank by declared relevance (max across
  // an asset's lineage), first-declared limitations text wins.
  const groups = new Map();
  for (const item of accepted) {
    if (!groups.has(item.asset_id)) {
      groups.set(item.asset_id, {
        asset_id: item.asset_id,
        source_lineage: [],
        limitations: item.limitations ?? "",
        relevance: -Infinity,
      });
    }
    const g = groups.get(item.asset_id);
    g.source_lineage.push({ root: item.root, ref: item.ref });
    g.relevance = Math.max(g.relevance, typeof item.relevance === "number" ? item.relevance : -Infinity);
  }
  const ranked = [...groups.values()].sort((a, b) =>
    a.relevance === b.relevance ? a.asset_id.localeCompare(b.asset_id) : b.relevance - a.relevance,
  );
  const candidates = ranked.slice(0, 7).map((g, index) => ({
    asset_id: g.asset_id,
    source_lineage: g.source_lineage,
    limitations: g.limitations,
    rank: index + 1,
  }));
  for (const g of ranked.slice(7)) {
    notAccessed.push({ asset_id: g.asset_id, root: null, ref: null, reason: "exceeds_candidate_cap" });
  }

  return deepFreeze({ chronology, contradiction_map, candidates, not_accessed_report: notAccessed });
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
export function planDemaRecoveryMissionEngine({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_RECOVERY_MISSION_ENGINE_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else if (!Array.isArray(input.events)) {
    blocked_by.push("input_events_not_array");
  }
  return Object.freeze({
    schema: DEMA_RECOVERY_MISSION_ENGINE_SCHEMA,
    truth_label: DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload: the derived mission state plus its
// replay receipt, bound by one hash over the whole body. Reduction defects are
// carried in `replay` (fail-closed) and mission_state stays null — never
// partial. `current_state`/`chronology`/`seal_receipt` are convenience
// projections of `mission_state` (null, never omitted, while absent — canonical
// JSON fails closed on undefined).
export function buildDemaRecoveryMissionEnginePayload(input) {
  const events = input && typeof input === "object" && Array.isArray(input.events) ? input.events : null;
  const replayResult =
    events === null
      ? Object.freeze({ ok: false, blocked_by: Object.freeze(["input_events_not_array"]), halted_at_seq: null, events_applied: 0 })
      : reduceDemaRecoveryMissionEvents(events);
  const state = replayResult.ok ? replayResult.state : null;
  const body = {
    schema: DEMA_RECOVERY_MISSION_ENGINE_SCHEMA,
    truth_label: DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    replay: Object.freeze({
      ok: replayResult.ok,
      blocked_by: replayResult.blocked_by,
      halted_at_seq: replayResult.halted_at_seq,
      events_applied: replayResult.events_applied,
    }),
    mission_state: state,
    current_state: state ? state.current_state : null,
    chronology: state ? state.chronology ?? null : null,
    seal_receipt: state ? state.seal_receipt ?? null : null,
    boundary: demaRecoveryMissionEngineBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier: recompute the hash over the WHOLE body
// minus its hash field and reject any mismatch, then check the slice's
// semantic invariants with stable block codes. Internal semantic invariants are
// checked; independent authenticity is NOT proved — an attacker controlling
// every semantically permitted field and recomputing the hash still requires an
// external signature or anchor to detect (a later slice).

// Canonical structural equality for object-valued state projections
// (VERIFIABLE-ENVELOPE family, slice 1D). Reference identity only answers
// "same in-memory object" — a serialized proof parsed in another process
// carries equal meaning in distinct objects. Canonical JSON v1 text is the
// repository's ONE byte contract for structural meaning; equality of that
// text is the projection rule. Noncanonical values fail closed as unequal.
function canonicalProjectionEqual(left, right) {
  if (left === right) return true;
  try {
    return canonicalizeJsonV1(left) === canonicalizeJsonV1(right);
  } catch {
    return false;
  }
}

export function verifyDemaRecoveryMissionEngine(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, ...body } = payload;
  if (payload.schema !== DEMA_RECOVERY_MISSION_ENGINE_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (payload.canonicalization_algorithm !== CANONICAL_JSON_V1_ALGORITHM) {
    blocked_by.push("canonicalization_algorithm_mismatch");
  }
  if (payload.hash_algorithm !== "sha256") blocked_by.push("hash_algorithm_mismatch");
  if (payload.text_encoding !== "utf-8") blocked_by.push("text_encoding_mismatch");
  const expectedBoundary = demaRecoveryMissionEngineBoundary();
  const boundary = payload.boundary;
  const boundaryValid =
    boundary &&
    typeof boundary === "object" &&
    Object.keys(expectedBoundary).length === Object.keys(boundary).length &&
    Object.entries(expectedBoundary).every(([key, value]) => boundary[key] === value);
  if (!boundaryValid) blocked_by.push("boundary_shape_invalid");
  if (payload.replay && payload.replay.ok === true && payload.mission_state === null) {
    blocked_by.push("mission_state_inconsistent");
  }
  if (payload.replay && payload.replay.ok === false && payload.mission_state !== null) {
    blocked_by.push("mission_state_present_for_failed_replay");
  }
  if (payload.mission_state !== null && payload.mission_state !== undefined && typeof payload.mission_state === "object") {
    if (payload.current_state !== payload.mission_state.current_state) blocked_by.push("current_state_mismatch");
    if (!canonicalProjectionEqual(payload.chronology, payload.mission_state.chronology ?? null)) {
      blocked_by.push("chronology_mismatch");
    }
    if (!canonicalProjectionEqual(payload.seal_receipt, payload.mission_state.seal_receipt ?? null)) {
      blocked_by.push("seal_receipt_mismatch");
    }
  }
  let rederived = null;
  try {
    rederived = sha256CanonicalJsonV1(body);
  } catch {
    blocked_by.push("body_not_canonicalizable");
  }
  if (rederived !== null && rederived !== content_hash) blocked_by.push("content_hash_mismatch");
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

// Orchestrator the review gate consumes. plan -> build -> verify -> tamper-reject,
// returning the proof envelope. Any failure returns a named block so the gate
// fails closed.
export function runDemaRecoveryMissionEngine({ consent, input } = {}) {
  const fail = (blocked_by) =>
    Object.freeze({
      ok: false,
      schema: DEMA_RECOVERY_MISSION_ENGINE_SCHEMA,
      truth_label: DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL,
      blocked_by: Object.freeze(blocked_by),
      boundary: demaRecoveryMissionEngineBoundary(),
    });

  const plan = planDemaRecoveryMissionEngine({ consent, input });
  if (!plan.eligible) return fail([...plan.blocked_by]);

  const payload = buildDemaRecoveryMissionEnginePayload(input);
  if (!payload.replay.ok) return fail([...payload.replay.blocked_by]);

  const verdict = verifyDemaRecoveryMissionEngine(payload);
  if (!verdict.ok) return fail([...verdict.blocked_by]);

  const tampered = verifyDemaRecoveryMissionEngine({ ...payload, truth_label: "FORGED" });
  if (tampered.ok !== false) return fail(["tamper_check_failed"]);

  return Object.freeze({
    ok: true,
    schema: DEMA_RECOVERY_MISSION_ENGINE_SCHEMA,
    truth_label: DEMA_RECOVERY_MISSION_ENGINE_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary: demaRecoveryMissionEngineBoundary(),
    blocked_by: Object.freeze([]),
    current_state: payload.current_state,
    replay: payload.replay,
  });
}
