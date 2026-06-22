// NODE0-WOW-REPORT-1A — `dema mirror` CLI smoke tests.
// Exercises the real read path: scan a fixture homebase (writes the inventory
// under a temp DEMA_HOME), then mirror it. This is the integration that catches
// inventory-shape drift the pure-kernel test cannot (the kernel test feeds a
// hand-built fixture; only the real artifact reveals a schema mismatch).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));
const PHRASE = "GO: scan homebase metadata only";

function mirror(home, args = []) {
  return execFileSync("node", [BIN, "mirror", ...args], {
    encoding: "utf8",
    env: { ...process.env, DEMA_HOME: home },
  });
}

function withScannedHome(fn) {
  const home = mkdtempSync(join(tmpdir(), "wow-home-"));
  const root = mkdtempSync(join(tmpdir(), "wow-root-"));
  mkdirSync(join(root, "proj"));
  writeFileSync(join(root, "proj", "a.js"), "x");
  writeFileSync(join(root, "readme.md"), "d");
  // Produce a REAL inventory artifact via the consented scan.
  execFileSync("node", [BIN, "scan", "--consent", PHRASE, "--json"], {
    encoding: "utf8",
    env: { ...process.env, DEMA_HOME: home, DEMA_LOCAL_ASSET_ROOT: root },
  });
  try {
    return fn({ home, root });
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
}

test("no inventory → mirror fails closed with a 'run dema scan' hint", () => {
  const home = mkdtempSync(join(tmpdir(), "wow-empty-"));
  try {
    const d = JSON.parse(mirror(home, ["--json"]));
    assert.equal(d.valid, false);
    assert.match(d.hint.join(" "), /dema scan/i);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("after a real scan → mirror renders the story from the actual artifact", () => {
  withScannedHome(({ home }) => {
    const d = JSON.parse(mirror(home, ["--json"]));
    assert.equal(d.valid, true, JSON.stringify(d).slice(0, 200));
    assert.ok(d.category_story.length >= 1);
    assert.ok(d.totals.records >= 1);
  });
});

test("the rendered help is honest — no overclaim; not_yet names the gaps", () => {
  withScannedHome(({ home }) => {
    const d = JSON.parse(mirror(home, ["--json"]));
    const help = d.can_help_today.join(" ");
    assert.doesNotMatch(help, /analyze.*content|build (your|it)|run your code/i);
    assert.match(d.not_yet_available.join(" "), /content|model/i);
  });
});

test("mirror is read-only — boundary reports no scan / model / content read", () => {
  withScannedHome(({ home }) => {
    const d = JSON.parse(mirror(home, ["--json"]));
    assert.equal(d.boundary.homebase_scan_performed, false);
    assert.equal(d.boundary.file_content_read, false);
    assert.equal(d.boundary.model_invoked, false);
  });
});

test("human mirror states what is NOT yet possible (honest, no zann)", () => {
  withScannedHome(({ home }) => {
    const out = mirror(home);
    assert.match(out, /Not yet/i);
    assert.match(out, /metadata only/i);
  });
});
