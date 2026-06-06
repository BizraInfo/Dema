import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildCorpusScorecardReceiptSchemaPreview,
  CORPUS_SCORECARD_RECEIPT_SCHEMA_PREVIEW_SCHEMA,
} from "../packages/core/src/corpus-scorecard-receipt-schema-preview.js";

const modulePath = new URL(
  "../packages/core/src/corpus-scorecard-receipt-schema-preview.js",
  import.meta.url,
);
const cliPath = new URL("../apps/cli/src/index.js", import.meta.url);

test("buildCorpusScorecardReceiptSchemaPreview emits a schema-only receipt field contract", () => {
  const preview = buildCorpusScorecardReceiptSchemaPreview();
  const ids = preview.field_slots.map((field) => field.field_id);

  assert.equal(preview.schema, CORPUS_SCORECARD_RECEIPT_SCHEMA_PREVIEW_SCHEMA);
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.verdict, "PREVIEW_RECEIPT_SCHEMA_READY");
  assert.equal(preview.receipt_state, "schema_only_not_minted");
  assert.equal(preview.summary.total_fields, 11);
  assert.equal(preview.summary.required_field_count, 5);
  assert.equal(preview.summary.future_hash_field_count, 5);
  assert.equal(preview.summary.computed_field_count, 0);
  assert.deepEqual(ids, [
    "schema",
    "producer",
    "scorecard_schema",
    "metric_set_hash",
    "gold_label_set_hash",
    "sanitized_candidate_set_hash",
    "proof_of_truth_axes",
    "measurement_summary",
    "boundary",
    "prev_receipt_hash",
    "seal",
  ]);
});

test("future hash and seal fields stay uncomputed", () => {
  const preview = buildCorpusScorecardReceiptSchemaPreview();
  const hashFields = preview.field_slots.filter(
    (field) => field.value_kind === "future_hash",
  );

  assert.equal(hashFields.length, 5);
  for (const field of hashFields) {
    assert.equal(field.source_state, "not_computed");
    assert.equal(field.computation_state, "not_computed");
  }
  assert.equal(
    preview.self_proactive_harness.gates.find(
      (gate) => gate.gate === "no_hash_or_seal_computation",
    ).pass,
    true,
  );

  const invalid = buildCorpusScorecardReceiptSchemaPreview({
    fields: [
      {
        field_id: "schema",
        value_kind: "constant_identifier",
        required: true,
        source_state: "declared_schema_value",
      },
      {
        field_id: "producer",
        value_kind: "constant_identifier",
        required: true,
        source_state: "declared_producer_value",
      },
      {
        field_id: "scorecard_schema",
        value_kind: "schema_ref",
        required: true,
        source_state: "declared_schema_value",
      },
      {
        field_id: "boundary",
        value_kind: "boundary_flags",
        required: true,
        source_state: "declared_no_side_effects",
      },
      {
        field_id: "seal",
        value_kind: "future_hash",
        required: true,
        source_state: "computed",
      },
    ],
  });

  assert.equal(invalid.verdict, "PREVIEW_REJECT");
  assert.equal(invalid.reason, "hash_fields_must_remain_uncomputed");
});

test("required receipt fields are enforced", () => {
  const missing = buildCorpusScorecardReceiptSchemaPreview({
    fields: [
      {
        field_id: "schema",
        value_kind: "constant_identifier",
        required: true,
        source_state: "declared_schema_value",
      },
      {
        field_id: "producer",
        value_kind: "constant_identifier",
        required: true,
        source_state: "declared_producer_value",
      },
      {
        field_id: "seal",
        value_kind: "future_hash",
        required: true,
        source_state: "not_computed",
      },
    ],
  });
  const mismatch = buildCorpusScorecardReceiptSchemaPreview({
    fields: [
      {
        field_id: "schema",
        value_kind: "constant_identifier",
        required: false,
        source_state: "declared_schema_value",
      },
    ],
  });

  assert.equal(missing.reason, "required_field_missing");
  assert.equal(mismatch.reason, "field_required_flag_mismatch");
});

test("ownership is provenance and not receipt mint consent", () => {
  const preview = buildCorpusScorecardReceiptSchemaPreview();

  assert.equal(preview.ownership_scope.declared_operator_owner, "mumu");
  assert.equal(preview.ownership_scope.local_product_face, "dema");
  assert.equal(preview.ownership_scope.governed_boundary, "node0");
  assert.equal(preview.micro_consent.operator_declared_space_owner, true);
  assert.equal(preview.micro_consent.ownership_is_processing_consent, false);
  assert.equal(preview.micro_consent.hash_computation_authorized, false);
  assert.equal(preview.micro_consent.receipt_mint_authorized, false);
  assert.equal(preview.micro_consent.receipt_persistence_authorized, false);
});

test("malformed receipt fields fail closed without echoing raw content or scores", () => {
  const secretText = "raw-receipt-score-should-not-appear";
  const raw = buildCorpusScorecardReceiptSchemaPreview({
    fields: [
      {
        field_id: "schema",
        value_kind: "constant_identifier",
        required: true,
        source_state: "declared_schema_value",
        metadata: { score: secretText },
      },
    ],
  });
  const unknown = buildCorpusScorecardReceiptSchemaPreview({
    fields: [
      {
        field_id: "unknown_field",
        value_kind: "constant_identifier",
        required: false,
        source_state: "declared_schema_value",
      },
    ],
  });

  assert.equal(raw.verdict, "PREVIEW_REJECT");
  assert.equal(raw.reason, "field_must_not_include_raw_content_or_scores");
  assert.doesNotMatch(
    JSON.stringify(raw),
    /raw-receipt-score-should-not-appear/,
  );
  assert.equal(unknown.reason, "field_id_not_allowlisted");
});

test("preview emits self-proactive harness, self-critique, micro-compliance, and analogical model", () => {
  const preview = buildCorpusScorecardReceiptSchemaPreview();

  assert.equal(
    preview.self_proactive_harness.mode,
    "DETERMINISTIC_SCORECARD_RECEIPT_SCHEMA_PREVIEW",
  );
  assert.equal(
    preview.self_proactive_harness.recommended_micro_action,
    "hold_until_authorized_scorecard_measurement_preview",
  );
  assert.equal(preview.self_critique.confidence, "bounded_preview");
  assert.equal(preview.micro_compliance.schema_only, true);
  assert.equal(preview.micro_compliance.no_receipt_minted, true);
  assert.equal(preview.micro_compliance.no_hashes_computed, true);
  assert.equal(preview.micro_compliance.no_scores_computed, true);
  assert.equal(preview.micro_compliance.no_benchmark_execution, true);
  assert.equal(
    preview.analogical_model.model,
    "receipt_form_not_receipt_issued",
  );
});

test("preview keeps every authority and data movement boundary false", () => {
  const preview = buildCorpusScorecardReceiptSchemaPreview();
  const expectedFalseBoundaries = [
    "raw_content_ingested",
    "raw_content_opened",
    "manual_review_executed",
    "benchmark_executed",
    "scores_computed",
    "hashes_computed",
    "signature_created",
    "receipt_minted",
    "receipt_persisted",
    "local_model_called",
    "embeddings_created",
    "fine_tune_started",
    "dpo_or_rlhf_started",
    "external_upload_performed",
    "runtime_memory_mutated",
    "dataset_written",
    "node_sharing_performed",
    "filesystem_write_performed",
    "network_called",
    "runtime_started",
    "federation_started",
    "step7_mint_attempted",
  ];

  for (const key of expectedFalseBoundaries) {
    assert.equal(preview.boundary[key], false, `${key} must remain false`);
  }
});

test("preview is deterministic, deeply frozen, and returns fresh objects", () => {
  const first = buildCorpusScorecardReceiptSchemaPreview();
  const second = buildCorpusScorecardReceiptSchemaPreview();

  assert.deepEqual(first, second);
  assert.notEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.field_slots), true);
  assert.equal(Object.isFrozen(first.field_slots[0]), true);
  assert.throws(() => {
    first.field_slots[0].source_state = "changed";
  }, TypeError);
  assert.throws(() => {
    first.boundary.receipt_minted = true;
  }, TypeError);
});

test("corpus scorecard receipt schema preview has no CLI wiring", async () => {
  const cliSource = await readFile(cliPath, "utf8");

  assert.doesNotMatch(cliSource, /corpus-scorecard-receipt-schema-preview/);
  assert.doesNotMatch(cliSource, /corpus_scorecard_receipt_schema_preview/);
  assert.doesNotMatch(cliSource, /scorecard receipt schema/i);
});

test("corpus scorecard receipt schema preview module has no runtime, network, filesystem, or randomness side effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /from\s+["']node:(net|dgram|http|https|tls|dns|worker_threads|vm|child_process|fs)["']/,
  );
  assert.doesNotMatch(
    source,
    /\b(fetch|WebSocket|exec|execFile|spawn|spawnSync)\b/,
  );
  assert.doesNotMatch(
    source,
    /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream)\b/,
  );
  assert.doesNotMatch(
    source,
    /\b(Date\.now|Math\.random|crypto\.random|process\.hrtime|performance\.now)\b/,
  );
});
