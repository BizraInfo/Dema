// AWAY-CONTRACT-CLI-DRAFT-1A — `dema away draft` CLI.
//
// Exposes the pure Away Contract compiler (packages/core/src/away-contract-compiler.js).
// Draft only: intent comes from an explicit JSON file (no natural language, no
// model call, nothing inferred), act-time comes from the explicit --now flag
// (no wall-clock read), and the ONLY filesystem touch is READING the intent
// file. No verify, no receipt, no DEMA_HOME requirement, no Away Mode start.

import { readFileSync } from "node:fs";

import { compileAwayContractIntent } from "../../../../packages/core/src/away-contract-compiler.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function renderHuman(result) {
  const lines = [
    "DEMA · AWAY CONTRACT DRAFT — COMPILATION ONLY",
    `truth_label: ${result.truth_label}`,
    `verdict: ${result.compiled ? "COMPILED" : "REJECTED"}`,
    `contract_id: ${result.contract_id ?? "-"}`,
    `contract_hash: ${result.contract_hash ?? "-"}`,
  ];
  if (result.contract) {
    lines.push(`mission_scope: ${result.contract.mission_scope}`);
    lines.push(`allowed_actions: ${result.contract.allowed_actions.join(", ")}`);
  }
  if (result.blocked_by.length > 0) {
    lines.push(`blocked_by: ${result.blocked_by.join(", ")}`);
  }
  if (result.warnings.length > 0) {
    lines.push(`warnings: ${result.warnings.join(", ")}`);
  }
  lines.push(
    `boundary: ${Object.entries(result.boundary)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ")}`,
  );
  lines.push("Draft only. No Away Mode started.");
  return lines.join("\n");
}

function cmd_away_draft(argv) {
  const wantJson = argv.includes("--json");

  const intentFile = argValue(argv, "--intent-file");
  if (!intentFile) {
    console.error(
      'usage: dema away draft --intent-file <intent.json> --now <iso> [--contract-id-prefix <prefix>] [--json]',
    );
    process.exitCode = 1;
    return;
  }
  const nowIso = argValue(argv, "--now");
  if (!nowIso) {
    console.error(
      "Dema error: --now <iso> is required — act-time is declared, never read from the clock.",
    );
    process.exitCode = 1;
    return;
  }

  let raw;
  try {
    raw = readFileSync(intentFile, "utf8");
  } catch (e) {
    console.error(`Dema error: cannot read intent file (${e.code ?? e.message}).`);
    process.exitCode = 1;
    return;
  }

  let intent;
  try {
    intent = JSON.parse(raw);
  } catch {
    console.error("Dema error: intent file is not valid JSON (invalid_json).");
    process.exitCode = 1;
    return;
  }

  const result = compileAwayContractIntent(intent, {
    now_iso: nowIso,
    contract_id_prefix: argValue(argv, "--contract-id-prefix") ?? "away",
  });

  if (wantJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderHuman(result));
  }
  if (!result.compiled) process.exitCode = 1;
}

export async function cmd_away(ctx) {
  const { argv } = ctx;
  if (argv[1] === "draft") return cmd_away_draft(argv);
  console.error(
    'Dema error: unknown away subcommand. Use `dema away draft --intent-file <intent.json> --now <iso>` (draft only).',
  );
  process.exitCode = 1;
}
