// AGENT-SKILL-1A · Skill ledger + XP progression kernel.
//
// Third sibling slice to AGENT-PROFILE-1A + AGENT-WALLET-1A. Turns
// "agent has skills" from a decorative claim into a signed, content-
// addressed envelope binding every XP grant to BOTH:
//
//   (a) an impact receipt produced by verified useful work, AND
//   (b) a SAT validation produced by a DIFFERENT agent.
//
// Direct implementation of operator-PDF §11 load-bearing rules:
//   - No XP without proof.                  → xp_without_proof
//   - No reward without verified impact.    → reward_without_validation
//   - No self-verification.                 → self_verification_attempted
//   - No self-minting.                      → self_minting_attempted
//   - SAT must validate reward eligibility. → SAT validation hash required
//   - Skills require repeated verified performance.
//   - Levels summarize proof, not vibes.
//
// Reuses (no duplication):
//   - signPayload, verifyPayload         packages/receipts/src/authorship-signature.js
//   - loadActiveKeyPair      packages/receipts/src/authorship-key-store.js
//   - verifyConsentProof                 packages/receipts/src/consent-proof.js
//   - sha256, stableStringify            packages/consent/src/consent-common.js
//
// Schema: bizra.dema.agent_skill_ledger.v0.1
//
// Scope (this slice — per AGENT_PROFILE_0_PREFLIGHT.md §10 AGENT-SKILL-1A
// + task contract):
//   - Pure kernel function with disk-bound key load + KEYCONSENT-1A
//     consent_proof verification.
//   - No file write. No CLI. No transfer/pay/settle surface.
//   - No agent compensation, no payment, no fiat, no external transfer.
//   - Output is deep-frozen.
//   - Failure shape mirrors agent-wallet: { built:false, error }.

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const AGENT_SKILL_LEDGER_SCHEMA = "bizra.dema.agent_skill_ledger.v0.1";
// Reuses the MUTATE_AGENT_PROFILE consent action_type — a skill ledger
// update is logically a profile-state mutation (PDF §11 framing: levels
// summarize proof). Keeps the consent surface single-typed.
export const MUTATE_AGENT_SKILL_LEDGER_ACTION_TYPE = "MUTATE_AGENT_PROFILE";

const REQUIRED_FIELDS = Object.freeze([
  "schema",
  "ledger_id",
  "agent_id",
  "skill_grants",
  "skill_balances",
  "xp_total",
  "prev_hash",
  "created_at_iso",
  "operator_public_key_fingerprint",
  "ledger_signature_b64",
  "ledger_proof_hash",
]);

function fail(error) {
  return Object.freeze({ built: false, error });
}

function reject(reason) {
  return Object.freeze({ verified: false, rejected: true, reason });
}

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  const der = pk.export({ type: "spki", format: "der" });
  return sha256(der.toString("hex"));
}

function isInteger(n) {
  return typeof n === "number" && Number.isFinite(n) && Number.isInteger(n);
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}

// Validate each grant against PDF §11 + task contract reject reasons.
// Returns { ok:true } or { ok:false, error }.
function validateGrantStructural(g) {
  if (!g || typeof g !== "object" || Array.isArray(g)) {
    return { ok: false, error: "grant_malformed" };
  }
  if (!isNonEmptyString(g.skill_id)) {
    return { ok: false, error: "grant_malformed" };
  }
  // PDF §11 "No XP without proof" — evidence_impact_receipt_hash REQUIRED.
  if (!isSha256Hex(g.evidence_impact_receipt_hash)) {
    return { ok: false, error: "xp_without_proof" };
  }
  // PDF §11 "No reward without verified impact" — sat_validation REQUIRED.
  if (!isSha256Hex(g.sat_validation_receipt_hash)) {
    return { ok: false, error: "reward_without_validation" };
  }
  if (!isInteger(g.xp_amount)) {
    return { ok: false, error: "grant_malformed" };
  }
  // PDF §11 implicit: "Levels summarize proof, not vibes" — XP debits
  // are out of scope for AGENT-SKILL-1A. Only non-negative grants.
  if (g.xp_amount < 0) {
    return { ok: false, error: "xp_amount_negative" };
  }
  return { ok: true };
}

// Aggregate xp_total + skill_balances from grants. Pure; deterministic.
// Returns { xp_total, skill_balances }. Skill balances key order does
// not matter — stableStringify sorts on hash. We surface as a plain
// object; freezing happens at envelope-build time.
function aggregateGrants(grants) {
  let xp_total = 0;
  const balances = {};
  for (const g of grants) {
    xp_total += g.xp_amount;
    balances[g.skill_id] = (balances[g.skill_id] || 0) + g.xp_amount;
  }
  return { xp_total, skill_balances: balances };
}

// Normalize each grant to a frozen object with the canonical 4-field
// shape — strips any extra caller-supplied keys so the signed body is
// minimal and deterministic.
function normalizeGrants(grants) {
  return grants.map((g) =>
    Object.freeze({
      skill_id: g.skill_id,
      xp_amount: g.xp_amount,
      evidence_impact_receipt_hash: g.evidence_impact_receipt_hash,
      sat_validation_receipt_hash: g.sat_validation_receipt_hash,
    }),
  );
}

// Build the canonical ledger body the kernel signs and hashes. Field
// order is irrelevant for the hash (stableStringify sorts keys), but
// the SHAPE must be identical between buildSkillLedger (when shaping
// for consent target_hash) and the eventual signed body. Excludes
// ledger_id, ledger_signature_b64, ledger_proof_hash by construction.
function buildLedgerBody({
  agent_id,
  skill_grants,
  skill_balances,
  xp_total,
  prev_hash,
  created_at_iso,
  operator_public_key_fingerprint,
}) {
  return {
    schema: AGENT_SKILL_LEDGER_SCHEMA,
    agent_id,
    skill_grants,
    skill_balances,
    xp_total,
    prev_hash,
    created_at_iso,
    operator_public_key_fingerprint,
  };
}

// ── buildSkillLedger (kernel) ─────────────────────────────────────────
//
// Fail-closed gates, in order:
//   (1) consent_proof_required        — missing consent envelope
//   (2) agent_id_invalid              — empty / non-string agent_id
//   (3) skill_grants_invalid          — not an array
//   (4) per-grant structural          — xp_without_proof /
//                                       reward_without_validation /
//                                       xp_amount_negative /
//                                       grant_malformed
//   (5) no_authorship_key             — no operator key on disk
//   (6) consent verification          — KEYCONSENT-1A verify against
//                                       projected body target_hash.
//
// On success: signs the body, computes content-address, returns a deeply
// frozen envelope of shape:
//   { built:true, ledger, signer_public_key_pem }
// where `ledger` = body ∪ { ledger_id, ledger_signature_b64,
// ledger_proof_hash }.

export async function buildSkillLedger({
  agent_id,
  skill_grants,
  consentProof,
  demaHome,
  createdAtIso,
}) {
  // (1) Consent proof mandatory.
  if (!consentProof || typeof consentProof !== "object") {
    return fail("consent_proof_required");
  }

  // (2) agent_id structural.
  if (!isNonEmptyString(agent_id)) {
    return fail("agent_id_invalid");
  }

  // (3) skill_grants must be an array (possibly empty).
  if (!Array.isArray(skill_grants)) {
    return fail("skill_grants_invalid");
  }

  // (4) Per-grant structural validation. PDF §11 catches surface here
  // in detection order: xp_without_proof → reward_without_validation →
  // xp_amount_negative. First-failure-wins so caller sees the most
  // load-bearing reason.
  for (const g of skill_grants) {
    const v = validateGrantStructural(g);
    if (!v.ok) {
      return fail(v.error);
    }
  }

  // Normalize + aggregate.
  const grants = normalizeGrants(skill_grants);
  const { xp_total, skill_balances } = aggregateGrants(grants);

  // (5) Load operator key.
  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  if (!privateKeyPem) {
    return fail("no_authorship_key");
  }
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;
  if (!publicKeyPem) {
    return fail("no_authorship_key");
  }
  const fingerprint = fingerprintFromPem(publicKeyPem);

  const created_at_iso = createdAtIso || new Date().toISOString();
  // Ledger chain prev_hash: this kernel slice does not chain ledgers
  // (each build is the v0.1 snapshot for a given agent_id). Default to
  // genesis. Ledger-chain semantics belong to a future slice.
  const prev_hash = "0".repeat(64);

  const projectedBody = buildLedgerBody({
    agent_id,
    skill_grants: grants,
    skill_balances,
    xp_total,
    prev_hash,
    created_at_iso,
    operator_public_key_fingerprint: fingerprint,
  });
  const target_hash = sha256(stableStringify(projectedBody));

  // (6) Verify consent proof — external pubkey only.
  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: MUTATE_AGENT_SKILL_LEDGER_ACTION_TYPE,
      target_hash,
    },
    // Check consent freshness as of the act's own timestamp (deterministic),
    // not whenever the verifier runs (wall-clock → flaky). Matches block0.
    now: createdAtIso || new Date().toISOString(),
  });
  if (!consentVerify.verified) {
    if (consentVerify.reason === "consent_scope_mismatch") {
      return fail("consent_scope_mismatch");
    }
    return fail(`consent_proof_${consentVerify.reason}`);
  }

  // Sign + content-address.
  const signature = signPayload(projectedBody, privateKeyPem);
  const ledger_proof_hash = sha256(stableStringify(projectedBody));
  // ledger_id is derived from (agent_id, proof_hash prefix) — caller
  // can index ledgers by this string. Stays inside the envelope so
  // verifiers can replay it.
  const ledger_id = `skillledger.${agent_id}.${ledger_proof_hash.slice(0, 16)}`;

  // Build the frozen envelope. Freeze nested structures defensively so
  // post-build mutation attempts cannot reshape the signed body.
  const ledger = Object.freeze({
    ...projectedBody,
    skill_grants: Object.freeze([...grants]),
    skill_balances: Object.freeze({ ...skill_balances }),
    ledger_id,
    ledger_signature_b64: signature,
    ledger_proof_hash,
  });

  return Object.freeze({
    built: true,
    ledger,
    signer_public_key_pem: publicKeyPem,
  });
}

// ── verifySkillLedger (permissionless verifier) ───────────────────────
//
// Stranger holds (ledger, impactReceipts, satValidations, external
// pubkeyPem). Verifier order (first-failure-wins):
//
//   1. Structural validation         — schema / required fields / pubkey
//   2. Per-grant structural          — xp_without_proof /
//                                      reward_without_validation /
//                                      xp_amount_negative
//   3. Aggregation                   — xp_total matches sum of
//                                      xp_amounts; skill_balances match
//                                      per-skill aggregation
//   4. Reference resolution          — each grant's evidence_impact and
//                                      sat_validation hashes appear in
//                                      the supplied arrays
//   5. No-self-verification gate     — SAT validator_agent_id ≠ ledger
//                                      agent_id (PDF §11)
//   6. No-self-minting gate          — impact receipt's agent_id == ledger
//                                      agent_id AND no counterparty
//                                      signer → self_minting_attempted
//   7. Content-address               — recompute ledger_proof_hash from
//                                      the body excluding ledger_id +
//                                      signature + proof_hash
//   8. Signature                     — verify Ed25519 using external
//                                      pubkey only
//
// Reject reasons (in detection order):
//   - agent_skill_ledger_missing_or_malformed
//   - agent_skill_ledger_schema_mismatch
//   - structural_missing_field_<name>
//   - external_pubkey_required
//   - xp_without_proof / reward_without_validation / xp_amount_negative
//   - xp_total_mismatch / skill_balance_mismatch
//   - impact_receipt_missing / sat_validation_missing
//   - self_verification_attempted
//   - self_minting_attempted
//   - ledger_proof_hash_mismatch
//   - signature_invalid

export function verifySkillLedger({
  ledger,
  impactReceipts,
  satValidations,
  pubkeyPem,
}) {
  // (1) Structural validation.
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) {
    return reject("agent_skill_ledger_missing_or_malformed");
  }
  if (ledger.schema !== AGENT_SKILL_LEDGER_SCHEMA) {
    return reject("agent_skill_ledger_schema_mismatch");
  }
  for (const f of REQUIRED_FIELDS) {
    if (ledger[f] === undefined || ledger[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  if (!Array.isArray(ledger.skill_grants)) {
    return reject("structural_missing_field_skill_grants");
  }
  if (
    typeof ledger.skill_balances !== "object" ||
    Array.isArray(ledger.skill_balances) ||
    ledger.skill_balances === null
  ) {
    return reject("structural_missing_field_skill_balances");
  }
  if (!Array.isArray(impactReceipts)) {
    return reject("impact_receipts_invalid");
  }
  if (!Array.isArray(satValidations)) {
    return reject("sat_validations_invalid");
  }

  // (2) Per-grant structural validation — same reject names as build.
  for (const g of ledger.skill_grants) {
    const v = validateGrantStructural(g);
    if (!v.ok) {
      return reject(v.error);
    }
  }

  // (3) Aggregation: xp_total + per-skill balance.
  const recomputed = aggregateGrants(ledger.skill_grants);
  if (recomputed.xp_total !== ledger.xp_total) {
    return reject("xp_total_mismatch");
  }
  // Compare balances key-set + values.
  const declaredKeys = Object.keys(ledger.skill_balances).sort();
  const recomputedKeys = Object.keys(recomputed.skill_balances).sort();
  if (declaredKeys.length !== recomputedKeys.length) {
    return reject("skill_balance_mismatch");
  }
  for (let i = 0; i < declaredKeys.length; i++) {
    if (declaredKeys[i] !== recomputedKeys[i]) {
      return reject("skill_balance_mismatch");
    }
  }
  for (const k of declaredKeys) {
    if (ledger.skill_balances[k] !== recomputed.skill_balances[k]) {
      return reject("skill_balance_mismatch");
    }
  }

  // (4)+(5)+(6) Reference resolution + self-verification + self-minting.
  // Index the supplied arrays once by receipt_hash for O(1) lookup.
  const impactIndex = new Map();
  for (const r of impactReceipts) {
    if (
      r &&
      typeof r === "object" &&
      typeof r.receipt_hash === "string" &&
      r.receipt_hash.length > 0
    ) {
      impactIndex.set(r.receipt_hash, r);
    }
  }
  const satIndex = new Map();
  for (const r of satValidations) {
    if (
      r &&
      typeof r === "object" &&
      typeof r.receipt_hash === "string" &&
      r.receipt_hash.length > 0
    ) {
      satIndex.set(r.receipt_hash, r);
    }
  }

  for (const g of ledger.skill_grants) {
    const impact = impactIndex.get(g.evidence_impact_receipt_hash);
    if (!impact) {
      return reject("impact_receipt_missing");
    }
    const sat = satIndex.get(g.sat_validation_receipt_hash);
    if (!sat) {
      return reject("sat_validation_missing");
    }
    // (5) PDF §11 "No self-verification." A SAT validation signed by
    // the same agent claiming the skill is rejected — the validator
    // must be a different agent.
    if (
      typeof sat.validator_agent_id === "string" &&
      sat.validator_agent_id === ledger.agent_id
    ) {
      return reject("self_verification_attempted");
    }
    // (6) PDF §11 "No self-minting." An impact receipt whose agent_id
    // is the same as this ledger's agent_id AND has no counterparty
    // signer is a self-minted work claim — rejected. (If a counterparty
    // signed it, the work has another-party witness and minting is OK.)
    if (
      typeof impact.agent_id === "string" &&
      impact.agent_id === ledger.agent_id &&
      !isNonEmptyString(impact.counterparty_signer_agent_id)
    ) {
      return reject("self_minting_attempted");
    }
  }

  // (7) Content-address: recompute proof_hash from the canonical body
  // (excludes ledger_id since ledger_id is derived from the proof_hash —
  // including it would create a circular dependency). The signed body
  // is the buildLedgerBody projection, NOT the whole ledger record.
  const stableBody = buildLedgerBody({
    agent_id: ledger.agent_id,
    skill_grants: ledger.skill_grants,
    skill_balances: ledger.skill_balances,
    xp_total: ledger.xp_total,
    prev_hash: ledger.prev_hash,
    created_at_iso: ledger.created_at_iso,
    operator_public_key_fingerprint: ledger.operator_public_key_fingerprint,
  });
  const recomputedHash = sha256(stableStringify(stableBody));
  if (recomputedHash !== ledger.ledger_proof_hash) {
    return reject("ledger_proof_hash_mismatch");
  }

  // (8) Signature: verify Ed25519 using ONLY external pubkey.
  let sigValid;
  try {
    sigValid = verifyPayload(
      stableBody,
      ledger.ledger_signature_b64,
      pubkeyPem,
    );
  } catch {
    sigValid = false;
  }
  if (!sigValid) {
    return reject("signature_invalid");
  }

  return Object.freeze({
    verified: true,
    ledger_id: ledger.ledger_id,
    ledger_proof_hash: ledger.ledger_proof_hash,
    agent_id: ledger.agent_id,
    xp_total: ledger.xp_total,
    skill_balances: Object.freeze({ ...ledger.skill_balances }),
  });
}
