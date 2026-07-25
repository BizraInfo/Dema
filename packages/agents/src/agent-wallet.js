// AGENT-WALLET-1A · Per-agent local wallet kernel.
//
// Sibling slice to AGENT-PROFILE-1A — wallets are 1:1 with profiles.
// Binds one agent_id to balances recomputed from a referenced subset of
// the ECON-1A dual-token ledger. Local-only, signed by the operator's
// Ed25519 key, verifiable by anyone holding the operator's external
// pubkey. No transfer surface. No agent-to-agent payment. No external
// chain. No federation. No CLI.
//
// Reuses (no duplication):
//   - signPayload, verifyPayload         packages/receipts/src/authorship-signature.js
//   - loadActiveKeyPair      packages/receipts/src/authorship-key-store.js
//   - verifyConsentProof                 packages/receipts/src/consent-proof.js
//   - sha256, stableStringify            packages/consent/src/consent-common.js
//
// Spec reference: docs/security/AGENT_PROFILE_0_PREFLIGHT.md §10 (AGENT-
// WALLET-1A) re-scoped for the task contract.
//
// Schema: bizra.dema.agent_wallet.v0.1
//
// Token economy (ECON-0 + PDF §9):
//   - RESOURCE_CREDIT  → resource_balance += amount
//   - RESOURCE_DEBIT   → resource_balance -= amount
//   - IMPACT_CREDIT    → impact_balance   += amount
//   - IMPACT tokens cannot be spent (no IMPACT_DEBIT exists in ECON-1A).
//     A wallet whose declared impact_balance is < 0 is fail-closed with
//     no_payment_to_human — impact tokens never flow back to a human in
//     this slice.
//
// Scope (this slice — per preflight §10 + task contract):
//   - Pure kernel function with disk-bound key load + KEYCONSENT-1A
//     consent_proof verification.
//   - No file write. No CLI. No transfer/pay/settle surface (the module
//     deliberately exports NO such function — preflight §10 invariant).
//   - No public economic claim. No exchange value. No external chain.
//   - Output is deep-frozen.
//   - Failure shape mirrors agent-profile-registry: { built:false, error }.

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

export const AGENT_WALLET_SCHEMA = "bizra.dema.agent_wallet.v0.1";
export const MUTATE_AGENT_WALLET_ACTION_TYPE = "MUTATE_AGENT_PROFILE";

const REQUIRED_FIELDS = Object.freeze([
  "schema",
  "wallet_id",
  "agent_id",
  "resource_balance",
  "impact_balance",
  "ledger_entries_referenced",
  "prev_hash",
  "created_at_iso",
  "operator_public_key_fingerprint",
  "wallet_signature_b64",
  "wallet_proof_hash",
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

// Recompute balances from the supplied ledger entries (only those whose
// entry_hash appears in `referenced`). Returns:
//   { ok:true, resource, impact, missingHash? }
// or { ok:false, reason:"ledger_entry_missing", missingHash }
//   or { ok:false, reason:"ledger_entry_agent_mismatch", entryHash }
//
// Per ECON-1A semantics:
//   - RESOURCE_CREDIT  → resource +=  amount
//   - RESOURCE_DEBIT   → resource -=  amount
//   - IMPACT_CREDIT    → impact   +=  amount
//   (IMPACT_DEBIT does not exist; impact tokens never flow out)
//
// agent_id binding: each referenced ledger entry MAY carry an agent_id
// field (current ECON-1A entries do not, but downstream slices may
// extend). If an entry carries agent_id and it does NOT match the
// wallet's agent_id, fail-closed. Absence of agent_id passes (the
// wallet's binding is the wallet's signed envelope, not the entry's).
function recomputeBalances({ referenced, ledgerEntries, walletAgentId }) {
  // Index supplied entries by their content-addressed entry_hash.
  const index = new Map();
  for (const e of ledgerEntries) {
    if (
      e &&
      typeof e === "object" &&
      typeof e.entry_hash === "string" &&
      e.entry_hash.length > 0
    ) {
      index.set(e.entry_hash, e);
    }
  }
  let resource = 0;
  let impact = 0;
  for (const refHash of referenced) {
    const entry = index.get(refHash);
    if (!entry) {
      return {
        ok: false,
        reason: "ledger_entry_missing",
        missingHash: refHash,
      };
    }
    // Optional agent_id binding (forward-compat with downstream ECON
    // slices that may add per-entry agent_id).
    if (
      typeof entry.agent_id === "string" &&
      entry.agent_id.length > 0 &&
      entry.agent_id !== walletAgentId
    ) {
      return {
        ok: false,
        reason: "ledger_entry_agent_mismatch",
        entryHash: refHash,
      };
    }
    const t = entry.entry_type;
    const amt = entry.amount;
    if (!isInteger(amt) || amt < 0) {
      // Defensive: refuse to recompute against malformed entries. Surface
      // as missing — the caller's contract is "entries verified by
      // ECON-1A"; anything else is treated as not-found.
      return {
        ok: false,
        reason: "ledger_entry_missing",
        missingHash: refHash,
      };
    }
    if (t === "RESOURCE_CREDIT") {
      resource += amt;
    } else if (t === "RESOURCE_DEBIT") {
      resource -= amt;
    } else if (t === "IMPACT_CREDIT") {
      impact += amt;
    }
    // Unknown entry_type: ignored (no contribution). Defensive but does
    // not fail-closed — invariant is the BALANCE match, not entry-type
    // exhaustiveness (that's ECON-1A's job).
  }
  return { ok: true, resource, impact };
}

// Build the canonical wallet body the kernel signs and hashes. Field
// order is irrelevant for the hash (stableStringify sorts keys) but the
// SHAPE must be identical between buildAgentWallet (when shaping for
// consent target_hash) and the eventual signed body. The body excludes
// wallet_signature_b64 and wallet_proof_hash by construction.
function buildWalletBody({
  schema,
  agent_id,
  resource_balance,
  impact_balance,
  ledger_entries_referenced,
  prev_hash,
  created_at_iso,
  operator_public_key_fingerprint,
}) {
  return {
    schema,
    agent_id,
    resource_balance,
    impact_balance,
    ledger_entries_referenced,
    prev_hash,
    created_at_iso,
    operator_public_key_fingerprint,
  };
}

// ── buildAgentWallet (kernel) ─────────────────────────────────────────
//
// Fail-closed gates, in order:
//   (1) consent_proof_required        — missing consent envelope
//   (2) no_payment_to_human           — declared impact_balance < 0
//   (3) structural validation         — agent_id / balances / referenced
//   (4) no_authorship_key             — no operator key on disk
//   (5) ledger_entry_missing /
//       ledger_entry_agent_mismatch   — recompute against ledgerEntries
//   (6) resource_balance_mismatch /
//       impact_balance_mismatch       — declared ≠ recomputed
//   (7) consent verification          — KEYCONSENT-1A verify with the
//       operator's pubkey + expectedActionScope = MUTATE_AGENT_PROFILE,
//       target_hash = sha256(stableStringify(projected wallet body)).
//
// On success: signs the body, computes content-address, returns a deeply
// frozen envelope of shape:
//   { built:true, wallet, signer_public_key_pem }
// where `wallet` = body ∪ { wallet_id, wallet_signature_b64, wallet_proof_hash }.

export async function buildAgentWallet({
  agent_id,
  resource_balance,
  impact_balance,
  ledger_entries = [],
  consentProof,
  demaHome,
  createdAtIso,
}) {
  // (1) Consent proof mandatory.
  if (!consentProof || typeof consentProof !== "object") {
    return fail("consent_proof_required");
  }

  // (2) Impact never flows out (PDF §9). Declared impact_balance < 0 is
  // a fail-closed signal that the caller is trying to model a payout to
  // a human; this slice refuses such a wallet outright.
  if (!isInteger(impact_balance)) {
    return fail("impact_balance_invalid");
  }
  if (impact_balance < 0) {
    return fail("no_payment_to_human");
  }

  // (3) Structural validation.
  if (typeof agent_id !== "string" || agent_id.length === 0) {
    return fail("agent_id_invalid");
  }
  if (!isInteger(resource_balance)) {
    return fail("resource_balance_invalid");
  }
  if (!Array.isArray(ledger_entries)) {
    return fail("ledger_entries_invalid");
  }
  // Derive the referenced-hash list from the supplied entries in order.
  // (Caller passes entries; the wallet commits to their entry_hashes in
  // the order supplied. Order matters for the signed body — order changes
  // re-shape the projected body and break consent target_hash binding.)
  const ledger_entries_referenced = [];
  for (const e of ledger_entries) {
    if (
      !e ||
      typeof e !== "object" ||
      typeof e.entry_hash !== "string" ||
      !isSha256Hex(e.entry_hash)
    ) {
      return fail("ledger_entry_hash_invalid");
    }
    ledger_entries_referenced.push(e.entry_hash);
  }

  // (4) Load operator key.
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

  // (5) Recompute balances from the supplied ledger and verify ledger
  // references resolve + per-entry agent_id (if present) matches.
  const recomputed = recomputeBalances({
    referenced: ledger_entries_referenced,
    ledgerEntries: ledger_entries,
    walletAgentId: agent_id,
  });
  if (!recomputed.ok) {
    return fail(recomputed.reason);
  }

  // (6) Declared totals MUST agree with recomputed totals — the kernel
  // refuses to sign a wallet whose declared balances disagree with the
  // ledger it references.
  if (resource_balance !== recomputed.resource) {
    return fail("resource_balance_mismatch");
  }
  if (impact_balance !== recomputed.impact) {
    return fail("impact_balance_mismatch");
  }

  // Resolve created_at_iso BEFORE projecting the body so target_hash is
  // stable between consent (built by caller) and projection (here).
  const created_at_iso = createdAtIso || new Date().toISOString();
  // Wallet chain prev_hash: this kernel slice does not chain wallets
  // (each build is the v0.1 snapshot for a given agent_id). Default to
  // genesis (64 zeros). Wallet-chain semantics belong to a future slice.
  const prev_hash = "0".repeat(64);

  const projectedBody = buildWalletBody({
    schema: AGENT_WALLET_SCHEMA,
    agent_id,
    resource_balance,
    impact_balance,
    ledger_entries_referenced: Object.freeze([...ledger_entries_referenced]),
    prev_hash,
    created_at_iso,
    operator_public_key_fingerprint: fingerprint,
  });
  const target_hash = sha256(stableStringify(projectedBody));

  // (7) Verify consent proof — external pubkey only; embedded
  // fingerprint is informational (KEYCONSENT-1A trust invariant).
  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: publicKeyPem,
    expectedActionScope: {
      action_type: MUTATE_AGENT_WALLET_ACTION_TYPE,
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
  const wallet_proof_hash = sha256(stableStringify(projectedBody));
  // wallet_id is derived from the (agent_id, stable wallet_proof_hash)
  // pair — caller can index wallets by this string. Stays inside the
  // envelope so verifiers can replay it.
  const wallet_id = `wallet.${agent_id}.${wallet_proof_hash.slice(0, 16)}`;

  const wallet = Object.freeze({
    ...projectedBody,
    ledger_entries_referenced: Object.freeze([
      ...projectedBody.ledger_entries_referenced,
    ]),
    wallet_id,
    wallet_signature_b64: signature,
    wallet_proof_hash,
  });

  return Object.freeze({
    built: true,
    wallet,
    signer_public_key_pem: publicKeyPem,
  });
}

// ── verifyAgentWallet (permissionless verifier) ───────────────────────
//
// Stranger holds (wallet, ledgerEntries supplied alongside, external
// pubkeyPem). Verifier order:
//
//   1. Structural validation         — schema / required fields / pubkey
//   2. No-payment-to-human gate      — impact_balance ≥ 0
//   3. Ledger reference resolution   — each referenced entry_hash must
//      appear in ledgerEntries; per-entry agent_id (if present) must
//      match wallet.agent_id
//   4. Balance recomputation         — resource_balance == Σ deltas;
//      impact_balance == Σ credits
//   5. Content-address               — recompute wallet_proof_hash from
//      the body excluding signature + proof_hash fields
//   6. Signature                     — verify Ed25519 using external
//      pubkey only (embedded fingerprint is informational)
//
// Reject reasons (in detection order):
//   - agent_wallet_missing_or_malformed / agent_wallet_schema_mismatch
//   - structural_missing_field_<name> / external_pubkey_required
//   - no_payment_to_human
//   - ledger_entry_missing / ledger_entry_agent_mismatch
//   - resource_balance_mismatch / impact_balance_mismatch
//   - wallet_proof_hash_mismatch
//   - signature_invalid

export function verifyAgentWallet({ wallet, ledgerEntries, pubkeyPem }) {
  // Structural validation.
  if (!wallet || typeof wallet !== "object" || Array.isArray(wallet)) {
    return reject("agent_wallet_missing_or_malformed");
  }
  if (wallet.schema !== AGENT_WALLET_SCHEMA) {
    return reject("agent_wallet_schema_mismatch");
  }
  for (const f of REQUIRED_FIELDS) {
    if (wallet[f] === undefined || wallet[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  if (
    !isInteger(wallet.resource_balance) ||
    !isInteger(wallet.impact_balance)
  ) {
    return reject("balance_invalid");
  }
  if (!Array.isArray(wallet.ledger_entries_referenced)) {
    return reject("ledger_entries_referenced_invalid");
  }

  // No-payment-to-human gate.
  if (wallet.impact_balance < 0) {
    return reject("no_payment_to_human");
  }

  // Ledger reference resolution + balance recomputation.
  if (!Array.isArray(ledgerEntries)) {
    return reject("ledger_entries_invalid");
  }
  const recomputed = recomputeBalances({
    referenced: wallet.ledger_entries_referenced,
    ledgerEntries,
    walletAgentId: wallet.agent_id,
  });
  if (!recomputed.ok) {
    return reject(recomputed.reason);
  }

  if (wallet.resource_balance !== recomputed.resource) {
    return reject("resource_balance_mismatch");
  }
  if (wallet.impact_balance !== recomputed.impact) {
    return reject("impact_balance_mismatch");
  }

  // Content-address: recompute wallet_proof_hash from the canonical body
  // (excludes wallet_id since wallet_id is derived from the proof_hash —
  // including it would create a circular dependency). The signed body is
  // the buildWalletBody-shaped projection, NOT the whole wallet record.
  const stableBody = buildWalletBody({
    schema: wallet.schema,
    agent_id: wallet.agent_id,
    resource_balance: wallet.resource_balance,
    impact_balance: wallet.impact_balance,
    ledger_entries_referenced: wallet.ledger_entries_referenced,
    prev_hash: wallet.prev_hash,
    created_at_iso: wallet.created_at_iso,
    operator_public_key_fingerprint: wallet.operator_public_key_fingerprint,
  });
  const recomputedHash = sha256(stableStringify(stableBody));
  if (recomputedHash !== wallet.wallet_proof_hash) {
    return reject("wallet_proof_hash_mismatch");
  }

  // Signature: verify Ed25519 using ONLY external pubkey.
  let sigValid;
  try {
    sigValid = verifyPayload(
      stableBody,
      wallet.wallet_signature_b64,
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
    wallet_id: wallet.wallet_id,
    wallet_proof_hash: wallet.wallet_proof_hash,
    agent_id: wallet.agent_id,
    resource_balance: wallet.resource_balance,
    impact_balance: wallet.impact_balance,
  });
}
