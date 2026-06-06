import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  defaultStatus,
  formatStatus,
  shouldUseColor,
} from "../packages/core/src/status.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

const ANSI_RE = /\x1b\[[0-9;]*m/;

function statusWithFindings() {
  return {
    ...defaultStatus(),
    findings: [
      "Gateway /health unreachable: fetch failed",
      "Gateway /chain failed: fetch failed",
    ],
  };
}

function statusNoFindings() {
  return { ...defaultStatus(), findings: [] };
}

test("color mode: all 3 zone titles present", () => {
  const out = formatStatus(defaultStatus(), { color: true });
  assert.match(out, /Identity/);
  assert.match(out, /Readiness/);
  assert.match(out, /Findings/);
});

test("plain mode: all 3 zone titles present without ANSI", () => {
  const out = formatStatus(defaultStatus(), { color: false });
  assert.match(out, /Identity/);
  assert.match(out, /Readiness/);
  assert.match(out, /Findings/);
  assert.ok(
    !ANSI_RE.test(out),
    "plain mode must emit zero ANSI escape sequences",
  );
});

test("color mode emits at least one ANSI escape sequence", () => {
  const out = formatStatus(defaultStatus(), { color: true });
  assert.ok(
    ANSI_RE.test(out),
    "color mode must emit at least one ANSI escape sequence",
  );
});

test("plain mode emits zero ANSI escape sequences", () => {
  const out = formatStatus(defaultStatus(), { color: false });
  assert.ok(
    !ANSI_RE.test(out),
    "plain mode must emit zero ANSI escape sequences",
  );
});

test("shouldUseColor: NO_COLOR env suppresses color", () => {
  const saved = process.env.NO_COLOR;
  process.env.NO_COLOR = "";
  try {
    assert.equal(shouldUseColor({}), false);
  } finally {
    if (saved === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = saved;
  }
});

test("shouldUseColor: opts.color=true overrides NO_COLOR", () => {
  const saved = process.env.NO_COLOR;
  process.env.NO_COLOR = "";
  try {
    assert.equal(shouldUseColor({ color: true }), true);
  } finally {
    if (saved === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = saved;
  }
});

test("shouldUseColor: TERM=dumb suppresses color", () => {
  const saved = process.env.TERM;
  process.env.TERM = "dumb";
  try {
    assert.equal(shouldUseColor({}), false);
  } finally {
    if (saved === undefined) delete process.env.TERM;
    else process.env.TERM = saved;
  }
});

test("shouldUseColor: opts.color=true overrides TERM=dumb", () => {
  const saved = process.env.TERM;
  process.env.TERM = "dumb";
  try {
    assert.equal(shouldUseColor({ color: true }), true);
  } finally {
    if (saved === undefined) delete process.env.TERM;
    else process.env.TERM = saved;
  }
});

test("shouldUseColor: opts.color=false suppresses color", () => {
  assert.equal(shouldUseColor({ color: false }), false);
});

test("findings present: Findings zone title visible (red ANSI if color)", () => {
  const out = formatStatus(statusWithFindings(), { color: true });
  assert.match(out, /Findings/);
  // Red bold escape precedes "Findings" (not "none")
  assert.match(out, /\x1b\[1;31mFindings\x1b\[0m/);
});

test("findings empty: 'Findings: none' in bold green when color", () => {
  const out = formatStatus(statusNoFindings(), { color: true });
  assert.match(out, /\x1b\[1;32mFindings: none\x1b\[0m/);
});

test("boundary footer always present regardless of color mode", () => {
  const colored = formatStatus(defaultStatus(), { color: true });
  const plain = formatStatus(defaultStatus(), { color: false });
  assert.match(colored, /Boundary: no action without explicit consent/);
  assert.match(plain, /Boundary: no action without explicit consent/);
});

// Integration test: dema status --no-color → no ANSI, 3 zones present
test("dema status --no-color: no ANSI codes and 3 zones present", async () => {
  const { stdout } = await execFileAsync(
    "node",
    [cliPath, "status", "--no-color"],
    {
      env: {
        ...process.env,
        DEMA_NODE0_ADAPTER: "",
        DEMA_GATEWAY_URL: "",
        DEMA_NODE0_STATUS_COMMAND: "",
      },
    },
  );
  assert.ok(
    !ANSI_RE.test(stdout),
    "dema status --no-color must emit no ANSI codes",
  );
  assert.match(stdout, /Identity/);
  assert.match(stdout, /Readiness/);
  assert.match(stdout, /Findings/);
});
