#!/usr/bin/env node
/**
 * NODE0-T0-GATE-STATUS — read-only snapshot of the three close-admission gates
 * plus Dema face readiness. Does not start soak, stop listeners, push, or mint.
 *
 * Exit 0 when the measurement is usable (JSON printed). Exit 1 only on I/O failure.
 * measurement_admits_closed / NODE0_CLOSED are reported honestly — never forced.
 *
 * Mid-soak: when `bizra-node0-soak` is active, also report `soak_runtime` (unit,
 * freeze drift, live samples). Preflight RED while a freeze-pinned run is live
 * is expected (HEAD/bytes may differ from a *new* start) — do not read that as
 * soak failure.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  discoverLongestEnduranceReceipt,
  runNode0CloseMeasurementReceiptProof,
} from "./node0-close-measurement-receipt.mjs";
import { gatherClosureReadout } from "../review/node0-closure-invariants-check.mjs";
import {
  evaluateNode0ClosureInvariants,
  CLOSURE_INVARIANTS,
} from "../../packages/core/src/node0-closure-invariants.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOAK_PREFLIGHT = "/data/bizra/bin/node0-soak/preflight.sh";
const SOAK_STATE = "/data/bizra/node0-soak-state";
const SOAK_UNIT = "bizra-node0-soak";
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

function readLiveSoakRuntime(demaHome) {
  const active = spawnSync("systemctl", ["--user", "is-active", SOAK_UNIT], {
    encoding: "utf8",
  });
  const unit_active = (active.stdout || "").trim() === "active";
  let run_id = null;
  try {
    run_id = readFileSync(join(SOAK_STATE, "current-run-id"), "utf8").trim() || null;
  } catch {
    run_id = null;
  }

  let freeze = { checked: false, drift_count: null, frozen_commit: null, manifest: null };
  if (run_id) {
    const manifestPath = join(SOAK_STATE, `instrumentation-manifest-${run_id}.json`);
    if (existsSync(manifestPath)) {
      try {
        const man = JSON.parse(readFileSync(manifestPath, "utf8"));
        const files = man?.rederivable?.files || {};
        let drift = 0;
        for (const [path, expected] of Object.entries(files)) {
          try {
            const h = createHash("sha256").update(readFileSync(path)).digest("hex");
            if (h !== expected) drift += 1;
          } catch {
            drift += 1;
          }
        }
        freeze = {
          checked: true,
          drift_count: drift,
          frozen_commit: man?.runner?.commit_sha ?? null,
          manifest: manifestPath,
        };
      } catch {
        freeze = { checked: true, drift_count: null, frozen_commit: null, manifest: manifestPath, error: "manifest_unreadable" };
      }
    }
  }

  let samples = {
    path: null,
    line_count: 0,
    sample_count: 0,
    last_ok: null,
    last_mission_verdict: null,
    target_ms: null,
    observed_span_ms: null,
  };
  if (run_id) {
    const samplesPath = join(demaHome, "node0", "endurance", run_id, "samples.jsonl");
    samples.path = samplesPath;
    if (existsSync(samplesPath)) {
      const lines = readFileSync(samplesPath, "utf8").trim().split("\n").filter(Boolean);
      samples.line_count = lines.length;
      let header = null;
      let lastSample = null;
      let firstSampleAt = null;
      for (const line of lines) {
        try {
          const r = JSON.parse(line);
          if (r?.kind === "ENDURANCE_RUN_HEADER") header = r;
          if (r?.kind === "ENDURANCE_SAMPLE") {
            lastSample = r;
            samples.sample_count += 1;
            if (firstSampleAt == null && Number.isFinite(Number(r.at_ms))) firstSampleAt = Number(r.at_ms);
          }
        } catch {
          /* skip bad line */
        }
      }
      samples.target_ms = Number.isFinite(Number(header?.target_ms)) ? Number(header.target_ms) : null;
      samples.last_ok = lastSample?.ok ?? null;
      samples.last_mission_verdict = lastSample?.mission_verdict ?? null;
      if (firstSampleAt != null && lastSample && Number.isFinite(Number(lastSample.at_ms))) {
        samples.observed_span_ms = Number(lastSample.at_ms) - firstSampleAt;
      }
    }
  }

  return {
    unit: SOAK_UNIT,
    unit_active,
    run_id,
    freeze,
    samples,
    note: unit_active
      ? "Live soak — admission still uses longest *sealed* receipt until this run seals HEALTHY at ≥72h."
      : "No active soak unit.",
  };
}

function main() {
  const demaHome = process.env.DEMA_HOME || join(homedir(), ".dema");
  const head = git(["rev-parse", "HEAD"]);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const discovery = discoverLongestEnduranceReceipt(demaHome);
  const soak_judgment = discovery?.judgment ?? null;
  const close = runNode0CloseMeasurementReceiptProof({ soak_judgment });
  const readout = gatherClosureReadout();
  const ledger = evaluateNode0ClosureInvariants(readout.evidence);
  const ledgerRows = (ledger.invariants || []).map((row, i) => ({
    id: row.id || CLOSURE_INVARIANTS[i]?.id || String(i),
    status: row.status,
    reason: row.reason ?? null,
  }));
  const ledgerOpen = ledgerRows.filter((r) => r.status !== "SATISFIED");

  const gatewayEnv = {
    ...process.env,
    DEMA_NODE0_ADAPTER: process.env.DEMA_NODE0_ADAPTER || "gateway-http",
    DEMA_GATEWAY_URL: process.env.DEMA_GATEWAY_URL || "http://127.0.0.1:7421",
  };
  delete gatewayEnv.DEMA_NODE0_STATUS_COMMAND;
  const doctor = runDoctorJson(gatewayEnv);
  const soak_runtime = readLiveSoakRuntime(demaHome);

  let preflight = { ran: false, green: false, exit: null, tail: null, skipped_reason: null };
  if (soak_runtime.unit_active) {
    preflight = {
      ran: false,
      green: null,
      exit: null,
      tail: null,
      skipped_reason:
        "soak_unit_active — preflight is a *start* gate; mid-soak truth is gates.soak_runtime (freeze+samples).",
    };
  } else if (existsSync(SOAK_PREFLIGHT)) {
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
      skipped_reason: null,
    };
  }

  const soakSeconds = close?.soak?.observed_duration_seconds ?? null;
  const halt = ["GO measurement window"];
  if (!soak_runtime.unit_active) halt.unshift("GO start 72h soak");
  halt.unshift("GO push PR slice/health-snapshot-bridge-1a");

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
      soak_runtime,
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
      closure_ledger: {
        node0_closed: ledger.node0_closed === true,
        verdict: ledger.verdict ?? null,
        satisfied_count: ledger.satisfied_count ?? null,
        open: ledgerOpen,
        note:
          "Soak is NOT one of the ten ledger invariants — it gates measurement_admits_closed only. Ledger node0_closed needs all ten SATISFIED (today: remote_write).",
      },
    },
    halt_gates_exact: halt,
    what_this_proves:
      "Current disk truth for Dema face, live soak runtime (if any), soak admission projection, and remote_write vs close-measurement.",
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
