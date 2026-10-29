#!/usr/bin/env node
// ARTIFACT-011 ceremony preflight (Dema-side steps b–d).
//
//   npm run artifact-011:preflight
//   node scripts/artifact-011-ceremony-preflight.mjs --json
//   node scripts/artifact-011-ceremony-preflight.mjs --isolated --json
//
// Read-only · no governed Node0 runtime · no ARTIFACT-011 mint · executes=false.

import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { runArtifact011CeremonyPreflight } from "../packages/mission/src/artifact-011-ceremony-preflight.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");

const JSON_MODE = process.argv.includes("--json");
const ISOLATED = process.argv.includes("--isolated");

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

async function resolveGitCommit() {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: REPO_ROOT,
      timeout: 5000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// Portability invariant: isolated preflight must honor operator-provided
// --home / DEMA_HOME seams first, then attempt an isolated temp dir under
// homedir(). When HOME is read-only (EROFS/EACCES in sandboxed CI), fall back
// to tmpdir() so the release gate still runs. Operator-provided homes keep
// cleanup:false (never auto-deleted); isolated temp dirs keep cleanup:true.
//
// `deps` is an injectable seam for tests (simulate EROFS/EACCES, assert
// fail-closed). Production callers use the real node:fs / node:os bindings.
export function resolveHome(options = {}, deps = {}) {
  const mkdtempFn = deps.mkdtempSync ?? mkdtempSync;
  const homedirFn = deps.homedir ?? homedir;
  const tmpdirFn = deps.tmpdir ?? tmpdir;
  const env = deps.env ?? process.env;
  const flagHome = deps.flagHome !== undefined ? deps.flagHome : argValue("--home");

  if (flagHome) return { home: flagHome, cleanup: false };
  if (options.isolated === true || ISOLATED) {
    const fromEnv = env.DEMA_HOME;
    if (fromEnv) return { home: fromEnv, cleanup: false };
    const prefix = ".dema-artifact-011-preflight-";
    try {
      const home = mkdtempFn(join(homedirFn(), prefix));
      return { home, cleanup: true };
    } catch (err) {
      if (err?.code !== "EROFS" && err?.code !== "EACCES") throw err;
      // HOME is read-only: fall back to tmpdir(). If that also fails the
      // error propagates — the gate fails closed rather than writing nowhere.
      const home = mkdtempFn(join(tmpdirFn(), prefix));
      return { home, cleanup: true };
    }
  }
  const home = env.DEMA_HOME || join(homedirFn(), ".dema");
  return { home, cleanup: false };
}

export async function runArtifact011PreflightScript(options = {}) {
  const { home, cleanup } = options.home
    ? { home: options.home, cleanup: false }
    : resolveHome(options);
  try {
    const report = await runArtifact011CeremonyPreflight({
      demaHome: home,
      cliPath: CLI_PATH,
      execFileFn: options.execFileFn ?? execFileAsync,
      gitCommit: options.gitCommit ?? (await resolveGitCommit()),
    });

    const outPath = argValue("--out");
    if (outPath) {
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    }

    return report;
  } finally {
    if (cleanup) {
      rmSync(home, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runArtifact011PreflightScript()
    .then((report) => {
      if (JSON_MODE) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log("DEMA · ARTIFACT-011 ceremony preflight (Dema-side only)");
        console.log(`  schema:    ${report.schema}`);
        console.log(`  home:      ${report.dema_home}`);
        console.log(`  truth:     ${report.truth_label}`);
        console.log(
          `  preview:   ${report.cleared_for_preview_ceremony ? "CLEARED" : "GAP"}`,
        );
        console.log(
          `  operator:  ${report.operator_runtime_ready ? "RUNTIME-READY" : "NOT RUNTIME-READY"}`,
        );
        console.log(
          `  runtime:   NOT IN SCOPE (cleared_for_runtime_ceremony=false)`,
        );
        if (report.git_commit) {
          console.log(`  commit:    ${report.git_commit}`);
        }
        if (report.blockers.length) {
          console.log("  blockers:");
          for (const b of report.blockers) {
            console.log(`    - ${b.code}: ${b.message}`);
          }
        }
        console.log(`  next:      ${report.recommended_next}`);
      }
      process.exit(report.cleared_for_preview_ceremony ? 0 : 1);
    })
    .catch((err) => {
      console.error("artifact-011-ceremony-preflight failed:", err);
      process.exit(2);
    });
}
