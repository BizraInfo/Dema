// RECEIPT-CHAIN-1B · canonical receipt ledger integration (on-disk chain)
//
// Turns the RECEIPT-CHAIN-1A signed-receipt primitive into a real prev_hash
// chain on disk at $DEMA_HOME/receipts/canonical-ledger.ndjson — the slice that
// actually closes the gap that ~/.dema/receipts is a flat bag with no chain.
//
// Master-craftsmanship invariant: NEVER extend a corrupt chain. The existing
// ledger is verified (under the operator's own key) before any append; if it
// does not verify, the append is refused and nothing is written.
//
// Reuses RECEIPT-CHAIN-1A (buildCanonicalReceipt / verifyCanonicalChain). Append
// is atomic (tmp + rename). Fail-closed on consent (delegated to 1A) and on a
// broken existing chain.
//
// SCOPE (1B): writes a dedicated canonical ledger file under demaHome. Does NOT
// migrate the legacy flat receipts (those are pre-canonical; left untouched).
// No token/PoI/economy/federation.

import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { loadPublicKey } from "./authorship-key-store.js";
import {
  buildCanonicalReceipt,
  verifyCanonicalChain,
  CANONICAL_RECEIPT_CONSENT_PHRASE,
} from "./canonical-receipt.js";

export const CANONICAL_LEDGER_RELPATH = "receipts/canonical-ledger.ndjson";

function resolveHome(override) {
  if (typeof override === "string" && override.length > 0) return override;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}
function ledgerPath(demaHome) {
  return join(resolveHome(demaHome), CANONICAL_LEDGER_RELPATH);
}

/** Read the canonical ledger back as an array of receipts (missing file → []). */
export async function loadCanonicalLedger({ demaHome } = {}) {
  let raw;
  try {
    raw = await readFile(ledgerPath(demaHome), "utf8");
  } catch (err) {
    // Only a missing ledger is an empty chain. A permission/transient read
    // error must NOT masquerade as empty (which could branch a fresh genesis
    // over a real-but-unreadable ledger) — surface it.
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

/** Verify the whole on-disk ledger chain. Empty ledger is a verified empty chain. */
export async function verifyCanonicalLedger({ demaHome, pubkeyPem } = {}) {
  const entries = await loadCanonicalLedger({ demaHome });
  if (entries.length === 0) {
    return Object.freeze({ verified: true, total_entries: 0 });
  }
  return verifyCanonicalChain({ entries, pubkeyPem });
}

/**
 * Append one canonical receipt to the on-disk ledger, chained to the current
 * head. Verifies the existing chain first — refuses to extend a corrupt one.
 *
 * @returns {{appended:true, receipt, head, length}
 *          | {appended:false, error, reason?}}
 */
export async function appendCanonicalReceipt({
  canonicalBody,
  truthLabel,
  whatProves,
  whatDoesNotProve,
  consent,
  demaHome,
  now,
} = {}) {
  if (consent !== CANONICAL_RECEIPT_CONSENT_PHRASE) {
    return Object.freeze({ appended: false, error: "consent_required" });
  }

  // A corrupt/non-JSON ledger line must fail closed, never throw.
  let entries;
  try {
    entries = await loadCanonicalLedger({ demaHome });
  } catch {
    return Object.freeze({ appended: false, error: "ledger_unreadable" });
  }

  // INVARIANT: never extend a corrupt chain.
  if (entries.length > 0) {
    const pubkey = await loadPublicKey(demaHome);
    if (!pubkey) {
      return Object.freeze({ appended: false, error: "no_authorship_key" });
    }
    const v = verifyCanonicalChain({ entries, pubkeyPem: pubkey });
    if (!v.verified) {
      return Object.freeze({
        appended: false,
        error: "ledger_chain_broken",
        reason: v.reason,
      });
    }
  }

  const prevHash = entries.length
    ? entries[entries.length - 1].receipt_id
    : null;

  const built = await buildCanonicalReceipt({
    canonicalBody,
    prevHash,
    truthLabel,
    whatProves,
    whatDoesNotProve,
    consent,
    demaHome,
    now,
  });
  if (!built.built) {
    return Object.freeze({ appended: false, error: built.error });
  }

  // atomic append: rewrite the canonical ledger via tmp + rename.
  const path = ledgerPath(demaHome);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const content =
    [...entries, built.receipt].map((r) => JSON.stringify(r)).join("\n") + "\n";
  // Unique tmp per append (content-addressed) so concurrent appends can't
  // collide on a shared temp file. Deterministic — no random/clock.
  const tmp = `${path}.${built.receipt.receipt_id.slice(0, 12)}.tmp`;
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
    appended: true,
    receipt: built.receipt,
    head: built.receipt.receipt_id,
    length: entries.length + 1,
  });
}
