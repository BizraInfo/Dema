// AWAY-CONTRACT CLI — `dema away draft | verify | receipt` (ADR-043 ladder).
//
//   draft   — pure compiler (away-contract-compiler.js): explicit JSON intent
//             → draft contract body. Read-only.
//   verify  — body-bound verifier (away-contract-verify.js): contract +
//             validation_result files → binding verdict. Read-only.
//   receipt — consent-gated writer (away-contract-receipt.js): exact phrase
//             `GO: write away-contract receipt <id> <hash12>` required; the
//             ONLY write is one receipt under $DEMA_HOME/away-contracts/
//             receipts (atomic, no overwrite).
// All rungs: act-time from the explicit --now flag (no wall-clock read); no
// model call, no network, no Away Mode start. Recording a receipt is not
// starting work.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { compileAwayContractIntent } from "../../../../packages/core/src/away-contract-compiler.js";
import { verifyAwayContract } from "../../../../packages/core/src/away-contract-verify.js";
import { writeAwayContractReceipt } from "../../../../packages/core/src/away-contract-receipt.js";

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

function renderReceiptHuman(result) {
  const lines = [
    "DEMA · AWAY CONTRACT RECEIPT — CONSENTED RECORD ONLY",
    `truth_label: ${result.truth_label}`,
    `verdict: ${result.written ? "WRITTEN" : "REJECTED"}`,
    `contract_id: ${result.contract_id ?? "-"}`,
    `contract_hash: ${result.contract_hash ?? "-"}`,
    `receipt_path: ${result.receipt_path ?? "-"}`,
    `receipt_hash: ${result.receipt_hash ?? "-"}`,
  ];
  if (result.blocked_by.length > 0) {
    lines.push(`blocked_by: ${result.blocked_by.join(", ")}`);
  }
  if (!result.written && result.expected_consent) {
    lines.push(`expected_consent: ${result.expected_consent}`);
  }
  lines.push(
    `boundary: ${Object.entries(result.boundary)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ")}`,
  );
  lines.push("Receipt only. No Away Mode started.");
  return lines.join("\n");
}

async function cmd_away_receipt(argv) {
  const wantJson = argv.includes("--json");

  const contractFile = argValue(argv, "--contract-file");
  if (!contractFile) {
    console.error(
      'usage: dema away receipt --contract-file <contract.json> --validation-file <validation.json> --now <iso> --consent "<exact phrase>" [--json]',
    );
    process.exitCode = 1;
    return;
  }
  const validationFile = argValue(argv, "--validation-file");
  if (!validationFile) {
    console.error(
      "Dema error: --validation-file <validation.json> is required — the receipt binds to a verified pair.",
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

  // Verify-before-write: the CLI derives the verify verdict itself (read-only)
  // and hands the whole trio to the fail-closed writer.
  const verify_result = verifyAwayContract({ contract, validation_result }, { now_iso: nowIso });
  const home = process.env.DEMA_HOME || join(homedir(), ".dema");

  const result = await writeAwayContractReceipt(
    {
      contract,
      validation_result,
      verify_result,
      typed_go: argValue(argv, "--consent"),
    },
    { dema_home: home, now_iso: nowIso },
  );

  if (wantJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderReceiptHuman(result));
  }
  if (!result.written) process.exitCode = 1;
}

export async function cmd_away(ctx) {
  const { argv } = ctx;
  if (argv[1] === "draft") return cmd_away_draft(argv);
  if (argv[1] === "verify") return cmd_away_verify(argv);
  if (argv[1] === "receipt") return cmd_away_receipt(argv);
  console.error(
    'Dema error: unknown away subcommand. Use `dema away draft --intent-file <intent.json> --now <iso>`, `dema away verify --contract-file <contract.json> --validation-file <validation.json> --now <iso>`, or `dema away receipt … --consent "<exact phrase>"` — draft, verify, and receipt only; nothing starts.',
  );
  process.exitCode = 1;
}
