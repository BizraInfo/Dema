import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildSovereignJourneyPreview,
  formatSovereignJourneyPreview
} from "../packages/mission/src/journey.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const fixedNow = new Date("2026-05-14T09:00:00.000Z");

test("buildSovereignJourneyPreview links setup, mission, handoff, and receipt chapters without effects", () => {
  const journey = buildSovereignJourneyPreview({
    intent: "Fix auth.py and run pytest",
    now: fixedNow
  });

  assert.equal(journey.schema, "bizra.dema.sovereign_journey_preview.v0.1");
  assert.equal(journey.generated_at, fixedNow.toISOString());
  assert.equal(journey.mode, "PREVIEW_ONLY");
  assert.deepEqual(journey.chapters.map((chapter) => chapter.id), [
    "first_launch",
    "mission_consent",
    "node0_handoff",
    "receipts_impact"
  ]);
  assert.equal(journey.mission_draft.schema, "bizra.dema.mission_draft_preview.v0.1");
  assert.equal(journey.boundary.execution_enabled, false);
  assert.equal(journey.boundary.node0_handoff_performed, false);
  assert.equal(journey.boundary.receipt_minted, false);
});

test("formatSovereignJourneyPreview renders a TUI-style journey with boundaries", () => {
  const output = formatSovereignJourneyPreview(buildSovereignJourneyPreview({
    intent: "Fix auth.py and run pytest",
    now: fixedNow
  }));

  assert.match(output, /DEMA Sovereign Journey OS/);
  assert.match(output, /One minimal entry point/);
  assert.match(output, /Chapter 0: First launch/);
  assert.match(output, /Chapter 1: Mission and consent/);
  assert.match(output, /file:auth\.py/);
  assert.match(output, /command:pytest/);
  assert.match(output, /Boundary: preview-only; no approval; no handoff; no execution; no receipt minted/);
});

test("dema journey prints the user-facing journey preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "journey",
    "Fix auth.py and run pytest"
  ]);

  assert.match(stdout, /DEMA Sovereign Journey OS/);
  assert.match(stdout, /Chapter 2: Node0 handoff/);
  assert.match(stdout, /Chapter 3: Receipts and impact/);
  assert.match(stdout, /Boundary: preview-only; no approval; no handoff; no execution; no receipt minted/);
});

test("dema journey --json emits a schema-tagged non-executing journey", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "journey",
    "--json",
    "Audit Downloads and send to Slack"
  ]);
  const journey = JSON.parse(stdout);

  assert.equal(journey.schema, "bizra.dema.sovereign_journey_preview.v0.1");
  assert.equal(journey.mode, "PREVIEW_ONLY");
  assert.equal(journey.boundary.execution_enabled, false);
  assert.ok(journey.mission_draft.consent_plan.analogical_notes.some((note) => (
    note.code === "audit_with_external_call"
  )));
});
