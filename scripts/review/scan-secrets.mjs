#!/usr/bin/env node
// SCAN-SECRETS — run CI's gitleaks job locally, byte-for-byte.
//
// Why this exists: `npm run check` runs NO gitleaks. Its only secret gate is
// gate 35 (repo-claude-config-check.mjs), which applies the repo's own narrow
// `secret-pattern.js` to `.claude/` config files. CI's `scan` job applies
// gitleaks' full default ruleset to the entire git history. Different detector,
// different scope, different corpus — so a green `check` never implied a green
// `scan`, and every fixture false positive was discovered by a CI failure
// instead of before the push.
//
// The version, checksum and flags are PARSED from .github/workflows/gitleaks.yml
// rather than restated here. A second hardcoded pin is how local silently drifts
// from CI; there is exactly one source of truth and this reads it.
//
// Deliberately NOT wired into `npm run check`: it needs network on first run.
// Run it before pushing a branch that adds credential-shaped test fixtures.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOW = ".github/workflows/gitleaks.yml";
const CACHE = "node_modules/.cache/gitleaks";

const fail = (msg) => {
  console.error(`scan:secrets — ${msg}`);
  process.exit(2);
};

if (!existsSync(WORKFLOW)) fail(`${WORKFLOW} not found; run from the repo root`);
const wf = readFileSync(WORKFLOW, "utf8");

const pick = (re, what) => {
  const m = wf.match(re);
  if (!m) fail(`could not parse ${what} from ${WORKFLOW}`);
  return m[1];
};

const version = pick(/VERSION="([^"]+)"/, "VERSION");
const sha256 = pick(/EXPECTED_SHA256="([0-9a-f]{64})"/, "EXPECTED_SHA256");
const urlTemplate = pick(/URL="([^"]+)"/, "URL");
// The detect line carries the flags CI actually runs. Parsed so a flag change in
// CI is inherited here instead of silently diverging.
const detectArgs = pick(/run: \.\/gitleaks (detect [^\n]+)/, "the detect command")
  .trim()
  .split(/\s+/);

const url = urlTemplate.replace(/\$\{VERSION\}|\$VERSION/g, version);

if (process.platform !== "linux" || process.arch !== "x64") {
  fail(
    `CI pins the linux_x64 build; this host is ${process.platform}/${process.arch}. ` +
      `Install gitleaks v${version} yourself and run: gitleaks ${detectArgs.join(" ")}`,
  );
}

// gitleaks walks history. A shallow clone silently scans a fraction of it and
// reports clean — the same false-green this script exists to prevent.
const shallow = spawnSync("git", ["rev-parse", "--is-shallow-repository"], {
  encoding: "utf8",
});
if (shallow.stdout?.trim() === "true") {
  fail("shallow clone: CI checks out with fetch-depth 0. Run `git fetch --unshallow` first");
}

mkdirSync(CACHE, { recursive: true });
const tarball = join(CACHE, `gitleaks-${version}.tar.gz`);
const binary = join(CACHE, `gitleaks-${version}`);

if (!existsSync(tarball)) {
  console.log(`scan:secrets — downloading gitleaks v${version}`);
  const dl = spawnSync("curl", ["-sSL", url, "-o", tarball], { stdio: "inherit" });
  if (dl.status !== 0) fail("download failed (no network?)");
}

// Re-verified on every run, not just on download: a cached tarball is still
// untrusted input, and hashing 10 MB costs milliseconds.
const actual = createHash("sha256").update(readFileSync(tarball)).digest("hex");
if (actual !== sha256) {
  fail(`SHA-256 mismatch\n  expected: ${sha256}\n  actual:   ${actual}`);
}

if (!existsSync(binary)) {
  execFileSync("tar", ["-xzf", tarball, "-C", CACHE, "gitleaks"]);
  execFileSync("mv", [join(CACHE, "gitleaks"), binary]);
  execFileSync("chmod", ["+x", binary]);
}

console.log(`scan:secrets — gitleaks v${version} (sha256 verified) ${detectArgs.join(" ")}`);
const run = spawnSync(binary, detectArgs, { stdio: "inherit" });
if (run.status === 0) console.log("scan:secrets — clean");
else console.error("scan:secrets — leaks found (same verdict CI's `scan` job will give)");
process.exit(run.status ?? 2);
