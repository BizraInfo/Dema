import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";
import {
  buildHistoryReplayObservation,
  verifyHistoryReplayHash,
  isProvenHistoryReplay,
  REPLAY_POSITIVE_FACTS,
  REPLAY_NEGATIVE_CONTROLS,
  NODE0_HISTORY_REPLAY_SCOPE,
  NODE0_HISTORY_REPLAY_OBSERVATION_SCHEMA,
} from "../packages/core/src/node0-history-replay-observation.js";
import {
  fullHistoryReplayableObservation,
  historyReplayDiagnostic,
  currentHistoryReplayKernelHash,
  HISTORY_REPLAY_ARTEFACT_RELPATH,
} from "../packages/core/src/node0-history-replay-adapter.js";

/**
 * NODE0-HISTORY-REPLAY-1A — `full_history_replayable`, the ninth closure row.
 *
 * THE TRAP. A process still holding the history in memory replays it perfectly
 * and proves nothing. So the producer spends its own process: phase 1 runs the
 * real genesis ceremony, writes receipts, rotates the key and EXITS; phase 2 is
 * a fresh interpreter that never saw it.
 *
 * AND REPLAYING IS NOT ENOUGH. A replayer that accepts everything reconstructs a
 * forgery just as happily as a true history and reports success either way. So
 * the four corruptions are not decoration — they are the evidence. HR-03 pins
 * the asymmetry that makes them load-bearing: a control that RAN and failed to
 * reject flips the verdict to REFUTED, never merely INCOMPLETE, because a
 * replayer proven to accept a forgery is worse than one that never ran.
 *
 * HR-05 pins the other half. A replay whose root equals its current authority
 * never crossed a rotation, so the hard part of "reconstruct the past" was never
 * exercised — that is INCOMPLETE, not proven.
 *
 * HR-09 is the negative-control integrity row: every rejection above would be
 * satisfied by a kernel that refuses everything, so one fact set must actually
 * reach PROVEN and be accepted end to end by the adapter.
 *
 * FIXTURE KEYS ONLY. Disposable DEMA_HOME only.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCER = join(REPO, "scripts/proof/node0-history-replay-proof.mjs");

const PROVEN_FACTS = Object.freeze({
  ...Object.fromEntries(REPLAY_POSITIVE_FACTS.map((k) => [k, true])),
  ...Object.fromEntries(REPLAY_NEGATIVE_CONTROLS.map((k) => [k, true])),
  genesis_root_fingerprint: "a".repeat(64),
  final_authority_fingerprint: "b".repeat(64),
  ledger_entries: 5,
  successions_replayed: 1,
});

const build = (facts, over = {}) => buildHistoryReplayObservation({
  facts, evidenceClass: "OBSERVED", observedAt: "2026-08-11T00:00:00.000Z",
  executedCodeHash: currentHistoryReplayKernelHash(), hash: sha256CanonicalJsonV1, ...over,
});

// ── HR-01 ─────────────────────────────────────────────────────────────────
test("HR-01: a complete replay with every control rejecting is PROVEN", () => {
  const o = build(PROVEN_FACTS);
  assert.equal(o.replay_verdict, "HISTORY_REPLAY_PROVEN");
  assert.equal(o.observed, true);
  assert.equal(o.scope, NODE0_HISTORY_REPLAY_SCOPE);
  assert.equal(o.schema, NODE0_HISTORY_REPLAY_OBSERVATION_SCHEMA);
  assert.equal(o.authority_delta, 0);
  assert.equal(isProvenHistoryReplay(o), true);
  assert.equal(verifyHistoryReplayHash(o, sha256CanonicalJsonV1), true);
});

// ── HR-02 ─────────────────────────────────────────────────────────────────
test("HR-02: any positive fact false refutes the replay", () => {
  for (const k of REPLAY_POSITIVE_FACTS) {
    const o = build({ ...PROVEN_FACTS, [k]: false });
    assert.equal(o.replay_verdict, "REPLAY_REFUTED", `${k} false must refute`);
    assert.equal(o.observed, false);
  }
});

// ── HR-03 ── the asymmetry ────────────────────────────────────────────────
test("HR-03: a control that ACCEPTED a forgery refutes; a control that never ran does not", () => {
  for (const k of REPLAY_NEGATIVE_CONTROLS) {
    const accepted = build({ ...PROVEN_FACTS, [k]: false });
    assert.equal(accepted.replay_verdict, "REPLAY_REFUTED",
      `${k}=false means the replayer accepted a forgery`);
    assert.equal(accepted.observed, false, "a refuted replay must contribute false, not silence");

    const absent = build({ ...PROVEN_FACTS, [k]: undefined });
    assert.equal(absent.replay_verdict, "REPLAY_INCOMPLETE",
      `${k} missing means nobody looked`);
    assert.equal(absent.observed, null, "an unrun control must contribute silence, not false");
  }
});

// ── HR-04 ─────────────────────────────────────────────────────────────────
test("HR-04: identity and counts are required — 'it replayed' must name something", () => {
  for (const [k, v] of [["genesis_root_fingerprint", ""], ["final_authority_fingerprint", ""],
                        ["ledger_entries", 0], ["successions_replayed", 0]]) {
    const o = build({ ...PROVEN_FACTS, [k]: v });
    assert.equal(o.replay_verdict, "REPLAY_INCOMPLETE", `${k}=${JSON.stringify(v)}`);
    assert.equal(o.observed, null);
  }
});

// ── HR-05 ─────────────────────────────────────────────────────────────────
test("HR-05: a replay that never crossed a rotation is INCOMPLETE, not proven", () => {
  const same = "c".repeat(64);
  const o = build({ ...PROVEN_FACTS, genesis_root_fingerprint: same, final_authority_fingerprint: same });
  assert.equal(o.replay_verdict, "REPLAY_INCOMPLETE");
  assert.equal(o.observed, null);
});

// ── HR-06 ─────────────────────────────────────────────────────────────────
test("HR-06: asserted or absent evidence never becomes an observation", () => {
  assert.equal(build(PROVEN_FACTS, { evidenceClass: "OPERATOR_ASSERTED" }).replay_verdict,
    "OPERATOR_ASSERTED_ONLY");
  assert.equal(build(PROVEN_FACTS, { evidenceClass: "NONE" }).replay_verdict, "NOT_OBSERVED");
  assert.equal(build(null).replay_verdict, "NO_REPLAY_EVIDENCE");
  for (const cls of ["OPERATOR_ASSERTED", "NONE", "TEST_INJECTION"]) {
    assert.equal(build(PROVEN_FACTS, { evidenceClass: cls }).observed, null);
  }
});

// ── HR-07 ── adapter integrity ────────────────────────────────────────────
test("HR-07: the adapter refuses a tampered, mislabelled or stale artefact", () => {
  const home = mkdtempSync(join(tmpdir(), "hr-"));
  const write = (o) => {
    const p = join(home, HISTORY_REPLAY_ARTEFACT_RELPATH);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(o, null, 2));
  };
  try {
    const good = build(PROVEN_FACTS);
    write(good);
    assert.equal(fullHistoryReplayableObservation({ demaHome: home })?.observed, true,
      "control: an honest artefact IS accepted");

    write({ ...good, ledger_entries: 999 });           // body changed, hash stale
    assert.equal(fullHistoryReplayableObservation({ demaHome: home }), null);
    assert.equal(historyReplayDiagnostic({ demaHome: home }).state, "HASH_UNVERIFIED");

    write({ ...good, schema: "something.else.v9" });
    assert.equal(historyReplayDiagnostic({ demaHome: home }).state, "SCHEMA_MISMATCH");

    // A genuinely STALE artefact is internally consistent: it was produced by an
    // older kernel, so its hash covers the old `executed_code_hash`. Editing that
    // field in place would break the hash and be caught one check earlier, which
    // would test the wrong thing — the hash gate, not the kernel-bytes gate.
    write(build(PROVEN_FACTS, { executedCodeHash: `sha256:${"0".repeat(64)}` }));
    const stale = historyReplayDiagnostic({ demaHome: home });
    assert.equal(stale.state, "KERNEL_BYTES_MISMATCH");
    assert.equal(stale.integrity_suspect, true);

    rmSync(join(home, "node0"), { recursive: true, force: true });
    const gone = historyReplayDiagnostic({ demaHome: home });
    assert.equal(gone.state, "NOT_RECORDED");
    assert.equal(gone.integrity_suspect, false, "nobody having run the producer is not suspicious");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ── HR-08 ─────────────────────────────────────────────────────────────────
test("HR-08: a non-proven verdict sources nothing, and diagnostics settle nothing", () => {
  const home = mkdtempSync(join(tmpdir(), "hr8-"));
  try {
    const p = join(home, HISTORY_REPLAY_ARTEFACT_RELPATH);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(build({ ...PROVEN_FACTS, tampered_receipt_rejected: false })));
    assert.equal(fullHistoryReplayableObservation({ demaHome: home }), null,
      "a REFUTED replay must not source the row as satisfied");
    assert.equal(historyReplayDiagnostic({ demaHome: home }).settles_nothing, true);
    assert.equal(historyReplayDiagnostic({ demaHome: home }).replay_verdict, "REPLAY_REFUTED");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ── HR-09 ── negative-control integrity, end to end ───────────────────────
test("HR-09: the real producer spends its process and proves the replay", () => {
  const home = mkdtempSync(join(tmpdir(), "hr9-"));
  try {
    const out = execFileSync("node", [PRODUCER, "--dema-home", home, "--json"],
      { cwd: REPO, encoding: "utf8", timeout: 300_000 });
    const report = JSON.parse(out.trim().split("\n").pop());

    assert.equal(report.replay_verdict, "HISTORY_REPLAY_PROVEN", JSON.stringify(report));
    assert.equal(report.observed, true);
    assert.equal(report.successions_replayed, 1, "the replay must cross a real rotation");
    assert.notEqual(report.genesis_root_fingerprint, report.final_authority_fingerprint,
      "root and current authority must differ, or no rotation was crossed");
    for (const [k, v] of Object.entries(report.negative_controls)) {
      assert.equal(v, true, `${k} must have REJECTED its corruption`);
    }
    // The artefact the adapter will read is the one the producer just wrote.
    assert.equal(fullHistoryReplayableObservation({ demaHome: home })?.observed, true);
    assert.equal(fullHistoryReplayableObservation({ demaHome: home })?.scope,
      NODE0_HISTORY_REPLAY_SCOPE);

    // No private key material may reach the artefact.
    assert.doesNotMatch(readFileSync(join(home, HISTORY_REPLAY_ARTEFACT_RELPATH), "utf8"),
      /PRIVATE KEY/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
