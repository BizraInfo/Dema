import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runDownloadsAuditPreview } from "../packages/tasks/src/downloads-audit-preview.js";
import {
  verifyGatewayHandoffReceipt,
  verifyReceipt,
  verifyReceiptPlaceholder
} from "../packages/verifier/src/sat-placeholder.js";

async function makeFixtureDownloads() {
  const downloadsRoot = await mkdtemp(join(tmpdir(), "dema-fixture-downloads-"));
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-fixture-home-"));
  await writeFile(join(downloadsRoot, "alpha.txt"), "hello\n");
  return { downloadsRoot, demaRoot };
}

function makeGatewayHandoffReceipt(overrides = {}) {
  return {
    schema: "bizra.dema.gateway_receipt_handoff.v0.1",
    receipt_id: "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
    artifact_id: "ARTIFACT-011",
    action: "bounded_diagnostic_activation",
    truth_label: "GATEWAY_ISSUED_HANDOFF",
    created_at: "2026-05-06T12:00:00.000Z",
    handoff_note: "Gateway sealed first mission; Dema-local mirror for listReceipts/readReceipt.",
    gateway: {
      base_url: "http://127.0.0.1:7421",
      mission_id: "04273dc2427284446a5aa7ec6727d33c085bbe6396659602dad9ba05ffb9fe86",
      receipt_id: "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
      chain_head: "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483",
      chain_length: 8,
      admissibility_verdict: "Permit",
      final_stage: "Replayability"
    },
    proof_anchors: {
      evidence_hash_niyyah_sha256: "659d822ba4cbaa61dac2d61008da0ed06f5c824a6208dc02f9b2b7fb2d5f8b27",
      preview_json_sha256: "d7cc50207ea88004eafbc54e01225de46fcf8d4701114b78b3c36bbcfaaf9f0d",
      ideal_state_hash_sha256: "24938181d3b2d4e85ca9abb924557857552e6493a6343b87a1e989abc10a6efe"
    },
    preserved_post_response_body: {
      missionId: "04273dc2427284446a5aa7ec6727d33c085bbe6396659602dad9ba05ffb9fe86",
      admissibility: {
        verdict: "Permit",
        gateVerdicts: [
          { scorerId: "ZANN_ZERO", invariant: "ZANN_ZERO", verdict: "Permit", reason: "Claim carries evidence binding", score: 1 },
          { scorerId: "CLAIM_MUST_BIND", invariant: "CLAIM_MUST_BIND", verdict: "Permit", reason: "Claim bound to evidence artifact", score: 1 },
          { scorerId: "RIBA_ZERO", invariant: "RIBA_ZERO", verdict: "Permit", reason: "No economic pattern present", score: 1 },
          { scorerId: "NO_SHADOW_STATE", invariant: "NO_SHADOW_STATE", verdict: "Permit", reason: "State mutation derives from canonical runtime", score: 1 },
          { scorerId: "IHSAN_FLOOR", invariant: "IHSAN_FLOOR", verdict: "Permit", reason: "Ihsan score 0.9800 ≥ floor 0.9500", score: 0.98 }
        ]
      },
      receiptId: "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
      finalStage: "Replayability",
      chainHead: "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483"
    },
    consent_phrase_record: "GO: Node0 bounded diagnostic activation only",
    ...overrides
  };
}

test("verifyReceipt routes task-receipt schema to verifyReceiptPlaceholder", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const taskReceipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const a = verifyReceipt(taskReceipt);
  const b = verifyReceiptPlaceholder(taskReceipt);
  assert.equal(a.verdict, b.verdict);
  assert.equal(a.verdict, "PARTIAL_PLACEHOLDER");
  assert.deepEqual(
    a.checks.map((c) => ({ check: c.check, pass: c.pass })),
    b.checks.map((c) => ({ check: c.check, pass: c.pass }))
  );
});

test("verifyReceipt routes gateway-handoff schema to verifyGatewayHandoffReceipt", () => {
  const receipt = makeGatewayHandoffReceipt();
  const a = verifyReceipt(receipt);
  const b = verifyGatewayHandoffReceipt(receipt);
  assert.equal(a.verdict, b.verdict);
  assert.equal(a.verdict, "PARTIAL_PLACEHOLDER");
});

test("verifyReceipt REJECTs unsupported schema (fail-closed)", () => {
  const verdict = verifyReceipt({
    schema: "bizra.dema.unknown.v0.1",
    receipt_id: "x"
  });
  assert.equal(verdict.verdict, "REJECT");
  assert.equal(verdict.truth_label, "DECLARED");
  assert.match(verdict.checks[0].detail, /unsupported_schema/);
});

test("verifyReceipt REJECTs missing schema (fail-closed)", () => {
  const verdict = verifyReceipt({ receipt_id: "x" });
  assert.equal(verdict.verdict, "REJECT");
  assert.match(verdict.note, /Refused by default/);
});

test("verifyGatewayHandoffReceipt PARTIAL_PLACEHOLDER on a valid handoff receipt", () => {
  const verdict = verifyGatewayHandoffReceipt(makeGatewayHandoffReceipt());
  assert.equal(verdict.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(verdict.truth_label, "DECLARED");
  assert.ok(verdict.checks.every((c) => c.pass), `all checks should pass; got ${JSON.stringify(verdict.checks)}`);
});

test("verifyGatewayHandoffReceipt REJECTs when gateway.admissibility_verdict is not Permit", () => {
  const verdict = verifyGatewayHandoffReceipt(
    makeGatewayHandoffReceipt({
      gateway: {
        ...makeGatewayHandoffReceipt().gateway,
        admissibility_verdict: "Reject"
      }
    })
  );
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "gateway_admissibility_permit" && !c.pass));
});

test("verifyGatewayHandoffReceipt REJECTs when chain_head is missing or malformed", () => {
  const verdict = verifyGatewayHandoffReceipt(
    makeGatewayHandoffReceipt({
      gateway: {
        ...makeGatewayHandoffReceipt().gateway,
        chain_head: "not-a-hash"
      }
    })
  );
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "chain_head_present_64hex" && !c.pass));
});

test("verifyGatewayHandoffReceipt REJECTs when consent_phrase_record is missing", () => {
  const r = makeGatewayHandoffReceipt();
  delete r.consent_phrase_record;
  const verdict = verifyGatewayHandoffReceipt(r);
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "consent_phrase_recorded_and_canonical" && !c.pass));
});

test("verifyGatewayHandoffReceipt REJECTs wrong consent phrase for a known action", () => {
  const verdict = verifyGatewayHandoffReceipt(
    makeGatewayHandoffReceipt({
      action: "bounded_diagnostic_activation",
      consent_phrase_record: "GO: anything else"
    })
  );
  assert.equal(verdict.verdict, "REJECT");
  const consentCheck = verdict.checks.find((c) => c.check === "consent_phrase_recorded_and_canonical");
  assert.ok(consentCheck);
  assert.equal(consentCheck.pass, false);
  assert.match(consentCheck.detail, /does NOT match canonical phrase/);
});

test("verifyGatewayHandoffReceipt PASSes consent check when action has no canonical phrase registered", () => {
  const verdict = verifyGatewayHandoffReceipt(
    makeGatewayHandoffReceipt({
      action: "future_action_not_yet_defined",
      consent_phrase_record: "GO: future phrase tbd"
    })
  );
  const consentCheck = verdict.checks.find((c) => c.check === "consent_phrase_recorded_and_canonical");
  assert.equal(consentCheck.pass, true);
  assert.match(consentCheck.detail, /no canonical phrase registered yet/);
});

test("verifyGatewayHandoffReceipt PASSes when gateVerdicts is entirely missing", () => {
  const r = makeGatewayHandoffReceipt();
  delete r.preserved_post_response_body;
  const verdict = verifyGatewayHandoffReceipt(r);
  assert.equal(verdict.verdict, "PARTIAL_PLACEHOLDER");
  const gatesCheck = verdict.checks.find((c) => c.check === "gate_verdicts_exposed");
  assert.ok(gatesCheck);
  assert.equal(gatesCheck.pass, true);
  assert.match(gatesCheck.detail, /informational/);
});

test("verifyGatewayHandoffReceipt REJECTs when IHSAN_FLOOR score is below 0.95", () => {
  const r = makeGatewayHandoffReceipt();
  r.preserved_post_response_body.admissibility.gateVerdicts = r.preserved_post_response_body.admissibility.gateVerdicts.map(
    (v) => (v.scorerId === "IHSAN_FLOOR" ? { ...v, score: 0.94 } : v)
  );
  const verdict = verifyGatewayHandoffReceipt(r);
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "gate_verdicts_all_permit_with_required_scorers" && !c.pass));
});

test("verifyGatewayHandoffReceipt REJECTs when a required scorer is missing", () => {
  const r = makeGatewayHandoffReceipt();
  r.preserved_post_response_body.admissibility.gateVerdicts =
    r.preserved_post_response_body.admissibility.gateVerdicts.filter(
      (v) => v.scorerId !== "ZANN_ZERO"
    );
  const verdict = verifyGatewayHandoffReceipt(r);
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "gate_verdicts_all_permit_with_required_scorers" && !c.pass));
});

test("verifyGatewayHandoffReceipt never returns PERMIT", () => {
  const verdict = verifyGatewayHandoffReceipt(makeGatewayHandoffReceipt());
  assert.notEqual(verdict.verdict, "PERMIT");
  assert.equal(verdict.verdict, "PARTIAL_PLACEHOLDER");
});

test("regression: apps/cli/src/index.js routes verification through verifyReceipt dispatcher", async () => {
  const cliSrcPath = new URL("../apps/cli/src/index.js", import.meta.url);
  const cliSrc = await readFile(cliSrcPath, "utf8");

  assert.match(
    cliSrc,
    /import\s*\{[^}]*\bverifyReceipt\b(?!Placeholder)[^}]*\}\s*from\s*["']\.\.\/\.\.\/\.\.\/packages\/verifier\/src\/sat-placeholder\.js["']/s,
    "apps/cli/src/index.js must import verifyReceipt from packages/verifier/src/sat-placeholder.js"
  );
  assert.doesNotMatch(
    cliSrc,
    /import\s*\{[^}]*\bverifyReceiptPlaceholder\b[^}]*\}\s*from\s*["']\.\.\/\.\.\/\.\.\/packages\/verifier\/src\/sat-placeholder\.js["']/s,
    "apps/cli/src/index.js must NOT import verifyReceiptPlaceholder directly"
  );
  assert.match(cliSrc, /\bverifyReceipt\s*\(\s*receipt\s*\)/);
  assert.doesNotMatch(cliSrc, /\bverifyReceiptPlaceholder\s*\(\s*receipt\s*\)/);
});
