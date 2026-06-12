#!/usr/bin/env node
// CLAIM-MAP-PUBLIC-SYNC-AND-DOC-GENERATION-V0.1
//
// Generates the public-facing claims doc FROM the machine-readable register, so
// public statements are derived-by-construction and cannot drift past the gated
// truth state. The drift guard (tests/claim-register.test.js) fails if the
// committed output and the register disagree — run `npm run claims:generate`.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { isCapabilityGated } from "./claim-register-check.mjs";

const REGISTER = "docs/claims/node0-claim-register.v0.1.json";
const OUTPUT = "docs/claims/PUBLIC_CLAIMS.generated.md";

function cell(s) {
  return String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function renderPublicClaims(register) {
  const claims = Array.isArray(register?.claims) ? register.claims : [];
  const lines = [];
  lines.push("# BIZRA Public Claims (generated — do not edit by hand)");
  lines.push("");
  lines.push(
    "> Generated from `docs/claims/node0-claim-register.v0.1.json` by",
  );
  lines.push(
    "> `scripts/claims/generate-public-claims.mjs` (`npm run claims:generate`).",
  );
  lines.push(
    "> Every public statement about BIZRA should trace to a row below. A claim's",
  );
  lines.push(
    "> `status` is its maturity, not a marketing label: DESIGNED < MECHANISM_VERIFIED_SYNTHETIC",
  );
  lines.push(
    "> < REAL_OPERATOR_VERIFIED < PUBLIC_MAIN_SYNCED < PRODUCTION_ACTIVE.",
  );
  lines.push("");
  lines.push("| ID | Claim | Scope | Status | Evidence | Confidence |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const c of claims) {
    lines.push(
      `| ${cell(c.id)} | ${cell(c.text)} | ${cell(c.scope)} | ${cell(c.status)} | ${cell(c.evidence_class)} | ${cell(c.confidence)} |`,
    );
  }
  lines.push("");
  lines.push("## Capability-gated — must NOT be stated as live");
  lines.push("");
  lines.push(
    "These carry forbidden-capability wording (token / mint / reward / economic /",
  );
  lines.push(
    "federation / public_network / production / shariah). They need external",
  );
  lines.push(
    "validation and cannot exceed MECHANISM_VERIFIED_SYNTHETIC. (Sensitivity tags",
  );
  lines.push(
    "like `private_data` are NOT listed here — a local consented run can make those",
  );
  lines.push("real; see each claim's row above for its status.)");
  lines.push("");
  const gated = claims.filter((c) => isCapabilityGated(c));
  for (const c of gated) {
    lines.push(
      `- **${cell(c.id)}** — \`${cell(c.status)}\` · blocked: ${cell(c.blocked_wording.join(", "))} · ${cell(c.verification_path)}`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function parseArgs(argv) {
  let check = false;
  let register = null;
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--check") check = true;
    else if (argv[i] === "--register" && argv[i + 1]) register = argv[++i];
    else if (argv[i] === "--out" && argv[i + 1]) out = argv[++i];
  }
  return { check, register, out };
}

function main(argv = []) {
  const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const { check, register: regOverride, out: outOverride } = parseArgs(argv);
  const registerPath = regOverride
    ? resolve(regOverride)
    : resolve(root, REGISTER);
  const outPath = outOverride ? resolve(outOverride) : resolve(root, OUTPUT);
  const register = JSON.parse(readFileSync(registerPath, "utf8"));
  const md = renderPublicClaims(register);

  if (check) {
    // Drift gate (release / git-hook): fail closed if the committed doc no longer
    // matches a fresh render of the register. Read-only; never writes.
    let committed = "";
    try {
      committed = readFileSync(outPath, "utf8");
    } catch {
      committed = "";
    }
    if (committed !== md) {
      console.error(
        `[CLAIMS] DRIFT: ${outPath} does not match the register. Run \`npm run claims:generate\`. Exit 1.`,
      );
      process.exit(1);
    }
    console.log(
      `[CLAIMS] in sync: public claims doc matches the register (${register.claims.length} claims).`,
    );
    return;
  }

  writeFileSync(outPath, md, "utf8");
  console.log(
    `[CLAIMS] generated ${outPath} from ${registerPath} (${register.claims.length} claims)`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2));
}
