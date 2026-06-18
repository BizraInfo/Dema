// KERNEL-PURITY-GATE-1A — test-first.
// Proves a read-only gate that fails when a kernel-tier module imports a
// side-effect surface (node:fs/net/http/https/child_process or global fetch)
// without an explicit I/O-tier allowlist entry.
//
// Why: Dema mechanically gates *claims* (claim-register R4) and *consent*
// (exact-string). Effects on the canonical 16-key boundary were mostly
// absence-guaranteed, not mechanically scanned. This gate scans them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  checkKernelPurity,
  SCHEMA,
  FORBIDDEN_TOKENS,
} from "../scripts/review/kernel-purity-check.mjs";

const SCRIPT = fileURLToPath(
  new URL("../scripts/review/kernel-purity-check.mjs", import.meta.url),
);

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "kpc-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  return dir;
}
function withFixture(files, fn) {
  const dir = fixture(files);
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("contract: schema + forbidden-token vocabulary are stable and frozen", () => {
  assert.equal(SCHEMA, "bizra.dema.review.kernel_purity.v0.1");
  for (const t of [
    "node:fs",
    "node:net",
    "node:http",
    "node:https",
    "node:child_process",
    "fetch",
  ]) {
    assert.ok(FORBIDDEN_TOKENS.includes(t), `missing forbidden token ${t}`);
  }
  assert.ok(Object.isFrozen(FORBIDDEN_TOKENS));
});

test("node:fs import in a kernel module → violation with file/token/line/reason", () => {
  withFixture(
    {
      "dirty.js":
        'import { readFileSync } from "node:fs";\nexport const x = 1;\n',
      "clean.js": "export const y = 2;\n",
    },
    (dir) => {
      const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 1);
      const v = r.violations[0];
      assert.equal(v.file, "dirty.js");
      assert.equal(v.token, "node:fs");
      assert.equal(v.line, 1);
      assert.ok(v.reason.length > 0);
    },
  );
});

test("allowlisted I/O module is exempt → ok:true and reported as allowlisted", () => {
  withFixture(
    { "dirty.js": 'import { readFileSync } from "node:fs";\n' },
    (dir) => {
      const r = checkKernelPurity({
        scanDir: dir,
        allowlist: { "dirty.js": "intentional I/O" },
      });
      assert.equal(r.ok, true);
      assert.equal(r.violation_count, 0);
      assert.equal(r.allowlisted.length, 1);
      assert.equal(r.allowlisted[0].file, "dirty.js");
      assert.deepEqual(r.allowlisted[0].tokens, ["node:fs"]);
      assert.ok(r.allowlisted[0].reason.length > 0);
    },
  );
});

test("global fetch() is forbidden", () => {
  withFixture(
    { "net.js": "export async function go(u) { return await fetch(u); }\n" },
    (dir) => {
      const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violations[0].token, "fetch");
    },
  );
});

test("prose mentioning 'fetch (' (space before paren) is NOT a call → not flagged", () => {
  // Real fetch calls are `fetch(` with no space (Prettier/ESLint enforce it).
  // `fetch (` only occurs in descriptive strings/prose. Regression guard for the
  // pat-research-companion.js false positive caught on the live tree.
  withFixture(
    {
      "desc.js":
        'export const d = "requests bounded web fetch (when C10 lands)";\n',
    },
    (dir) => {
      const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test("net/http/https/child_process + require() + dynamic import() are all detected", () => {
  withFixture(
    {
      "a.js": 'import net from "node:net";\n',
      "b.js": 'import http from "node:http";\n',
      "c.js": 'import https from "node:https";\n',
      "d.js": 'import cp from "node:child_process";\n',
      "e.js": 'const fs = require("node:fs");\n',
      "f.js": 'const p = import("node:net");\n',
    },
    (dir) => {
      const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
      const tokens = new Set(r.violations.map((v) => v.token));
      for (const t of [
        "node:net",
        "node:http",
        "node:https",
        "node:child_process",
        "node:fs",
      ]) {
        assert.ok(tokens.has(t), `expected detection of ${t}`);
      }
      assert.equal(r.ok, false);
    },
  );
});

test("bare side-effect import (import 'node:fs') is detected", () => {
  withFixture({ "g.js": 'import "node:fs";\n' }, (dir) => {
    const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
    assert.equal(r.violations[0].token, "node:fs");
  });
});

test("1B: multi-line import of node:fs is detected (not just single-line)", () => {
  withFixture(
    {
      "multi.js":
        'import {\n  readFileSync,\n  writeFileSync,\n} from "node:fs";\nexport const x = 1;\n',
    },
    (dir) => {
      const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.ok(r.violations.some((v) => v.token === "node:fs"));
    },
  );
});

test("1B: namespaced globalThis.fetch( / window.fetch( are detected", () => {
  withFixture(
    {
      "gt.js": "export const a = (u) => globalThis.fetch(u);\n",
      "wn.js": "export const b = (u) => window.fetch(u);\n",
    },
    (dir) => {
      const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      const fetchFiles = new Set(
        r.violations.filter((v) => v.token === "fetch").map((v) => v.file),
      );
      assert.ok(fetchFiles.has("gt.js"));
      assert.ok(fetchFiles.has("wn.js"));
    },
  );
});

test("a genuinely pure module yields zero violations", () => {
  withFixture({ "pure.js": "export const z = () => 1 + 2;\n" }, (dir) => {
    const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
    assert.equal(r.ok, true);
    assert.equal(r.scanned_count, 1);
    assert.equal(r.violation_count, 0);
  });
});

test("*.test.js files are excluded from the scan", () => {
  withFixture(
    {
      "foo.test.js": 'import { readFileSync } from "node:fs";\n',
      "pure.js": "export const z = 1;\n",
    },
    (dir) => {
      const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
      assert.equal(r.scanned_count, 1);
      assert.equal(r.ok, true);
    },
  );
});

test("commented-out imports are not flagged", () => {
  withFixture(
    { "c.js": '// import { x } from "node:fs";\nexport const z = 1;\n' },
    (dir) => {
      const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test("very long minified lines are skipped without hanging (bounded scan)", () => {
  withFixture(
    { "min.js": 'const s = "' + "a".repeat(2100) + '";\n' },
    (dir) => {
      const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test("report is read-only, frozen, and writes nothing", () => {
  withFixture({ "pure.js": "export const z = 1;\n" }, (dir) => {
    const before = readdirSync(dir).length;
    const r = checkKernelPurity({ scanDir: dir, allowlist: {} });
    assert.equal(r.read_only, true);
    assert.ok(Object.isFrozen(r));
    assert.ok(Object.isFrozen(r.violations));
    assert.ok(Object.isFrozen(r.allowlisted));
    assert.equal(readdirSync(dir).length, before, "gate must not write files");
  });
});

test("stale allowlist entry (no matching forbidden import) is surfaced, not fatal", () => {
  withFixture({ "pure.js": "export const z = 1;\n" }, (dir) => {
    const r = checkKernelPurity({
      scanDir: dir,
      allowlist: { "ghost.js": "no longer present" },
    });
    assert.deepEqual(r.stale_allowlist, ["ghost.js"]);
    assert.equal(r.ok, true);
  });
});

test("real tree: scans packages/core/src and classifies system-snapshot.js as allowlisted I/O", () => {
  const r = checkKernelPurity(); // defaults: real packages/core/src + seed allowlist
  assert.equal(r.schema, SCHEMA);
  assert.ok(r.scanned_count > 0);
  assert.ok(
    r.allowlisted.some((a) => a.file === "system-snapshot.js"),
    "system-snapshot.js should be in the seed I/O allowlist",
  );
  assert.ok(!r.stale_allowlist.includes("system-snapshot.js"));
  assert.ok(!r.violations.some((v) => v.file === "system-snapshot.js"));
});

test("real tree is fully allowlisted (ok:true) — IO_TIER_ALLOWLIST finalized (acceptance #8)", () => {
  const r = checkKernelPurity();
  assert.equal(r.ok, true);
  assert.equal(r.violation_count, 0);
});

test("CLI: --json on a violating fixture exits non-zero and reports ok:false", () => {
  withFixture(
    { "dirty.js": 'import { readFileSync } from "node:fs";\n' },
    (dir) => {
      let threw = false;
      let out = "";
      try {
        execFileSync("node", [SCRIPT, "--scan-dir", dir, "--json"], {
          encoding: "utf8",
        });
      } catch (e) {
        threw = true;
        out = e.stdout || "";
      }
      assert.ok(threw, "CLI must exit non-zero on violation");
      assert.match(out, /"ok": false/);
    },
  );
});

test("CLI: --json on a clean fixture exits zero with ok:true", () => {
  withFixture({ "pure.js": "export const z = 1;\n" }, (dir) => {
    const out = execFileSync("node", [SCRIPT, "--scan-dir", dir, "--json"], {
      encoding: "utf8",
    });
    assert.equal(JSON.parse(out).ok, true);
  });
});

test("CLI: human output on a violating fixture names the file and exits non-zero", () => {
  withFixture(
    { "dirty.js": 'import { readFileSync } from "node:fs";\n' },
    (dir) => {
      let threw = false;
      let out = "";
      try {
        execFileSync("node", [SCRIPT, "--scan-dir", dir], { encoding: "utf8" });
      } catch (e) {
        threw = true;
        out = e.stdout || "";
      }
      assert.ok(threw);
      assert.match(out, /VIOLATIONS/);
      assert.match(out, /dirty\.js/);
    },
  );
});

test("CLI: human output surfaces a stale allowlist entry on a clean fixture", () => {
  // The default allowlist names system-snapshot.js, absent from this fixture →
  // reported stale; exercises the human stale-warning branch, exits zero.
  withFixture({ "pure.js": "export const z = 1;\n" }, (dir) => {
    const out = execFileSync("node", [SCRIPT, "--scan-dir", dir], {
      encoding: "utf8",
    });
    assert.match(out, /stale allowlist/);
    assert.match(out, /system-snapshot\.js/);
  });
});
