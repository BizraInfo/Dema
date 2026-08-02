// CORRIDOR-CLOSURE-GATHERER-1A — the BINDING caller for THE WELD.
//
// mission-corridor-closure.js is a pure kernel. Purity forbids it from reading
// the durable nonce store or the receipt ledger, so it can check that a consent
// registry is well-SHAPED but never that it is telling the TRUTH:
//
//   consentRegistry: { has: () => false, add: () => {} }   → COMPLETED_VERIFIED
//
// That is the documented ceiling in the kernel header, the same shape-not-binding
// ceiling peak-self-loop-preview.js records for evidence. This module is the
// caller that closes it: every surface below is bound to real bytes on disk —
// O_EXCL nonce files, the canonical receipt ledger, the real filesystem, and the
// anchor log — so single-use consent, ledger membership and anchor placement are
// PROVEN rather than asserted.
//
// I/O tier by design (allowlisted in scripts/review/kernel-purity-allowlist.js).
// All paths stay under DEMA_HOME. No network, no child_process, no model.
//
// ── KNOWN LIMIT · the FIRST closure is placement-anchored only ──
// enforceAnchorPolicy verifies an anchor LOG against the observed chain. When
// the canonical ledger is empty there is no prior chain to anchor, so the anchor
// law reduces to "anchorDir resolves outside the leased scope". We do NOT mint a
// synthetic genesis head to make the check look stronger than it is. After the
// first closure appends its receipt, appendClosureAnchor writes a real anchor
// record, and every subsequent closure is verified against it.

import { createHash } from "node:crypto";
import {
  appendFileSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

import { buildAnchorRecord } from "../../core/src/chain-anchor.js";
import { loadCanonicalLedger, appendCanonicalReceipt } from "../../receipts/src/canonical-ledger.js";
import { CANONICAL_RECEIPT_CONSENT_PHRASE } from "../../receipts/src/canonical-receipt.js";
import {
  recordConsentNonce, isConsentNonceUsed, _internal as nonceInternal,
} from "../../receipts/src/consent-nonce-registry-atomic.js";

export const CORRIDOR_CLOSURE_ANCHOR_RELPATH = "anchors/corridor-closure-anchors.ndjson";
export const CORRIDOR_CLOSURE_CHAIN_ID = "canonical-receipt-ledger";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function resolveDemaHome(override) {
  if (typeof override === "string" && override.length > 0) return override;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

/**
 * Single-use consent bound to REAL bytes: one O_EXCL file per nonce.
 *
 * `has` fails CLOSED (an unreadable entry reads as USED), so a corrupted
 * registry can never hand back a spent authority. `add` THROWS when the
 * registry refuses — the weld treats a thrown add as a failed transaction
 * rather than silently proceeding on unrecorded consent.
 */
export function buildDiskConsentRegistry({ demaHome, actionType = "C3_LOCAL_WRITE", targetHash, consentProofHash }) {
  const home = resolveDemaHome(demaHome);
  // Create the registry directory up front so that its LATER absence is
  // unambiguous evidence of tampering, and `has` can keep failing closed on an
  // unreadable directory. Without this, a never-initialised registry is
  // indistinguishable from an erased one, and the fail-closed read reports every
  // nonce as already consumed — refusing every first closure on a fresh home.
  mkdirSync(nonceInternal.paths(home).dir, { recursive: true, mode: 0o700 });
  return Object.freeze({
    has: (nonce) => isConsentNonceUsed({ nonce, demaHome: home }),
    add: async (nonce) => {
      const r = await recordConsentNonce({
        nonce, actionType, targetHash, consentProofHash, demaHome: home,
      });
      if (!r.recorded) {
        // Losing the exclusive create means somebody else consumed this nonce
        // between our `has` and our `add`. That is precisely the race D3 exists
        // to arbitrate, and the loser must not proceed.
        throw new Error(`consent nonce not recorded: ${r.error}`);
      }
      return r;
    },
  });
}

/**
 * Bind the weld's injected `appendReceipt` to the on-disk canonical ledger.
 *
 * Translation layer, deliberately narrow: the weld speaks {ok, head}; the
 * ledger speaks {appended, head}. The ledger's consent argument is a fixed
 * module API constant (not operator authority) — the operator's authority was
 * already established by the corridor consent gate before this point.
 */
export function buildLedgerAppender({ demaHome, now }) {
  const home = resolveDemaHome(demaHome);
  return async ({ canonicalBody, truthLabel }) => {
    const r = await appendCanonicalReceipt({
      canonicalBody,
      truthLabel,
      // The receipt's created_at_iso is committed to receipt_id and signature.
      // It comes from the caller's already-consented `now`, never a fresh clock
      // read here, so the receipt cannot drift from the authorised transition.
      now,
      whatProves:
        "One consented corridor mission reached COMPLETE: anchored, independently verified, sealed, and appended to the canonical receipt ledger",
      whatDoesNotProve:
        "Federation, token economy, PoI rewards, autonomous PAT/SAT, or that the mission's objective was useful to a human",
      consent: CANONICAL_RECEIPT_CONSENT_PHRASE,
      demaHome: home,
    });
    // Throw with the LEDGER's own reason. The weld turns any throw here into
    // LEDGER_COMMIT_FAILED_NO_COMPLETE and records the message, so a generic
    // "refused" would erase the one detail an operator needs (no key, broken
    // chain, unreadable ledger) from the terminal event.
    if (r.appended !== true) throw new Error(`ledger append refused: ${r.error ?? "unknown"}`);
    return Object.freeze({ ok: true, head: r.head, length: r.length });
  };
}

/** Observe the live receipt chain: what the anchor is a claim ABOUT. */
export async function observeCanonicalLedger({ demaHome }) {
  const entries = await loadCanonicalLedger({ demaHome: resolveDemaHome(demaHome) });
  return Object.freeze({
    entries: entries.length,
    head: entries.length ? entries[entries.length - 1].receipt_id : null,
    head_history: Object.freeze(entries.map((e) => e.receipt_id)),
  });
}

function anchorLogPath(demaHome) {
  return join(resolveDemaHome(demaHome), CORRIDOR_CLOSURE_ANCHOR_RELPATH);
}

/** Read the anchor log. A missing log is an empty log; a corrupt line throws. */
export function readClosureAnchorLog({ demaHome }) {
  let raw;
  try {
    raw = readFileSync(anchorLogPath(demaHome), "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err; // an unreadable anchor log must never masquerade as "no anchor"
  }
  return raw.split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));
}

/**
 * Append a new anchor record AFTER the artifact it testifies about exists.
 * Anchoring before the append would testify about a chain state that the very
 * next write invalidates — the witness must outlive, not precede, the act.
 */
export function appendClosureAnchor({ demaHome, entries, head }) {
  const log = readClosureAnchorLog({ demaHome });
  const record = buildAnchorRecord({
    chain_id: CORRIDOR_CLOSURE_CHAIN_ID,
    entries,
    head,
    previous: log.length ? log[log.length - 1] : null,
    hash: sha256,
    at: null, // no clock in the anchor body: the record is content-addressed
  });
  const path = anchorLogPath(demaHome);
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  appendFileSync(path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  return record;
}

/**
 * The bounded effect: ONE rename inside the leased scope.
 *
 * Omega0 verifies `file_count_preserved` and zero `source_loss`, so the act must
 * conserve content — a rename qualifies, a create does not. The adapter never
 * reports its own success: Omega0 recomputes the manifest itself (design law 4).
 *
 * Every method is synchronous because runMechanicalClosure calls them
 * synchronously; the ledger observation is computed beforehand and injected.
 */
export function buildRenameEffectAdapter({ scopeRoot, from, to, anchorLog = [], observed = null }) {
  const root = resolve(scopeRoot);
  const at = (name) => join(root, name);
  const listing = () =>
    readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .sort();

  return Object.freeze({
    propose: () => [{ op: "rename", from, to }],
    manifest: () =>
      listing().map((name) => ({
        path: name,
        content_id: sha256(readFileSync(at(name))),
      })),
    apply(plan) {
      for (const op of plan) {
        // Refuse to overwrite: a rename onto an existing path would destroy
        // content and read to Omega0 as a file-count change after the fact.
        try {
          statSync(at(op.to));
          throw new Error(`rename target already exists: ${op.to}`);
        } catch (err) {
          if (err && err.code !== "ENOENT") throw err;
        }
        renameSync(at(op.from), at(op.to));
      }
      return { applied: plan };
    },
    undo(applied) {
      const plan = applied?.applied ?? [{ op: "rename", from, to }];
      for (const op of [...plan].reverse()) renameSync(at(op.to), at(op.from));
      return true;
    },
    anchorState: () => ({ anchorLog, observed }),
  });
}
