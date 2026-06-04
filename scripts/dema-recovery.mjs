#!/usr/bin/env node
// OPS-READINESS-1A · runnable recovery manifest / verify.
//
//   node scripts/dema-recovery.mjs backup [--out manifest.json]
//     → content-address every file under DEMA_HOME, write a signed-by-hash
//       manifest (bizra.dema.recovery_manifest.v0.1). Print the operator copy
//       command (the manifest proves integrity; tar/cp moves the bytes).
//
//   node scripts/dema-recovery.mjs verify <manifest.json>
//     → re-derive hashes for the current DEMA_HOME and verify against the
//       manifest. Exit 1 on any tamper / missing / extra file.
//
// Read-only except for writing the manifest file in backup mode. No network,
// no keys, no consent, no mint.

import { writeFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  buildRecoveryManifest,
  verifyAgainstManifest,
} from "../packages/installer/src/dema-recovery.js";

const HOME = process.env.DEMA_HOME || join(homedir(), ".dema");
const argv = process.argv.slice(2);
const mode = argv[0];

function argValue(name, fallback) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}

function backup() {
  const manifest = buildRecoveryManifest({ home: HOME });
  const out = argValue("--out", null);
  const json = JSON.stringify(manifest, null, 2);
  if (out) {
    writeFileSync(out, json + "\n");
    console.log(`DEMA · Recovery backup manifest written: ${out}`);
  } else {
    process.stdout.write(json + "\n");
  }
  console.error(
    [
      `  home:       ${HOME}`,
      `  files:      ${manifest.entries.length}`,
      `  root_hash:  ${manifest.root_hash}`,
      `  next:       tar -czf dema-backup.tgz -C "${HOME}" .   # then store the manifest beside it`,
      `  restore:    tar -xzf dema-backup.tgz -C "$DEMA_HOME"  # then: verify <manifest>`,
    ].join("\n"),
  );
}

function verify() {
  const path = argv[1];
  if (!path) {
    console.error("usage: dema-recovery.mjs verify <manifest.json>");
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const result = verifyAgainstManifest({ home: HOME, manifest });
  console.log("DEMA · Recovery verify (OPS-READINESS-1A)");
  console.log(`  home:      ${HOME}`);
  console.log(`  verdict:   ${result.verified ? "VERIFIED" : "FAILED"}`);
  console.log(`  root_hash: ${result.root_hash_match ? "MATCH" : "MISMATCH"}`);
  for (const k of ["mismatched", "missing", "extra"]) {
    if (result[k].length) console.log(`  ${k}: ${result[k].join(", ")}`);
  }
  if (!result.verified) process.exitCode = 1;
}

if (mode === "backup") backup();
else if (mode === "verify") verify();
else {
  console.error(
    "usage: dema-recovery.mjs backup [--out file] | verify <manifest.json>",
  );
  process.exit(2);
}
