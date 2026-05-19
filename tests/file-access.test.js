import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildFileAccessPreview,
  buildFileAccessSummary,
  buildFileOpRequest,
  FILE_ACCESS_OP_KINDS,
  FILE_ACCESS_REQUIRED_BLOCKED_EFFECTS
} from "../packages/core/src/file-access.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("File access canonical schema · op kinds = read/write/append/stat/list", () => {
  const p = buildFileAccessPreview();
  assert.equal(p.schema, "bizra.dema.file_access.v0.1");
  assert.deepEqual([...p.op_kinds_allowed], ["read", "write", "append", "stat", "list"]);
});

test("File access · forbidden_path_patterns include .env · .git · secrets · credentials", () => {
  const p = buildFileAccessPreview();
  const patterns = [...p.forbidden_path_patterns];
  assert.ok(patterns.some((s) => s.includes(".env")));
  assert.ok(patterns.some((s) => s.includes(".git")));
  assert.ok(patterns.some((s) => s.toLowerCase().includes("secrets")));
  assert.ok(patterns.some((s) => s.toLowerCase().includes("credentials")));
});

test("File access · boundary canonical · refusals enumerated", () => {
  const p = buildFileAccessPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(p.refusal_invariants.some((r) => r.includes("never touches paths outside declared scope_root")));
  assert.ok(p.refusal_invariants.some((r) => r.includes("never reads secrets/credentials/.env")));
});

test("File access · blocked_effects · outside-scope · secrets · execute · CI · git", () => {
  const p = buildFileAccessPreview();
  assert.ok(p.blocked_effects.includes("access_outside_declared_scope"));
  assert.ok(p.blocked_effects.includes("access_secrets_credentials_env"));
  assert.ok(p.blocked_effects.includes("execute_file_as_code"));
  assert.ok(p.blocked_effects.includes("modify_ci_workflows"));
  assert.ok(p.blocked_effects.includes("modify_git_internals"));
});

test("File op request · valid path within scope → valid", () => {
  const r = buildFileOpRequest({
    path: "packages/core/src/x.js",
    op_kind: "read",
    scope_root: "packages/core/",
    purpose: "verify file content"
  });
  assert.equal(r.valid, true);
  assert.equal(r.op_kind, "read");
  assert.equal(r.within_declared_scope, true);
  assert.equal(r.in_forbidden_zone, false);
  assert.match(r.consent_phrase, /^GO: read on path/);
});

test("File op request · .env path → forbidden", () => {
  const r = buildFileOpRequest({
    path: ".env",
    op_kind: "read",
    scope_root: ".",
    purpose: "test"
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.some((v) => v.includes("forbidden_path_pattern")));
});

test("File op request · .github/workflows/ path → forbidden", () => {
  const r = buildFileOpRequest({
    path: ".github/workflows/check.yml",
    op_kind: "write",
    scope_root: ".",
    purpose: "test"
  });
  assert.equal(r.valid, false);
  assert.ok(r.in_forbidden_zone, true);
});

test("File op request · path outside scope_root → invalid", () => {
  const r = buildFileOpRequest({
    path: "packages/other/x.js",
    op_kind: "read",
    scope_root: "packages/core/",
    purpose: "test"
  });
  assert.equal(r.valid, false);
  assert.equal(r.within_declared_scope, false);
  assert.ok(r.violations.some((v) => v.includes("path_outside_scope")));
});

test("File op request · missing scope_root → invalid", () => {
  const r = buildFileOpRequest({
    path: "x.js",
    op_kind: "read",
    purpose: "test"
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes("no_scope_root · scope must be declared"));
});

test("File op request · invalid op_kind coerced to 'read'", () => {
  const r = buildFileOpRequest({
    path: "packages/x.js",
    op_kind: "malicious_op",
    scope_root: "packages/",
    purpose: "test"
  });
  assert.equal(r.op_kind, "read");
});

test("File op request · path hash deterministic", () => {
  const r1 = buildFileOpRequest({
    path: "a.js", op_kind: "read", scope_root: ".", purpose: "x"
  });
  const r2 = buildFileOpRequest({
    path: "a.js", op_kind: "write", scope_root: ".", purpose: "y"
  });
  assert.equal(r1.path_hash, r2.path_hash);
});

test("File op request · deep frozen + canonical boundary", () => {
  const r = buildFileOpRequest({
    path: "x.js", op_kind: "read", scope_root: ".", purpose: "test"
  });
  assert.ok(Object.isFrozen(r));
  assert.ok(isCanonicalBoundary(r.boundary));
});

test("Summary + exports", () => {
  const s = buildFileAccessSummary({ declared_scope_root: "packages/" });
  assert.equal(s.declared_scope_root, "packages/");
  assert.ok(s.forbidden_pattern_count >= 5);
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(FILE_ACCESS_OP_KINDS));
  assert.ok(Object.isFrozen(FILE_ACCESS_REQUIRED_BLOCKED_EFFECTS));
});
