#!/usr/bin/env node
// SCAN-SECRETS — run CI's gitleaks job locally, matching the dual-eval contract.
//
// Why this exists: `npm run check` runs NO gitleaks. Its only secret gate is
// gate 35 (repo-claude-config-check.mjs), which applies the repo's own narrow
// `secret-pattern.js` to `.claude/` config files. CI's `scan` job applies
// gitleaks via `scripts/review/gitleaks-dual-eval.mjs` (Gate Mutator ≠ Final
// Gate Verifier). Different detector, different scope — so a green `check`
// never implied a green `scan`.
//
// The version, checksum and fetch URL are PARSED from .github/workflows/gitleaks.yml
// rather than restated here. The detect orchestration is the same dual-eval
// entrypoint CI runs (not a second hardcoded `./gitleaks detect` line).
//
// Deliberately NOT wired into `npm run check`: it needs network on first run.
// Run it before pushing a branch that adds credential-shaped test fixtures.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const WORKFLOW = ".github/workflows/gitleaks.yml";
const CACHE = "node_modules/.cache/gitleaks";
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const DUAL_EVAL = "scripts/review/gitleaks-dual-eval.mjs";

const fail = (msg) => {
  console.error(`scan:secrets — ${msg}`);
  process.exit(2);
};

if (!existsSync(WORKFLOW)) fail(`${WORKFLOW} not found; run from the repo root`);
if (!existsSync(DUAL_EVAL)) fail(`${DUAL_EVAL} not found; dual-eval is the CI contract`);
const wf = readFileSync(WORKFLOW, "utf8");

const pick = (re, what) => {
  const m = wf.match(re);
  if (!m) fail(`could not parse ${what} from ${WORKFLOW}`);
  return m[1];
};

const version = pick(/VERSION="([^"]+)"/, "VERSION");
const sha256 = pick(/EXPECTED_SHA256="([0-9a-f]{64})"/, "EXPECTED_SHA256");
const urlTemplate = pick(/URL="([^"]+)"/, "URL");
// CI security entrypoint must remain dual-eval (delivery-operating-system binds it).
// Workflow may invoke a BASE_SHA-materialized copy ($TRUSTED_EVAL) rather than the
// candidate path directly — Gate Mutator ≠ Final Gate Verifier for the orchestrator.
if (
  !/gitleaks-dual-eval\.mjs/.test(wf) ||
  !/TRUSTED_EVAL/.test(wf)
) {
  fail(
    `could not find trusted dual-eval CI entrypoint in ${WORKFLOW} ` +
      `(expected: gitleaks-dual-eval.mjs via TRUSTED_EVAL)`,
  );
}

if (!VERSION_RE.test(version)) {
  fail(`refusing non-semver VERSION parsed from ${WORKFLOW}: ${version}`);
}
if (!SHA256_RE.test(sha256)) {
  fail(`refusing non-hex EXPECTED_SHA256 parsed from ${WORKFLOW}`);
}

const workflowUrl = urlTemplate.replace(/\$\{VERSION\}|\$VERSION/g, version);
const fetchUrl =
  `https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_linux_x64.tar.gz`;
if (workflowUrl !== fetchUrl) {
  fail(
    `refusing to fetch: workflow URL does not match pinned VERSION ${version}:\n` +
      `  workflow: ${workflowUrl}\n` +
      `  expected: ${fetchUrl}`,
  );
}

const shallow = spawnSync("git", ["rev-parse", "--is-shallow-repository"], {
  encoding: "utf8",
});
if (shallow.stdout?.trim() === "true") {
  fail("shallow clone: CI checks out with fetch-depth 0. Run `git fetch --unshallow` first");
}

/**
 * Resolve the gitleaks binary to execute.
 * - linux/x64: download CI's pinned tarball, verify SHA-256, re-extract every run.
 * - other hosts: fail-closed on PATH gitleaks at the exact CI-pinned version.
 */
function resolveGitleaksBinary() {
  if (process.platform === "linux" && process.arch === "x64") {
    mkdirSync(CACHE, { recursive: true });
    const tarball = join(CACHE, `gitleaks-${version}.tar.gz`);
    const binary = join(CACHE, `gitleaks-${version}`);

    if (!existsSync(tarball)) {
      console.log(`scan:secrets — downloading gitleaks v${version}`);
      // codeql[js/file-access-to-http]: intentional pinned release fetch.
      const dl = spawnSync("curl", ["-sSL", fetchUrl, "-o", tarball], {
        stdio: "inherit",
      });
      if (dl.status !== 0) {
        try {
          unlinkSync(tarball);
        } catch {
          // best-effort
        }
        fail("download failed (no network?)");
      }
    }

    const actual = createHash("sha256").update(readFileSync(tarball)).digest("hex");
    if (actual !== sha256) {
      fail(`SHA-256 mismatch\n  expected: ${sha256}\n  actual:   ${actual}`);
    }

    execFileSync("tar", ["-xzf", tarball, "-C", CACHE, "gitleaks"]);
    execFileSync("mv", ["-f", join(CACHE, "gitleaks"), binary]);
    execFileSync("chmod", ["+x", binary]);
    return { binary, source: "verified-tarball" };
  }

  const probe = spawnSync("gitleaks", ["version"], { encoding: "utf8" });
  const reported = `${probe.stdout ?? ""}${probe.stderr ?? ""}`.trim();
  if (probe.status !== 0 || !reported) {
    fail(
      `CI pins the linux_x64 build; this host is ${process.platform}/${process.arch}. ` +
        `Install gitleaks v${version} on PATH (same version CI pins), then re-run.`,
    );
  }
  const tokens = reported.split(/\s+/);
  const versionOk =
    reported === version ||
    reported === `v${version}` ||
    tokens.includes(version) ||
    tokens.includes(`v${version}`);
  if (!versionOk) {
    fail(
      `PATH gitleaks reports "${reported}" but CI pins v${version}. ` +
        `Install the pinned version on PATH, then re-run.`,
    );
  }
  console.log(
    `scan:secrets — using PATH gitleaks v${version} ` +
      `(${process.platform}/${process.arch}; CI artifact pin is linux_x64-only)`,
  );
  return { binary: "gitleaks", source: "path-version-pin" };
}

const { binary, source } = resolveGitleaksBinary();
const label =
  source === "verified-tarball"
    ? `gitleaks v${version} (tarball sha256 verified, binary re-extracted)`
    : `gitleaks v${version} (PATH, version-pinned)`;

const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
let base = "";
try {
  base = execFileSync("git", ["merge-base", "HEAD", "origin/main"], {
    encoding: "utf8",
  }).trim();
} catch {
  base = "";
}

console.log(`scan:secrets — ${label}; invoking ${DUAL_EVAL}`);
const args = [
  DUAL_EVAL,
  "--source",
  ".",
  "--event",
  "local",
  "--source-commit",
  head,
  "--gitleaks-bin",
  binary,
];
if (base) {
  args.push("--base-commit", base, "--pr-base-sha", base, "--pr-head-sha", head);
}

const run = spawnSync(process.execPath, args, { stdio: "inherit" });
if (run.status === 0) console.log("scan:secrets — clean");
else console.error("scan:secrets — dual-eval failed (same contract CI's `scan` job uses)");
process.exit(run.status ?? 2);
