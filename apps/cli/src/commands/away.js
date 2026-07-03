// AWAY-CONTRACT-CLI-DRAFT-1A + AWAY-CONTRACT-CLI-VERIFY-1A — `dema away` CLI.
//
// Two read-only rungs of the ADR-043 ladder:
//   draft  — pure compiler (packages/core/src/away-contract-compiler.js):
//            explicit JSON intent → draft contract body.
//   verify — body-bound verifier (packages/core/src/away-contract-verify.js):
//            contract + validation_result files → binding verdict.
// Both: act-time from the explicit --now flag (no wall-clock read); the ONLY
// filesystem touch is READING the given files. No receipt, no DEMA_HOME
// requirement, no model call, no network, no Away Mode start.

import { readFileSync } from "node:fs";

import { compileAwayContractIntent } from "../../../../packages/core/src/away-contract-compiler.js";
import { verifyAwayContract } from "../../../../packages/core/src/away-contract-verify.js";

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

function readJsonFile(path, label) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    console.error(`Dema error: cannot read ${label} file (${e.code ?? e.message}).`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`Dema error: ${label} file is not valid JSON (invalid_json).`);
    return null;
  }
}

function renderVerifyHuman(result) {
  const lines = [
    "DEMA · AWAY CONTRACT VERIFY — BODY-BOUND CHECK ONLY",
    `truth_label: ${result.truth_label}`,
    `verdict: ${result.valid ? "VERIFIED" : "REJECTED"}`,
    `contract_id: ${result.contract_id ?? "-"}`,
    `contract_hash: ${result.contract_hash ?? "-"}`,
    `contract_hash_matches: ${result.verification.contract_hash_matches}`,
    `normalized_body_matches: ${result.verification.normalized_body_matches}`,
    `launder_attempt_detected: ${result.verification.launder_attempt_detected}`,
  ];
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
  lines.push("Verify only. No Away Mode started.");
  return lines.join("\n");
}

function cmd_away_verify(argv) {
  const wantJson = argv.includes("--json");

  const contractFile = argValue(argv, "--contract-file");
  if (!contractFile) {
    console.error(
      'usage: dema away verify --contract-file <contract.json> --validation-file <validation.json> --now <iso> [--json]',
    );
    process.exitCode = 1;
    return;
  }
  const validationFile = argValue(argv, "--validation-file");
  if (!validationFile) {
    console.error(
      "Dema error: --validation-file <validation.json> is required — verify never infers a validation_result.",
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

  const contract = readJsonFile(contractFile, "contract");
  if (contract === null) {
    process.exitCode = 1;
    return;
  }
  const validation_result = readJsonFile(validationFile, "validation");
  if (validation_result === null) {
    process.exitCode = 1;
    return;
  }

  const result = verifyAwayContract({ contract, validation_result }, { now_iso: nowIso });

  if (wantJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderVerifyHuman(result));
  }
  if (!result.valid) process.exitCode = 1;
}

export async function cmd_away(ctx) {
  const { argv } = ctx;
  if (argv[1] === "draft") return cmd_away_draft(argv);
  if (argv[1] === "verify") return cmd_away_verify(argv);
  console.error(
    'Dema error: unknown away subcommand. Use `dema away draft --intent-file <intent.json> --now <iso>` or `dema away verify --contract-file <contract.json> --validation-file <validation.json> --now <iso>` — draft and verify only; nothing starts.',
  );
  process.exitCode = 1;
}
