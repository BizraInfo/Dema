import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  buildMissionContract,
  buildConsentContext,
  buildMissionReceipt,
  deriveMissionResult,
  MISSION_PERMITTED_OPERATION,
  MISSION_SKIP_REASONS,
  MISSION_TYPE_CATEGORIES,
} from "../../genesis/src/urp0-mission-kernel.js";
import { projectMissionOutcome } from "../src/app/mission/mission-outcome-projection.ts";

const pageSource = readFileSync(new URL("../src/app/mission/page.tsx", import.meta.url), "utf8");

function completeMissionResponse() {
  const mission_id = "TEST_FIXTURE_NOT_NODE0";
  const canonical_root = "/TEST_FIXTURE_NOT_NODE0";
  const limits = { max_entries: 100, max_depth: 4, wall_clock_seconds: 5, storage_write_bytes: 1024 };
  const { body: contract, contract_hash } = buildMissionContract({ mission_id, canonical_root, limits });
  const authorized_at_iso = "2026-10-13T00:01:00.000Z";
  const { consent_context_hash } = buildConsentContext({
    mission_id,
    canonical_root,
    contract_hash,
    nonce: "TEST_FIXTURE_NONCE",
    created_at_iso: "2026-10-13T00:00:00.000Z",
    expires_at_iso: "2026-10-13T00:05:00.000Z",
  });
  const consent_receipt = {
    schema: "bizra.genesis.consent_receipt.v0.1",
    mission_id,
    consent_context_hash,
    consent_verdict: "PERMIT_PREVIEW",
    authorized_at_iso,
    permitted_operation: MISSION_PERMITTED_OPERATION,
  };
  const consent_receipt_hash = sha256CanonicalJsonV1(consent_receipt);
  const observation = {
    root_realpath: canonical_root,
    counts: { files: 1, directories: 0, symlinks: 0, skipped: 0 },
    total_file_bytes: 64,
    type_histogram: Object.fromEntries(MISSION_TYPE_CATEGORIES.map((key, index) => [key, index === 0 ? 1 : 0])),
    skipped_reasons: Object.fromEntries(MISSION_SKIP_REASONS.map((key) => [key, 0])),
    limits_honored: true,
    entries_outside_root: 0,
    symlinks_followed: 0,
    contents_read: false,
    contents_hashed: false,
    network_used: false,
    source_mutated: false,
    elapsed_ms: 1,
  };
  const derived = deriveMissionResult({ contract, contract_hash, observation });
  const judgmentBody = {
    schema: "bizra.genesis.sat5_judgment.v0.1",
    subject: "NODE0",
    status: "ACTIVE_LOCAL",
    implementation: "DETERMINISTIC_VERIFIER",
    autonomous_ai_agent: false,
    evidence_complete: true,
    verifier_verdicts: Array.from({ length: 5 }, (_, index) => ({
      id: `TEST_FIXTURE_SAT_${index + 1}`,
      lane: "TEST_FIXTURE",
      verdict: "PASS",
      reasons: [],
    })),
    failing_verifiers: [],
    set_verdict: "ADMISSIBLE",
    admissible: true,
    judges_node0: true,
    serves_node0: false,
  };
  const judgment = { ...judgmentBody, judgment_hash: sha256CanonicalJsonV1(judgmentBody) };
  const previous_state_root = sha256CanonicalJsonV1({ state: "TEST_FIXTURE_PREVIOUS" });
  const resulting_state_root = sha256CanonicalJsonV1({ state: "TEST_FIXTURE_RESULT" });
  const sealed = buildMissionReceipt({
    mission_id,
    contract_hash,
    consent_context_hash,
    consent_receipt_hash,
    result_hash: derived.result_hash,
    judgment_hash: judgment.judgment_hash,
    previous_state_root,
    executed_at_iso: authorized_at_iso,
  });

  return {
    response: {
      ok: true,
      governed: {
        ok: true,
        blocked_by: [],
        contract,
        contract_hash,
        consent_receipt,
        consent_receipt_hash,
        result: derived.result,
        result_hash: derived.result_hash,
        judgment,
        receipt: sealed.body,
        receipt_hash: sealed.receipt_hash,
        observation,
        previous_state_root,
        resulting_state_root,
      },
    },
    httpStatus: 200,
  };
}

test("mission page uses the projection and never claims no effect from a false result", () => {
  assert.match(pageSource, /projectMissionOutcome\(missionOutcomeResponse, execution\.missionOutcomeHttpStatus\)/);
  assert.doesNotMatch(pageSource, /No effect was admitted by the governed runtime/);
});

test("exact-consent refusal is identified as pre-authorization, not success", () => {
  const result = projectMissionOutcome({
    ok: false,
    governed: {
      ok: false,
      blocked_by: ["exact_consent_not_matched"],
      consent_recorded: true,
    },
  }, 400);

  assert.equal(result.kind, "authorization-refused");
  assert.notEqual(result.kind, "receipted");
  assert.match(result.message, /does not establish whether an effect occurred/i);
  assert.doesNotMatch(result.message, /not executed|no effect/i);
});

test("post-execution refusal is presented as an unverified outcome", () => {
  const result = projectMissionOutcome({
    ok: false,
    governed: {
      ok: false,
      blocked_by: ["sat5_refused"],
      events: ["MISSION_AUTHORIZED", "MISSION_EXECUTED"],
    },
  }, 400);

  assert.equal(result.title, "Mission outcome not verified");
  assert.match(result.message, /inspect.*before retry/i);
  assert.doesNotMatch(result.message, /no effect was admitted/i);
});

test("timeout after dispatch does not imply no effect or safe retry", () => {
  const result = projectMissionOutcome({ ok: false, blocked_by: ["AbortError"] }, null);
  const malformed = projectMissionOutcome({
    ok: false,
    blocked_by: [String(new SyntaxError("Unexpected end of JSON input"))],
  }, 200);

  assert.equal(result.kind, "unverified");
  assert.match(result.message, /inspect.*before retry/i);
  assert.doesNotMatch(result.message, /no effect was admitted/i);
  assert.equal(malformed.kind, "unverified");
  assert.match(malformed.message, /inspect.*before retry/i);
});

test("complete runtime receipt stays unverified without digest re-derivation", () => {
  const fixture = completeMissionResponse();
  const result = projectMissionOutcome(fixture.response, fixture.httpStatus);

  assert.equal(result.kind, "unverified");
  assert.match(result.title, /not verified/i);
  assert.match(result.message, /does not re-derive.*content hashes/i);
  assert.match(result.message, /independently verify SAT or an external effect/i);
});

test("well-formed but incorrect result digest cannot be projected as receipted", () => {
  const fixture = completeMissionResponse();
  const incorrectDigest = `sha256:${"0".repeat(64)}`;
  const response = {
    ...fixture.response,
    governed: {
      ...fixture.response.governed,
      result_hash: incorrectDigest,
      receipt: {
        ...fixture.response.governed.receipt,
        result_hash: incorrectDigest,
      },
    },
  };

  const result = projectMissionOutcome(response, fixture.httpStatus);

  assert.equal(result.kind, "unverified");
  assert.notEqual(result.kind, "receipted");
});

test("incomplete success response fails closed", () => {
  const result = projectMissionOutcome({ ok: true, governed: { ok: true } }, 200);

  assert.equal(result.kind, "unverified");
  assert.equal(result.title, "Mission outcome not verified");
});

test("HTTP status and success body disagreement fails closed", () => {
  const fixture = completeMissionResponse();
  const result = projectMissionOutcome(fixture.response, 400);

  assert.equal(result.kind, "unverified");
  assert.equal(result.title, "Mission outcome not verified");
});

test("a consent-looking reason without pre-execution provenance stays unknown", () => {
  const result = projectMissionOutcome({
    ok: false,
    governed: { ok: false, blocked_by: ["exact_consent_not_matched"] },
  }, 400);

  assert.equal(result.kind, "unverified");
});

test("contradictory success with a refusal result and malformed receipt stays unverified", () => {
  const fixture = completeMissionResponse();
  const response = structuredClone(fixture.response);
  response.governed.result.status = "REFUSED";
  response.governed.receipt.status = "REFUSED";
  response.governed.receipt.receipt_hash = "bad";
  const result = projectMissionOutcome(response, fixture.httpStatus);

  assert.equal(result.kind, "unverified");
  assert.notEqual(result.kind, "receipted");
});

test("malformed receipt hashes and mismatched result bindings stay unverified", () => {
  const malformed = completeMissionResponse();
  malformed.response.governed.receipt_hash = "sha256:xyz";
  assert.equal(projectMissionOutcome(malformed.response, malformed.httpStatus).kind, "unverified");

  const mismatched = completeMissionResponse();
  const response = structuredClone(mismatched.response);
  response.governed.receipt.result_hash = `sha256:${"f".repeat(64)}`;
  assert.equal(projectMissionOutcome(response, mismatched.httpStatus).kind, "unverified");
});

test("consent refusal with recorded execution evidence stays unverified", () => {
  const result = projectMissionOutcome({
    ok: false,
    governed: {
      ok: false,
      blocked_by: ["exact_consent_not_matched"],
      consent_recorded: true,
      events: ["MISSION_EXECUTED"],
    },
  }, 400);

  assert.equal(result.kind, "unverified");
  assert.doesNotMatch(result.message, /not executed|no effect/i);
});
