#!/usr/bin/env node
/**
 * CLAUDE-OPERATING-LAYER-1A · PreToolUse boundary hook (REPORT-ONLY).
 * Logs risky patterns; does not block. Switch to deny mode in a future slice.
 */
import {
  appendJsonl,
  readHookInput,
  reportOnlyOutput,
} from "./hook-lib.mjs";

const MODE = process.env.DEMA_HOOK_BOUNDARY_MODE ?? "report-only";

const BASH_RISK_PATTERNS = [
  { id: "git_reset_hard", re: /\bgit\s+reset\s+--hard\b/ },
  { id: "git_force_push", re: /\bgit\s+push\b[^\n]*--force\b/ },
  { id: "rm_rf", re: /\brm\s+(-[^\s]*f[^\s]*\s+)*-[^\s]*r|rm\s+-rf\b/ },
  { id: "keygen", re: /\b(ssh-keygen|openssl\s+genpkey|dema\s+authorship\s+demo)\b/ },
  { id: "daemon_start", re: /\b(start_proactive|node0_activate\.py\s+start)\b/ },
];

const EDIT_SENSITIVE = [
  /sealed-manifest/i,
  /proof-of-priority\/manifest\.json$/,
];

function analyzeBash(command = "") {
  return BASH_RISK_PATTERNS.filter((p) => p.re.test(command)).map((p) => p.id);
}

function analyzeEdit(filePath = "") {
  return EDIT_SENSITIVE.some((re) => re.test(filePath)) ? ["sealed_or_priority_manifest"] : [];
}

async function main() {
  const input = await readHookInput();
  const toolName = input.tool_name ?? input.toolName ?? "";
  const toolInput = input.tool_input ?? input.toolInput ?? {};
  const findings = [];

  if (toolName === "Bash") {
    const command = toolInput.command ?? "";
    findings.push(...analyzeBash(command));
  }

  if (toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") {
    const path = toolInput.file_path ?? toolInput.path ?? "";
    if (analyzeEdit(path).length) findings.push("sealed_or_priority_manifest");
  }

  if (findings.length) {
    appendJsonl("pretool-boundary.jsonl", {
      mode: MODE,
      hook: "pretool-boundary",
      tool_name: toolName,
      findings,
      session_id: input.session_id,
      cwd: input.cwd,
    });
  }

  if (MODE === "block" && findings.length) {
    process.stdout.write(
      `${JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Boundary hook blocked: ${findings.join(", ")}`,
        },
      })}\n`,
    );
    process.exit(0);
  }

  if (findings.length) {
    reportOnlyOutput({
      hookEventName: "PreToolUse",
      systemMessage: `[Dema boundary · report-only] flagged: ${findings.join(", ")}`,
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(0);
});
