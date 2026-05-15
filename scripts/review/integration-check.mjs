#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CLI_PATH = "apps/cli/src/index.js";
const CHECK_PATH = "scripts/check.mjs";
const ARCHITECTURE_PATH = "docs/ARCHITECTURE.md";
const TESTING_PATH = "docs/TESTING.md";

const ARCHITECTURE_EXCLUSIONS = new Set([
  "dema",
  "dema chat",
  "dema help"
]);

function readIfPresent(root, path) {
  const fullPath = join(root, path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : null;
}

function stopAtPlaceholder(token) {
  return token.startsWith("[") ||
    token.startsWith("<") ||
    /^[A-Z]/.test(token) ||
    /^".*"$/.test(token);
}

export function extractHelpCommands(source) {
  const commands = new Set();
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("dema")) continue;
    const commandPart = trimmed.split(/\s{2,}/)[0];
    const tokens = commandPart.split(/\s+/);
    const commandTokens = [];
    for (const token of tokens) {
      if (stopAtPlaceholder(token)) break;
      commandTokens.push(token);
    }
    if (commandTokens[0] === "dema") {
      commands.add(commandTokens.join(" "));
    }
  }
  return [...commands].sort();
}

function architectureRows(source) {
  const rows = new Set();
  for (const match of source.matchAll(/^\|\s*(.*?)\s*\|/gm)) {
    const cell = match[1];
    if (cell === "Command" || cell.startsWith("---")) continue;
    for (const command of cell.matchAll(/`([^`]+)`/g)) {
      rows.add(command[1].trim());
    }
  }
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("dema ")) continue;
    for (const variant of trimmed.split(/\s+\/\s+/)) {
      const tokens = variant.trim().split(/\s+/);
      const commandTokens = [];
      for (const token of tokens) {
        if (stopAtPlaceholder(token)) break;
        commandTokens.push(token);
      }
      if (commandTokens[0] === "dema") rows.add(commandTokens.join(" "));
    }
  }
  return rows;
}

function parseSmokeCommands(source) {
  const commands = [];
  for (const match of source.matchAll(/\[\s*"([^"]+)"\s*,\s*\[(.*?)\]\s*\]/gs)) {
    commands.push([
      match[1],
      [...match[2].matchAll(/"([^"]*)"/g)].map((arg) => arg[1])
    ]);
  }
  return commands;
}

function loadSmokeCommands(root) {
  const source = readIfPresent(root, CHECK_PATH);
  if (!source) return null;
  const commands = parseSmokeCommands(source);
  return commands.length ? commands : null;
}

function cliCommandFromArgs(args, helpCommands) {
  if (args[0] !== CLI_PATH) return null;
  const cliArgs = args.slice(1).filter((arg) => !arg.startsWith("--"));
  const candidates = helpCommands
    .filter((command) => command !== "dema")
    .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);

  for (const command of candidates) {
    const tokens = command.split(/\s+/).slice(1);
    if (tokens.every((token, index) => cliArgs[index] === token)) return command;
  }
  return null;
}

function listTestFiles(root) {
  const testsDir = join(root, "tests");
  if (!existsSync(testsDir)) return [];
  return readdirSync(testsDir)
    .filter((entry) => entry.endsWith(".test.js"))
    .map((entry) => `tests/${entry}`)
    .sort();
}

function makeCheck(name, ok, details = {}) {
  return { name, ok, ...details };
}

function shellishCommandLine(bin, args) {
  return [bin, ...args].map((arg) => (
    /\s/.test(arg) ? `"${arg}"` : arg
  )).join(" ");
}

export async function buildIntegrationCheckReport({ root = process.cwd() } = {}) {
  const checks = [];
  const missingFiles = [CLI_PATH, CHECK_PATH, ARCHITECTURE_PATH, TESTING_PATH]
    .filter((path) => !existsSync(join(root, path)));
  checks.push(makeCheck("required_files_present", missingFiles.length === 0, {
    missing: missingFiles
  }));

  let helpCommands = [];
  const cliSource = readIfPresent(root, CLI_PATH);
  if (cliSource) {
    helpCommands = extractHelpCommands(cliSource);
    checks.push(makeCheck("help_commands_discovered", helpCommands.length > 0, {
      count: helpCommands.length
    }));
  }

  const architectureSource = readIfPresent(root, ARCHITECTURE_PATH);
  if (architectureSource && helpCommands.length) {
    const rows = architectureRows(architectureSource);
    const missing = helpCommands
      .filter((command) => !ARCHITECTURE_EXCLUSIONS.has(command))
      .filter((command) => !rows.has(command));
    checks.push(makeCheck("help_commands_in_architecture_map", missing.length === 0, {
      missing
    }));
  }

  const smokeCommands = await loadSmokeCommands(root);
  if (smokeCommands) {
    const cliSmokeCommands = smokeCommands
      .filter(([bin, args]) => bin === "node" && args[0] === CLI_PATH)
      .map(([, args]) => ({
        args,
        command: cliCommandFromArgs(args, helpCommands)
      }));
    const unknown = cliSmokeCommands
      .filter((entry) => !entry.command)
      .map((entry) => entry.args.join(" "));
    checks.push(makeCheck("smoke_cli_commands_match_help", unknown.length === 0, {
      unknown
    }));

    const testingSource = readIfPresent(root, TESTING_PATH) ?? "";
    const missingSmokeDocs = smokeCommands
      .map(([bin, args]) => shellishCommandLine(bin, args))
      .filter((command) => !testingSource.includes(command));
    checks.push(makeCheck("smoke_commands_documented", missingSmokeDocs.length === 0, {
      missing: missingSmokeDocs
    }));
  } else {
    checks.push(makeCheck("check_commands_exported", false, {
      missing: [CHECK_PATH]
    }));
  }

  const testingSource = readIfPresent(root, TESTING_PATH) ?? "";
  const missingTestRows = listTestFiles(root)
    .filter((file) => !testingSource.includes(`\`${file}\``));
  checks.push(makeCheck("test_files_documented", missingTestRows.length === 0, {
    missing: missingTestRows
  }));

  return {
    schema: "bizra.dema.review.integration_check.v0.1",
    ok: checks.every((check) => check.ok),
    root,
    checks,
    boundary: {
      read_only_audit: true,
      runtime_execution: false,
      mutation_performed: false,
      federation_started: false,
      receipt_minted: false,
      ci_modified: false
    }
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const report = await buildIntegrationCheckReport();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
