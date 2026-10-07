import test from "node:test";
import assert from "node:assert/strict";

import {
  NODE0_ESTATE_MAP_SCHEMA,
  buildNode0EstateMapPayload,
  compareNode0EstateMapSnapshots,
  verifyNode0EstateMapPayload,
} from "../packages/core/src/node0-estate-map.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

const DIGEST = (hex) => `sha256:${hex.repeat(64).slice(0, 64)}`;

const REGISTRY = Object.freeze({
  registry_id: "approved-roots:fixture",
  registry_digest: DIGEST("a"),
  roots: Object.freeze([
    Object.freeze({ root_id: "root:alpha", root_identity_digest: DIGEST("b") }),
  ]),
});

function observation({
  observationDigest = DIGEST("c"),
  status = "AVAILABLE",
  completeness = "COMPLETE",
  metadataDigest,
} = {}) {
  return {
    observation_id: "observation:fixture",
    observation_digest: observationDigest,
    registry_digest: REGISTRY.registry_digest,
    roots: [
      {
        root_id: "root:alpha",
        root_identity_digest: DIGEST("b"),
        status,
        completeness,
        metadata_digest: metadataDigest ?? (status === "AVAILABLE" ? DIGEST("d") : null),
      },
    ],
  };
}

test("red-first: unavailable or incomplete snapshots cannot manufacture an unchanged delta", () => {
  const prior = observation();

  const unavailable = compareNode0EstateMapSnapshots({
    approved_roots: REGISTRY,
    prior,
    current: observation({
      observationDigest: DIGEST("e"),
      status: "UNAVAILABLE",
      completeness: "INCOMPLETE",
    }),
  });
  assert.equal(unavailable.verdict, "HOLD");
  assert.equal(unavailable.roots[0].outcome, "UNAVAILABLE");
  assert.equal(unavailable.summary.unchanged, 0);
  assert.equal(unavailable.summary.changed, 0);
  assert.equal(JSON.stringify(unavailable).includes("DELETED"), false);

  const incomplete = compareNode0EstateMapSnapshots({
    approved_roots: REGISTRY,
    prior,
    current: observation({
      observationDigest: DIGEST("f"),
      completeness: "INCOMPLETE",
    }),
  });
  assert.equal(incomplete.verdict, "HOLD");
  assert.equal(incomplete.roots[0].outcome, "INCOMPARABLE");
  assert.equal(incomplete.summary.unchanged, 0);
});

test("baseline, unchanged, changed, and restored snapshots remain deterministic and rederivable", () => {
  const baseline = compareNode0EstateMapSnapshots({
    approved_roots: REGISTRY,
    prior: null,
    current: observation(),
  });
  assert.equal(baseline.verdict, "HOLD");
  assert.equal(baseline.roots[0].outcome, "BASELINE_REQUIRED");

  const unchangedInput = {
    approved_roots: REGISTRY,
    prior: observation(),
    current: observation(),
  };
  const unchanged = compareNode0EstateMapSnapshots(unchangedInput);
  assert.equal(unchanged.verdict, "PASS");
  assert.equal(unchanged.roots[0].outcome, "UNCHANGED");
  assert.equal(unchanged.summary.unchanged, 1);
  assert.deepEqual(compareNode0EstateMapSnapshots(unchangedInput), unchanged);

  const changed = compareNode0EstateMapSnapshots({
    approved_roots: REGISTRY,
    prior: observation(),
    current: observation({ observationDigest: DIGEST("e"), metadataDigest: DIGEST("f") }),
  });
  assert.equal(changed.verdict, "PASS");
  assert.equal(changed.roots[0].outcome, "CHANGED");

  const restored = compareNode0EstateMapSnapshots({
    approved_roots: REGISTRY,
    prior: observation({ observationDigest: DIGEST("e"), status: "UNAVAILABLE", completeness: "INCOMPLETE" }),
    current: observation({ observationDigest: DIGEST("f") }),
  });
  assert.equal(restored.verdict, "HOLD");
  assert.equal(restored.roots[0].outcome, "RESTORED_UNVERIFIED");

  const payload = buildNode0EstateMapPayload(unchangedInput);
  assert.equal(payload.schema, NODE0_ESTATE_MAP_SCHEMA);
  assert.equal(verifyNode0EstateMapPayload(payload, unchangedInput).ok, true);
  assert.equal(payload.authority_delta, 0);
  assert.ok(Object.values(payload.boundary).every((value) => value === false));
});

test("malformed identity and unknown roots fail closed without touching a scanner", () => {
  const widened = compareNode0EstateMapSnapshots({
    approved_roots: REGISTRY,
    prior: observation(),
    current: observation(),
    scanner: "not admitted",
  });
  assert.equal(widened.verdict, "REFUSE");
  assert.ok(widened.blocked_by.includes("input_contains_forbidden_field"));

  const malformed = compareNode0EstateMapSnapshots({
    approved_roots: { ...REGISTRY, registry_digest: "not-a-digest" },
    prior: observation(),
    current: observation(),
  });
  assert.equal(malformed.verdict, "REFUSE");
  assert.ok(malformed.blocked_by.includes("registry_digest_malformed"));

  const unknown = compareNode0EstateMapSnapshots({
    approved_roots: REGISTRY,
    prior: observation(),
    current: { ...observation(), roots: [{ ...observation().roots[0], root_id: "root:unknown" }] },
  });
  assert.equal(unknown.verdict, "REFUSE");
  assert.ok(unknown.blocked_by.includes("current_root_unknown:root:unknown"));
});

test("a rejected secret-bearing input is never serialized into a payload", () => {
  const sentinel = "not-a-real-estate-map-secret";
  const rejectedInput = {
    approved_roots: REGISTRY,
    prior: observation(),
    current: observation(),
    api_key: sentinel,
  };
  const payload = buildNode0EstateMapPayload(rejectedInput);

  assert.equal(payload.decision.verdict, "REFUSE");
  assert.equal(Object.hasOwn(payload, "input"), false);
  assert.equal(JSON.stringify(payload).includes(sentinel), false);
  assert.equal(verifyNode0EstateMapPayload(payload).blocked_by.includes("independent_input_required"), true);
  assert.equal(verifyNode0EstateMapPayload(payload, rejectedInput).ok, true);

  const { content_hash: ignored, ...body } = payload;
  const forged = { ...body, input: rejectedInput };
  assert.equal(
    verifyNode0EstateMapPayload({ ...forged, content_hash: sha256CanonicalJsonV1(forged) }, rejectedInput)
      .blocked_by.includes("payload_contains_forbidden_field"),
    true,
  );
});

test("payload verification rejects altered decisions and a boundary claim", () => {
  const input = {
    approved_roots: REGISTRY,
    prior: observation(),
    current: observation(),
  };
  const payload = buildNode0EstateMapPayload(input);
  const { content_hash: ignored, ...body } = payload;
  const rehashedDecision = {
    ...body,
    decision: { ...payload.decision, verdict: "PASS", summary: { ...payload.decision.summary, changed: 9 } },
  };
  assert.ok(
    verifyNode0EstateMapPayload({
      ...rehashedDecision,
      content_hash: sha256CanonicalJsonV1(rehashedDecision),
    }, input).blocked_by.includes("decision_rederivation_mismatch"),
  );
  assert.ok(
    verifyNode0EstateMapPayload({
      ...payload,
      boundary: { ...payload.boundary, filesystem_scan_performed: true },
    }, input).blocked_by.includes("boundary_not_all_false"),
  );
});
