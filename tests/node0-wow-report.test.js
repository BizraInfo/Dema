// NODE0-WOW-REPORT-1A — pure "wow mirror" kernel tests.
// Turns the EXISTING (already-consented) local-asset inventory into an honest
// human story: what you have, what Dema can ACTUALLY do today, and — crucially
// — what she cannot do yet. The §0 discipline applied to a "wow": the wonder is
// the true shape of your assets; the help list must not promise capability that
// is DESIGNED-NOT-LIVE. Read-only, pure: no scan, no model, no file content.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildNode0WowReport,
  NODE0_WOW_REPORT_SCHEMA,
} from "../packages/core/src/node0-wow-report.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/node0-wow-report.js", import.meta.url),
);

const DOMAIN_BOUNDARY_KEYS = [
  "homebase_scan_performed",
  "file_content_read",
  "model_invoked",
  "embedding_generated",
  "network_used",
  "task_executed",
  "runtime_activated",
  "federation_used",
  "token_minted",
  "poi_score_calculated",
  "reward_emitted",
];

// A realistic inventory shape (subset of local-asset-awareness output).
const INVENTORY = Object.freeze({
  schema: "bizra.dema.local_asset_awareness_inventory.v0.1",
  categories: Object.freeze({
    code_project: 4,
    document: 9,
    receipt_or_proof: 2,
    model_artifact: 1,
    unknown: 3,
  }),
  summary: Object.freeze({
    records_count: 19,
    files_count: 15,
    dirs_count: 4,
    symlinks_count: 0,
  }),
});

function assertDeepFrozen(value, label = "value") {
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object") assertDeepFrozen(child, `${label}.${key}`);
  }
}

test("valid inventory → category story with human labels + counts, and totals", () => {
  const r = buildNode0WowReport({ inventory: INVENTORY });
  assert.equal(r.valid, true);
  assert.equal(r.totals.records, 19);
  assert.equal(r.totals.files, 15);
  const byCat = Object.fromEntries(r.category_story.map((c) => [c.category, c]));
  assert.equal(byCat.code_project.count, 4);
  assert.equal(byCat.code_project.label, "code files");
  assert.equal(byCat.receipt_or_proof.label, "proof & receipt files");
  // No label inflates a file-TYPE bucket into a composed entity (no zann):
  // classifyLocalAsset is extension-only, so a `.js` is a "code file" not a
  // "project", a `.csv` a "data file" not a "dataset".
  for (const c of r.category_story) {
    assert.doesNotMatch(c.label, /\bprojects?\b|\bdatasets?\b|\bartifacts?\b/i);
  }
});

test("category story is sorted by count, descending", () => {
  const r = buildNode0WowReport({ inventory: INVENTORY });
  const counts = r.category_story.map((c) => c.count);
  const sorted = [...counts].sort((a, b) => b - a);
  assert.deepEqual(counts, sorted);
});

test("can_help_today is HONEST — no overclaim of unbuilt capability", () => {
  const help = buildNode0WowReport({ inventory: INVENTORY }).can_help_today.join(
    " ",
  );
  // The wow must not promise reading file contents, model analysis, or building.
  assert.doesNotMatch(help, /read (your |the )?file content|analyze.*content/i);
  assert.doesNotMatch(help, /build (your|it|the)|run your (tasks|code|project)/i);
  assert.doesNotMatch(help, /semantic|embedding/i);
});

test("not_yet_available honestly names the DESIGNED-NOT-LIVE capabilities", () => {
  const notYet = buildNode0WowReport({ inventory: INVENTORY }).not_yet_available.join(
    " ",
  );
  assert.match(notYet, /content/i);
  assert.match(notYet, /model/i);
  assert.match(notYet, /task|build|run/i);
});

test("missing or wrong-schema inventory → fail closed with a 'run dema scan' hint", () => {
  for (const bad of [undefined, null, {}, { schema: "nope" }, "x"]) {
    const r = buildNode0WowReport({ inventory: bad });
    assert.equal(r.valid, false);
    assert.match(r.status, /REFUSED|NO_INVENTORY/i);
    assert.match(r.hint.join(" "), /dema scan/i);
  }
});

test("empty inventory (nothing found) → valid, empty story, not a crash", () => {
  const r = buildNode0WowReport({
    inventory: {
      schema: "bizra.dema.local_asset_awareness_inventory.v0.1",
      categories: {},
      summary: { records_count: 0, files_count: 0, dirs_count: 0, symlinks_count: 0 },
    },
  });
  assert.equal(r.valid, true);
  assert.deepEqual(r.category_story, []);
  assert.equal(r.totals.records, 0);
});

test("boundary is read-only — all effect flags false on every path", () => {
  for (const inv of [INVENTORY, null]) {
    const r = buildNode0WowReport({ inventory: inv });
    for (const key of DOMAIN_BOUNDARY_KEYS) {
      assert.equal(r.boundary[key], false, `boundary.${key} must be false`);
    }
  }
});

test("schema + truth_label exact; deep-frozen", () => {
  const r = buildNode0WowReport({ inventory: INVENTORY });
  assert.equal(r.schema, "bizra.dema.node0_wow_report.v0.1");
  assert.equal(r.schema, NODE0_WOW_REPORT_SCHEMA);
  assert.equal(r.truth_label, "NODE0_WOW_REPORT_LOCAL_ONLY");
  assert.equal(r.mode, "preview_only");
  assertDeepFrozen(r, "report");
});

test("what_this_does_not_prove blocks model/content/semantic claims", () => {
  const text = buildNode0WowReport({ inventory: INVENTORY })
    .what_this_does_not_prove.join(" ");
  assert.match(text, /content/i);
  assert.match(text, /model|semantic|embedding/i);
});

test("module imports no fs, fs/promises, net, child process, os, or http APIs", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/,
  );
});
