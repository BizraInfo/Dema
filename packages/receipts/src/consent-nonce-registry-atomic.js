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
 * Consume a nonce exactly once. Concurrency-safe by exclusive create.
 * @returns {Promise<{recorded:true, registry_entry_hash:string}
 *                 | {recorded:false, error:"consent_nonce_already_used", existing_entry:object}
 *                 | {recorded:false, error:"consent_nonce_malformed"}>}
 */
export async function recordConsentNonce({
  nonce, actionType, targetHash, consentProofHash, demaHome, consumedAtIso,
}) {
  if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) {
    return Object.freeze({ recorded: false, error: "consent_nonce_malformed" });
  }

  const { dir, entry: entryPath } = paths(demaHome);
  await mkdir(dir, { recursive: true });

  const entry = buildEntry({
    actionType,
    targetHash,
    consumedAtIso:
      typeof consumedAtIso === "string" && consumedAtIso.length > 0
        ? consumedAtIso
        : new Date().toISOString(),
    consentProofHash,
  });

  try {
    // O_EXCL. The filesystem arbitrates; exactly one caller can succeed.
    await writeFile(entryPath(nonce), JSON.stringify(entry), { flag: "wx", mode: 0o600 });
  } catch (e) {
    if (e?.code !== "EEXIST") throw e;
    let existing = null;
    try {
      existing = JSON.parse(await readFile(entryPath(nonce), "utf8"));
    } catch {
      existing = null; // corrupt — still consumed; see the fail-closed note above
    }
    return Object.freeze({
      recorded: false,
      error: "consent_nonce_already_used",
      existing_entry: Object.freeze(existing ?? { corrupt: true }),
    });
  }

  return Object.freeze({ recorded: true, registry_entry_hash: entryHash(nonce, entry) });
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
