// NODE0-RUN-1A — the node runner and endurance recorder.
//
// This is the surface the whole closure program exists to make possible: start
// it once, leave it running, come back to a record that can be JUDGED rather
// than believed.
//
// ── BOUNDARIES, STATED PLAINLY ──
// - NO DAEMON. This is an explicit foreground process the operator starts and
//   stops. It does not fork, detach, install a service, or survive its own
//   terminal. Nothing starts it automatically.
// - NO MODEL, NO NETWORK, NO EFFECT. It observes and records. It executes no
//   mission, claims no nonce, prepares no transaction and renames nothing.
// - NO AUTHORITY. `authority_delta` is 0 in every artefact it writes.
//
// ── WHY SAMPLES ARE APPEND-ONLY JSONL ──
// A run that dies must leave everything it already observed intact and
// judgeable. Rewriting one aggregate file would put the whole record at risk of
// the very crash the endurance proof is meant to survive. Each line is fsynced
// so a kill between samples loses at most the sample in flight — and the
// endurance kernel reads that loss as a GAP, never as health.

import { mkdir, open, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

import { buildHealthSnapshot } from "../../../../packages/mission/src/health-snapshot.js";
import {
  evaluateEndurance,
  ENDURANCE_TARGETS,
  NODE0_ENDURANCE_SCHEMA,
} from "../../../../packages/core/src/node0-endurance.js";

export const NODE0_RUN_SCHEMA = "bizra.dema.node0_run_receipt.v0.1";
export const ENDURANCE_RELDIR = join("node0", "endurance");

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
// Continuity allowance: a sample may be late, but not absent. Three missed
// intervals is a blackout, not jitter.
const GAP_MULTIPLIER = 3;

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function resolveHome(argv) {
  return argValue(argv, "--dema-home") || process.env.DEMA_HOME || join(homedir(), ".dema");
}

function runDir(home, runId) {
  return join(home, ENDURANCE_RELDIR, runId);
}

// The ONLY mission verdict that counts as a healthy endurance sample.
// `ATTENTION` means the node is degraded but running; for an endurance claim
// that is a failure, not a pass.
export const HEALTHY_MISSION_VERDICT = "CLEAN";

/**
 * Take one observation.
 *
 * ── THE DEFECT THIS REPLACES ──
 * The first implementation wrote `ok: snap?.ok !== false`. `buildHealthSnapshot`
 * returns NO top-level `ok` — its result lives at `attests.mission_verdict` — so
 * that expression was `undefined !== false`, which is ALWAYS true. Every sample
 * was healthy by construction, including one attesting `mission_verdict: FAILED`.
 * The test that "checked" it asserted `typeof s.ok === "boolean"` and passed
 * vacuously, because `true` is a boolean.
 *
 * Health is now derived ONLY from the verdict the snapshot actually attests, the
 * inspected home is recorded so a caller can prove WHAT was observed, and an
 * unrecognised verdict fails closed.
 */
export async function takeSample({ at, demaHome, snapshotFn = buildHealthSnapshot }) {
  try {
    const snap = await snapshotFn({ now: new Date(at), demaHome });
    const verdict = snap?.attests?.mission_verdict ?? null;
    const inspected = snap?.attests?.results?.memory?.home ?? null;
    return {
      at_ms: at,
      // Fail closed: only an explicit CLEAN is healthy. null, undefined,
      // ATTENTION, FAILED and any future verdict are all false.
      ok: verdict === HEALTHY_MISSION_VERDICT,
      mission_verdict: verdict,
      inspected_home: inspected,
      // Binding the home the caller ASKED for alongside the one actually read
      // makes a mismatch visible in the record instead of invisible.
      requested_home: demaHome ?? null,
      home_matches: inspected === (demaHome ?? null),
      content_hash: snap?.content_hash ?? null,
    };
  } catch (err) {
    // An observation that FAILED is still an observation. Recording it is what
    // separates DEGRADED (we watched it struggle) from BROKEN (we stopped watching).
    return {
      at_ms: at,
      ok: false,
      mission_verdict: null,
      inspected_home: null,
      requested_home: demaHome ?? null,
      home_matches: false,
      content_hash: null,
      error: String(err?.message ?? err).slice(0, 200),
    };
  }
}

/** Append one line and fsync it, so a kill cannot lose an observation already made. */
async function appendSampleLine(path, line) {
  const fh = await open(path, "a");
  try {
    await fh.writeFile(`${line}\n`);
    await fh.sync();
  } finally {
    await fh.close();
  }
}

export async function readSamples({ demaHome, runId }) {
  const path = join(runDir(demaHome, runId), "samples.jsonl");
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return [];
  }
  const out = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // A torn final line is a real observation loss. Record it as malformed so
      // the kernel counts it rather than silently shrinking the evidence.
      out.push({ at_ms: null, ok: false, malformed: true });
    }
  }
  return out;
}

/** Judge a run that already exists on disk. Read-only. */
export async function judgeRun({ demaHome, runId, targetMs, intervalMs = DEFAULT_INTERVAL_MS }) {
  const samples = await readSamples({ demaHome, runId });
  return evaluateEndurance({
    samples,
    targetMs,
    maxGapMs: intervalMs * GAP_MULTIPLIER,
  });
}

async function writeReceiptAtomic({ demaHome, runId, receipt }) {
  const dir = runDir(demaHome, runId);
  const finalPath = join(dir, "endurance-receipt.json");
  const temp = `${finalPath}.tmp`;
  await writeFile(temp, `${JSON.stringify(receipt, null, 2)}\n`);
  await rename(temp, finalPath);
  return finalPath;
}

/**
 * `dema node0 run` — start the node, observe it, record what happened.
 *
 * The loop is deliberately dull: snapshot, append, wait. Everything
 * interesting lives in the kernel that judges the record afterwards.
 */
export async function cmdNode0Run(ctx) {
  const argv = ctx?.argv ?? [];
  const wantJson = argv.includes("--json");
  const home = resolveHome(argv);
  const runId = argValue(argv, "--run-id") || `run-${process.pid}`;
  const intervalMs = Number(argValue(argv, "--interval-ms") ?? DEFAULT_INTERVAL_MS);
  const targetKey = (argValue(argv, "--target") || "MINIMUM_OPERATIONAL").toUpperCase();
  const targetMs = Number(argValue(argv, "--duration-ms") ?? ENDURANCE_TARGETS[targetKey] ?? ENDURANCE_TARGETS.MINIMUM_OPERATIONAL);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    console.error("Dema error: --interval-ms must be a positive number. Nothing was written.");
    process.exitCode = 1;
    return;
  }

  const dir = runDir(home, runId);
  await mkdir(dir, { recursive: true });
  const samplesPath = join(dir, "samples.jsonl");

  // ── judge-only mode: read an existing record, write nothing ──
  if (argv.includes("--judge")) {
    const verdict = await judgeRun({ demaHome: home, runId, targetMs, intervalMs });
    if (wantJson) console.log(JSON.stringify({ preview_only: true, run_id: runId, ...verdict }, null, 2));
    else {
      console.log(`DEMA · node0 endurance judgment (read-only) · run ${runId}`);
      console.log(`  verdict: ${verdict.verdict} · reason: ${verdict.reason}`);
      console.log(`  observed span: ${verdict.observed_span_ms}ms of ${verdict.target_ms}ms target`);
      console.log(`  samples: ${verdict.sample_count} · failures: ${verdict.failure_count} · gaps: ${verdict.gap_count}`);
      console.log(`  continuously observed: ${verdict.continuously_observed}`);
    }
    process.exitCode = verdict.ok ? 0 : 1;
    return;
  }

  let stopping = false;
  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(`DEMA · node0 run · ${runId}`);
  console.log(`  home: ${home}`);
  console.log(`  interval: ${intervalMs}ms · target: ${targetMs}ms · samples: ${samplesPath}`);
  console.log("  foreground process · no daemon, no model, no network, no effect. Ctrl-C to end and seal.");

  const startedAt = Date.now();
  let taken = 0;

  while (!stopping) {
    const at = Date.now();
    const sample = await takeSample({ at, demaHome: home });
    await appendSampleLine(samplesPath, JSON.stringify(sample));
    taken += 1;
    if (!wantJson) process.stdout.write(`  sample ${taken} · ok=${sample.ok} · ${new Date(at).toISOString()}\n`);

    if (Date.now() - startedAt >= targetMs) break;
    if (stopping) break;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  const verdict = await judgeRun({ demaHome: home, runId, targetMs, intervalMs });
  const receipt = {
    schema: NODE0_RUN_SCHEMA,
    run_id: runId,
    endurance_schema: NODE0_ENDURANCE_SCHEMA,
    started_at_ms: startedAt,
    ended_at_ms: Date.now(),
    interval_ms: intervalMs,
    target_ms: targetMs,
    samples_taken: taken,
    stopped_by_signal: stopping,
    verdict,
    boundary: {
      daemon: false, model_invoked: false, network: false,
      effect_executed: false, nonce_claimed: false, transaction_prepared: false,
    },
    authority_delta: 0,
  };
  const receiptPath = await writeReceiptAtomic({ demaHome: home, runId, receipt });

  if (wantJson) console.log(JSON.stringify(receipt, null, 2));
  else {
    console.log(`\n  endurance verdict: ${verdict.verdict} — ${verdict.reason}`);
    console.log(`  observed span: ${verdict.observed_span_ms}ms · samples: ${verdict.sample_count} · gaps: ${verdict.gap_count}`);
    console.log(`  receipt: ${receiptPath}`);
    console.log("  nothing was executed: no effect, no nonce, no transaction, authority_delta 0.");
  }
  process.exitCode = verdict.ok ? 0 : 1;
}
