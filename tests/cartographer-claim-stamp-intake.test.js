// CARTOGRAPHER-CLAIM-STAMP-INTAKE-1A — map-only, fail-closed.
// PDF alone must not promote claim stamps; missing JSON ⇒ BLOCKED.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

import {
  assessCartographerIntake,
  CARTOGRAPHER_INTAKE_SCHEMA,
  CARTOGRAPHER_INTAKE_TRUTH,
  REQUIRED_CARTOGRAPHER_FILES,
} from "../packages/core/src/cartographer-claim-stamp-intake.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

function memFs(files) {
  const names = Object.keys(files);
  return {
    listNames: () => names.slice(),
    readText: (abs) => {
      const base = abs.split("/").pop();
      if (!(base in files)) throw new Error(`missing ${base}`);
      return files[base];
    },
    pathJoin: (...parts) => parts.join("/"),
  };
}

describe("cartographer-claim-stamp-intake", () => {
  test("refuses empty intakeRoot", () => {
    const r = assessCartographerIntake({});
    assert.equal(r.ok, false);
    assert.equal(r.truth_label, CARTOGRAPHER_INTAKE_TRUTH.BLOCKED);
    assert.deepEqual([...r.missing], ["intake_root"]);
    assert.equal(r.epistemic, "UNKNOWN");
    assert.equal(r.schema, CARTOGRAPHER_INTAKE_SCHEMA);
    assert.equal(r.authority_delta, 0);
    assert.equal(isCanonicalBoundary(r.boundary), true);
  });

  test("refuses missing IO injectors even with a root", () => {
    const r = assessCartographerIntake({ intakeRoot: "/tmp/x" });
    assert.equal(r.ok, false);
    assert.deepEqual([...r.missing], ["intake_io"]);
  });

  test("PDF-only directory stays BLOCKED (no silent promote)", () => {
    const io = memFs({
      "BIZRA_PAT_Cartographer_Peak_Synthesis_2026-10-29.pdf": "%PDF-fake",
    });
    const r = assessCartographerIntake({
      intakeRoot: "/virtual/downloads",
      ...io,
    });
    assert.equal(r.ok, false);
    assert.equal(r.truth_label, CARTOGRAPHER_INTAKE_TRUTH.BLOCKED);
    assert.equal(r.epistemic, "UNKNOWN");
    assert.deepEqual([...r.missing], [...REQUIRED_CARTOGRAPHER_FILES]);
    assert.match(r.note, /DECLARED_IN_PDF/);
  });

  test("malformed JSON ⇒ PARSE_FAILED", () => {
    const io = memFs({
      "cross_repo_ledger.json": "{not-json",
      "bizra_hypergraph_triples.jsonl": '{"a":1}\n',
      "public_claims_audit.json": '{"claims":[]}',
    });
    const r = assessCartographerIntake({
      intakeRoot: "/virtual/ok-names",
      ...io,
    });
    assert.equal(r.ok, false);
    assert.equal(r.truth_label, CARTOGRAPHER_INTAKE_TRUTH.PARSE_FAILED);
    assert.deepEqual([...r.parse_errors], ["cross_repo_ledger.json"]);
  });

  test("valid artifacts ⇒ REPARSE_GREEN with measured counts", () => {
    const io = memFs({
      "cross_repo_ledger.json": JSON.stringify({ ports: {}, routes: {} }),
      "bizra_hypergraph_triples.jsonl": '{"s":1}\n{"s":2}\n',
      "public_claims_audit.json": JSON.stringify({
        claims: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
      }),
    });
    const r = assessCartographerIntake({
      intakeRoot: "/virtual/complete",
      ...io,
    });
    assert.equal(r.ok, true);
    assert.equal(r.truth_label, CARTOGRAPHER_INTAKE_TRUTH.REPARSE_GREEN);
    assert.equal(r.epistemic, "MEASURED_FROM_ARTIFACTS");
    assert.deepEqual(r.counts, {
      ledger_keys: 2,
      triple_lines: 2,
      claim_entries: 3,
    });
  });

  test("expectedCounts mismatch refuses mint-style green", () => {
    const io = memFs({
      "cross_repo_ledger.json": JSON.stringify({ a: 1 }),
      "bizra_hypergraph_triples.jsonl": '{"t":1}\n',
      "public_claims_audit.json": JSON.stringify({ claims: [{ id: "x" }] }),
    });
    const r = assessCartographerIntake({
      intakeRoot: "/virtual/mismatch",
      ...io,
      expectedCounts: { triple_lines: 48, claim_entries: 20 },
    });
    assert.equal(r.ok, false);
    assert.equal(r.truth_label, CARTOGRAPHER_INTAKE_TRUTH.COUNT_MISMATCH);
    assert.equal(r.epistemic, "CONTRADICTS");
  });

  test("real tempdir I/O: missing JSON on disk stays BLOCKED", () => {
    const root = mkdtempSync(join(tmpdir(), "cartographer-intake-"));
    try {
      writeFileSync(join(root, "only.pdf"), "%PDF");
      const r = assessCartographerIntake({
        intakeRoot: root,
        listNames: (dir) => readdirSync(dir),
        readText: (p) => readFileSync(p, "utf8"),
        pathJoin: join,
      });
      assert.equal(r.ok, false);
      assert.equal(r.truth_label, CARTOGRAPHER_INTAKE_TRUTH.BLOCKED);
      assert.ok(r.missing.includes("cross_repo_ledger.json"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("real tempdir I/O: complete set reparses green", () => {
    const root = mkdtempSync(join(tmpdir(), "cartographer-intake-ok-"));
    try {
      mkdirSync(root, { recursive: true });
      writeFileSync(
        join(root, "cross_repo_ledger.json"),
        JSON.stringify({ k: 1 }),
      );
      writeFileSync(join(root, "bizra_hypergraph_triples.jsonl"), '{"x":1}\n');
      writeFileSync(
        join(root, "public_claims_audit.json"),
        JSON.stringify({ claims: [] }),
      );
      const r = assessCartographerIntake({
        intakeRoot: root,
        listNames: (dir) => readdirSync(dir),
        readText: (p) => readFileSync(p, "utf8"),
        pathJoin: join,
      });
      assert.equal(r.ok, true);
      assert.equal(r.counts.claim_entries, 0);
      assert.equal(r.counts.triple_lines, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
