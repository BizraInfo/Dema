import { test } from "node:test";
import assert from "node:assert/strict";

import { formatHomebasePreview } from "../packages/core/src/tui-formatter.js";
import { buildHomebasePreview } from "../packages/core/src/homebase-preview.js";

const FIXED_TS = new Date("2026-05-18T12:42:00Z");

function makeGather(overrides = {}) {
  const base = {
    schema_version: "bizra.dema.homebase_gather.v0.1",
    ts: FIXED_TS,
    partial: false,
    warnings: [],
    profile: { name: "Mumu", node: "Node0", source_present: true },
    memory_recent: [],
    state: null,
    receipts: { count: 0, last_id: null, gateway_issued: 0 },
    process_mining: null,
    models: null,
    memory_size: { bytes: 5800000000, entries: 24 },
    env_flags: { no_color: false, term_dumb: false, tty: true },
  };
  return { ...base, ...overrides };
}

function makePreview(overrides) {
  return buildHomebasePreview({ gather: makeGather(overrides) });
}

// Strip ANSI escape sequences for visible-width measurement.
function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

test("formatHomebasePreview returns a non-empty multi-line ANSI string", () => {
  const out = formatHomebasePreview(makePreview());
  assert.equal(typeof out, "string");
  const lines = out.split("\n");
  assert.ok(lines.length >= 10, `expected ≥10 lines, got ${lines.length}`);
});

test("formatHomebasePreview rejects non-matching schema with error formatter", () => {
  const wrongSchema = { schema: "bizra.dema.something_else.v0.1" };
  const out = formatHomebasePreview(wrongSchema);
  assert.match(out, /formatter error/i);
  assert.match(out, /Expected bizra\.dema\.homebase_v0_1\.v0\.1/);
});

test("formatHomebasePreview handles null/undefined input via error formatter", () => {
  const outNull = formatHomebasePreview(null);
  const outUndef = formatHomebasePreview(undefined);
  assert.match(outNull, /formatter error/i);
  assert.match(outUndef, /formatter error/i);
});

test("formatHomebasePreview output respects 76-col visible-width budget", () => {
  const out = formatHomebasePreview(makePreview());
  for (const line of out.split("\n")) {
    const visible = stripAnsi(line);
    assert.ok(
      visible.length <= 76,
      `line exceeded 76 cols: "${visible}" (${visible.length})`,
    );
  }
});

test("formatHomebasePreview under noColor=true emits zero ANSI escape sequences", () => {
  const out = formatHomebasePreview(makePreview(), { noColor: true });
  assert.ok(!/\x1b\[/.test(out), "found ANSI escape under noColor=true");
});

test("formatHomebasePreview under termDumb=true uses ASCII box-drawing chars", () => {
  const out = formatHomebasePreview(makePreview(), {
    noColor: true,
    termDumb: true,
  });
  assert.ok(
    !out.includes("┌") && !out.includes("─") && !out.includes("│"),
    "found Unicode box chars under termDumb",
  );
  assert.ok(
    out.includes("+") || out.includes("-") || out.includes("|"),
    "expected ASCII fallback chars",
  );
});

test("formatHomebasePreview displays the greeting verbatim", () => {
  const out = formatHomebasePreview(
    makePreview({
      profile: { name: "Samy", node: "Node0", source_present: true },
    }),
    { noColor: true },
  );
  assert.match(out, /Welcome back, Samy\./);
});

test("formatHomebasePreview displays welcome text when profile is absent", () => {
  const out = formatHomebasePreview(
    makePreview({
      profile: { name: null, node: "Node0", source_present: false },
    }),
    { noColor: true },
  );
  // ADR-011 phase-2: welcome_new template is "Welcome to Dema." (English default)
  assert.match(out, /Welcome/);
  assert.ok(
    !/Welcome back/.test(out),
    "should NOT show 'Welcome back' for absent profile",
  );
});

test("formatHomebasePreview shows 'no prior sessions' fallback for empty memory_recent", () => {
  const out = formatHomebasePreview(makePreview({ memory_recent: [] }), {
    noColor: true,
  });
  assert.match(out, /no prior sessions/);
});

test("formatHomebasePreview renders all 3 memory entries when present", () => {
  const out = formatHomebasePreview(
    makePreview({
      memory_recent: [
        { name: "entry-a", mtime_ms: 3, summary: "alpha summary" },
        { name: "entry-b", mtime_ms: 2, summary: "beta summary" },
        { name: "entry-c", mtime_ms: 1, summary: "gamma summary" },
      ],
    }),
    { noColor: true },
  );
  assert.match(out, /Three things I remember/);
  assert.match(out, /alpha summary/);
  assert.match(out, /beta summary/);
  assert.match(out, /gamma summary/);
});

test("formatHomebasePreview displays all 6 affordance labels", () => {
  const out = formatHomebasePreview(makePreview(), { noColor: true });
  assert.match(out, /\[m\] Mission/);
  assert.match(out, /\[j\] Journal/);
  assert.match(out, /\[r\] Receipts/);
  assert.match(out, /\[b\] Browse/);
  assert.match(out, /\[\?\] Help/);
  assert.match(out, /\[q\] Quit/);
});

test("formatHomebasePreview includes the boundary footer", () => {
  const out = formatHomebasePreview(makePreview(), { noColor: true });
  assert.match(out, /Boundary:.*no action without explicit consent/);
});

test("formatHomebasePreview displays gateway status as unreachable-by-design", () => {
  const out = formatHomebasePreview(makePreview(), { noColor: true });
  assert.match(out, /Gateway/);
  assert.match(out, /unreachable/);
});

test("formatHomebasePreview displays next safe action text", () => {
  const out = formatHomebasePreview(
    makePreview({
      process_mining: {
        next_step_observable: "look at the lighthouse pack receipts",
      },
    }),
    { noColor: true },
  );
  assert.match(out, /Next safe action/);
  assert.match(out, /look at the lighthouse pack receipts/);
});

test("formatHomebasePreview is deterministic given identical input", () => {
  const p = makePreview();
  const a = formatHomebasePreview(p);
  const b = formatHomebasePreview(p);
  assert.equal(a, b, "formatter must be deterministic");
});

test("ADV: formatHomebasePreview surfaces partial-state warning marker when preview.partial=true", () => {
  const out = formatHomebasePreview(
    makePreview({
      partial: true,
      warnings: ["disk-flake-one", "memory-file-corrupt"],
    }),
    { noColor: true },
  );
  assert.match(out, /partial state/);
  assert.match(out, /2 warning/);
});

test("ADV: formatHomebasePreview does NOT display the keyboard-hints-only disclaimer (keys are now functional)", () => {
  const out = formatHomebasePreview(makePreview(), { noColor: true });
  assert.doesNotMatch(
    out,
    /keyboard hints only/,
    "disclaimer must be absent now that keys are wired",
  );
});

test("LAW-OF-ASSUMPTION: footer carries the LoA citation per docs/canon/LAW_OF_ASSUMPTION.md", () => {
  // The persona DNA must be visible in every render · not only textual in canon.
  // The boundary footer is the embodiment surface that operators see every time
  // `dema` is invoked. This is the gate that catches if the LoA citation is
  // ever silently removed. The one-line citation drops the definite article
  // "the" to fit the 72-char inner width budget · all canonical content words
  // preserved (Law of Assumption · declare · boundary · evidence · uncertainty).
  // Full canonical phrasing lives at docs/canon/LAW_OF_ASSUMPTION.md.
  const out = formatHomebasePreview(makePreview(), { noColor: true });
  assert.match(
    out,
    /Boundary: preview-only · no action without explicit consent\./,
  );
  assert.match(
    out,
    /Law of Assumption: declare boundary between evidence and uncertainty\./,
  );
});

test("LAW-OF-ASSUMPTION: both boundary lines render under termDumb (ASCII fallback)", () => {
  const out = formatHomebasePreview(makePreview(), {
    noColor: true,
    termDumb: true,
  });
  assert.match(out, /no action without explicit consent/);
  assert.match(out, /declare boundary between evidence and uncertainty/);
});
