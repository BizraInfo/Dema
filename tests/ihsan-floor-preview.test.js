import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  DEFAULT_IHSAN_FLOOR,
  evaluateIhsanFloorPreview,
  formatIhsanFloorPreview,
} from "../packages/verifier/src/ihsan-floor-preview.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const modulePath = fileURLToPath(
  new URL("../packages/verifier/src/ihsan-floor-preview.js", import.meta.url),
);
const fixedNow = new Date("2026-05-15T00:00:00.000Z");

test("Ihsan floor preview accepts an externally supplied scalar at the floor", () => {
  const preview = evaluateIhsanFloorPreview({ score: 0.95, now: fixedNow });

  assert.equal(preview.schema, "bizra.dema.ihsan_floor_preview.v0.1");
  assert.equal(preview.truth_label, "DECLARED");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.certifies, false);
  assert.equal(preview.floor, DEFAULT_IHSAN_FLOOR);
  assert.equal(preview.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(preview.boundary.canonical_ihsan_computed_here, false);
  assert.equal(preview.boundary.receipt_minted, false);
  assert.equal(preview.boundary.identity_bound, false);
  assert.equal(preview.boundary.network_connection_attempted, false);
  assert.equal(preview.boundary.external_posting_performed, false);
});

test("Ihsan floor preview rejects scores below the upstream floor", () => {
  const preview = evaluateIhsanFloorPreview({ score: 0.9499, now: fixedNow });

  assert.equal(preview.verdict, "PREVIEW_REJECT");
  assert.ok(
    preview.checks.find((check) => check.check === "floor_met" && !check.pass),
  );
});

test("Ihsan floor preview fails closed on invalid score shape", () => {
  const preview = evaluateIhsanFloorPreview({ score: "0.99", now: fixedNow });

  assert.equal(preview.score, null);
  assert.equal(preview.verdict, "PREVIEW_REJECT");
  assert.ok(
    preview.checks.find(
      (check) => check.check === "score_is_unit_number" && !check.pass,
    ),
  );
});

test("Ihsan floor preview does not emit binding runtime verdict language", () => {
  const accepted = evaluateIhsanFloorPreview({ score: 1, now: fixedNow });
  const rejected = evaluateIhsanFloorPreview({ score: 0, now: fixedNow });

  assert.deepEqual(
    [accepted.verdict, rejected.verdict],
    ["PARTIAL_PLACEHOLDER", "PREVIEW_REJECT"],
  );
  assert.ok(
    ![accepted.verdict, rejected.verdict].some((verdict) =>
      /PERMIT|approve/i.test(verdict),
    ),
  );
});

test("Ihsan floor preview is deterministic for fixed inputs and JSON-safe", () => {
  const first = evaluateIhsanFloorPreview({ score: 0.97, now: fixedNow });
  const second = evaluateIhsanFloorPreview({ score: 0.97, now: fixedNow });

  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});

test("formatIhsanFloorPreview renders checks and non-certifying boundary", () => {
  const output = formatIhsanFloorPreview(
    evaluateIhsanFloorPreview({ score: 0.97, now: fixedNow }),
  );

  assert.match(output, /DEMA Ihsan Floor Preview/);
  assert.match(output, /Verdict: PARTIAL_PLACEHOLDER/);
  assert.match(output, /canonical scorer not computed here/);
  assert.match(output, /no receipt mint/);
});

test("Ihsan floor preview source has no runtime, network, or filesystem effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /from "node:(net|http|https|tls|dgram|child_process|fs)"/,
  );
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(
    source,
    /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/,
  );
});

test("dema ihsan floor preview prints a human-readable placeholder", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "ihsan",
    "floor",
    "preview",
    "--score",
    "0.97",
  ]);

  assert.match(stdout, /DEMA Ihsan Floor Preview/);
  assert.match(stdout, /PARTIAL_PLACEHOLDER/);
  assert.match(stdout, /no receipt mint/);
});

test("dema ihsan floor preview --json emits the schema-tagged preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "ihsan",
    "floor",
    "preview",
    "--score",
    "0.949",
    "--json",
  ]);
  const preview = JSON.parse(stdout);

  assert.equal(preview.schema, "bizra.dema.ihsan_floor_preview.v0.1");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.certifies, false);
  assert.equal(preview.verdict, "PREVIEW_REJECT");
  assert.equal(preview.boundary.runtime_gate_executed, false);
  assert.equal(preview.boundary.network_connection_attempted, false);
});

test("dema ihsan rejects unknown subcommands", async () => {
  await assert.rejects(
    execFileAsync("node", [cliPath, "ihsan", "floor", "certify"]),
    /Unknown ihsan command/,
  );
});
