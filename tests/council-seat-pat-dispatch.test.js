import test from "node:test";
import assert from "node:assert/strict";
import {
  COUNCIL_SEAT_PAT_DISPATCH_SCHEMA,
  buildCouncilSeatPatDispatchPreview,
  consentMatchesCouncilPatDispatch,
  formatCouncilSeatPatDispatchResponse,
} from "../packages/adk/src/council-seat-pat-dispatch.js";
import {
  councilPatDispatchConsentPhrase,
  detectCouncilPatDispatchInInput,
  parseCouncilPatDispatchConsentLine,
} from "../packages/core/src/council-seat-pat-routing.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("UX3B-01: consent phrase is exact-string per ADR-005", () => {
  assert.equal(
    councilPatDispatchConsentPhrase("builder"),
    "GO: dispatch PAT from council seat Builder",
  );
  assert.equal(consentMatchesCouncilPatDispatch({ seat: "Builder", consent_phrase: "" }), false);
  assert.equal(
    consentMatchesCouncilPatDispatch({
      seat: "Builder",
      consent_phrase: "GO: dispatch PAT from council seat Builder",
    }),
    true,
  );
});

test("UX3B-02: without consent dispatch_status is consent_required", () => {
  const out = buildCouncilSeatPatDispatchPreview({ seat: "Guardian" });
  assert.equal(out.schema, COUNCIL_SEAT_PAT_DISPATCH_SCHEMA);
  assert.equal(out.dispatch_status, "consent_required");
  assert.equal(out.consent_match, false);
  assert.equal(out.agent_contract, null);
  assert.equal(isCanonicalBoundary(out.boundary), true);
  assert.equal(Object.isFrozen(out), true);
});

test("UX3B-03: with exact consent emits contract + receipt preview only", () => {
  const consent = councilPatDispatchConsentPhrase("Critic");
  const out = buildCouncilSeatPatDispatchPreview({
    seat: "Critic",
    consent_phrase: consent,
  });
  assert.equal(out.dispatch_status, "dispatched_preview_only");
  assert.equal(out.pat_agent_id, "pat-mirror");
  assert.equal(out.contract_valid, true);
  assert.equal(out.receipt_preview?.built, true);
  assert.equal(out.boundary.runtime_execution_performed, false);
});

test("UX3B-04: detectCouncilPatDispatchInInput separates dispatch vs consent line", () => {
  assert.deepEqual(detectCouncilPatDispatchInInput("dispatch pat from council seat builder"), {
    seat: "Builder",
    consent_phrase: "",
  });
  const line = "GO: dispatch PAT from council seat Reasoner";
  assert.deepEqual(parseCouncilPatDispatchConsentLine(line), {
    seat: "Reasoner",
    consent_phrase: line,
  });
  assert.equal(parseCouncilPatDispatchConsentLine(line.toLowerCase()), null);
});

test("UX3B-05: formatCouncilSeatPatDispatchResponse states preview-only posture", () => {
  const consent = councilPatDispatchConsentPhrase("Archivist");
  const dispatched = buildCouncilSeatPatDispatchPreview({
    seat: "Archivist",
    consent_phrase: consent,
  });
  assert.match(formatCouncilSeatPatDispatchResponse(dispatched), /preview only/i);
  const pending = buildCouncilSeatPatDispatchPreview({ seat: "Archivist" });
  assert.match(formatCouncilSeatPatDispatchResponse(pending), /exact-string consent/i);
});
