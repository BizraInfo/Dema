import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  RECOVERY_MANIFEST_SCHEMA,
  buildRecoveryManifest,
  verifyAgainstManifest,
} from "../packages/installer/src/dema-recovery.js";

// OPS-READINESS-1A · recovery manifest kernel tests.
//
// The proof gap: recovery was documented but not provable. This kernel makes a
// DEMA_HOME backup/restore RE-DERIVABLE and TAMPER-EVIDENT — every file is
// content-addressed (sha256) and the manifest carries a Merkle-style root_hash,
// so a restore can be verified, not merely trusted. Local-only, no network.

const HEX64 = /^[0-9a-f]{64}$/;

function seedHome() {
  const home = mkdtempSync(join(tmpdir(), "dema-recovery-"));
  mkdirSync(join(home, "receipts"), { recursive: true });
  writeFileSync(join(home, "profile.json"), JSON.stringify({ a: 1 }));
  writeFileSync(join(home, "receipts", "r1.json"), "receipt-content");
  return home;
}

test("RECOVERY_MANIFEST_SCHEMA is the versioned schema id", () => {
  assert.equal(RECOVERY_MANIFEST_SCHEMA, "bizra.dema.recovery_manifest.v0.1");
});

test("buildRecoveryManifest content-addresses every file with a deterministic root_hash", () => {
  const home = seedHome();
  try {
    const m = buildRecoveryManifest({ home });
    assert.ok(Object.isFrozen(m));
    assert.equal(m.schema, RECOVERY_MANIFEST_SCHEMA);
    assert.equal(m.entries.length, 2); // profile.json + receipts/r1.json
    for (const e of m.entries) {
      assert.match(e.sha256, HEX64);
      assert.ok(Number.isInteger(e.bytes) && e.bytes >= 0);
      assert.ok(typeof e.rel_path === "string" && e.rel_path.length > 0);
    }
    assert.match(m.root_hash, HEX64);
    // Deterministic: the same home re-manifests to the same root_hash.
    assert.equal(buildRecoveryManifest({ home }).root_hash, m.root_hash);
    // Entries are sorted by rel_path for a stable manifest.
    const paths = m.entries.map((e) => e.rel_path);
    assert.deepEqual([...paths].sort(), paths);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("verifyAgainstManifest: untouched home → verified, root_hash matches", () => {
  const home = seedHome();
  try {
    const m = buildRecoveryManifest({ home });
    const v = verifyAgainstManifest({ home, manifest: m });
    assert.ok(Object.isFrozen(v));
    assert.equal(v.verified, true);
    assert.equal(v.root_hash_match, true);
    assert.deepEqual(v.mismatched, []);
    assert.deepEqual(v.missing, []);
    assert.deepEqual(v.extra, []);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("verifyAgainstManifest: a tampered file → verified false + listed in mismatched", () => {
  const home = seedHome();
  try {
    const m = buildRecoveryManifest({ home });
    writeFileSync(join(home, "profile.json"), JSON.stringify({ a: 999 }));
    const v = verifyAgainstManifest({ home, manifest: m });
    assert.equal(v.verified, false);
    assert.equal(v.root_hash_match, false);
    assert.ok(v.mismatched.includes("profile.json"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("verifyAgainstManifest: a missing file (incomplete restore) → listed in missing", () => {
  const home = seedHome();
  try {
    const m = buildRecoveryManifest({ home });
    rmSync(join(home, "receipts", "r1.json"));
    const v = verifyAgainstManifest({ home, manifest: m });
    assert.equal(v.verified, false);
    assert.ok(v.missing.includes("receipts/r1.json"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("verifyAgainstManifest: an unexpected extra file → listed in extra", () => {
  const home = seedHome();
  try {
    const m = buildRecoveryManifest({ home });
    writeFileSync(join(home, "receipts", "rogue.json"), "unexpected");
    const v = verifyAgainstManifest({ home, manifest: m });
    assert.equal(v.verified, false);
    assert.ok(v.extra.includes("receipts/rogue.json"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("buildRecoveryManifest fail-closed on a missing home", () => {
  assert.throws(() =>
    buildRecoveryManifest({ home: "/nonexistent/dema-xyz-abc" }),
  );
});
