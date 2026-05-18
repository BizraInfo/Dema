import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatOnboardingLifecyclePreview,
  formatNodeRegistryPreview,
  resolveFormatterOptsFromEnv,
  TUI_FORMATTER_DEFAULT_WIDTH
} from "../packages/core/src/tui-formatter.js";

import { buildOnboardingLifecyclePreview } from "../packages/core/src/onboarding-lifecycle.js";
import { buildNodeRegistryPreview } from "../packages/core/src/node-registry-preview.js";

// Strip ANSI for length / content checks
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function maxLineWidth(s) {
  return s.split("\n").reduce((m, l) => Math.max(m, stripAnsi(l).length), 0);
}

// ─── BASE TESTS (12) ────────────────────────────────────────────────────────

test("formatOnboardingLifecyclePreview renders a non-empty string", () => {
  const preview = buildOnboardingLifecyclePreview();
  const out = formatOnboardingLifecyclePreview(preview);
  assert.equal(typeof out, "string");
  assert.ok(out.length > 0);
});

test("Onboarding formatter renders all 7 stage IDs", () => {
  const preview = buildOnboardingLifecyclePreview({ candidate_name: "Samy", candidate_ordinal: 1 });
  const out = stripAnsi(formatOnboardingLifecyclePreview(preview));
  assert.match(out, /language/);
  assert.match(out, /technical_level/);
  assert.match(out, /node_role/);
  assert.match(out, /purpose/);
  assert.match(out, /resources/);
  assert.match(out, /consent_constitution/);
  assert.match(out, /first_mission/);
});

test("Onboarding formatter renders candidate name and node label in header", () => {
  const preview = buildOnboardingLifecyclePreview({ candidate_name: "Samy", candidate_ordinal: 1 });
  const out = stripAnsi(formatOnboardingLifecyclePreview(preview));
  assert.match(out, /Samy/);
  assert.match(out, /Node1/);
});

test("Onboarding formatter shows progress bar at 0% on default state", () => {
  const preview = buildOnboardingLifecyclePreview();
  const out = stripAnsi(formatOnboardingLifecyclePreview(preview));
  assert.match(out, /\s+0%/);
  assert.match(out, /\(0\/7\)/);
});

test("Onboarding formatter shows progress bar at ~43% with 3 stages complete", () => {
  const preview = buildOnboardingLifecyclePreview({
    progress: { completed: ["language", "technical_level", "node_role"] }
  });
  const out = stripAnsi(formatOnboardingLifecyclePreview(preview));
  assert.match(out, /\s+43%/);
  assert.match(out, /\(3\/7\)/);
});

test("Onboarding formatter shows 'Lifecycle complete.' at 100%", () => {
  const allDone = ["language", "technical_level", "node_role", "purpose", "resources", "consent_constitution", "first_mission"];
  const preview = buildOnboardingLifecyclePreview({ progress: { completed: allDone } });
  const out = stripAnsi(formatOnboardingLifecyclePreview(preview));
  assert.match(out, /Lifecycle complete/);
  assert.match(out, /100%/);
  assert.match(out, /\(7\/7\)/);
});

test("Onboarding formatter renders boundary footer", () => {
  const out = stripAnsi(formatOnboardingLifecyclePreview(buildOnboardingLifecyclePreview()));
  assert.match(out, /no network/);
  assert.match(out, /no federation/);
  assert.match(out, /no runtime/);
  assert.match(out, /no mint/);
});

test("formatNodeRegistryPreview renders connected_node_count prominently", () => {
  const preview = buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      { node_ordinal: 1, node_label: "Node1", status: "accepted_primary", candidate_name: "Samy" }
    ]
  });
  const out = stripAnsi(formatNodeRegistryPreview(preview));
  assert.match(out, /Connected nodes:\s+2/);
});

test("Registry formatter shows PAT/SAT scaling totals", () => {
  const preview = buildNodeRegistryPreview({
    active: [
      { node_ordinal: 0, node_label: "Node0", status: "accepted_primary" },
      { node_ordinal: 1, node_label: "Node1", status: "accepted_primary", candidate_name: "Samy" }
    ]
  });
  const out = stripAnsi(formatNodeRegistryPreview(preview));
  assert.match(out, /PAT agents.*14/);
  assert.match(out, /SAT agents.*10/);
});

test("Registry formatter shows ghost node + claim phrase", () => {
  const preview = buildNodeRegistryPreview({
    ghosts: [{ node_ordinal: 1, status: "ghost_preview", candidate_name: "Friend" }]
  });
  const out = stripAnsi(formatNodeRegistryPreview(preview));
  assert.match(out, /Ghost \(pending acceptance\)/);
  assert.match(out, /Friend/);
  assert.match(out, /"GO accept Node1 ordinal"/);
});

test("Registry formatter shows forbidden ordinals from canon", () => {
  const out = stripAnsi(formatNodeRegistryPreview(buildNodeRegistryPreview()));
  assert.match(out, /Forbidden ordinals: \[3, 4\]/);
});

test("Default width is 76 columns · no line exceeds 76 chars (after ANSI strip)", () => {
  const preview = buildOnboardingLifecyclePreview({ candidate_name: "Samy", candidate_ordinal: 1 });
  const out = formatOnboardingLifecyclePreview(preview);
  assert.equal(TUI_FORMATTER_DEFAULT_WIDTH, 76);
  assert.ok(maxLineWidth(out) <= 76, `max line width was ${maxLineWidth(out)}`);
});

// ─── ACCESSIBILITY TESTS (5) ────────────────────────────────────────────────

test("noColor: true suppresses all ANSI escape sequences", () => {
  const preview = buildOnboardingLifecyclePreview({ candidate_name: "Samy", candidate_ordinal: 1 });
  const out = formatOnboardingLifecyclePreview(preview, { noColor: true });
  // No ANSI escape sequences at all
  assert.equal(out.includes("\x1b["), false);
});

test("termDumb: true uses ASCII fallback for box-drawing", () => {
  const preview = buildOnboardingLifecyclePreview({ candidate_name: "Samy", candidate_ordinal: 1 });
  const out = formatOnboardingLifecyclePreview(preview, { termDumb: true });
  // Plain ASCII border characters
  assert.match(out, /\+-+\+/);
  assert.match(out, /\|/);
  // No Unicode box-drawing chars
  assert.equal(out.includes("┌"), false);
  assert.equal(out.includes("│"), false);
  assert.equal(out.includes("─"), false);
});

test("noColor + termDumb combined produces pure plain-text output", () => {
  const preview = buildOnboardingLifecyclePreview();
  const out = formatOnboardingLifecyclePreview(preview, { noColor: true, termDumb: true });
  // No ANSI, no Unicode box-drawing
  assert.equal(out.includes("\x1b["), false);
  assert.equal(out.includes("┌"), false);
});

test("resolveFormatterOptsFromEnv with NO_COLOR=1 yields noColor: true", () => {
  const opts = resolveFormatterOptsFromEnv({ NO_COLOR: "1" });
  assert.equal(opts.noColor, true);
});

test("resolveFormatterOptsFromEnv with TERM=dumb yields termDumb: true", () => {
  const opts = resolveFormatterOptsFromEnv({ TERM: "dumb" });
  assert.equal(opts.termDumb, true);
});

// ─── ADVERSARIAL TESTS (8) ──────────────────────────────────────────────────

test("ADVERSARIAL: formatter on null input returns error string (does not throw)", () => {
  const out = formatOnboardingLifecyclePreview(null);
  assert.match(stripAnsi(out), /formatter error/);
});

test("ADVERSARIAL: formatter on wrong-schema input returns error string", () => {
  const out = formatOnboardingLifecyclePreview({ schema: "wrong.schema.v0.1" });
  assert.match(stripAnsi(out), /Expected.*onboarding_lifecycle/);
});

test("ADVERSARIAL: registry formatter on null returns error string", () => {
  const out = formatNodeRegistryPreview(null);
  assert.match(stripAnsi(out), /formatter error/);
});

test("ADVERSARIAL: registry formatter on wrong-schema input returns error string", () => {
  const out = formatNodeRegistryPreview({ schema: "wrong.schema.v0.1" });
  assert.match(stripAnsi(out), /Expected.*node_registry_preview/);
});

test("ADVERSARIAL: very long candidate name does not break formatter (no throw)", () => {
  const longName = "A".repeat(200);
  const preview = buildOnboardingLifecyclePreview({ candidate_name: longName, candidate_ordinal: 1 });
  const out = formatOnboardingLifecyclePreview(preview);
  // Should not throw; lines may exceed 76 (truncation is downstream concern),
  // but the formatter must produce valid output.
  assert.ok(out.length > 0);
});

test("ADVERSARIAL: RTL candidate name preserved verbatim", () => {
  const preview = buildOnboardingLifecyclePreview({ candidate_name: "محمد بشر", candidate_ordinal: 1 });
  const out = stripAnsi(formatOnboardingLifecyclePreview(preview));
  assert.match(out, /محمد بشر/);
});

test("ADVERSARIAL: width=40 produces narrower output (lines respect width)", () => {
  const preview = buildOnboardingLifecyclePreview();
  const out = formatOnboardingLifecyclePreview(preview, { width: 40 });
  assert.ok(maxLineWidth(out) <= 40, `max line width was ${maxLineWidth(out)} (expected ≤ 40)`);
});

test("ADVERSARIAL: formatter output is deterministic given identical inputs", () => {
  const preview = buildOnboardingLifecyclePreview({ candidate_name: "Samy", candidate_ordinal: 1 });
  const a = formatOnboardingLifecyclePreview(preview);
  const b = formatOnboardingLifecyclePreview(preview);
  assert.equal(a, b);
});
