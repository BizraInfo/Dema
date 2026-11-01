#!/usr/bin/env node
/**
 * NODE0-T0-GATE-STATUS — read-only snapshot of the three close-admission gates
 * plus Dema face readiness. Does not start soak, stop listeners, push, or mint.
 *
 * Exit 0 when the measurement is usable (JSON printed). Exit 1 only on I/O failure.
 * measurement_admits_closed / NODE0_CLOSED are reported honestly — never forced.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  discoverLongestEnduranceReceipt,
  runNode0CloseMeasurementReceiptProof,
} from "./node0-close-measurement-receipt.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOAK_PREFLIGHT = "/data/bizra/bin/node0-soak/preflight.sh";
const MIN_SOAK_S = 72 * 60 * 60;

function git(args) {
  const r = spawnSync("git", args, { cwd: REPO, encoding: "utf8" });
  return (r.stdout || "").trim();
}

function runDoctorJson(env) {
  const r = spawnSync("node", ["bin/dema", "doctor", "--json"], {
    cwd: REPO,
    env,
    encoding: "utf8",
    timeout: 20000,
  });
  try {
    return { exit: r.status ?? 1, json: JSON.parse(r.stdout || "{}") };
  } catch {
    return { exit: r.status ?? 1, json: null, raw_err: (r.stderr || "").slice(0, 400) };
  }
}

function main() {
  const demaHome = process.env.DEMA_HOME || join(homedir(), ".dema");
  const head = git(["rev-parse", "HEAD"]);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const discovery = discoverLongestEnduranceReceipt(demaHome);
  const soak_judgment = discovery?.judgment ?? null;
  const close = runNode0CloseMeasurementReceiptProof({ soak_judgment });

  const gatewayEnv = {
    ...process.env,
    DEMA_NODE0_ADAPTER: process.env.DEMA_NODE0_ADAPTER || "gateway-http",
    DEMA_GATEWAY_URL: process.env.DEMA_GATEWAY_URL || "http://127.0.0.1:7421",
  };
  delete gatewayEnv.DEMA_NODE0_STATUS_COMMAND;
  const doctor = runDoctorJson(gatewayEnv);

  let preflight = { ran: false, green: false, exit: null, tail: null };
  if (existsSync(SOAK_PREFLIGHT)) {
    const r = spawnSync("bash", [SOAK_PREFLIGHT], {
      cwd: REPO,
      env: { ...process.env, ...gatewayEnv },
      encoding: "utf8",
      timeout: 60000,
    });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    preflight = {
      ran: true,
      green: /PREFLIGHT GREEN/.test(out) && (r.status ?? 1) === 0,
      exit: r.status ?? 1,
      tail: out.trim().split("\n").slice(-6),
    };
  }

  const soakSeconds = close?.soak?.observed_duration_seconds ?? null;
  const out = {
    schema: "bizra.dema.node0_t0_gate_status.v0.1",
    measured_at: new Date().toISOString(),
    repo: { branch, head },
    dema_home: demaHome,
    gates: {
      dema_face: {
        doctor_exit: doctor.exit,
        operational: doctor.json?.operational ?? null,
        ready: doctor.json?.status?.ready ?? null,
        verdict: doctor.json?.verdict ?? null,
      },
      soak_preflight: preflight,
      soak_admission: {
        status: close.soak?.status ?? null,
        reason: close.soak?.reason ?? null,
        observed: close.soak?.observed ?? null,
        observed_duration_seconds: soakSeconds,
        min_duration_seconds: close.soak?.min_duration_seconds ?? MIN_SOAK_S,
        discovery: discovery
          ? {
              run_id: discovery.run_id,
              path: discovery.path,
              observed_span_ms: discovery.observed_span_ms,
            }
          : null,
      },
      remote_write: {
        status: close.remote_write?.status ?? null,
        reason: close.remote_write?.reason ?? null,
        diagnostic: close.remote_write?.diagnostic ?? null,
      },
      measurement_admits_closed: close.measurement_admits_closed === true,
      admission_verdict: close.admission_verdict ?? null,
    },
    halt_gates_exact: [
      "GO push PR slice/health-snapshot-bridge-1a",
      "GO start 72h soak",
      "GO measurement window",
    ],
    what_this_proves:
      "Current disk truth for Dema face, soak preflight, soak admission projection, and remote_write vs close-measurement.",
    what_this_does_not_prove:
      "Does not start soak, clear listeners, push, merge, or set NODE0_CLOSED.",
    authority_delta: 0,
  };

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  process.exitCode = 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
