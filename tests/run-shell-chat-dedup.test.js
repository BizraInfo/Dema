// Bug 3 regression: `dema chat` was stacking the new bordered chat banner
// on top of the legacy `formatBanner` greeting block — visual duplication
// because the chat banner is a strict superset of the greeting block.
// runShell must now skip the greeting when the chat banner is rendered.

import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runShell } from "../packages/core/src/shell.js";

function buildOutputSink({ isTTY }) {
  const chunks = [];
  const out = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString("utf8"));
      cb();
    }
  });
  out.isTTY = isTTY;
  return { out, text: () => chunks.join("") };
}

function buildInput({ isTTY }) {
  // Feed a single `exit` command so the shell terminates cleanly.
  const r = Readable.from(["exit\n"]);
  r.isTTY = isTTY;
  r.setRawMode = () => {};
  return r;
}

test("DEDUP-01: runShell with TTY output shows chat banner and skips legacy greeting", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "dema-shell-dedup-"));
  const { out, text } = buildOutputSink({ isTTY: true });
  const input = buildInput({ isTTY: true });

  const prevHome = process.env.DEMA_HOME;
  const prevInteractive = process.env.DEMA_BANNER_INTERACTIVE;
  process.env.DEMA_HOME = tmp;
  delete process.env.DEMA_BANNER_INTERACTIVE;
  try {
    await runShell({
      input,
      output: out,
      dispatchCommand: async () => {},
      greeting: "LEGACY_GREETING_MARKER_SHOULD_NOT_APPEAR",
      installSigintHandler: false
    });
  } finally {
    if (prevHome === undefined) delete process.env.DEMA_HOME; else process.env.DEMA_HOME = prevHome;
    if (prevInteractive !== undefined) process.env.DEMA_BANNER_INTERACTIVE = prevInteractive;
  }

  const captured = text();
  assert.match(captured, /DEMA CHAT/, "chat banner must be rendered");
  assert.doesNotMatch(captured, /LEGACY_GREETING_MARKER_SHOULD_NOT_APPEAR/,
    "legacy greeting must be suppressed when chat banner shown");
});

test("DEDUP-02: runShell with non-TTY output suppresses chat banner AND emits legacy greeting (back-compat)", async () => {
  const { out, text } = buildOutputSink({ isTTY: false });
  const input = buildInput({ isTTY: false });

  await runShell({
    input,
    output: out,
    dispatchCommand: async () => {},
    greeting: "LEGACY_GREETING_MARKER_BACKCOMPAT",
    installSigintHandler: false
  });

  const captured = text();
  assert.doesNotMatch(captured, /DEMA CHAT/, "chat banner suppressed in non-TTY mode");
  assert.match(captured, /LEGACY_GREETING_MARKER_BACKCOMPAT/, "legacy greeting still present in non-TTY mode");
});

test("DEDUP-03: runShell with noBanner=true suppresses chat banner AND emits legacy greeting", async () => {
  const { out, text } = buildOutputSink({ isTTY: true });
  const input = buildInput({ isTTY: true });

  await runShell({
    input,
    output: out,
    dispatchCommand: async () => {},
    greeting: "LEGACY_GREETING_NO_BANNER",
    installSigintHandler: false,
    noBanner: true
  });

  const captured = text();
  assert.doesNotMatch(captured, /DEMA CHAT/);
  assert.match(captured, /LEGACY_GREETING_NO_BANNER/);
});

test("DEDUP-04: HELP block is always emitted (chat banner does not remove it)", async () => {
  const tmp = await mkdtemp(join(tmpdir(), "dema-shell-help-"));
  const { out, text } = buildOutputSink({ isTTY: true });
  const input = buildInput({ isTTY: true });

  const prevHome = process.env.DEMA_HOME;
  const prevInteractive = process.env.DEMA_BANNER_INTERACTIVE;
  process.env.DEMA_HOME = tmp;
  delete process.env.DEMA_BANNER_INTERACTIVE;
  try {
    await runShell({
      input,
      output: out,
      dispatchCommand: async () => {},
      greeting: "ignored",
      installSigintHandler: false
    });
  } finally {
    if (prevHome === undefined) delete process.env.DEMA_HOME; else process.env.DEMA_HOME = prevHome;
    if (prevInteractive !== undefined) process.env.DEMA_BANNER_INTERACTIVE = prevInteractive;
  }

  const captured = text();
  // HELP includes section heads like "Readiness:" and "Local evidence:"
  assert.match(captured, /Readiness:/, "HELP block must still appear after chat banner");
  assert.match(captured, /Local evidence:/, "HELP block must include local-evidence section");
  assert.doesNotMatch(captured, /read-only in v0\.3\.0/, "shell help must not carry stale release wording");
});
