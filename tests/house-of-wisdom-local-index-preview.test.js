import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildHouseOfWisdomLocalIndexPreview,
  HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_SCHEMA,
} from "../packages/core/src/house-of-wisdom-local-index-preview.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

function validUnits() {
  return [
    {
      unit_id: "node0-proof-discipline",
      title: "Node0 proof discipline",
      domain: "proof",
      claim:
        "Local preview surfaces can be composed without claiming UKE acceptance.",
      evidence_class: "OPERATOR_AUTHORED",
      source_ref: "docs/audits/HOUSE_OF_WISDOM_VERIFIED_LOCAL_INDEX_1A.md",
    },
    {
      unit_id: "urp-boundary-canon",
      title: "URP boundary canon",
      domain: "urp",
      claim: "URP shared runtime remains designed-not-live in this repo.",
      evidence_class: "CANON_REFERENCE",
      source_ref: "docs/HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md",
    },
  ];
}

test("builds a frozen preview-only local candidate index without promoting claims", () => {
  const result = buildHouseOfWisdomLocalIndexPreview({ units: validUnits() });

  assert.equal(result.schema, HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_SCHEMA);
  assert.equal(
    result.schema,
    "bizra.dema.house_of_wisdom_local_index_preview.v0.1",
  );
  assert.equal(result.truth_label, "HOUSE_OF_WISDOM_LOCAL_INDEX_PREVIEW_ONLY");
  assert.equal(result.mode, "preview_only");
  assert.equal(result.valid, true);
  assert.equal(result.input_unit_count, 2);
  assert.equal(result.entry_count, 2);

  assert.equal(result.house_status.highest_tier_emitted, "LOCAL_CANDIDATE");
  assert.equal(result.house_status.uke_runtime_status, "DESIGNED_NOT_LIVE");
  assert.equal(result.house_status.urp_shared_runtime_status, "DESIGNED_NOT_LIVE");
  assert.equal(
    result.house_status.sat_governance_runtime_status,
    "DESIGNED_NOT_LIVE",
  );

  for (const entry of result.entries) {
    assert.equal(entry.local_tier, "LOCAL_CANDIDATE");
    assert.equal(entry.truth_status, "PROVENANCE_CLASSIFIED_NOT_TRUTH_PROVEN");
    assert.equal(entry.house_of_wisdom_accepted, false);
    assert.equal(entry.urp_shareable, false);
    assert.equal(entry.reward_candidate_eligible, false);
    assert.match(entry.unit_ref_hash, SHA256_HEX);
  }

  assert.match(result.index_preview_hash, SHA256_HEX);
  assert.equal(isCanonicalBoundary(result.boundary), true);
  for (const value of Object.values(result.house_boundary)) {
    assert.equal(value, false);
  }
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.entries), true);
  assert.equal(Object.isFrozen(result.entries[0]), true);
  assert.equal(Object.isFrozen(result.house_boundary), true);
  assert.equal(Object.isFrozen(result.house_status), true);
});

test("output is deterministic and keeps the proof boundary explicit", () => {
  const a = buildHouseOfWisdomLocalIndexPreview({ units: validUnits() });
  const b = buildHouseOfWisdomLocalIndexPreview({ units: validUnits() });

  assert.deepEqual(a, b);
  assert.ok(
    a.what_this_proves.includes(
      "Caller-provided local knowledge units can be classified into a preview-only LOCAL_CANDIDATE index without reading files, signing receipts, or promoting claims.",
    ),
  );
  for (const blocked of [
    "UKE runtime is live.",
    "House of Wisdom has accepted any claim.",
    "URP shared runtime is connected.",
    "A SAT runtime has verified these claims.",
    "A reward, token, or economic value has been created.",
  ]) {
    assert.ok(a.what_this_does_not_prove.includes(blocked), blocked);
  }
});

test("VERIFIED evidence class requires an explicit verification_path and still does not promote", () => {
  const missing = buildHouseOfWisdomLocalIndexPreview({
    units: [{ ...validUnits()[0], evidence_class: "VERIFIED" }],
  });

  assert.equal(missing.valid, false);
  assert.equal(missing.status, "REFUSED_PREVIEW_INPUT_INVALID");
  assert.deepEqual(missing.entries, []);
  assert.ok(
    missing.blocked_by.includes(
      "unit[0].verification_path_required_for_verified",
    ),
  );
  assert.equal(isCanonicalBoundary(missing.boundary), true);

  const present = buildHouseOfWisdomLocalIndexPreview({
    units: [
      {
        ...validUnits()[0],
        evidence_class: "VERIFIED",
        verification_path: "tests/example-verifier.test.js",
      },
    ],
  });

  assert.equal(present.valid, true);
  assert.equal(present.entries[0].evidence_class, "VERIFIED");
  assert.equal(present.entries[0].truth_status, "PROVENANCE_CLASSIFIED_NOT_TRUTH_PROVEN");
  assert.equal(present.entries[0].house_of_wisdom_accepted, false);
});

test("fails closed on duplicate unit ids", () => {
  const unit = validUnits()[0];
  const result = buildHouseOfWisdomLocalIndexPreview({ units: [unit, unit] });

  assert.equal(result.valid, false);
  assert.equal(result.input_unit_count, 2);
  assert.ok(result.blocked_by.includes("unit[1].duplicate_unit_id:node0-proof-discipline"));
  assert.equal(result.entries.length, 0);
});

test("fails closed on forbidden private, token, reward, and raw-artifact fields", () => {
  const result = buildHouseOfWisdomLocalIndexPreview({
    units: [
      {
        ...validUnits()[0],
        metadata: {
          private_key: "do-not-emit",
        },
      },
      {
        ...validUnits()[1],
        reward_function: "claim reward now",
      },
      {
        ...validUnits()[1],
        unit_id: "raw-leak",
        raw_artifact: "full private corpus should never appear",
      },
    ],
  });

  assert.equal(result.valid, false);
  assert.ok(result.blocked_by.includes("unit[0].forbidden_field:metadata.private_key"));
  assert.ok(result.blocked_by.includes("unit[1].forbidden_field:reward_function"));
  assert.ok(result.blocked_by.includes("unit[2].forbidden_field:raw_artifact"));
  assert.equal(JSON.stringify(result).includes("do-not-emit"), false);
  assert.equal(JSON.stringify(result).includes("claim reward now"), false);
  assert.equal(JSON.stringify(result).includes("full private corpus"), false);
});

test("fails closed on malformed input and invalid evidence class", () => {
  const notArray = buildHouseOfWisdomLocalIndexPreview({ units: "bad" });
  assert.equal(notArray.valid, false);
  assert.ok(notArray.blocked_by.includes("units_not_array"));

  const invalidClass = buildHouseOfWisdomLocalIndexPreview({
    units: [{ ...validUnits()[0], evidence_class: "TRUST_ME" }],
  });
  assert.equal(invalidClass.valid, false);
  assert.ok(invalidClass.blocked_by.includes("unit[0].evidence_class_invalid"));
});

test("nested metadata walk is cycle-safe and metadata is not emitted", () => {
  const unit = { ...validUnits()[0], metadata: {} };
  unit.metadata.self = unit;

  const result = buildHouseOfWisdomLocalIndexPreview({ units: [unit] });

  assert.equal(result.valid, true);
  assert.equal(result.entries.length, 1);
  assert.equal(JSON.stringify(result).includes("metadata"), false);
});

test("fails closed on an empty units array (nothing to preview)", () => {
  const result = buildHouseOfWisdomLocalIndexPreview({ units: [] });

  assert.equal(result.valid, false);
  assert.equal(result.status, "REFUSED_PREVIEW_INPUT_INVALID");
  assert.ok(result.blocked_by.includes("units_empty"));
  assert.equal(result.entry_count, 0);
  assert.deepEqual(result.entries, []);
  assert.equal(result.index_preview_hash, null);
});

test("fails closed on a truthy-but-not-true reward_candidate_eligible (no fail-open)", () => {
  const result = buildHouseOfWisdomLocalIndexPreview({
    units: [{ ...validUnits()[0], reward_candidate_eligible: 1 }],
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.blocked_by.includes(
      "unit[0].reward_candidate_not_allowed_in_preview",
    ),
  );
});

test("emitted knowledge fields are caller-authored passthrough; non-whitelisted keys are dropped", () => {
  // Pins the NO-LEAK boundary (critic finding F1): the forbidden-field guard keys on
  // NAME and the output is a whitelist projection of six operator-authored fields.
  // A knowledge claim that *mentions* a sensitive term is legitimate House-of-Wisdom
  // content and is emitted verbatim — it is the index content, not a leak. Any
  // non-whitelisted key is dropped by the projection and never reaches the envelope.
  const result = buildHouseOfWisdomLocalIndexPreview({
    units: [
      {
        ...validUnits()[0],
        claim:
          "Operator deliberately minted no token and stored no private_key.",
        internal_notes: "DROP_ME_NOT_IN_OUTPUT",
      },
    ],
  });

  assert.equal(result.valid, true);
  assert.ok(result.entries[0].claim.includes("private_key"));
  assert.ok(result.entries[0].claim.includes("token"));
  assert.equal(JSON.stringify(result).includes("DROP_ME_NOT_IN_OUTPUT"), false);
  assert.equal(JSON.stringify(result).includes("internal_notes"), false);
});

test("module stays pure: no fs, network, process execution, clock, or randomness", async () => {
  const src = await readFile(
    new URL(
      "../packages/core/src/house-of-wisdom-local-index-preview.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process|os|worker_threads)\b/);
  assert.doesNotMatch(src, /\bDate\.now\b|\bnew Date\b|\bMath\.random\b/);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bimport\s*\(/);
});
