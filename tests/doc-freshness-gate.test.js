// DOC-FRESHNESS-START-HERE-DERIVE-1A — test-first.
// Proves a read-only gate that fails when a CURATED living doc asserts a
// hardcoded current-state test count (e.g. "2618/2618 tests PASS"), forcing
// such docs to point to the live verification command instead of carrying a
// number that silently goes stale.
//
// Why (status generated from state, never asserted): a living doc that hand-
// maintains "NNNN tests" drifts the moment a test lands. The fix is to delete
// the asserted number and point to `npm test` / `docs/TESTING.md`; this gate
// makes that discipline mechanical. Frozen historical docs (ADRs, GTM, audits,
// archive) are intentionally NOT scanned — their point-in-time counts are
// legitimate records.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  checkDocFreshness,
  SCHEMA,
  CURATED_LIVING_DOCS,
} from "../scripts/review/doc-freshness-gate.mjs";

const SCRIPT = fileURLToPath(
  new URL("../scripts/review/doc-freshness-gate.mjs", import.meta.url),
);

// Build a fixture repo root with the given docs, scan only those.
function withRepo(docs, fn) {
  const root = mkdtempSync(join(tmpdir(), "dfg-"));
  for (const [rel, content] of Object.entries(docs)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("contract: schema is the stable versioned id; curated list is frozen + non-empty", () => {
  assert.equal(SCHEMA, "bizra.dema.review.doc_freshness.v0.1");
  assert.ok(Object.isFrozen(CURATED_LIVING_DOCS));
  assert.ok(CURATED_LIVING_DOCS.length > 0);
  assert.ok(
    CURATED_LIVING_DOCS.includes("docs/THIRD_FACT_CURRENT_STATE_DELTA.md"),
    "the known stale living doc must be curated",
  );
});

test('slash-form "2618/2618 tests PASS" in a curated living doc → violation', () => {
  withRepo(
    {
      "docs/live.md": "Dema cockpit · 2618/2618 tests PASS · stdlib-only.\n",
    },
    (root) => {
      const r = checkDocFreshness({
        repoRoot: root,
        curatedDocs: ["docs/live.md"],
      });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 1);
      const v = r.violations[0];
      assert.equal(v.file, "docs/live.md");
      assert.equal(v.line, 1);
      assert.equal(v.code, "hardcoded_test_count_in_living_doc");
      assert.match(v.match, /2618\/2618 tests/);
    },
  );
});

test('slash-form "4977/4977 tests" → violation', () => {
  withRepo(
    { "docs/live.md": "Current: 4977/4977 tests, all green.\n" },
    (root) => {
      const r = checkDocFreshness({
        repoRoot: root,
        curatedDocs: ["docs/live.md"],
      });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 1);
    },
  );
});

test('bare-form "4959 tests pass" → violation', () => {
  withRepo({ "docs/live.md": "We have 4959 tests pass locally.\n" }, (root) => {
    const r = checkDocFreshness({
      repoRoot: root,
      curatedDocs: ["docs/live.md"],
    });
    assert.equal(r.ok, false);
    assert.equal(r.violation_count, 1);
  });
});

test('1A: slash-form PASS without "tests" ("2618/2618 PASS") → violation', () => {
  // The original regex required `tests`/`passing` after the count, so a bare
  // "N/N PASS" (the common cockpit/quickstart form) silently escaped.
  withRepo(
    { "docs/live.md": "Test surface · 2618 / 2618 PASS · run `npm test`.\n" },
    (root) => {
      const r = checkDocFreshness({
        repoRoot: root,
        curatedDocs: ["docs/live.md"],
      });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 1);
      assert.match(r.violations[0].match, /2618 \/ 2618 PASS/i);
    },
  );
});

test('1A: 2-digit component count ("14/14 PASS") is NOT flagged — stable specific ref, not total-suite drift', () => {
  // Total-suite counts (the drift target) are 3-6 digits; small N/N forms like
  // the μ-C1 enforcer's "14/14 PASS" are specific, stable references and must
  // stay allowed so the gate does not force deleting precise documentation.
  withRepo(
    { "docs/live.md": "μ-C1 enforcer · 14/14 PASS in pre-push · 16 tests.\n" },
    (root) => {
      const r = checkDocFreshness({
        repoRoot: root,
        curatedDocs: ["docs/live.md"],
      });
      assert.equal(r.ok, true);
      assert.equal(r.violation_count, 0);
    },
  );
});

test("pointer to live commands (npm test / npm run check / docs/TESTING.md) → ok", () => {
  withRepo(
    {
      "docs/live.md":
        "Test counts are not hand-maintained here. Recompute with `npm test` and `npm run check`; see `docs/TESTING.md`.\n",
    },
    (root) => {
      const r = checkDocFreshness({
        repoRoot: root,
        curatedDocs: ["docs/live.md"],
      });
      assert.equal(r.ok, true);
      assert.equal(r.violation_count, 0);
    },
  );
});

test("frozen doc OUTSIDE the curated list keeps its historical count → not scanned, ok", () => {
  withRepo(
    {
      "docs/live.md": "Run `npm test`; see `docs/TESTING.md`.\n",
      "docs/06-adr/ADR-014.md": "2202 tests at this ADR's authoring.\n",
    },
    (root) => {
      const r = checkDocFreshness({
        repoRoot: root,
        curatedDocs: ["docs/live.md"], // ADR not curated → never scanned
      });
      assert.equal(r.ok, true);
      assert.equal(r.violation_count, 0);
    },
  );
});

test("multiple asserted counts across lines are each reported", () => {
  withRepo(
    {
      "docs/live.md":
        "Line a: 2618/2618 tests PASS.\nLine b: also 4959 tests pass.\n",
    },
    (root) => {
      const r = checkDocFreshness({
        repoRoot: root,
        curatedDocs: ["docs/live.md"],
      });
      assert.equal(r.ok, false);
      assert.equal(r.violation_count, 2);
      assert.deepEqual(
        r.violations.map((v) => v.line),
        [1, 2],
      );
    },
  );
});

test("a missing curated doc is surfaced (non-fatal) so a renamed doc is caught", () => {
  withRepo({ "docs/present.md": "Run `npm test`.\n" }, (root) => {
    const r = checkDocFreshness({
      repoRoot: root,
      curatedDocs: ["docs/present.md", "docs/gone.md"],
    });
    assert.equal(r.ok, true, "missing doc is a warning, not a violation");
    assert.deepEqual(r.missing_docs, ["docs/gone.md"]);
  });
});

test("report is read-only, frozen, and writes nothing", () => {
  withRepo({ "docs/live.md": "Run `npm test`.\n" }, (root) => {
    const r = checkDocFreshness({
      repoRoot: root,
      curatedDocs: ["docs/live.md"],
    });
    assert.equal(r.read_only, true);
    assert.ok(Object.isFrozen(r));
    assert.ok(Object.isFrozen(r.violations));
  });
});

test("acceptance: the REAL curated living docs are pointer-clean (no asserted counts)", () => {
  const r = checkDocFreshness(); // defaults: real repo + CURATED_LIVING_DOCS
  assert.equal(r.schema, SCHEMA);
  assert.ok(r.scanned_count > 0);
  assert.equal(r.ok, true, JSON.stringify(r.violations));
  assert.equal(r.violation_count, 0);
  assert.deepEqual(r.missing_docs, []);
});

test("CLI: --json on a violating fixture exits non-zero with ok:false", () => {
  withRepo(
    { "docs/THIRD_FACT_CURRENT_STATE_DELTA.md": "2618/2618 tests PASS\n" },
    (root) => {
      let threw = false;
      let out = "";
      try {
        execFileSync("node", [SCRIPT, "--repo-root", root, "--json"], {
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
