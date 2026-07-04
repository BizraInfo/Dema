import { open, readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";

import {
  buildFounderWorkIndexReceiptEnvelope,
  buildFounderWorkIndexReport,
  expectedContentReadConsent,
} from "../../../../packages/core/src/founder-work-indexer.js";
import {
  buildFounderWorkEvidenceCard,
  formatFounderWorkEvidenceCard,
} from "../../../../packages/core/src/founder-work-evidence-card.js";
import {
  saveFounderWorkIndex,
  serializeFounderWorkIndexForSave,
} from "../../../../packages/receipts/src/founder-work-index-save.js";
import {
  buildProofOfSpendReceiptEnvelope,
  buildProofOfSpendReport,
  expectedContentReadConsent as expectedSpendConsent,
  verifyProofOfSpendReport,
  serializeProofOfSpendForSave,
} from "../../../../packages/core/src/proof-of-spend-1a.js";
import {
  saveProofOfSpend,
} from "../../../../packages/receipts/src/proof-of-spend-save.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function cmd_corpus_index(argv, json) {
  const filePath = argValue(argv, "--file");
  const offeredConsent = argValue(argv, "--consent") ?? null;

  if (!filePath) {
    process.stderr.write("dema corpus index: --file <abs_path> is required\n");
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (!isAbsolute(filePath)) {
    process.stderr.write(
      `dema corpus index: --file must be an absolute path (got: ${filePath})\n`,
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const absPath = resolve(filePath);
  let fileStat;
  let sourceHandle;
  try {
    sourceHandle = await open(absPath, "r");
    fileStat = await sourceHandle.stat();
  } catch (err) {
    const message = err?.code === "ENOENT" ? "file_not_found" : "stat_failed";
    if (json) {
      console.log(
        JSON.stringify(
          {
            refused: true,
            reason_code: message,
            source_file: absPath,
          },
          null,
          2,
        ),
      );
    } else {
      process.stderr.write(`dema corpus index: ${message}: ${absPath}\n`);
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (fileStat.isDirectory()) {
    const report = buildFounderWorkIndexReport({
      sourceFile: absPath,
      sourceSha256: "",
      sourceText: "",
      offeredConsent,
      inputKind: "directory",
    });
    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stderr.write(
        `Refused — corpus index accepts exactly one file, not a directory.\nExpected consent: ${expectedContentReadConsent(absPath)}\n`,
      );
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const sourceText = await sourceHandle.readFile({ encoding: "utf8" });
  await sourceHandle.close();
  const sourceSha256 = sha256Hex(sourceText);
  const report = buildFounderWorkIndexReport({
    sourceFile: absPath,
    sourceSha256,
    sourceText,
    offeredConsent,
    generatedAt: new Date().toISOString(),
    inputKind: "file",
  });

  if (!report.index_allowed) {
    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      const lines = [
        "DEMA · CORPUS INDEX — REFUSED",
        `reason: ${report.reason_code}`,
        `expected consent: ${report.expected_consent_phrase}`,
      ];
      console.log(lines.join("\n"));
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const envelope = buildFounderWorkIndexReceiptEnvelope(report, {
    generatedAt: report.generated_at,
  });
  const saveResult = await saveFounderWorkIndex(envelope, {
    demaHome: process.env.DEMA_HOME,
    pretty: false,
  });

  if (!saveResult.saved) {
    if (json) {
      console.log(
        JSON.stringify({ report, save: saveResult, saved: false }, null, 2),
      );
    } else {
      process.stderr.write(
        `dema corpus index: failed to seal receipt (${saveResult.reason})\n`,
      );
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const output = {
    ...report,
    receipt: Object.freeze({
      path: saveResult.path,
      sha256: saveResult.sha256,
      no_mint: true,
    }),
  };

  if (json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    const body = serializeFounderWorkIndexForSave(envelope, { pretty: false });
    console.log(
      [
        "DEMA · CORPUS INDEX — SEALED",
        `file: ${absPath}`,
        `facts: ${report.fact_count}`,
        `rejected_unprovenanced: ${report.rejected_unprovenanced}`,
        `index_hash: ${report.index_hash}`,
        `receipt_sha256: ${saveResult.sha256}`,
        `receipt_path: ${saveResult.path}`,
        "no_mint: true",
        "",
        "Boundary: single-file content read under exact consent · deterministic extraction · no model · no network.",
      ].join("\n"),
    );
    if (process.env.DEMA_CORPUS_INDEX_STDOUT_ENVELOPE === "1") {
      process.stdout.write(body);
    }
  }
  process.exit(process.exitCode ?? 0);
}

async function cmd_corpus_review(argv, json) {
  const receiptPath = argValue(argv, "--receipt");

  if (!receiptPath) {
    process.stderr.write(
      "dema corpus review: --receipt <abs_path_to_founder_work_index.json> is required\n",
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (!isAbsolute(receiptPath)) {
    process.stderr.write(
      `dema corpus review: --receipt must be an absolute path (got: ${receiptPath})\n`,
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const absPath = resolve(receiptPath);
  let raw;
  try {
    raw = await readFile(absPath, "utf8");
  } catch (err) {
    const message = err?.code === "ENOENT" ? "receipt_not_found" : "read_failed";
    if (json) {
      console.log(
        JSON.stringify({ refused: true, reason_code: message, receipt: absPath }, null, 2),
      );
    } else {
      process.stderr.write(`dema corpus review: ${message}: ${absPath}\n`);
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    if (json) {
      console.log(
        JSON.stringify({ refused: true, reason_code: "invalid_json", receipt: absPath }, null, 2),
      );
    } else {
      process.stderr.write(`dema corpus review: invalid_json: ${absPath}\n`);
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  let card;
  try {
    card = buildFounderWorkEvidenceCard(envelope);
  } catch (err) {
    const reason = err?.message ?? "review_failed";
    if (json) {
      console.log(
        JSON.stringify({ refused: true, reason_code: reason, receipt: absPath }, null, 2),
      );
    } else {
      process.stderr.write(`dema corpus review: ${reason}\n`);
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const output = {
    ...card,
    receipt_path: absPath,
  };

  if (json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(formatFounderWorkEvidenceCard(card));
    console.log(`\nreceipt_path: ${absPath}`);
    console.log(`card_hash: ${card.card_hash}`);
  }
  process.exit(process.exitCode ?? 0);
}

async function cmd_corpus_spend(argv, json) {
  const filePath = argValue(argv, "--file");
  const offeredConsent = argValue(argv, "--consent") ?? null;

  if (!filePath) {
    process.stderr.write("dema corpus spend: --file <abs_path> is required\n");
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (!isAbsolute(filePath)) {
    process.stderr.write(
      `dema corpus spend: --file must be an absolute path (got: ${filePath})\n`,
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const absPath = resolve(filePath);
  let sourceText;
  try {
    const spendHandle = await open(absPath, "r");
    const st = await spendHandle.stat();
    if (!st.isFile()) {
      if (json) {
        console.log(
          JSON.stringify({
            refused: true,
            reason_code: "not_a_file",
            file: absPath,
          }, null, 2),
        );
      } else {
        process.stderr.write(
          `Refused — spend proof accepts exactly one CSV file, not a directory.\nExpected consent: ${expectedSpendConsent(absPath)}\n`,
        );
      }
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    sourceText = await spendHandle.readFile({ encoding: "utf8" });
    await spendHandle.close();
  } catch (err) {
    const message = err?.code === "ENOENT" ? "file_not_found" : "read_failed";
    if (json) {
      console.log(
        JSON.stringify({ refused: true, reason_code: message, file: absPath }, null, 2),
      );
    } else {
      process.stderr.write(`dema corpus spend: ${message}: ${absPath}\n`);
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const sourceSha256 = sha256Hex(sourceText);
  const report = buildProofOfSpendReport({
    sourceFile: absPath,
    sourceSha256,
    sourceText,
    offeredConsent,
  });

  if (!report.index_allowed) {
    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stderr.write(
        [
          "Refused — spend proof requires exact consent.",
          `reason: ${report.reason_code}`,
          `expected: ${report.expected_consent_phrase}`,
        ].join("\n"),
      );
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const verify = verifyProofOfSpendReport(report);
  if (!verify.valid) {
    if (json) {
      console.log(
        JSON.stringify({ refused: true, reason_code: verify.reason, report }, null, 2),
      );
    } else {
      process.stderr.write(`dema corpus spend: verify failed: ${verify.reason}\n`);
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const envelope = buildProofOfSpendReceiptEnvelope(report, {
    generatedAt: report.generated_at,
  });
  const saveResult = await saveProofOfSpend(envelope, {
    demaHome: process.env.DEMA_HOME,
    pretty: false,
  });

  if (!saveResult.saved) {
    if (json) {
      console.log(
        JSON.stringify({ report, save: saveResult, saved: false }, null, 2),
      );
    } else {
      process.stderr.write(
        `dema corpus spend: failed to seal receipt (${saveResult.reason})\n`,
      );
    }
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const output = {
    ...report,
    receipt: Object.freeze({
      path: saveResult.path,
      sha256: saveResult.sha256,
      no_mint: true,
    }),
  };

  if (json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    const monthly = report.primary_claim?.value ?? null;
    const body = serializeProofOfSpendForSave(envelope, { pretty: false });
    console.log(
      [
        "DEMA · PROOF-OF-SPEND-1A — SEALED",
        `file: ${absPath}`,
        `truth_label: ${report.truth_label}`,
        `facts: ${report.fact_count}`,
        `monthly_recurring_burn_usd_cents: ${monthly}`,
        `index_hash: ${report.index_hash}`,
        `receipt_sha256: ${saveResult.sha256}`,
        `receipt_path: ${saveResult.path}`,
        "no_mint: true",
        "",
        "Boundary: single-file CSV read under exact consent · FWI provenance · cost measured not value · no model · no network.",
      ].join("\n"),
    );
    if (process.env.DEMA_CORPUS_SPEND_STDOUT_ENVELOPE === "1") {
      process.stdout.write(body);
    }
  }
  process.exit(process.exitCode ?? 0);
}

export async function cmd_corpus(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  const json = wantsJson(argv);

  if (sub === "index") {
    await cmd_corpus_index(argv, json);
    return;
  }
  if (sub === "spend") {
    await cmd_corpus_spend(argv, json);
    return;
  }
  if (sub === "review") {
    await cmd_corpus_review(argv, json);
    return;
  }

  process.stderr.write(
    [
      "Usage:",
      '  dema corpus index --file <abs_path> --consent "GO: content_read <abs_path>" [--json]',
      '  dema corpus spend --file <abs_csv_path> --consent "GO: content_read <abs_csv_path>" [--json]',
      "  dema corpus review --receipt <abs_path_to_founder_work_index.json> [--json]",
      "",
    ].join("\n"),
  );
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
