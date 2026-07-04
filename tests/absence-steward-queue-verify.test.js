import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA,
  ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
  validateAbsenceStewardQueueItem,
  absenceStewardQueueBoundary,
} from "../packages/core/src/absence-steward-queue-schema.js";
import {
  ABSENCE_STEWARD_QUEUE_VERIFY_RESULT_SCHEMA,
  ABSENCE_STEWARD_QUEUE_VERIFY_TRUTH_LABEL,
  verifyAbsenceStewardQueueItem,
  absenceStewardQueueVerifyBoundary,
} from "../packages/core/src/absence-steward-queue-verify.js";

// ABSENCE-STEWARD-QUEUE-VERIFY-1A — schema says the proposal has a valid
// shape; verify says the proposal was not laundered. Neither says approved.
// Neither says executed.

const NOW_ISO = "2026-07-04T05:00:00.000Z";

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v);
}

function withHash(body) {
  const { queue_item_hash, ...rest } = body;
  const normalized = {
    ...rest,
    allowed_by_contract: [...new Set(rest.allowed_by_contract)].sort(),
    forbidden_by_contract: [...new Set(rest.forbidden_by_contract)].sort(),
  };
  return {
    ...body,
    queue_item_hash:
      "sha256:" + createHash("sha256").update(stable(normalized), "utf8").digest("hex"),
  };
}

function validItem(overrides = {}) {
  return withHash({
    schema: ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA,
    queue_item_id: "qitem-docs-refresh-0002",
    truth_label: ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
    operator_id: "mumu",
    node_id: "NODE0",
    contract_id: "away-2026-07-04-0101",
    contract_hash: `sha256:${"a".repeat(64)}`,
    readiness_report_hash: `sha256:${"b".repeat(64)}`,
    return_review_requirement: true,
    proposed_action_class: "DOCS_ONLY",
    proposed_action_summary: "refresh stale TESTING rows",
    proposed_inputs_summary: "docs/TESTING.md",
    required_human_decision: true,
    allowed_by_contract: ["READ_ONLY", "DOCS_ONLY"],
    forbidden_by_contract: ["PUSH_ALLOWED", "MODEL_ALLOWED"],
    status: "PROPOSED",
    created_at: "2026-07-04T04:00:00.000Z",
    expires_at: "2026-07-04T12:00:00.000Z",
    boundary: absenceStewardQueueBoundary(),
    ...overrides,
  });
}

function validatedPair(overrides = {}, nowIso = NOW_ISO) {
  const queue_item = validItem(overrides);
  const validation_result = validateAbsenceStewardQueueItem(queue_item, { now_iso: nowIso });
  assert.equal(validation_result.valid, true, validation_result.blocked_by.join(","));
  return { queue_item, validation_result };
}

function thaw(value) {
  return JSON.parse(JSON.stringify(value));
}

test("valid item + matching validation_result verifies body-bound", () => {
  const report = verifyAbsenceStewardQueueItem(validatedPair(), { now_iso: NOW_ISO });

  assert.equal(report.valid, true, report.blocked_by.join(","));
  assert.equal(report.schema, ABSENCE_STEWARD_QUEUE_VERIFY_RESULT_SCHEMA);
  assert.equal(report.truth_label, ABSENCE_STEWARD_QUEUE_VERIFY_TRUTH_LABEL);
  assert.equal(report.queue_item_id, "qitem-docs-refresh-0002");
  assert.equal(report.rederived_item_hash, report.queue_item_hash);
  assert.equal(report.validation_item_hash, report.queue_item_hash);
});

test("missing queue_item / validation_result / non-object input reject", () => {
  const noItem = verifyAbsenceStewardQueueItem(
    { validation_result: validatedPair().validation_result },
    { now_iso: NOW_ISO },
  );
  assert.ok(noItem.blocked_by.includes("queue_item_missing"));

  const noValidation = verifyAbsenceStewardQueueItem(
    { queue_item: validItem() },
    { now_iso: NOW_ISO },
  );
  assert.ok(noValidation.blocked_by.includes("validation_result_missing"));

  const nothing = verifyAbsenceStewardQueueItem(null, { now_iso: NOW_ISO });
  assert.ok(nothing.blocked_by.includes("queue_item_missing"));
});

test("invalid queue item rejects; forged validation over it flags laundering", () => {
  const { validation_result } = validatedPair();
  const invalid = validItem({ status: "EXECUTING" });
  const report = verifyAbsenceStewardQueueItem(
    { queue_item: invalid, validation_result: { ...thaw(validation_result), valid: true } },
    { now_iso: NOW_ISO },
  );
  assert.equal(report.valid, false);
  assert.ok(report.blocked_by.includes("queue_item_invalid"));
  assert.ok(report.blocked_by.includes("launder_attempt_detected"));
});

test("validation_result verdict/schema/truth-label/parts reject when wrong or missing", () => {
  const { queue_item, validation_result } = validatedPair();

  const notValid = { ...thaw(validation_result), valid: false };
  assert.ok(
    verifyAbsenceStewardQueueItem({ queue_item, validation_result: notValid }, { now_iso: NOW_ISO })
      .blocked_by.includes("validation_not_valid"),
  );

  const wrongSchema = { ...thaw(validation_result), schema: "bizra.dema.other.v1" };
  assert.ok(
    verifyAbsenceStewardQueueItem({ queue_item, validation_result: wrongSchema }, { now_iso: NOW_ISO })
      .blocked_by.includes("validation_schema_invalid"),
  );

  const wrongLabel = { ...thaw(validation_result), truth_label: "QUEUE_LIVE" };
  assert.ok(
    verifyAbsenceStewardQueueItem({ queue_item, validation_result: wrongLabel }, { now_iso: NOW_ISO })
      .blocked_by.includes("validation_truth_label_invalid"),
  );

  const noBody = thaw(validation_result);
  noBody.normalized_item = null;
  assert.ok(
    verifyAbsenceStewardQueueItem({ queue_item, validation_result: noBody }, { now_iso: NOW_ISO })
      .blocked_by.includes("validation_normalized_item_missing"),
  );

  const noHash = thaw(validation_result);
  noHash.item_hash = null;
  assert.ok(
    verifyAbsenceStewardQueueItem({ queue_item, validation_result: noHash }, { now_iso: NOW_ISO })
      .blocked_by.includes("validation_item_hash_missing"),
  );
});

test("tampered raw item, tampered normalized_item, tampered item_hash all reject as laundering", () => {
  const { queue_item, validation_result } = validatedPair();

  // Raw item drifted after validation (summary changed + hash recomputed).
  const drifted = validItem({ proposed_action_summary: "push everything quietly" });
  const r1 = verifyAbsenceStewardQueueItem(
    { queue_item: drifted, validation_result: thaw(validation_result) },
    { now_iso: NOW_ISO },
  );
  assert.equal(r1.valid, false);
  assert.ok(
    r1.blocked_by.includes("validation_item_hash_mismatch") ||
      r1.blocked_by.includes("normalized_item_mismatch"),
  );
  assert.ok(r1.blocked_by.includes("launder_attempt_detected"));

  // validation_result body edited.
  const editedBody = thaw(validation_result);
  editedBody.normalized_item.proposed_action_summary = "something else";
  const r2 = verifyAbsenceStewardQueueItem(
    { queue_item, validation_result: editedBody },
    { now_iso: NOW_ISO },
  );
  assert.equal(r2.valid, false);
  assert.ok(r2.blocked_by.includes("normalized_item_mismatch"));

  // validation_result hash forged.
  const forgedHash = thaw(validation_result);
  forgedHash.item_hash = "sha256:" + "0".repeat(64);
  const r3 = verifyAbsenceStewardQueueItem(
    { queue_item, validation_result: forgedHash },
    { now_iso: NOW_ISO },
  );
  assert.equal(r3.valid, false);
  assert.ok(r3.blocked_by.includes("validation_item_hash_mismatch"));
});

test("expiry flows through schema: expired PROPOSED rejects; honest EXPIRED_WITH_CONTRACT verifies", () => {
  const after = "2026-07-04T13:00:00.000Z";

  const staleProposed = verifyAbsenceStewardQueueItem(validatedPair(), { now_iso: after });
  assert.equal(staleProposed.valid, false);
  assert.ok(staleProposed.blocked_by.includes("queue_item_invalid"));

  const honest = validatedPair({ status: "EXPIRED_WITH_CONTRACT" }, after);
  const report = verifyAbsenceStewardQueueItem(honest, { now_iso: after });
  assert.equal(report.valid, true, report.blocked_by.join(","));
});

test("hot boundary inside validation_result rejects", () => {
  const { queue_item, validation_result } = validatedPair();
  const hot = thaw(validation_result);
  hot.boundary.self_approved = true;
  const report = verifyAbsenceStewardQueueItem(
    { queue_item, validation_result: hot },
    { now_iso: NOW_ISO },
  );
  assert.equal(report.valid, false);
  assert.ok(report.blocked_by.includes("validation_boundary_not_all_false"));
});

test("F5 regression: empty / junk validation_result boundary rejects (not vacuously all-false)", () => {
  const { queue_item, validation_result } = validatedPair();
  for (const bad of [{}, { junk_key: false }]) {
    const forged = { ...thaw(validation_result), boundary: bad };
    const report = verifyAbsenceStewardQueueItem(
      { queue_item, validation_result: forged },
      { now_iso: NOW_ISO },
    );
    assert.equal(report.valid, false, JSON.stringify(bad));
    assert.ok(report.blocked_by.includes("validation_boundary_not_all_false"), JSON.stringify(bad));
  }
});

test("verify boundary is all false on every path", () => {
  const paths = [
    verifyAbsenceStewardQueueItem(validatedPair(), { now_iso: NOW_ISO }),
    verifyAbsenceStewardQueueItem(null, { now_iso: NOW_ISO }),
    verifyAbsenceStewardQueueItem(
      { queue_item: validItem({ status: "DONE" }), validation_result: {} },
      { now_iso: NOW_ISO },
    ),
  ];
  for (const report of paths) {
    assert.deepEqual(report.boundary, absenceStewardQueueVerifyBoundary());
    assert.deepEqual(report.boundary, {
      queue_started: false,
      queue_runner_started: false,
      scheduler_started: false,
      daemon_started: false,
      task_executed: false,
      model_invoked: false,
      network_used: false,
      wallet_used: false,
      token_minted: false,
      public_urp_touched: false,
      auto_consent: false,
      self_approved: false,
    });
  }
});

test("kernel source stays pure: no fs / process / network / clock / random", () => {
  const source = readFileSync(
    new URL("../packages/core/src/absence-steward-queue-verify.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /node:fs|fs\/promises|node:net|node:http/);
  assert.doesNotMatch(source, /process\.env|process\.argv/);
  assert.doesNotMatch(source, /Date\.now|new Date\(\)|Math\.random/);
});
