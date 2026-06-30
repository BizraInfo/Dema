import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildSafetyReportPreview,
  formatSafetyReportPreview,
} from "../../../../packages/core/src/safety-report.js";
import {
  buildNode0QualityEvidenceCard,
  formatNode0QualityEvidenceCard,
} from "../../../../packages/core/src/node0-quality-evidence-card.js";
import { saveNode0QualityEvidenceCard } from "../../../../packages/receipts/src/node0-quality-evidence-card-save.js";
import { evaluateZeroDep } from "../../../../scripts/review/zero-dep-gate.mjs";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseCoveragePercent(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function findRotationReceipt(demaHome) {
  const receiptsDir = join(demaHome, "receipts");
  let names;
  try {
    names = await readdir(receiptsDir);
  } catch {
    return null;
  }
  const hit = names.find(
    (name) =>
      name.includes("key-rotation") ||
      name.includes("rotation-receipt") ||
      name.includes("key_rotation"),
  );
  return hit ? join(receiptsDir, hit) : null;
}

async function gatherCloseoutFromFlags(argv) {
  const commitSha =
    argValue(argv, "--commit") ??
    (
      await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT })
    ).stdout.trim();

  return Object.freeze({
    commit_sha: commitSha,
    tests_total: Number(argValue(argv, "--tests-total")),
    tests_pass: Number(argValue(argv, "--tests-pass")),
    tests_fail: Number(argValue(argv, "--tests-fail")),
    check_pass: argv.includes("--check-pass"),
    llm_guidance_pass: argv.includes("--llm-guidance-pass"),
    diff_check_clean: argv.includes("--diff-check-clean"),
  });
}

async function cmd_report_quality_evidence_card(argv, json) {
  const demaHome = process.env.DEMA_HOME;
  const closeout = await gatherCloseoutFromFlags(argv);
  const coverage = {
    lines: parseCoveragePercent(argValue(argv, "--coverage-lines")),
    branches: parseCoveragePercent(argValue(argv, "--coverage-branches")),
    functions: parseCoveragePercent(argValue(argv, "--coverage-functions")),
    threshold_enforced: false,
  };
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
  const zeroDep = evaluateZeroDep(pkg);
  const rotationReceipt = await findRotationReceipt(
    demaHome || process.env.DEMA_HOME || join(homedir(), ".dema"),
  );

  const card = buildNode0QualityEvidenceCard({
    closeout,
    coverage: coverage.lines == null ? null : coverage,
    rotationReceipt,
    zeroDependencyOk: zeroDep.ok,
    generatedAt: new Date().toISOString(),
  });

  const saveResult = await saveNode0QualityEvidenceCard(card, { demaHome });

  const output = {
    ...card,
    receipt: saveResult.saved
      ? Object.freeze({
          path: saveResult.path,
          sha256: saveResult.sha256,
          no_mint: true,
        })
      : Object.freeze({ saved: false, reason: saveResult.reason }),
  };

  if (json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(formatNode0QualityEvidenceCard(card));
    if (saveResult.saved) {
      console.log(`\nreceipt_path: ${saveResult.path}`);
      console.log(`receipt_sha256: ${saveResult.sha256}`);
    } else {
      process.stderr.write(
        `dema report quality-evidence-card: failed to seal (${saveResult.reason})\n`,
      );
      process.exitCode = 1;
    }
  }
  process.exit(process.exitCode ?? 0);
}

export async function cmd_report(ctx) {
  const { argv, subcommand } = ctx;
  const json = wantsJson(argv);

  if (subcommand === "quality-evidence-card") {
    await cmd_report_quality_evidence_card(argv, json);
    return;
  }

  if (subcommand !== "safety") {
    throw new Error(
      "Unknown report command. Use `dema report safety [--json]` or `dema report quality-evidence-card ...`.",
    );
  }
  const report = buildSafetyReportPreview();
  console.log(
    json ? JSON.stringify(report, null, 2) : formatSafetyReportPreview(report),
  );
  process.exit(process.exitCode ?? 0);
}
