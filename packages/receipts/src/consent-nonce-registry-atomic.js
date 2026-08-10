// CONSENT-NONCE-ATOMIC-1A — D3 / backlog task-017.
//
// Drop-in replacement for consent-nonce-registry.js. Same two exports, same return
// shapes; the storage model changes from ONE shared JSON file to ONE FILE PER NONCE
// created with O_EXCL.
//
// WHY — measured against the live registry, not theorised (tests/consent-nonce-atomic.test.js):
//
//   CNA-01  100 concurrent claims on the same nonce → 100 winners.
//           Every caller passed the hasOwnProperty check before any of them wrote.
//   CNA-02  60 concurrent distinct nonces → 59 reported consumed, then silently
//           un-consumed. writeRegistry renames a full snapshot over the shared file,
//           so the last rename discards every entry written since it read.
//   CNA-04  "../escape" accepted as a nonce.
//   CNA-05  a corrupt registry reports "unused" — fail-OPEN on the read path.
//
// The exclusive create is the whole mechanism: the kernel decides the winner, not a
// read-then-write window. There is no window.
//
// FAIL-CLOSED READ. The prior kernel documented "unreadable registry, parse failure
// → false", delegating fail-closed handling to its caller. That is the wrong default
// for a replay guard: a corrupted entry must read as USED, because the one thing we
// know is that somebody wrote it. Reporting "unused" hands back a spent authority.

import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Path-safe by construction: no separators, no dots, no NUL, bounded length.
// Mirrors MISSION_ID_RE in mission-corridor.js rather than inventing a new shape.
const NONCE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function paths(demaHome) {
  const home = demaHome ?? process.env.DEMA_HOME ?? join(process.env.HOME ?? "", ".dema");
  const dir = join(home, "consent", "nonces");
  return { dir, entry: (n) => join(dir, `${n}.json`) };
}

function buildEntry({ actionType, targetHash, consumedAtIso, consentProofHash }) {
  return {
    action_type: actionType,
    target_hash: targetHash,
    consumed_at_iso: consumedAtIso,
    consent_proof_hash: consentProofHash,
  };
}

const entryHash = (nonce, entry) =>
  sha256(JSON.stringify({ nonce, ...entry }));

/**
 * RETIRED 2026-08-11 — consent cutover part 3. Creates nothing, for any caller.
 *
 * This consumed a nonce by exclusive create in `consent/nonces`. Cutover part 2
 * removed its last production caller; part 3 removes its ABILITY, because a
 * clean call graph is a fact about today and expires the moment somebody writes
 * a new call. `consent-nonce-claim.js` is the one authority that may create a
 * consumption.
 *
 * There is no flag, environment variable or privileged caller that re-enables
 * this. A fixture that needs historical bytes writes them with `_internal`
 * (`paths` + `buildEntry`) — which is honest, because the evidence that matters
 * is the file the old regime left on disk, not the API that made it.
 *
 * READING IS UNTOUCHED. `isConsentNonceUsed` below still reports this store, and
 * the canonical claim still consults it for REFUSAL, so a nonce spent under the
 * old regime can never be re-won. Retirement is not deletion: no history is
 * removed, rewritten, or migrated, and no migration record is fabricated.
 *
 * It refuses rather than throwing so that a caller reintroduced by mistake fails
 * closed on the path it already handles — an unrecorded consumption — instead of
 * crashing somewhere that might be caught and read as success.
 *
 * @returns {Promise<{recorded:false, error:"legacy_consent_authority_retired"}>}
 */
export async function recordConsentNonce() {
  return Object.freeze({
    recorded: false,
    error: "legacy_consent_authority_retired",
    superseded_by: "packages/receipts/src/consent-nonce-claim.js",
  });
}

/**
 * Is this nonce spent? FAILS CLOSED: a present-but-unreadable entry reads as USED.
 * Only a genuinely absent entry reads as unused.
 */
export async function isConsentNonceUsed({ nonce, demaHome }) {
  if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) return true; // malformed ⇒ never grant
  const { dir, entry: entryPath } = paths(demaHome);
  try {
    await readFile(entryPath(nonce), "utf8");
    return true;
  } catch (e) {
    if (e?.code === "ENOENT") {
      // Absent entry. Confirm the directory itself is readable — an unreadable
      // registry must not masquerade as an empty one.
      try { await readdir(dir); return false; } catch { return true; }
    }
    return true; // EACCES, EISDIR, anything else ⇒ cannot prove unused
  }
}

export const _internal = Object.freeze({ NONCE_RE, paths, buildEntry, entryHash });
