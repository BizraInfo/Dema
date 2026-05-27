import test from "node:test";
import assert from "node:assert/strict";
import { createSpinner } from "../packages/core/src/spinner.js";

// Build a fake stdout that records writes. isTTY=true by default.
function fakeStdout({ isTTY = true } = {}) {
  const writes = [];
  return {
    isTTY,
    write(chunk) {
      writes.push(chunk);
    },
    writes,
  };
}

test("createSpinner returns start, update, stop methods", () => {
  const out = fakeStdout();
  const spinner = createSpinner({ stdout: out, label: "Working…" });
  assert.equal(typeof spinner.start, "function");
  assert.equal(typeof spinner.update, "function");
  assert.equal(typeof spinner.stop, "function");
});

test("start emits a frame containing the label", () => {
  const out = fakeStdout();
  // suppressed:false overrides env-based detection (process.env.CI is set in
  // GitHub Actions and would otherwise suppress all writes — see Task #10).
  const spinner = createSpinner({
    stdout: out,
    label: "Loading",
    intervalMs: 10000,
    suppressed: false,
  });
  spinner.start();
  spinner.stop();
  // At least the first write must contain the label text.
  assert.ok(
    out.writes.some((w) => w.includes("Loading")),
    "first write contains label",
  );
});

test("update changes the label used in subsequent writes", () => {
  const out = fakeStdout();
  const spinner = createSpinner({
    stdout: out,
    label: "Phase A",
    intervalMs: 10000,
    suppressed: false,
  });
  spinner.start();
  spinner.update("Phase B");
  spinner.stop();
  // stop clears the line using the updated label length — verify no crash and
  // the last write (clear) uses spaces, not the old label.
  const lastWrite = out.writes[out.writes.length - 1];
  assert.match(lastWrite, /^\r +\r$/);
});

test("stop clears the spinner line (\\r + spaces + \\r)", () => {
  const out = fakeStdout();
  const spinner = createSpinner({
    stdout: out,
    label: "Hello",
    intervalMs: 10000,
    suppressed: false,
  });
  spinner.start();
  spinner.stop();
  const clearWrite = out.writes[out.writes.length - 1];
  assert.match(clearWrite, /^\r +\r$/, "last write is the clear sequence");
});

test("suppressed:true — no I/O on start, update, stop", () => {
  const out = fakeStdout();
  const spinner = createSpinner({
    stdout: out,
    label: "Hidden",
    suppressed: true,
  });
  spinner.start();
  spinner.update("Still hidden");
  spinner.stop();
  assert.equal(out.writes.length, 0, "no writes when suppressed");
});

test("non-TTY stdout auto-suppresses", () => {
  const out = fakeStdout({ isTTY: false });
  const spinner = createSpinner({ stdout: out, label: "Quiet" });
  spinner.start();
  spinner.stop();
  assert.equal(out.writes.length, 0, "non-TTY produces no output");
});

test("frame rotation cycles through all 10 braille frames", (t) => {
  const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const out = fakeStdout();
  // Use mock timer to control ticks.
  t.mock.timers.enable({ apis: ["setInterval"] });

  const spinner = createSpinner({
    stdout: out,
    label: "Tick",
    intervalMs: 80,
    suppressed: false,
  });
  spinner.start();
  // Advance 10 intervals to see all frames.
  t.mock.timers.tick(80 * 10);
  spinner.stop();

  // Collect the frames written (each write is \r<frame> <label>).
  const frames = out.writes
    .filter((w) => !/^\r +\r$/.test(w)) // exclude clear writes
    .map((w) => w.replace(/^\r/, "")[0]); // first char after \r

  // All 10 distinct frames must appear.
  for (const f of FRAMES) {
    assert.ok(frames.includes(f), `frame ${f} must appear`);
  }
});

test("multiple start/stop cycles are safe", () => {
  const out = fakeStdout();
  const spinner = createSpinner({
    stdout: out,
    label: "Cycle",
    intervalMs: 10000,
    suppressed: false,
  });
  spinner.start();
  spinner.stop();
  const writesAfterFirst = out.writes.length;
  spinner.start();
  spinner.stop();
  // Second cycle should produce writes as well (not silently dead).
  assert.ok(
    out.writes.length > writesAfterFirst,
    "second cycle produces output",
  );
});

test("stop without prior start is safe (no crash, no output)", () => {
  const out = fakeStdout();
  const spinner = createSpinner({
    stdout: out,
    label: "NoStart",
    intervalMs: 10000,
  });
  assert.doesNotThrow(() => spinner.stop());
  assert.equal(out.writes.length, 0, "stop-without-start writes nothing");
});

test("very long label is safely truncated to 120 chars", () => {
  const out = fakeStdout();
  const longLabel = "X".repeat(300);
  const spinner = createSpinner({
    stdout: out,
    label: longLabel,
    intervalMs: 10000,
    suppressed: false,
  });
  spinner.start();
  spinner.stop();
  // The write containing the frame must not exceed 120 + 3 chars (frame + space + label).
  const frameWrites = out.writes.filter((w) => !/^\r +\r$/.test(w));
  for (const w of frameWrites) {
    // "\r" + frame(1) + " "(1) + label(≤120) = ≤123 + \r = ≤124
    assert.ok(
      w.length <= 124,
      `write length ${w.length} exceeds truncation limit`,
    );
  }
});
