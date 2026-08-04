// NODE0-MINIMUM-SEASON-SAVE-RESUME-1A — Durable local season state: save, status and
// resume a bounded Node0 continuation checkpoint from disk alone.
//
// WHAT THIS IS: the pure half of the season-state slice. It owns the state
// contract, the semantic hash, the chain-link algebra and every fail-closed
// refusal reason. It decides WHAT is well-formed and WHAT a hash must be.
//
// WHAT THIS IS NOT: it never touches a disk. Publication, fsync, HEAD
// replacement and the concurrency fence live in
// packages/receipts/src/season-state-store.js, which is the only module allowed
// to bind these shapes to bytes. A pure kernel can validate SHAPE; only the
// store can prove BINDING, so `verifySeasonState` re-derives from the payload's
// OWN fields and never trusts a passed-in flag.
//
// Pure kernel: no fs / network / process / clock / random. Every claim here is a
// preview; the boundary is all-false. `saved_at` is DATA that flows through this
// kernel — it is never read from a clock here, and it is deliberately excluded
// from the semantic hash (see SEMANTIC_STATE_FIELDS).
//
// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy. Unsupported values (undefined, NaN, sparse arrays,
// accessors, ...) fail closed inside packages/canon with registered error
// codes. This kernel's path is registered in
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS (scripts/review/canonical-json-v1-check.mjs).
import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { CanonicalJsonV1Error } from "../../canon/src/canonical-json-errors.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const SEASON_STATE_SCHEMA = "bizra.dema.node0_season_state.v0.1";
export const SEASON_RECEIPT_SCHEMA = "bizra.dema.node0_season_save_receipt.v0.1";
export const SEASON_HEAD_SCHEMA = "bizra.dema.node0_season_head.v0.1";

export const SEASON_STATE_DOMAIN = "BIZRA:NODE0_SEASON_STATE:v1";
export const SEASON_RECEIPT_DOMAIN = "BIZRA:NODE0_SEASON_SAVE_RECEIPT:v1";
export const SEASON_HEAD_DOMAIN = "BIZRA:NODE0_SEASON_HEAD:v1";

export const NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA = SEASON_STATE_SCHEMA;
export const NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL =
  "NODE0_MINIMUM_SEASON_SAVE_RESUME_MEASURED_REPO";
export const NODE0_MINIMUM_SEASON_SAVE_RESUME_GO_PHRASE =
  "GO: node0 minimum season save resume preview";

// The exact semantic surface the state hash covers, in contract order.
//
// `saved_at` is ABSENT on purpose. The mission contract forbids uncontrolled
// clock data inside the semantic hash: two processes that reconstruct the same
// continuation must agree on its identity regardless of when they saved. The
// clock is not thereby unbound — the save receipt binds `saved_at` alongside
// `state_hash`, so the time IS attested, just not allowed to change what the
// state IS. `state_hash` is absent because it is the output.
export const SEMANTIC_STATE_FIELDS = Object.freeze([
  "schema",
  "domain",
  "season_id",
  "mission_id",
  "mission_contract_hash",
  "mission_phase",
  "completed_steps",
  "next_safe_action",
  "must_not_repeat",
  "pending_consent",
  "last_receipt_hash",
  "repository_commit",
  "repository_tree",
  "state_sequence",
  "previous_state_hash",
  "truth_label",
  "boundary",
]);

// Full on-disk field set = semantic fields + the clock + the derived hash.
export const STATE_FIELDS = Object.freeze([
  ...SEMANTIC_STATE_FIELDS,
  "saved_at",
  "state_hash",
]);

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SHA40_RE = /^[0-9a-f]{40}$/;
const TAGGED_SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const PHASE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const ACTION_RE = /^[A-Z][A-Z0-9_]{0,95}$/;

// canonical-json.v1 caps arrays at 1024; refuse earlier with a named reason so a
// caller sees "too many steps", not a serializer error code.
export const MAX_STEPS = 512;
export const MAX_MUST_NOT_REPEAT = 512;
export const MAX_PENDING_CONSENT = 64;
export const MAX_TEXT_BYTES = 4096;

// ── secret rejection ────────────────────────────────────────────────────────
// A season file is durable, world-readable-by-the-operator context. Anything
// that looks like a live credential is refused at the contract boundary rather
// than persisted and regretted. Patterns are shape-based, not entropy-based:
// entropy alone would reject legitimate SHA-bearing state.
const SENSITIVE_NAME_RE =
  /(^|[._-])(token|secret|password|passwd|passphrase|api[._-]?key|private[._-]?key|credential|access[._-]?key|session[._-]?key|bearer)s?([._-]|$)/i;

const SECRET_VALUE_PATTERNS = Object.freeze([
  ["github_token", /\bgh[pousr]_[A-Za-z0-9]{20,}/],
  ["openai_key", /\bsk-[A-Za-z0-9_-]{20,}/],
  ["aws_access_key_id", /\bAKIA[0-9A-Z]{16}\b/],
  ["slack_token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["private_key_block", /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/],
  ["jwt", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  // Environment-variable carriage: only when the NAME itself is sensitive, so
  // "STATE_SEQUENCE=2" passes and "GITHUB_TOKEN=..." does not.
  [
    "env_assignment",
    /\b[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSPHRASE|API_KEY|PRIVATE_KEY|CREDENTIAL|ACCESS_KEY)[A-Z0-9_]*\s*=\s*\S+/,
  ],
]);

/**
 * Walk every string in `value` (keys and values) hunting credential shapes.
 * Pure and total: returns a list of findings, never throws.
 * @returns {{path:string, kind:string}[]}
 */
export function findSecretBearingFields(value, path = "$", out = [], depth = 0) {
  if (depth > 64) return out;
  if (typeof value === "string") {
    for (const [kind, re] of SECRET_VALUE_PATTERNS) {
      if (re.test(value)) out.push({ path, kind });
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      findSecretBearingFields(value[i], `${path}[${i}]`, out, depth + 1);
    }
    return out;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      // A sensitive-looking NAME only matters when the value could actually
      // carry a credential. `token_minted: false` is this slice's own all-false
      // boundary flag, not a token — flagging it on the name alone would refuse
      // every legitimate state this kernel builds.
      if (SENSITIVE_NAME_RE.test(key) && typeof value[key] === "string" && value[key].length > 0) {
        out.push({ path: `${path}.${key}`, kind: "sensitive_field_name" });
      }
      findSecretBearingFields(value[key], `${path}.${key}`, out, depth + 1);
    }
  }
  return out;
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function node0MinimumSeasonSaveResumeBoundary() {
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

function isBoundedText(v, max = MAX_TEXT_BYTES) {
  return typeof v === "string" && v.length > 0 && Buffer.byteLength(v, "utf8") <= max;
}

/**
 * Positively validate a season-state against the frozen contract. Absence of a
 * block is never validation — every field must PROVE its shape.
 *
 * Two callers, two contracts. A CALLER supplies the semantic facts and lets the
 * store derive the chain position, because only the store can read HEAD; a
 * STORED state must already carry that position or the chain has a hole. Folding
 * both into one required-field set would either reject every legitimate caller
 * or accept a stored state with no sequence — so `requireSequence` names which
 * of the two is being checked.
 *
 * @param {object} input
 * @param {{requireSequence?: boolean}} [opts] requireSequence: this is a stored
 *   state read back from disk, not caller input.
 * @returns {{ok:boolean, blocked_by:string[]}}
 */
export function validateSeasonStateInput(input, { requireSequence = false } = {}) {
  const blocked_by = [];
  const push = (r) => { if (!blocked_by.includes(r)) blocked_by.push(r); };

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["input_not_object"]) });
  }

  if (!ID_RE.test(String(input.season_id ?? ""))) push("season_id_malformed");
  if (!ID_RE.test(String(input.mission_id ?? ""))) push("mission_id_malformed");
  if (!PHASE_RE.test(String(input.mission_phase ?? ""))) push("mission_phase_malformed");
  if (!ACTION_RE.test(String(input.next_safe_action ?? ""))) push("next_safe_action_malformed");

  if (!SHA40_RE.test(String(input.repository_commit ?? ""))) push("repository_commit_malformed");
  if (!SHA40_RE.test(String(input.repository_tree ?? ""))) push("repository_tree_malformed");

  // Optional-but-typed anchors: null is legal, a wrong shape is not.
  for (const f of ["mission_contract_hash", "last_receipt_hash"]) {
    const v = input[f];
    if (v !== null && v !== undefined && !TAGGED_SHA256_RE.test(String(v))) push(`${f}_malformed`);
  }

  const seqProvided = input.state_sequence !== undefined;
  const seq = input.state_sequence;
  if (seqProvided) {
    if (!Number.isInteger(seq) || seq < 1) push("state_sequence_malformed");
  } else if (requireSequence) {
    push("state_sequence_malformed");
  }
  // An unstated position means genesis for validation purposes only; the store
  // always overrides it with the position it derived from HEAD.
  const seqEff = seqProvided && Number.isInteger(seq) ? seq : 1;

  const prev = input.previous_state_hash;
  if (prev !== null && prev !== undefined && !TAGGED_SHA256_RE.test(String(prev))) {
    push("previous_state_hash_malformed");
  }
  // Sequence 1 is the genesis link and may have no predecessor; every later
  // sequence MUST name one, or the chain has a hole that verification would
  // silently accept.
  const hasPrev = prev !== null && prev !== undefined;
  if (seqEff === 1 && hasPrev) push("genesis_must_not_have_previous");
  if (seqEff > 1 && !hasPrev) push("previous_state_hash_required");

  // completed_steps: deterministic (caller order preserved) and duplicate-free.
  // Duplicates are REFUSED, never silently deduped — a silent dedupe destroys
  // the caller's record of what actually ran.
  const steps = input.completed_steps;
  if (!Array.isArray(steps)) push("completed_steps_not_array");
  else if (steps.length > MAX_STEPS) push("completed_steps_too_many");
  else if (!steps.every((s) => isBoundedText(s))) push("completed_steps_malformed");
  else if (new Set(steps).size !== steps.length) push("completed_steps_duplicate");

  // must_not_repeat: preserved byte-exactly. No sort, no dedupe, no trim.
  const mnr = input.must_not_repeat;
  if (!Array.isArray(mnr)) push("must_not_repeat_not_array");
  else if (mnr.length > MAX_MUST_NOT_REPEAT) push("must_not_repeat_too_many");
  else if (!mnr.every((s) => isBoundedText(s))) push("must_not_repeat_malformed");

  // pending_consent: always an array; empty means none. Resume never grants it.
  const pc = input.pending_consent;
  if (!Array.isArray(pc)) push("pending_consent_shape_invalid");
  else if (pc.length > MAX_PENDING_CONSENT) push("pending_consent_shape_invalid");
  else if (
    !pc.every(
      (e) =>
        e &&
        typeof e === "object" &&
        !Array.isArray(e) &&
        isBoundedText(e.phrase) &&
        isBoundedText(e.scope) &&
        Object.keys(e).every((k) => k === "phrase" || k === "scope"),
    )
  ) {
    push("pending_consent_shape_invalid");
  }

  if (input.saved_at !== undefined && !ISO_RE.test(String(input.saved_at))) push("saved_at_malformed");

  if (findSecretBearingFields(input).length > 0) push("secret_bearing_state");

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

/** The exact subset the state hash covers, assembled in contract order. */
export function semanticStateBody(state) {
  const body = {};
  for (const f of SEMANTIC_STATE_FIELDS) body[f] = state[f];
  return body;
}

/**
 * Hash the semantic subset. Domain is carried INSIDE the body (it is the first
 * semantic field), so the canonical bytes are self-describing and a hash can
 * never be replayed under a different domain.
 */
export function hashSeasonState(state) {
  return sha256CanonicalJsonV1(semanticStateBody(state));
}

/**
 * Assemble a complete, hashed season state from validated input.
 * @returns {{ok:true, state:object}|{ok:false, blocked_by:string[]}}
 */
export function buildSeasonState(input) {
  const check = validateSeasonStateInput(input);
  if (!check.ok) return Object.freeze({ ok: false, blocked_by: check.blocked_by });

  const body = {
    schema: SEASON_STATE_SCHEMA,
    domain: SEASON_STATE_DOMAIN,
    season_id: input.season_id,
    mission_id: input.mission_id,
    mission_contract_hash: input.mission_contract_hash ?? null,
    mission_phase: input.mission_phase,
    completed_steps: Object.freeze([...input.completed_steps]),
    next_safe_action: input.next_safe_action,
    must_not_repeat: Object.freeze([...input.must_not_repeat]),
    pending_consent: Object.freeze(
      input.pending_consent.map((e) => Object.freeze({ phrase: e.phrase, scope: e.scope })),
    ),
    last_receipt_hash: input.last_receipt_hash ?? null,
    repository_commit: input.repository_commit,
    repository_tree: input.repository_tree,
    state_sequence: input.state_sequence ?? 1,
    previous_state_hash: input.previous_state_hash ?? null,
    truth_label: NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL,
    boundary: node0MinimumSeasonSaveResumeBoundary(),
  };

  let state_hash;
  try {
    state_hash = hashSeasonState(body);
  } catch (err) {
    const code = err instanceof CanonicalJsonV1Error ? err.code : "canonicalization_failed";
    return Object.freeze({ ok: false, blocked_by: Object.freeze([`canonicalization_failed:${code}`]) });
  }

  return Object.freeze({
    ok: true,
    state: Object.freeze({ ...body, saved_at: input.saved_at ?? null, state_hash }),
  });
}

/**
 * Body-bound re-derivation. Recomputes the semantic hash from the payload's OWN
 * fields and rejects any mismatch. A forged field with a recomputed hash still
 * fails, because the shape contract is re-checked here too — hash agreement is
 * never accepted as a substitute for contract conformance.
 */
export function verifySeasonState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return Object.freeze({ ok: false, reason: "state_not_object" });
  }
  if (state.schema !== SEASON_STATE_SCHEMA) return Object.freeze({ ok: false, reason: "unknown_schema" });
  if (state.domain !== SEASON_STATE_DOMAIN) return Object.freeze({ ok: false, reason: "unknown_schema" });
  if (!TAGGED_SHA256_RE.test(String(state.state_hash ?? ""))) {
    return Object.freeze({ ok: false, reason: "state_hash_malformed" });
  }
  // An alien or missing field changes what the file MEANS even when the covered
  // subset still hashes correctly, so the field set is part of the contract.
  const present = Object.keys(state).sort();
  const expected = [...STATE_FIELDS].sort();
  if (present.length !== expected.length || present.some((k, i) => k !== expected[i])) {
    return Object.freeze({ ok: false, reason: "state_fields_unexpected" });
  }
  const check = validateSeasonStateInput(state, { requireSequence: true });
  if (!check.ok) return Object.freeze({ ok: false, reason: "state_contract_violated", blocked_by: check.blocked_by });

  let recomputed;
  try {
    recomputed = hashSeasonState(state);
  } catch {
    return Object.freeze({ ok: false, reason: "state_hash_mismatch" });
  }
  if (recomputed !== state.state_hash) {
    return Object.freeze({ ok: false, reason: "state_hash_mismatch", recomputed_hash: recomputed });
  }
  return Object.freeze({ ok: true, state_hash: recomputed });
}

// ── save receipt ────────────────────────────────────────────────────────────
// The receipt is where the clock is bound. It attests "this exact semantic state
// was published at this time", which is why `saved_at` can be excluded from the
// state hash without becoming unattested data.
export const RECEIPT_FIELDS = Object.freeze([
  "schema", "domain", "season_id", "state_hash", "state_sequence",
  "previous_state_hash", "saved_at", "receipt_hash",
]);

export function receiptBody({ season_id, state_hash, state_sequence, previous_state_hash, saved_at }) {
  return {
    schema: SEASON_RECEIPT_SCHEMA,
    domain: SEASON_RECEIPT_DOMAIN,
    season_id,
    state_hash,
    state_sequence,
    previous_state_hash: previous_state_hash ?? null,
    saved_at,
  };
}

export function buildSeasonReceipt(args) {
  const body = receiptBody(args);
  return Object.freeze({ ...body, receipt_hash: sha256CanonicalJsonV1(body) });
}

/** Verify a receipt against itself AND against the state it claims to attest. */
export function verifySeasonReceipt(receipt, state) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return Object.freeze({ ok: false, reason: "receipt_not_object" });
  }
  if (receipt.schema !== SEASON_RECEIPT_SCHEMA || receipt.domain !== SEASON_RECEIPT_DOMAIN) {
    return Object.freeze({ ok: false, reason: "unknown_schema" });
  }
  const present = Object.keys(receipt).sort();
  const expected = [...RECEIPT_FIELDS].sort();
  if (present.length !== expected.length || present.some((k, i) => k !== expected[i])) {
    return Object.freeze({ ok: false, reason: "receipt_fields_unexpected" });
  }
  let recomputed;
  try {
    recomputed = sha256CanonicalJsonV1(receiptBody(receipt));
  } catch {
    return Object.freeze({ ok: false, reason: "receipt_hash_mismatch" });
  }
  if (recomputed !== receipt.receipt_hash) {
    return Object.freeze({ ok: false, reason: "receipt_hash_mismatch", recomputed_hash: recomputed });
  }
  if (state) {
    if (receipt.state_hash !== state.state_hash) return Object.freeze({ ok: false, reason: "receipt_state_mismatch" });
    if (receipt.state_sequence !== state.state_sequence) {
      return Object.freeze({ ok: false, reason: "receipt_state_mismatch" });
    }
    if ((receipt.previous_state_hash ?? null) !== (state.previous_state_hash ?? null)) {
      return Object.freeze({ ok: false, reason: "receipt_state_mismatch" });
    }
    if (receipt.season_id !== state.season_id) return Object.freeze({ ok: false, reason: "receipt_state_mismatch" });
  }
  return Object.freeze({ ok: true, receipt_hash: recomputed });
}

// ── HEAD ────────────────────────────────────────────────────────────────────
export const HEAD_FIELDS = Object.freeze([
  "schema", "domain", "season_id", "state_hash", "receipt_hash", "state_sequence", "head_hash",
]);

export function headBody({ season_id, state_hash, receipt_hash, state_sequence }) {
  return {
    schema: SEASON_HEAD_SCHEMA,
    domain: SEASON_HEAD_DOMAIN,
    season_id,
    state_hash,
    receipt_hash,
    state_sequence,
  };
}

export function buildSeasonHead(args) {
  const body = headBody(args);
  return Object.freeze({ ...body, head_hash: sha256CanonicalJsonV1(body) });
}

export function verifySeasonHead(head) {
  if (!head || typeof head !== "object" || Array.isArray(head)) {
    return Object.freeze({ ok: false, reason: "malformed_head" });
  }
  if (head.schema !== SEASON_HEAD_SCHEMA || head.domain !== SEASON_HEAD_DOMAIN) {
    return Object.freeze({ ok: false, reason: "unknown_schema" });
  }
  const present = Object.keys(head).sort();
  const expected = [...HEAD_FIELDS].sort();
  if (present.length !== expected.length || present.some((k, i) => k !== expected[i])) {
    return Object.freeze({ ok: false, reason: "malformed_head" });
  }
  if (
    !TAGGED_SHA256_RE.test(String(head.state_hash ?? "")) ||
    !TAGGED_SHA256_RE.test(String(head.receipt_hash ?? "")) ||
    !Number.isInteger(head.state_sequence) ||
    head.state_sequence < 1 ||
    !ID_RE.test(String(head.season_id ?? ""))
  ) {
    return Object.freeze({ ok: false, reason: "malformed_head" });
  }
  let recomputed;
  try {
    recomputed = sha256CanonicalJsonV1(headBody(head));
  } catch {
    return Object.freeze({ ok: false, reason: "malformed_head" });
  }
  if (recomputed !== head.head_hash) {
    return Object.freeze({ ok: false, reason: "malformed_head", recomputed_hash: recomputed });
  }
  return Object.freeze({ ok: true, head_hash: recomputed });
}

/** Chain-link algebra: does `state` legally succeed `prevState`? */
export function verifySeasonChainLink(state, prevState) {
  if (!prevState) {
    if (state.state_sequence !== 1) return Object.freeze({ ok: false, reason: "previous_state_link_broken" });
    if (state.previous_state_hash !== null) return Object.freeze({ ok: false, reason: "previous_state_link_broken" });
    return Object.freeze({ ok: true });
  }
  if (state.state_sequence <= prevState.state_sequence) {
    return Object.freeze({ ok: false, reason: "sequence_regression" });
  }
  if (state.state_sequence !== prevState.state_sequence + 1) {
    return Object.freeze({ ok: false, reason: "sequence_regression" });
  }
  if (state.previous_state_hash !== prevState.state_hash) {
    return Object.freeze({ ok: false, reason: "previous_state_link_broken" });
  }
  if (state.season_id !== prevState.season_id) {
    return Object.freeze({ ok: false, reason: "previous_state_link_broken" });
  }
  return Object.freeze({ ok: true });
}

/** Repository binding. Resume must refuse to continue against a drifted tree. */
export function verifyRepositoryBinding(state, { repositoryCommit, repositoryTree } = {}) {
  if (repositoryCommit !== undefined && repositoryCommit !== null && state.repository_commit !== repositoryCommit) {
    return Object.freeze({ ok: false, reason: "repository_commit_mismatch" });
  }
  if (repositoryTree !== undefined && repositoryTree !== null && state.repository_tree !== repositoryTree) {
    return Object.freeze({ ok: false, reason: "repository_tree_mismatch" });
  }
  return Object.freeze({ ok: true });
}

/**
 * The continuation an agent with no chat history receives. Pure projection of a
 * verified state — it grants nothing and executes nothing. `consent_granted` is
 * hard-coded false: resume is reconstruction, never authority.
 */
export function projectContinuation(state) {
  return Object.freeze({
    schema: SEASON_STATE_SCHEMA,
    truth_label: NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL,
    season_id: state.season_id,
    mission_id: state.mission_id,
    mission_contract_hash: state.mission_contract_hash,
    mission_phase: state.mission_phase,
    completed_steps: state.completed_steps,
    must_not_repeat: state.must_not_repeat,
    next_safe_action: state.next_safe_action,
    pending_consent: state.pending_consent,
    consent_granted: false,
    last_receipt_hash: state.last_receipt_hash,
    repository_commit: state.repository_commit,
    repository_tree: state.repository_tree,
    state_sequence: state.state_sequence,
    state_hash: state.state_hash,
    boundary: node0MinimumSeasonSaveResumeBoundary(),
  });
}

// ── scaffold-contract surface (consumed by the review gate) ─────────────────

export function planNode0MinimumSeasonSaveResume({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_MINIMUM_SEASON_SAVE_RESUME_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    for (const r of validateSeasonStateInput(input).blocked_by) blocked_by.push(r);
  }
  return Object.freeze({
    schema: NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA,
    truth_label: NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

export function buildNode0MinimumSeasonSaveResumePayload(input) {
  const body = {
    schema: NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA,
    truth_label: NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input,
    boundary: node0MinimumSeasonSaveResumeBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

export function verifyNode0MinimumSeasonSaveResume(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Object.freeze({ ok: false, reason: "payload_not_object" });
  }
  if (payload.schema !== NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA) {
    return Object.freeze({ ok: false, reason: "unknown_schema" });
  }
  const { content_hash, ...rest } = payload;
  let recomputed;
  try {
    recomputed = sha256CanonicalJsonV1(rest);
  } catch {
    return Object.freeze({ ok: false, reason: "content_hash_mismatch" });
  }
  if (recomputed !== content_hash) {
    return Object.freeze({ ok: false, reason: "content_hash_mismatch", recomputed_hash: recomputed });
  }
  const boundary = payload.boundary;
  if (!boundary || Object.values(boundary).some((v) => v !== false)) {
    return Object.freeze({ ok: false, reason: "boundary_not_all_false" });
  }
  const state = buildSeasonState(payload.input);
  if (!state.ok) return Object.freeze({ ok: false, reason: "state_contract_violated", blocked_by: state.blocked_by });
  const verified = verifySeasonState(state.state);
  if (!verified.ok) return Object.freeze({ ok: false, reason: verified.reason });
  return Object.freeze({ ok: true, content_hash: recomputed, state_hash: verified.state_hash });
}

export function runNode0MinimumSeasonSaveResume({ consent, input } = {}) {
  const plan = planNode0MinimumSeasonSaveResume({ consent, input });
  const blocked_by = [...plan.blocked_by];
  const boundary = node0MinimumSeasonSaveResumeBoundary();
  if (!plan.eligible) {
    return Object.freeze({
      ok: false, schema: NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA,
      truth_label: NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL,
      content_hash: null, boundary, blocked_by: Object.freeze(blocked_by),
    });
  }
  const payload = buildNode0MinimumSeasonSaveResumePayload(input);
  const verified = verifyNode0MinimumSeasonSaveResume(payload);
  if (!verified.ok) blocked_by.push(`verify_failed:${verified.reason}`);

  // Tamper-rejection is proven, not asserted: mutate one covered field and
  // require the SAME verifier to refuse the forgery.
  const forged = { ...payload, input: { ...payload.input, mission_phase: "FORGED_PHASE" } };
  if (verifyNode0MinimumSeasonSaveResume(forged).ok) blocked_by.push("tamper_not_rejected");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_MINIMUM_SEASON_SAVE_RESUME_SCHEMA,
    truth_label: NODE0_MINIMUM_SEASON_SAVE_RESUME_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary,
    blocked_by: Object.freeze(blocked_by),
  });
}
