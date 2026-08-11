// AUTHORITATIVE-POINTER-PARITY-1A — P-01…P-08.
//
// WHAT THIS SLICE MEASURES. This estate answers "which record is authoritative"
// in four independent places, and they do not carry the same guarantees:
//
//   season HEAD        head_hash + receipt_hash + state_hash + sequence fence
//   active-key pointer pointer_hash + transition_id + exclusive identity lease
//   genesis root-trust body_sha256 + out-of-band witness commitment
//   ACTIVE_MISSION     nothing
//
// The fourth is the one the SessionStart hook reads first and instructs every
// agent to prefer over all other sources ("the pointer wins"). So the estate's
// most authoritative pointer is its least protected one, and nothing checked the
// four against each other. This gate makes that legible.
//
// WHY PASS DOES NOT MEAN "ALL SATISFIED". Following the closure gate's own law —
// "PASS means the ledger is sound and honest, NOT that Node0 is closed" — this
// gate passes when the parity ledger is complete and re-derivable. A gate that
// hard-failed on a long-standing condition would be switched off within a week,
// and a switched-off gate protects nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  POINTER_CONTRACT_CLAUSES,
  POINTER_ENGINES,
  evaluatePointerEngine,
  buildPointerParityReport,
  verifyPointerParityReport,
} from "../scripts/review/authoritative-pointer-parity-check.mjs";

/** Markers for a source engine; instance engines declare clause_fields instead. */
const fullSource = (e) =>
  (e.clause_markers ?? []).flatMap((m) => m.markers).join("\n");

/** Evidence shaped as the gate's injected readers produce it. */
const ev = (over = {}) => ({
  present: true,
  source: "",
  instance: null,
  ...over,
});

const clauseOf = (engineReport, clause) =>
  engineReport.clauses.find((c) => c.clause === clause)?.status;

// ── P-01 ───────────────────────────────────────────────────────────────────
test("P-01: every authoritative-pointer engine is enumerated, none omitted", () => {
  const ids = POINTER_ENGINES.map((e) => e.id).sort();
  assert.deepEqual(ids, [
    "active_key_pointer",
    "active_mission_pointer",
    "genesis_root_trust",
    "season_head",
  ]);
  assert.deepEqual([...POINTER_CONTRACT_CLAUSES].sort(),
    ["content_identity", "freshness", "named_owner", "ordering"]);
});

// ── P-02 ───────────────────────────────────────────────────────────────────
test("P-02: season HEAD satisfies all four clauses", () => {
  const engine = POINTER_ENGINES.find((e) => e.id === "season_head");
  // Source text carrying every declared marker.
  const source = fullSource(engine);
  const r = evaluatePointerEngine(engine, ev({ source }));
  for (const clause of POINTER_CONTRACT_CLAUSES) {
    assert.equal(clauseOf(r, clause), "SATISFIED", `${clause} → ${clauseOf(r, clause)}`);
  }
});

// ── P-03 ───────────────────────────────────────────────────────────────────
test("P-03: active-key pointer satisfies content identity and ordering", () => {
  const engine = POINTER_ENGINES.find((e) => e.id === "active_key_pointer");
  const source = fullSource(engine);
  const r = evaluatePointerEngine(engine, ev({ source }));
  assert.equal(clauseOf(r, "content_identity"), "SATISFIED");
  assert.equal(clauseOf(r, "ordering"), "SATISFIED");
});

// ── P-04 · the finding ─────────────────────────────────────────────────────
test("P-04: ACTIVE_MISSION pointer is VIOLATED on content identity, and only reported", () => {
  const engine = POINTER_ENGINES.find((e) => e.id === "active_mission_pointer");
  // The real shape: many keys, an updated_at, and no integrity field at all.
  const r = evaluatePointerEngine(engine, ev({
    instance: { status: "AGENT_READY", updated_at_utc: "2026-08-09T23:54:40Z", must_not_repeat: [] },
  }));
  assert.equal(clauseOf(r, "content_identity"), "VIOLATED");
  assert.equal(clauseOf(r, "ordering"), "VIOLATED");
  assert.equal(clauseOf(r, "freshness"), "SATISFIED", "it does carry updated_at_utc");
  // Reported, never repaired.
  assert.equal(r.repaired, false);
  assert.equal(r.mutated, false);
});

// ── P-05 · negative control ────────────────────────────────────────────────
test("P-05: a comparator that returns SATISFIED for everything fails P-04", () => {
  const engine = POINTER_ENGINES.find((e) => e.id === "active_mission_pointer");
  const alwaysSatisfied = () => "SATISFIED";
  const r = evaluatePointerEngine(engine,
    ev({ instance: { updated_at_utc: "x" } }), { clauseVerdict: alwaysSatisfied });
  // If the real evaluator behaved like this, P-04 could not fail. Prove the
  // difference is real rather than assumed.
  assert.equal(clauseOf(r, "content_identity"), "SATISFIED",
    "the stub must differ from the real evaluator");
  const real = evaluatePointerEngine(engine, ev({ instance: { updated_at_utc: "x" } }));
  assert.notEqual(clauseOf(real, "content_identity"), clauseOf(r, "content_identity"));
});

// ── P-06 ───────────────────────────────────────────────────────────────────
test("P-06: an engine whose evidence is unavailable is UNKNOWN, never a silent pass", () => {
  for (const engine of POINTER_ENGINES) {
    const r = evaluatePointerEngine(engine, ev({ present: false, source: "", instance: null }));
    for (const c of r.clauses) {
      assert.notEqual(c.status, "SATISFIED",
        `${engine.id}/${c.clause} passed on absent evidence`);
    }
    assert.ok(r.clauses.some((c) => c.status === "UNKNOWN"));
  }
});

test("P-06b: a declared engine missing its markers is VIOLATED, not skipped", () => {
  const engine = POINTER_ENGINES.find((e) => e.id === "season_head");
  const r = evaluatePointerEngine(engine, ev({ source: "// nothing declared here" }));
  assert.equal(clauseOf(r, "content_identity"), "VIOLATED");
});

// ── report integrity ───────────────────────────────────────────────────────
test("the report re-derives from its own rows (positive control)", () => {
  const evidence = Object.fromEntries(POINTER_ENGINES.map((e) => [
    e.id,
    ev({ source: fullSource(e), instance: { updated_at_utc: "2026-01-01T00:00:00Z" } }),
  ]));
  const report = buildPointerParityReport(evidence);
  assert.equal(report.engines.length, POINTER_ENGINES.length);
  assert.equal(verifyPointerParityReport(report).ok, true);
});

test("a forged report — counts edited to hide a violation — is refused", () => {
  // The fixture must PRODUCE a violation, otherwise the forgery is a no-op and
  // the test passes for the wrong reason. An empty source yields UNKNOWN, not
  // VIOLATED, so declare a non-empty source that is missing every marker.
  const evidence = Object.fromEntries(
    POINTER_ENGINES.map((e) => [e.id, ev({ source: "// declares nothing", instance: {} })]));
  const report = buildPointerParityReport(evidence);
  assert.ok(report.violated > 0, "fixture must produce a violation to hide");
  const forged = { ...report, violated: 0, satisfied: report.satisfied + report.violated };
  assert.equal(verifyPointerParityReport(forged).ok, false);
});

// ── P-07 ───────────────────────────────────────────────────────────────────
test("P-07: the gate writes nothing, opens no socket, invokes no model", () => {
  const src = readFileSync(
    new URL("../scripts/review/authoritative-pointer-parity-check.mjs", import.meta.url), "utf8");
  for (const forbidden of [
    "writeFile", "writeFileSync", "mkdir", "rm(", "unlink", "rename",
    "node:http", "node:net", "fetch(", "child_process",
  ]) {
    assert.equal(src.includes(forbidden), false, `gate must not contain ${forbidden}`);
  }
});

// ── P-08 ───────────────────────────────────────────────────────────────────
test("P-08: the gate is wired into npm run check", () => {
  const check = readFileSync(new URL("../scripts/check.mjs", import.meta.url), "utf8");
  assert.match(check, /authoritative-pointer-parity-check\.mjs/,
    "an unwired gate cannot detect anything — it never runs");
});
