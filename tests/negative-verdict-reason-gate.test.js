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
  STATUS_REASON_KEYS,
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

test("quoted JSON-style key `\"verified\": false` with no reason → violation", () => {
  withFixture({ "q.js": 'export const r = { "verified": false };\n' }, (dir) => {
    const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
    assert.equal(r.ok, false);
    assert.equal(r.violations[0].file, "q.js");
  });
});

test("quoted verified key WITH a quoted reason key → ok", () => {
  withFixture(
    {
      "q.js":
        'export const r = { "verified": false, "reason": "missing envelope" };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test("single-quoted key `'sealable': false` is detected as a verdict", () => {
  withFixture({ "s.js": "export const r = { 'sealable': false };\n" }, (dir) => {
    const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
    assert.equal(r.ok, false);
  });
});

test("reason word in a COMMENT does not satisfy the gate", () => {
  withFixture(
    {
      "c.js":
        "export const r = {\n  verified: false,\n  // reason: TODO add one\n};\n",
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false, "comment reason must not count");
    },
  );
});

test("reason word inside a STRING value does not satisfy the gate", () => {
  withFixture(
    { "s.js": 'export const r = { verified: false, note: "reason exists" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false, "string reason must not count");
    },
  );
});

test("a `, reason:` embedded inside a STRING value is not a real key", () => {
  withFixture(
    { "s.js": 'export const r = { verified: false, note: "x, reason: y" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false, "string-embedded reason: must not count");
    },
  );
});

test("multiple verdicts on ONE line are all evaluated (2nd is bare)", () => {
  withFixture(
    {
      "m.js":
        'export const a = { verified: false, reason: "x" }; export const b = { sealable: false };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 1, "only the 2nd (bare) verdict violates");
    },
  );
});

test("allowlist matches by basename for a nested file (path-separator safe)", () => {
  withFixture(
    { "deep/src/closeout.js": "export const r = { verified: false };\n" },
    (dir) => {
      const r = checkNegativeVerdictReasons({
        scanDir: dir,
        allowlist: { "closeout.js": "documented empty-set closeout" },
      });
      assert.equal(r.ok, true);
      assert.equal(r.allowlisted[0].file, "closeout.js");
    },
  );
});

// --- NEGATIVE-VERDICT-REASON-GATE-1B — string verdicts ---
// Extends the gate from verified/sealable:false to the heterogeneous string
// verdict shape `verdict: "FAILED" | "BLOCKED" | "HOLD" | "REJECT" |
// "CANNOT_PROVE"` on the verdict-family key (`verdict` / `*_verdict`). The
// string VALUE is blanked by sanitizeForScan, so the gate matches the value on
// the raw line and uses the sanitized buffer as a liveness mask (comment/string
// occurrences must not flag). Status-family keys (status/*_status) and
// `*_verdict_required` config fields are OUT of scope (documented 1C deferral).

test("1B contract: REASON_KEYS recognizes the structured `checks` cause", () => {
  assert.ok(
    REASON_KEYS.includes("checks"),
    "a verdict that ships a structured pass/fail `checks` list names its cause",
  );
});

test("bare `verdict: \"FAILED\"` (no reason) → violation", () => {
  withFixture({ "v.js": 'export const r = { verdict: "FAILED" };\n' }, (dir) => {
    const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
    assert.equal(r.ok, false);
    assert.equal(r.violation_count, 1);
    assert.equal(r.violations[0].file, "v.js");
    assert.equal(r.violations[0].line, 1);
  });
});

test("`verdict: \"FAILED\"` with a structured `checks` list → ok (verify-producer shape)", () => {
  withFixture(
    {
      "v.js":
        'export const r = { schema: S, verdict: "FAILED", path: p, checks, receipt: null };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true, "checks list is the machine-readable cause");
    },
  );
});

test("`verdict: \"FAILED\"` with an `error` key → ok", () => {
  withFixture(
    { "v.js": 'export const r = { verdict: "FAILED", error: "boom" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test("`*_verdict` family key (mission_verdict) is detected when bare", () => {
  withFixture(
    { "v.js": 'export const r = { mission_verdict: "FAILED" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 1);
    },
  );
});

for (const token of ["BLOCKED", "HOLD", "REJECT", "CANNOT_PROVE"]) {
  test(`negative string verdict "${token}" is detected when bare`, () => {
    withFixture(
      { "v.js": `export const r = { verdict: "${token}" };\n` },
      (dir) => {
        const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
        assert.equal(r.ok, false, `${token} must be a negative verdict`);
        assert.equal(r.violation_count, 1);
      },
    );
  });
}

test("positive verdict `verdict: \"VERIFIED\"` is NOT flagged", () => {
  withFixture(
    { "v.js": 'export const r = { verdict: "VERIFIED" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
      assert.equal(r.verdict_count, 0, "VERIFIED is not a negative verdict");
    },
  );
});

test("scope boundary: `sat_verdict_required: \"REJECT\"` (config, not emitted verdict) is NOT flagged", () => {
  withFixture(
    { "v.js": 'export const r = { sat_verdict_required: "REJECT" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true, "*_verdict_required is not the verdict-family key");
      assert.equal(r.verdict_count, 0);
    },
  );
});

test("1C now flags bare status-family `status: \"BLOCKED\"` (was the 1B deferral)", () => {
  withFixture(
    { "v.js": 'export const r = { status: "BLOCKED" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false, "1C: a bare negative status is now a violation");
      assert.equal(r.violation_count, 1);
    },
  );
});

test("commented-out `// verdict: \"FAILED\"` is not flagged (liveness)", () => {
  withFixture(
    { "v.js": '// verdict: "FAILED"\nexport const z = 1;\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
      assert.equal(r.verdict_count, 0);
    },
  );
});

test("string-smuggled `'...verdict: \"FAILED\"...'` is not flagged (liveness)", () => {
  withFixture(
    { "v.js": "export const note = 'see verdict: \"FAILED\" here';\n" },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true, "verdict inside a string value must not flag");
      assert.equal(r.verdict_count, 0);
    },
  );
});

test("quoted key `\"verdict\": \"FAILED\"` is detected when bare", () => {
  withFixture(
    { "v.js": 'export const r = { "verdict": "FAILED" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
    },
  );
});

test("single-quoted value `verdict: 'FAILED'` is detected when bare", () => {
  withFixture(
    { "v.js": "export const r = { verdict: 'FAILED' };\n" },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
    },
  );
});

test("co-located `verified:false` + `verdict:\"FAILED\"` sharing one reason → ok, both counted", () => {
  withFixture(
    {
      "v.js":
        'export const r = { verified: false, verdict: "FAILED", error: "x" };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
      assert.equal(r.verdict_count, 2, "verified:false AND verdict:FAILED markers");
    },
  );
});

test("co-located bare `verified:false` + `verdict:\"FAILED\"` (no reason) → 2 violations", () => {
  withFixture(
    { "v.js": 'export const r = { verified: false, verdict: "FAILED" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 2, "each bare marker violates independently");
    },
  );
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

// --- NEGATIVE-VERDICT-REASON-GATE-1C — status-family negative states ---
// Extends the gate to the status-family key (`status` / `*_status`, e.g.
// current_status / preview_lifecycle_status) carrying a negative value
// (FAILED|BLOCKED|HOLD|REJECT|CANNOT_PROVE). STRICT: a negative status must name
// a SPECIFIC blocker/cause via STATUS_REASON_KEYS — `truth_label` alone (an
// epistemic class label, not a failed precondition) is NOT sufficient. Verdict-
// family (1A/1B) behavior is unchanged; `*_verdict_required` config fields and a
// typed REASON_CLASS enum stay deferred.

test("1C contract: STATUS_REASON_KEYS requires a specific blocker and excludes truth_label", () => {
  for (const k of [
    "reason",
    "error",
    "reason_code",
    "reason_codes",
    "blocked_by",
    "blocked_reason",
    "hold_reason",
    "failed_precondition",
    "checks",
  ]) {
    assert.ok(STATUS_REASON_KEYS.includes(k), `missing status reason key ${k}`);
  }
  assert.ok(
    !STATUS_REASON_KEYS.includes("truth_label"),
    "truth_label is an epistemic label, not a blocker — must NOT satisfy the gate",
  );
  assert.ok(Object.isFrozen(STATUS_REASON_KEYS));
});

test('status:"BLOCKED" with truth_label ONLY → violation (truth_label not sufficient)', () => {
  withFixture(
    {
      "s.js":
        'export const r = { status: "BLOCKED", truth_label: "NOT_LIVE" };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 1);
      assert.equal(r.violations[0].file, "s.js");
    },
  );
});

test('status:"BLOCKED" with blocked_by → ok', () => {
  withFixture(
    {
      "s.js":
        'export const r = { status: "BLOCKED", truth_label: "NOT_LIVE", blocked_by: ["no runtime in tree"] };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test('current_status:"BLOCKED" with blocked_by → ok', () => {
  withFixture(
    {
      "s.js":
        'export const r = { current_status: "BLOCKED", blocked_by: ["pilot not reached"] };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test('preview_lifecycle_status:"HOLD" with hold_reason → ok', () => {
  withFixture(
    {
      "s.js":
        'export const r = { preview_lifecycle_status: "HOLD", hold_reason: "preview_only seed" };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test('`*_status` (health_status) "FAILED" with reason_code → ok', () => {
  withFixture(
    {
      "s.js":
        'export const r = { health_status: "FAILED", reason_code: "probe_timeout" };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
    },
  );
});

test('`preview_lifecycle_status:"HOLD"` bare (no cause) → violation', () => {
  withFixture(
    { "s.js": 'export const r = { preview_lifecycle_status: "HOLD" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 1);
    },
  );
});

test("positive status value `status:\"LIVE\"` is ignored", () => {
  withFixture({ "s.js": 'export const r = { status: "LIVE" };\n' }, (dir) => {
    const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
    assert.equal(r.ok, true);
    assert.equal(r.verdict_count, 0);
  });
});

test('scope: `status_required:"BLOCKED"` (not a status-family verdict) is ignored', () => {
  withFixture(
    { "s.js": 'export const r = { status_required: "BLOCKED" };\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true, "key must END in `status`");
    },
  );
});

test("commented-out `// status: \"BLOCKED\"` is not flagged (liveness)", () => {
  withFixture(
    { "s.js": '// status: "BLOCKED"\nexport const z = 1;\n' },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
      assert.equal(r.verdict_count, 0);
    },
  );
});

test("string-smuggled status verdict is not flagged (liveness)", () => {
  withFixture(
    { "s.js": "export const note = 'see status: \"BLOCKED\" here';\n" },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, true);
      assert.equal(r.verdict_count, 0);
    },
  );
});

test("truth_label inside the SAME status object does not count as the blocker", () => {
  // belt-and-suspenders: even with other innocuous keys, only a real cause key
  // satisfies — truth_label + label + id is still bare.
  withFixture(
    {
      "s.js":
        'export const r = { id: "x", label: "y", status: "BLOCKED", truth_label: "NOT_LIVE" };\n',
    },
    (dir) => {
      const r = checkNegativeVerdictReasons({ scanDir: dir, allowlist: {} });
      assert.equal(r.ok, false, "truth_label/label/id are not blockers");
    },
  );
});
