// Interactive approval gate per the Dema Autonomy Envelope v0.1.
//
// Behavior matrix (from the B1.2 design):
//   L0 / L1 / L2  → no prompt; auto-approve (below the threshold that
//                    requires consent collection per the envelope)
//   L3            → prompts "Approve <action>? [y/N]: "; accepts y/yes/
//                    proceed (case-insensitive); silence/EOF/anything
//                    else = no
//   L4            → routes through packages/fate/src/fate.js
//                    evaluateConsent() — operator must type the
//                    requireExactPhrase byte-for-byte
//   L5            → unconditionally REFUSED from the interactive shell;
//                    L5 acts (push to main, ots stamp, identity-bound
//                    artifacts, federation handshake, public posting)
//                    require a typed in-the-moment GO outside the shell
//                    context per anti-pattern #5 (cloud/relay laundering)
//
// Rejective by default. Silence = no. The gate is the BEFORE side; the
// SAT verifier (placeholder in v0.3.0, real in v0.3.2) is the AFTER side.

import { createInterface } from "node:readline";
import { evaluateConsent } from "../../fate/src/fate.js";

export const APPROVAL_SCHEMA = "bizra.dema.approval_verdict.v0.1";

const L3_AFFIRMATIVE = new Set(["y", "yes", "proceed"]);

async function readOneLine(input, output, prompt) {
  output.write(prompt);
  return new Promise((resolve) => {
    const rl = createInterface({ input, output, terminal: false });
    let received = null;
    rl.on("line", (line) => {
      received = line;
      rl.close();
    });
    rl.on("close", () => resolve(received));
  });
}

function envelopeBase({ autonomyLevel, action, scope, target, mode, approved, refusedReason, input }) {
  return {
    schema: APPROVAL_SCHEMA,
    autonomy_level: autonomyLevel,
    action,
    scope: scope ?? null,
    target: target ?? null,
    mode,
    approved,
    refused_reason: refusedReason ?? null,
    input: input ?? null,
    decided_at: new Date().toISOString()
  };
}

export async function requestApproval({
  autonomyLevel,
  action,
  scope,
  target,
  requireExactPhrase,
  input = process.stdin,
  output = process.stdout
} = {}) {
  if (!action || typeof action !== "string") {
    // `action` is the human-readable label of what's being gated. Missing
    // it is a programming bug, not a safety situation — throw so the
    // caller surfaces it loudly. The autonomy level below, by contrast,
    // is the security-relevant axis and must fail-closed (refusal envelope).
    throw new Error("requestApproval: action (string) is required");
  }
  if (!autonomyLevel || typeof autonomyLevel !== "string") {
    return envelopeBase({
      autonomyLevel: autonomyLevel ?? null,
      action,
      scope,
      target,
      mode: "refused",
      approved: false,
      refusedReason:
        "autonomyLevel is missing or non-string. Refused by default per A4.5 fail-closed rule (rejective by default).",
      input: null
    });
  }

  if (autonomyLevel === "L0" || autonomyLevel === "L1" || autonomyLevel === "L2") {
    return envelopeBase({
      autonomyLevel,
      action,
      scope,
      target,
      mode: "auto",
      approved: true,
      refusedReason: null,
      input: null
    });
  }

  if (autonomyLevel === "L3") {
    const promptText = `Approve ${action}${scope ? ` (scope: ${scope})` : ""}? [y/N]: `;
    const received = await readOneLine(input, output, promptText);
    const normalized = (received ?? "").trim().toLowerCase();
    const approved = L3_AFFIRMATIVE.has(normalized);
    return envelopeBase({
      autonomyLevel,
      action,
      scope,
      target,
      mode: "interactive",
      approved,
      refusedReason: approved ? null : "no affirmative response (silence, EOF, or non-y/yes/proceed input)",
      input: received
    });
  }

  if (autonomyLevel === "L4") {
    if (!requireExactPhrase || typeof requireExactPhrase !== "string") {
      return envelopeBase({
        autonomyLevel,
        action,
        scope,
        target,
        mode: "exact_phrase",
        approved: false,
        refusedReason: "L4 approval requires requireExactPhrase argument; none provided",
        input: null
      });
    }
    const promptText =
      `L4 governed mutation: ${action}\n` +
      `Type the EXACT consent phrase to authorize:\n` +
      `  ${requireExactPhrase}\n` +
      `> `;
    const received = await readOneLine(input, output, promptText);
    const verdict = evaluateConsent({ phrase: received ?? "", requiredPhrase: requireExactPhrase });
    return envelopeBase({
      autonomyLevel,
      action,
      scope,
      target,
      mode: "exact_phrase",
      approved: verdict.accepted,
      refusedReason: verdict.accepted ? null : verdict.reason,
      input: received
    });
  }

  if (autonomyLevel === "L5") {
    return envelopeBase({
      autonomyLevel,
      action,
      scope,
      target,
      mode: "refused",
      approved: false,
      refusedReason:
        "L5 acts cannot be approved from the interactive shell — they require a typed in-the-moment GO outside the shell context (push to main, GitHub PR, ots stamp, identity-bound artifacts, federation handshake, public posting). See docs/02-architecture/dema-autonomy-envelope.md anti-pattern #5.",
      input: null
    });
  }

  // Fail-closed: any value not exactly L0..L5 is refused, not thrown.
  // Throwing makes the caller responsible for catching every malformed
  // input; refusing-by-default is the doctrine (A4.5 §"Core law":
  // "Rejective by default. Silence = no.").
  return envelopeBase({
    autonomyLevel,
    action,
    scope,
    target,
    mode: "refused",
    approved: false,
    refusedReason: `unknown autonomyLevel: ${JSON.stringify(autonomyLevel)} (expected L0-L5). Refused by default per A4.5 fail-closed rule.`,
    input: null
  });
}

// Helper: parse a task's autonomy_level string ("L0/L1", "L3", "L0", etc.)
// into the highest numeric level. Strict regex — L0..L5 only, word-bounded.
// Returns null on any input that does not contain at least one valid token,
// so callers can fail-closed on malformed values rather than silently
// downgrading them to L0 (the original implementation's fail-open path
// flagged by CodeRabbit + GitHub Copilot + ChatGPT Codex on PR #16).
const STRICT_LEVEL_TOKEN = /\bL([0-5])\b/g;

export function highestLevel(autonomyLevelString) {
  if (typeof autonomyLevelString !== "string") return null;
  const matches = [...autonomyLevelString.matchAll(STRICT_LEVEL_TOKEN)].map(
    (m) => parseInt(m[1], 10)
  );
  if (matches.length === 0) return null;
  return Math.max(...matches);
}

export function levelLabel(numericLevel) {
  return `L${numericLevel}`;
}
