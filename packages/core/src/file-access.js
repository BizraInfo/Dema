// C11 · Bounded local-file access (per ADR-008 §C11).
//
// PAT-3 (Code Apprentice) and similar agents read/write within declared
// boundary paths · per-operation receipt. NEVER touches paths outside
// declared scope · NEVER overwrites without consent.

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.file_access.v0.1";
const FILE_OP_REQUEST_SCHEMA = "bizra.dema.file_op_request.v0.1";

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "access_outside_declared_scope",
  "access_secrets_credentials_env",
  "execute_file_as_code",
  "modify_ci_workflows",
  "modify_git_internals",
  "overwrite_without_consent",
  "follow_symlink_outside_scope",
  "federation_invocation"
]);

const FORBIDDEN_PATH_PATTERNS = Object.freeze([
  /^\/etc\//,
  /^\/var\/lib\//,
  /\.git\//,
  /\.github\/workflows\//,
  /node_modules\//,
  /\.env(\..*)?$/,
  /credentials/i,
  /secrets/i,
  /private[_-]?key/i,
  /id_rsa/i,
  /\.ssh\//
]);

const OP_KINDS = Object.freeze(["read", "write", "append", "stat", "list"]);

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function sha256(input) {
  return createHash("sha256").update(String(input)).digest("hex");
}

function isPathInForbiddenZone(path) {
  if (typeof path !== "string") return true;
  return FORBIDDEN_PATH_PATTERNS.some((p) => p.test(path));
}

function isPathWithinScope(path, scopeRoot) {
  if (typeof path !== "string" || typeof scopeRoot !== "string" || scopeRoot.length === 0) return false;
  return path.startsWith(scopeRoot);
}

export function buildFileAccessPreview({ declared_scope_root = "" } = {}) {
  const scope = safeString(declared_scope_root);
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    declared_scope_root: scope,
    scope_declared: scope.length > 0,
    op_kinds_allowed: OP_KINDS,
    forbidden_path_patterns: Object.freeze(FORBIDDEN_PATH_PATTERNS.map(String)),
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    refusal_invariants: Object.freeze([
      "File access never touches paths outside declared scope_root",
      "File access never reads secrets/credentials/.env*",
      "File access never modifies .git/ or .github/workflows/",
      "File access never overwrites without per-write consent",
      "File access never follows symlinks outside scope"
    ]),
    boundary: buildPreviewBoundary()
  });
}

export function buildFileOpRequest({
  path = "",
  op_kind = "read",
  scope_root = "",
  purpose = "",
  size_estimate_bytes = 0
} = {}) {
  const pathSafe = safeString(path);
  const op = OP_KINDS.includes(op_kind) ? op_kind : "read";
  const scopeSafe = safeString(scope_root);
  const purposeSafe = safeString(purpose).trim();

  const violations = [];
  if (pathSafe.length === 0) violations.push("no_path");
  if (scopeSafe.length === 0) violations.push("no_scope_root · scope must be declared");
  if (purposeSafe.length === 0) violations.push("no_purpose");
  if (isPathInForbiddenZone(pathSafe)) violations.push(`forbidden_path_pattern · ${pathSafe}`);
  if (pathSafe.length > 0 && scopeSafe.length > 0 && !isPathWithinScope(pathSafe, scopeSafe)) {
    violations.push(`path_outside_scope · '${pathSafe}' not under '${scopeSafe}'`);
  }

  const valid = violations.length === 0;
  const pathHash = pathSafe.length > 0 ? sha256(pathSafe) : null;
  const consentPhrase = valid
    ? `GO: ${op} on path under '${scopeSafe}' · hash=${pathHash} · '${purposeSafe.slice(0, 60)}'`
    : null;

  return Object.freeze({
    schema: FILE_OP_REQUEST_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_at: new Date().toISOString(),
    path: pathSafe,
    path_hash: pathHash,
    op_kind: op,
    scope_root: scopeSafe,
    purpose: purposeSafe,
    size_estimate_bytes: typeof size_estimate_bytes === "number" ? size_estimate_bytes : 0,
    in_forbidden_zone: isPathInForbiddenZone(pathSafe),
    within_declared_scope: scopeSafe.length > 0 && isPathWithinScope(pathSafe, scopeSafe),
    valid,
    violations: Object.freeze(violations),
    consent_phrase: consentPhrase,
    operation_performed: false,
    requires_typed_go: true,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary()
  });
}

export function buildFileAccessSummary(options = {}) {
  const preview = buildFileAccessPreview(options);
  return Object.freeze({
    schema: "bizra.dema.file_access_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    scope_declared: preview.scope_declared,
    declared_scope_root: preview.declared_scope_root,
    op_kinds_allowed: preview.op_kinds_allowed,
    forbidden_pattern_count: preview.forbidden_path_patterns.length,
    blocked_effect_count: preview.blocked_effects.length,
    boundary: preview.boundary
  });
}

export const FILE_ACCESS_SCHEMA_NAME = SCHEMA;
export const FILE_ACCESS_OP_REQUEST_SCHEMA_NAME = FILE_OP_REQUEST_SCHEMA;
export const FILE_ACCESS_OP_KINDS = OP_KINDS;
export const FILE_ACCESS_FORBIDDEN_PATH_PATTERNS = FORBIDDEN_PATH_PATTERNS;
export const FILE_ACCESS_REQUIRED_BLOCKED_EFFECTS = REQUIRED_BLOCKED_EFFECTS;
