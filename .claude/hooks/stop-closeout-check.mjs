#!/usr/bin/env node
/**
 * CLAUDE-OPERATING-LAYER-1B · Stop hook closeout checker (REPORT-ONLY).
 * Nudges when the assistant turn lacks Dema closeout fields. Does not block by default.
 */
import { appendJsonl, readHookInput } from "./hook-lib.mjs";

const MODE = process.env.DEMA_HOOK_CLOSEOUT_MODE ?? "report-only";

// Self-contained (CLAUDE-OPERATING-LAYER-1C kernel was discarded as NOT_MERGED
// orphan work — see /data/bizra/logs/orphan-operating-layer-1c-*.tgz).
const CLOSEOUT_REQUIRED_FIELDS = Object.freeze([
  { id: "what_changed", re: /what changed/i },
  { id: "what_proof_ran", re: /what proof ran|proof ran/i },
  { id: "what_did_not_happen", re: /what did not happen|did not happen/i },
  { id: "what_remains_blocked", re: /what remains blocked|remains blocked|blocked/i },
  { id: "next_safe_action", re: /next safe action/i },
]);

function missingCloseoutFields(text) {
  return CLOSEOUT_REQUIRED_FIELDS.filter((p) => !p.re.test(text)).map((p) => p.id);
}

function extractText(input) {
  const msg = input.last_assistant_message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) {
    return msg
      .map((part) => (typeof part === "string" ? part : part?.text ?? ""))
      .join("\n");
  }
  return "";
}

function missingFromText(text) {
  return missingCloseoutFields(text);
}

async function main() {
  const input = await readHookInput();
  const text = extractText(input);
  const missing = missingFromText(text);

  if (missing.length) {
    appendJsonl("stop-closeout-check.jsonl", {
      mode: MODE,
      hook: "stop-closeout-check",
      missing,
      session_id: input.session_id,
    });
  }

  if (MODE === "block" && missing.length) {
    process.stdout.write(
      `${JSON.stringify({
        decision: "block",
        reason: `Closeout incomplete — missing: ${missing.join(", ")}. Use skill proof-closeout.`,
      })}\n`,
    );
    process.exit(0);
  }

  if (missing.length) {
    // Stop hooks must remain stdout-silent when report-only. `{}` is JSON, but
    // not a valid Stop decision payload for the host hook protocol.
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(0);
});
