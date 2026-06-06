import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  EVENT_LOG_SCHEMA,
  buildEvent,
  appendEvent,
  readEvents,
} from "../packages/core/src/event-log.js";

// OBS-1A · observability event-log kernel tests.
//
// Sovereignty discipline: local-only, redacted BY CONSTRUCTION (no raw argv /
// content ever enters a record), content-addressed + hash-chained for tamper
// evidence. No network. No auto-capture. Tests use a temp DEMA_HOME.

const HEX64 = /^[0-9a-f]{64}$/;
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EVENTS_CLI = join(REPO_ROOT, "scripts", "events.mjs");

function runEvents(home, args = []) {
  return spawnSync("node", [EVENTS_CLI, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, DEMA_HOME: home, NO_COLOR: "1" },
    encoding: "utf8",
    timeout: 15000,
  });
}

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-events-"));
}

const VALID = {
  command: "status",
  outcome: "ok",
  correlation_id: "run-0001",
  recorded_at_iso: "2026-06-03T00:00:00.000Z",
};

test("EVENT_LOG_SCHEMA is the versioned schema id", () => {
  assert.equal(EVENT_LOG_SCHEMA, "bizra.dema.event_log_entry.v0.1");
});

test("buildEvent returns a frozen, schema-tagged, content-addressed record", () => {
  const e = buildEvent(VALID);
  assert.ok(Object.isFrozen(e));
  assert.equal(e.schema, EVENT_LOG_SCHEMA);
  assert.equal(e.command, "status");
  assert.equal(e.outcome, "ok");
  assert.equal(e.correlation_id, "run-0001");
  assert.match(e.event_id, HEX64);
});

test("buildEvent is deterministic: same content → same event_id", () => {
  assert.equal(buildEvent(VALID).event_id, buildEvent(VALID).event_id);
});

test("buildEvent fail-closed: missing required fields throw", () => {
  assert.throws(() => buildEvent({ outcome: "ok", correlation_id: "x" }));
  assert.throws(() => buildEvent({ command: "s", correlation_id: "x" }));
  assert.throws(() => buildEvent({ command: "s", outcome: "ok" }));
});

test("buildEvent fail-closed: invalid outcome enum throws", () => {
  assert.throws(() => buildEvent({ ...VALID, outcome: "exploded" }));
});

test("buildEvent fail-closed: invalid recorded_at_iso throws", () => {
  assert.throws(
    () => buildEvent({ ...VALID, recorded_at_iso: "not-an-iso-date" }),
    /recorded_at_iso/,
  );
  assert.throws(
    () => buildEvent({ ...VALID, recorded_at_iso: new Date() }),
    /recorded_at_iso/,
  );
});

test("buildEvent redaction: non-primitive metadata is rejected (no content leak)", () => {
  assert.throws(() =>
    buildEvent({ ...VALID, metadata: { args: ["secret", "payload"] } }),
  );
  assert.throws(() => buildEvent({ ...VALID, metadata: { nested: { a: 1 } } }));
  // Primitive metadata is accepted.
  const ok = buildEvent({
    ...VALID,
    metadata: { duration_ms: 12, exit_code: 0, dry_run: true },
  });
  assert.equal(ok.metadata.duration_ms, 12);
});

test("appendEvent writes genesis entry with prev_hash null and creates the log", () => {
  const home = freshHome();
  try {
    const e = buildEvent(VALID);
    const res = appendEvent({ home, event: e });
    assert.match(res.path, /events\/log\.jsonl$/);
    assert.equal(res.event_id, e.event_id);
    assert.equal(res.line_number, 1);
    assert.equal(res.prev_hash, null);
    const raw = readFileSync(res.path, "utf8").trim().split("\n");
    assert.equal(raw.length, 1);
    assert.equal(JSON.parse(raw[0]).prev_hash, null);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("appendEvent chains prev_hash to the previous entry's event_id", () => {
  const home = freshHome();
  try {
    const e1 = buildEvent(VALID);
    appendEvent({ home, event: e1 });
    const e2 = buildEvent({ ...VALID, correlation_id: "run-0002" });
    const res2 = appendEvent({ home, event: e2 });
    assert.equal(res2.line_number, 2);
    assert.equal(res2.prev_hash, e1.event_id);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("readEvents round-trips entries in order with verified + chain_intact", () => {
  const home = freshHome();
  try {
    appendEvent({ home, event: buildEvent(VALID) });
    appendEvent({
      home,
      event: buildEvent({ ...VALID, correlation_id: "run-0002" }),
    });
    const out = readEvents({ home });
    assert.equal(out.entries.length, 2);
    assert.equal(out.entries[0].correlation_id, "run-0001");
    assert.equal(out.entries[1].correlation_id, "run-0002");
    assert.equal(out.verified, true);
    assert.equal(out.chain_intact, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("readEvents: empty/absent log is vacuously valid", () => {
  const home = freshHome();
  try {
    const out = readEvents({ home });
    assert.deepEqual(out.entries, []);
    assert.equal(out.verified, true);
    assert.equal(out.chain_intact, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("readEvents: tampering an entry's content fails event_id verification", () => {
  const home = freshHome();
  try {
    const res = appendEvent({ home, event: buildEvent(VALID) });
    const line = JSON.parse(readFileSync(res.path, "utf8").trim());
    line.command = "uninstall"; // tamper content, keep stale event_id
    writeFileSync(res.path, JSON.stringify(line) + "\n");
    const out = readEvents({ home });
    assert.equal(out.verified, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("readEvents: tampering prev_hash breaks chain_intact", () => {
  const home = freshHome();
  try {
    appendEvent({ home, event: buildEvent(VALID) });
    const res2 = appendEvent({
      home,
      event: buildEvent({ ...VALID, correlation_id: "run-0002" }),
    });
    const lines = readFileSync(res2.path, "utf8").trim().split("\n");
    const second = JSON.parse(lines[1]);
    second.prev_hash = "f".repeat(64); // break the link
    lines[1] = JSON.stringify(second);
    writeFileSync(res2.path, lines.join("\n") + "\n");
    const out = readEvents({ home });
    assert.equal(out.chain_intact, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("readEvents: a corrupt line is skipped and flagged, never throws", () => {
  const home = freshHome();
  try {
    const res = appendEvent({ home, event: buildEvent(VALID) });
    writeFileSync(
      res.path,
      readFileSync(res.path, "utf8") + "{not valid json\n",
    );
    const out = readEvents({ home });
    assert.equal(out.entries.length, 1);
    assert.ok(out.corrupt_lines >= 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("appendEvent rejects tampered event_id before writing", () => {
  const home = freshHome();
  try {
    const event = buildEvent(VALID);
    const tampered = { ...event, event_id: "0".repeat(64) };
    assert.throws(() => appendEvent({ home, event: tampered }), /event_id/);
    assert.equal(readEvents({ home }).count, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("appendEvent creates event log paths with no group/world permissions", () => {
  const home = freshHome();
  try {
    const res = appendEvent({ home, event: buildEvent(VALID) });
    const dirMode = statSync(join(home, "events")).mode & 0o777;
    const fileMode = statSync(res.path).mode & 0o777;
    assert.equal(dirMode & 0o077, 0);
    assert.equal(fileMode & 0o077, 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("readEvents fails closed without an explicit DEMA_HOME path", () => {
  assert.throws(() => readEvents(), /home/);
  assert.throws(() => readEvents({ home: "" }), /home/);
});

test("events reader exits nonzero when corrupt lines are present", () => {
  const home = freshHome();
  try {
    const res = appendEvent({ home, event: buildEvent(VALID) });
    writeFileSync(
      res.path,
      readFileSync(res.path, "utf8") + "{not valid json\n",
    );
    const cli = runEvents(home, ["--json"]);
    assert.equal(
      cli.status,
      1,
      "stdout:\n" + cli.stdout + "\nstderr:\n" + cli.stderr,
    );
    const report = JSON.parse(cli.stdout);
    assert.equal(report.corrupt_lines, 1);
    assert.equal(report.boundary.read_only, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("events reader rejects non-positive --limit", () => {
  const home = freshHome();
  try {
    const cli = runEvents(home, ["--limit", "0", "--json"]);
    assert.equal(cli.status, 1);
    assert.match(cli.stderr, /--limit must be a positive integer/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
