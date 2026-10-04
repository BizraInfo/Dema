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

// CI's checkout only contains the branch under test (fetch-depth: 0 on that ref).
// A fat local clone has every fetched PR/branch tip; gitleaks' default git walk
// then scans those unrelated refs and reports leaks CI will never see. Pin the
// walk to HEAD so local matches the CI checkout shape. Do not restate this in
// the workflow — CI does not need it; locals do.
if (!detectArgs.includes("--log-opts") && !detectArgs.includes("--log-opts=HEAD")) {
  detectArgs.push("--log-opts=HEAD");
}

const url = urlTemplate.replace(/\$\{VERSION\}|\$VERSION/g, version);

// The URL comes out of a file, so it is untrusted input to an outbound request:
// anyone who can edit the workflow could otherwise point this at any host or at a
// different release than VERSION. Require the exact upstream release path for the
// parsed VERSION. The checksum below is the second line of defence.
const expectedUrl =
  `https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_linux_x64.tar.gz`;
if (url !== expectedUrl) {
  fail(
    `refusing to fetch a URL that does not match pinned VERSION ${version}:\n` +
      `  parsed:   ${url}\n` +
      `  expected: ${expectedUrl}`,
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

/**
 * Resolve the gitleaks binary to execute.
 * - linux/x64: download CI's pinned tarball, verify SHA-256, re-extract every run.
 * - other hosts: fail-closed on PATH gitleaks at the exact CI-pinned version
 *   (CI only publishes a linux_x64 checksum; do not invent other artifact pins).
 */
function resolveGitleaksBinary() {
  if (process.platform === "linux" && process.arch === "x64") {
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

    // Extracted on EVERY run, never reused from cache. Verifying the tarball and then
    // executing a binary that merely happens to sit next to it proves nothing about
    // the binary: anything with write access to node_modules/.cache could swap it and
    // the checksum above would still pass. Re-extracting is what binds the thing we
    // execute to the bytes we verified, and it costs ~100ms.
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
        `Install gitleaks v${version} on PATH (same version CI pins), then re-run. ` +
        `Detect command: gitleaks ${detectArgs.join(" ")}`,
    );
  }
  // Accept "8.30.1" or "v8.30.1" / multi-line banners that include the pin.
  const versionOk =
    reported === version ||
    reported === `v${version}` ||
    new RegExp(`(?:^|\\s)v?${version.replace(/\./g, "\\.")}(?:\\s|$)`).test(reported);
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
console.log(`scan:secrets — ${label} ${detectArgs.join(" ")}`);
const run = spawnSync(binary, detectArgs, { stdio: "inherit" });
if (run.status === 0) console.log("scan:secrets — clean");
else console.error("scan:secrets — leaks found (same verdict CI's `scan` job will give)");
process.exit(run.status ?? 2);
