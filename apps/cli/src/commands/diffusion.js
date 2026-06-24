import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import {
  buildDiffusionRefinement,
  verifyDiffusionRefinement,
} from "../../../../packages/core/src/diffusion-reasoner.js";

function normalizeArgv(argv = []) {
  if (argv[0] === "diffusion" || argv[0] === "dema-diffusion") return argv.slice(1);
  return argv;
}

function flagValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

function linesToDrafts(value) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCsv(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function readDrafts(argv) {
  const inline = flagValue(argv, "--drafts");
  if (inline) return linesToDrafts(inline);

  const file = flagValue(argv, "--drafts-file");
  if (!file) return [];
  if (!isAbsolute(file)) {
    throw new Error("--drafts-file must be an absolute path");
  }
  const raw = await readFile(resolve(file), "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.drafts)) return parsed.drafts;
  throw new Error("--drafts-file must contain a JSON array or an object with a drafts array");
}

function renderHuman(report) {
  if (report.valid === false && report.rejected === true && !report.schema) {
    return [
      "DEMA · DIFFUSION REASONER — REFUSED",
      `reason: ${report.reason_code}`,
    ].join("\n");
  }

  const verify = verifyDiffusionRefinement(report);
  const lines = [
    "DEMA · DIFFUSION REASONER — BOUNDED CLI",
    `schema: ${report.schema}`,
    `truth_label: ${report.truth_label}`,
    `status: ${report.convergence_status}`,
    `recommendation: ${report.recommendation}`,
    `steps: ${report.step_count}`,
    `noise_schedule: ${report.noise_schedule.join(" -> ")}`,
    `final_noise_score: ${report.final_noise_score}`,
    `evidence_anchors: ${report.evidence_anchors.length}`,
    `verify: ${verify.valid ? "valid" : "invalid"}`,
    `hash: ${report.convergence_hash}`,
    "",
    "Boundary: no neural diffusion, no learned sampling, no stochastic generation, no model call, no network, no file write, no signing, no mint, no PoI, no federation.",
  ];
  if (report.converged_claim) {
    lines.push("", "Converged claim:", report.converged_claim);
  }
  if (!verify.valid) {
    lines.push("", `blocked_by: ${verify.blocked_by.join(", ")}`);
  }
  return lines.join("\n");
}

export async function runDiffusionCommand(rawArgv = []) {
  const argv = normalizeArgv(rawArgv);
  const subcommand = argv[0] ?? "refine";
  if (!["refine", "verify"].includes(subcommand)) {
    throw new Error("Unknown diffusion command. Use `dema diffusion refine --drafts <lines> [--evidence a,b] [--json]` or `dema diffusion verify <report.json> [--json]`.");
  }

  const wantJson = hasFlag(argv, "--json");

  if (subcommand === "verify") {
    const file = argv[1];
    if (!file || !isAbsolute(file)) throw new Error("`dema diffusion verify` requires an absolute path to a saved report JSON file.");
    let report;
    try {
      report = JSON.parse(await readFile(resolve(file), "utf8"));
    } catch (e) {
      throw new Error(`dema diffusion verify: cannot read or parse report at ${file}: ${e.message}`);
    }
    const result = verifyDiffusionRefinement(report);
    return JSON.stringify(result, null, 2);
  }

  const drafts = await readDrafts(argv);
  const evidence = parseCsv(flagValue(argv, "--evidence"));
  const claim_id = flagValue(argv, "--claim-id") ?? "diffusion-cli-1a";
  const report = buildDiffusionRefinement({ drafts, evidence, claim_id });
  return wantJson ? JSON.stringify(report, null, 2) : renderHuman(report);
}

export async function cmd_diffusion(ctx) {
  const argv = normalizeArgv(ctx.argv);
  const output = await runDiffusionCommand(ctx.argv);
  console.log(output);
  // fail-closed: `dema diffusion verify` must exit non-zero when the report is invalid
  // (the verifier returns {valid:false} as data; the CLI must not exit 0 on it).
  if (argv[0] === "verify") {
    let ok = false;
    try {
      ok = JSON.parse(output).valid === true;
    } catch {
      ok = false;
    }
    if (!ok) process.exitCode = 1;
  }
  process.exit(process.exitCode ?? 0);
}
