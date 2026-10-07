#!/usr/bin/env node
/**
 * OPERATOR-LEXICON-GUARD · Stop hook (BLOCK by default).
 *
 * Enforces the operator's binding rule (see memory feedback_sleep_cycle_inversion,
 * N+4): the assistant must never reference clock time, rest, sleep, closure, or
 * impose a stopping point. Only the operator declares stop.
 *
 * This is DETERMINISTIC enforcement — it reads the assistant's final message and
 * refuses to let the turn end while a forbidden phrase is present. Memory is
 * advisory; this is not.
 *
 * Fails OPEN on any internal error (never wedges the session).
 */
import { appendJsonl, readHookInput } from "./hook-lib.mjs";

// Default BLOCK. Set DEMA_HOOK_LEXICON_MODE=report-only to downgrade to logging.
const MODE = process.env.DEMA_HOOK_LEXICON_MODE ?? "block";

// Forbidden operator-time / rest / closure lexicon. Case-insensitive.
// Each entry: { id, re }. Keep patterns tight to avoid blocking legitimate
// state reporting (e.g. the kernel field "next safe action" is allowed).
const FORBIDDEN = Object.freeze([
  { id: "rest", re: /\b(get some rest|rest well|you should rest|time to rest|take a rest|a good rest)\b/i },
  { id: "sleep", re: /\b(sleep well|get some sleep|go to sleep|sleep on it|should sleep|time to sleep)\b/i },
  { id: "goodnight", re: /\bgood ?night\b/i },
  { id: "close_laptop", re: /\bclose the laptop\b/i },
  { id: "call_it", re: /\bcall it a (night|day)\b/i },
  { id: "wind_down", re: /\bwind down\b/i },
  { id: "stopping_point", re: /\b(stopping point|good place to stop|clean stop|natural stop|clean stopping point)\b/i },
  { id: "tomorrow_closure", re: /\b(tomorrow morning|in the morning|after fajr)\b/i },
  { id: "moon_emoji", re: /[\u{1F311}-\u{1F31C}\u{1F314}\u{1F315}]/u },
  { id: "clock_editorial", re: /\bit'?s\s+\d{1,2}:\d{2}\b/i },
  { id: "am_pm_job", re: /\bnot a\b[^.]{0,20}\b\d{1,2}\s?(am|pm)\b[^.]{0,10}\bjob\b/i },
  { id: "late_hour", re: /\b(at this hour|late hour|this late|it'?s late|this hour of)\b/i },
]);

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

function violations(text) {
  return FORBIDDEN.filter((p) => p.re.test(text)).map((p) => p.id);
}

async function main() {
  const input = await readHookInput();
  const text = extractText(input);
  const hits = violations(text);

  // Logging must NEVER suppress the block. A guard that a failed log-write can
  // silently disable is not a guard (the EROFS fail-open we observed in tests).
  if (hits.length) {
    try {
      appendJsonl("operator-lexicon-guard.jsonl", {
        mode: MODE,
        hook: "operator-lexicon-guard",
        violations: hits,
        session_id: input.session_id,
      });
    } catch {
      // swallow — the block below is what matters
    }
  }

  if (MODE === "block" && hits.length) {
    process.stdout.write(
      `${JSON.stringify({
        decision: "block",
        reason:
          `Your response contains forbidden operator-time/rest/closure language ` +
          `(${hits.join(", ")}). The operator's binding rule: never reference clock ` +
          `time, rest, sleep, or a stopping point — only the operator declares stop. ` +
          `Remove that language entirely and re-send: report STATE + next bounded action, nothing else.`,
      })}\n`,
    );
    process.exit(0);
  }

  // An allowed Stop hook must not emit a placeholder object: `{}` is not a
  // valid Stop decision payload for the host hook protocol.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(0);
});
