import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildAnalogicalNotes,
  extractIntentShape
} from "../packages/consent/src/consent-extract.js";
import {
  buildConsentPlanPreview,
  formatConsentPlanPreview
} from "../packages/consent/src/consent-planner.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

test("intent extraction excludes unsafe home-relative file references from permissions", () => {
  const shape = extractIntentShape(
    "Fix ../secrets/auth.py and /tmp/root.js and ~/private/key.py then run pytest"
  );

  assert.deepEqual(shape.unsafe_file_references, [
    "../secrets/auth.py",
    "/tmp/root.js",
    "~/private/key.py"
  ]);

  assert.ok(shape.permissions.every((permission) => (
    permission.resource_id !== "file:../secrets/auth.py" &&
    permission.resource_id !== "file:/tmp/root.js" &&
    permission.resource_id !== "file:~/private/key.py"
  )));

  assert.ok(shape.permissions.some((p) => p.resource_id === "command:pytest"));
  assert.equal(shape.risk_level, "high");
});

test("unsafe file references produce a high-severity consent note", () => {
  const shape = extractIntentShape("Review ~/private/key.py");
  const notes = buildAnalogicalNotes(
    "Review ~/private/key.py",
    shape.permissions,
    shape.unsafe_file_references
  );

  assert.ok(notes.some((note) => (
    note.code === "unsafe_file_reference" &&
    note.severity === "high"
  )));
});

test("buildConsentPlanPreview maps intent to a deterministic preview boundary", () => {
  const now = new Date("2026-05-15T00:00:00.000Z");
  const first = buildConsentPlanPreview({ intent: "Fix auth.py and run pytest", now });
  const second = buildConsentPlanPreview({ intent: "Fix auth.py and run pytest", now });

  assert.equal(first.schema, "bizra.dema.consent_plan_preview.v0.1");
  assert.equal(first.mode, "PREVIEW_ONLY");
  assert.equal(first.boundary.execution_enabled, false);
  assert.equal(first.boundary.capability_minted, false);
  assert.equal(first.micro_consent.status, "draft_only");
  assert.equal(first.commitment_hash, second.commitment_hash);
  assert.deepEqual(
    first.permissions.map((p) => `${p.resource_id}:${p.action}`),
    ["file:auth.py:read", "file:auth.py:write", "command:pytest:execute"]
  );
});

test("formatConsentPlanPreview renders permissions and preview boundary", () => {
  const output = formatConsentPlanPreview(buildConsentPlanPreview({
    intent: "Fix auth.py and run pytest",
    now: new Date("2026-05-15T00:00:00.000Z")
  }));

  assert.match(output, /DEMA Consent Plan Preview/);
  assert.match(output, /file:auth\.py\s+read/);
  assert.match(output, /command:pytest\s+execute/);
  assert.match(output, /Boundary: preview-only; no approval; no capability minted; no execution\./);
});

test("dema consent plan prints a preview without execution", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "consent",
    "plan",
    "Fix auth.py and run pytest"
  ]);

  assert.match(stdout, /DEMA Consent Plan Preview/);
  assert.match(stdout, /file:auth\.py/);
  assert.match(stdout, /command:pytest/);
  assert.match(stdout, /Boundary: preview-only; no approval; no capability minted; no execution\./);
});

test("dema consent plan --json emits the schema-tagged preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "consent",
    "plan",
    "--json",
    "Audit Downloads and send to Slack"
  ]);
  const plan = JSON.parse(stdout);

  assert.equal(plan.schema, "bizra.dema.consent_plan_preview.v0.1");
  assert.equal(plan.mode, "PREVIEW_ONLY");
  assert.equal(plan.boundary.execution_enabled, false);
  assert.ok(plan.permissions.some((p) => p.resource_id === "service:slack"));
});
