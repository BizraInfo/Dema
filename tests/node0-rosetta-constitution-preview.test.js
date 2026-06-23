import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildNode0RosettaConstitutionPreview,
  verifyNode0RosettaConstitution,
  NODE0_ROSETTA_CONSTITUTION_PREVIEW_SCHEMA,
  NODE0_ROSETTA_CONSTITUTION_TRUTH_LABEL,
} from "../packages/core/src/node0-rosetta-constitution-preview.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;
const STATUS_ENUM = new Set([
  "IMPLEMENTED",
  "DECLARED",
  "DESIGNED_NOT_LIVE",
  "UNKNOWN",
]);

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const anchorExists = (p) => existsSync(REPO_ROOT + p);

function mutableCopy() {
  return JSON.parse(JSON.stringify(buildNode0RosettaConstitutionPreview()));
}

test("builds a frozen preview-only constitution with the canonical schema and label", () => {
  const map = buildNode0RosettaConstitutionPreview();

  assert.equal(map.schema, NODE0_ROSETTA_CONSTITUTION_PREVIEW_SCHEMA);
  assert.equal(
    map.schema,
    "bizra.dema.node0_rosetta_constitution_preview.v0.1",
  );
  assert.equal(map.truth_label, NODE0_ROSETTA_CONSTITUTION_TRUTH_LABEL);
  assert.equal(map.truth_label, "NODE0_ROSETTA_CONSTITUTION_PREVIEW_ONLY");
  assert.equal(map.mode, "preview_only");
  assert.match(map.constitution_hash, SHA256_HEX);

  assert.equal(Object.isFrozen(map), true);
  assert.equal(Object.isFrozen(map.rosetta), true);
  assert.equal(Object.isFrozen(map.rosetta[0]), true);
  assert.equal(Object.isFrozen(map.boundary), true);
  assert.equal(Object.isFrozen(map.rest_protection), true);
});

test("rosetta rows cross-walk Telescript <-> Dema <-> SYNAPSE-CORE with valid labels", () => {
  const map = buildNode0RosettaConstitutionPreview();

  assert.ok(map.rosetta.length >= 8);
  for (const row of map.rosetta) {
    for (const k of ["telescript", "dema_primitive", "synapse_core", "anchor_path", "status"]) {
      assert.equal(typeof row[k], "string", `${k} on ${row.telescript}`);
      assert.ok(row[k].length > 0, `${k} non-empty`);
    }
    assert.ok(STATUS_ENUM.has(row.status), `valid status: ${row.status}`);
  }

  const tele = map.rosetta.find((r) => r.telescript === "Telesphere");
  assert.ok(tele, "Telesphere row present");
  assert.equal(tele.status, "DESIGNED_NOT_LIVE");

  const ticket = map.rosetta.find((r) => r.telescript === "Ticket");
  assert.ok(ticket, "Ticket row present");
  assert.equal(ticket.status, "IMPLEMENTED");
});

test("capability ledger carries the named components with honest, not-overclaimed labels", () => {
  const map = buildNode0RosettaConstitutionPreview();
  const byCap = new Map(map.capability_ledger.map((c) => [c.capability_key, c]));

  // every ledger entry well-formed
  for (const c of map.capability_ledger) {
    assert.ok(STATUS_ENUM.has(c.status), `valid status: ${c.status}`);
    assert.equal(typeof c.anchor_path, "string");
    assert.ok(c.anchor_path.length > 0);
  }

  // the components the operator asked to "integrate" exist only as previews
  for (const key of ["mcp", "a2a", "amana_smart_contract", "snr_engine", "rsi_metric", "shoulder_of_giants"]) {
    assert.ok(byCap.has(key), `ledger has ${key}`);
    assert.notEqual(byCap.get(key).status, "IMPLEMENTED", `${key} must not be overclaimed live`);
  }

  // the autopoietic / autonomous self-modification loop is explicitly NOT live
  assert.equal(byCap.get("autopoietic_loop").status, "DESIGNED_NOT_LIVE");

  // the spine is genuinely implemented
  assert.equal(byCap.get("zero_dependency_invariant").status, "IMPLEMENTED");
  assert.equal(byCap.get("cryptographic_consent_proof").status, "IMPLEMENTED");
});

test("PHANTOM-FILE GUARD: verify passes only when every IMPLEMENTED/DECLARED anchor exists on disk", () => {
  const map = buildNode0RosettaConstitutionPreview();
  const result = verifyNode0RosettaConstitution(map, { anchorExists });

  assert.equal(result.valid, true, JSON.stringify(result.blocked_by));
  assert.deepEqual(result.blocked_by, []);
});

test("fails closed when an IMPLEMENTED anchor does not exist (phantom anchor)", () => {
  const tampered = mutableCopy();
  tampered.capability_ledger.push({
    capability_key: "phantom",
    capability: "A phantom capability",
    status: "IMPLEMENTED",
    anchor_path: "packages/core/src/THIS_FILE_DOES_NOT_EXIST.js",
    anchor_detail: "",
    evidence_ref: "",
  });

  const result = verifyNode0RosettaConstitution(tampered, { anchorExists });
  assert.equal(result.valid, false);
  assert.ok(
    result.blocked_by.some((b) => b.includes("anchor_missing") && b.includes("phantom")),
    JSON.stringify(result.blocked_by),
  );
});

test("fails closed when anchorExists is not supplied (never silently skips the bind)", () => {
  const map = buildNode0RosettaConstitutionPreview();
  const result = verifyNode0RosettaConstitution(map, {});
  assert.equal(result.valid, false);
  assert.ok(result.blocked_by.includes("anchor_existence_unverified"));
});

test("boundary is entirely false and tampering it fails closed", () => {
  const map = buildNode0RosettaConstitutionPreview();
  for (const [k, v] of Object.entries(map.boundary)) {
    assert.equal(v, false, `boundary.${k} must be false`);
  }

  const tampered = mutableCopy();
  tampered.boundary.federation = true;
  const result = verifyNode0RosettaConstitution(tampered, { anchorExists });
  assert.equal(result.valid, false);
  assert.ok(result.blocked_by.some((b) => b.includes("boundary_not_false")));
});

test("rest-protection autonomy_coverage shows its math and is bounded [0,1]", () => {
  const map = buildNode0RosettaConstitutionPreview();
  const rp = map.rest_protection;

  assert.equal(rp.metric, "autonomy_coverage");
  assert.equal(rp.definition_status, "IMPLEMENTED");
  assert.equal(rp.live_measurement_status, "DESIGNED_NOT_LIVE");
  assert.ok(Array.isArray(rp.action_classes) && rp.action_classes.length > 0);

  const autonomous = rp.action_classes.filter((a) => a.autonomous === true).length;
  assert.equal(rp.autonomous_count, autonomous);
  assert.equal(rp.total_count, rp.action_classes.length);
  assert.equal(rp.autonomy_coverage, autonomous / rp.action_classes.length);
  assert.ok(rp.autonomy_coverage >= 0 && rp.autonomy_coverage <= 1);

  const tampered = mutableCopy();
  tampered.rest_protection.autonomy_coverage = 1.0;
  const result = verifyNode0RosettaConstitution(tampered, { anchorExists });
  assert.equal(result.valid, false);
  assert.ok(result.blocked_by.some((b) => b.includes("autonomy_coverage_mismatch")));
});

test("cross-links the unchanged external-pattern-registry, and status_summary recomputes", () => {
  const map = buildNode0RosettaConstitutionPreview();

  assert.equal(
    map.cross_ref.external_pattern_registry.anchor_path,
    "packages/core/src/external-pattern-registry-preview.js",
  );
  assert.equal(
    map.cross_ref.external_pattern_registry.schema,
    "bizra.dema.external_pattern_registry_preview.v0.1",
  );
  assert.equal(anchorExists(map.cross_ref.external_pattern_registry.anchor_path), true);

  const recomputed = { IMPLEMENTED: 0, DECLARED: 0, DESIGNED_NOT_LIVE: 0, UNKNOWN: 0 };
  for (const c of map.capability_ledger) recomputed[c.status] += 1;
  assert.deepEqual(map.status_summary, recomputed);

  const tampered = mutableCopy();
  tampered.status_summary.IMPLEMENTED += 5;
  const result = verifyNode0RosettaConstitution(tampered, { anchorExists });
  assert.equal(result.valid, false);
  assert.ok(result.blocked_by.some((b) => b.includes("status_summary_mismatch")));
});

test("output is deterministic and fails closed on an invalid status enum", () => {
  assert.deepEqual(
    buildNode0RosettaConstitutionPreview(),
    buildNode0RosettaConstitutionPreview(),
  );

  const tampered = mutableCopy();
  tampered.capability_ledger[0].status = "TRUST_ME";
  const result = verifyNode0RosettaConstitution(tampered, { anchorExists });
  assert.equal(result.valid, false);
  assert.ok(result.blocked_by.some((b) => b.includes("status_invalid")));
});

test("module stays pure: no fs, network, process execution, clock, or randomness", async () => {
  const src = await readFile(
    new URL(
      "../packages/core/src/node0-rosetta-constitution-preview.js",
      import.meta.url,
    ),
    "utf8",
  );

  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process|os|worker_threads)\b/);
  assert.doesNotMatch(src, /\bDate\.now\b|\bnew Date\b|\bMath\.random\b/);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bimport\s*\(/);
});
