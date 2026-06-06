import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildExternalPatternRegistryPreview,
  EXTERNAL_PATTERN_REGISTRY_PREVIEW_SCHEMA,
} from "../packages/core/src/external-pattern-registry-preview.js";
import { buildBoundaryInvariantCheckReport } from "../scripts/review/boundary-invariant-check.mjs";

const modulePath = fileURLToPath(
  new URL(
    "../packages/core/src/external-pattern-registry-preview.js",
    import.meta.url,
  ),
);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("T-01 external pattern registry preview emits the canonical schema", () => {
  const preview = buildExternalPatternRegistryPreview();
  assert.equal(preview.schema, EXTERNAL_PATTERN_REGISTRY_PREVIEW_SCHEMA);
  assert.equal(
    preview.schema,
    "bizra.dema.external_pattern_registry_preview.v0.1",
  );
});

test("T-02 external pattern registry preview is PREVIEW_ONLY and DECLARED", () => {
  const preview = buildExternalPatternRegistryPreview();
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.truth_label, "DECLARED");
});

test("T-03 operating canon is exactly 7 lines", () => {
  const preview = buildExternalPatternRegistryPreview();
  assert.equal(preview.operating_canon.length, 7);
  assert.deepEqual(preview.operating_canon, [
    "Observe the giant.",
    "Extract the pattern.",
    "Translate into BIZRA primitive.",
    "Put behind consent + EffectCap.",
    "Record with EvidenceChain.",
    "Expose through DEMA UX.",
    "Only then allow use.",
  ]);
});

test("T-04 pattern set has 8-16 entries", () => {
  const preview = buildExternalPatternRegistryPreview();
  assert.ok(preview.pattern_count >= 8);
  assert.ok(preview.pattern_count <= 16);
  assert.equal(preview.patterns.length, preview.pattern_count);
});

test("T-05 every pattern has the required keys", () => {
  const preview = buildExternalPatternRegistryPreview();
  const REQUIRED_KEYS = [
    "source",
    "extracted_peak",
    "bizra_binding",
    "micro_consent_field_required",
    "sat_verdict_required",
    "evidence_schemas_required",
    "effects_declared",
    "effects_denied",
    "current_status",
    "blocked_by",
  ];
  for (const pattern of preview.patterns) {
    for (const key of REQUIRED_KEYS) {
      assert.ok(key in pattern, `pattern ${pattern.source} missing ${key}`);
    }
  }
});

test("T-06 every pattern's status is in the valid enum", () => {
  const preview = buildExternalPatternRegistryPreview();
  const VALID_STATUSES = new Set(["PLANNED", "PREVIEW", "BLOCKED"]);
  for (const pattern of preview.patterns) {
    assert.ok(
      VALID_STATUSES.has(pattern.current_status),
      `pattern ${pattern.source} has invalid status ${pattern.current_status}`,
    );
  }
});

test("T-07 zero patterns are LIVE", () => {
  const preview = buildExternalPatternRegistryPreview();
  const live = preview.patterns.filter((p) => p.current_status === "LIVE");
  assert.equal(live.length, 0);
});

test("T-08 every sat_verdict_required is in GateVerdict", () => {
  const preview = buildExternalPatternRegistryPreview();
  const VALID = new Set(["PERMIT", "REJECT", "REVIEW", "SCORE_ONLY"]);
  for (const pattern of preview.patterns) {
    assert.ok(
      VALID.has(pattern.sat_verdict_required),
      `pattern ${pattern.source} has invalid sat_verdict_required ${pattern.sat_verdict_required}`,
    );
  }
});

test("T-09 every micro_consent_field is in MICRO_CONSENT_SHAPE or null", () => {
  const preview = buildExternalPatternRegistryPreview();
  const VALID_FIELDS = new Set([
    "mission_id",
    "agent_id",
    "resource_id",
    "action",
    "purpose",
    "expires_at",
    "commitment_hash",
  ]);
  for (const pattern of preview.patterns) {
    const f = pattern.micro_consent_field_required;
    assert.ok(
      f === null || VALID_FIELDS.has(f),
      `pattern ${pattern.source} field ${f} not in MICRO_CONSENT_SHAPE`,
    );
  }
});

test("T-10 every effect is a valid OPERATION", () => {
  const preview = buildExternalPatternRegistryPreview();
  const VALID_OPS = new Set(["read", "write", "execute", "call"]);
  for (const pattern of preview.patterns) {
    for (const op of pattern.effects_declared) {
      assert.ok(
        VALID_OPS.has(op),
        `pattern ${pattern.source} declares invalid op ${op}`,
      );
    }
    for (const op of pattern.effects_denied) {
      assert.ok(
        VALID_OPS.has(op),
        `pattern ${pattern.source} denies invalid op ${op}`,
      );
    }
  }
});

test("T-11 no pattern declares an effect it also denies", () => {
  const preview = buildExternalPatternRegistryPreview();
  for (const pattern of preview.patterns) {
    const declared = new Set(pattern.effects_declared);
    for (const denied of pattern.effects_denied) {
      assert.ok(
        !declared.has(denied),
        `pattern ${pattern.source} both declares and denies ${denied}`,
      );
    }
  }
});

test("T-12 every on_disk_anchor exists at acceptance time", () => {
  const preview = buildExternalPatternRegistryPreview();
  for (const pattern of preview.patterns) {
    const path = join(repoRoot, pattern.bizra_binding.on_disk_anchor);
    assert.ok(
      existsSync(path),
      `anchor missing for ${pattern.source}: ${pattern.bizra_binding.on_disk_anchor}`,
    );
  }
});

test("T-13 boundary keeps every authority flag false", () => {
  const preview = buildExternalPatternRegistryPreview();
  for (const key of [
    "runtime",
    "federation",
    "mint",
    "node_connection",
    "economic_settlement",
    "raw_data_exchange",
    "authority_imported",
    "mcp_server_invoked",
    "a2a_network_call_made",
    "hook_executed",
    "automation_run",
    "contract_executed",
  ]) {
    assert.equal(preview.boundary[key], false, `boundary.${key} must be false`);
  }
});

test("T-14 deterministic and deeply frozen", () => {
  const a = buildExternalPatternRegistryPreview();
  const b = buildExternalPatternRegistryPreview();
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a));
  assert.ok(Object.isFrozen(a.boundary));
  assert.ok(Object.isFrozen(a.patterns));
  assert.ok(Object.isFrozen(a.patterns[0]));
});

test("T-15 fresh objects per call", () => {
  const a = buildExternalPatternRegistryPreview();
  const b = buildExternalPatternRegistryPreview();
  assert.notEqual(a, b);
  assert.notEqual(a.boundary, b.boundary);
  assert.notEqual(a.patterns, b.patterns);
});

test("T-16 module is pure (no fs/http/net/child_process imports)", async () => {
  const body = await readFile(modulePath, "utf8");
  assert.ok(!/from ['"]node:fs/.test(body), "module must not import node:fs");
  assert.ok(
    !/from ['"]node:http/.test(body),
    "module must not import node:http",
  );
  assert.ok(!/from ['"]node:net/.test(body), "module must not import node:net");
  assert.ok(
    !/from ['"]node:child_process/.test(body),
    "module must not import node:child_process",
  );
  assert.ok(
    !/spawn\(|execSync\(|execFile\(|spawnSync\(/.test(body),
    "module must not invoke processes",
  );
});

test("T-17 summary counts match status occurrences", () => {
  const preview = buildExternalPatternRegistryPreview();
  const expected = { PLANNED: 0, PREVIEW: 0, BLOCKED: 0 };
  for (const pattern of preview.patterns) {
    expected[pattern.current_status] += 1;
  }
  assert.deepEqual(preview.summary, expected);
});

test("T-18 boundary-invariant lint passes with the new module included", () => {
  const report = buildBoundaryInvariantCheckReport();
  assert.equal(report.ok, true);
  assert.ok(
    report.modules_scanned > 0,
    `expected at least 23 modules scanned, got ${report.modules_scanned}`,
  );
  assert.equal(report.modules_clean, report.modules_scanned);
});
