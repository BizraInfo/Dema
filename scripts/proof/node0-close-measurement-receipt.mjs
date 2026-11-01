#!/usr/bin/env node
/**
 * NODE0-CLOSE-MEASUREMENT-RECEIPT-1A — emit an honest measurement receipt.
 *
 * Gathers whatever closure adapters can observe (same set as the review gate),
 * overlays soak/remote_write admission, and prints JSON. On a typical host with
 * no soak artefact and incomplete remote_write evidence this prints
 * measurement_admits_closed:false with ok:true (usable OPEN measurement).
 *
 * Boundary: no mint, no daemon start, no network beyond what adapters already
 * refuse; soak is never invented.
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateNode0ClosureInvariants } from "../../packages/core/src/node0-closure-invariants.js";
import { buildNode0CloseMeasurementReceipt } from "../../packages/core/src/node0-close-measurement-receipt.js";
import { projectSoakJudgmentToAdmission } from "../../packages/core/src/node0-soak-judgment-admission.js";
import { gatherClosureReadout } from "../review/node0-closure-invariants-check.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENDURANCE_RELDIR = join("node0", "endurance");
const RECEIPT_NAME = "endurance-receipt.json";

/**
 * Prefer the sealed receipt with the longest observed span so a short probe
 * never shadows a real MULTI_DAY_CONFIDENCE seal. Returns null when none exist
 * — silence stays silence (no invented soak).
 */
export function discoverLongestEnduranceReceipt(demaHome) {
  const root = join(demaHome, ENDURANCE_RELDIR);
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  let best = null;
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const path = join(root, ent.name, RECEIPT_NAME);
    let raw;
    let mtimeMs = 0;
    try {
      raw = readFileSync(path, "utf8");
      mtimeMs = statSync(path).mtimeMs;
    } catch {
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const span =
      typeof parsed?.verdict?.observed_span_ms === "number"
        ? parsed.verdict.observed_span_ms
        : typeof parsed?.observed_span_ms === "number"
          ? parsed.observed_span_ms
          : -1;
    if (span < 0) continue;
    if (
      !best ||
      span > best.observed_span_ms ||
      (span === best.observed_span_ms && mtimeMs > best.mtime_ms)
    ) {
      best = {
        path,
        run_id: ent.name,
        observed_span_ms: span,
        mtime_ms: mtimeMs,
        judgment: parsed,
      };
    }
  }
  return best;
}

function gitHead() {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO,
    encoding: "utf8",
  });
  return (r.stdout || "").trim() || null;
}

function parseArgs(argv) {
  const out = { soakJudgmentPath: null, soakJudgmentArgError: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--soak-judgment" || a === "--soak-judgment-file") {
      const next = argv[i + 1];
      if (next === undefined || next === "" || next.startsWith("-")) {
        out.soakJudgmentArgError =
          `${a} requires a path argument (got ${next === undefined ? "missing" : JSON.stringify(next)})`;
        return out;
      }
      out.soakJudgmentPath = next;
      i += 1;
      continue;
    }
    if (a === "--help" || a === "-h") {
      out.help = true;
    }
  }
  return out;
}

export function runNode0CloseMeasurementReceiptProof({
  soak = null,
  soak_judgment = null,
  remote_write_diagnostic = undefined,
  now = new Date(),
} = {}) {
  let soakProjection = null;
  let resolvedSoak = soak;
  if (soak_judgment !== null && soak_judgment !== undefined) {
    soakProjection = projectSoakJudgmentToAdmission(soak_judgment);
    resolvedSoak = soakProjection.ok ? soakProjection.soak : null;
  }
  const readout = gatherClosureReadout();
  const closure_ledger = evaluateNode0ClosureInvariants(readout.evidence);
  // Prefer an injected diagnostic (tests); otherwise use the diagnostic paired
  // with the closure observation from this same readout.
  const resolvedRwDiagnostic =
    remote_write_diagnostic === undefined
      ? readout.diagnostics.remote_write ?? null
      : remote_write_diagnostic;
  const receipt = buildNode0CloseMeasurementReceipt({
    closure_ledger,
    soak: resolvedSoak,
    remote_write_diagnostic: resolvedRwDiagnostic,
    head_sha: gitHead(),
    measured_at: now.toISOString(),
  });
  if (soakProjection) {
    return Object.freeze({
      ...receipt,
      soak_judgment_projection: soakProjection,
    });
  }
  return receipt;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(
      "Usage: node scripts/proof/node0-close-measurement-receipt.mjs [--soak-judgment <endurance-judgment-or-run-receipt.json>]\n" +
        "  Without --soak-judgment, discovers the longest sealed endurance-receipt.json under $DEMA_HOME/node0/endurance/ (fail-closed if none).\n",
    );
    process.exitCode = 0;
    return;
  }
  if (args.soakJudgmentArgError) {
    process.stderr.write(`${args.soakJudgmentArgError}\n`);
    process.exitCode = 2;
    return;
  }
  let soak_judgment = null;
  let discovery = null;
  if (args.soakJudgmentPath) {
    soak_judgment = JSON.parse(readFileSync(args.soakJudgmentPath, "utf8"));
  } else {
    const demaHome = process.env.DEMA_HOME || join(homedir(), ".dema");
    discovery = discoverLongestEnduranceReceipt(demaHome);
    if (discovery) soak_judgment = discovery.judgment;
  }
  const receipt = runNode0CloseMeasurementReceiptProof({ soak_judgment });
  const out =
    discovery === null
      ? receipt
      : Object.freeze({
          ...receipt,
          soak_judgment_discovery: Object.freeze({
            path: discovery.path,
            run_id: discovery.run_id,
            observed_span_ms: discovery.observed_span_ms,
            mode: "longest_sealed_endurance_receipt",
          }),
        });
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  // Exit 0 when the measurement is usable (ok). CLOSED is not required.
  process.exitCode = out.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
