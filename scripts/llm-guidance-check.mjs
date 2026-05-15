import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const schema = "bizra.dema.llm_guidance_check.v0.1";
const defaultRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "docs/INDEX.md",
  "docs/LLM_SYSTEM_FLOW.md",
  "docs/ARCHITECTURE.md",
  "docs/ENGINEERING_DISCIPLINE.md",
  "docs/06-adr/ADR-001-dema-is-one-face.md",
  "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md"
];

const requiredTokens = [
  "Dema is the local product face",
  "No runtime execution in this repo",
  "No hidden daemon",
  "Exact-string consent only",
  "DEMA_HOME",
  "~/.dema",
  "Receipts are read/list here; governed runtime issues",
  "Node1 / Node2 are preview-only",
  "npm run llm:guidance"
];

const requiredIndexTokens = [
  "Historical and reference material",
  "_absorbed/",
  "superpowers",
  "working design artifacts"
];

const agentFiles = ["AGENTS.md", "CLAUDE.md"];

function parseArgs(argv) {
  const args = { json: false, root: defaultRoot };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.json = true;
    } else if (arg === "--root") {
      index += 1;
      if (!argv[index]) {
        throw new Error("--root requires a value");
      }
      args.root = resolve(argv[index]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function readText(root, path) {
  return readFileSync(join(root, path), "utf8");
}

function makeCheck(name, ok, details = {}) {
  return { name, ok, ...details };
}

function containsAll(text, tokens) {
  const normalizedText = text.toLowerCase();
  return tokens.filter((token) => !normalizedText.includes(token.toLowerCase()));
}

export function buildLlmGuidanceReport({ root = defaultRoot } = {}) {
  const checks = [];

  const missingFiles = requiredFiles.filter((path) => !existsSync(join(root, path)));
  checks.push(makeCheck("required_files_present", missingFiles.length === 0, { missing: missingFiles }));

  if (missingFiles.length === 0) {
    const flow = readText(root, "docs/LLM_SYSTEM_FLOW.md");
    const missingFlowTokens = containsAll(flow, requiredTokens);
    checks.push(
      makeCheck("canonical_flow_invariants_present", missingFlowTokens.length === 0, {
        missing: missingFlowTokens
      })
    );

    for (const path of agentFiles) {
      const text = readText(root, path);
      checks.push(
        makeCheck(`${path}_links_canonical_flow`, text.includes("docs/LLM_SYSTEM_FLOW.md"), {
          path
        })
      );
      checks.push(makeCheck(`${path}_is_thin_router`, text.split("\n").length <= 80, { path }));
    }

    const index = readText(root, "docs/INDEX.md");
    const missingIndexTokens = containsAll(index, requiredIndexTokens);
    checks.push(
      makeCheck("historical_noise_classified", missingIndexTokens.length === 0, {
        missing: missingIndexTokens
      })
    );
  }

  const ok = checks.every((check) => check.ok);

  return {
    schema,
    mode: "READ_ONLY_AUDIT",
    root,
    ok,
    checks,
    boundary: {
      files_modified: false,
      runtime_started: false,
      network_attempted: false
    }
  };
}

export function formatLlmGuidanceReport(report) {
  const lines = [
    "DEMA LLM Guidance Check",
    "",
    `Schema: ${report.schema}`,
    `Mode: ${report.mode}`,
    `Result: ${report.ok ? "PASS" : "FAIL"}`,
    "",
    "Checks:"
  ];

  for (const check of report.checks) {
    lines.push(`- ${check.ok ? "PASS" : "FAIL"} ${check.name}`);
    if (!check.ok && check.missing?.length) {
      lines.push(`  missing: ${check.missing.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("Boundary: read-only audit; no runtime; no network.");

  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildLlmGuidanceReport({ root: args.root });

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatLlmGuidanceReport(report));
  }

  if (!report.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
