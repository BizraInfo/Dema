#!/usr/bin/env node
/**
 * DEMA-REVIEW-GATE-SEMANTIC-BINDING-1A — base vs candidate gitleaks evaluation.
 *
 * Gate Mutator ≠ Final Gate Verifier:
 * candidate policy success must not erase base-policy failure on the same tree.
 *
 * Under POLICY_DELTA:
 *   ACCEPTED ⇔ BASE=PASS ∧ CANDIDATE=PASS ∧ INDEPENDENT_ACCEPTANCE=VERIFIED
 * Absence of the old judge must never increase the authority of the new judge.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const GITLEAKS_VERIFIER_CONTRACT = Object.freeze({
  version: "8.30.1",
  tarball_sha256:
    "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
});

export const INDEPENDENT_ACCEPTANCE_STATES = Object.freeze([
  "ABSENT",
  "UNKNOWN",
  "VERIFIED",
]);

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function isFullSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

function isNullPushSha(value) {
  return typeof value === "string" && /^0+$/.test(value);
}

/**
 * Event-aware base/candidate commit binding.
 * Never invents a comparison base when identity is unbound.
 *
 * @param {{
 *   eventName: string,
 *   pullRequestBaseSha?: string,
 *   pullRequestHeadSha?: string,
 *   mergeSha?: string,
 *   pushBeforeSha?: string,
 *   pushAfterSha?: string,
 *   dispatchSha?: string,
 * }} input
 */
export function resolveEventBinding(input) {
  const eventName = input.eventName || "unknown";
  const mergeSha = input.mergeSha || null;

  if (eventName === "pull_request" || eventName === "pull_request_target") {
    const baseSha = isFullSha(input.pullRequestBaseSha)
      ? input.pullRequestBaseSha
      : null;
    const candidateSha = isFullSha(input.pullRequestHeadSha)
      ? input.pullRequestHeadSha
      : null;
    const mergeDistinct =
      mergeSha &&
      candidateSha &&
      mergeSha.toLowerCase() !== candidateSha.toLowerCase();
    return {
      schema: "bizra.dema.gitleaks_event_binding.v0.1",
      event: eventName,
      base_sha: baseSha,
      candidate_sha: candidateSha,
      merge_sha: mergeSha,
      merge_sha_substituted_for_head: false,
      ok: Boolean(baseSha && candidateSha),
      reason:
        baseSha && candidateSha
          ? mergeDistinct
            ? "pull_request_base_and_head_bound_merge_sha_distinct"
            : "pull_request_base_and_head_bound"
          : "pull_request_identity_unbound",
    };
  }

  if (eventName === "push") {
    const before = input.pushBeforeSha;
    const after = input.pushAfterSha;
    const baseSha =
      isFullSha(before) && !isNullPushSha(before) ? before : null;
    const candidateSha =
      isFullSha(after) && !isNullPushSha(after) ? after : null;
    return {
      schema: "bizra.dema.gitleaks_event_binding.v0.1",
      event: eventName,
      base_sha: baseSha,
      candidate_sha: candidateSha,
      merge_sha: null,
      merge_sha_substituted_for_head: false,
      ok: Boolean(baseSha && candidateSha),
      reason:
        baseSha && candidateSha
          ? "push_before_after_bound"
          : "push_identity_unbound",
    };
  }

  if (eventName === "workflow_dispatch") {
    const candidateSha = isFullSha(input.dispatchSha)
      ? input.dispatchSha
      : null;
    return {
      schema: "bizra.dema.gitleaks_event_binding.v0.1",
      event: eventName,
      base_sha: null,
      candidate_sha: candidateSha,
      merge_sha: null,
      merge_sha_substituted_for_head: false,
      ok: false,
      reason: "workflow_dispatch_base_unbound_returns_unknown",
    };
  }

  return {
    schema: "bizra.dema.gitleaks_event_binding.v0.1",
    event: eventName,
    base_sha: null,
    candidate_sha: isFullSha(input.dispatchSha) ? input.dispatchSha : null,
    merge_sha: mergeSha,
    merge_sha_substituted_for_head: false,
    ok: false,
    reason: "unsupported_or_unknown_event_identity",
  };
}

export function normalizeIndependentAcceptance(value) {
  if (value == null || value === "") return "ABSENT";
  const upper = String(value).trim().toUpperCase();
  if (INDEPENDENT_ACCEPTANCE_STATES.includes(upper)) return upper;
  return "UNKNOWN";
}

/**
 * Pure decision over already-obtained policy results.
 * @param {{
 *   basePolicy: 'PASS'|'FAIL'|'UNKNOWN',
 *   candidatePolicy: 'PASS'|'FAIL'|'UNKNOWN',
 *   policyDelta: boolean,
 *   independentAcceptance?: string,
 * }} input
 */
export function decideDualEval({
  basePolicy,
  candidatePolicy,
  policyDelta,
  independentAcceptance,
}) {
  const acceptance = normalizeIndependentAcceptance(independentAcceptance);
  const independentAcceptanceRequired = policyDelta === true;
  let evidenceConsistency = "UNKNOWN";
  if (basePolicy !== "UNKNOWN" && candidatePolicy !== "UNKNOWN") {
    evidenceConsistency =
      basePolicy === candidatePolicy ? "CONSISTENT" : "CONTRADICTED";
  }

  // Fail closed whenever the previous policy rejects what the candidate accepts,
  // or the old judge is absent under a policy delta (cannot increase authority).
  const selfCertificationBlocked =
    policyDelta &&
    candidatePolicy === "PASS" &&
    (basePolicy === "FAIL" || basePolicy === "UNKNOWN");

  let ok = false;
  if (!policyDelta) {
    ok = candidatePolicy === "PASS";
  } else {
    ok =
      basePolicy === "PASS" &&
      candidatePolicy === "PASS" &&
      acceptance === "VERIFIED";
  }

  return {
    schema: "bizra.dema.gitleaks_dual_eval.decision.v0.1",
    BASE_POLICY: basePolicy,
    CANDIDATE_POLICY: candidatePolicy,
    POLICY_DELTA: policyDelta,
    INDEPENDENT_ACCEPTANCE_REQUIRED: independentAcceptanceRequired,
    INDEPENDENT_ACCEPTANCE: acceptance,
    EVIDENCE_CONSISTENCY: evidenceConsistency,
    self_certification_blocked: Boolean(selfCertificationBlocked),
    ok,
    exit_code: ok ? 0 : 1,
  };
}

/**
 * Classify whether a finding secret looks like a lowercase 64-hex digest.
 * Used by unit tests for the intended false-positive class (no real secrets).
 */
export function isLowercaseSha256Hex(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

export function gitShowText(refPath, { gitExecFile = execFileSync } = {}) {
  try {
    return gitExecFile("git", ["show", refPath], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

/**
 * @param {{ configPath: string, sourceDir: string, gitleaksBin: string }} opts
 * @returns {'PASS'|'FAIL'|'UNKNOWN'}
 */
export function runGitleaksDetect({
  configPath,
  sourceDir,
  gitleaksBin,
  spawn = spawnSync,
}) {
  if (!gitleaksBin || !existsSync(gitleaksBin)) return "UNKNOWN";
  if (!existsSync(configPath)) return "UNKNOWN";
  const result = spawn(
    gitleaksBin,
    [
      "detect",
      "--source",
      sourceDir,
      "--config",
      configPath,
      "--no-banner",
      "--exit-code",
      "1",
      "--redact",
    ],
    { encoding: "utf8" },
  );
  if (result.error) return "UNKNOWN";
  if (result.status === 0) return "PASS";
  if (result.status === 1) return "FAIL";
  return "UNKNOWN";
}

export function buildDualEvalReport({
  baseConfigText,
  candidateConfigText,
  sourceCommit,
  baseCommit,
  sourceDir,
  gitleaksBin,
  invocationBase,
  invocationCandidate,
  independentAcceptance,
  eventBinding,
  runDetect = runGitleaksDetect,
}) {
  const basePresent = typeof baseConfigText === "string";
  const candidatePresent = typeof candidateConfigText === "string";
  const base_config_sha256 = basePresent
    ? sha256Hex(Buffer.from(baseConfigText, "utf8"))
    : null;
  const candidate_config_sha256 = candidatePresent
    ? sha256Hex(Buffer.from(candidateConfigText, "utf8"))
    : null;

  // Introducing or changing policy without a recoverable base is a delta.
  const policyDelta = Boolean(
    (basePresent &&
      candidatePresent &&
      base_config_sha256 !== candidate_config_sha256) ||
      (!basePresent && candidatePresent),
  );

  // Private temp dir (0700) — avoid world-writable os.tmpdir() file creates.
  const work = mkdtempSync(join(tmpdir(), "gitleaks-dual-eval-"));
  const basePath = join(work, "gitleaks.base.toml");
  const candidatePath = join(work, "gitleaks.candidate.toml");
  if (basePresent) writeFileSync(basePath, baseConfigText, { mode: 0o600 });
  if (candidatePresent) {
    writeFileSync(candidatePath, candidateConfigText, { mode: 0o600 });
  }

  const detectArgv = (configPath) => [
    "detect",
    "--source",
    sourceDir,
    "--config",
    configPath,
    "--no-banner",
    "--exit-code",
    "1",
    "--redact",
  ];

  const basePolicy = basePresent
    ? runDetect({
        configPath: basePath,
        sourceDir,
        gitleaksBin,
      })
    : "UNKNOWN";
  const candidatePolicy = candidatePresent
    ? runDetect({
        configPath: candidatePath,
        sourceDir,
        gitleaksBin,
      })
    : "UNKNOWN";

  const decision = decideDualEval({
    basePolicy,
    candidatePolicy,
    policyDelta,
    independentAcceptance,
  });

  return {
    schema: "bizra.dema.gitleaks_dual_eval.v0.1",
    verifier: {
      ...GITLEAKS_VERIFIER_CONTRACT,
      binary: gitleaksBin || null,
      invocation_base: invocationBase || (basePresent ? detectArgv(basePath) : null),
      invocation_candidate:
        invocationCandidate ||
        (candidatePresent ? detectArgv(candidatePath) : null),
    },
    event_binding: eventBinding || null,
    base_commit: baseCommit || null,
    base_config_sha256,
    candidate_config_sha256,
    source_commit: sourceCommit || null,
    source_dir: sourceDir,
    ...decision,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const sourceDir = argValue("--source") || process.cwd();
  const gitleaksBin =
    argValue("--gitleaks-bin") || process.env.GITLEAKS_BIN || "";
  const independentAcceptance =
    argValue("--independent-acceptance") ||
    process.env.GITLEAKS_INDEPENDENT_ACCEPTANCE ||
    "ABSENT";

  const eventName =
    argValue("--event") || process.env.GITHUB_EVENT_NAME || "local";
  const eventBinding = resolveEventBinding({
    eventName,
    pullRequestBaseSha:
      argValue("--pr-base-sha") || process.env.GITLEAKS_PR_BASE_SHA,
    pullRequestHeadSha:
      argValue("--pr-head-sha") || process.env.GITLEAKS_PR_HEAD_SHA,
    mergeSha: argValue("--merge-sha") || process.env.GITHUB_SHA,
    pushBeforeSha:
      argValue("--push-before") || process.env.GITLEAKS_PUSH_BEFORE,
    pushAfterSha: argValue("--push-after") || process.env.GITLEAKS_PUSH_AFTER,
    dispatchSha: argValue("--dispatch-sha") || process.env.GITHUB_SHA,
  });

  // Explicit CLI overrides win; otherwise use event binding; never invent origin/main.
  let baseCommit =
    argValue("--base-commit") ||
    eventBinding.base_sha ||
    argValue("--base-ref") ||
    null;
  let sourceCommit =
    argValue("--source-commit") ||
    eventBinding.candidate_sha ||
    null;

  // Local non-CI invocation may bind HEAD explicitly; CI events must not invent.
  if (eventName === "local") {
    if (!sourceCommit) {
      sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();
    }
    if (!baseCommit) baseCommit = "HEAD";
  }

  if (!sourceCommit) {
    const report = {
      schema: "bizra.dema.gitleaks_dual_eval.v0.1",
      ok: false,
      BASE_POLICY: "UNKNOWN",
      CANDIDATE_POLICY: "UNKNOWN",
      POLICY_DELTA: false,
      INDEPENDENT_ACCEPTANCE: normalizeIndependentAcceptance(
        independentAcceptance,
      ),
      INDEPENDENT_ACCEPTANCE_REQUIRED: false,
      event_binding: eventBinding,
      reason: "candidate_commit_identity_unbound",
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  if (!baseCommit && eventName !== "local") {
    // workflow_dispatch / unbound push: do not invent a base.
    const candidatePath = join(sourceDir, ".gitleaks.toml");
    const candidateConfigText = existsSync(candidatePath)
      ? readFileSync(candidatePath, "utf8")
      : null;
    const report = buildDualEvalReport({
      baseConfigText: null,
      candidateConfigText,
      sourceCommit,
      baseCommit: null,
      sourceDir,
      gitleaksBin,
      independentAcceptance,
      eventBinding,
    });
    console.log(JSON.stringify(report, null, 2));
    console.error(
      "[gitleaks-dual-eval] Comparison base unbound for event " +
        `${eventName}. Returning UNKNOWN/BLOCK rather than inventing origin/main.`,
    );
    process.exit(report.exit_code);
  }

  const baseRefForShow = baseCommit || "HEAD";
  const baseConfigText = gitShowText(`${baseRefForShow}:.gitleaks.toml`);
  let candidateConfigText = null;
  const candidatePath = join(sourceDir, ".gitleaks.toml");
  if (existsSync(candidatePath)) {
    candidateConfigText = readFileSync(candidatePath, "utf8");
  }

  if (!candidateConfigText && !baseConfigText) {
    const report = {
      schema: "bizra.dema.gitleaks_dual_eval.v0.1",
      ok: false,
      BASE_POLICY: "UNKNOWN",
      CANDIDATE_POLICY: "UNKNOWN",
      POLICY_DELTA: false,
      INDEPENDENT_ACCEPTANCE_REQUIRED: false,
      INDEPENDENT_ACCEPTANCE: normalizeIndependentAcceptance(
        independentAcceptance,
      ),
      event_binding: eventBinding,
      reason: "no .gitleaks.toml on base or candidate",
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // No delta: single candidate evaluation (backward compatible with prior CI).
  if (
    baseConfigText &&
    candidateConfigText &&
    sha256Hex(Buffer.from(baseConfigText, "utf8")) ===
      sha256Hex(Buffer.from(candidateConfigText, "utf8"))
  ) {
    const status = runGitleaksDetect({
      configPath: candidatePath,
      sourceDir,
      gitleaksBin,
    });
    const decision = decideDualEval({
      basePolicy: status,
      candidatePolicy: status,
      policyDelta: false,
      independentAcceptance: "ABSENT",
    });
    const report = {
      schema: "bizra.dema.gitleaks_dual_eval.v0.1",
      verifier: { ...GITLEAKS_VERIFIER_CONTRACT, binary: gitleaksBin || null },
      event_binding: eventBinding,
      base_commit: baseCommit,
      base_config_sha256: sha256Hex(Buffer.from(baseConfigText, "utf8")),
      candidate_config_sha256: sha256Hex(
        Buffer.from(candidateConfigText, "utf8"),
      ),
      source_commit: sourceCommit,
      ...decision,
      mode: "single_policy_unchanged",
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.exit_code);
  }

  const report = buildDualEvalReport({
    baseConfigText,
    candidateConfigText,
    sourceCommit,
    baseCommit,
    sourceDir,
    gitleaksBin,
    independentAcceptance,
    eventBinding,
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.POLICY_DELTA && !report.ok) {
    console.error(
      "[gitleaks-dual-eval] POLICY_DELTA requires BASE=PASS AND CANDIDATE=PASS " +
        "AND INDEPENDENT_ACCEPTANCE=VERIFIED. " +
        `Got BASE=${report.BASE_POLICY} CANDIDATE=${report.CANDIDATE_POLICY} ` +
        `INDEPENDENT_ACCEPTANCE=${report.INDEPENDENT_ACCEPTANCE}. Failing closed.`,
    );
  }
  process.exit(report.exit_code);
}
