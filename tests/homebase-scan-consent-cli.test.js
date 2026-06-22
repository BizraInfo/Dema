// HOMEBASE-SCAN-CONSENT-1A — `dema scan` CLI smoke tests.
// Spawns the real CLI against a fixture homebase root + temp DEMA_HOME so the
// consent gate + the existing metadata-only scanner are exercised end-to-end
// WITHOUT touching the operator's real ~/Downloads. The scan must run only on
// the exact phrase, must stay metadata-only, and must write only under DEMA_HOME.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));
const PHRASE = "GO: scan homebase metadata only";

function withFixture(fn) {
  const home = mkdtempSync(join(tmpdir(), "hsc-home-"));
  const root = mkdtempSync(join(tmpdir(), "hsc-root-"));
  mkdirSync(join(root, "proj"));
  writeFileSync(join(root, "proj", "a.js"), "x");
  writeFileSync(join(root, "notes.md"), "y");
  try {
    return fn({ home, root });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
}

function runScan({ home, root }, args = []) {
  return execFileSync("node", [BIN, "scan", ...args], {
    encoding: "utf8",
    env: { ...process.env, DEMA_HOME: home, DEMA_LOCAL_ASSET_ROOT: root },
  });
}

function inventoryExists(home) {
  return existsSync(join(home, "realm", "local-assets", "inventory-v0.1.json"));
}

test("no consent → ceremony shown, scan NOT performed, no inventory written", () => {
  withFixture((fx) => {
    const d = JSON.parse(runScan(fx, ["--json"]));
    assert.equal(d.scan_allowed, false);
    assert.equal(d.scan_performed, false);
    assert.equal(d.scan_result, null);
    assert.equal(inventoryExists(fx.home), false);
  });
});

test("wrong consent → exits non-zero (1), refuses, no scan, no inventory", () => {
  withFixture((fx) => {
    let threw = false;
    let code = 0;
    try {
      runScan(fx, ["--consent", "scan please"]);
    } catch (e) {
      threw = true;
      code = e.status;
    }
    assert.ok(threw, "wrong consent must exit non-zero");
    assert.equal(code, 1);
    assert.equal(inventoryExists(fx.home), false);
  });
});

test("exact consent → metadata scan runs, inventory written, no file content read", () => {
  withFixture((fx) => {
    const d = JSON.parse(runScan(fx, ["--consent", PHRASE, "--json"]));
    assert.equal(d.scan_performed, true);
    assert.equal(d.scan_result.written, true);
    assert.equal(d.scan_result.boundary.file_content_read, false);
    assert.equal(d.scan_result.boundary.scanned_root_mutated, false);
    assert.equal(d.scan_result.boundary.symlink_followed, false);
    assert.equal(d.scan_result.boundary.network_used, false);
    assert.equal(d.scan_result.boundary.model_invoked, false);
    assert.ok(d.scan_result.inventory.summary.records_count >= 1);
    assert.equal(inventoryExists(fx.home), true);
  });
});

test("human ceremony discloses no-content / no-upload / the exact phrase", () => {
  withFixture((fx) => {
    const out = runScan(fx);
    assert.match(out, /NOT read file contents/i);
    assert.match(out, /NOT upload/i);
    assert.match(out, /GO: scan homebase metadata only/);
  });
});
