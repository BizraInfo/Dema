import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  BEHAVIORAL_MODULATION_CONSENT_PHRASE,
  buildBehavioralModulationPreview,
  formatBehavioralModulationPreview,
} from "../packages/core/src/behavioral-modulation.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../apps/cli/src/index.js", import.meta.url),
);
const modulePath = fileURLToPath(
  new URL("../packages/core/src/behavioral-modulation.js", import.meta.url),
);
const fixedNow = new Date("2026-05-15T00:00:00.000Z");

test("behavioral modulation preview accepts explicit consent-bound visible guidance", () => {
  const preview = buildBehavioralModulationPreview({
    intent:
      "Adjust tone to prioritize safety reminders before mission suggestions",
    consentPhrase: BEHAVIORAL_MODULATION_CONSENT_PHRASE,
    ihsanScore: 0.97,
    now: fixedNow,
  });

  assert.equal(preview.schema, "bizra.dema.behavioral_modulation_preview.v0.1");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(preview.certifies, false);
  assert.equal(preview.proposed_modulation.surface, "tone");
  assert.equal(preview.proposed_modulation.user_visible, true);
  assert.equal(preview.proposed_modulation.reversible, true);
  assert.equal(preview.proposed_modulation.hidden_personalization, false);
  assert.equal(preview.boundary.behavior_changed, false);
  assert.equal(preview.boundary.receipt_minted, false);
  assert.equal(preview.boundary.identity_bound, false);
  assert.equal(preview.boundary.network_connection_attempted, false);
  assert.equal(preview.boundary.external_posting_performed, false);
  assert.equal(preview.evidence_receipt_preview.boundary.receipt_minted, false);
  assert.equal(
    preview.evidence_receipt_preview_verdict.verdict,
    "PARTIAL_PLACEHOLDER",
  );
});

test("behavioral modulation preview rejects missing exact consent", () => {
  const preview = buildBehavioralModulationPreview({
    intent: "Adjust recommendation style to show safer options first",
    consentPhrase: "GO: anything else",
    ihsanScore: 0.97,
    now: fixedNow,
  });

  assert.equal(preview.verdict, "PREVIEW_REJECT");
  assert.ok(
    preview.constitutional_gate.checks.find(
      (item) =>
        item.check === "exact_preview_consent_phrase" && item.pass === false,
    ),
  );
  assert.equal(
    preview.evidence_receipt_preview.decision.verdict,
    "PREVIEW_REJECT",
  );
});

test("behavioral modulation preview rejects covert or manipulative shaping", () => {
  const preview = buildBehavioralModulationPreview({
    intent: "Use covert persuasion to manipulate the user into buying a token",
    consentPhrase: BEHAVIORAL_MODULATION_CONSENT_PHRASE,
    ihsanScore: 0.99,
    now: fixedNow,
  });

  assert.equal(preview.verdict, "PREVIEW_REJECT");
  const forbidden = preview.constitutional_gate.checks.find(
    (item) => item.check === "forbidden_behavior_shaping_absent",
  );
  assert.equal(forbidden.pass, false);
  assert.match(forbidden.detail, /covert_persuasion|manipulation/);
  assert.equal(preview.boundary.hidden_modulation_allowed, false);
});

test("behavioral modulation preview rejects below-floor Ihsan preview", () => {
  const preview = buildBehavioralModulationPreview({
    intent:
      "Rank safer local-first recommendations before external tool options",
    consentPhrase: BEHAVIORAL_MODULATION_CONSENT_PHRASE,
    ihsanScore: 0.5,
    now: fixedNow,
  });

  assert.equal(preview.verdict, "PREVIEW_REJECT");
  assert.ok(
    preview.constitutional_gate.checks.find(
      (item) =>
        item.check === "ihsan_floor_preview_not_rejected" &&
        item.pass === false,
    ),
  );
});

test("formatBehavioralModulationPreview renders checks and no-effect boundary", () => {
  const output = formatBehavioralModulationPreview(
    buildBehavioralModulationPreview({
      intent: "Show consent reminders before execution suggestions",
      consentPhrase: BEHAVIORAL_MODULATION_CONSENT_PHRASE,
      ihsanScore: 0.97,
      now: fixedNow,
    }),
  );

  assert.match(output, /DEMA Behavioral Modulation Preview/);
  assert.match(output, /Constitutional checks/);
  assert.match(output, /Receipt preview digest: [0-9a-f]{64}/);
  assert.match(
    output,
    /Boundary: preview-only; no approval recorded; no behavior changed; no receipt minted/,
  );
  assert.match(output, /no network; no external posting/);
});

test("behavioral modulation preview is deterministic for fixed inputs and JSON-safe", () => {
  const first = buildBehavioralModulationPreview({
    intent:
      "Adjust tone to prioritize safety reminders before mission suggestions",
    consentPhrase: BEHAVIORAL_MODULATION_CONSENT_PHRASE,
    ihsanScore: 0.97,
    now: fixedNow,
  });
  const second = buildBehavioralModulationPreview({
    intent:
      "Adjust tone to prioritize safety reminders before mission suggestions",
    consentPhrase: BEHAVIORAL_MODULATION_CONSENT_PHRASE,
    ihsanScore: 0.97,
    now: fixedNow,
  });

  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});

test("behavioral modulation source has no runtime, network, or filesystem effects", async () => {
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

test("dema behavior modulation preview prints a human-readable no-effect preview", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "behavior",
    "modulation",
    "preview",
    "--consent",
    BEHAVIORAL_MODULATION_CONSENT_PHRASE,
    "--score",
    "0.97",
    "Adjust tone to prioritize safety reminders before mission suggestions",
  ]);

  assert.match(stdout, /DEMA Behavioral Modulation Preview/);
  assert.match(stdout, /PARTIAL_PLACEHOLDER/);
  assert.match(stdout, /no behavior changed/);
});

test("dema behavior modulation preview --json rejects covert shaping", async () => {
  const { stdout } = await execFileAsync("node", [
    cliPath,
    "behavior",
    "modulation",
    "preview",
    "--consent",
    BEHAVIORAL_MODULATION_CONSENT_PHRASE,
    "--score",
    "0.99",
    "--json",
    "Use covert persuasion to manipulate buying a token",
  ]);
  const preview = JSON.parse(stdout);

  assert.equal(preview.schema, "bizra.dema.behavioral_modulation_preview.v0.1");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PREVIEW_REJECT");
  assert.equal(preview.boundary.behavior_changed, false);
  assert.equal(preview.boundary.external_posting_performed, false);
});

test("dema behavior rejects unknown subcommands", async () => {
  await assert.rejects(
    execFileAsync("node", [cliPath, "behavior", "modulation", "apply"]),
    /Unknown behavior command/,
  );
});
