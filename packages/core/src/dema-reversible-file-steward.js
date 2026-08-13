// DEMA-REVERSIBLE-FILE-STEWARD-1A — compose the proven reversible-rename, sanitizer,
// consent and receipt primitives into one bounded, consented, fully-reversible
// multi-file steward job (RENAME-only, metadata-only, no model / no network).
//
// This kernel is PURE: it plans and attests a multi-atom steward job and stays
// boundary all-false — it performs NO file mutation. The actual reversible
// execution and undo live in the already-shipped node0-reversible-execute-gate
// (executeReversibleRename / undoReversibleRename), which the CLI drives under
// its own consent. This slice's value is composing many reversible atoms into
// ONE bounded, sanitizer-gated, content-addressed plan.
//
// Pure kernel: no fs / network / process / clock / random. The two reused
// primitives (planReversibleRename, scanUntrustedText) are themselves pure.

import { createHash } from "node:crypto";
import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  planReversibleRename,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  NODE0_REVERSIBLE_EXECUTE_CONTROL_PLANE,
  // Phase completion is derived from receipts whose content hash re-derives, so a
  // fabricated history cannot advance the capsule's state machine.
  recomputeReceiptContentHash,
  // The authenticity bind: with an fs adapter this requires the receipt to be
  // present in the executor sealed on-disk log, which a caller cannot fabricate.
  verifyExecuteReceipt,
  // The two artifact classes an alternating phase graph needs: a TRANSITION the
  // executor sealed, and an OBSERVATION the gate sealed when it was made.
  NODE0_REVERSIBLE_UNDO_RECEIPT_SCHEMA,
  NODE0_REVERSIBLE_OBSERVATION_SCHEMA,
  OBSERVED_PRESENT,
  OBSERVED_ABSENT,
} from "./node0-reversible-execute-gate.js";
import { scanUntrustedText } from "./untrusted-corpus-sanitizer-preview.js";

export const DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA = "bizra.dema.dema_reversible_file_steward.v0.1";
export const DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL = "DEMA_REVERSIBLE_FILE_STEWARD_MEASURED_REPO";
export const DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE = "GO: dema reversible file steward preview";

const DEFAULT_MAX_ATOMS = 64;
const HARD_MAX_ATOMS = 1024; // canonical-json-v1 MAX_ARRAY_LENGTH

// All-false boundary invariant. These 8 keys mirror the capability-truth-registry
// row boundary — planning performs no execution, so every one stays false.
export function demaReversibleFileStewardBoundary() {
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

// Classify one steward atom by composing the proven primitives. Pure.
// - reversible: the atom is a safe, non-noop rename per the shipped rename gate.
// - sanitizer_verdict: if a content sample is supplied, gate it (ALLOWED / QUARANTINED / BLOCKED),
//   else NONE. QUARANTINED (secret) and BLOCKED (injection/authority) are NOT executable.
function classifyAtom(sandboxRoot, atom) {
  const from = typeof atom?.from === "string" ? atom.from : null;
  const to = typeof atom?.to === "string" ? atom.to : null;
  const renamePlan = planReversibleRename({
    sandboxRoot: typeof sandboxRoot === "string" ? sandboxRoot : "",
    fileName: from,
    newName: to,
    goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE, // pure validation of a safe reversible rename
    actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  });
  const reversible = renamePlan.eligible === true && from !== null && to !== null && from !== to;
  const sanitizer_verdict =
    typeof atom?.content_sample === "string" ? scanUntrustedText(atom.content_sample).verdict : "NONE";
  const executable = reversible && (sanitizer_verdict === "ALLOWED" || sanitizer_verdict === "NONE");
  return Object.freeze({ from, to, reversible, sanitizer_verdict, executable });
}

// Fail-closed plan. The whole job is eligible only when consent is an exact byte
// match, the input is well-formed, the atom count is bounded, EVERY atom is a
// valid reversible rename, and NO atom is sanitizer-blocked or -quarantined.
// Absence of a block is never validation — each precondition is positively proven.
export function planDemaReversibleFileSteward({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_REVERSIBLE_FILE_STEWARD_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
    return frozenPlan(blocked_by, 0, false);
  }
  const sandboxRoot = input.sandbox_root;
  if (typeof sandboxRoot !== "string" || sandboxRoot.length === 0) blocked_by.push("sandbox_root_missing");
  if (!Array.isArray(input.atoms)) {
    blocked_by.push("atoms_not_array");
    return frozenPlan(blocked_by, 0, false);
  }
  const maxAtoms = Number.isInteger(input.max_atoms) ? input.max_atoms : DEFAULT_MAX_ATOMS;
  const cap = Math.min(maxAtoms, HARD_MAX_ATOMS);
  const bounded = input.atoms.length <= cap;
  if (input.atoms.length === 0) blocked_by.push("atoms_empty");
  if (!bounded) blocked_by.push("max_atoms_exceeded");
  const classified = input.atoms.slice(0, HARD_MAX_ATOMS).map((a) => classifyAtom(sandboxRoot ?? "", a));
  if (classified.some((c) => !c.reversible)) blocked_by.push("atom_not_reversible");
  if (classified.some((c) => c.sanitizer_verdict === "BLOCKED")) blocked_by.push("atom_content_blocked");
  if (classified.some((c) => c.sanitizer_verdict === "QUARANTINED")) blocked_by.push("atom_content_quarantined");
  return frozenPlan(blocked_by, classified.length, bounded);
}

function frozenPlan(blocked_by, atom_count, bounded) {
  return Object.freeze({
    schema: DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA,
    truth_label: DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    atom_count,
    bounded,
    blocked_by: Object.freeze([...new Set(blocked_by)]),
  });
}

// Canonical, content-addressed job payload. Robust to empty/partial input (an
// empty steward job is vacuously reversible + clean). content_hash binds the
// WHOLE body.
export function buildDemaReversibleFileStewardPayload(input) {
  const sandbox_root = typeof input?.sandbox_root === "string" ? input.sandbox_root : null;
  const rawAtoms = Array.isArray(input?.atoms) ? input.atoms : [];
  const max_atoms = Number.isInteger(input?.max_atoms) ? input.max_atoms : DEFAULT_MAX_ATOMS;
  const atoms = rawAtoms.slice(0, HARD_MAX_ATOMS).map((a) => classifyAtom(sandbox_root ?? "", a));
  const body = {
    schema: DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA,
    truth_label: DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    sandbox_root,
    max_atoms,
    atom_count: atoms.length,
    atoms,
    all_reversible: atoms.every((a) => a.reversible),
    all_clean: atoms.every((a) => a.sanitizer_verdict === "ALLOWED" || a.sanitizer_verdict === "NONE"),
    executable_count: atoms.filter((a) => a.executable).length,
    bounded: rawAtoms.length <= Math.min(max_atoms, HARD_MAX_ATOMS),
    boundary: demaReversibleFileStewardBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

/**
 * The MISSION preview profile: the payload above PLUS a truthful account of the
 * control-plane artifacts the executor will write into the sandbox root.
 *
 * CR-01, measured on Mission-001 Run-1 Attempt-1: the consent packet promised
 * "directory otherwise untouched", then execution created `.node0-backups/` and
 * `.node0-receipts.ndjson`. Those artifacts are the machinery the undo clause
 * depends on, so they belong INSIDE the thing the human agrees to — not inside a
 * definition of "user-visible" the executor applies to itself afterwards.
 *
 * The exact backup filename embeds a content-hash prefix known only at execution
 * time, so the disclosure names the directory, the per-atom pattern and the
 * append count: everything derivable without reading a byte. Stays pure.
 *
 * ADDITIVE BY OMISSION: `buildDemaReversibleFileStewardPayload` is untouched, so
 * every preview hash already recorded in the estate remains byte-identical. This
 * lives beside that builder because both hash a steward body with the same
 * canonical hasher — and because the mission tier may not import that hasher
 * directly (canonical-json-v1 adoption freeze).
 */
export function buildDisclosedStewardPreview(input) {
  const { content_hash: _undisclosed, ...body } = buildDemaReversibleFileStewardPayload(input);
  const cp = NODE0_REVERSIBLE_EXECUTE_CONTROL_PLANE;
  const disclosed = {
    ...body,
    control_plane_effects: {
      disclosed: true,
      backup_dir: cp.backup_dir,
      backup_files: body.atoms.map(
        (a) => `${cp.backup_dir}/${a.from}.<sha256-12>${cp.backup_suffix}`,
      ),
      receipt_log: cp.receipt_log,
      receipt_log_appends: body.atom_count,
    },
  };
  return Object.freeze({ ...disclosed, content_hash: sha256CanonicalJsonV1(disclosed) });
}

// ── MISSION-001-CAPSULE-CONSENT-CONTRACT-1A ─────────────────────────────────
//
// §5.9 requires Mission-001's undo to be "executable and tested". CR-03 made the
// mechanism possible; this makes it CONSENTABLE. The danger in fixing §5.9 is
// quietly breaking §5.5: the human approves "rename once" while the executor
// performs apply → undo → reapply. So the human must see and agree to the WHOLE
// reversible experiment, not its final rename.
//
// ACTION_ID AND PHASE ARE NOT METADATA. They determine the on-disk footprint
// (`.node0-backups/<action_id>/<phase>/…`), so a caller who could choose them
// after consent could move the control plane the human agreed to — reopening
// CR-01 through the door CR-03 just built. They are therefore DERIVED from the
// sealed capsule, never accepted.
//
// Derivation is deliberately two-stage to stay acyclic: an identity seed is taken
// over the effect and its bindings (no phases), the action id comes from that
// seed, and only then are the phase ids and backup paths derived — after which
// the whole body is hashed. A one-stage hash would need the action id to hash the
// phases and the phases to hash the action id.
//
// CALLER_PHASE != AUTHORITY. `nextCapsulePhase` derives the next legal phase from
// the verified capsule and what has actually completed, so "final" happens because
// restoration was proven — not because somebody passed the string "final".
//
// RECOVERY != REAUTHORIZATION. Resuming a partially executed capsule continues its
// state machine; it never restarts the graph under the same consent.
export const MISSION_EFFECT_CAPSULE_SCHEMA = "bizra.mission.mission_effect_capsule.v0.1";

// The ordered graph the sovereign agrees to in one act.
export const CAPSULE_PHASE_GRAPH = Object.freeze([
  "p1-provisional-apply",
  "p2-verify-apply",
  "p3-exact-undo",
  "p4-verify-restored",
  "p5-final-apply",
  "p6-verify-final",
]);

// Phases that actually touch the filesystem, and therefore need a backup slot.
const MUTATING_PHASES = Object.freeze(["p1-provisional-apply", "p5-final-apply"]);

export function buildMissionEffectCapsule({
  effect,
  mission_id,
  contract_hash,
  purpose_id,
  repository_commit,
  repository_tree,
  nonce,
  expires_at,
} = {}) {
  const required = { effect, mission_id, contract_hash, purpose_id, repository_commit, repository_tree, nonce, expires_at };
  for (const [k, v] of Object.entries(required)) {
    if (v === undefined || v === null || (typeof v === "string" && v.length === 0)) {
      return Object.freeze({ ok: false, reason: `capsule_field_missing:${k}` });
    }
  }
  let preview;
  try {
    preview = buildDisclosedStewardPreview(effect);
  } catch {
    return Object.freeze({ ok: false, reason: "effect_not_previewable" });
  }

  // Stage 1 — identity seed over the effect and its bindings only.
  const seed = sha256CanonicalJsonV1({
    schema: MISSION_EFFECT_CAPSULE_SCHEMA,
    mission_id,
    contract_hash,
    purpose_id,
    preview_hash: preview.content_hash,
    repository_commit,
    repository_tree,
    nonce,
    expires_at,
  });
  // isSafeName-compatible: letters, digits, dot, dash, underscore only.
  const action_id = `act-${seed.replace(/^sha256:/, "").slice(0, 24)}`;

  // Stage 2 — the phase graph and the exact control-plane footprint it produces.
  const cp = NODE0_REVERSIBLE_EXECUTE_CONTROL_PLANE;
  const phases = CAPSULE_PHASE_GRAPH.map((name, i) =>
    Object.freeze({
      ordinal: i + 1,
      name,
      mutating: MUTATING_PHASES.includes(name),
      backup_paths: MUTATING_PHASES.includes(name)
        ? Object.freeze(
            preview.atoms.map(
              (a) => `${cp.backup_dir}/${action_id}/${name}/${a.from}.<sha256-12>${cp.backup_suffix}`,
            ),
          )
        : Object.freeze([]),
    }),
  );

  const body = {
    schema: MISSION_EFFECT_CAPSULE_SCHEMA,
    mission_id,
    contract_hash,
    purpose_id,
    action_id,
    effect_preview: preview,
    phases: Object.freeze(phases),
    control_plane_footprint: Object.freeze({
      backup_dir: cp.backup_dir,
      receipt_log: cp.receipt_log,
      // Two mutating phases, so the log is appended once per phase per atom.
      receipt_log_appends: MUTATING_PHASES.length * preview.atom_count,
      preserved_after_undo: true,
    }),
    expected_states: Object.freeze({
      genesis: "the source path present with its before-hash",
      after_provisional: "the target path present, content hash unchanged",
      after_undo: "byte-identical return to genesis, proven against the backup",
      final: "the target path present, content hash unchanged, source absent",
    }),
    repository_commit,
    repository_tree,
    nonce,
    expires_at,
    authority_delta: 0,
  };
  return Object.freeze({ ok: true, capsule: Object.freeze({ ...body, capsule_hash: sha256CanonicalJsonV1(body) }) });
}

/**
 * Re-derive which phases ACTUALLY completed, from evidence rather than names.
 *
 * PHASE_NAME != PHASE_COMPLETION. An earlier version of this kernel took a list of
 * completed phase NAMES and checked they formed a legal prefix. That proves the
 * reported order is legal; it proves nothing about whether those phases happened.
 * A caller could hand over the four earlier names and be told the next legal
 * mutation was the final apply — the same family as `ok:true != evidence exists`
 * and `actor claim != authority`.
 *
 * So advancement consumes evidence that verifies against the sealed capsule and
 * against itself: a mutating phase needs an execute receipt whose content hash
 * re-derives and whose action_id/phase match the capsule; a verification phase
 * needs an observed state hash equal to what the preceding receipt recorded; the
 * undo phase needs a restoration proven back to the provisional receipt's
 * before_hash. Derivation stops at the first phase that does not verify, so a gap
 * cannot be stepped over.
 *
 * Still pure: the receipts and observations are injected. `verifyExecuteReceipt`
 * with an fs adapter remains the stronger authenticity anchor for callers that
 * have one — this kernel refuses forged HISTORY, not a forged disk.
 */
export function deriveVerifiedCapsuleCompletion({ capsule, evidence = [], fs } = {}) {
  if (!capsule || capsule.schema !== MISSION_EFFECT_CAPSULE_SCHEMA) {
    return Object.freeze({ ok: false, reason: "capsule_required", completed: Object.freeze([]) });
  }
  const empty = (reason) =>
    Object.freeze({ ok: true, completed: Object.freeze([]), stopped_at: Object.freeze({ phase: capsule.phases[0].name, reason }) });

  // WORLD TRUTH OR NOTHING. Without a filesystem adapter no phase can be
  // established, because every remaining check re-derives reality rather than
  // reading a caller's assertion about it. Fail closed, never "assume executed".
  if (!fs || typeof fs.readFileSync !== "function" || typeof fs.existsSync !== "function") {
    return empty("world_observer_required");
  }

  const rows = Array.isArray(evidence) ? evidence : [];
  // AMBIGUOUS HISTORY IS REFUSED HISTORY. A Map would silently take the last
  // writer; authority must not pick whichever duplicate arrived last.
  const byPhase = new Map();
  for (const r of rows) {
    if (!r || typeof r.phase !== "string") continue;
    if (byPhase.has(r.phase)) return empty("ambiguous_phase_evidence");
    byPhase.set(r.phase, r);
  }

  const root = capsule.effect_preview.sandbox_root;
  const atom = capsule.effect_preview.atoms[0];
  /**
   * An even phase is proven by an OBSERVATION the gate sealed at the time, not by
   * a re-read now. A capsule's intermediate states are gone by the time the next
   * phase is authorized — that is precisely why the previous implementation
   * reached for a later receipt as a substitute and credited post-hoc inference
   * as authority. The observation must be log-anchored and scoped to this
   * capsule's action and this exact phase; a caller-authored `observed_hash`
   * field is no longer read anywhere.
   */
  const observationShows = (row, expected, phaseName) => {
    const o = row?.observation;
    if (
      !o ||
      o.schema !== NODE0_REVERSIBLE_OBSERVATION_SCHEMA ||
      o.action_id !== capsule.action_id ||
      o.phase !== phaseName ||
      typeof o.content_hash !== "string" ||
      recomputeReceiptContentHash(o) !== o.content_hash ||
      !sealedLogContains(o)
    ) {
      return false;
    }
    // OBSERVATION-ABSENCE-SEMANTICS-1A. `want === null` means THE PATH MUST BE
    // ABSENT, and only a positive ABSENT reading satisfies it. UNSAFE and
    // UNREADABLE are failures to observe, and a failure to observe can never
    // satisfy a predicate requiring the fact to be false — otherwise a symlink
    // planted where a file must be gone would credit the phase.
    return Object.entries(expected).every(([name, want]) => {
      const seen = o.observed?.[name];
      if (!seen || typeof seen !== "object") return false;
      return want === null
        ? seen.state === OBSERVED_ABSENT
        : seen.state === OBSERVED_PRESENT && seen.hash === want;
    });
  };

  /** An odd phase is proven by a TRANSITION the executor sealed. */
  const undoReceiptAdmissible = (r) =>
    !!r &&
    r.schema === NODE0_REVERSIBLE_UNDO_RECEIPT_SCHEMA &&
    r.action_id === capsule.action_id &&
    typeof r.content_hash === "string" &&
    // INTEGRITY, not only membership. `sealedLogContains` matches the content
    // hash STRING, so without this a caller could take a genuinely sealed
    // artifact, rewrite its fields, keep the old hash, and still pass. The
    // execute-receipt path already re-derived; these two newer artifact classes
    // did not. Found by a mutation control that refused to go red.
    recomputeReceiptContentHash(r) === r.content_hash &&
    sealedLogContains(r);

  // A receipt is admissible only when it is INTEGRITY-sound, PROVENANCE-bound
  // (present in the executor's sealed on-disk log — `verifyExecuteReceipt` with an
  // fs adapter is the authenticity bind) and scoped to this capsule. `action_id`
  // is itself derived from the capsule's identity seed, so matching it binds the
  // receipt to this capsule and not merely to a look-alike effect.
  const receiptAdmissible = (r, phaseName) =>
    !!r &&
    r.executed === true &&
    r.action_id === capsule.action_id &&
    r.phase === phaseName &&
    typeof r.content_hash === "string" &&
    recomputeReceiptContentHash(r) === r.content_hash &&
    sealedLogContains(r);

  // PROVENANCE, separated from current reality. `verifyExecuteReceipt(_, {fs})`
  // also re-measures present state, which is right for a live receipt and WRONG
  // for a historical one: after the provisional apply is undone its target is
  // intentionally gone. What survives is the executor sealed append-only log, and
  // a caller cannot fabricate an entry in it. So authenticity here is log
  // inclusion; present reality is checked separately, per phase.
  function sealedLogContains(r) {
    try {
      const log = fs.readFileSync(`${root}/${capsule.control_plane_footprint.receipt_log}`, "utf8");
      return log.includes(r.content_hash);
    } catch {
      return false;
    }
  }

  const completed = [];
  let provisional = null;
  let finalReceipt = null;
  let stopped = null;

  for (const phase of capsule.phases) {
    const row = byPhase.get(phase.name);
    if (!row) {
      stopped = { phase: phase.name, reason: "no_evidence" };
      break;
    }
    let ok = false;
    let why = "evidence_did_not_verify";
    switch (phase.name) {
      case "p1-provisional-apply":
        ok = receiptAdmissible(row.receipt, phase.name);
        if (!ok) why = "receipt_not_authentic";
        if (ok) provisional = row.receipt;
        break;
      case "p2-verify-apply":
        // Was `provisional.after_hash === provisional.before_hash` — trivially
        // true for a rename, so p1 silently granted p2 and no independent
        // verification ever happened. Now an observation the GATE sealed must
        // show the world actually in S1.
        ok = !!provisional && observationShows(row, { [atom.to]: provisional.after_hash, [atom.from]: null }, phase.name);
        if (!ok) why = "apply_state_not_observed";
        break;
      case "p3-exact-undo":
        // TRANSITION, not postcondition. A restored world is producible by a
        // recovery script, a human, or any other actor; only the governed undo
        // seals a log-anchored receipt naming the apply it reverses.
        ok =
          !!provisional &&
          undoReceiptAdmissible(row.receipt) &&
          row.receipt.of_receipt_hash === provisional.content_hash &&
          row.receipt.proven === true;
        if (!ok) why = "undo_transition_not_proven";
        break;
      case "p4-verify-restored":
        // POSTCONDITION, independently. Separate from p3 on purpose: a genuine
        // undo whose world later diverges must stop here, and a restored world
        // with no governed undo must stop at p3.
        ok = !!provisional && observationShows(row, { [atom.from]: provisional.before_hash, [atom.to]: null }, phase.name);
        if (!ok) why = "restoration_not_observed";
        break;
      case "p5-final-apply":
        ok = receiptAdmissible(row.receipt, phase.name);
        if (!ok) why = "receipt_not_authentic";
        if (ok) finalReceipt = row.receipt;
        break;
      case "p6-verify-final":
        ok = !!finalReceipt && observationShows(row, { [atom.to]: finalReceipt.after_hash }, phase.name);
        if (!ok) why = "final_state_not_observed";
        break;
      default:
        ok = false;
    }
    if (!ok) {
      stopped = { phase: phase.name, reason: why };
      break;
    }
    completed.push(phase.name);
  }
  return Object.freeze({
    ok: true,
    completed: Object.freeze(completed),
    stopped_at: stopped ? Object.freeze(stopped) : null,
  });
}

/**
 * The phase state machine. The next phase is a function of the sealed capsule and
 * VERIFIED history — never of what a caller asked for. Recovery from a partial run
 * resumes at the truthful frontier; it does not restart the graph.
 */
export function nextCapsulePhase(capsule, evidence = [], fs) {
  if (!capsule || capsule.schema !== MISSION_EFFECT_CAPSULE_SCHEMA) {
    return Object.freeze({ ok: false, reason: "capsule_required" });
  }
  const derived = deriveVerifiedCapsuleCompletion({ capsule, evidence, fs });
  if (derived.ok !== true) return derived;
  const done = derived.completed;
  if (done.length >= capsule.phases.length) {
    return Object.freeze({
      ok: true,
      complete: true,
      phase: null,
      action_id: capsule.action_id,
      verified_completed: done,
    });
  }
  const phase = capsule.phases[done.length];
  return Object.freeze({
    ok: true,
    complete: false,
    phase: phase.name,
    ordinal: phase.ordinal,
    mutating: phase.mutating,
    // Exactly what the gate must be handed — derived, not chosen.
    action_id: capsule.action_id,
    verified_completed: done,
    stopped_at: derived.stopped_at,
  });
}

// Body-bound verifier: recompute the hash over the WHOLE body minus its hash
// field and reject any mismatch, plus schema / label / all-false-boundary checks.
// A field change that does not update content_hash fails (recompute differs).
export function verifyDemaReversibleFileSteward(payload) {
  if (!payload || typeof payload !== "object") return Object.freeze({ ok: false, reason: "payload_not_object" });
  const { content_hash, ...body } = payload;
  let recomputed;
  try {
    recomputed = sha256CanonicalJsonV1(body);
  } catch {
    return Object.freeze({ ok: false, reason: "body_not_canonicalizable" });
  }
  const hash_ok = typeof content_hash === "string" && recomputed === content_hash;
  const schema_ok = payload.schema === DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA;
  const label_ok = payload.truth_label === DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL;
  const ref = demaReversibleFileStewardBoundary();
  const b = payload.boundary;
  // Deep-equal the canonical key SET, not just "reference keys are false". A
  // subset check is vacuous the other way: a forged boundary with all 8 canonical
  // keys false PLUS an extra `capability: true` key, rehashed so hash_ok passes,
  // would ride through if we only iterated `ref`. Reject on any key-count drift.
  const boundary_ok =
    !!b &&
    typeof b === "object" &&
    Object.keys(b).length === Object.keys(ref).length &&
    Object.keys(ref).every((k) => b[k] === false);
  return Object.freeze({
    ok: hash_ok && schema_ok && label_ok && boundary_ok,
    hash_ok,
    schema_ok,
    label_ok,
    boundary_ok,
  });
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject.
// Fails closed (named block) on any step. Boundary stays all-false — no execution.
export function runDemaReversibleFileSteward({ consent, input } = {}) {
  const boundary = demaReversibleFileStewardBoundary();
  const plan = planDemaReversibleFileSteward({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA,
      truth_label: DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL,
      content_hash: null,
      boundary,
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildDemaReversibleFileStewardPayload(input);
  const verified = verifyDemaReversibleFileSteward(payload).ok === true;
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  const tamper_rejected = verifyDemaReversibleFileSteward(tampered).ok === false;
  const ok = verified && tamper_rejected;
  return Object.freeze({
    ok,
    schema: DEMA_REVERSIBLE_FILE_STEWARD_SCHEMA,
    truth_label: DEMA_REVERSIBLE_FILE_STEWARD_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary,
    blocked_by: ok ? Object.freeze([]) : Object.freeze(["verify_or_tamper_self_check_failed"]),
  });
}
