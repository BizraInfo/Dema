#!/usr/bin/env node
// DEMA-FIRST-LIGHT-GUI-FRONT-DOOR-PREVIEW-1A — review gate (READ-ONLY).
//
//   node scripts/review/dema-first-light-front-door-preview-check.mjs [--json]
//
// Verifies the shipped front-door HTML (apps/front-door/index.html) conforms to the pure contract in
// packages/core/src/dema-first-light-front-door-preview.js: zero external requests, only the opt-in
// 127.0.0.1 probe, PREVIEW_ONLY / NO MINT / NO FEDERATION disclaimers, URP/apps/data inert, bilingual,
// evidence chips, self-audit. Reads one file and builds nothing.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  verifyFrontDoorHtml,
  DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_SCHEMA,
  DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_TRUTH_LABEL,
} from "../../packages/core/src/dema-first-light-front-door-preview.js";

const FRONT_DOOR_HTML = "apps/front-door/index.html";

export function runDemaFirstLightFrontDoorPreviewCheck() {
  let html = "";
  try {
    html = readFileSync(join(process.cwd(), FRONT_DOOR_HTML), "utf8");
  } catch {
    html = "";
  }
  return verifyFrontDoorHtml(html);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runDemaFirstLightFrontDoorPreviewCheck();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - DEMA-FIRST-LIGHT-GUI-FRONT-DOOR-PREVIEW-1A (static preview)");
    console.log(`  schema: ${DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_SCHEMA}`);
    console.log(`  truth:  ${DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    for (const code of result.blocked_by) console.log(`    ${code}`);
  }
  if (!result.ok) process.exit(1);
}
