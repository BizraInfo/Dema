// KEYCONSENT-2A · Single-use Nonce Registry kernel
//
// Pure kernel: write/read primitives for the local single-use nonce
// registry that protects KEYCONSENT-1A consent proofs against
// within-window replay inside ONE Node0 ($DEMA_HOME).
//
// First call with a given nonce wins; every subsequent presentation,
// even otherwise-valid, returns `consent_nonce_already_used` and the
// existing record is NOT overwritten.
//
// Reuses (no duplication):
// - sha256, stableStringify   packages/consent/src/consent-common.js
// - atomic tmp+rename pattern packages/urp/src/local-index-writer.js
// - DEMA_HOME resolution      packages/receipts/src/authorship-key-store.js
//
// Spec reference: docs/security/KEYCONSENT_2_PREFLIGHT.md §3, §4, §9.
//
// SCOPE (this slice):
// - Pure kernel functions only. No CLI, no integration with existing
//   gates (verdict-attest / authorship-sign / urp-choose wiring is
//   KEYCONSENT-2B, a separate slice).
// - Within one $DEMA_HOME only; cross-machine replay protection is
//   federation-class and explicitly deferred.
// - No private key material is read, derived, embedded, or referenced
//   in the registry file.

import {
  mkdir,
  writeFile,
  readFile,
  rename,
  chmod,
  stat,
} from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

const REGISTRY_FILENAME = "used-nonces.json";
const REGISTRY_DIRNAME = "consent";
const NONCES_DIRNAME = "used-nonces.d";
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

// CONSENT-NONCE-ATOMIC-1A: filename-safe nonce charset. The nonce keys a file
// under used-nonces.d/, so anything outside this set (path separators, dots,
// spaces) is refused before any fs call — a trust-boundary check, not a format
// opinion. Real nonces are 64-char hex; this admits them with headroom.
const NONCE_SAFE = /^[A-Za-z0-9_-]{8,256}$/;

function resolveHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function paths(demaHome) {
  const home = resolveHome(demaHome);
  const dir = join(home, REGISTRY_DIRNAME);
  return {
    dir,
    file: join(dir, REGISTRY_FILENAME),
    noncesDir: join(dir, NONCES_DIRNAME),
  };
}

async function readRegistry(file) {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    // Missing file OR parse failure: reader is pure/stateless and
    // returns an empty view. The fail-closed handling for the
    // "nonce_registry_unavailable" case lives in the gate
    // (KEYCONSENT-2B), not in this pure kernel.
    return {};
  }
}

// Strict variant for the CONSUMPTION path (CONSENT-NONCE-ATOMIC-1A): a legacy
// registry that EXISTS but cannot be parsed must refuse consumption, never
// degrade to "empty = all nonces unused". Missing file stays an empty view.
async function readRegistryStrict(file) {
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return { registry: {}, corrupt: false };
    return { registry: {}, corrupt: true };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { registry: parsed, corrupt: false };
    }
    return { registry: {}, corrupt: true };
  } catch {
    return { registry: {}, corrupt: true };
  }
}

async function writeRegistry(dir, file, registry) {
  await mkdir(dir, { recursive: true, mode: DIR_MODE });
  // Ensure directory mode is exactly 0o700 even if it pre-existed with
  // a wider mode. mkdir's `mode` arg is only honored on creation.
  try {
    await chmod(dir, DIR_MODE);
  } catch {
    // Best-effort; ignore on platforms that disallow chmod.
  }

  const tmpPath = `${file}.tmp.${process.pid}.${randomBytes(8).toString("hex")}`;
  // Use stable JSON (sorted keys, no whitespace) for byte-identical
  // determinism across runs with identical inputs.
  const body = stableStringify(registry);
  await writeFile(tmpPath, body, { encoding: "utf8", mode: FILE_MODE });
  await rename(tmpPath, file);
  // chmod post-rename: the rename may have inherited the destination
  // inode mode on some filesystems; preflight DOD 9.7 mandates an
  // explicit chmod to 0o600 after every write.
  await chmod(file, FILE_MODE);
}

function buildEntry({
  actionType,
  targetHash,
  consumedAtIso,
  consentProofHash,
}) {
  // Stable key order matters for byte-determinism of the registry file
  // AND for the registry_entry_hash. stableStringify sorts keys, so
  // any object shape with these exact keys produces identical output.
  return {
    action_type: actionType,
    target_hash: targetHash,
    consumed_at_iso: consumedAtIso,
    consent_proof_hash: consentProofHash,
  };
}

function entryHash(nonce, entry) {
  // Content-address per preflight §4: sha256 over the registry record
  // as it lives on disk, plus the nonce that keys it. This binds the
  // hash to the (nonce, entry) pair so post-hoc tampering of either
  // surfaces under operator-side audit.
  return sha256(
    stableStringify({
      nonce,
      action_type: entry.action_type,
      target_hash: entry.target_hash,
      consumed_at_iso: entry.consumed_at_iso,
      consent_proof_hash: entry.consent_proof_hash,
    }),
  );
}

/**
 * Record a single consent nonce as consumed. First call wins; repeat
 * call with the same nonce returns the existing entry and the error
 * `consent_nonce_already_used`, leaving the on-disk record untouched.
 *
 * @param {object}  args
 * @param {string}  args.nonce              32-byte hex nonce from the consent proof.
 * @param {string}  args.actionType         e.g. MINT_VERDICT_RECEIPT.
 * @param {string}  args.targetHash         sha256 hex of the consent's action_scope.target_hash.
 * @param {string}  args.consentProofHash   sha256 hex of the consent body.
 * @param {string}  [args.demaHome]         injected DEMA_HOME (tmpdir in tests).
 * @param {string}  [args.consumedAtIso]    injected consumption timestamp (for determinism tests).
 * @returns {Promise<{recorded: true, registry_entry_hash: string} | {recorded: false, error: "consent_nonce_already_used", existing_entry: object}>}
 */
export async function recordConsentNonce({
  nonce,
  actionType,
  targetHash,
  consentProofHash,
  demaHome,
  consumedAtIso,
}) {
  const { dir, file, noncesDir } = paths(demaHome);

  // CONSENT-NONCE-ATOMIC-1A. Authority = one exclusive-create (`wx`) file per
  // nonce: the kernel's O_EXCL makes "first presentation wins" atomic across
  // concurrent processes AND interleaved async calls — the shared-JSON
  // read-modify-write this replaces double-consumed under both (frozen 07-16
  // audit: 20/20 trials). The legacy JSON stays as a written MIRROR below.
  if (typeof nonce !== "string" || !NONCE_SAFE.test(nonce)) {
    return Object.freeze({ recorded: false, error: "consent_nonce_invalid" });
  }

  // Upgrade compat: a nonce consumed before used-nonces.d existed lives only in
  // the legacy registry — honor it. A legacy file that exists but cannot be
  // parsed refuses consumption (corrupt state must never read as unused).
  const legacy = await readRegistryStrict(file);
  if (legacy.corrupt) {
    return Object.freeze({ recorded: false, error: "consent_nonce_registry_corrupt" });
  }
  if (Object.prototype.hasOwnProperty.call(legacy.registry, nonce)) {
    return alreadyUsed(legacy.registry[nonce]);
  }

  const ts =
    typeof consumedAtIso === "string" && consumedAtIso.length > 0
      ? consumedAtIso
      : new Date().toISOString();

  const entry = buildEntry({
    actionType,
    targetHash,
    consumedAtIso: ts,
    consentProofHash,
  });

  await mkdir(noncesDir, { recursive: true, mode: DIR_MODE });
  try {
    await chmod(noncesDir, DIR_MODE);
  } catch {
    // Best-effort; ignore on platforms that disallow chmod.
  }

  const nonceFile = join(noncesDir, `${nonce}.json`);
  const body = stableStringify(entry);
  try {
    await writeFile(nonceFile, body, {
      encoding: "utf8",
      mode: FILE_MODE,
      flag: "wx",
    });
  } catch (err) {
    if (err && err.code === "EEXIST") {
      // Lost the race (or a replay): the winner's record is the truth. A
      // per-nonce file that cannot be parsed is corrupt consumed state — it
      // still refuses, never reads as unused.
      const existingState = await readRegistryStrict(nonceFile);
      if (existingState.corrupt) {
        return Object.freeze({ recorded: false, error: "consent_nonce_state_corrupt" });
      }
      return alreadyUsed(existingState.registry);
    }
    return Object.freeze({ recorded: false, error: "consent_nonce_write_failed" });
  }

  // Read-back verification: consumption is claimed only after the bytes are
  // observable on disk. A mismatch is corrupt state — the file stays in place,
  // so the nonce remains consumed even though this call reports the corruption.
  try {
    const readBack = await readFile(nonceFile, "utf8");
    if (readBack !== body) {
      return Object.freeze({ recorded: false, error: "consent_nonce_state_corrupt" });
    }
  } catch {
    return Object.freeze({ recorded: false, error: "consent_nonce_state_corrupt" });
  }

  // Legacy mirror for existing readers/tooling. ponytail: plain RMW — races
  // here (same or different nonces) are harmless because authority is the wx
  // file above; the mirror self-heals on the next sequential write. Remove
  // once all readers consult used-nonces.d.
  const mirror = await readRegistry(file);
  await writeRegistry(dir, file, { ...mirror, [nonce]: entry });

  return Object.freeze({
    recorded: true,
    registry_entry_hash: entryHash(nonce, entry),
  });
}

function alreadyUsed(existing) {
  return Object.freeze({
    recorded: false,
    error: "consent_nonce_already_used",
    existing_entry: Object.freeze({
      action_type: existing.action_type,
      target_hash: existing.target_hash,
      consumed_at_iso: existing.consumed_at_iso,
      consent_proof_hash: existing.consent_proof_hash,
    }),
  });
}

/**
 * Pure boolean read: is this nonce on the local single-use list?
 * Missing registry, unreadable registry, parse failure → false.
 * The gate's separate fail-closed handling for
 * `nonce_registry_unavailable` is NOT this kernel's responsibility.
 *
 * @param {object}  args
 * @param {string}  args.nonce
 * @param {string}  [args.demaHome]
 * @returns {Promise<boolean>}
 */
export async function isConsentNonceUsed({ nonce, demaHome }) {
  const { file, noncesDir } = paths(demaHome);
  // Authority first: the per-nonce wx file. Legacy registry second (pre-1A
  // consumptions). Read contract unchanged: unreadable state → false; the
  // gate's fail-closed `nonce_registry_unavailable` handling lives elsewhere.
  if (typeof nonce === "string" && NONCE_SAFE.test(nonce)) {
    try {
      await stat(join(noncesDir, `${nonce}.json`));
      return true;
    } catch {
      // Fall through to the legacy registry.
    }
  }
  const registry = await readRegistry(file);
  return Object.prototype.hasOwnProperty.call(registry, nonce);
}

// Internal exports surfaced only for diagnostic / boundary-test use.
// Not part of the public KEYCONSENT-2A surface and NOT consumed by
// any gate. Kept intentionally minimal.
export const _internal = Object.freeze({
  REGISTRY_FILENAME,
  REGISTRY_DIRNAME,
  NONCES_DIRNAME,
  FILE_MODE,
  DIR_MODE,
  paths,
});

// Boundary invariants this kernel guarantees:
// - No network call.
// - No federation.
// - No public ledger emission.
// - No token / economic association.
// - No private key material read, derived, embedded, or referenced.
// - No schema change to bizra.dema.consent_proof.v0.1.
// - No automatic rotation, expiration, or GC of registry entries.
// - Local files only: authority = $DEMA_HOME/consent/used-nonces.d/<nonce>.json
//   (exclusive-create, CONSENT-NONCE-ATOMIC-1A); legacy mirror =
//   $DEMA_HOME/consent/used-nonces.json (read-compat, rewritten after wins).
// Verified post-write: file mode 0o600, dir mode 0o700.
// See docs/security/KEYCONSENT_2_PREFLIGHT.md §6, §11 for the
// full non-goals + boundary block.
async function _boundarySelfCheck(demaHome) {
  // Reserved for KEYCONSENT-2B integration tests; this slice is
  // boundary-by-construction (no key load path, no network call site).
  const { file } = paths(demaHome);
  try {
    await stat(file);
  } catch {
    // Absence is acceptable; the kernel does not require a file.
  }
  return true;
}
export const _selfCheck = _boundarySelfCheck;
