#!/usr/bin/env node
// DEMA-QUALITY-DELIVERY-SPINE-1A · UX first-look gate.

import {
  buildFirstLookHome,
  gatherFirstLookContext,
} from "../../packages/core/src/dema-first-look-home.js";
import { evaluateUxFirstLookEnvelope } from "../../packages/core/src/ux-quality-gate.js";

const JSON_MODE = process.argv.includes("--json");

const ctx = await gatherFirstLookContext();
const envelope = buildFirstLookHome(ctx);
const ux = evaluateUxFirstLookEnvelope(envelope);
const pass = ux.pass;

if (JSON_MODE) {
  console.log(JSON.stringify({ ok: pass, ux, schema: envelope.schema }, null, 2));
} else {
  console.log("DEMA · UX first-look gate");
  console.log(`  schema: ${envelope.schema}`);
  console.log(`  violations: ${ux.violations.length}`);
  console.log(`  missing: ${ux.missing.join(", ") || "none"}`);
  console.log(`  result: ${pass ? "PASS" : "FAIL"}`);
}

process.exit(pass ? 0 : 1);
