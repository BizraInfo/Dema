// NODE0-CAMPAIGN-LEDGER-1A — pure hash-chained campaign ledger kernel.
//
// PREVIEW_ONLY · NOT ML · NOT runtime. Zero I/O; no clock. Hardens the
// flywheel campaign idea: the contract is pinned by hash, events are
// hash-chained, and counters/status are DERIVED from events, so a reset
// counter, a widened lease, a rewritten or truncated history, or a terminal
// status resurrected without an amendment is rejected by verify. A writer who
// rewrites the whole chain consistently is NOT detected; that needs an
// external seal, which this kernel does not provide.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const CAMPAIGN_LEDGER_SCHEMA = "bizra.dema.campaign_ledger.v0.1";
export const CAMPAIGN_LEDGER_TRUTH_LABEL = "CAMPAIGN_LEDGER_PREVIEW_ONLY";
const GENESIS = "0".repeat(64);
const KINDS = Object.freeze(["STATUS", "MODEL_CALL", "SERVICE_TRANSITION", "OBSERVATION", "RECEIPT"]);
const TERMINAL = Object.freeze([
  "DOD_REACHED", "WAITING_FOR_NEW_AUTHORITY", "OUTWARD_BLOCKED",
  "INWARD_BLOCKED", "CONTRADICTION_OPEN", "FAILED_SAFE", "DEFERRED",
]);
const STATUSES = Object.freeze(["PLANNED", "RUNNING", ...TERMINAL]);

const boundary = () => Object.freeze({
  runtime_executed: false, model_invoked: false, network_used: false,
  files_written: false, authority_expanded: false,
});

const nonNegInt = (v) => Number.isInteger(v) && v >= 0;
const sealEvent = (body) => ({ ...body, event_hash: sha256(stableStringify(body)) });

export function deriveCampaignState(ledger) {
  let status = null, model_calls_used = 0, service_transitions_used = 0;
  for (const e of ledger?.events ?? []) {
    if (e.kind === "STATUS") status = e.status;
    else if (e.kind === "MODEL_CALL") model_calls_used += 1;
    else if (e.kind === "SERVICE_TRANSITION") service_transitions_used += 1;
  }
  return { status, model_calls_used, service_transitions_used };
}

function finish(ledger) {
  const head = ledger.events.at(-1)?.event_hash ?? GENESIS;
  const state = { ...deriveCampaignState(ledger), head_hash: head };
  return { ...ledger, state, ledger_sha256: sha256(stableStringify({ ...ledger, state })) };
}

export function appendCampaignEvent(ledger, event) {
  if (!KINDS.includes(event?.kind)) throw new Error("campaign event kind not allowed");
  if ((event.authority_delta ?? 0) !== 0) throw new Error("campaign event authority_delta must be 0");
  if (event.kind === "STATUS" && !STATUSES.includes(event.status)) throw new Error("campaign status not allowed");
  const prev = ledger.events.at(-1)?.event_hash ?? GENESIS;
  const body = { seq: ledger.events.length + 1, authority_delta: 0, ...event, prev_hash: prev };
  const next = { ...ledger, events: [...ledger.events, sealEvent(body)] };
  return finish(next);
}

export function buildCampaignLedger({ campaign_id, goal, definition_of_done, authority_lease }) {
  if (!campaign_id || !goal) throw new Error("campaign_id and goal are required");
  if (!Array.isArray(definition_of_done) || definition_of_done.length === 0) {
    throw new Error("definition_of_done must be a non-empty list");
  }
  if (!nonNegInt(authority_lease?.max_model_calls) || !nonNegInt(authority_lease?.max_service_transitions)) {
    throw new Error("authority_lease budgets must be non-negative integers");
  }
  const contract = { campaign_id, goal, definition_of_done: [...definition_of_done], authority_lease: { ...authority_lease } };
  let ledger = {
    schema: CAMPAIGN_LEDGER_SCHEMA,
    truth_label: CAMPAIGN_LEDGER_TRUTH_LABEL,
    contract,
    contract_sha256: sha256(stableStringify(contract)),
    events: [],
    boundary: boundary(),
    authority_delta: 0,
  };
  ledger = appendCampaignEvent(finish(ledger), { kind: "STATUS", status: "RUNNING" });
  return ledger;
}

export function verifyCampaignLedger(ledger) {
  const reasons = [];
  const add = (r) => { if (!reasons.includes(r)) reasons.push(r); };
  if (!ledger || ledger.schema !== CAMPAIGN_LEDGER_SCHEMA || !Array.isArray(ledger.events)) {
    return { ok: false, reasons: ["ledger_malformed"] };
  }
  if (sha256(stableStringify(ledger.contract)) !== ledger.contract_sha256) add("contract_hash_mismatch");
  if (ledger.authority_delta !== 0) add("authority_delta_nonzero");
  if (Object.values(ledger.boundary ?? {}).some((v) => v !== false)) add("boundary_not_all_false");

  let prev = GENESIS, seenTerminal = false;
  ledger.events.forEach((e, i) => {
    const { event_hash, ...body } = e;
    if (e.seq !== i + 1) add("seq_gap");
    if (e.prev_hash !== prev) add("chain_broken");
    if (sha256(stableStringify(body)) !== event_hash) add("event_hash_mismatch");
    if ((e.authority_delta ?? 0) !== 0) add("event_authority_delta_nonzero");
    if (e.kind === "STATUS") {
      if (seenTerminal && !e.amendment_of) add("terminal_resurrected");
      if (TERMINAL.includes(e.status)) seenTerminal = true;
    }
    prev = event_hash;
  });

  const derived = deriveCampaignState(ledger);
  const lease = ledger.contract?.authority_lease ?? {};
  if (derived.model_calls_used > lease.max_model_calls) add("model_call_budget_exceeded");
  if (derived.service_transitions_used > lease.max_service_transitions) add("service_transition_budget_exceeded");
  const st = ledger.state ?? {};
  if (st.head_hash !== prev) add("head_hash_mismatch");
  if (st.status !== derived.status || st.model_calls_used !== derived.model_calls_used
      || st.service_transitions_used !== derived.service_transitions_used) add("state_mismatch");
  return { ok: reasons.length === 0, reasons };
}
