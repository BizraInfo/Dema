// C4 · PAT-3 · Code Apprentice (per ADR-008 §C4).
//
// Third of the 7 PATs. Role: read/write code within declared boundary ·
// run tests · classify code changes against doctrine. Never pushes ·
// never bypasses pre-commit hooks · never modifies CI workflows · never
// touches files outside declared scope.

import { buildAgentKernel, AGENT_KERNEL_MAX_ITERATIONS } from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.pat_code_apprentice.v0.1";
const CHANGE_PLAN_SCHEMA = "bizra.dema.code_change_plan.v0.1";

const PAT3_PERSONA = Object.freeze({
  pat_number: 3,
  pat_id: "pat-3-code-apprentice",
  role_name: "code_apprentice",
  role_description:
    "Reads + writes source code within declared boundary paths · runs tests · " +
    "drafts code change plans showing what would be edited. Never pushes to " +
    "remote · never bypasses pre-commit hooks · never modifies CI workflows · " +
    "never touches files outside declared scope.",
  primary_capabilities: Object.freeze([
    "read_local_source",
    "draft_code_change",
    "run_tests_under_consent",
    "classify_change_against_canon"
  ]),
  primary_refusals: Object.freeze([
    "push_to_remote",
    "bypass_pre_commit_hooks",
    "modify_ci_workflows_yml",
    "touch_files_outside_declared_scope",
    "execute_arbitrary_shell",
    "amend_published_commits",
    "force_push"
  ])
});

const PAT3_EFFECT_CAP_ALLOWED = Object.freeze([
  "read_local_file",
  "list_local_directory",
  "stat_file_metadata",
  "compute_hash",
  "render_terminal_output"
]);

const PAT3_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "push_to_remote",
  "force_push",
  "amend_published_commit",
  "modify_ci_workflows",
  "bypass_pre_commit_hook",
  "touch_outside_declared_scope"
]);

const PAT3_CONSENT_PHRASE_TEMPLATE = "GO: invoke PAT-3 code_apprentice to draft change";

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function filterStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((v) => typeof v === "string" && v.length > 0);
}

const FORBIDDEN_PATH_PATTERNS = Object.freeze([
  /^\.github\/workflows\//,
  /\.git\//,
  /node_modules\//,
  /\.env(\..*)?$/,
  /credentials/i,
  /secrets/i
]);

function isPathInForbiddenZone(path) {
  if (typeof path !== "string") return true;
  return FORBIDDEN_PATH_PATTERNS.some((p) => p.test(path));
}

export function buildPATCodeApprenticeEffectCap() {
  return buildEffectCap({
    name: "pat_code_apprentice",
    description: PAT3_PERSONA.role_description,
    allowed_effects: PAT3_EFFECT_CAP_ALLOWED,
    blocked_effects: PAT3_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: PAT3_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true
  });
}

export function buildPATCodeApprenticePreview({ operator_name = "Mumu" } = {}) {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: PAT3_PERSONA,
    serves_operator: safeString(operator_name, "Mumu"),
    effect_cap: buildPATCodeApprenticeEffectCap(),
    consent_phrase_template: PAT3_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${PAT3_PERSONA.pat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    forbidden_path_patterns: Object.freeze(FORBIDDEN_PATH_PATTERNS.map((p) => String(p))),
    refusal_invariants: Object.freeze([
      "PAT-3 never pushes to a remote · operator pushes manually",
      "PAT-3 never bypasses pre-commit hooks · --no-verify is forbidden",
      "PAT-3 never modifies .github/workflows/*.yml · CI policy is operator-scoped",
      "PAT-3 never touches secrets/credentials/.env* files",
      "PAT-3 never amends a published commit · creates new commits instead"
    ]),
    boundary: buildPreviewBoundary()
  });
}

export function buildPATCodeApprenticeKernel({ mission_intent = "", max_iterations = AGENT_KERNEL_MAX_ITERATIONS } = {}) {
  return buildAgentKernel({
    agent_id: PAT3_PERSONA.pat_id,
    agent_role: "pat_code_apprentice",
    mission_intent: safeString(mission_intent, ""),
    max_iterations
  });
}

// Draft a code change plan: declares which paths would be touched + what
// kind of change. Each path is checked against the forbidden zone.
export function draftCodeChangePlan({
  change_intent = "",
  paths_to_edit = [],
  change_type = "edit",
  declared_scope_root = ""
} = {}) {
  const intent = safeString(change_intent, "").trim();
  const paths = filterStringArray(paths_to_edit);
  const safeChangeType = ["edit", "create", "delete", "rename"].includes(change_type) ? change_type : "edit";
  const safeScopeRoot = safeString(declared_scope_root, "").trim();

  // Path analysis
  const pathAnalysis = paths.map((path) => {
    const forbidden = isPathInForbiddenZone(path);
    const outsideScope = safeScopeRoot.length > 0 && !path.startsWith(safeScopeRoot);
    return Object.freeze({
      path,
      in_forbidden_zone: forbidden,
      outside_declared_scope: outsideScope,
      allowed_for_change: !forbidden && !outsideScope
    });
  });

  const allPathsAllowed = pathAnalysis.length > 0 && pathAnalysis.every((p) => p.allowed_for_change);
  const forbiddenHits = pathAnalysis.filter((p) => p.in_forbidden_zone).map((p) => p.path);
  const outsideScopeHits = pathAnalysis.filter((p) => p.outside_declared_scope).map((p) => p.path);

  const valid = intent.length > 0 && paths.length > 0 && allPathsAllowed && safeScopeRoot.length > 0;
  const refusal_reason = !valid
    ? (intent.length === 0
        ? "empty_change_intent"
        : safeScopeRoot.length === 0
          ? "missing_declared_scope_root · scope must be named explicitly"
          : paths.length === 0
            ? "no_paths · plan would have nothing to change"
            : forbiddenHits.length > 0
              ? `forbidden_path · ${forbiddenHits.join(",")}`
              : `outside_declared_scope · ${outsideScopeHits.join(",")}`)
    : null;

  return Object.freeze({
    schema: CHANGE_PLAN_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_by: PAT3_PERSONA.pat_id,
    drafted_at: new Date().toISOString(),
    change_intent_verbatim: intent,
    change_type: safeChangeType,
    declared_scope_root: safeScopeRoot,
    path_analysis: Object.freeze(pathAnalysis),
    forbidden_path_hits: Object.freeze(forbiddenHits),
    outside_scope_hits: Object.freeze(outsideScopeHits),
    requires_consent_phrase: `GO: PAT-3 edit ${paths.length} path(s) under '${safeScopeRoot}'`,
    requires_typed_go: true,
    valid,
    refusal_reason,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary()
  });
}

export function buildPATCodeApprenticeSummary(options = {}) {
  const preview = buildPATCodeApprenticePreview(options);
  return Object.freeze({
    schema: "bizra.dema.pat_code_apprentice_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    pat_number: preview.persona.pat_number,
    pat_id: preview.persona.pat_id,
    role_name: preview.persona.role_name,
    serves_operator: preview.serves_operator,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    forbidden_pattern_count: preview.forbidden_path_patterns.length,
    consent_phrase_template: preview.consent_phrase_template,
    boundary: preview.boundary
  });
}

export const PAT_CODE_APPRENTICE_SCHEMA_NAME = SCHEMA;
export const PAT_CODE_APPRENTICE_CHANGE_PLAN_SCHEMA_NAME = CHANGE_PLAN_SCHEMA;
export const PAT_CODE_APPRENTICE_CONSENT_PHRASE_TEMPLATE = PAT3_CONSENT_PHRASE_TEMPLATE;
export const PAT_CODE_APPRENTICE_PERSONA = PAT3_PERSONA;
