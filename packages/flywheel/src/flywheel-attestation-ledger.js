// ATTEST-1B · durable convergence-attestation ledger.
//
// CONVERGENCE-ATTEST-1A produces a signed, Level-B-grounded attestation but is
// pure (no write). This makes the seal persistent — verify → ATTEST → seal →
// APPEND → replay. A currently-grounded attestation + key-bound consent is
// appended to a durable, content-addressed, operator-signed prev_hash chain at
// $DEMA_HOME/attestations/convergence-attestation-ledger.ndjson.
//
// Grounding policy: Level-B (the attested verdict re-derives from the LIVE
// canonical chain) is enforced AT APPEND TIME. The ledger entry then preserves
// the signed attestation snapshot; replay verifies the durable chain — entry
// links, entry signatures, and each embedded attestation's own (Level-A)
// signature — which is independent of later canonical-chain growth. So a
// historical entry stays verifiable even after the chain advances past the
// snapshot it attested.
//
// Reuses (no new crypto, no new ledger engine): verifyConvergenceAttestation
// (the gate), verifyConsentProof (key-bound consent), signPayload/verifyPayload,
// sha256/stableStringify, and the canonical tmp+rename append discipline.

import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyConsentProof } from "../../receipts/src/consent-proof.js";
import { verifyConvergenceAttestation } from "./flywheel-convergence-attestation.js";

export const CONVERGENCE_ATTESTATION_LEDGER_SCHEMA =
  "bizra.dema.convergence_attestation_ledger.v0.1";
export const ATTESTATION_LEDGER_RELPATH =
  "attestations/convergence-attestation-ledger.ndjson";
export const APPEND_ATTESTATION_ACTION_TYPE = "APPEND_ATTESTATION";
// The exact consent phrase the operator must have typed. verifyConsentProof
// authenticates the signed body (which includes consent_phrase) but does not
// pin the phrase text, so a proof with any phrase + the right scope would
// otherwise pass — require the canonical phrase here.
export const APPEND_ATTESTATION_CONSENT_PHRASE =
  "APPEND CONVERGENCE ATTESTATION";

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}
function ledgerPath(demaHome) {
  return join(resolveHome(demaHome), ATTESTATION_LEDGER_RELPATH);
}
function fingerprintFromPem(pem) {
  const pk = createPublicKey(pem);
  return sha256(pk.export({ type: "spki", format: "der" }).toString("hex"));
}
function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}
function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

const SUCCESS_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: true,
  operator_dema_home_mutated: true,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  exchange_value_claimed: false,
  public_transfer_performed: false,
});
const FAIL_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: false,
  operator_dema_home_mutated: false,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  exchange_value_claimed: false,
  public_transfer_performed: false,
});

function fail(error, extra = {}) {
  return Object.freeze({
    schema: CONVERGENCE_ATTESTATION_LEDGER_SCHEMA,
    appended: false,
    truth_label: "LOCAL_CONVERGENCE_ATTESTATION_LEDGER_APPEND_REFUSED",
    error,
    ...extra,
    boundary: FAIL_BOUNDARY,
  });
}
function reject(reason, at_index) {
  return Object.freeze({ verified: false, reason, at_index });
}

export async function loadConvergenceAttestationLedger({ demaHome } = {}) {
  let raw;
  try {
    raw = await readFile(ledgerPath(demaHome), "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

function buildEntryBody({
  attestation,
  attestation_id,
  consent_proof_hash,
  prev_hash,
  created_at_iso,
  operator_public_key_fingerprint,
}) {
  return {
    schema: CONVERGENCE_ATTESTATION_LEDGER_SCHEMA,
    attestation_id,
    attestation,
    consent_proof_hash,
    prev_hash,
    truth_label: "LEVEL_B_GROUNDED_DURABLE",
    what_this_proves:
      "A convergence attestation was Level-B grounded (its verdict re-derived from the live canonical chain) at append time and is durably recorded, operator-signed, and prev_hash-chained.",
    what_this_does_not_prove:
      "Does not prove the canonical chain still converges now (grounding is point-in-time at append), nor a full Node0 lifecycle, Block0 seal, public economy, or federation.",
    operator_public_key_fingerprint,
    created_at_iso,
  };
}

// Pure chain verifier over loaded entries — entry links + entry signatures +
// each embedded attestation's own Level-A signature. Durable (chain-growth
// independent); does NOT re-run Level-B (that was the append-time gate).
function verifyEntries(entries, pubkeyPem) {
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return reject("entry_malformed", i);
    }
    if (entry.schema !== CONVERGENCE_ATTESTATION_LEDGER_SCHEMA) {
      return reject("entry_schema_mismatch", i);
    }
    if (i === 0) {
      if (entry.prev_hash !== null)
        return reject("genesis_prev_hash_not_null", i);
    } else if (entry.prev_hash !== entries[i - 1].entry_hash) {
      return reject("prev_hash_mismatch", i);
    }
    const { entry_hash, entry_signature_b64, ...body } = entry;
    if (!isSha256Hex(entry_hash)) return reject("entry_hash_invalid", i);
    if (sha256(stableStringify(body)) !== entry_hash) {
      return reject("entry_hash_mismatch", i);
    }
    let ok;
    try {
      ok = verifyPayload(body, entry_signature_b64, pubkeyPem);
    } catch {
      return reject("signature_invalid", i);
    }
    if (!ok) return reject("signature_invalid", i);

    // Embedded attestation Level-A: id re-derives + its own signature valid.
    const att = entry.attestation;
    if (!att || att.attestation_id !== entry.attestation_id) {
      return reject("attestation_id_mismatch", i);
    }
    const { attestation_id, attestation_signature_b64, ...attBody } = att;
    if (sha256(stableStringify(attBody)) !== attestation_id) {
      return reject("attestation_body_hash_mismatch", i);
    }
    let attOk;
    try {
      attOk = verifyPayload(attBody, attestation_signature_b64, pubkeyPem);
    } catch {
      return reject("attestation_signature_invalid", i);
    }
    if (!attOk) return reject("attestation_signature_invalid", i);
  }
  return Object.freeze({
    verified: true,
    total_entries: entries.length,
    chain_head: entries.length ? entries[entries.length - 1].entry_hash : null,
  });
}

export async function verifyConvergenceAttestationLedger({
  demaHome,
  pubkeyPem,
} = {}) {
  const entries = await loadConvergenceAttestationLedger({ demaHome });
  if (entries.length === 0) {
    return Object.freeze({ verified: true, total_entries: 0 });
  }
  return verifyEntries(entries, pubkeyPem);
}

/**
 * Append a Level-B-grounded convergence attestation to the durable ledger.
 * Fail-closed before any write.
 */
export async function appendConvergenceAttestation({
  attestation,
  consentProof,
  operatorPubkeyPem,
  demaHome,
  now,
} = {}) {
  if (!isNonEmptyString(now) || Number.isNaN(Date.parse(now))) {
    return fail("created_at_iso_required");
  }
  // (1) Consent presence — before anything else.
  if (!consentProof || typeof consentProof !== "object") {
    return fail("consent_proof_required");
  }
  // (2) The attestation must be Level-B grounded against the live chain NOW.
  const grounding = await verifyConvergenceAttestation({
    attestation,
    demaHome,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!grounding.verified) {
    return fail("attestation_not_grounded", { grounding });
  }
  const attestation_id = attestation.attestation_id;
  if (!isSha256Hex(attestation_id)) {
    return fail("attestation_id_invalid");
  }
  // (3) Load ledger; never extend a corrupt chain.
  let entries;
  try {
    entries = await loadConvergenceAttestationLedger({ demaHome });
  } catch {
    return fail("attestation_ledger_unreadable");
  }
  if (entries.length > 0) {
    const chain = verifyEntries(entries, operatorPubkeyPem);
    if (!chain.verified) {
      return fail("attestation_ledger_chain_broken", { reason: chain.reason });
    }
  }
  // (4) Dedup by attestation_id.
  if (entries.some((e) => e.attestation_id === attestation_id)) {
    return fail("duplicate_attestation");
  }
  // (5) Key-bound consent scoped to this attestation_id.
  const consentVerify = verifyConsentProof({
    consentProof,
    pubkeyPem: operatorPubkeyPem,
    expectedActionScope: {
      action_type: APPEND_ATTESTATION_ACTION_TYPE,
      target_hash: attestation_id,
    },
    now,
  });
  if (!consentVerify.verified) {
    // verifyConsentProof reasons already carry their own prefix
    // (consent_expired / consent_scope_mismatch / consent_signature_invalid / …);
    // surface them verbatim rather than double-prefixing.
    return fail(consentVerify.reason);
  }
  // The signed consent_phrase must be the exact append phrase — scope binding
  // alone is not enough; the operator must have typed this specific consent.
  if (consentProof.consent_phrase !== APPEND_ATTESTATION_CONSENT_PHRASE) {
    return fail("consent_phrase_mismatch");
  }
  // (6) Operator key load + binding to operatorPubkeyPem.
  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;
  if (!privateKeyPem || !publicKeyPem) {
    return fail("no_authorship_key");
  }
  const fingerprint = fingerprintFromPem(publicKeyPem);
  if (fingerprint !== fingerprintFromPem(operatorPubkeyPem)) {
    return fail("operator_key_mismatch");
  }

  // (7) Build, sign, chain, write.
  const prev_hash = entries.length
    ? entries[entries.length - 1].entry_hash
    : null;
  const body = buildEntryBody({
    attestation,
    attestation_id,
    consent_proof_hash: consentProof.consent_proof_hash,
    prev_hash,
    created_at_iso: now,
    operator_public_key_fingerprint: fingerprint,
  });
  const entry_hash = sha256(stableStringify(body));
  const entry_signature_b64 = signPayload(body, privateKeyPem);
  const entry = Object.freeze({ ...body, entry_hash, entry_signature_b64 });
  const nextEntries = [...entries, entry];

  // SINGLE-WRITER ASSUMPTION (v0.1 LOCAL_ONLY): tmp+rename is atomic per write,
  // but two concurrent Dema processes against the same DEMA_HOME could lose an
  // append. Node0 is single-operator/single-process; a lockfile is future
  // hardening before any multi-writer use.
  const path = ledgerPath(demaHome);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const content = nextEntries.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const tmp = `${path}.${entry_hash.slice(0, 12)}.tmp`;
  try {
    await writeFile(tmp, content, { encoding: "utf8", mode: 0o600 });
    await rename(tmp, path);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      /* tmp already gone */
    }
    throw err;
  }

  return Object.freeze({
    schema: CONVERGENCE_ATTESTATION_LEDGER_SCHEMA,
    appended: true,
    truth_label: "LEVEL_B_GROUNDED_DURABLE",
    path,
    length: nextEntries.length,
    head: entry_hash,
    entry,
    boundary: SUCCESS_BOUNDARY,
  });
}
