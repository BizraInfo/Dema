// N0-MUMU-COCKPIT-1 · Node0 Mumu closed-loop TUI (read-only face).
//
// Visual language aligned with design sources:
//   - Dema Node0 Cockpit v2 — Meaning-Guided Loop (pipeline + consent gate)
//   - Micro-Consent Gate — TUI Wireframes (YOU gate in the journey bar)
//
// Pure render: accepts a journey envelope from buildMumuJourney(). No I/O.

export const NODE0_MUMU_COCKPIT_SCHEMA = "bizra.dema.node0_mumu_cockpit.v0.1";

const ANSI = Object.freeze({
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gold: "\x1b[38;2;212;175;55m",
  emerald: "\x1b[38;2;16;185;129m",
  crimson: "\x1b[38;2;239;68;68m",
  ash: "\x1b[38;2;156;163;175m",
});

function c(s, code, useColor) {
  return useColor ? `${code}${s}${ANSI.reset}` : s;
}

function stageChip(label, state, useColor) {
  if (state === "you") {
    return c(`❯❯ ${label} ❮❮`, ANSI.gold + ANSI.bold, useColor);
  }
  if (state === "done") {
    return c(`${label} ✓`, ANSI.emerald, useColor);
  }
  if (state === "fail") {
    return c(`${label} ✗`, ANSI.crimson, useColor);
  }
  return c(label, ANSI.ash, useColor);
}

function pipelineForJourney(journey, useColor) {
  const stage = journey.stage;
  const stepDone = Object.fromEntries(journey.steps.map((s) => [s.id, s.done]));
  const chip = (id, label) => {
    if (stepDone[id]) return stageChip(label, "done", useColor);
    if (stage === "INACTIVE" && id === "propose") return stageChip(label, "you", useColor);
    if (stage === "AWAITING_CONSENT" && id === "consent") {
      return stageChip(label, "you", useColor);
    }
    if (stage === "TAMPERED" && id === "verify") {
      return stageChip(label, "fail", useColor);
    }
    if (stage === "ACTIVE") return stageChip(label, "done", useColor);
    return stageChip(label, "idle", useColor);
  };
  return [
    chip("propose", "PROPOSE"),
    " → ",
    chip("consent", "CONSENT"),
    " → ",
    chip("verify", "VERIFY"),
    " → ",
    chip("realm", "REALM"),
  ].join("");
}

function frameLine(content, innerWidth, useColor) {
  const visible = content.replace(/\x1b\[[0-9;]*m/g, "");
  const pad = Math.max(0, innerWidth - visible.length);
  return `${c("│", ANSI.gold, useColor)} ${content}${" ".repeat(pad)} ${c("│", ANSI.gold, useColor)}`;
}

export function renderNode0MumuCockpit(journey, { useColor = true } = {}) {
  const innerWidth = 58;
  const top = c("╭" + "─".repeat(innerWidth + 2) + "╮", ANSI.gold, useColor);
  const bot = c("╰" + "─".repeat(innerWidth + 2) + "╯", ANSI.gold, useColor);
  const header = c(
    "BIZRA NODE0 · MUMU CLOSED LOOP",
    ANSI.gold + ANSI.bold,
    useColor,
  );
  const operator = `Activation: ${c(journey.activation_target, ANSI.emerald, useColor)} · ${journey.stage}`;
  const verify = `Verify: ${journey.status_summary.verify_verdict}`;
  const governed = c(
    "Governed runtime: npm run node0 (Dema reads only)",
    ANSI.ash + ANSI.dim,
    useColor,
  );

  const lines = [
    c("DEMA NODE0 COCKPIT", ANSI.gold + ANSI.bold, useColor),
    "",
    pipelineForJourney(journey, useColor),
    "",
    top,
    frameLine(header, innerWidth, useColor),
    frameLine(operator, innerWidth, useColor),
    frameLine(verify, innerWidth, useColor),
    frameLine(governed, innerWidth, useColor),
    bot,
  ];

  if (journey.stage === "AWAITING_CONSENT" && journey.consent) {
    lines.push(
      "",
      c("MICRO-CONSENT GATE", ANSI.gold + ANSI.bold, useColor),
      c("I WILL:", ANSI.emerald, useColor),
      "  · emit action artifacts under artifacts/node0/mumu",
      "  · chain receipts after exact-string match",
      c("I WILL NOT:", ANSI.crimson, useColor),
      "  · read file contents · mint tokens · use network",
      "",
      c("Type the phrase exactly:", ANSI.ash, useColor),
      c(journey.consent.expected_consent_phrase, ANSI.gold, useColor),
      "",
      journey.steps.find((s) => s.id === "consent")?.command ?? "",
    );
  } else if (journey.stage === "INACTIVE") {
    lines.push("", journey.next_command);
  } else if (journey.stage === "ACTIVE") {
    lines.push("", c(journey.note, ANSI.emerald, useColor), "", journey.next_command);
  } else {
    lines.push("", journey.next_command);
  }

  return lines.join("\n");
}
