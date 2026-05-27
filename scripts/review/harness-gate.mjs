#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const out = execFileSync(
  "node",
  ["apps/cli/src/index.js", "harness", "--summary", "--json"],
  { env: { ...process.env, NO_COLOR: "1" } },
).toString();

const result = JSON.parse(out);
console.log(JSON.stringify(result, null, 2));

if (result.verdict !== "CLEAN") {
  console.error(`Harness verdict: ${result.verdict} (expected CLEAN)`);
  process.exit(1);
}
