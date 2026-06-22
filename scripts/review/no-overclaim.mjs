#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REVIEW_INFRA_PREFIXES = [".github/workflows/", "scripts/review/"];
const REVIEW_TEST_PREFIXES = ["tests/"];
const OVERCLAIM_PATTERNS = [
  [/"public_network"\s*:\s*true/, "public network enabled"],
  [/"node1_handshake"\s*:\s*true/, "Node1 handshake enabled"],
  [/"token_value_claim"\s*:\s*true/, "token value claim"],
  [/"real_token_value"\s*:\s*true/, "real token value claim"],
  [/"cash_value_claim"\s*:\s*true/, "cash value claim"],
  [/"federation_claim"\s*:\s*true/, "federation claim"],
  [/"sat_permit_claimed"\s*:\s*true/, "SAT permit claim"],
  [/"token_or_reward_claimed"\s*:\s*true/, "token or reward claim"],
  [/"verdict_authority"\s*:\s*"permit"/i, "SAT permit authority"],
  [/\bURP network live\b/i, "URP network live claim"],
  [/\bNode1 federation\b/i, "Node1 federation claim"],
  [/\breal SAT permit\b/i, "real SAT permit claim"],
  [/\bpublic Proof-of-Impact rewards\b/i, "public PoI rewards claim"],
  [/\bautonomous supervisor\b/i, "autonomous supervisor claim"],
];

function baseRef() {
  return (
    process.env.BIZRA_REVIEW_BASE ||
    (process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : "origin/main")
  );
}

function changedFiles() {
  return execFileSync("git", ["diff", "--name-only", `${baseRef()}...HEAD`], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

function safeChangedFiles() {
  // The base-ref diff is unavailable in a shallow checkout (no origin/main or
  // no merge base) — e.g. the check.yml CI job. Skip gracefully there; this
  // gate stays enforced in the full-history BIZRA review job and runs fully
  // in any full clone (local `npm run check`).
  try {
    return changedFiles();
  } catch {
    console.log(
      JSON.stringify(
        {
          schema: "bizra.dema.review.no_overclaim.v0.1",
          ok: true,
          skipped: true,
          reason: `base ref ${baseRef()} unavailable (shallow checkout / no merge base); enforced in the full-history BIZRA review job`,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
}

const scanned = [];
const findings = [];
for (const file of safeChangedFiles()) {
  if (REVIEW_INFRA_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
  if (REVIEW_TEST_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
  if (!/\.(json|mjs|js|md|yml|yaml)$/.test(file)) continue;
  const body = readFileSync(file, "utf8");
  scanned.push(file);
  for (const [pattern, label] of OVERCLAIM_PATTERNS) {
    if (pattern.test(body))
      findings.push({ file, label, pattern: String(pattern) });
  }
}

if (findings.length > 0) {
  throw new Error(
    `BIZRA no-overclaim gate failed: ${JSON.stringify(findings, null, 2)}`,
  );
}

console.log(
  JSON.stringify(
    {
      schema: "bizra.dema.review.no_overclaim.v0.1",
      ok: true,
      scanned_files: scanned,
      blocked_claims: OVERCLAIM_PATTERNS.map(([, label]) => label),
    },
    null,
    2,
  ),
);
