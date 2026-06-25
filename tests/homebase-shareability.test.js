import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHomebaseShareability,
  HOMEBASE_SHAREABILITY_SCHEMA,
  HOMEBASE_SHAREABILITY_TRUTH_LABEL,
} from "../packages/core/src/homebase-shareability.js";
import {
  HOMEBASE_ASSET_AWARENESS_SCHEMA,
  HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
  buildHomebaseAssetAwareness,
} from "../packages/core/src/homebase-asset-awareness.js";
import { LOCAL_ASSET_INVENTORY_SCHEMA } from "../packages/core/src/local-asset-awareness.js";

const FIXED_NOW = "2026-06-25T12:00:00.000Z";

function fileRecord(relative_path, category, name) {
  return {
    record_id: `id:${relative_path}`,
    kind: "file",
    name: name ?? relative_path.split("/").pop(),
    relative_path,
    extension: `.${relative_path.split(".").pop()}`,
    category,
    size_bytes: 100,
    mtime_iso: FIXED_NOW,
    risk_flags: [],
    content_hash: null,
    content_preview: null,
  };
}

function makeAwareness(records, extra = {}) {
  const inventory = {
    schema: LOCAL_ASSET_INVENTORY_SCHEMA,
    truth_label: "LOCAL_METADATA_MEASURED",
    valid: true,
    error: null,
    generated_at_iso: FIXED_NOW,
    root: { display: "/tmp/fix", path_hash: "sha256:fix", exists: true },
    limits: { max_depth: 2, max_entries: 5000, follow_symlinks: false },
    summary: {
      records_count: records.length,
      files_count: records.length,
      dirs_count: 0,
      symlinks_count: 0,
      denied_count: extra.denied?.length ?? 0,
      truncated: false,
    },
    categories: records.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {}),
    records,
    denied: extra.denied ?? [],
    warnings: [],
    boundary: { file_content_read: false, network_used: false },
  };
  return buildHomebaseAssetAwareness({ inventory });
}

test("schema, truth label, deterministic report_id", () => {
  const awareness = makeAwareness([
    fileRecord("app/package.json", "code_project", "package.json"),
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const a = buildHomebaseShareability({ awareness });
  const b = buildHomebaseShareability({ awareness });
  assert.equal(a.schema, HOMEBASE_SHAREABILITY_SCHEMA);
  assert.equal(a.truth_label, HOMEBASE_SHAREABILITY_TRUTH_LABEL);
  assert.equal(a.report_id, b.report_id);
  assert.equal(a.boundary.file_content_read, false);
  assert.equal(a.boundary.urp_submission_performed, false);
});

test("classifies code and receipt clusters with consent levels", () => {
  const awareness = makeAwareness([
    fileRecord("app/package.json", "code_project", "package.json"),
    fileRecord("proofs/receipt.json", "receipt_or_proof"),
  ]);
  const report = buildHomebaseShareability({ awareness });
  assert.equal(report.cluster_assessments.length, 2);
  const code = report.cluster_assessments.find((c) => c.top_level === "app");
  const proof = report.cluster_assessments.find((c) => c.top_level === "proofs");
  assert.equal(code.shareability_level, "shareable_with_consent");
  assert.equal(proof.consent_required, "explicit_typed_go");
  assert.equal(proof.urp_compatibility, "consent_gated");
});

test("blocks sensitive top-level names and media category", () => {
  const awareness = makeAwareness([
    fileRecord("family/photo.jpg", "media", "photo.jpg"),
    fileRecord("private-vault/note.txt", "document", "note.txt"),
  ]);
  const report = buildHomebaseShareability({ awareness });
  const family = report.cluster_assessments.find((c) => c.top_level === "family");
  const vault = report.cluster_assessments.find(
    (c) => c.top_level === "private-vault",
  );
  assert.equal(family.shareability_level, "blocked_do_not_share");
  assert.equal(vault.shareability_level, "blocked_do_not_share");
  assert.ok(report.shareability_summary.blocked_do_not_share.length >= 2);
});

test("shareability summary buckets and global do-not-share list", () => {
  const awareness = makeAwareness([
    fileRecord("oss/readme.md", "document", "readme.md"),
    fileRecord("models/model.gguf", "model_artifact", "model.gguf"),
  ]);
  const report = buildHomebaseShareability({ awareness });
  assert.ok(report.shareability_summary.global_do_not_share.includes("secrets_and_key_patterns"));
  assert.ok(report.shareability_summary.urp_compatible_later_preview.length >= 1);
  assert.ok(report.scores.shareability_score >= 0);
});

test("category rollup aggregates dominant levels", () => {
  const awareness = makeAwareness([
    fileRecord("a/x.js", "code_project", "x.js"),
    fileRecord("b/y.js", "code_project", "y.js"),
  ]);
  const report = buildHomebaseShareability({ awareness });
  const rollup = report.category_rollup.find((c) => c.category === "code_project");
  assert.equal(rollup.cluster_count, 2);
  assert.equal(rollup.dominant_shareability_level, "shareable_with_consent");
});

test("fails closed on invalid awareness", () => {
  const report = buildHomebaseShareability({
    awareness: { schema: "wrong" },
  });
  assert.equal(report.valid, false);
  assert.equal(report.error, "invalid_or_missing_asset_awareness");
});

test("risk flags lower shareability score", () => {
  const awareness = makeAwareness(
    [fileRecord("app/package.json", "code_project")],
    {
      denied: [
        {
          relative_path: ".env",
          reason: "secret_or_key_pattern",
        },
      ],
    },
  );
  const report = buildHomebaseShareability({ awareness });
  assert.ok(awareness.risk_flags.includes("secret_or_key_pattern_denied"));
  assert.ok(report.scores.risk_score > 0);
});
