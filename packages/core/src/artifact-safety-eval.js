// Layer 1 · Artifact Safety Eval v0.1 — deterministic path/secret/claim checks.
// Read-only over caller-supplied artifact text or object. No repo-wide scan.
//
// Schema validation: when the artifact is a JSON object whose `schema` field
// matches a known envelope schema in packages/core/schemas/, structural
// validation is delegated to envelope-schema-validator. Validation errors are
// surfaced as findings with kind="SCHEMA" and severity="BLOCKER", which
// drives verdict SCHEMA_VIOLATION through deriveVerdict().

import { createHash } from "node:crypto";

import {
  validateAgainstRegistry
} from "./envelope-schema-validator.js";

export const ARTIFACT_SAFETY_SCHEMA = "bizra.dema.artifact_safety_eval.v0.1";

export const ALLOWED_TRUTH_LABELS = Object.freeze([
  "VERIFIED",
  "DESIGNED_NOT_LIVE",
  "LOCAL_ONLY",
  "SOURCE_PENDING",
  "OPERATOR_RECORDED"
]);

export const FORBIDDEN_LIVE_CLAIMS = Object.freeze([
  "urp is live",
  "urp runtime is live",
  "nodes are synchronized",
  "federated network is live",
  "public token economy is active",
  "proof-of-impact rewards are active",
  "chain-bound mint is active",
  "chain-bound proof is live",
  "distributed intelligence network is live"
]);

const PATH_PATTERNS = Object.freeze([
  { pattern_id: "unix_home", regex: /\/home\//i, field: null },
  { pattern_id: "mac_users", regex: /\/Users\//i, field: null },
  { pattern_id: "unix_root", regex: /\/root\//i, field: null },
  { pattern_id: "win_users", regex: /C:\\Users\\/i, field: null },
  { pattern_id: "downloads_segment", regex: /\/Downloads\//i, field: null },
  { pattern_id: "dema_home_dir", regex: /(?:^|[\s"'`;,(])~?\/?\.dema(?:\/|[\s"'`,]|$)/i, field: null },
  { pattern_id: "dot_env", regex: /(?:^|[\s"'`;,(])\.env(?:\.|[\s"'`,/]|$)/i, field: null },
  { pattern_id: "dot_ssh", regex: /(?:^|[\s"'`;,(])\.ssh(?:\/|[\s"'`,]|$)/i, field: null }
]);

const SECRET_PATTERNS = Object.freeze([
  { pattern_id: "api_key", regex: /\bapi[_\s-]?key\b/i },
  { pattern_id: "access_token", regex: /\baccess[_\s-]?token\b/i },
  { pattern_id: "bearer_token", regex: /\bbearer\s+[a-z0-9._-]{8,}\b/i },
  { pattern_id: "password_field", regex: /\bpassword\s*[:=]/i },
  { pattern_id: "private_key", regex: /\bprivate[_\s-]?key\b/i },
  { pattern_id: "ssh_rsa", regex: /\bssh-rsa\b/i },
  { pattern_id: "openai_sk", regex: /\bsk-[a-zA-Z0-9]{8,}\b/ },
  { pattern_id: "github_ghp", regex: /\bghp_[a-zA-Z0-9]{8,}\b/ },
  { pattern_id: "slack_xoxb", regex: /\bxoxb-[a-zA-Z0-9-]{8,}\b/ },
  {
    pattern_id: "generic_secret",
    regex: /\b(?<!no\s)(?<!without\s)secret[_\s-]?(?:key|token|value)\b/i
  }
]);

const BOUNDARY = Object.freeze({
  read_only: true,
  network: false,
  mint: false,
  external_send: false,
  urp_runtime: false
});

function normalizeInput(input) {
  if (typeof input === "string") return { text: input, object: null };
  if (input && typeof input === "object") {
    return { text: JSON.stringify(input), object: input };
  }
  return { text: "", object: null };
}

function finding(kind, pattern_id, severity, message, field = null) {
  return Object.freeze({ kind, pattern_id, severity, field, message });
}

export function scanPathLeakage(text, { field = null } = {}) {
  const body = typeof text === "string" ? text : "";
  const findings = [];
  for (const { pattern_id, regex } of PATH_PATTERNS) {
    if (regex.test(body)) {
      findings.push(
        finding(
          "PATH_LEAK",
          pattern_id,
          "BLOCKER",
          `Path leakage pattern matched: ${pattern_id}`,
          field
        )
      );
    }
  }
  if (body.includes("repo_root") && /"repo_root"\s*:\s*"\/[^"]+"/.test(body)) {
    findings.push(
      finding(
        "PATH_LEAK",
        "repo_root_absolute",
        "BLOCKER",
        "Absolute repo_root path in structured artifact",
        field ?? "repo_root"
      )
    );
  }
  return Object.freeze(findings);
}

export function scanSecretLikeStrings(text, { field = null } = {}) {
  const body = typeof text === "string" ? text : "";
  const findings = [];
  for (const { pattern_id, regex } of SECRET_PATTERNS) {
    if (regex.test(body)) {
      findings.push(
        finding(
          "SECRET_LIKE",
          pattern_id,
          "BLOCKER",
          `Secret-like pattern matched: ${pattern_id}`,
          field
        )
      );
    }
  }
  return Object.freeze(findings);
}

function claimLineAllowed(line) {
  const lower = line.toLowerCase();
  if (lower.includes("designed_not_live")) return true;
  if (/\bnot\s+live\b/.test(lower)) return true;
  if (/\bpreview[- ]only\b/.test(lower)) return true;
  if (/\bno\s+token\b/.test(lower)) return true;
  return false;
}

export function scanClaimBoundary(text, { field = null } = {}) {
  const body = typeof text === "string" ? text : "";
  const findings = [];
  const lines = body.split(/\r?\n/);
  for (const phrase of FORBIDDEN_LIVE_CLAIMS) {
    for (const line of lines) {
      if (!line.toLowerCase().includes(phrase)) continue;
      if (claimLineAllowed(line)) continue;
      findings.push(
        finding(
          "CLAIM_OVERREACH",
          `forbidden_live:${phrase.replace(/\s+/g, "_")}`,
          "BLOCKER",
          `Forbidden live claim detected: "${phrase}"`,
          field
        )
      );
    }
  }
  return Object.freeze(findings);
}

function scanSchema(object) {
  if (!object || typeof object !== "object") return Object.freeze([]);
  const findings = [];
  const declared = object.schema;
  if (typeof declared !== "string") return Object.freeze(findings);

  if (!declared.startsWith("bizra.dema.")) {
    findings.push(
      finding(
        "SCHEMA",
        "schema_namespace",
        "WARNING",
        `Unexpected schema namespace: ${declared}`,
        "schema"
      )
    );
    return Object.freeze(findings);
  }

  const validation = validateAgainstRegistry(object);

  if (!validation.recognized) {
    findings.push(
      finding(
        "SCHEMA",
        "schema_unknown",
        "WARNING",
        `Schema declared as ${declared} but not in known-schema registry`,
        "schema"
      )
    );
    return Object.freeze(findings);
  }

  for (const err of validation.errors) {
    findings.push(
      finding(
        "SCHEMA",
        `schema_${err.code}`,
        "BLOCKER",
        `Schema violation at ${err.path}: ${err.message}`,
        "schema"
      )
    );
  }

  return Object.freeze(findings);
}

function deriveVerdict(findings, { treat_repo_root_as_local_only = true } = {}) {
  const blockers = findings.filter((f) => f.severity === "BLOCKER");
  if (blockers.some((f) => f.kind === "CLAIM_OVERREACH")) {
    return "CLAIM_BOUNDARY_VIOLATION";
  }
  if (blockers.some((f) => f.kind === "SCHEMA")) {
    return "SCHEMA_VIOLATION";
  }
  const pathOrSecret = blockers.filter((f) => f.kind === "PATH_LEAK" || f.kind === "SECRET_LIKE");
  if (pathOrSecret.length === 0) {
    return "PUBLIC_SAFE";
  }
  const onlyRepoRoot =
    treat_repo_root_as_local_only &&
    pathOrSecret.length > 0 &&
    pathOrSecret.every((f) => f.pattern_id === "repo_root_absolute");
  if (onlyRepoRoot) return "LOCAL_ONLY";
  return "LEAKAGE_DETECTED";
}

export function evaluateArtifactSafety(input, options = {}) {
  const { text, object } = normalizeInput(input);
  const findings = [
    ...scanPathLeakage(text, options),
    ...scanSecretLikeStrings(text, options),
    ...scanClaimBoundary(text, options),
    ...scanSchema(object)
  ];
  const verdict = deriveVerdict(findings, options);
  const publicSafe = verdict === "PUBLIC_SAFE";
  return Object.freeze({
    schema: ARTIFACT_SAFETY_SCHEMA,
    verdict,
    score: publicSafe ? 1 : 0,
    findings: Object.freeze(findings),
    boundary: BOUNDARY,
    artifact_sha256: createHash("sha256").update(text).digest("hex")
  });
}

export function formatArtifactSafetyReport(result, { pretty = false } = {}) {
  const lines = [
    "DEMA Artifact Safety Eval (Layer 1)",
    "",
    `Schema: ${result.schema}`,
    `Verdict: ${result.verdict}`,
    `Score: ${result.score}`,
    `Artifact SHA-256: ${result.artifact_sha256}`,
    "",
    "Findings:"
  ];
  if (result.findings.length === 0) {
    lines.push("- (none)");
  } else {
    for (const f of result.findings) {
      lines.push(`- [${f.severity}] ${f.kind} · ${f.pattern_id}: ${f.message}`);
    }
  }
  lines.push("", "Boundary: read-only; no network; no mint; no external send; no URP runtime.");
  const out = lines.join("\n");
  return pretty ? out : out;
}
