import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildChooseDecision,
  URP_CHOOSE_RECEIPT_SCHEMA,
  DECISION_MARK_SHAREABLE,
  DECISION_MARK_LOCAL_ONLY,
  CONSENT_MARK_SHAREABLE,
  CONSENT_MARK_LOCAL_ONLY,
} from "../packages/urp/src/choose-decision.js";
import { URP_LOCAL_INDEX_SCHEMA } from "../packages/urp/src/local-index.js";
import { sha256 } from "../packages/consent/src/consent-common.js";

const FIXED_NOW = new Date("2026-05-28T12:00:00Z");

const FORBIDDEN_FIELDS = [
  "private_key",
  "private_key_pem",
  "raw_artifact",
  "artifact_content",
  "full_receipt_json",
  "personal_memory",
  "mint_candidate",
  "token_eligible",
  "reward",
  "bzc",
  "imp",
  "economic_value",
  "federation_target",
];

function validIndex(overrides = {}) {
  return {
    schema: URP_LOCAL_INDEX_SCHEMA,
    mode: "LOCAL_INDEX_ONLY",
    truth_label: "LOCAL_VERIFIED_RESOURCE_INDEX",
    source_passport_hash: "a".repeat(64),
    verification_scope: "PASSPORT_ENVELOPE_AND_RECEIPTS",
    resource_class: "WORK_ARTIFACT",
    awareness_level: "A2_METADATA",
    share_status: "MARKED_LOCAL_ONLY",
    receipts_count: 1,
    artifact_hashes: ["b".repeat(64)],
    author_fingerprints: ["c".repeat(64)],
    entries: [
      {
        receipt_filename: "authorship-abc.json",
        artifact_sha256: "b".repeat(64),
        author_fingerprint: "c".repeat(64),
        truth_label: "LOCAL_AUTHORSHIP_ATTESTED",
      },
    ],
    indexed_at_iso: "2026-05-28T10:00:00Z",
    index_hash: "d".repeat(64),
    ...overrides,
  };
}

describe("buildChooseDecision — happy paths", () => {
  it("MARK_SHAREABLE on MARKED_LOCAL_ONLY index returns chosen:true with correct transition", () => {
    const r = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(r.schema, URP_CHOOSE_RECEIPT_SCHEMA);
    assert.equal(r.chosen, true);
    assert.equal(r.decision, "MARK_SHAREABLE");
    assert.equal(r.previous_share_status, "MARKED_LOCAL_ONLY");
    assert.equal(r.next_share_status, "CANDIDATE_SHAREABLE");
    assert.equal(r.consent_verified, true);
    assert.equal(r.source_truth_label, "LOCAL_VERIFIED_RESOURCE_INDEX");
    assert.match(r.choose_hash, /^[a-f0-9]{64}$/);
  });

  it("MARK_LOCAL_ONLY on MARKED_LOCAL_ONLY index returns chosen:true", () => {
    const r = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_LOCAL_ONLY,
      consent: CONSENT_MARK_LOCAL_ONLY,
      now: FIXED_NOW,
    });
    assert.equal(r.chosen, true);
    assert.equal(r.decision, "MARK_LOCAL_ONLY");
    assert.equal(r.previous_share_status, "MARKED_LOCAL_ONLY");
    assert.equal(r.next_share_status, "MARKED_LOCAL_ONLY");
  });

  it("MARK_LOCAL_ONLY on CANDIDATE_SHAREABLE index (withdraw shareability) returns chosen:true", () => {
    const r = buildChooseDecision(
      validIndex({ share_status: "CANDIDATE_SHAREABLE" }),
      {
        decision: DECISION_MARK_LOCAL_ONLY,
        consent: CONSENT_MARK_LOCAL_ONLY,
        now: FIXED_NOW,
      },
    );
    assert.equal(r.chosen, true);
    assert.equal(r.previous_share_status, "CANDIDATE_SHAREABLE");
    assert.equal(r.next_share_status, "MARKED_LOCAL_ONLY");
  });

  it("consent_phrase_hash is sha256 of the exact phrase", () => {
    const r = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(r.consent_phrase_hash, sha256(CONSENT_MARK_SHAREABLE));
  });
});

describe("buildChooseDecision — consent enforcement (domain invariant)", () => {
  it("missing consent returns chosen:false with consent_required_or_mismatch", () => {
    const r = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(r.chosen, false);
    assert.equal(r.error, "consent_required_or_mismatch");
    assert.equal(r.expected_consent, CONSENT_MARK_SHAREABLE);
    assert.equal(r.choose_hash, undefined);
  });

  it("wrong consent phrase returns chosen:false", () => {
    const r = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: "GO: mark this entry shareable",
      now: FIXED_NOW,
    });
    assert.equal(r.chosen, false);
    assert.equal(r.error, "consent_required_or_mismatch");
  });

  it("MARK_LOCAL_ONLY decision rejects MARK_SHAREABLE consent phrase", () => {
    const r = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_LOCAL_ONLY,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(r.chosen, false);
    assert.equal(r.error, "consent_required_or_mismatch");
    assert.equal(r.expected_consent, CONSENT_MARK_LOCAL_ONLY);
  });
});

describe("buildChooseDecision — source index validation", () => {
  it("wrong schema rejected", () => {
    const r = buildChooseDecision(
      validIndex({ schema: "bizra.dema.something_else.v0.1" }),
      {
        decision: DECISION_MARK_SHAREABLE,
        consent: CONSENT_MARK_SHAREABLE,
        now: FIXED_NOW,
      },
    );
    assert.equal(r.chosen, false);
    assert.equal(r.error, "wrong_schema");
  });

  it("wrong mode rejected", () => {
    const r = buildChooseDecision(validIndex({ mode: "PUBLIC_INDEX" }), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(r.chosen, false);
    assert.equal(r.error, "wrong_mode");
  });

  it("wrong truth_label rejected", () => {
    const r = buildChooseDecision(
      validIndex({ truth_label: "LOCAL_TAMPERED_RESOURCE_INDEX" }),
      {
        decision: DECISION_MARK_SHAREABLE,
        consent: CONSENT_MARK_SHAREABLE,
        now: FIXED_NOW,
      },
    );
    assert.equal(r.chosen, false);
    assert.equal(r.error, "wrong_truth_label");
  });

  it("MARK_SHAREABLE on CANDIDATE_SHAREABLE source rejected (invalid_transition)", () => {
    const r = buildChooseDecision(
      validIndex({ share_status: "CANDIDATE_SHAREABLE" }),
      {
        decision: DECISION_MARK_SHAREABLE,
        consent: CONSENT_MARK_SHAREABLE,
        now: FIXED_NOW,
      },
    );
    assert.equal(r.chosen, false);
    assert.equal(r.error, "invalid_transition");
    assert.equal(r.from, "CANDIDATE_SHAREABLE");
  });

  it("null index rejected", () => {
    const r = buildChooseDecision(null, {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(r.chosen, false);
    assert.equal(r.error, "invalid_index_input");
  });
});

describe("buildChooseDecision — forbidden-field discipline", () => {
  it("rejects source index containing forbidden private_key field", () => {
    const r = buildChooseDecision(validIndex({ private_key: "PEM-pretend" }), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(r.chosen, false);
    assert.equal(r.error, "forbidden_field_in_source_index");
    assert.equal(r.field, "private_key");
  });

  it("rejects source index containing forbidden mint_candidate field", () => {
    const r = buildChooseDecision(validIndex({ mint_candidate: true }), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(r.chosen, false);
    assert.equal(r.error, "forbidden_field_in_source_index");
    assert.equal(r.field, "mint_candidate");
  });

  it("success envelope contains none of the forbidden field names as exact JSON keys", () => {
    const r = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    const json = JSON.stringify(r);
    for (const field of FORBIDDEN_FIELDS) {
      assert.equal(
        json.includes(`"${field}":`),
        false,
        `envelope must not include "${field}" as a JSON key`,
      );
    }
  });
});

describe("buildChooseDecision — determinism and freeze", () => {
  it("choose_hash deterministic with fixed now", () => {
    const a = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    const b = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(a.choose_hash, b.choose_hash);
  });

  it("choose_hash excludes decided_at_iso from stable body", () => {
    const a = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: new Date("2026-05-28T12:00:00Z"),
    });
    const b = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: new Date("2099-01-01T00:00:00Z"),
    });
    assert.equal(a.choose_hash, b.choose_hash);
    assert.notEqual(a.decided_at_iso, b.decided_at_iso);
  });

  it("envelope is frozen on success and failure", () => {
    const ok = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    const bad = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(Object.isFrozen(ok), true);
    assert.equal(Object.isFrozen(bad), true);
  });
});

describe("buildChooseDecision — boundary discipline", () => {
  it("success envelope boundary asserts all runtime/economic flags false", () => {
    const r = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: CONSENT_MARK_SHAREABLE,
      now: FIXED_NOW,
    });
    assert.equal(r.boundary.file_write_performed, false);
    assert.equal(r.boundary.network_used, false);
    assert.equal(r.boundary.federation_used, false);
    assert.equal(r.boundary.share_published, false);
    assert.equal(r.boundary.resource_offer_created, false);
    assert.equal(r.boundary.poi_score_calculated, false);
    assert.equal(r.boundary.token_minted, false);
    assert.equal(r.boundary.economic_claim_made, false);
    assert.equal(r.boundary.private_key_loaded, false);
    assert.equal(r.boundary.raw_artifact_included, false);
  });

  it("failure envelope carries the same boundary contract", () => {
    const r = buildChooseDecision(validIndex(), {
      decision: DECISION_MARK_SHAREABLE,
      consent: "wrong",
      now: FIXED_NOW,
    });
    assert.equal(r.boundary.file_write_performed, false);
    assert.equal(r.boundary.network_used, false);
    assert.equal(r.boundary.share_published, false);
    assert.equal(r.boundary.token_minted, false);
  });
});
