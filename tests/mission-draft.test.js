import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildMissionDraftPreview,
  formatMissionDraftPreview,
} from "../packages/mission/src/mission-draft.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);

test("buildMissionDraftPreview creates deterministic Intent -> MissionDraft -> ConsentPlan envelope", () => {
  const intent = "Fix auth.py and run pytest";
  const first = buildMissionDraftPreview({ intent });
  const second = buildMissionDraftPreview({ intent });

  assert.equal(first.schema, "bizra.dema.mission_draft_preview.v0.1");
  assert.equal(first.mode, "PREVIEW_ONLY");
  assert.equal(first.mission.id, second.mission.id);
  assert.equal(first.mission.current_phase, "DRAFT_INTENT");
  assert.equal(first.mission.category, "software_change");
  assert.equal(first.mission.risk_level, "high");
  assert.deepEqual(first.mission.data_domains, ["auth"]);
  assert.equal(
    first.consent_plan.schema,
    "bizra.dema.consent_plan_preview.v0.1",
  );
  assert.ok(
    first.consent_plan.permissions.some(
      (p) => p.resource_id === "file:auth.py",
    ),
  );
  assert.equal(first.phase_gate.next_phase, "CONSENT_NEGOTIATION");
  assert.equal(first.phase_gate.effect_caps_minted, false);
  assert.equal(first.boundary.execution_enabled, false);
  assert.equal(first.boundary.network_connection_attempted, false);
  assert.equal(first.boundary.external_posting_performed, false);
});

test("buildMissionDraftPreview preserves audit/external-call warning through consent plan", () => {
  const draft = buildMissionDraftPreview({
    intent: "Audit Downloads and send to Slack",
  });

  assert.equal(draft.mission.category, "audit");
  assert.deepEqual(draft.mission.data_domains, ["Downloads", "slack"]);
  assert.ok(
    draft.consent_plan.analogical_notes.some(
      (note) => note.code === "audit_with_external_call",
    ),
  );
});

test("formatMissionDraftPreview renders mission, consent, and boundary", () => {
  const output = formatMissionDraftPreview(
    buildMissionDraftPreview({
      intent: "Fix auth.py and run pytest",
    }),
  );

  assert.match(output, /DEMA Mission Draft Preview/);
  assert.match(output, /current_phase: DRAFT_INTENT/);
  assert.match(output, /next_phase: CONSENT_NEGOTIATION/);
  assert.match(output, /file:auth\.py\s+read/);
  assert.match(
    output,
    /Boundary: preview-only; no approval; no capability minted; no execution/,
  );
  assert.match(output, /no network; no external posting/);
});

test("dema mission draft prints a human-readable preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "mission",
    "draft",
    "Fix auth.py and run pytest",
  ]);

  assert.match(stdout, /DEMA Mission Draft Preview/);
  assert.match(stdout, /DRAFT_INTENT/);
  assert.match(stdout, /CONSENT_NEGOTIATION/);
  assert.match(stdout, /command:pytest/);
  assert.match(
    stdout,
    /Boundary: preview-only; no approval; no capability minted; no execution/,
  );
  assert.match(stdout, /no network; no external posting/);
});

test("dema mission draft --json emits schema-tagged preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "mission",
    "draft",
    "--json",
    "Audit Downloads and send to Slack",
  ]);
  const draft = JSON.parse(stdout);

  assert.equal(draft.schema, "bizra.dema.mission_draft_preview.v0.1");
  assert.equal(draft.mission.current_phase, "DRAFT_INTENT");
  assert.equal(draft.consent_plan.boundary.execution_enabled, false);
  assert.ok(draft.mission.data_domains.includes("Downloads"));
});

test("dema mission draft rejects missing intent", async () => {
  await assert.rejects(
    execFileAsync("node", [cliPath, "mission", "draft"]),
    /Usage: dema mission draft/,
  );
});
