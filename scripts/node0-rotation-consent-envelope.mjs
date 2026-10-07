#!/usr/bin/env node
/**
 * Mint the nonce-bearing consent envelope that `dema authorship key rotate`
 * requires, and write it where the ceremony can hand it back.
 *
 * This script authorises ONE rotation of ONE home for a bounded window. It does
 * NOT rotate anything and it NEVER generates or reads key material — the
 * successor keypair is generated inside rotateAuthorshipKey, which is the only
 * place that should ever hold it.
 *
 *   node scripts/node0-rotation-consent-envelope.mjs
 *   node bin/dema authorship key rotate \
 *     --consent "ROTATE AUTHORSHIP KEY" --envelope <printed path>
 *
 * Flags:
 *   --dema-home <path>   default: $DEMA_HOME, else ~/.dema
 *   --out <path>         default: <dema-home>/keys/rotation-consent.json
 *   --ttl-ms <n>         default: 300000 (5 minutes)
 *   --ceremony-id <id>   optional, recorded in the envelope
 *   --reason <text>      optional, recorded in the envelope
 *   --json               machine-readable output
 */

import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

import {
  generateRotationNonce,
  buildRotationConsentEnvelope,
  ROTATION_ENVELOPE_DEFAULT_TTL_MS,
} from "../packages/receipts/src/authorship-rotation-consent-envelope.js";

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const wantJson = argv.includes("--json");

// Resolve exactly as authorship-key-store.js resolveHome() does, so the
// dema_home_hash the validator recomputes matches this one character for
// character. If these two ever drift, rotation refuses — loudly, not silently.
const demaHome = arg("--dema-home") || process.env.DEMA_HOME || join(homedir(), ".dema");

const ttlRaw = arg("--ttl-ms");
const ttlMs = ttlRaw === undefined ? ROTATION_ENVELOPE_DEFAULT_TTL_MS : Number(ttlRaw);
if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
  console.error(`Refused: --ttl-ms must be a positive number, got ${ttlRaw}`);
  process.exit(2);
}

const outPath = arg("--out") || join(demaHome, "keys", "rotation-consent.json");

let envelope;
try {
  envelope = buildRotationConsentEnvelope({
    nonce: generateRotationNonce(),
    demaHome,
    issuedAtIso: new Date().toISOString(),
    ttlMs,
    ceremonyId: arg("--ceremony-id"),
    reason: arg("--reason"),
  });
} catch (error) {
  console.error(`Refused: ${error.message}`);
  process.exit(2);
}

try {
  mkdirSync(dirname(outPath), { recursive: true });
  // tmp+rename so a reader never sees a half-written envelope.
  const tmp = `${outPath}.tmp.${process.pid}.${randomBytes(6).toString("hex")}`;
  writeFileSync(tmp, `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, outPath);
} catch (error) {
  console.error(`Refused: could not write ${outPath}: ${error.message}`);
  process.exit(2);
}

if (wantJson) {
  console.log(JSON.stringify({ envelope_path: outPath, envelope }, null, 2));
} else {
  console.log("Rotation consent envelope minted");
  console.log("=".repeat(48));
  console.log(`  path:       ${outPath}`);
  console.log(`  operation:  ${envelope.operation}`);
  console.log(`  bound home: ${demaHome}`);
  console.log(`  home hash:  ${envelope.dema_home_hash}`);
  console.log(`  issued:     ${envelope.issued_at}`);
  console.log(`  expires:    ${envelope.expires_at}`);
  console.log(`  authority_delta: ${envelope.authority_delta}`);
  console.log("");
  console.log("  Single use. Bound to this home only. Expires as shown.");
  console.log("  It authorises a rotation; it does not perform one. Next:");
  console.log("");
  console.log(`    node bin/dema authorship key rotate \\`);
  console.log(`      --consent "ROTATE AUTHORSHIP KEY" --envelope ${outPath}`);
  console.log("");
  console.log("  No key material was generated or read by this script.");
}
