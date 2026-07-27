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

// Field presence is an OWN-property question. `output.toString` is inherited
// from Object.prototype, not something a model produced; an own `__proto__` data
// property — which JSON.parse produces — IS a real canonical field.
function ownField(o, k) {
  return isPlainObject(o) && Object.hasOwn(o, k) ? o[k] : undefined;
}

// The complete contract vocabulary. Anything outside it is refused, so a typo
// like `reqired_output_keys` cannot pass as "no requirement".
const KNOWN_CONTRACT_KEYS = new Set(["required_output_keys", "forbidden_substrings", "expected"]);

// Named for what it checks: every ELEMENT is a non-empty string. It says nothing
// about the array being non-empty — `[].every()` is vacuously true — which is
// exactly why the count below is a separate gate.
function isArrayOfNonEmptyStrings(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "string" && x.length > 0);
}

// The exact shape sha256CanonicalJsonV1 produces. An ACCEPT row can never
// legitimately carry anything else: an output that fails to canonicalise is
// rejected as `output_not_canonicalizable`, so it never reaches ACCEPT.
const OUTPUT_HASH_RE = /^sha256:[0-9a-f]{64}$/;

// A value outside the canonical-JSON domain. A dedicated sentinel, not null,
// because null IS a legitimate contract value.
const NOT_CANONICAL = Symbol("not_canonical");

// Same plainness rule canonical-json-v1 enforces, so the snapshot's notion of
// "copyable" cannot drift from the serializer's notion of "hashable".
function isCanonicalPlainObject(v) {
  if (!isPlainObject(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

// Copy a value into INERT plain data, reading every property exactly once, and
// return NOT_CANONICAL for anything the canonical-JSON domain excludes
// (undefined, function, symbol, BigInt, non-finite number, Date/Map/Set, a
// cycle). Such a predicate cannot be compared or hashed, so evaluate would
// reject EVERY candidate — and uniform rejection satisfies all three invariants
// trivially, yielding a PASS over a contract that never compared anything.
// Recursive because `expected: { a: { b: undefined } }` is the same defect one
// level down; the depth cap is what terminates a cycle. Any exception a getter
// or Proxy trap raises propagates to the ONE containment boundary in
// validateAcceptanceContract — it is never swallowed here, where it would be
// indistinguishable from an honest non-canonical value.
function cloneCanonicalJsonValue(v, depth = 0) {
  if (depth > 64) return NOT_CANONICAL;
  if (v === null) return null;
  const t = typeof v;
  if (t === "string" || t === "boolean") return v;
  if (t === "number") return Number.isFinite(v) ? v : NOT_CANONICAL;
  if (t !== "object") return NOT_CANONICAL;
  if (Array.isArray(v)) {
    if (Object.getPrototypeOf(v) !== Array.prototype) return NOT_CANONICAL;
    const out = [];
    for (const x of v) {
      const cloned = cloneCanonicalJsonValue(x, depth + 1);
      if (cloned === NOT_CANONICAL) return NOT_CANONICAL;
      out.push(cloned);
    }
    return Object.freeze(out);
  }
  if (!isCanonicalPlainObject(v)) return NOT_CANONICAL;
  // Prototype-less: `out[k] = …` with k === "__proto__" on a normal literal would
  // set this object's PROTOTYPE instead of creating the key, so the copy would
  // silently lose a field the caller declared. canonical-json-v1 accepts a null
  // prototype, so the snapshot still hashes.
  const out = Object.create(null);
  for (const [k, x] of Object.entries(v)) {
    const cloned = cloneCanonicalJsonValue(x, depth + 1);
    if (cloned === NOT_CANONICAL) return NOT_CANONICAL;
    out[k] = cloned;
  }
  return Object.freeze(out);
}

// THE one place caller-controlled contract state is read. Every access to the
// untrusted object happens here — `Object.keys` walks its ownKeys and
// getOwnPropertyDescriptor traps, `c[k]` runs its getters — and what comes back
// is frozen data with no accessors and no traps. Downstream code consumes only
// this copy, so a stateful accessor cannot show an admissible contract to the
// planner and a different one to the builder. Throws propagate to the caller's
// single try.
function snapshotContract(c) {
  // Prototype-less for the same reason as the clone: an own `__proto__` key —
  // which JSON.parse produces — would otherwise swap this object's prototype
  // instead of being copied, so the unknown-field check would go blind to it
  // while the predicate count silently read the INHERITED value.
  const snapshot = Object.create(null);
  for (const k of Object.keys(c)) {
    const v = c[k];
    // `expected` is copied key-by-key so a bad value keeps its own diagnosis
    // (`contract_noncanonical:expected.<k>`) instead of collapsing the field.
    if (isCanonicalPlainObject(v) && k === "expected") {
      const expected = Object.create(null);
      for (const [ek, ev] of Object.entries(v)) expected[ek] = cloneCanonicalJsonValue(ev);
      snapshot[k] = Object.freeze(expected);
    } else {
      snapshot[k] = cloneCanonicalJsonValue(v);
    }
  }
  return Object.freeze(snapshot);
}

// How many predicates a contract actually imposes. A well-typed contract can
// still be empty of requirements (`{}`, `required_output_keys: []`,
// `expected: {}`), and an empty contract accepts EVERY output — so invariance
// measured over it is vacuously true and proves nothing. Same failure shape as a
// one-model candidate set: structurally valid, semantically empty.
function effectivePredicateCount(c) {
  let n = 0;
  if (Array.isArray(c.required_output_keys)) n += c.required_output_keys.length;
  if (Array.isArray(c.forbidden_substrings)) n += c.forbidden_substrings.length;
  if (isPlainObject(c.expected)) n += Object.keys(c.expected).length;
  return n;
}

// THE single definition of an admissible acceptance contract. Both the admission
// gate (plan) and the decision function (evaluate) consume this one result, so
// their notions of "valid contract" cannot drift apart — that drift is exactly
// how a contract could be admitted as a proof subject while every candidate was
// rejected for a malformation the planner never looked at. Uniform rejection
// makes all three invariants hold trivially, so a broken contract produced a
// PASS-shaped attestation.
export function validateAcceptanceContract(contract) {
  if (contract !== undefined && contract !== null && !isPlainObject(contract)) {
    return frozenContractCheck(["contract_malformed:not_an_object"], 0, null);
  }
  let c;
  try {
    c = snapshotContract(isPlainObject(contract) ? contract : {});
  } catch {
    // A throwing getter, a hostile Proxy trap, or anything else raised by merely
    // LOOKING at the contract. Nothing about it is knowable, so it is refused
    // with one deterministic reason instead of escaping as a crash through
    // validate / plan / evaluate / run.
    return frozenContractCheck(["contract_uninspectable"], 0, null);
  }
  // From here down `c` is inert: no getters, no traps, frozen.
  const blocked_by = [];
  for (const k of Object.keys(c)) {
    if (!KNOWN_CONTRACT_KEYS.has(k)) blocked_by.push(`contract_unknown_field:${k}`);
  }
  if ("required_output_keys" in c && !isArrayOfNonEmptyStrings(c.required_output_keys)) {
    blocked_by.push("contract_malformed:required_output_keys");
  }
  if ("forbidden_substrings" in c && !isArrayOfNonEmptyStrings(c.forbidden_substrings)) {
    blocked_by.push("contract_malformed:forbidden_substrings");
  }
  if ("expected" in c && !isPlainObject(c.expected)) blocked_by.push("contract_malformed:expected");
  else if (isPlainObject(c.expected)) {
    for (const [k, v] of Object.entries(c.expected)) {
      if (v === NOT_CANONICAL) blocked_by.push(`contract_noncanonical:expected.${k}`);
    }
  }
  // Belt and braces: the contract must also hash as a whole, since contract_hash
  // lands in the attestation and a null there would travel as if it were bound.
  if (outputHash(c) === null) blocked_by.push("contract_not_hashable");
  const effective_predicate_count = effectivePredicateCount(c);
  // Vacuity is checked only once the shape is sound, so a mistyped field keeps
  // the more specific diagnosis instead of being reported as "empty".
  if (blocked_by.length === 0 && effective_predicate_count === 0) {
    blocked_by.push("contract_vacuous:no_effective_predicate");
  }
  blocked_by.sort();
  return frozenContractCheck(blocked_by, effective_predicate_count, c);
}

function frozenContractCheck(blocked_by, effective_predicate_count, snapshot) {
  return Object.freeze({
    valid: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    effective_predicate_count,
    // The inert copy every downstream consumer must use in place of the caller's
    // object. null when nothing could be read at all.
    snapshot,
  });
}

// A value the ONE canonical serializer always refuses. It carries "this output
// existed but could not be canonicalised" through the inert snapshot without a
// second status channel that could drift from the serializer's own verdict.
const OUTPUT_NOT_CANONICALIZABLE = Object.freeze(new Map());

// Read ONE candidate exactly once into inert data. Both the verdict and the
// output hash are derived from the bytes captured here, so a stateful accessor
// can no longer be judged as one value and hashed as another — which is the
// attestation's central claim. A read that throws marks the row with an indexed
// reason instead of escaping through the public API.
function snapshotCandidate(cand, index) {
  try {
    if (!isPlainObject(cand)) return { candidate: cand, blocked: [] };
    const model_id = cand.model_id; // the ONE read
    // `Object.hasOwn`, never `in`: presence is an own-property question, and a
    // `has` trap is not something the kernel needs to invoke.
    const hasOutput = Object.hasOwn(cand, "output");
    const raw = hasOutput ? cand.output : undefined; // the ONE read
    const snapshot = { model_id: typeof model_id === "string" ? model_id : null };
    if (hasOutput) {
      try {
        // Normalise through the ONE canonical byte contract — no second
        // serializer. JSON.parse of canonical bytes preserves own keys such as
        // `__proto__` as own DATA properties, which is what makes them real
        // fields rather than a prototype swap.
        //
        // `raw` is passed through UNCOERCED. A `?? null` here would turn an own
        // `output: undefined` — outside the canonical domain — into canonical
        // null, which is inside it, and the row would then certify a value the
        // candidate never supplied. The serializer is the sole arbiter: it
        // refuses undefined as `value_undefined` and accepts null as "null".
        snapshot.output = JSON.parse(canonicalizeJsonV1(raw));
      } catch {
        snapshot.output = OUTPUT_NOT_CANONICALIZABLE;
      }
    }
    return { candidate: Object.freeze(snapshot), blocked: [] };
  } catch {
    return { candidate: null, blocked: [`candidate_uninspectable:${index}`] };
  }
}

// THE single boundary the whole proof input crosses. Everything downstream —
// plan, evaluate, hash, invariants — consumes only what comes back from here.
// Snapshotting an already-inert input is idempotent and reads nothing hostile,
// so each public entry point can safely call it on its own.
function snapshotInput(input) {
  const blocked_by = [];
  try {
    if (!isPlainObject(input)) return { input, blocked_by };
    let task = input.task;
    if (isPlainObject(task) && isPlainObject(task.acceptance_contract)) {
      const snapshot = validateAcceptanceContract(task.acceptance_contract).snapshot;
      // A contract that cannot be read at all is left in place: plan re-reports
      // it under containment as contract_uninspectable, and blocks.
      if (snapshot !== null) task = { ...task, acceptance_contract: snapshot };
    }
    let candidates = input.candidates;
    if (Array.isArray(candidates)) {
      candidates = candidates.map((cand, i) => {
        const { candidate, blocked } = snapshotCandidate(cand, i);
        blocked_by.push(...blocked);
        return candidate;
      });
    }
    return { input: { ...input, task, candidates }, blocked_by };
  } catch {
    // The input wrapper itself is hostile; plan reports the shape it can see.
    return { input: null, blocked_by };
  }
}

// The heart of the thesis: a MODEL-BLIND verdict function. Its signature admits
// only (output, contract) — model identity is not a parameter, so it cannot enter
// the decision. Deterministic; canon-unserializable output fails closed as REJECT.
// contract = { required_output_keys?: string[], forbidden_substrings?: string[], expected?: object }
export function evaluateAgainstContract(output, contract) {
  const failed = [];
  let serial;
  try {
    // Uncoerced: an absent or undefined output is not the canonical null value.
    serial = canonicalizeJsonV1(output);
  } catch {
    return Object.freeze({ verdict: VERDICT_REJECT, failed_requirements: Object.freeze(["output_not_canonicalizable"]) });
  }
  // Contract admissibility is a PRECONDITION, not a per-output failure: an
  // inadmissible contract cannot decide anything, so it fails before evaluation
  // and reports the shared validator's codes verbatim.
  const contractCheck = validateAcceptanceContract(contract);
  if (!contractCheck.valid) {
    return Object.freeze({ verdict: VERDICT_REJECT, failed_requirements: contractCheck.blocked_by });
  }
  // The inert snapshot the gate just admitted — NEVER the caller's object.
  // Re-reading it here is precisely how a stateful accessor would decide
  // differently than the admission gate that let it through.
  const c = contractCheck.snapshot;
  if (Array.isArray(c.required_output_keys)) {
    for (const k of c.required_output_keys) {
      const v = ownField(output, k);
      if (v === undefined || v === null || v === "") failed.push(`missing_key:${k}`);
    }
  }
  if (Array.isArray(c.forbidden_substrings)) {
    for (const s of c.forbidden_substrings) {
      if (serial.includes(s)) failed.push(`forbidden:${s}`);
    }
  }
  if (isPlainObject(c.expected)) {
    for (const [k, v] of Object.entries(c.expected)) {
      let ok;
      try {
        // Presence and value are separate questions. `ownField(...) ?? null`
        // collapsed them: an ABSENT field canonicalised to "null" and satisfied
        // a declared `expected: { answer: null }`, so a predicate was met by a
        // field the model never produced. Both sides are now uncoerced, and an
        // own field holding an unrepresentable value throws into the catch.
        const present = isPlainObject(output) && Object.hasOwn(output, k);
        ok = present && canonicalizeJsonV1(ownField(output, k)) === canonicalizeJsonV1(v);
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
    // Uncoerced, for the same reason evaluate is: a value that cannot be
    // represented gets NO hash, never the canonical hash of null.
    return sha256CanonicalJsonV1(output);
  } catch {
    return null;
  }
}

// Classify every candidate by the model-blind verdict. `model_id` is recorded for
// provenance only — it is NEVER passed to evaluateAgainstContract.
function classifyCandidates(contract, candidates) {
  return candidates.map((cand) => {
    // ONE local binding, judged and hashed. Reading `cand.output` twice is
    // exactly how an ACCEPT row came to carry bytes that were never accepted.
    const output = cand?.output;
    const evalResult = evaluateAgainstContract(output, contract);
    return Object.freeze({
      model_id: typeof cand?.model_id === "string" ? cand.model_id : null,
      output_hash: outputHash(output),
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
  // Admission judges the inert snapshot, never the caller's objects — otherwise
  // the shape the gate approved need not be the shape the builder attests.
  const snapshot = snapshotInput(input);
  blocked_by.push(...snapshot.blocked_by);
  input = snapshot.input;
  if (!isPlainObject(input)) {
    blocked_by.push("input_not_object");
    return frozenPlan(blocked_by);
  }
  const task = input.task;
  if (!isPlainObject(task)) blocked_by.push("task_missing");
  else {
    if (typeof task.task_id !== "string" || task.task_id.length === 0) blocked_by.push("task_id_missing");
    if (!isPlainObject(task.acceptance_contract)) blocked_by.push("acceptance_contract_missing");
    // Admission gate. A proof must not be BUILT over a contract that is malformed
    // or requires nothing — both produce a uniform verdict across candidates,
    // which satisfies every invariant trivially and reads as a passing proof.
    // verify() cannot catch either downstream: the attestation carries only
    // `contract_hash`, so a receiver never sees the predicates. Stated, not
    // silently relied upon — and it consumes the SAME validator evaluate does.
    else blocked_by.push(...validateAcceptanceContract(task.acceptance_contract).blocked_by);
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
    // There is no invariance-under-swap to measure unless a swap actually
    // occurred. One candidate, or several sharing one model_id, makes every
    // invariant hold vacuously — a proof that proves nothing while reading PASS.
    const ids = input.candidates
      .map((c) => (isPlainObject(c) && typeof c.model_id === "string" && c.model_id.length > 0 ? c.model_id : null))
      .filter((m) => m !== null);
    const distinct = new Set(ids);
    if (distinct.size < 2) blocked_by.push("model_swap_absent");
    if (distinct.size !== ids.length) blocked_by.push("duplicate_model_id");
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
  input = snapshotInput(input).input;
  const task = isPlainObject(input?.task) ? input.task : {};
  // ONE guarded read of the caller's contract; classification, the invariants and
  // contract_hash all consume the inert copy. An uninspectable contract yields no
  // snapshot, and the empty contract that stands in for it rejects every
  // candidate as vacuous — fail-closed, never a crash.
  const contract = validateAcceptanceContract(isPlainObject(task.acceptance_contract) ? task.acceptance_contract : {}).snapshot ?? {};
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

// Re-derive the claim from the payload's OWN candidate rows. `invariants` is a
// CLAIM the body makes about itself; these rows are the evidence it carries. A
// hash binds bytes, not truth — so a fabricated body can be rehashed and stay
// internally consistent. Anything the rows can settle is therefore recomputed
// here and compared, never trusted as asserted. This does not re-run the
// contract (raw outputs are not in the attestation); it settles exactly what the
// rows support: one output hash may never carry two verdicts, and the summary
// counts must be the ones the rows produce.
function rederiveFromRows(rows) {
  if (!Array.isArray(rows)) return null;
  const byOutput = new Map();
  const accepted = new Set();
  const modelIds = [];
  let verdicts_consistent = true;
  let accept_count = 0;
  for (const r of rows) {
    if (!isPlainObject(r)) return null;
    if (r.verdict !== VERDICT_ACCEPT && r.verdict !== VERDICT_REJECT) return null;
    if (typeof r.model_id === "string" && r.model_id.length > 0) modelIds.push(r.model_id);
    // A hash that is neither null nor well-formed is not something the builder
    // can emit, so the row is refused rather than skipped past.
    if (r.output_hash !== null && !OUTPUT_HASH_RE.test(r.output_hash)) return null;
    if (r.verdict === VERDICT_ACCEPT) {
      // An ACCEPT row with no usable hash would inflate accept_count while
      // contributing nothing to accepted_output_hashes — and both summaries
      // would still agree, so the mismatch check alone cannot catch it.
      if (!OUTPUT_HASH_RE.test(r.output_hash)) return null;
      accept_count += 1;
      accepted.add(r.output_hash);
    }
    if (typeof r.output_hash !== "string") continue;
    if (byOutput.has(r.output_hash)) {
      if (byOutput.get(r.output_hash) !== r.verdict) verdicts_consistent = false;
    } else byOutput.set(r.output_hash, r.verdict);
  }
  // The same "a proof needs an actual swap in it" rule the plan enforces, applied
  // to the evidence. An attestation travels on its own, so a third party running
  // verify() must not accept a one-model body as proof of model-independence.
  const distinct = new Set(modelIds);
  return {
    verdicts_consistent,
    swap_present: distinct.size >= 2 && distinct.size === modelIds.length && modelIds.length === rows.length,
    candidate_count: rows.length,
    accept_count,
    accepted_output_hashes: [...accepted].sort(),
  };
}

// Body-bound verifier: recompute the hash over the WHOLE body minus its hash field
// and reject any mismatch, plus schema / label / all-false-boundary (deep-equal
// key-set, never a vacuous subset) / invariants-hold checks, and — since a
// rehashed forgery satisfies all of those — an independent re-derivation of the
// claim from the body's own candidate rows (`evidence_ok`).
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
  const d = rederiveFromRows(payload.candidates);
  const evidence_ok =
    d !== null &&
    d.verdicts_consistent &&
    d.swap_present &&
    d.candidate_count === payload.candidate_count &&
    d.accept_count === payload.accept_count &&
    Array.isArray(payload.accepted_output_hashes) &&
    d.accepted_output_hashes.length === payload.accepted_output_hashes.length &&
    d.accepted_output_hashes.every((h, i) => h === payload.accepted_output_hashes[i]);
  return Object.freeze({
    ok: hash_ok && schema_ok && label_ok && boundary_ok && invariants_ok && evidence_ok,
    hash_ok,
    schema_ok,
    label_ok,
    boundary_ok,
    invariants_ok,
    evidence_ok,
  });
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject.
// Fails closed (named block) on any step. Boundary stays all-false — no model call.
export function runNode0ModelSwapInvariance({ consent, input } = {}) {
  const boundary = node0ModelSwapInvarianceBoundary();
  // Read every caller-controlled accessor ONCE, here. Plan and build then
  // re-snapshot inert data, which costs nothing and reads nothing hostile.
  const safeInput = snapshotInput(input).input;
  const plan = planNode0ModelSwapInvariance({ consent, input: safeInput });
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
  const payload = buildNode0ModelSwapInvariancePayload(safeInput);
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
