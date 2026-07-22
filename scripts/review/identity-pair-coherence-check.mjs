#!/usr/bin/env node
// IDENTITY-PAIR-COHERENCE-1A static gate.
//
// A signing consumer must obtain its identity through ONE call to
// loadActiveKeyPair(). Any production module that references BOTH
// loadPrivateKey and loadPublicKey can straddle an active-generation
// transition and combine key material from two identities — the exact
// defect this gate exists to keep extinct after the 25-consumer migration.
//
// Scope: packages/ and apps/ source files. Test files may compose loaders
// freely against their own fixtures. The key store itself defines the
// wrappers and is allowlisted.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_ROOTS = ["packages", "apps"];
const SOURCE_EXTENSIONS = new Set([".js", ".mjs"]);
const ALLOWLIST = new Set([
  // Defines loadActiveKeyPair and the legacy wrappers themselves.
  "packages/receipts/src/authorship-key-store.js",
]);

// The key store owns the constants + migration. observe-gatherer is the one
// content-free observation surface that legitimately names the legacy flat
// pub-key for a pre-migration PRESENCE fallback (symlink-safe existsSync/lstat,
// never a content read — see Finding #5). Every other module reaches identity
// through loadActiveKeyPair() / inspectActiveIdentity().
const LEGACY_PATH_ALLOWLIST = new Set([
  "packages/receipts/src/authorship-key-store.js",
  "apps/cli/src/commands/observe-gatherer.js",
]);

const PRIVATE_REF = /\bloadPrivateKey\b/;
const PUBLIC_REF = /\bloadPublicKey\b/;
// Finding (gate narrower than invariant): direct references to the legacy
// authority filenames are a split-loader path the name-based check above
// misses. Reject them outside the allowlist.
const LEGACY_FILENAME_REF = /node0-ed25519(?:\.pub)?\.pem/;

function extension(path) {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function walk(dir, root, files) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      walk(path, root, files);
    } else if (SOURCE_EXTENSIONS.has(extension(entry))) {
      files.push(relative(root, path).split("\\").join("/"));
    }
  }
}

export async function runIdentityPairCoherenceCheck({ extraFiles = [] } = {}) {
  const files = [];
  for (const scanRoot of SCAN_ROOTS) {
    const absolute = join(REPO_ROOT, scanRoot);
    if (!existsSync(absolute)) continue;
    walk(absolute, REPO_ROOT, files);
  }

  const violations = [];
  const scan = (file, body) => {
    if (!ALLOWLIST.has(file) && PRIVATE_REF.test(body) && PUBLIC_REF.test(body)) {
      violations.push({ file, kind: "separate_pair_loaders" });
    }
    if (!LEGACY_PATH_ALLOWLIST.has(file) && LEGACY_FILENAME_REF.test(body)) {
      violations.push({ file, kind: "direct_legacy_key_path" });
    }
  };

  for (const file of files) {
    scan(file, readFileSync(join(REPO_ROOT, file), "utf8"));
  }
  for (const file of extraFiles) {
    // extraFiles (test synthetics) are keyed by basename so allowlist entries
    // never accidentally match them.
    scan(file, readFileSync(isAbsolute(file) ? file : join(REPO_ROOT, file), "utf8"));
  }

  return Object.freeze({
    schema: "bizra.dema.identity_pair_coherence_check.v0.1",
    ok: violations.length === 0,
    scanned: files.length,
    allowlisted: ALLOWLIST.size,
    legacy_path_allowlisted: LEGACY_PATH_ALLOWLIST.size,
    violations,
    boundary: Object.freeze({
      runtime_execution: false,
      mutation_performed: false,
      network_used: false,
    }),
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const report = await runIdentityPairCoherenceCheck();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
