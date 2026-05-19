import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import {
  HELP_TOPICS,
  COMMAND_DETAIL,
  renderHelpRoot,
  renderHelpTopic,
  renderHelpCommand,
  renderHelpFlat,
  renderHelpUnknown,
} from "../packages/core/src/help-topics.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_SRC = readFileSync(
  join(__dirname, "..", "apps", "cli", "src", "index.js"),
  "utf8"
);

// Extract all top-level dispatch cases from the CLI source.
function extractDispatchCases(source) {
  const cases = [...source.matchAll(/case\s+"([a-zA-Z][\w:-]*)"\s*:/g)].map((m) => m[1]);
  return new Set(cases);
}

const dispatchCases = extractDispatchCases(CLI_SRC);

// Extract the HELP constant text from the CLI source.
function extractHelpConstant(source) {
  const m = source.match(/const HELP\s*=\s*`([\s\S]*?)`/);
  if (!m) throw new Error("HELP constant not found in index.js");
  return m[1];
}

const HELP_TEXT = extractHelpConstant(CLI_SRC);
const TOPIC_SLUGS = Object.keys(HELP_TOPICS);

// ── renderHelpRoot ────────────────────────────────────────────────────────────

test("renderHelpRoot returns non-empty string containing all 6 topic slugs", () => {
  const out = renderHelpRoot();
  assert.ok(typeof out === "string" && out.length > 0);
  for (const slug of TOPIC_SLUGS) {
    assert.ok(out.includes(slug), `renderHelpRoot missing topic: ${slug}`);
  }
});

test("renderHelpRoot includes the help navigation hints", () => {
  const out = renderHelpRoot();
  assert.match(out, /Available topics:/);
  assert.match(out, /dema help <topic>/);
  assert.match(out, /dema help --all/);
});

// ── renderHelpTopic ───────────────────────────────────────────────────────────

test("renderHelpTopic('readiness') returns string containing 'status' and 'doctor'", () => {
  const out = renderHelpTopic("readiness");
  assert.ok(typeof out === "string");
  assert.match(out, /status/);
  assert.match(out, /doctor/);
});

test("renderHelpTopic returns string for every declared topic", () => {
  for (const slug of TOPIC_SLUGS) {
    const out = renderHelpTopic(slug);
    assert.ok(typeof out === "string" && out.length > 0, `renderHelpTopic(${slug}) returned null`);
  }
});

test("renderHelpTopic('unknown') returns null", () => {
  assert.equal(renderHelpTopic("unknown"), null);
});

test("renderHelpTopic with empty string returns null", () => {
  assert.equal(renderHelpTopic(""), null);
});

test("renderHelpTopic with null returns null", () => {
  assert.equal(renderHelpTopic(null), null);
});

test("renderHelpTopic with undefined returns null", () => {
  assert.equal(renderHelpTopic(undefined), null);
});

// ── renderHelpCommand ─────────────────────────────────────────────────────────

test("renderHelpCommand('status') returns string with syntax and boundary", () => {
  const out = renderHelpCommand("status");
  assert.ok(typeof out === "string");
  assert.match(out, /dema status/);
  assert.match(out, /Boundary:/);
});

test("renderHelpCommand('unknown') returns null", () => {
  assert.equal(renderHelpCommand("unknown"), null);
});

test("renderHelpCommand with null returns null", () => {
  assert.equal(renderHelpCommand(null), null);
});

test("renderHelpCommand with undefined returns null", () => {
  assert.equal(renderHelpCommand(undefined), null);
});

// ── renderHelpFlat ────────────────────────────────────────────────────────────

test("renderHelpFlat(HELP) returns the HELP string byte-for-byte", () => {
  const out = renderHelpFlat(HELP_TEXT);
  assert.equal(out, HELP_TEXT);
});

// ── Topic referential integrity ───────────────────────────────────────────────

test("every top-level command in HELP_TOPICS has a dispatch case in the CLI", () => {
  // The command field may be multi-word (e.g. "mission draft"). Only the first
  // token is the dispatch case. Some multi-word entries dispatch under a
  // combined token (e.g. "status:json") which is fine. We validate the first token.
  const missing = [];
  for (const [slug, topic] of Object.entries(HELP_TOPICS)) {
    for (const entry of topic.commands) {
      const topLevel = entry.command.split(" ")[0];
      // Colon-form variants like "status:json" are their own dispatch cases.
      // Multi-word subcommands like "mission draft" dispatch under "mission".
      // "memory show" dispatches under "memory". "models scan" under "models".
      // All of these must appear either as-is or their first token in dispatch.
      const hasCase =
        dispatchCases.has(topLevel) ||
        dispatchCases.has(entry.command.replace(/\s+/g, "_"));
      if (!hasCase) {
        missing.push(`[${slug}] ${entry.command} (top-level: ${topLevel})`);
      }
    }
  }
  assert.deepEqual(missing, [], `HELP_TOPICS entries with no dispatch case: ${missing.join("; ")}`);
});

test("topic see_also references only valid topic slugs", () => {
  const slugSet = new Set(TOPIC_SLUGS);
  const bad = [];
  for (const [slug, topic] of Object.entries(HELP_TOPICS)) {
    for (const ref of topic.see_also) {
      if (!slugSet.has(ref)) {
        bad.push(`[${slug}] see_also references unknown slug: ${ref}`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join("; "));
});

// ── COMMAND_DETAIL referential integrity ──────────────────────────────────────

test("every related reference in COMMAND_DETAIL has a dispatch case in the CLI", () => {
  const missing = [];
  for (const [cmd, detail] of Object.entries(COMMAND_DETAIL)) {
    for (const rel of detail.related) {
      const topLevel = rel.split(":")[0].split(" ")[0];
      if (!dispatchCases.has(topLevel) && !dispatchCases.has(rel)) {
        missing.push(`[${cmd}] related '${rel}' not in dispatch`);
      }
    }
  }
  assert.deepEqual(missing, [], `COMMAND_DETAIL.related entries missing from dispatch: ${missing.join("; ")}`);
});

// ── Deep-frozen adversarial ───────────────────────────────────────────────────

test("HELP_TOPICS is deep-frozen — top-level mutation rejected in strict mode", () => {
  assert.throws(() => {
    "use strict";
    HELP_TOPICS.orientation = {};
  }, TypeError);
});

test("HELP_TOPICS topic object is frozen — inner mutation rejected in strict mode", () => {
  assert.throws(() => {
    "use strict";
    HELP_TOPICS.readiness.title = "mutated";
  }, TypeError);
});

test("COMMAND_DETAIL is frozen — mutation rejected in strict mode", () => {
  assert.throws(() => {
    "use strict";
    COMMAND_DETAIL.status = {};
  }, TypeError);
});
