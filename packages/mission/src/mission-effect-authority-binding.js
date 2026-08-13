// MISSION-EFFECT-AUTHORITY-BINDING-1A — the missing seam between Stage-5 exact
// consent and Stage-6 bounded action.
//
// THE GAP THIS CLOSES. `walkGenesisMissionSpine` halts at CONSENT_GATE with
// PERMIT_PREVIEW and grants nothing; `sequenceExecuteStewardJob` checks only its
// own phrase constant and never sees preview_hash or consent_context_hash. A
// caller therefore bridged the two by handing the executor its own phrase, so
// the machine could not prove the executed effect IS the previewed effect the
// sovereign approved. Mission-001 Run-1 Attempt-1 crossed that seam. Required law:
//
//   PREVIEWED_EFFECT == CONSENT_BOUND_EFFECT == EXECUTION_TIME_RE-DERIVED_EFFECT
//
// This is the law already shipped for the Act-1 authorship migration
// (genesis-authorship-migration-binding.js), applied to the steward effect path.
// Nothing here is a new authority model; it is the existing one, wired.
//
// SEALED RE-DERIVATION WINS. `envelope.preview_hash` is presentation, never
// authority. The anchor is the hash recomputed from the effect itself, and BOTH
// the envelope and the Stage-5 result must agree with it. An envelope forged to
// carry a decoy's hash disagrees with Stage-5; a substituted effect disagrees
// with the re-derivation. Either way execution refuses.
//
// AUTHORITY BEFORE ACT. The nonce is claimed before the executor is reachable.
// Attempt-1 claimed it afterwards — replay was plausibly blocked downstream, but
// nothing proved two actors could not both pass an unclaimed gate. Ordering is
// the control; the ledger entry is only its record.
//
// NO CALLER-SUPPLIED INNER PHRASE. The steward execute phrase is composed from
// the module constant (node0-spine-runner doctrine: inner GO phrases are composed
// programmatically, never user-supplied bypass paths). Extra caller-supplied
// consent fields are ignored, not honoured.
//
// PURE. Every effect is injected (`claimNonce`, `executeJob`). This module reads
// no disk, no clock, no network — `now` is injected too.
//
// NO DOWNGRADE ON THE FOOTPRINT. The anchor is re-derived with the DISCLOSING
// preview profile, so a mission whose preview hid the executor's control-plane
// artifacts has no execution path at all (CR-01).
//
// WHAT SUCCESS DOES NOT PROVE. That the effect's own undo was exercised, or that
// the resulting receipt is signed per contract §7. Those are CR-03 and CR-05 and
// remain open.

// The disclosing preview profile lives beside the payload builder it extends —
// the mission tier is not a registered consumer of the canonical hasher
// (canonical-json-v1 adoption freeze), and hashing belongs with the body anyway.
import { buildDisclosedStewardPreview } from "../../core/src/dema-reversible-file-steward.js";
import { DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE } from "../../core/src/dema-reversible-file-steward-execution.js";

export { buildDisclosedStewardPreview };

export const MISSION_EFFECT_AUTHORITY_CONSENT_SCHEMA =
  "bizra.mission.mission_effect_authority_binding.v0.1";
export const MISSION_EFFECT_AUTHORITY_OPERATION = "EXECUTE_MISSION_BOUND_REVERSIBLE_EFFECT";

const isStr = (v) => typeof v === "string" && v.length > 0;
const refuse = (reason, extra = {}) => Object.freeze({ ok: false, reason, authority_delta: 0, ...extra });

/** Stage-5 is usable as authority only when it verified consent and granted nothing. */
function stage5Verified(s) {
  return (
    !!s &&
    typeof s === "object" &&
    s.verdict === "PERMIT_PREVIEW" &&
    s.consent?.consent_verified === true &&
    isStr(s.preview_hash) &&
    isStr(s.consent?.consent_context_hash) &&
    s.authority_delta === 0 &&
    s.grants_execution === false
  );
}

/**
 * Mint the execution envelope. Refuses unless Stage-5 actually verified consent,
 * so an envelope cannot exist without a real PERMIT_PREVIEW behind it.
 */
export function buildMissionEffectAuthorityEnvelope({
  spineResult,
  corridorContext,
  effect,
  repositoryBinding,
  now,
} = {}) {
  if (!stage5Verified(spineResult)) return refuse("stage5_not_permit_preview");
  if (!corridorContext || typeof corridorContext !== "object") return refuse("corridor_context_required");
  if (!effect || typeof effect !== "object") return refuse("effect_required");
  if (!repositoryBinding || repositoryBinding.ok !== true) return refuse("repository_binding_required");
  if (!isStr(now)) return refuse("issued_at_required");
  for (const k of ["mission_id", "contract_hash", "mission_root", "nonce", "expires_at"]) {
    if (!isStr(corridorContext[k])) return refuse(`corridor_context_malformed:${k}`);
  }
  return Object.freeze({
    ok: true,
    envelope: Object.freeze({
      schema: MISSION_EFFECT_AUTHORITY_CONSENT_SCHEMA,
      operation: MISSION_EFFECT_AUTHORITY_OPERATION,
      // the sealed Stage-5 commitments, carried forward verbatim
      preview_hash: spineResult.preview_hash,
      consent_context_hash: spineResult.consent.consent_context_hash,
      mission_id: corridorContext.mission_id,
      contract_hash: corridorContext.contract_hash,
      mission_root: corridorContext.mission_root,
      repository_commit: repositoryBinding.commit,
      repository_tree: repositoryBinding.tree,
      nonce: corridorContext.nonce,
      issued_at: now,
      expires_at: corridorContext.expires_at,
      authority_delta: 0,
    }),
  });
}

/**
 * The ONLY production path from a Mission-001 consent to a steward effect.
 *
 * Envelope-first, then Stage-5 is re-checked, then the preview is RE-DERIVED from
 * the effect and the three-way binding is proven, then every scope binding, then
 * the window — and only then is the nonce claimed and the executor delegated to
 * with an internally composed phrase. Every refusal returns before the nonce
 * ledger and before the executor: a blocked attempt mutates nothing.
 */
export async function executeMissionBoundEffect({
  envelope,
  effect,
  spineResult,
  corridorContext,
  repositoryBinding,
  now,
  claimNonce,
  executeJob,
} = {}) {
  // ── envelope shape ──
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return refuse("consent_envelope_required");
  }
  if (envelope.schema !== MISSION_EFFECT_AUTHORITY_CONSENT_SCHEMA) {
    return refuse("consent_envelope_malformed:schema");
  }
  if (envelope.operation !== MISSION_EFFECT_AUTHORITY_OPERATION) {
    return refuse("consent_envelope_wrong_operation");
  }
  if (envelope.authority_delta !== 0) return refuse("consent_envelope_authority_nonzero");
  for (const k of [
    "preview_hash",
    "consent_context_hash",
    "mission_id",
    "contract_hash",
    "mission_root",
    "nonce",
    "expires_at",
  ]) {
    if (!isStr(envelope[k])) return refuse(`consent_envelope_malformed:${k}`);
  }
  if (typeof claimNonce !== "function" || typeof executeJob !== "function") {
    return refuse("effect_adapters_missing");
  }
  if (!isStr(now)) return refuse("now_required");

  // ── Stage-5 must still be a verified, non-granting consent ──
  if (!stage5Verified(spineResult)) return refuse("stage5_not_permit_preview");
  if (!effect || typeof effect !== "object") return refuse("effect_required");
  if (!corridorContext || typeof corridorContext !== "object") return refuse("corridor_context_required");

  // ── THE BINDING LAW, proven before the nonce claim and any mutation ──
  // The anchor is the hash re-derived from the effect about to be executed.
  // NO DOWNGRADE, structurally: the anchor is re-derived with the DISCLOSING
  // profile, so a mission previewed with the undisclosed builder can never
  // produce a matching hash. There is no flag to forget and no path that
  // executes an effect whose control-plane artifacts were hidden from consent.
  let derived;
  try {
    derived = buildDisclosedStewardPreview(effect).content_hash;
  } catch {
    return refuse("effect_not_previewable");
  }
  // The envelope must describe the consent that actually happened...
  if (envelope.preview_hash !== spineResult.preview_hash) return refuse("consent_binding_mismatch");
  if (envelope.consent_context_hash !== spineResult.consent.consent_context_hash) {
    return refuse("consent_context_binding_mismatch");
  }
  // ...and the effect being executed must be the effect that was previewed.
  if (derived !== spineResult.preview_hash) return refuse("preview_binding_mismatch");

  // ── scope bindings ──
  if (envelope.mission_id !== corridorContext.mission_id) return refuse("mission_binding_mismatch");
  if (envelope.contract_hash !== corridorContext.contract_hash) return refuse("contract_binding_mismatch");
  if (envelope.mission_root !== corridorContext.mission_root) return refuse("mission_root_binding_mismatch");
  if (effect.sandbox_root !== envelope.mission_root) return refuse("mission_root_binding_mismatch");
  if (envelope.nonce !== corridorContext.nonce) return refuse("consent_nonce_binding_mismatch");
  if (!repositoryBinding || repositoryBinding.ok !== true) return refuse("repository_binding_required");
  if (
    envelope.repository_commit !== repositoryBinding.commit ||
    envelope.repository_tree !== repositoryBinding.tree
  ) {
    return refuse("repository_binding_mismatch");
  }

  // ── validity window ──
  const expiresMs = Date.parse(envelope.expires_at);
  const nowMs = Date.parse(now);
  if (Number.isNaN(expiresMs) || Number.isNaN(nowMs)) return refuse("authority_time_malformed");
  if (nowMs >= expiresMs) return refuse("authority_expired");

  // ── AUTHORITY BEFORE ACT — the nonce is spent before the executor exists ──
  const claim = await claimNonce({ nonce: envelope.nonce });
  if (!claim || claim.claimed !== true) {
    return refuse(claim?.reason ?? "consent_nonce_not_claimed");
  }

  // ── delegate, with the inner phrase composed here and never from the caller ──
  const execution = await executeJob({
    sandboxRoot: envelope.mission_root,
    atoms: effect.atoms,
    consent: DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE,
    now,
  });

  return Object.freeze({
    ok: execution?.ok === true,
    reason: execution?.ok === true ? null : "execution_blocked",
    executed_count: execution?.executed_count ?? 0,
    authority: envelope,
    execution,
    authority_delta: 0,
  });
}
