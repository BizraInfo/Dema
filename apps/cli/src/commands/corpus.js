import { readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { createHash } from "node:crypto";

import {
  buildFounderWorkIndexReceiptEnvelope,
  buildFounderWorkIndexReport,
  expectedContentReadConsent,
} from "../../../../packages/core/src/founder-work-indexer.js";
import {
  saveFounderWorkIndex,
  serializeFounderWorkIndexForSave,
} from "../../../../packages/receipts/src/founder-work-index-save.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function sha256Hex(content) {
  return createHash("sha256").update(content).digest("hex");
}

export async function cmd_corpus(ctx) {
  const { argv } = ctx;
  const sub = argv[1];
  if (sub !== "index") {
    process.stderr.write(
      'Usage: dema corpus index --file <abs_path> --consent "GO: content_read <abs_path>" [--json]\n',
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  const filePath = argValue(argv, "--file");
  const offeredConsent = argValue(argv, "--consent") ?? null;
  const json = wantsJson(argv);

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
  try {
    fileStat = await stat(absPath);
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

  const sourceText = await readFile(absPath, "utf8");
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
