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

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  planReversibleRename,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  NODE0_REVERSIBLE_EXECUTE_CONTROL_PLANE,
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
 * The phase state machine. The next phase is a FUNCTION of the verified capsule
 * and what has actually completed — never of what a caller asked for. Recovery
 * from a partial run continues here; it does not restart the graph.
 */
export function nextCapsulePhase(capsule, completedPhases = []) {
  if (!capsule || capsule.schema !== MISSION_EFFECT_CAPSULE_SCHEMA) {
    return Object.freeze({ ok: false, reason: "capsule_required" });
  }
  const done = Array.isArray(completedPhases) ? completedPhases : [];
  // Completion must be a prefix of the graph: a gap means a phase was skipped.
  for (let i = 0; i < done.length; i++) {
    if (done[i] !== capsule.phases[i]?.name) {
      return Object.freeze({ ok: false, reason: "phase_order_violation" });
    }
  }
  if (done.length >= capsule.phases.length) {
    return Object.freeze({ ok: true, complete: true, phase: null, action_id: capsule.action_id });
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
