import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  ABSENCE_STEWARD_QUEUE_ITEM_SCHEMA,
  ABSENCE_STEWARD_QUEUE_VALIDATION_RESULT_SCHEMA,
  ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL,
  ABSENCE_STEWARD_QUEUE_ALLOWED_STATUSES,
  ABSENCE_STEWARD_QUEUE_FORBIDDEN_ACTION_CLASSES,
  validateAbsenceStewardQueueItem,
  absenceStewardQueueBoundary,
} from "../packages/core/src/absence-steward-queue-schema.js";

// ABSENCE-STEWARD-QUEUE-SCHEMA-1A — a queue item means PROPOSED. Queue
// membership means NOT consent. Approval means a future human decision.
// Execution is not in this track. The validator validates shape only.

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
    queue_item_id: "qitem-docs-refresh-0001",
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

test("valid PROPOSED item validates with deterministic hash", () => {
  const report = validateAbsenceStewardQueueItem(validItem(), { now_iso: NOW_ISO });
  assert.equal(report.valid, true, report.blocked_by.join(","));
  assert.equal(report.schema, ABSENCE_STEWARD_QUEUE_VALIDATION_RESULT_SCHEMA);
  assert.equal(report.truth_label, ABSENCE_STEWARD_QUEUE_SCHEMA_TRUTH_LABEL);
  assert.match(report.item_hash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(report.normalized_item);

  const again = validateAbsenceStewardQueueItem(validItem(), { now_iso: NOW_ISO });
  assert.equal(report.item_hash, again.item_hash);

  const changed = validateAbsenceStewardQueueItem(
    validItem({ proposed_action_summary: "a different proposal" }),
    { now_iso: NOW_ISO },
  );
  assert.notEqual(report.item_hash, changed.item_hash);
});

test("missing item / wrong schema / wrong truth label / unsafe id reject", () => {
  for (const bad of [null, undefined, [], "item"]) {
    const r = validateAbsenceStewardQueueItem(bad, { now_iso: NOW_ISO });
    assert.ok(r.blocked_by.includes("item_not_object"), String(bad));
  }
  const wrongSchema = validateAbsenceStewardQueueItem(
    validItem({ schema: "bizra.dema.other.v1" }),
    { now_iso: NOW_ISO },
  );
  assert.ok(wrongSchema.blocked_by.includes("schema_mismatch"));

  const wrongLabel = validateAbsenceStewardQueueItem(
    validItem({ truth_label: "QUEUE_LIVE" }),
    { now_iso: NOW_ISO },
  );
  assert.ok(wrongLabel.blocked_by.includes("truth_label_mismatch"));

  for (const evil of ["UPPER", "has space", "../up", "a/b", "dot.dot"]) {
    const r = validateAbsenceStewardQueueItem(
      validItem({ queue_item_id: evil }),
      { now_iso: NOW_ISO },
    );
    assert.ok(r.blocked_by.includes("queue_item_id_unsafe"), evil);
  }
});

test("forged queue_item_hash rejects", () => {
  const item = validItem();
  item.queue_item_hash = "sha256:" + "0".repeat(64);
  const r = validateAbsenceStewardQueueItem(item, { now_iso: NOW_ISO });
  assert.equal(r.valid, false);
  assert.ok(r.blocked_by.includes("queue_item_hash_mismatch"));
});

test("forbidden statuses reject; allowed statuses are exactly the five", () => {
  assert.deepEqual(
    [...ABSENCE_STEWARD_QUEUE_ALLOWED_STATUSES].sort(),
    ["EXPIRED_WITH_CONTRACT", "HUMAN_APPROVED", "HUMAN_REJECTED", "PROPOSED", "WITHDRAWN"],
  );
  for (const forbidden of ["EXECUTING", "DONE", "RUNNING", "STARTED", "COMPLETED", "AUTO_APPROVED"]) {
    const r = validateAbsenceStewardQueueItem(
      validItem({ status: forbidden }),
      { now_iso: NOW_ISO },
    );
    assert.equal(r.valid, false, forbidden);
    assert.ok(r.blocked_by.includes("status_not_allowed"), forbidden);
  }
});

test("human sovereignty flags: required_human_decision and return_review_requirement must be true", () => {
  const noHuman = validateAbsenceStewardQueueItem(
    validItem({ required_human_decision: false }),
    { now_iso: NOW_ISO },
  );
  assert.ok(noHuman.blocked_by.includes("required_human_decision_must_be_true"));

  const noReview = validateAbsenceStewardQueueItem(
    validItem({ return_review_requirement: false }),
    { now_iso: NOW_ISO },
  );
  assert.ok(noReview.blocked_by.includes("return_review_requirement_must_be_true"));
});

test("queue membership is never consent: consent-ish fields reject", () => {
  for (const field of ["consent_granted", "consent_by_membership", "approved_by_queue", "auto_consent"]) {
    const r = validateAbsenceStewardQueueItem(
      validItem({ [field]: true }),
      { now_iso: NOW_ISO },
    );
    assert.equal(r.valid, false, field);
    assert.ok(r.blocked_by.includes("consent_field_forbidden"), field);
  }
});

test("never-executable action classes reject even when proposed", () => {
  for (const cls of ABSENCE_STEWARD_QUEUE_FORBIDDEN_ACTION_CLASSES) {
    const r = validateAbsenceStewardQueueItem(
      validItem({ proposed_action_class: cls }),
      { now_iso: NOW_ISO },
    );
    assert.equal(r.valid, false, cls);
    assert.ok(r.blocked_by.includes("action_class_never_executable"), cls);
  }
});

test("action class listed in forbidden_by_contract rejects", () => {
  const r = validateAbsenceStewardQueueItem(
    validItem({
      proposed_action_class: "MODEL_ALLOWED",
      forbidden_by_contract: ["PUSH_ALLOWED", "MODEL_ALLOWED"],
    }),
    { now_iso: NOW_ISO },
  );
  assert.equal(r.valid, false);
  assert.ok(r.blocked_by.includes("action_class_forbidden_by_contract"));
});

test("window rules: bad timestamps, inverted window, missing now_iso reject", () => {
  const badTs = validateAbsenceStewardQueueItem(
    validItem({ expires_at: "someday" }),
    { now_iso: NOW_ISO },
  );
  assert.ok(badTs.blocked_by.includes("expires_at_invalid"));

  const inverted = validateAbsenceStewardQueueItem(
    validItem({ created_at: "2026-07-04T13:00:00.000Z" }),
    { now_iso: NOW_ISO },
  );
  assert.ok(inverted.blocked_by.includes("expires_not_after_created"));

  const noNow = validateAbsenceStewardQueueItem(validItem(), {});
  assert.ok(noNow.blocked_by.includes("now_iso_required"));
});

test("expiry vs status: expired PROPOSED rejects; EXPIRED_WITH_CONTRACT validates only after expiry", () => {
  const after = "2026-07-04T13:00:00.000Z";

  const staleProposed = validateAbsenceStewardQueueItem(validItem(), { now_iso: after });
  assert.equal(staleProposed.valid, false);
  assert.ok(staleProposed.blocked_by.includes("expired_item_must_carry_expired_status"));

  const honestExpired = validateAbsenceStewardQueueItem(
    validItem({ status: "EXPIRED_WITH_CONTRACT" }),
    { now_iso: after },
  );
  assert.equal(honestExpired.valid, true, honestExpired.blocked_by.join(","));

  const prematureExpired = validateAbsenceStewardQueueItem(
    validItem({ status: "EXPIRED_WITH_CONTRACT" }),
    { now_iso: NOW_ISO },
  );
  assert.equal(prematureExpired.valid, false);
  assert.ok(prematureExpired.blocked_by.includes("expired_status_before_expiry"));
});

test("any true boundary flag on the item rejects; result boundary always all false", () => {
  const hot = validItem();
  hot.boundary = { ...absenceStewardQueueBoundary(), task_executed: true };
  const rehashed = withHash(hot);
  const r = validateAbsenceStewardQueueItem(rehashed, { now_iso: NOW_ISO });
  assert.equal(r.valid, false);
  assert.ok(r.blocked_by.includes("boundary_not_all_false"));

  const paths = [
    validateAbsenceStewardQueueItem(validItem(), { now_iso: NOW_ISO }),
    validateAbsenceStewardQueueItem(null, { now_iso: NOW_ISO }),
    r,
  ];
  for (const report of paths) {
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

test("F5 regression: empty / key-omitting / partial boundary rejects (not vacuously all-false)", () => {
  const canonical = absenceStewardQueueBoundary();
  // canonical all-false passes
  assert.equal(validateAbsenceStewardQueueItem(validItem(), { now_iso: NOW_ISO }).valid, true);

  // boundary:{} — the old Object.values().every() passed this vacuously
  const empty = withHash({ ...validItem(), boundary: {} });
  const rEmpty = validateAbsenceStewardQueueItem(empty, { now_iso: NOW_ISO });
  assert.equal(rEmpty.valid, false);
  assert.ok(rEmpty.blocked_by.includes("boundary_not_all_false"));

  // boundary with a junk key (right count would still be wrong keys)
  const junk = withHash({ ...validItem(), boundary: { junk_key: false } });
  assert.ok(
    validateAbsenceStewardQueueItem(junk, { now_iso: NOW_ISO }).blocked_by.includes(
      "boundary_not_all_false",
    ),
  );

  // boundary missing exactly one canonical key
  const missingOne = { ...canonical };
  delete missingOne.self_approved;
  const partial = withHash({ ...validItem(), boundary: missingOne });
  assert.ok(
    validateAbsenceStewardQueueItem(partial, { now_iso: NOW_ISO }).blocked_by.includes(
      "boundary_not_all_false",
    ),
  );

  // boundary with an EXTRA key beyond canonical
  const extra = withHash({ ...validItem(), boundary: { ...canonical, extra_key: false } });
  assert.ok(
    validateAbsenceStewardQueueItem(extra, { now_iso: NOW_ISO }).blocked_by.includes(
      "boundary_not_all_false",
    ),
  );
});

test("kernel source stays pure: no fs / process / network / clock / random", () => {
  const source = readFileSync(
    new URL("../packages/core/src/absence-steward-queue-schema.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /node:fs|fs\/promises|node:net|node:http/);
  assert.doesNotMatch(source, /process\.env|process\.argv/);
  assert.doesNotMatch(source, /Date\.now|new Date\(\)|Math\.random/);
});
