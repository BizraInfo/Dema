// NODE0-FATE-STAGED-EFFECT-1A — G6 composition kernel.
//
// Composes measured pieces into ONE exactly-once chain:
//   FATE (packages/fate evaluateConsent — exact byte match, delegated)
//     → STAGED intent persisted BEFORE any effect
//       (fate phrase bound INSIDE the hashed subject)
//     → EFFECT executed via node0-reversible-execute-gate (its own embedded
//       GO phrase + containment gates remain the inner authority)
//     → OBSERVED by re-deriving world digests from bytes, never from claims
//     → COMMITTED receipt chained to the journal.
//
// THE law under proof (PROD-06 AC#7): a crash in the effect→receipt window is
// detected and NEVER re-executed. A rename preserves bytes, so the staged
// record carries a PREDICTABLE after-image (before digest, new name); resume
// measures the world: dst matches prediction ⇒ already effected ⇒ observe +
// commit without executing again; src intact & dst absent ⇒ execute once;
// anything else ⇒ RECOVERY_REQUIRED, fail closed, no guess.
//
// Pure kernel: `fs` injected; hashing via packages/canon canonical-json-v1.
// No clock/random/network. Boundary all-false — this kernel ORCHESTRATES
// delegated authorities; it performs no fs writes of its own beyond the
// journal, and every claim it seals cites the delegated receipts.

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { evaluateConsent } from "../../fate/src/fate.js";
import {
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  executeReversibleRename,
  measureSandboxState,
  planReversibleRename,
  undoReversibleRename,
} from "./node0-reversible-execute-gate.js";

export const NODE0_FATE_STAGED_EFFECT_SCHEMA = "bizra.dema.node0_fate_staged_effect.v0.1";
export const NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL = "NODE0_FATE_STAGED_EFFECT_MEASURED_REPO";
export const NODE0_FATE_STAGED_EFFECT_GO_PHRASE = "GO: dema fate staged effect";
// The operator-facing FATE requirement: an exact, distinct, domain phrase.
// The kernel GO phrase authorizes THIS slice's machinery; the required phrase
// below is the constitutional consent that moves the staged effect.
export const NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE = "FATE: dema staged effect permit";

export const JOURNAL_FILE = "fate-staged-journal.jsonl";

const TERMINAL = new Set(["COMMITTED", "HALTED_FATE", "RECOVERY_REQUIRED", "UNDONE"]);

export function node0FateStagedEffectBoundary() {
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
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function res(ok, extra = {}) {
  return Object.freeze({ ok, boundary: node0FateStagedEffectBoundary(), ...extra });
}

// ---------------------------------------------------------------------------
// Journal — append-only JSONL, every record hash-linked to its predecessor.
// ---------------------------------------------------------------------------

function bodyHash(body) {
  const { record_hash, prev_record_hash, ...rest } = body;
  void record_hash;
  void prev_record_hash;
  return sha256CanonicalJsonV1(rest);
}

function readRecords(fs, scopeDir) {
  const p = `${scopeDir}/${JOURNAL_FILE}`;
  if (!fs.existsSync(p)) return [];
  const out = [];
  for (const line of String(fs.readFileSync(p, "utf8")).split("\n")) {
    if (line.trim().length === 0) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      break; // torn tail after a crash: stop at last good record
    }
  }
  return out;
}

function appendLinked(fs, scopeDir, body) {
  const tail = readRecords(fs, scopeDir).at(-1);
  const rec = {
    ...body,
    seq: (tail?.seq ?? 0) + 1,
    prev_record_hash: tail?.record_hash ?? null,
  };
  rec.record_hash = bodyHash(rec);
  fs.mkdirSync(scopeDir, { recursive: true });
  fs.appendFileSync(`${scopeDir}/${JOURNAL_FILE}`, `${JSON.stringify(rec)}\n`, "utf8");
  return Object.freeze(rec);
}

function verifyJournalChain(records) {
  for (let i = 0; i < records.length; i += 1) {
    const r = records[i];
    if (r.record_hash !== bodyHash(r)) return `journal_record_${i}_hash_mismatch`;
    if (i > 0 && r.prev_record_hash !== records[i - 1].record_hash) {
      return `journal_record_${i}_chain_broken`;
    }
  }
  return null;
}

function latestOf(records, type) {
  for (let i = records.length - 1; i >= 0; i -= 1) {
    if (records[i].type === type) return records[i];
  }
  return null;
}

// World digest from BYTES: 'absent' or the file's sha256. Never from claims.
function worldDigest(fs, scopeDir, name) {
  const m = measureSandboxState(fs, scopeDir, name);
  return m === null ? "absent" : m.file_sha256;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export function planNode0FateStagedEffect({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_FATE_STAGED_EFFECT_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
    return Object.freeze({
      schema: NODE0_FATE_STAGED_EFFECT_SCHEMA,
      truth_label: NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL,
      eligible: false,
      blocked_by: Object.freeze(blocked_by),
    });
  }
  const { operatorPhrase, fileName, newName } = input;
  if (typeof operatorPhrase !== "string" || operatorPhrase.length === 0) {
    blocked_by.push("operator_phrase_missing");
  }
  if (typeof fileName !== "string" || fileName.length === 0) {
    blocked_by.push("action_file_name_missing");
  }
  if (typeof newName !== "string" || newName.length === 0) {
    blocked_by.push("action_new_name_missing");
  }
  return Object.freeze({
    schema: NODE0_FATE_STAGED_EFFECT_SCHEMA,
    truth_label: NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// ---------------------------------------------------------------------------
// Effect completion — shared by fresh start and staged-recovery. The stage
// record IS the consented intent; completion never re-asks FATE.
// Returns {ok, phase, envelope?, blocked_by, fault?}.
// ---------------------------------------------------------------------------

function completeStaged(fs, scopeDir, stageRec, { simulateFaultAfterEffect = false } = {}) {
  const { fileName, newName } = stageRec.action;
  const afterPrediction = stageRec.before_sha256; // rename preserves bytes

  let receipt;
  try {
    const gatePlan = planReversibleRename({
      sandboxRoot: scopeDir,
      fileName,
      newName,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    if (!gatePlan.eligible) {
      appendLinked(fs, scopeDir, {
        type: "phase", phase: "RECOVERY_REQUIRED",
        reason: `gate_plan:${gatePlan.blocked_by[0] ?? "refused"}`,
      });
      return res(false, {
        phase: "RECOVERY_REQUIRED",
        blocked_by: [`gate_plan:${gatePlan.blocked_by[0] ?? "refused"}`],
      });
    }
    receipt = executeReversibleRename({ plan: gatePlan, fs });
    if (simulateFaultAfterEffect) {
      // Crash simulation: the world changed but NOTHING more gets journaled.
      throw new Error("injected_fault_after_effect");
    }
  } catch (err) {
    return res(false, {
      phase: "STAGED",
      fault: String(err && err.message ? err.message : err),
      blocked_by: ["fault_in_effect_window"],
    });
  }

  if (receipt.executed !== true) {
    appendLinked(fs, scopeDir, {
      type: "phase", phase: "RECOVERY_REQUIRED",
      reason: `gate_execute:${(receipt.blocked_by ?? ["refused"])[0]}`,
    });
    return res(false, {
      phase: "RECOVERY_REQUIRED",
      blocked_by: [`gate_execute:${(receipt.blocked_by ?? ["refused"])[0]}`],
    });
  }

  // THE crash window under proof: a kill here leaves the world effected with
  // no effect record. The fault must surface as a STAGED journal + thrown
  // process state, never as a fabricated later phase.
  let effectRec;
  try {
    effectRec = appendLinked(fs, scopeDir, {
      type: "effect",
      effect_receipt_hash: sha256CanonicalJsonV1(receipt),
      after_prediction: afterPrediction,
    });
  } catch (err) {
    return res(false, {
      phase: "STAGED",
      fault: String(err && err.message ? err.message : err),
      blocked_by: ["fault_in_effect_window"],
    });
  }

  // OBSERVE — independent re-derivation from world bytes.
  const observedDst = worldDigest(fs, scopeDir, newName);
  const observedSrc = worldDigest(fs, scopeDir, fileName);
  if (observedDst !== afterPrediction || observedSrc !== "absent") {
    let undone = false;
    try {
      const u = undoReversibleRename({ receipt, fs });
      undone = u.undone === true;
    } catch {
      undone = false;
    }
    appendLinked(fs, scopeDir, {
      type: "phase",
      phase: undone ? "UNDONE" : "RECOVERY_REQUIRED",
      reason: "observation_contradicted",
    });
    return res(false, {
      phase: undone ? "UNDONE" : "RECOVERY_REQUIRED",
      blocked_by: ["observation_contradicted"],
    });
  }
  appendLinked(fs, scopeDir, { type: "phase", phase: "OBSERVED" });

  // COMMIT — exactly-once: this composition performs THE effect once.
  const envelope = Object.freeze({
    schema: NODE0_FATE_STAGED_EFFECT_SCHEMA,
    truth_label: NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    phase: "COMMITTED",
    action: Object.freeze({ ...stageRec.action }),
    fate_required_phrase: stageRec.fate_required_phrase,
    before_sha256: stageRec.before_sha256,
    after_sha256: afterPrediction,
    effect_receipt_hash: effectRec.effect_receipt_hash,
    effect_execution_count: 1,
    authority_delta: 0,
    boundary: node0FateStagedEffectBoundary(),
  });
  const contentEnvelope = {
    schema: envelope.schema,
    phase: envelope.phase,
    before_sha256: envelope.before_sha256,
    after_sha256: envelope.after_sha256,
    effect_receipt_hash: envelope.effect_receipt_hash,
    effect_execution_count: 1,
    authority_delta: 0,
  };
  const sealed = Object.freeze({
    ...envelope,
    content_hash: sha256CanonicalJsonV1(contentEnvelope),
  });
  appendLinked(fs, scopeDir, {
    type: "commit",
    content_hash: sealed.content_hash,
    effect_execution_count: 1,
    authority_delta: 0,
  });

  return res(true, { phase: "COMMITTED", envelope: sealed, blocked_by: [] });
}

// ---------------------------------------------------------------------------
// Start (fresh) / Resume (exactly-once classifier)
// ---------------------------------------------------------------------------

export function startFateStagedEffect({
  fs,
  scopeDir,
  operatorPhrase,
  fileName,
  newName,
} = {}) {
  const plan = planNode0FateStagedEffect({
    consent: NODE0_FATE_STAGED_EFFECT_GO_PHRASE,
    input: { operatorPhrase, fileName, newName },
  });
  if (!plan.eligible) {
    return res(false, { phase: "REFUSED_PLAN", blocked_by: plan.blocked_by });
  }

  if (readRecords(fs, scopeDir).length > 0) {
    // One journal = one composition. A second start must go through resume().
    return res(false, { phase: "REFUSED_PLAN", blocked_by: ["journal_already_open"] });
  }

  // FATE first: decided BEFORE anything is written. Refusal persists nothing
  // except the honest halt marker.
  const fate = evaluateConsent({
    phrase: operatorPhrase,
    requiredPhrase: NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE,
  });
  if (fate.accepted !== true) {
    appendLinked(fs, scopeDir, { type: "phase", phase: "HALTED_FATE", reason: "fate_refusal" });
    return res(false, { phase: "HALTED_FATE", blocked_by: ["fate_refusal"] });
  }

  // Before-image measured from world bytes; dst must be absent to begin.
  const beforeSha = worldDigest(fs, scopeDir, fileName);
  if (beforeSha === "absent") {
    appendLinked(fs, scopeDir, {
      type: "phase", phase: "RECOVERY_REQUIRED", reason: "source_absent",
    });
    return res(false, { phase: "RECOVERY_REQUIRED", blocked_by: ["source_absent"] });
  }
  if (worldDigest(fs, scopeDir, newName) !== "absent") {
    appendLinked(fs, scopeDir, {
      type: "phase", phase: "RECOVERY_REQUIRED", reason: "destination_occupied",
    });
    return res(false, { phase: "RECOVERY_REQUIRED", blocked_by: ["destination_occupied"] });
  }

  // STAGE — persisted BEFORE the effect exists anywhere.
  appendLinked(fs, scopeDir, {
    type: "stage",
    phase: "STAGED",
    fate_required_phrase: NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE, // bound INSIDE the hashed subject
    action: { fileName, newName },
    before_sha256: beforeSha,
    after_prediction: beforeSha, // rename preserves bytes: predictable after-image
  });

  return completeStaged(fs, scopeDir, { action: { fileName, newName }, before_sha256: beforeSha, fate_required_phrase: NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE });
}

export function resumeFateStagedEffect({ fs, scopeDir } = {}) {
  const records = readRecords(fs, scopeDir);
  if (records.length === 0) {
    return res(false, { phase: "NO_JOURNAL", blocked_by: ["no_journal"] });
  }
  const chainError = verifyJournalChain(records);
  if (chainError) {
    return res(false, { phase: "RECOVERY_REQUIRED", blocked_by: [chainError] });
  }

  const phaseRec = latestOf(records, "phase");
  const commitRec = latestOf(records, "commit");
  if (commitRec) {
    // Idempotent: a committed composition never re-executes on resume.
    return res(true, {
      phase: "COMMITTED",
      idempotent: true,
      effect_execution_count: commitRec.effect_execution_count ?? 1,
      blocked_by: [],
    });
  }
  if (phaseRec && TERMINAL.has(phaseRec.phase)) {
    return res(false, { phase: phaseRec.phase, blocked_by: [`terminal_${phaseRec.phase}`] });
  }

  const stageRec = latestOf(records, "stage");
  if (!stageRec) {
    return res(false, { phase: phaseRec?.phase ?? "UNKNOWN", blocked_by: ["stage_record_absent"] });
  }

  const { fileName, newName } = stageRec.action;
  const dstDigest = worldDigest(fs, scopeDir, newName);
  const srcDigest = worldDigest(fs, scopeDir, fileName);
  const effectRec = latestOf(records, "effect");

  if (dstDigest === stageRec.after_prediction && srcDigest === "absent") {
    // Already effected somewhere in the crash window: OBSERVE + COMMIT ONLY.
    // The effect is NOT re-executed — the law under proof.
    let receiptHash = null;
    if (!effectRec) {
      appendLinked(fs, scopeDir, {
        type: "effect",
        effect_receipt_hash: null, // receipt lost with the crashed process
        after_prediction: stageRec.after_prediction,
        classification: "effect_done_record_absent_bytes_matched",
      });
    } else {
      receiptHash = effectRec.effect_receipt_hash;
      appendLinked(fs, scopeDir, {
        type: "phase", phase: "OBSERVED", classification: "effect_done_receipt_absent",
      });
    }
    appendLinked(fs, scopeDir, {
      type: "commit",
      content_hash: sha256CanonicalJsonV1({
        schema: NODE0_FATE_STAGED_EFFECT_SCHEMA,
        phase: "COMMITTED",
        before_sha256: stageRec.before_sha256,
        after_sha256: stageRec.after_prediction,
        effect_receipt_hash: receiptHash,
        effect_execution_count: 1, // exactly-once: the pre-crash execution counts
        authority_delta: 0,
      }),
      authority_delta: 0,
    });
    return res(true, {
      phase: "COMMITTED",
      resume_classification: effectRec ? "effect_done_receipt_absent" : "effect_done_record_absent",
      effect_execution_count: 1,
      blocked_by: [],
    });
  }

  if (
    !effectRec &&
    srcDigest === stageRec.before_sha256 &&
    dstDigest === "absent"
  ) {
    // Staged but truly not yet effected: complete it exactly once.
    return completeStaged(fs, scopeDir, stageRec);
  }

  return res(false, { phase: "RECOVERY_REQUIRED", blocked_by: ["ambiguous_world"] });
}

function stage_rec_action(stageRec) {
  return stageRec.action;
}

// ---------------------------------------------------------------------------
// Universal slice contract
// ---------------------------------------------------------------------------

// Scaffold-convention orchestrator: plan -> start -> verify -> tamper-probe.
// `input.fs` is REQUIRED and injected (the gate passes the real node:fs;
// tests pass fixtures). No fs is ever imported here.
export function runNode0FateStagedEffect({ consent, input } = {}) {
  const blocked_by = [];
  const plan = planNode0FateStagedEffect({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: NODE0_FATE_STAGED_EFFECT_SCHEMA,
      truth_label: NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL,
      boundary: node0FateStagedEffectBoundary(),
      blocked_by: Object.freeze(plan.blocked_by),
    });
  }
  if (!isPlainObject(input) || !isPlainObject(input.fs)) {
    return Object.freeze({
      ok: false,
      schema: NODE0_FATE_STAGED_EFFECT_SCHEMA,
      truth_label: NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL,
      boundary: node0FateStagedEffectBoundary(),
      blocked_by: Object.freeze(["fs_adapter_not_injected"]),
    });
  }

  const started = startFateStagedEffect({
    fs: input.fs,
    scopeDir: input.scopeDir,
    operatorPhrase: input.operatorPhrase,
    fileName: input.fileName,
    newName: input.newName,
  });
  if (!started.ok) blocked_by.push(`start_failed:${started.phase}`);

  let verified = { ok: false, reason: "no_envelope" };
  if (started.envelope) {
    verified = verifyNode0FateStagedEffect(started.envelope);
    if (!verified.ok) blocked_by.push(`verify_failed:${verified.reason}`);
    const forged = { ...started.envelope, effect_execution_count: 99 };
    if (verifyNode0FateStagedEffect(forged).ok) {
      blocked_by.push("tamper_probe_passed");
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: NODE0_FATE_STAGED_EFFECT_SCHEMA,
    truth_label: NODE0_FATE_STAGED_EFFECT_TRUTH_LABEL,
    phase: started.phase,
    envelope: started.envelope ?? null,
    boundary: node0FateStagedEffectBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}

export function verifyNode0FateStagedEffect(envelope) {
  if (!isPlainObject(envelope)) {
    return Object.freeze({ ok: false, reason: "envelope_not_object" });
  }
  if (envelope.schema !== NODE0_FATE_STAGED_EFFECT_SCHEMA) {
    return Object.freeze({ ok: false, reason: "schema_mismatch" });
  }
  for (const [k, v] of Object.entries(node0FateStagedEffectBoundary())) {
    if (envelope.boundary?.[k] !== v) {
      return Object.freeze({ ok: false, reason: `boundary_violation:${k}` });
    }
  }
  if (envelope.authority_delta !== 0) {
    return Object.freeze({ ok: false, reason: "authority_delta_nonzero" });
  }
  const recomputed = sha256CanonicalJsonV1({
    schema: envelope.schema,
    phase: envelope.phase,
    before_sha256: envelope.before_sha256,
    after_sha256: envelope.after_sha256,
    effect_receipt_hash: envelope.effect_receipt_hash,
    effect_execution_count: envelope.effect_execution_count,
    authority_delta: envelope.authority_delta,
  });
  if (envelope.content_hash !== recomputed) {
    return Object.freeze({ ok: false, reason: "content_hash_mismatch" });
  }
  return Object.freeze({ ok: true, reason: null });
}
