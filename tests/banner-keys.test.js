import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  readBannerKey,
  KEY_BINDINGS,
} from "../packages/core/src/banner-keys.js";

// Build a mock stdin stream that emits a byte sequence after a tick.
function mockStdin(bytes, { isTTY = true } = {}) {
  const em = new EventEmitter();
  em.isTTY = isTTY;
  em.setRawMode = () => {};
  em.resume = () => {};
  em.pause = () => {};
  if (bytes !== null) {
    setImmediate(() => em.emit("data", Buffer.from(bytes)));
  }
  return em;
}

// Minimal writable stdout sink.
function mockStdout() {
  const chunks = [];
  return {
    write(s) {
      chunks.push(s);
    },
    get output() {
      return chunks.join("");
    },
  };
}

test("KEY_BINDINGS is frozen and contains exactly the 6 documented keys", () => {
  assert.ok(Object.isFrozen(KEY_BINDINGS));
  assert.deepEqual(
    Object.keys(KEY_BINDINGS).sort(),
    ["?", "b", "h", "j", "m", "r"].sort(),
  );
});

test("readBannerKey: 'm' returns 'm'", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("m"),
    stdout: mockStdout(),
  });
  assert.equal(key, "m");
});

test("readBannerKey: 'j' returns 'j'", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("j"),
    stdout: mockStdout(),
  });
  assert.equal(key, "j");
});

test("readBannerKey: 'r' returns 'r'", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("r"),
    stdout: mockStdout(),
  });
  assert.equal(key, "r");
});

test("readBannerKey: 'b' returns 'b'", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("b"),
    stdout: mockStdout(),
  });
  assert.equal(key, "b");
});

test("readBannerKey: '?' returns '?'", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("?"),
    stdout: mockStdout(),
  });
  assert.equal(key, "?");
});

test("readBannerKey: 'q' returns null (quit signal)", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("q"),
    stdout: mockStdout(),
  });
  assert.equal(key, null);
});

test("readBannerKey: ESC (0x1b) returns null", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("\x1b"),
    stdout: mockStdout(),
  });
  assert.equal(key, null);
});

test("readBannerKey: Enter CR (0x0d) returns null", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("\r"),
    stdout: mockStdout(),
  });
  assert.equal(key, null);
});

test("readBannerKey: Ctrl-C (0x03) returns null", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("\x03"),
    stdout: mockStdout(),
  });
  assert.equal(key, null);
});

test("readBannerKey: unknown key then 'q' — eventually returns null", async () => {
  // Emit 'x' (unknown) then 'q' (quit) — x triggers retry hint, q exits.
  const em = new EventEmitter();
  em.isTTY = true;
  em.setRawMode = () => {};
  em.resume = () => {};
  em.pause = () => {};
  setImmediate(() => {
    em.emit("data", Buffer.from("x"));
    setImmediate(() => em.emit("data", Buffer.from("q")));
  });
  const key = await readBannerKey({ stdin: em, stdout: mockStdout() });
  assert.equal(key, null);
});

test("readBannerKey: timeout returns null", async () => {
  // Non-null stdin so we enter the read path, but emit nothing — timeout fires.
  const em = new EventEmitter();
  em.isTTY = true;
  em.setRawMode = () => {};
  em.resume = () => {};
  em.pause = () => {};
  const key = await readBannerKey({
    stdin: em,
    stdout: mockStdout(),
    timeoutMs: 10,
  });
  assert.equal(key, null);
});

test("readBannerKey: non-TTY stdin returns null immediately without reading", async () => {
  const key = await readBannerKey({
    stdin: mockStdin("m", { isTTY: false }),
    stdout: mockStdout(),
  });
  assert.equal(key, null);
});

test("KEY_BINDINGS['m'] dispatches to mission propose argv", () => {
  assert.deepEqual(KEY_BINDINGS["m"], ["mission", "propose"]);
});

test("KEY_BINDINGS['j'] dispatches to today argv", () => {
  assert.deepEqual(KEY_BINDINGS["j"], ["today"]);
});

test("KEY_BINDINGS['b'] dispatches to explain argv", () => {
  assert.deepEqual(KEY_BINDINGS["b"], ["explain"]);
});

test("KEY_BINDINGS['h'] and '?' both map to help", () => {
  assert.deepEqual(KEY_BINDINGS["?"], ["help"]);
  assert.deepEqual(KEY_BINDINGS["h"], ["help"]);
});

import { runBannerKeyLoop } from "../packages/core/src/banner-keys.js";

test("LOOP-01: runBannerKeyLoop exits cleanly when readKey returns null (no dispatch)", async () => {
  const calls = [];
  const dispatches = await runBannerKeyLoop({
    readKey: async () => null,
    dispatchFn: async (argv) => {
      calls.push(argv);
    },
  });
  assert.equal(dispatches, 0);
  assert.equal(calls.length, 0);
});

test("LOOP-02: runBannerKeyLoop dispatches each key then exits on null", async () => {
  const sequence = ["m", "j", "r", null];
  let i = 0;
  const calls = [];
  const dispatches = await runBannerKeyLoop({
    readKey: async () => sequence[i++],
    dispatchFn: async (argv) => {
      calls.push(argv);
    },
  });
  assert.equal(dispatches, 3);
  assert.deepEqual(calls, [["mission", "propose"], ["today"], ["receipts"]]);
});

test("LOOP-03: runBannerKeyLoop ignores unmapped keys (no dispatch) then continues", async () => {
  const sequence = ["x", "m", "z", null];
  let i = 0;
  const calls = [];
  const dispatches = await runBannerKeyLoop({
    readKey: async () => sequence[i++],
    dispatchFn: async (argv) => {
      calls.push(argv);
    },
  });
  assert.equal(dispatches, 1);
  assert.deepEqual(calls, [["mission", "propose"]]);
});

test("LOOP-04: runBannerKeyLoop respects maxIterations safety cap", async () => {
  // readKey always returns 'm' — without cap this would loop forever.
  const calls = [];
  const dispatches = await runBannerKeyLoop({
    readKey: async () => "m",
    dispatchFn: async (argv) => {
      calls.push(argv);
    },
    maxIterations: 7,
  });
  assert.equal(dispatches, 7);
  assert.equal(calls.length, 7);
});

test("LOOP-05: runBannerKeyLoop throws TypeError when readKey is not a function", async () => {
  await assert.rejects(
    () => runBannerKeyLoop({ readKey: null, dispatchFn: async () => {} }),
    TypeError,
  );
});

test("LOOP-06: runBannerKeyLoop throws TypeError when dispatchFn is not a function", async () => {
  await assert.rejects(
    () =>
      runBannerKeyLoop({ readKey: async () => null, dispatchFn: "not a fn" }),
    TypeError,
  );
});
