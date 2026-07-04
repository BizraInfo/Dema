#!/usr/bin/env node
/**
 * CLAUDE-OPERATING-LAYER-1A · PostToolUse proof log (REPORT-ONLY).
 * Appends tool-use audit lines for closeout / forensics. Never blocks.
 */
import { appendJsonl, readHookInput } from "./hook-lib.mjs";

async function main() {
  const input = await readHookInput();
  const toolName = input.tool_name ?? input.toolName ?? "";
  const toolInput = input.tool_input ?? input.toolInput ?? {};

  appendJsonl("posttool-proof-log.jsonl", {
    hook: "posttool-proof-log",
    tool_name: toolName,
    session_id: input.session_id,
    cwd: input.cwd,
    summary:
      toolName === "Bash"
        ? (toolInput.command ?? "").slice(0, 500)
        : toolInput.file_path ?? toolInput.path ?? null,
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(0);
});
