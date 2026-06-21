// NEGATIVE-VERDICT-REASON-GATE-1A — test-first.
// Proves a read-only gate that fails when a module emits a `verified: false` or
// `sealable: false` verdict with no machine-readable reason key nearby, unless
// the file carries a documented REASON_EXEMPT_ALLOWLIST entry.
//
// Why (Minsky-Papert, giants-absorption 2026-06-21): a negative result must
// carry its cause. Reason-emission across the proof verifiers was convention,
// not mechanically enforced — a new producer could ship a bare `verified:false`
// and nothing would stop it. This gate makes the dominant convention mechanical.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  checkNegativeVerdictReasons,
  SCHEMA,
  REASON_KEYS,
} from "../scripts/review/negative-verdict-reason-gate.mjs";

const SCRIPT = fileURLToPath(
  new URL("../scripts/review/negative-verdict-reason-gate.mjs", import.meta.url),
);

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "nvr-"));
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
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

test("contract: schema + reason-key vocabulary are stable and frozen", () => {
  assert.equal(SCHEMA, "bizra.dema.review.negative_verdict_reason.v0.1");
  for (const k of ["reason", "error", "reason_codes", "poi_rule_reason"]) {
    assert.ok(REASON_KEYS.includes(k), `missing reason key ${k}`);
  }
  assert.ok(Object.isFrozen(REASON_KEYS));
});

test("bare `verified: false` (no reason) → violation with file/line/reason", () => {
  withFixture(
    {
      "bare.js": "export const r = { verified: false };\n",
      "clean.js": "export const y = 2;\n",
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 1);
      const v = r.violations[0];
      assert.equal(v.file, "bare.js");
      assert.equal(v.line, 1);
      assert.ok(v.reason.length > 0);
    },
  );
});

test("`verified: false` with same-line reason → ok (the dominant reject() shape)", () => {
  withFixture(
    {
      "ok.js":
        "export const reject = (reason) => Object.freeze({ verified: false, reason });\n",
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
      assert.equal(r.violation_count, 0);
    },
  );
});

test("`verified: false` with reason a few lines forward (multi-line object) → ok", () => {
  withFixture(
    {
      "multi.js":
        "export const r = Object.freeze({\n  verified: false,\n  stage: 's',\n  error: 'hash_mismatch',\n});\n",
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test("`verified: false` with the reason key ~7 lines forward in a large object → ok (proof-passport shape)", () => {
  withFixture(
    {
      "big.js":
        "export const r = freeze({\n  schema: S,\n  verified: false,\n  verdict: 'FAILED',\n  verification_scope: VS,\n  truth_label: TL,\n  envelope,\n  receipt_results: [],\n  boundary: B,\n  error: 'envelope_verification_failed',\n});\n",
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true, "error 7 lines below verified:false must count");
    },
  );
});

test("bare `sealable: false` (no reason) → violation", () => {
  withFixture(
    { "seal.js": "export const r = { verified: true, sealable: false };\n" },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violations[0].file, "seal.js");
    },
  );
});

test("boundary attestation `signature_verified: false` is NOT a verdict (word-boundary) → not flagged", () => {
  withFixture(
    {
      "boundary.js":
        "export const b = Object.freeze({ signature_verified: false, consent_verified: false });\n",
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
      assert.equal(r.violation_count, 0);
    },
  );
});

test("allowlisted bare-verdict file is exempt → ok and reported as allowlisted", () => {
  withFixture(
    {
      "closeout.js":
        "export const r = { found: false, verified: false, truth_label: 'NONE' };\n",
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({
        scanDir: dir,
        allowlist: { "closeout.js": "empty-set closeout; truth_label names it" },
      });
      assert.equal(r.ok, true);
      assert.equal(r.violation_count, 0);
      assert.equal(r.allowlisted.length, 1);
      assert.equal(r.allowlisted[0].file, "closeout.js");
      assert.ok(r.allowlisted[0].reason.length > 0);
    },
  );
});

test("commented-out `verified: false` is not flagged", () => {
  withFixture(
    { "c.js": "// return { verified: false };\nexport const z = 1;\n" },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test("*.test.js files are excluded from the scan", () => {
  withFixture(
    {
      "foo.test.js": "export const r = { verified: false };\n",
      "pure.js": "export const z = 1;\n",
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.ok(!r.violations.some((v) => v.file.includes("foo.test.js")));
      assert.equal(r.ok, true);
    },
  );
});

test("nested package src is walked recursively", () => {
  withFixture(
    { "pkg/src/deep.js": "export const r = { verified: false };\n" },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violations[0].file, "pkg/src/deep.js");
    },
  );
});

test("report is read-only, frozen, and writes nothing", () => {
  withFixture({ "pure.js": "export const z = 1;\n" }, (dir) => {
    const before = readdirSync(dir).length;
    const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
    assert.equal(r.read_only, true);
    assert.ok(Object.isFrozen(r));
    assert.ok(Object.isFrozen(r.violations));
    assert.ok(Object.isFrozen(r.allowlisted));
    assert.equal(readdirSync(dir).length, before, "gate must not write files");
  });
});

test("stale allowlist entry (no matching bare verdict) is surfaced, not fatal", () => {
  withFixture({ "pure.js": "export const z = 1;\n" }, (dir) => {
    const r = checkNegativeVerdictReasons({
      scanDir: dir,
      allowlist: { "ghost.js": "no longer present" },
    });
    assert.deepEqual(r.stale_allowlist, ["ghost.js"]);
    assert.equal(r.ok, true);
  });
});

test("real tree (packages/) is clean — REASON_EXEMPT_ALLOWLIST finalized (acceptance)", () => {
  const r = checkNegativeVerdictReasons(); // defaults: real packages/ + seed allowlist
  assert.equal(r.schema, SCHEMA);
  assert.ok(r.scanned_count > 0);
  assert.ok(r.verdict_count > 0, "should find real verified/sealable:false verdicts");
  assert.equal(r.ok, true);
  assert.equal(r.violation_count, 0);
  assert.deepEqual(r.stale_allowlist, []);
});

test("CLI: --json on a violating fixture exits non-zero with ok:false", () => {
  withFixture({ "bare.js": "export const r = { verified: false };\n" }, (dir) => {
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
  });
});

test("CLI: --json on a clean fixture exits zero with ok:true", () => {
  withFixture({ "pure.js": "export const z = 1;\n" }, (dir) => {
    const out = execFileSync("node", [SCRIPT, "--scan-dir", dir, "--json"], {
      encoding: "utf8",
    });
    assert.equal(JSON.parse(out).ok, true);
  });
});
