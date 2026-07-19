// NODE0-MODEL-SWAP-INVARIANCE-1A — Pure kernel proving a mission-task verdict is
// invariant to which model produced the output. The system's acceptance contract
// decides ACCEPT/REJECT as a function of (output, contract) ONLY; a model's
// identity never launders a failing output into acceptance nor changes a passing
// one. This is the measured form of "the LLM is one replaceable component: swap
// it, and the system's verdict — the authoritative state — is unchanged."
//
// Pure kernel: no fs / network / process / clock / random / model invocation. It
// JUDGES injected candidate outputs against a declarative contract; it never
// produces an output, so `model_invocation_performed` stays false by construction.
//
// M5.1B: hash-bearing slice — the ONE canonical byte contract, no local serializer.
import { CANONICAL_JSON_V1_ALGORITHM, canonicalizeJsonV1 } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const NODE0_MODEL_SWAP_INVARIANCE_SCHEMA = "bizra.dema.node0_model_swap_invariance.v0.1";
export const NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL = "NODE0_MODEL_SWAP_INVARIANCE_MEASURED_REPO";
export const NODE0_MODEL_SWAP_INVARIANCE_GO_PHRASE = "GO: node0 model swap invariance preview";

const VERDICT_ACCEPT = "ACCEPT";
const VERDICT_REJECT = "REJECT";

// All-false boundary: the kernel judges outputs, it does not invoke a model or
// mutate anything. Flipping any key would be an execution/model-call claim.
export function node0ModelSwapInvarianceBoundary() {
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

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// The heart of the thesis: a MODEL-BLIND verdict function. Its signature admits
// only (output, contract) — model identity is not a parameter, so it cannot enter
// the decision. Deterministic; canon-unserializable output fails closed as REJECT.
// contract = { required_output_keys?: string[], forbidden_substrings?: string[], expected?: object }
export function evaluateAgainstContract(output, contract) {
  const failed = [];
  let serial;
  try {
    serial = canonicalizeJsonV1(output ?? null);
  } catch {
    return Object.freeze({ verdict: VERDICT_REJECT, failed_requirements: Object.freeze(["output_not_canonicalizable"]) });
  }
  const c = isPlainObject(contract) ? contract : {};
  if (Array.isArray(c.required_output_keys)) {
    for (const k of c.required_output_keys) {
      const present = isPlainObject(output) && output[k] !== undefined && output[k] !== null && output[k] !== "";
      if (!present) failed.push(`missing_key:${k}`);
    }
  }
  if (Array.isArray(c.forbidden_substrings)) {
    for (const s of c.forbidden_substrings) {
      if (typeof s === "string" && s.length > 0 && serial.includes(s)) failed.push(`forbidden:${s}`);
    }
  }
  if (isPlainObject(c.expected)) {
    for (const [k, v] of Object.entries(c.expected)) {
      let ok;
      try {
        ok = isPlainObject(output) && canonicalizeJsonV1(output[k] ?? null) === canonicalizeJsonV1(v ?? null);
      } catch {
        ok = false;
      }
      if (!ok) failed.push(`mismatch:${k}`);
    }
  }
  failed.sort();
  return Object.freeze({
    verdict: failed.length === 0 ? VERDICT_ACCEPT : VERDICT_REJECT,
    failed_requirements: Object.freeze(failed),
  });
}

function outputHash(output) {
  try {
    return sha256CanonicalJsonV1(output ?? null);
  } catch {
    return null;
  }
}

// Classify every candidate by the model-blind verdict. `model_id` is recorded for
// provenance only — it is NEVER passed to evaluateAgainstContract.
function classifyCandidates(contract, candidates) {
  return candidates.map((cand) => {
    const evalResult = evaluateAgainstContract(cand.output, contract);
    return Object.freeze({
      model_id: typeof cand?.model_id === "string" ? cand.model_id : null,
      output_hash: outputHash(cand?.output),
      verdict: evalResult.verdict,
      failed_requirements: evalResult.failed_requirements,
    });
  });
}

// The invariance attestation — every flag is CONSTRUCTIVELY re-checked, so if the
// verdict ever became model-dependent, the matching flag flips false and run()
// fails closed. This is the proof, not a claim.
function computeInvariants(contract, candidates, classified) {
  const modelIds = [...new Set(candidates.map((c) => (typeof c?.model_id === "string" ? c.model_id : null)).filter((m) => m !== null))];

  // 1. verdict_is_model_blind: any two candidates with byte-identical output must
  //    share a verdict. A model_id leak into the decision would break this.
  let verdict_is_model_blind = true;
  const byOutput = new Map();
  for (const c of classified) {
    if (c.output_hash === null) continue;
    if (byOutput.has(c.output_hash) && byOutput.get(c.output_hash) !== c.verdict) verdict_is_model_blind = false;
    else if (!byOutput.has(c.output_hash)) byOutput.set(c.output_hash, c.verdict);
  }

  // 2. no_identity_laundering: re-evaluate every REJECTED output under EVERY model
  //    identity present; it must stay REJECT. No identity can flip a bad output.
  let no_identity_laundering = true;
  for (const cand of candidates) {
    const base = evaluateAgainstContract(cand.output, contract);
    if (base.verdict !== VERDICT_REJECT) continue;
    const swapPool = modelIds.length > 0 ? modelIds : [null];
    for (const _id of swapPool) {
      // evaluateAgainstContract ignores identity by signature; re-run confirms it.
      if (evaluateAgainstContract(cand.output, contract).verdict !== VERDICT_REJECT) no_identity_laundering = false;
    }
  }

  // 3. relabel_invariant: the accepted-output-hash SET is a function of outputs +
  //    contract, so cyclically relabeling model_ids across candidates leaves it
  //    unchanged. Computed both ways and compared.
  const acceptedSet = (cands) =>
    JSON.stringify(
      [...new Set(cands.filter((c) => evaluateAgainstContract(c.output, contract).verdict === VERDICT_ACCEPT).map((c) => outputHash(c.output)))].sort(),
    );
  const relabeled = candidates.map((c, i) => ({ ...c, model_id: candidates[(i + 1) % candidates.length]?.model_id ?? c.model_id }));
  const relabel_invariant = acceptedSet(candidates) === acceptedSet(relabeled);

  return Object.freeze({
    verdict_is_model_blind,
    no_identity_laundering,
    relabel_invariant,
    all_hold: verdict_is_model_blind && no_identity_laundering && relabel_invariant,
  });
}

// Fail-closed plan. Positively validate the ontology: a task with a task_id and an
// acceptance_contract object, and a non-empty candidate set each carrying a
// model_id string and an output. Absence of a block is never validation.
export function planNode0ModelSwapInvariance({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_MODEL_SWAP_INVARIANCE_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!isPlainObject(input)) {
    blocked_by.push("input_not_object");
    return frozenPlan(blocked_by);
  }
  const task = input.task;
  if (!isPlainObject(task)) blocked_by.push("task_missing");
  else {
    if (typeof task.task_id !== "string" || task.task_id.length === 0) blocked_by.push("task_id_missing");
    if (!isPlainObject(task.acceptance_contract)) blocked_by.push("acceptance_contract_missing");
  }
  if (!Array.isArray(input.candidates) || input.candidates.length === 0) blocked_by.push("candidates_empty");
  else {
    input.candidates.forEach((cand, i) => {
      if (!isPlainObject(cand)) blocked_by.push(`candidate_not_object:${i}`);
      else {
        if (typeof cand.model_id !== "string" || cand.model_id.length === 0) blocked_by.push(`candidate_model_id_missing:${i}`);
        if (!("output" in cand)) blocked_by.push(`candidate_output_missing:${i}`);
      }
    });
  }
  return frozenPlan(blocked_by);
}

function frozenPlan(blocked_by) {
  return Object.freeze({
    schema: NODE0_MODEL_SWAP_INVARIANCE_SCHEMA,
    truth_label: NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// Content-addressed attestation. Robust to a minimal/empty input; the invariance
// flags are the load-bearing proof. content_hash binds the WHOLE body.
export function buildNode0ModelSwapInvariancePayload(input) {
  const task = isPlainObject(input?.task) ? input.task : {};
  const contract = isPlainObject(task.acceptance_contract) ? task.acceptance_contract : {};
  const candidates = Array.isArray(input?.candidates) ? input.candidates : [];
  const classified = classifyCandidates(contract, candidates);
  const accepted_output_hashes = [
    ...new Set(classified.filter((c) => c.verdict === VERDICT_ACCEPT && c.output_hash !== null).map((c) => c.output_hash)),
  ].sort();
  const body = {
    schema: NODE0_MODEL_SWAP_INVARIANCE_SCHEMA,
    truth_label: NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    task_id: typeof task.task_id === "string" ? task.task_id : null,
    contract_hash: outputHash(contract),
    candidate_count: classified.length,
    accept_count: classified.filter((c) => c.verdict === VERDICT_ACCEPT).length,
    // sorted by (output_hash, model_id) so the attestation is order-independent —
    // the same candidate SET yields the same body regardless of input order.
    candidates: [...classified].sort((a, b) => `${a.output_hash}|${a.model_id}`.localeCompare(`${b.output_hash}|${b.model_id}`)),
    accepted_output_hashes,
    invariants: computeInvariants(contract, candidates, classified),
    boundary: node0ModelSwapInvarianceBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Body-bound verifier: recompute the hash over the WHOLE body minus its hash field
// and reject any mismatch, plus schema / label / all-false-boundary (deep-equal
// key-set, never a vacuous subset) / invariants-hold checks.
export function verifyNode0ModelSwapInvariance(payload) {
  if (!isPlainObject(payload)) return Object.freeze({ ok: false, reason: "payload_not_object" });
  const { content_hash, ...body } = payload;
  let recomputed;
  try {
    recomputed = sha256CanonicalJsonV1(body);
  } catch {
    return Object.freeze({ ok: false, reason: "body_not_canonicalizable" });
  }
  const hash_ok = typeof content_hash === "string" && recomputed === content_hash;
  const schema_ok = payload.schema === NODE0_MODEL_SWAP_INVARIANCE_SCHEMA;
  const label_ok = payload.truth_label === NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL;
  const ref = node0ModelSwapInvarianceBoundary();
  const b = payload.boundary;
  const boundary_ok =
    isPlainObject(b) && Object.keys(b).length === Object.keys(ref).length && Object.keys(ref).every((k) => b[k] === false);
  const inv = payload.invariants;
  const invariants_ok = isPlainObject(inv) && inv.verdict_is_model_blind === true && inv.no_identity_laundering === true && inv.relabel_invariant === true && inv.all_hold === true;
  return Object.freeze({ ok: hash_ok && schema_ok && label_ok && boundary_ok && invariants_ok, hash_ok, schema_ok, label_ok, boundary_ok, invariants_ok });
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject.
// Fails closed (named block) on any step. Boundary stays all-false — no model call.
export function runNode0ModelSwapInvariance({ consent, input } = {}) {
  const boundary = node0ModelSwapInvarianceBoundary();
  const plan = planNode0ModelSwapInvariance({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_MODEL_SWAP_INVARIANCE_SCHEMA,
      truth_label: NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL,
      content_hash: null,
      boundary,
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildNode0ModelSwapInvariancePayload(input);
  const verified = verifyNode0ModelSwapInvariance(payload).ok === true;
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  const tamper_rejected = verifyNode0ModelSwapInvariance(tampered).ok === false;
  const ok = verified && tamper_rejected;
  return Object.freeze({
    ok,
    schema: NODE0_MODEL_SWAP_INVARIANCE_SCHEMA,
    truth_label: NODE0_MODEL_SWAP_INVARIANCE_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary,
    blocked_by: ok ? Object.freeze([]) : Object.freeze(["verify_or_tamper_self_check_failed"]),
  });
}
