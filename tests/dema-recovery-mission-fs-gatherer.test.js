import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  gatherRecoveryMissionFiles,
  RecoveryMissionGatherCapExceededError,
} from "../apps/cli/src/commands/dema-recovery-mission-fs-gatherer.js";

/** A throwaway tree; `link` describes an optional symlink to plant. */
function fixture({ link } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "recovery-fs-"));
  mkdirSync(join(dir, "sub"), { recursive: true });
  writeFileSync(join(dir, "real.txt"), "ROOT-LEVEL");
  writeFileSync(join(dir, "sub", "nested.txt"), "NESTED");
  if (link) symlinkSync(link.target, join(dir, link.at));
  return dir;
}

const paths = (rows) => rows.map((r) => r.relative_path).sort();

// The walk recurses into directories but the max_files cap only advances when a
// REGULAR FILE is pushed. A directory cycle therefore never trips the cap: with
// no visited set the walk spins until the stack dies. The timeout keeps a
// regression from hanging the whole suite.
test("a directory symlink pointing at its own ancestor terminates", { timeout: 30_000 }, () => {
  const dir = fixture({ link: { at: join("sub", "loop"), target: ".." } });
  try {
    const rows = gatherRecoveryMissionFiles({ root: dir });
    assert.deepEqual(paths(rows), ["real.txt", "sub/nested.txt"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a self-referential directory symlink terminates", { timeout: 30_000 }, () => {
  const dir = fixture({ link: { at: join("sub", "self"), target: "." } });
  try {
    const rows = gatherRecoveryMissionFiles({ root: dir });
    assert.deepEqual(paths(rows), ["real.txt", "sub/nested.txt"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("every real file is collected exactly once despite a cycle", { timeout: 30_000 }, () => {
  const dir = fixture({ link: { at: join("sub", "loop"), target: ".." } });
  try {
    const rows = gatherRecoveryMissionFiles({ root: dir });
    assert.equal(new Set(paths(rows)).size, rows.length, "a file was collected twice");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a symlink whose target escapes the declared root is never walked", () => {
  const outside = mkdtempSync(join(tmpdir(), "recovery-outside-"));
  writeFileSync(join(outside, "secret.txt"), "OUTSIDE-THE-ROOT");
  const dir = fixture({ link: { at: "escape", target: outside } });
  try {
    const rows = gatherRecoveryMissionFiles({ root: dir });
    assert.deepEqual(paths(rows), ["real.txt", "sub/nested.txt"]);
    assert.ok(!rows.some((r) => r.relative_path.includes("secret")), "the walk left the declared root");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("the max_files cap still fails closed rather than truncating", () => {
  const dir = fixture();
  try {
    assert.throws(
      () => gatherRecoveryMissionFiles({ root: dir, maxFiles: 1 }),
      RecoveryMissionGatherCapExceededError,
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("metadata only — no file content reaches a row", () => {
  const dir = fixture();
  try {
    const rows = gatherRecoveryMissionFiles({ root: dir });
    assert.ok(rows.length > 0);
    for (const r of rows) {
      assert.deepEqual(
        Object.keys(r).sort(),
        ["extension", "mtime_iso", "relative_path", "root", "size_bytes"],
      );
      assert.ok(!JSON.stringify(r).includes("ROOT-LEVEL"), "file content leaked into a row");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
