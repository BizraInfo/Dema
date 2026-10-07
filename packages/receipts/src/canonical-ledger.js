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
// publishes through a private no-clobber temp, file fsync, rename, and parent
// directory fsync. Fail-closed on consent (delegated to 1A), publication errors,
// and a broken existing chain.
//
// SCOPE (1B): writes a dedicated canonical ledger file under demaHome. Does NOT
// migrate the legacy flat receipts (those are pre-canonical; left untouched).
// No token/PoI/economy/federation.

import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { loadPublicKey, loadGenerationPublicKey } from "./authorship-key-store.js";
import { fingerprintPublicKeyPem as fingerprintOfPem } from "./authorship-signature.js";
import {
  buildCanonicalReceipt,
  verifyCanonicalChain,
  verifyCanonicalAuthorityChain,
  CANONICAL_RECEIPT_CONSENT_PHRASE,
} from "./canonical-receipt.js";

export const CANONICAL_LEDGER_RELPATH = "receipts/canonical-ledger.ndjson";

const DEFAULT_PUBLICATION_OPS = Object.freeze({ mkdir, open, rename, unlink });

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

/**
 * Verify the whole on-disk ledger chain. Empty ledger is a verified empty chain.
 *
 * CONTRACT MIGRATION 2026-08-11 (ISNAD-AUTHORITY-SUCCESSION-1A). `pubkeyPem` is
 * now the ROOT-TRUST ANCHOR — the key the chain is anchored on — and no longer
 * "the one key that signed every entry". For a home whose authorship key has
 * never rotated these are the same key, which is why existing callers and their
 * tests are unaffected.
 *
 * After a rotation they differ, and the difference is the point: passing the
 * CURRENT active key now fails loudly rather than appearing to verify a history
 * that key never signed. A caller wanting today's authority should ask the key
 * store for it, not infer it from a chain — those are two different jobs and
 * collapsing them is what this slice exists to undo.
 */
export async function verifyCanonicalLedger({ demaHome, pubkeyPem } = {}) {
  const entries = await loadCanonicalLedger({ demaHome });
  if (entries.length === 0) {
    return Object.freeze({ verified: true, total_entries: 0 });
  }
  // PROOF-SPINE-GUARD-1A: structural rejection of empty sigs (#107) and empty
  // genesis bodies (#101) is preserved inside the walk. This is the on-disk
  // spine guard, now authority-aware.
  return verifyCanonicalAuthorityChain({ entries, genesisPubkeyPem: pubkeyPem });
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
  publicationOps = DEFAULT_PUBLICATION_OPS,
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
  // PROOF-SPINE-GUARD-1A: explicit pre-check for #107 empty signatures in ledger
  // (defense in depth; verifyCanonicalChain will also catch).
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (
      !e.receipt_signature_b64 ||
      typeof e.receipt_signature_b64 !== "string" ||
      e.receipt_signature_b64.trim().length === 0
    ) {
      return Object.freeze({
        appended: false,
        error: "ledger_contains_empty_signature",
        at_index: i,
      });
    }
  }
  if (entries.length > 0) {
    const pubkey = await loadPublicKey(demaHome);
    if (!pubkey) {
      return Object.freeze({ appended: false, error: "no_authorship_key" });
    }

    // ISNAD-AUTHORITY-SUCCESSION-1A. This pre-check used to verify every entry
    // against the CURRENT active key, which meant a rotation permanently closed
    // the ledger: measured at 0952c16, the append after a rotation returned
    // ledger_chain_broken / signature_invalid on entries the retired key had
    // legitimately signed.
    //
    // It now walks the authority forward. The anchor is the key that signed
    // entry 0, resolved from the archived generations, and the trusted key
    // advances only across a valid two-half succession link.
    //
    // BOUNDARY — this is an INTEGRITY check, not an ancestry proof. It is
    // anchored on the chain's own first signer, so it proves the chain is
    // internally consistent and lands on the key about to append. It cannot
    // prove the first signer was ever legitimate; only a caller supplying an
    // external genesis key to verifyCanonicalAuthorityChain can do that, which
    // is why the two jobs stay separate functions.
    const rootFp = entries[0]?.operator_public_key_fingerprint;
    const rootPem = (await loadGenerationPublicKey(demaHome, rootFp)) ?? pubkey;
    const v = verifyCanonicalAuthorityChain({ entries, genesisPubkeyPem: rootPem });
    if (!v.verified) {
      return Object.freeze({
        appended: false,
        error: "ledger_chain_broken",
        reason: v.reason,
      });
    }

    // The signer about to append must be the authority the chain established —
    // or, when the chain ends on an authorized-but-uncommitted succession, the
    // exact successor that predecessor named. Any other key is unannounced.
    const signerFp = fingerprintOfPem(pubkey);
    const isEstablished = signerFp === v.final_authority_fingerprint;
    const isNamedSuccessor = v.pending_successor?.successor_fingerprint === signerFp;
    if (!isEstablished && !isNamedSuccessor) {
      return Object.freeze({
        appended: false,
        error: "ledger_chain_broken",
        reason: "signer_is_not_the_established_authority",
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

  // Durable atomic append: private no-clobber temp → file fsync → rename →
  // parent-directory fsync. A publication failure throws as before, so callers
  // cannot persist a later phase from a false appended:true acknowledgement.
  const path = ledgerPath(demaHome);
  const parent = dirname(path);
  await publicationOps.mkdir(parent, { recursive: true, mode: 0o700 });
  const content =
    [...entries, built.receipt].map((r) => JSON.stringify(r)).join("\n") + "\n";
  // Unique tmp per append (content-addressed) so concurrent appends can't
  // collide on a shared temp file. Deterministic — no random/clock.
  const tmp = `${path}.${built.receipt.receipt_id.slice(0, 12)}.tmp`;
  let tmpHandle = null;
  let parentHandle = null;
  let tmpCreated = false;
  let published = false;
  try {
    tmpHandle = await publicationOps.open(tmp, "wx", 0o600);
    tmpCreated = true;
    await tmpHandle.writeFile(content, { encoding: "utf8" });
    await tmpHandle.sync();
    await tmpHandle.close();
    tmpHandle = null;

    await publicationOps.rename(tmp, path);
    published = true;

    parentHandle = await publicationOps.open(parent, "r");
    await parentHandle.sync();
    await parentHandle.close();
    parentHandle = null;
  } catch (err) {
    if (tmpHandle) {
      try {
        await tmpHandle.close();
      } catch {
        /* preserve the primary publication failure */
      }
    }
    if (parentHandle) {
      try {
        await parentHandle.close();
      } catch {
        /* preserve the primary publication failure */
      }
    }
    if (tmpCreated && !published) {
      try {
        await publicationOps.unlink(tmp);
      } catch {
        /* best-effort cleanup; the private temp remains non-authoritative */
      }
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
