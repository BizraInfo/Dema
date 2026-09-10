import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { admitHuman0 } from "../scripts/genesis/urp0-runtime.mjs";
import { admissionConsentPhrase, buildAdmissionContract } from "../packages/genesis/src/urp0-mission-kernel.js";

function admissionResult(stateRoot) {
  const contract = buildAdmissionContract({
    human_id: "HUMAN-0",
    node_id: "NODE0",
    roles: ["ARCHITECT", "FIRST_USER"],
  });
  return admitHuman0(stateRoot, {
    phrase: admissionConsentPhrase({
      human_id: "HUMAN-0",
      node_id: "NODE0",
      contract_hash: contract.contract_hash,
    }),
    now_iso: "2026-09-10T00:00:00.000Z",
  });
}

test("journal lock takeover ignores a dead unique predecessor and releases its own lock", () => {
  const base = mkdtempSync(join(tmpdir(), "genesis-journal-lock-"));
  const stateRoot = join(base, "dema-home", "genesis", "urp0");
  const lockDir = join(stateRoot, ".journal.ndjson.locks");
  try {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, "lock-1-999999999-deadbeef.json"), JSON.stringify({
      pid: 999999999,
      token: "deadbeef",
      start_token: "1",
      created_mono_ns: "1",
    }));

    const result = admissionResult(stateRoot);
    assert.equal(result.ok, true, JSON.stringify(result.blocked_by));
    assert.match(readFileSync(join(stateRoot, "journal.ndjson"), "utf8"), /HUMAN_REGISTERED/);
    assert.deepEqual(
      readdirNames(lockDir),
      ["lock-1-999999999-deadbeef.json"],
    );
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

function readdirNames(path) {
  return readdirSync(path).sort();
}

test("journal lock fails closed for a live unique predecessor", () => {
  const base = mkdtempSync(join(tmpdir(), "genesis-journal-lock-live-"));
  const stateRoot = join(base, "dema-home", "genesis", "urp0");
  const lockDir = join(stateRoot, ".journal.ndjson.locks");
  const predecessor = join(lockDir, `lock-1-${process.pid}-deadbeef.json`);
  try {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(predecessor, JSON.stringify({ pid: process.pid, token: "live", created_mono_ns: "1" }));
    const result = admissionResult(stateRoot);
    assert.equal(result.ok, false);
    assert.deepEqual(result.blocked_by, ["journal_lock_busy"]);
    assert.equal(readFileSync(predecessor, "utf8").includes("live"), true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("journal lock fails closed for a malformed unique predecessor", () => {
  const base = mkdtempSync(join(tmpdir(), "genesis-journal-lock-malformed-"));
  const stateRoot = join(base, "dema-home", "genesis", "urp0");
  const lockDir = join(stateRoot, ".journal.ndjson.locks");
  const predecessor = join(lockDir, "lock-1-2-deadbeef.json");
  try {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(predecessor, "not-json\n");
    const result = admissionResult(stateRoot);
    assert.equal(result.ok, false);
    assert.deepEqual(result.blocked_by, ["journal_lock_busy"]);
    assert.equal(readFileSync(predecessor, "utf8"), "not-json\n");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("journal lock treats a reused PID with a different start token as stale", () => {
  const base = mkdtempSync(join(tmpdir(), "genesis-journal-lock-pid-reuse-"));
  const stateRoot = join(base, "dema-home", "genesis", "urp0");
  const lockDir = join(stateRoot, ".journal.ndjson.locks");
  const predecessor = join(lockDir, `lock-1-${process.pid}-deadbeef.json`);
  try {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(predecessor, JSON.stringify({
      pid: process.pid,
      token: "stale-process-instance",
      start_token: "not-the-current-process-start-token",
      created_mono_ns: "1",
    }));
    const result = admissionResult(stateRoot);
    assert.equal(result.ok, true, JSON.stringify(result.blocked_by));
    assert.equal(readFileSync(join(stateRoot, "journal.ndjson"), "utf8").includes("HUMAN_REGISTERED"), true);
    assert.equal(readFileSync(predecessor, "utf8").includes("stale-process-instance"), true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("journal lock ignores unrelated files without deleting them", () => {
  const base = mkdtempSync(join(tmpdir(), "genesis-journal-lock-unrelated-"));
  const stateRoot = join(base, "dema-home", "genesis", "urp0");
  const lockDir = join(stateRoot, ".journal.ndjson.locks");
  const unrelated = join(lockDir, "README");
  try {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(unrelated, "not a lock entry\n");
    const result = admissionResult(stateRoot);
    assert.equal(result.ok, true, JSON.stringify(result.blocked_by));
    assert.equal(readFileSync(unrelated, "utf8"), "not a lock entry\n");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("journal lock respects the retired live singleton during cutover", () => {
  const base = mkdtempSync(join(tmpdir(), "genesis-journal-lock-legacy-"));
  const stateRoot = join(base, "dema-home", "genesis", "urp0");
  const legacy = join(stateRoot, ".journal.ndjson.lock");
  try {
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(legacy, `${process.pid}:legacy\n`);
    const result = admissionResult(stateRoot);
    assert.equal(result.ok, false);
    assert.deepEqual(result.blocked_by, ["journal_lock_busy"]);
    assert.equal(readFileSync(legacy, "utf8"), `${process.pid}:legacy\n`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("journal lock fails closed for a malformed retired singleton", () => {
  const base = mkdtempSync(join(tmpdir(), "genesis-journal-lock-legacy-malformed-"));
  const stateRoot = join(base, "dema-home", "genesis", "urp0");
  const legacy = join(stateRoot, ".journal.ndjson.lock");
  try {
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(legacy, "not-a-lock\n");
    const result = admissionResult(stateRoot);
    assert.equal(result.ok, false);
    assert.deepEqual(result.blocked_by, ["journal_lock_busy"]);
    assert.equal(readFileSync(legacy, "utf8"), "not-a-lock\n");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("journal lock ignores a dead retired singleton and preserves it", () => {
  const base = mkdtempSync(join(tmpdir(), "genesis-journal-lock-legacy-dead-"));
  const stateRoot = join(base, "dema-home", "genesis", "urp0");
  const legacy = join(stateRoot, ".journal.ndjson.lock");
  try {
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(legacy, "999999999:legacy-dead\n");
    const result = admissionResult(stateRoot);
    assert.equal(result.ok, true, JSON.stringify(result.blocked_by));
    assert.equal(readFileSync(join(stateRoot, "journal.ndjson"), "utf8").includes("HUMAN_REGISTERED"), true);
    assert.equal(readFileSync(legacy, "utf8"), "999999999:legacy-dead\n");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("journal lock fails closed for a structurally invalid unique predecessor", () => {
  const base = mkdtempSync(join(tmpdir(), "genesis-journal-lock-invalid-"));
  const stateRoot = join(base, "dema-home", "genesis", "urp0");
  const lockDir = join(stateRoot, ".journal.ndjson.locks");
  const predecessor = join(lockDir, "lock-1-2-badc0de.json");
  try {
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(predecessor, JSON.stringify({
      pid: 2,
      token: "",
      created_mono_ns: "1",
    }));
    const result = admissionResult(stateRoot);
    assert.equal(result.ok, false);
    assert.deepEqual(result.blocked_by, ["journal_lock_busy"]);
    assert.equal(readFileSync(predecessor, "utf8").includes('"token":""'), true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
