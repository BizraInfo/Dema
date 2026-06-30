import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0QualityEvidenceCard,
  buildCoverageField,
  formatNode0QualityEvidenceCard,
  resolveP0KeyCustodyStatus,
  SELF_AUDIT_DISCLOSURE,
  NODE0_QUALITY_EVIDENCE_CARD_TRUTH_LABEL,
} from "../packages/core/src/node0-quality-evidence-card.js";
import {
  buildNode0QualityEvidenceCardSavePath,
  saveNode0QualityEvidenceCard,
} from "../packages/receipts/src/node0-quality-evidence-card-save.js";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("NQEC-01 includes self-audit disclosure and no production certification", () => {
  const card = buildNode0QualityEvidenceCard({
    closeout: {
      commit_sha: "abc123",
      tests_total: 10,
      tests_pass: 10,
      tests_fail: 0,
      check_pass: true,
      llm_guidance_pass: true,
      diff_check_clean: true,
    },
    zeroDependencyOk: true,
    generatedAt: "2026-06-30T00:00:00.000Z",
  });
  assert.equal(card.truth_label, NODE0_QUALITY_EVIDENCE_CARD_TRUTH_LABEL);
  assert.equal(card.self_audit_disclosure, SELF_AUDIT_DISCLOSURE);
  assert.equal(card.audit_position, "INTERNAL_SELF_AUDIT");
  assert.equal(card.external_audit_status, "NOT_PERFORMED");
  assert.equal(card.production_certification, false);
  assert.equal(card.no_mint, true);
  assert.match(card.scores_disclaimer, /No overall grade/);
});

test("NQEC-02 architecture scores are declared internal assessments", () => {
  const card = buildNode0QualityEvidenceCard();
  assert.equal(
    card.architecture_scores.design_architecture.truth_label,
    "DECLARED_INTERNAL_ASSESSMENT",
  );
  assert.equal(card.architecture_scores.design_architecture.score, 90);
  assert.equal(
    card.architecture_scores.measured_runtime_architecture.score,
    66,
  );
});

test("NQEC-03 coverage advisory is not threshold-bound proof", () => {
  const field = buildCoverageField({
    lines: 92.53,
    branches: 77.3,
    functions: 95.61,
    threshold_enforced: false,
  });
  assert.equal(field.status, "MEASURED_ADVISORY_NOT_THRESHOLD_BOUND");
  assert.equal(field.threshold_enforced, false);
  assert.equal(field.coverage_percent.lines, 92.53);
});

test("NQEC-04 coverage missing when not supplied", () => {
  const field = buildCoverageField(null);
  assert.equal(field.coverage_percent, null);
  assert.equal(field.status, "MISSING_LOAD_BEARING_FIELD");
});

test("NQEC-05 P0 key custody open unless rotation receipt exists", () => {
  const open = resolveP0KeyCustodyStatus(null);
  assert.equal(open.status, "OPEN_UNTIL_ROTATION_RECEIPT_EXISTS");
  assert.equal(open.rotation_receipt, null);
  const closed = resolveP0KeyCustodyStatus("/tmp/key-rotation-abc.json");
  assert.equal(closed.status, "CLOSED_ROTATION_RECEIPT_PRESENT");
  assert.equal(closed.rotation_receipt.path, "/tmp/key-rotation-abc.json");
});

test("NQEC-06 card seals under DEMA_HOME with no_mint gate", async () => {
  const card = buildNode0QualityEvidenceCard({
    closeout: {
      commit_sha: "deadbeef",
      tests_total: 1,
      tests_pass: 1,
      tests_fail: 0,
      check_pass: true,
      llm_guidance_pass: true,
      diff_check_clean: true,
    },
    zeroDependencyOk: true,
    generatedAt: "2026-06-30T00:00:00.000Z",
  });
  const demaHome = await mkdtemp(join(tmpdir(), "dema-nqec-"));
  try {
    const saved = await saveNode0QualityEvidenceCard(card, { demaHome });
    assert.equal(saved.saved, true);
    assert.equal(saved.no_mint, true);
    const built = buildNode0QualityEvidenceCardSavePath(card, { demaHome });
    assert.match(built.sha256, /^[a-f0-9]{64}$/);
  } finally {
    await rm(demaHome, { recursive: true, force: true });
  }
});

test("NQEC-07 formatter renders disclosure and comparison class", () => {
  const card = buildNode0QualityEvidenceCard({
    closeout: {
      commit_sha: "abc",
      tests_total: 1,
      tests_pass: 1,
      tests_fail: 0,
      check_pass: true,
      llm_guidance_pass: true,
      diff_check_clean: true,
    },
  });
  const text = formatNode0QualityEvidenceCard(card);
  assert.match(text, /NOT CERTIFICATION/);
  assert.match(text, /local-alpha AI tooling/);
});
