// CORE-FLYWHEEL-RUN-PROOF · composes a Block0 full_flywheel_run_receipt_hash from
// REAL, verifiable flywheel phase receipts.
//
// Founder ruling (2026-06-02): "full flywheel run" for Block0 = the IMPLEMENTED
// core loop, with TRANSPARENT coverage — truth_label CORE_FLYWHEEL_RUN, the
// receipt body explicitly lists phases_covered + phases_excluded. This is NOT a
// claim that every aspirational lifecycle phase ran; it is an honest, content-
// addressed composition of the phase receipts a real run actually produced.
//
// Mandatory spine: the action+score phase (the runOneTaskFlywheel chained
// receipt — the genuinely implemented core). Optional, composed when supplied
// from a real run: sat_validation, xp. Phases with no real producer today
// (mission_select = PREVIEW, next_mission = NOT_IMPLEMENTED) are recorded as
// excluded — never fabricated.
//
// Pure-with-key-load: signs the run receipt; no network, no clock (created_at_iso
// injected). Verification trusts ONLY the external pubkey.

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const CORE_FLYWHEEL_RUN_SCHEMA =
  "bizra.dema.core_flywheel_run_receipt.v0.1";

// The mandatory spine phase + the phases honestly excluded today (no producer).
const SPINE_PHASE = "action_score";
const OPTIONAL_PHASES = Object.freeze(["sat_validation", "xp"]);
const EXCLUDED_PHASES = Object.freeze([
  Object.freeze({ phase: "mission_select", reason: "PREVIEW_ONLY" }),
  Object.freeze({ phase: "next_mission", reason: "NOT_IMPLEMENTED" }),
]);

function ed25519FingerprintFromPem(pubkeyPem) {
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return { error: "external_pubkey_required" };
  }
  let pk;
  try {
    pk = createPublicKey(pubkeyPem);
  } catch {
    return { error: "external_pubkey_required" };
  }
  if (pk.asymmetricKeyType !== "ed25519") {
    return { error: "operator_key_not_ed25519" };
  }
  return {
    fingerprint: sha256(
      pk.export({ type: "spki", format: "der" }).toString("hex"),
    ),
  };
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}
function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(error) {
  return Object.freeze({
    schema: CORE_FLYWHEEL_RUN_SCHEMA,
    built: false,
    truth_label: "LOCAL_CORE_FLYWHEEL_RUN_REFUSED",
    error,
  });
}
function reject(reason) {
  return Object.freeze({ verified: false, reason });
}

// Extract the content-address of a phase receipt (different phases name it
// differently: one-task uses receipt_id, sat/xp use *_hash / receipt_hash).
function phaseHash(receipt) {
  if (!isPlainObject(receipt)) return null;
  const h =
    receipt.receipt_id ||
    receipt.receipt_hash ||
    receipt.entry_hash ||
    receipt.flywheel_receipt?.receipt_id;
  return isSha256Hex(h) ? h : null;
}

/**
 * Build a core flywheel run receipt from real phase receipts. Pure-with-key-load.
 *
 * @param {object} phases - { action_score: <one-task flywheel receipt> (required),
 *   sat_validation?: <receipt>, xp?: <receipt> }. Only real, content-addressable
 *   receipts are composed; absent optional phases are recorded as excluded.
 */
export async function buildCoreFlywheelRunReceipt({
  phases,
  demaHome,
  createdAtIso,
} = {}) {
  if (
    !isNonEmptyString(createdAtIso) ||
    Number.isNaN(Date.parse(createdAtIso))
  ) {
    return fail("created_at_iso_required");
  }
  if (!isPlainObject(phases)) return fail("phases_required");

  // Mandatory spine: a real action+score (one-task) receipt with a content hash.
  const spineHash = phaseHash(phases[SPINE_PHASE]);
  if (!spineHash) return fail("spine_phase_missing_or_malformed");

  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;
  if (!privateKeyPem || !publicKeyPem) return fail("no_authorship_key");
  const fp = ed25519FingerprintFromPem(publicKeyPem);
  if (fp.error) return fail(fp.error);

  const phase_receipt_hashes = { [SPINE_PHASE]: spineHash };
  const phases_covered = [SPINE_PHASE];
  const phases_excluded = [...EXCLUDED_PHASES.map((e) => ({ ...e }))];

  for (const opt of OPTIONAL_PHASES) {
    if (phases[opt] === undefined) {
      phases_excluded.push({ phase: opt, reason: "NOT_SUPPLIED_THIS_RUN" });
      continue;
    }
    const h = phaseHash(phases[opt]);
    if (!h) return fail(`phase_malformed_${opt}`);
    phase_receipt_hashes[opt] = h;
    phases_covered.push(opt);
  }

  const body = {
    schema: CORE_FLYWHEEL_RUN_SCHEMA,
    truth_label: "CORE_FLYWHEEL_RUN",
    phases_covered,
    phases_excluded,
    phase_receipt_hashes,
    operator_public_key_fingerprint: fp.fingerprint,
    created_at_iso: createdAtIso,
  };
  const full_flywheel_run_receipt_hash = sha256(stableStringify(body));
  const core_flywheel_run_signature_b64 = signPayload(body, privateKeyPem);

  return Object.freeze({
    schema: CORE_FLYWHEEL_RUN_SCHEMA,
    built: true,
    truth_label: "CORE_FLYWHEEL_RUN",
    full_flywheel_run_receipt_hash,
    proof: Object.freeze({
      ...body,
      phases_covered: Object.freeze([...phases_covered]),
      phases_excluded: Object.freeze(
        phases_excluded.map((e) => Object.freeze(e)),
      ),
      phase_receipt_hashes: Object.freeze({ ...phase_receipt_hashes }),
      core_flywheel_run_signature_b64,
      full_flywheel_run_receipt_hash,
    }),
    what_this_proves: Object.freeze([
      "A real, content-addressed composition of the implemented core flywheel phases (action+score, plus any supplied sat_validation/xp).",
    ]),
    what_this_does_not_prove: Object.freeze([
      "NOT a full §19 lifecycle: mission_select is PREVIEW-only and next_mission is NOT_IMPLEMENTED — see phases_excluded.",
    ]),
  });
}

/**
 * Verify a core flywheel run receipt under the EXTERNAL operator pubkey. Pure.
 * Live only when signed AND the mandatory spine phase is covered.
 */
export function verifyCoreFlywheelRunReceipt({
  proof,
  operatorPubkeyPem,
} = {}) {
  if (!isPlainObject(proof)) return reject("proof_missing_or_malformed");
  if (proof.schema !== CORE_FLYWHEEL_RUN_SCHEMA) {
    return reject("proof_schema_mismatch");
  }
  if (
    typeof operatorPubkeyPem !== "string" ||
    !operatorPubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  const REQUIRED = [
    "truth_label",
    "phases_covered",
    "phases_excluded",
    "phase_receipt_hashes",
    "operator_public_key_fingerprint",
    "created_at_iso",
    "core_flywheel_run_signature_b64",
    "full_flywheel_run_receipt_hash",
  ];
  for (const f of REQUIRED) {
    if (proof[f] === undefined || proof[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (Object.keys(proof).length !== REQUIRED.length + 1 /* schema */) {
    return reject("proof_unexpected_field");
  }
  if (!isSha256Hex(proof.full_flywheel_run_receipt_hash)) {
    return reject("full_flywheel_run_receipt_hash_invalid");
  }
  if (
    !Array.isArray(proof.phases_covered) ||
    !isPlainObject(proof.phase_receipt_hashes)
  ) {
    return reject("phases_invalid");
  }
  if (!proof.phases_covered.includes(SPINE_PHASE)) {
    return reject("spine_phase_not_covered");
  }
  // every covered phase must carry a content hash
  for (const p of proof.phases_covered) {
    if (!isSha256Hex(proof.phase_receipt_hashes[p])) {
      return reject(`phase_hash_invalid_${p}`);
    }
  }

  const fp = ed25519FingerprintFromPem(operatorPubkeyPem);
  if (fp.error) return reject(fp.error);
  if (proof.operator_public_key_fingerprint !== fp.fingerprint) {
    return reject("operator_key_mismatch");
  }

  const {
    core_flywheel_run_signature_b64,
    full_flywheel_run_receipt_hash,
    ...body
  } = proof;
  if (sha256(stableStringify(body)) !== full_flywheel_run_receipt_hash) {
    return reject("full_flywheel_run_receipt_hash_mismatch");
  }
  let ok;
  try {
    ok = verifyPayload(
      body,
      core_flywheel_run_signature_b64,
      operatorPubkeyPem,
    );
  } catch {
    return reject("signature_invalid");
  }
  if (!ok) return reject("signature_invalid");

  return Object.freeze({
    verified: true,
    full_flywheel_run_receipt_hash,
    phases_covered: Object.freeze([...proof.phases_covered]),
  });
}
