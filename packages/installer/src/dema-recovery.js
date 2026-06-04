// OPS-READINESS-1A · Recovery manifest kernel.
//
// Closes the last operational-readiness residual by making DEMA_HOME
// backup/restore PROVABLE rather than merely documented. Every file under the
// home is content-addressed (sha256), entries are sorted for a stable manifest,
// and a Merkle-style root_hash binds the whole set. A restored home can then be
// VERIFIED against its manifest — tamper, omission, and unexpected additions are
// all detected, not trusted.
//
// Stands on the existing setup-check integrity pattern (packages/installer/
// src/setup.js sha256File). Reuses sha256/stableStringify from consent-common
// (no duplication). Bounded walk (fail-closed on pathological homes). Local fs
// only — no network, no keys, no consent, no mint.

import { createHash } from "node:crypto";
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { stableStringify } from "../../consent/src/consent-common.js";

export const RECOVERY_MANIFEST_SCHEMA = "bizra.dema.recovery_manifest.v0.1";

// Bounded-walk caps (BIZRA idiom: refuse unbounded work, fail closed).
const MAX_FILES = 20000;
const MAX_DEPTH = 24;

function sha256Bytes(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function toPosix(rel) {
  return sep === "/" ? rel : rel.split(sep).join("/");
}

// Recursively collect every file under `home` as { rel_path, sha256, bytes },
// sorted by rel_path. Throws on a missing home or when caps are exceeded.
function walkFiles(home) {
  if (!existsSync(home) || !statSync(home).isDirectory()) {
    throw new Error(`recovery: home not found or not a directory: ${home}`);
  }
  const out = [];
  const stack = [{ dir: home, depth: 0 }];
  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    if (depth > MAX_DEPTH) {
      throw new RangeError(`recovery: home exceeds max depth ${MAX_DEPTH}`);
    }
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        stack.push({ dir: full, depth: depth + 1 });
      } else if (st.isFile()) {
        if (out.length >= MAX_FILES) {
          throw new RangeError(`recovery: home exceeds max files ${MAX_FILES}`);
        }
        out.push({
          rel_path: toPosix(relative(home, full)),
          sha256: sha256Bytes(readFileSync(full)),
          bytes: st.size,
        });
      }
    }
  }
  out.sort((a, b) =>
    a.rel_path < b.rel_path ? -1 : a.rel_path > b.rel_path ? 1 : 0,
  );
  return out;
}

function rootHashOf(entries) {
  // Bind the whole set: hash the content-addresses + paths, order-independent
  // because entries are pre-sorted.
  return sha256Bytes(
    stableStringify(
      entries.map((e) => ({ rel_path: e.rel_path, sha256: e.sha256 })),
    ),
  );
}

export function buildRecoveryManifest({ home, createdAtIso } = {}) {
  if (typeof home !== "string" || home.length === 0) {
    throw new TypeError("recovery: home (DEMA_HOME path) is required");
  }
  const entries = walkFiles(home).map((e) => Object.freeze(e));
  return Object.freeze({
    schema: RECOVERY_MANIFEST_SCHEMA,
    home,
    created_at_iso: createdAtIso || new Date().toISOString(),
    entries: Object.freeze(entries),
    root_hash: rootHashOf(entries),
    boundary: Object.freeze({
      read_only: true,
      network_used: false,
      private_key_loaded: false,
      receipt_minted: false,
    }),
  });
}

export function verifyAgainstManifest({ home, manifest } = {}) {
  if (
    !manifest ||
    manifest.schema !== RECOVERY_MANIFEST_SCHEMA ||
    Array.isArray(manifest.entries) === false
  ) {
    throw new TypeError(
      "recovery: a valid manifest (from buildRecoveryManifest) is required",
    );
  }
  const current = walkFiles(home);
  const currentMap = new Map(current.map((e) => [e.rel_path, e.sha256]));
  const manifestMap = new Map(
    manifest.entries.map((e) => [e.rel_path, e.sha256]),
  );

  const mismatched = [];
  const missing = [];
  const extra = [];

  for (const [rel, sha] of manifestMap) {
    if (currentMap.has(rel) === false) {
      missing.push(rel);
    } else if (currentMap.get(rel) !== sha) {
      mismatched.push(rel);
    }
  }
  for (const rel of currentMap.keys()) {
    if (manifestMap.has(rel) === false) extra.push(rel);
  }

  const root_hash_match = rootHashOf(current) === manifest.root_hash;
  const verified =
    mismatched.length === 0 &&
    missing.length === 0 &&
    extra.length === 0 &&
    root_hash_match;

  return Object.freeze({
    schema: "bizra.dema.recovery_verification.v0.1",
    verified,
    root_hash_match,
    expected_root_hash: manifest.root_hash,
    actual_root_hash: rootHashOf(current),
    mismatched: Object.freeze(mismatched.sort()),
    missing: Object.freeze(missing.sort()),
    extra: Object.freeze(extra.sort()),
  });
}
