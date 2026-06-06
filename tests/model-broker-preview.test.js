import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildModelBrokerPreview,
  routeForTask,
  brokerRouteOnce,
  BROKER_ROLES,
  BROKER_SIZE_CLASSES,
  BROKER_CANON_REFS,
  LOCAL_MODEL_ROUTE_RECEIPT_SCHEMA,
} from "../packages/models/src/model-broker-preview.js";

// Reusable mixed registry: includes one of each interesting case
// (disabled, remote, unknown-status, local active, source_pending).
function sampleRegistry() {
  return [
    {
      id: "dema-face-gemma3-32b",
      provider: "ollama",
      model_name: "gemma3:32b",
      role: "dema_face",
      size_class: "32B",
      locality: "local",
      allowed_tasks: ["synthesis", "summarization"],
      max_concurrency: 1,
      context_limit: 32768,
      status: "active",
    },
    {
      id: "pat-worker-qwen-7b",
      provider: "ollama",
      model_name: "qwen2.5:7b",
      role: "pat_worker",
      size_class: "7B",
      locality: "local",
      allowed_tasks: ["planning", "research", "code_help"],
      max_concurrency: 2,
      context_limit: 16384,
      status: "active",
    },
    {
      id: "sat-validator-qwen-4b",
      provider: "ollama",
      model_name: "qwen2.5:4b",
      role: "sat_validator",
      size_class: "4B",
      locality: "local",
      allowed_tasks: ["claim_review", "safety_review"],
      max_concurrency: 1,
      context_limit: 8192,
      status: "active",
    },
    {
      id: "classifier-phi-3b",
      provider: "ollama",
      model_name: "phi3:3b",
      role: "classifier",
      size_class: "3B",
      locality: "local",
      allowed_tasks: ["intent_classify", "route"],
      max_concurrency: 4,
      context_limit: 4096,
      status: "active",
    },
    {
      id: "consent-detector-gemma-2b",
      provider: "ollama",
      model_name: "gemma3:2b",
      role: "consent_detector",
      size_class: "2B",
      locality: "local",
      allowed_tasks: ["consent_detect"],
      max_concurrency: 8,
      context_limit: 4096,
      status: "active",
    },
    {
      id: "remote-cloud-7b",
      provider: "openai",
      model_name: "remote-7b",
      role: "pat_worker",
      size_class: "7B",
      locality: "remote",
      allowed_tasks: ["planning"],
      max_concurrency: 8,
      context_limit: 128000,
      status: "active",
    },
    {
      id: "disabled-llama-4b",
      provider: "lm_studio",
      model_name: "llama-4b",
      role: "pat_worker",
      size_class: "4B",
      locality: "local",
      allowed_tasks: ["planning"],
      max_concurrency: 1,
      context_limit: 8192,
      status: "disabled",
    },
    {
      id: "unknown-status-mystery-7b",
      provider: "downloads",
      model_name: "mystery-7b",
      role: "pat_worker",
      size_class: "7B",
      locality: "unknown",
      allowed_tasks: [],
      max_concurrency: 1,
      context_limit: null,
      status: "active",
    },
  ];
}

test("buildModelBrokerPreview returns broker with frozen role/size taxonomies + zero-effect boundary", () => {
  const broker = buildModelBrokerPreview({ registry: sampleRegistry() });
  assert.equal(broker.schema, "bizra.dema.local_model_broker_preview.v0.1");
  assert.equal(broker.mode, "PREVIEW_ONLY");
  assert.deepEqual(broker.roles, Array.from(BROKER_ROLES));
  assert.deepEqual(broker.size_classes, Array.from(BROKER_SIZE_CLASSES));
  // Boundary declares no runtime / model / network / federation / mint /
  // token / urp effects — broker is declarative only.
  assert.equal(broker.boundary.runtime, false);
  assert.equal(broker.boundary.model_invocation, false);
  assert.equal(broker.boundary.network_used, false);
  assert.equal(broker.boundary.federation, false);
  assert.equal(broker.boundary.mint, false);
  assert.equal(broker.boundary.token_economy, false);
  assert.equal(broker.boundary.urp_networking, false);
  assert.equal(broker.boundary.prompt_invocation_allowed, false);
  // Frozen at multiple depths.
  assert.equal(Object.isFrozen(broker), true);
  assert.equal(Object.isFrozen(broker.registry), true);
  assert.equal(Object.isFrozen(broker.boundary), true);
});

test("routeForTask selects Dema face model for synthesis task", () => {
  const broker = buildModelBrokerPreview({ registry: sampleRegistry() });
  const receipt = routeForTask(broker, { task_kind: "synthesis" });
  assert.equal(receipt.schema, LOCAL_MODEL_ROUTE_RECEIPT_SCHEMA);
  assert.equal(receipt.selected_model_id, "dema-face-gemma3-32b");
  assert.equal(receipt.selected_model_role, "dema_face");
  assert.equal(receipt.selected_model_locality, "local");
  assert.match(receipt.reason, /matched_preferred_role_dema_face/);
});

test("routeForTask selects PAT worker for planning task", () => {
  const broker = buildModelBrokerPreview({ registry: sampleRegistry() });
  const receipt = routeForTask(broker, { task_kind: "planning" });
  assert.equal(receipt.selected_model_id, "pat-worker-qwen-7b");
  assert.equal(receipt.selected_model_role, "pat_worker");
  assert.match(receipt.reason, /matched_preferred_role_pat_worker/);
});

test("routeForTask selects sat_validator or claim_checker for claim_review task", () => {
  const broker = buildModelBrokerPreview({ registry: sampleRegistry() });
  const receipt = routeForTask(broker, { task_kind: "claim_review" });
  assert.ok(
    ["sat_validator", "claim_checker"].includes(receipt.selected_model_role),
    `Expected sat_validator or claim_checker, got ${receipt.selected_model_role}`,
  );
  // Specifically: sat_validator should be preferred when present.
  assert.equal(receipt.selected_model_id, "sat-validator-qwen-4b");
});

test("local_only=true rejects remote models with explicit reason", () => {
  // Registry with ONLY a remote model — local_only must reject it.
  const remoteOnlyRegistry = [
    {
      id: "remote-only-pat",
      provider: "openai",
      model_name: "remote-pat",
      role: "pat_worker",
      size_class: "7B",
      locality: "remote",
      allowed_tasks: ["planning"],
      max_concurrency: 8,
      context_limit: 128000,
      status: "active",
    },
  ];
  const broker = buildModelBrokerPreview({ registry: remoteOnlyRegistry });
  const receipt = routeForTask(broker, {
    task_kind: "planning",
    local_only: true,
  });
  assert.equal(receipt.selected_model_id, null);
  assert.equal(receipt.reason, "no_acceptable_candidate");
  assert.equal(receipt.rejected_candidates.length, 1);
  assert.equal(receipt.rejected_candidates[0].model_id, "remote-only-pat");
  assert.match(
    receipt.rejected_candidates[0].reason,
    /locality_remote_under_local_only/,
  );
});

test("disabled model is never selected", () => {
  const disabledOnly = [
    {
      id: "disabled-pat",
      provider: "lm_studio",
      model_name: "disabled-pat",
      role: "pat_worker",
      size_class: "4B",
      locality: "local",
      allowed_tasks: ["planning"],
      max_concurrency: 1,
      context_limit: 8192,
      status: "disabled",
    },
  ];
  const broker = buildModelBrokerPreview({ registry: disabledOnly });
  const receipt = routeForTask(broker, { task_kind: "planning" });
  assert.equal(receipt.selected_model_id, null);
  assert.equal(receipt.rejected_candidates[0].reason, "status_disabled");
});

test("unknown-locality model requires explicit allow_unknown=true to be selected", () => {
  const unknownOnly = [
    {
      id: "unknown-pat",
      provider: "downloads",
      model_name: "mystery-pat",
      role: "pat_worker",
      size_class: "7B",
      locality: "unknown",
      allowed_tasks: ["planning"],
      max_concurrency: 1,
      context_limit: null,
      status: "active",
    },
  ];
  const broker = buildModelBrokerPreview({ registry: unknownOnly });

  // Without allow_unknown: rejected because locality=unknown under local_only.
  const rejectedReceipt = routeForTask(broker, {
    task_kind: "planning",
    local_only: true,
  });
  assert.equal(rejectedReceipt.selected_model_id, null);
  assert.match(
    rejectedReceipt.rejected_candidates[0].reason,
    /locality_unknown_under_local_only/,
  );

  // With local_only=false AND allow_unknown=true → could still be rejected
  // because locality is unknown (not local). Disable local_only and allow
  // unknown explicitly: the model becomes selectable.
  const allowedReceipt = routeForTask(broker, {
    task_kind: "planning",
    local_only: false,
    allow_unknown: true,
  });
  assert.equal(allowedReceipt.selected_model_id, "unknown-pat");
  assert.ok(
    allowedReceipt.warnings.includes("local_only_disabled"),
    "warnings should record that local_only was disabled",
  );
  assert.ok(
    allowedReceipt.warnings.includes("allow_unknown_enabled"),
    "warnings should record that allow_unknown was enabled",
  );
});

test("route receipt contains schema, selected_model_id, canon refs, and warnings array", () => {
  const broker = buildModelBrokerPreview({ registry: sampleRegistry() });
  const receipt = routeForTask(broker, { task_kind: "synthesis" });

  // Schema is the architect-specified v0.1.
  assert.equal(receipt.schema, "bizra.dema.local_model_route_receipt.v0.1");

  // Required fields present.
  for (const field of [
    "timestamp",
    "task_kind",
    "required_role",
    "local_only",
    "selected_model_id",
    "selected_model_role",
    "selected_model_locality",
    "reason",
    "rejected_candidates",
    "canon_refs",
    "warnings",
    "boundary",
  ]) {
    assert.ok(field in receipt, `receipt missing required field: ${field}`);
  }

  // Timestamp is ISO 8601.
  assert.match(receipt.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

  // canon_refs lists all 4 architect-required references.
  for (const ref of BROKER_CANON_REFS) {
    assert.ok(receipt.canon_refs.includes(ref), `canon_refs missing ${ref}`);
  }

  // Receipt is deep-frozen.
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.boundary), true);
});

test("rejected candidates each include a reason string", () => {
  const broker = buildModelBrokerPreview({ registry: sampleRegistry() });
  // local_only + claim_review → many of the non-sat models get rejected
  // because they don't match the preferred sat_validator/claim_checker
  // roles. Some get rejected because they're remote/disabled/unknown.
  const receipt = routeForTask(broker, {
    task_kind: "claim_review",
    local_only: true,
  });
  assert.ok(receipt.rejected_candidates.length > 0, "expected some rejections");
  for (const r of receipt.rejected_candidates) {
    assert.equal(typeof r.model_id, "string");
    assert.equal(typeof r.reason, "string");
    assert.ok(
      r.reason.length > 0,
      `rejection for ${r.model_id} has empty reason`,
    );
  }
});

test("brokerRouteOnce convenience helper builds + routes in one call", () => {
  const receipt = brokerRouteOnce({
    registry: sampleRegistry(),
    task_kind: "consent_detect",
  });
  assert.equal(receipt.schema, LOCAL_MODEL_ROUTE_RECEIPT_SCHEMA);
  assert.equal(receipt.selected_model_id, "consent-detector-gemma-2b");
  assert.equal(receipt.selected_model_role, "consent_detector");
});

test("max_size_class constraint rejects oversized candidates", () => {
  const broker = buildModelBrokerPreview({ registry: sampleRegistry() });
  // synthesis prefers dema_face (the 32B model). With max_size_class=7B,
  // the 32B Dema face is rejected — no fallback in sample registry has
  // dema_face role at <=7B, so selection should fail.
  const receipt = routeForTask(broker, {
    task_kind: "synthesis",
    required_role: "dema_face",
    max_size_class: "7B",
  });
  assert.equal(receipt.selected_model_id, null);
  // The dema_face candidate was rejected for size reasons (not role).
  const demaFaceRejection = receipt.rejected_candidates.find(
    (r) => r.model_id === "dema-face-gemma3-32b",
  );
  assert.ok(
    demaFaceRejection,
    "dema-face candidate should appear in rejected list",
  );
  assert.match(demaFaceRejection.reason, /size_class_32B_exceeds_max_7B/);
});
