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
    throw new Error("requestApproval: action (string) is required");
  }
  if (!autonomyLevel || typeof autonomyLevel !== "string") {
    throw new Error("requestApproval: autonomyLevel (string) is required");
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

  throw new Error(`requestApproval: unknown autonomyLevel: ${autonomyLevel} (expected L0-L5)`);
}

// Helper: parse a task's autonomy_level string ("L0/L1", "L3", "L0", etc.)
// into the highest numeric level. Used by callers that want to decide
// whether the gate fires at all.
export function highestLevel(autonomyLevelString) {
  if (typeof autonomyLevelString !== "string") return 0;
  const matches = autonomyLevelString.match(/L(\d)/g) ?? [];
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((m) => parseInt(m.slice(1), 10)));
}

export function levelLabel(numericLevel) {
  return `L${numericLevel}`;
}
