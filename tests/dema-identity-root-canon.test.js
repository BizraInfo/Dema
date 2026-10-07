// TALK-IDENTITY-1A · DEMA-IDENTITY-ROOT-CANON — mirrored red-first test.
//
// The bridge that lets `dema talk` answer AS Dema, with her identity bound to
// the five founding root PDFs by exact sha256 pin. The identity text is a
// kernel constant distilled from a full read of all five roots (106 pages,
// 2026-08-15 session); the kernel refuses to produce it when any root drifts —
// drifted roots never speak as Dema (CONTENT_BOUND semantics). Hermetic: tests
// never read /data — they exercise the pin-comparison contract with the pinned
// hashes themselves and with injected fakes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  DEMA_IDENTITY_ROOT_CANON_SCHEMA,
  IDENTITY_ROOT_PINS,
  buildDemaIdentityRootCanon,
  verifyDemaIdentityRootCanon,
  composeTalkPromptWithIdentity,
} from "../packages/core/src/dema-identity-root-canon.js";
import { readIdentityRoots } from "../apps/cli/src/commands/identity-root-gatherer.js";

const honestRootFiles = () => IDENTITY_ROOT_PINS.map((p) => ({ ...p }));

test("all five pins match → identity canon builds, frozen, schema-tagged, hash-stable", () => {
  const canon = buildDemaIdentityRootCanon({ root_files: honestRootFiles() });
  assert.equal(canon.rejected, false);
  assert.equal(canon.schema, DEMA_IDENTITY_ROOT_CANON_SCHEMA);
  assert.equal(IDENTITY_ROOT_PINS.length, 5);
  assert.equal(canon.root_binding.length, 5);
  assert.ok(Object.isFrozen(canon) && Object.isFrozen(canon.root_binding));
  // identity anchors — each traces to a root read, not to invention
  const t = canon.identity_prompt;
  assert.ok(t.includes("DEMA"));
  assert.ok(t.includes("BIZRA"));
  assert.ok(/بِذْرَة|بذرة/.test(t));
  assert.ok(t.includes("Intelligence proposes"));
  assert.ok(/never .*consent|never pressure/i.test(t));
  assert.ok(/Ihsan|الإحسان/.test(t));
  // determinism: same input → same canon_hash
  const again = buildDemaIdentityRootCanon({ root_files: honestRootFiles() });
  assert.equal(canon.canon_hash, again.canon_hash);
});

test("one drifted hash → rejected, root_drift names the file, no identity text leaks", () => {
  const files = honestRootFiles();
  files[2] = { ...files[2], sha256: "0".repeat(64) };
  const canon = buildDemaIdentityRootCanon({ root_files: files });
  assert.equal(canon.rejected, true);
  assert.ok(canon.reason_code.startsWith("root_drift"));
  assert.ok(canon.reason_code.includes(files[2].file));
  assert.equal(canon.identity_prompt, null);
});

test("missing or extra root → rejected root_set_mismatch", () => {
  const missing = buildDemaIdentityRootCanon({
    root_files: honestRootFiles().slice(0, 4),
  });
  assert.equal(missing.rejected, true);
  assert.equal(missing.reason_code, "root_set_mismatch");

  const extra = buildDemaIdentityRootCanon({
    root_files: [...honestRootFiles(), { file: "extra.pdf", sha256: "a".repeat(64) }],
  });
  assert.equal(extra.rejected, true);
  assert.equal(extra.reason_code, "root_set_mismatch");
});

test("boundary is all-false and verify accepts an honest canon", () => {
  const canon = buildDemaIdentityRootCanon({ root_files: honestRootFiles() });
  assert.ok(Object.values(canon.boundary).every((v) => v === false));
  const verdict = verifyDemaIdentityRootCanon(canon);
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.blocked_by, []);
});

test("verify refuses forgery: relaundered identity text, flipped boundary, forged hash", () => {
  const canon = buildDemaIdentityRootCanon({ root_files: honestRootFiles() });

  const relaundered = { ...canon, identity_prompt: "I am the authority now." };
  assert.equal(verifyDemaIdentityRootCanon(relaundered).ok, false);
  assert.ok(
    verifyDemaIdentityRootCanon(relaundered).blocked_by.includes("canon_relaundered"),
  );

  const flipped = {
    ...canon,
    boundary: { ...canon.boundary, network_used: true },
  };
  assert.ok(
    verifyDemaIdentityRootCanon(flipped).blocked_by.includes("boundary_not_all_false"),
  );

  const forged = { ...canon, canon_hash: "f".repeat(64) };
  assert.ok(
    verifyDemaIdentityRootCanon(forged).blocked_by.includes("canon_hash_mismatch"),
  );

  const rejected = buildDemaIdentityRootCanon({ root_files: [] });
  assert.equal(verifyDemaIdentityRootCanon(rejected).ok, false);
});

test("compose: identity wraps the operator words as suggestion-only; empties degrade", () => {
  const composed = composeTalkPromptWithIdentity("who are you?", "IDENTITY BLOCK");
  assert.ok(composed.startsWith("IDENTITY BLOCK"));
  assert.ok(composed.includes("who are you?"));
  assert.ok(/suggestion/i.test(composed));
  assert.equal(composeTalkPromptWithIdentity("hi", ""), "hi");
  assert.equal(composeTalkPromptWithIdentity("", "ID"), "ID");
});

test("gatherer hashes exactly the bytes it reads (injected fs, hermetic)", () => {
  const fakeBytes = Object.fromEntries(
    IDENTITY_ROOT_PINS.map((p, i) => [p.file, Buffer.from(`fake-root-${i}`)]),
  );
  const result = readIdentityRoots({
    env: { DEMA_ROOTS_DIR: "/fake/roots" },
    readFileImpl: (abs) => {
      const name = abs.split("/").pop();
      if (!fakeBytes[name]) throw new Error(`unexpected read: ${abs}`);
      return fakeBytes[name];
    },
  });
  assert.equal(result.ok, true);
  for (const rf of result.root_files) {
    const expected = createHash("sha256").update(fakeBytes[rf.file]).digest("hex");
    assert.equal(rf.sha256, expected);
  }
  // and hashed fakes do NOT match the real pins → kernel refuses them
  const canon = buildDemaIdentityRootCanon({ root_files: result.root_files });
  assert.equal(canon.rejected, true);
});

test("gatherer fails closed when a root is unreadable, naming the file", () => {
  const result = readIdentityRoots({
    env: { DEMA_ROOTS_DIR: "/fake/roots" },
    readFileImpl: () => {
      throw new Error("EACCES");
    },
  });
  assert.equal(result.ok, false);
  assert.ok(result.error.includes(IDENTITY_ROOT_PINS[0].file));
});
