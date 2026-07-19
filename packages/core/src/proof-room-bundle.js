// Proof Room Bundle v0.1 — compose existing local gates into one replayable audit.
// Read-only by default; optional artifact write requires exact-string micro-consent.

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const PROOF_ROOM_BUNDLE_SCHEMA = "bizra.dema.proof_room_bundle.v0.1";
export const PROOF_ROOM_WRITE_CONSENT =
  "GO: write proof room bundle to artifacts/proofs/proof-room-v0.1";
export const PROOF_ROOM_ARTIFACT_RELATIVE_DIR =
  "artifacts/proofs/proof-room-v0.1";

// Public-safe variant: redacts operator-absolute repo_root so the artifact
// passes the Layer 1 artifact-safety scanner with verdict PUBLIC_SAFE and
// is share-safe outside the operator's machine. The non-redacted v0.1 bundle
// remains operator-local (verdict LOCAL_ONLY/LEAKAGE_DETECTED) for replay.
export const PROOF_ROOM_PUBLIC_SAFE_WRITE_CONSENT =
  "GO: write proof room bundle to artifacts/proofs/proof-room-v0.1-public-safe";
export const PROOF_ROOM_PUBLIC_SAFE_ARTIFACT_RELATIVE_DIR =
  "artifacts/proofs/proof-room-v0.1-public-safe";
export const REDACTED_REPO_ROOT_PLACEHOLDER = "<repo_root:redacted>";

export const CORE_PROOF_ROOM_GATES = Object.freeze([
  {
    id: "gtm_readiness",
    argv: ["node", "scripts/gtm-readiness-check.mjs", "--json"],
    json_ok_path: ["ok"],
    timeout_ms: 120_000,
  },
  {
    id: "urp_discovery",
    argv: ["node", "scripts/urp-shared-discovery.mjs", "--json"],
    json_ok_path: ["ok"],
    timeout_ms: 60_000,
  },
  {
    id: "llm_guidance",
    argv: ["node", "scripts/llm-guidance-check.mjs", "--json"],
    json_ok_path: ["ok"],
    timeout_ms: 60_000,
  },
  {
    id: "transition_assurance",
    argv: ["node", "scripts/review/transition-assurance-check.mjs"],
    json_ok_path: ["ok"],
    timeout_ms: 60_000,
  },
  {
    id: "release_readiness",
    argv: [
      "node",
      "scripts/release-readiness.mjs",
      "--json",
      "--ci-workflow-changes-authorized",
    ],
    readiness_min_score: 100,
    readiness_allowed_risk_codes: Object.freeze(["qa.coverage_threshold_missing"]),
    timeout_ms: 120_000,
  },
  {
    id: "git_diff_check",
    argv: ["git", "diff", "--check"],
    exit_only: true,
    timeout_ms: 30_000,
  },
  {
    id: "node0_self_check_verify",
    argv: ["node", "scripts/node0-self-check.mjs", "--verify"],
    exit_only: true,
    timeout_ms: 60_000,
  },
]);

export const FULL_PROOF_ROOM_EXTRA_GATES = Object.freeze([
  {
    id: "npm_test",
    argv: ["npm", "test"],
    tap_summary: true,
    timeout_ms: 180_000,
  },
]);

const BOUNDARY = buildPreviewBoundary();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function digestStdout(text) {
  return createHash("sha256")
    .update(text ?? "", "utf8")
    .digest("hex");
}

export function commandLine(argv) {
  return argv.map((part) => (/\s/.test(part) ? `"${part}"` : part)).join(" ");
}

export function parseTapSummary(stdout) {
  const pass = Number((stdout.match(/# pass (\d+)/) || [])[1] ?? 0);
  const fail = Number((stdout.match(/# fail (\d+)/) || [])[1] ?? 0);
  const total = Number((stdout.match(/# tests (\d+)/) || [])[1] ?? 0);
  return Object.freeze({ pass, fail, total, ok: fail === 0 && total > 0 });
}

export function readJsonOk(stdout, path = ["ok"]) {
  try {
    const parsed = JSON.parse(stdout);
    let cursor = parsed;
    for (const key of path) {
      if (cursor == null || typeof cursor !== "object") return null;
      cursor = cursor[key];
    }
    return cursor === true;
  } catch {
    return null;
  }
}

export function evaluateGateOk(stdout, gate) {
  if (gate.json_ok_path) {
    const jsonOk = readJsonOk(stdout, gate.json_ok_path);
    if (jsonOk === true) return { ok: true, summary: { json_ok: true } };
    if (jsonOk === false) return { ok: false, summary: { json_ok: false } };
  }
  if (typeof gate.readiness_min_score === "number") {
    try {
      const parsed = JSON.parse(stdout);
      const score = parsed.readiness_score;
      const riskCodes = Array.isArray(parsed.risks)
        ? parsed.risks.map((risk) => risk?.code).filter(Boolean)
        : [];
      const allowed = new Set(gate.readiness_allowed_risk_codes ?? []);
      const unallowedRiskCodes = riskCodes.filter((code) => !allowed.has(code));
      const allowedAdvisoryScore =
        typeof score === "number" &&
        score >= gate.readiness_min_score - allowed.size * 3 &&
        riskCodes.length > 0 &&
        unallowedRiskCodes.length === 0;
      const ok =
        (typeof score === "number" && score >= gate.readiness_min_score) ||
        allowedAdvisoryScore;
      return {
        ok,
        summary: {
          readiness_score: score,
          min_required: gate.readiness_min_score,
          allowed_advisory_risk_codes: Object.freeze([...allowed]),
          unallowed_risk_codes: Object.freeze(unallowedRiskCodes),
        },
      };
    } catch {
      return { ok: false, summary: { readiness_score: null } };
    }
  }
  if (gate.tap_summary) {
    const summary = parseTapSummary(stdout);
    return { ok: summary.ok, summary };
  }
  if (gate.exit_only) {
    return { ok: true, summary: null };
  }
  return { ok: false, summary: null };
}

export function evaluateProofRoomWrite({
  consent_phrase = "",
  allow_write = true,
  required_phrase = PROOF_ROOM_WRITE_CONSENT,
} = {}) {
  const phrase =
    typeof consent_phrase === "string" ? consent_phrase.trim() : "";
  const violations = [];
  if (!allow_write) violations.push({ code: "write_disabled" });
  if (phrase !== required_phrase)
    violations.push({ code: "consent_phrase_mismatch" });
  const allowed = violations.length === 0;
  return deepFreeze({
    schema: "bizra.dema.proof_room_write_boundary.v0.1",
    mode: "MICRO_CONSENT_GATE",
    allowed,
    consent_phrase_required: required_phrase,
    consent_phrase_provided: phrase || null,
    violations: Object.freeze(violations.map((v) => Object.freeze({ ...v }))),
    filesystem_write_performed: false,
    boundary: BOUNDARY,
  });
}

export async function runProofRoomGate({ root, gate, run = null }) {
  const started = Date.now();
  const runner = run ?? defaultRunGate;
  const result = await runner({ root, gate });
  const duration_ms = Date.now() - started;
  return Object.freeze({
    ...result,
    duration_ms: result.duration_ms ?? duration_ms,
  });
}

async function defaultRunGate({ root, gate }) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const [bin, ...args] = gate.argv;
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: gate.timeout_ms ?? 120_000,
      env: { ...process.env },
    });
    const combined = `${stdout ?? ""}${stderr ?? ""}`;
    const evaluated = evaluateGateOk(stdout ?? "", gate);
    const ok = evaluated.ok;
    const summary = evaluated.summary;
    return Object.freeze({
      id: gate.id,
      command: commandLine(gate.argv),
      exit_code: 0,
      ok,
      stdout_sha256: digestStdout(combined),
      stdout_bytes: combined.length,
      summary,
      error: null,
    });
  } catch (err) {
    const stdout = err.stdout ?? "";
    const stderr = err.stderr ?? String(err.message ?? err);
    const combined = `${stdout}${stderr}`;
    const evaluated = gate.tap_summary
      ? { ok: false, summary: parseTapSummary(stdout) }
      : { ok: false, summary: null };
    return Object.freeze({
      id: gate.id,
      command: commandLine(gate.argv),
      exit_code: typeof err.code === "number" ? err.code : 1,
      ok: false,
      stdout_sha256: digestStdout(combined),
      stdout_bytes: combined.length,
      summary: evaluated.summary,
      error: String(err.message ?? err).slice(0, 500),
    });
  }
}

function buildSelfHarness(gates) {
  const passed = gates.filter((g) => g.ok).length;
  const failed = gates.filter((g) => !g.ok);
  return Object.freeze({
    gates_run: gates.length,
    gates_passed: passed,
    gates_failed: failed.length,
    failed_gate_ids: Object.freeze(failed.map((g) => g.id)),
    replay_command: "npm run proof:room",
    full_replay_command: "npm run proof:room -- --full",
    micro_consent_write: PROOF_ROOM_WRITE_CONSENT,
    self_critique: Object.freeze(
      failed.length === 0
        ? [
            "All composed gates passed; safe to offer outsider replay of this bundle.",
          ]
        : [
            "One or more gates failed; do not publish proof-room artifact until root cause is fixed.",
            `Failed: ${failed.map((g) => g.id).join(", ")}`,
          ],
    ),
  });
}

export async function buildProofRoomBundle({
  root,
  full = false,
  run = null,
} = {}) {
  const gatesToRun = full
    ? [...CORE_PROOF_ROOM_GATES, ...FULL_PROOF_ROOM_EXTRA_GATES]
    : [...CORE_PROOF_ROOM_GATES];
  const gates = [];
  for (const gate of gatesToRun) {
    gates.push(await runProofRoomGate({ root, gate, run }));
  }
  const ok = gates.every((gate) => gate.ok);
  const self_harness = buildSelfHarness(gates);
  return deepFreeze(
    clone({
      schema: PROOF_ROOM_BUNDLE_SCHEMA,
      mode: full ? "PROOF_ROOM_FULL" : "PROOF_ROOM_CORE",
      truth_label: ok ? "MEASURED" : "GATE_FAILURE",
      ok,
      generated_at: new Date().toISOString(),
      repo_root: root,
      gates: Object.freeze(gates),
      self_harness,
      proof_convergence: Object.freeze({
        formal: "schema-tagged gate composition",
        cryptographic: "per-gate stdout_sha256 digests",
        empirical: "subprocess exit codes and TAP counts when --full",
        economic: "no token, revenue, or PoI claims in this bundle",
      }),
      boundary: BOUNDARY,
      next_safe_action: ok
        ? 'Optional: npm run proof:room -- --write --consent "GO: write proof room bundle to artifacts/proofs/proof-room-v0.1"'
        : "Fix failing gate, rerun npm run proof:room, then consider --write",
    }),
  );
}

// redactProofRoomBundle returns a new (non-frozen-input-safe) bundle with the
// absolute repo_root replaced by a placeholder. Adds a stable product label
// (never the raw checkout/worktree basename) and repo_root_sha256 so an operator
// who knows their checkout can still verify the original path. Idempotent ·
// non-mutating · sets
// `redacted: true` and `truth_label: "PUBLIC_SAFE"` when input was MEASURED.
export function redactProofRoomBundle(bundle) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("redactProofRoomBundle: bundle must be an object");
  }
  if (bundle.redacted === true) return bundle;
  const original = bundle.repo_root;
  const sha = digestStdout(typeof original === "string" ? original : "");
  const next = {
    ...clone(bundle),
    repo_root: REDACTED_REPO_ROOT_PLACEHOLDER,
    repo_root_basename: "Dema",
    repo_root_sha256: sha,
    redacted: true,
    truth_label:
      bundle.truth_label === "MEASURED" ? "PUBLIC_SAFE" : bundle.truth_label,
    next_safe_action:
      bundle.ok === true
        ? `Optional: npm run proof:room -- --public-safe --write --consent "${PROOF_ROOM_PUBLIC_SAFE_WRITE_CONSENT}"`
        : "Fix failing gate, rerun npm run proof:room -- --public-safe, then consider --write",
  };
  return deepFreeze(next);
}

export function formatProofRoomReport(report) {
  const lines = [
    "DEMA Proof Room Bundle",
    "",
    `Schema: ${report.schema}`,
    `Mode: ${report.mode}`,
    `Result: ${report.ok ? "PASS" : "FAIL"}`,
    `Generated: ${report.generated_at}`,
    ...(report.redacted === true
      ? [
          `Redacted: true (repo_root_basename=${report.repo_root_basename ?? "?"})`,
        ]
      : []),
    "",
    "Gates:",
  ];
  for (const gate of report.gates) {
    lines.push(
      `- ${gate.ok ? "PASS" : "FAIL"} ${gate.id} (exit ${gate.exit_code}, ${gate.duration_ms}ms)`,
    );
    if (gate.summary?.pass != null) {
      lines.push(`  tests: ${gate.summary.pass}/${gate.summary.total}`);
    }
    if (gate.error) lines.push(`  error: ${gate.error}`);
  }
  lines.push(
    "",
    "Self-harness:",
    ...report.self_harness.self_critique.map((line) => `- ${line}`),
    "",
    `Write requires: ${PROOF_ROOM_WRITE_CONSENT}`,
    "Boundary: read-only composition; no runtime; no receipt mint; no network.",
  );
  return lines.join("\n");
}
