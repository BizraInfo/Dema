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

import { mkdir, open, readFile, writeFile, rename, realpath, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

import { buildHealthSnapshot } from "../../../../packages/mission/src/health-snapshot.js";
import {
  evaluateEndurance,
  ENDURANCE_TARGETS,
  NODE0_ENDURANCE_SCHEMA,
} from "../../../../packages/core/src/node0-endurance.js";
import {
  chainEnduranceRecord,
  buildEnduranceAnchor,
  verifyEnduranceChain,
  ENDURANCE_HEADER_KIND,
  ENDURANCE_SAMPLE_KIND,
  ENDURANCE_EVIDENCE_CLASSES,
} from "../../../../packages/core/src/node0-endurance-chain.js";
import { sha256CanonicalJsonV1 } from "../../../../packages/canon/src/sha256-canonical-json-v1.js";
import {
  INSTRUMENTATION_DRIFT_VERDICT,
  deriveInstrumentationBundleHash,
  validateInstrumentationManifest,
  compareInstrumentationObservation,
} from "../../../../packages/core/src/node0-instrumentation-freeze.js";

export const NODE0_RUN_SCHEMA = "bizra.dema.node0_run_receipt.v0.1";
export const ENDURANCE_RELDIR = join("node0", "endurance");
export const ENDURANCE_ANCHOR_FILE = "anchor.json";

/**
 * The files whose bytes decide what a sample MEANS.
 *
 * ── WHY BYTES, NOT A GIT REVISION ──
 * The obvious binding is the commit and tree the runner was started from. It is
 * the weaker fact: a dirty working tree at a clean commit reports the clean
 * commit, so the record would name code that is not the code that ran. Hashing
 * the executed files binds the record to what actually produced it.
 *
 * It also costs no new capability. Measuring git needs `node:child_process`,
 * which R5 forbids the runner outright — and moving that spawn into a
 * neighbouring module to slip past a source scan would be evasion, not
 * compliance. The git revision remains a real but separate fact; this record
 * does not claim it.
 */
const RUNNER_CODE_FILES = Object.freeze([
  new URL("./node0-run.js", import.meta.url),
  new URL("../../../../packages/core/src/node0-endurance.js", import.meta.url),
  new URL("../../../../packages/core/src/node0-endurance-chain.js", import.meta.url),
  new URL("../../../../packages/mission/src/health-snapshot.js", import.meta.url),
]);

export async function measureRunnerCodeHash() {
  const parts = {};
  for (const url of RUNNER_CODE_FILES) {
    const path = fileURLToPath(url);
    parts[basename(path)] = sha256CanonicalJsonV1(await readFile(path, "utf8"));
  }
  return sha256CanonicalJsonV1(parts);
}

/**
 * NODE0-ENDURANCE-INSTRUMENTATION-FREEZE-1A — fs-only re-derivation of the
 * frozen contract. Runs once per sample. No child_process (R5), no network:
 * every re-checked fact is bytes on disk or this process's own identity.
 * A file that cannot be read is left ABSENT — the pure kernel reads absence
 * as drift, never as a skipped check.
 */
export async function deriveInstrumentationObservation(manifest, { demaHome } = {}) {
  const frozen = manifest?.rederivable ?? {};
  const files = {};
  for (const path of Object.keys(frozen.files ?? {})) {
    try {
      files[path] = createHash("sha256").update(await readFile(path)).digest("hex");
    } catch {
      // absent — kernel names it file_missing
    }
  }
  const observation = { files, node_version: process.version };
  if (frozen.node_executable !== undefined) {
    const exe = { path: process.execPath };
    if (frozen.node_executable?.sha256 !== undefined) {
      try {
        exe.sha256 = createHash("sha256").update(await readFile(process.execPath)).digest("hex");
      } catch {
        // absent — kernel names it node_executable_bytes_changed
      }
    }
    observation.node_executable = exe;
  }
  if (frozen.dema_home_realpath !== undefined && demaHome) {
    try {
      observation.dema_home_realpath = await realpath(demaHome);
    } catch {
      // absent — kernel names it dema_home_changed
    }
  }
  if (frozen.env !== undefined) {
    const env = {};
    for (const name of Object.keys(frozen.env)) {
      if (process.env[name] !== undefined) env[name] = process.env[name];
    }
    observation.env = env;
  }
  return observation;
}

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

/** Every line of the record, header included. */
export async function readRecords({ demaHome, runId }) {
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

/** Observations only. The run header is chain metadata, not a health sample. */
export async function readSamples({ demaHome, runId }) {
  const records = await readRecords({ demaHome, runId });
  return records.filter((r) => r?.kind !== ENDURANCE_HEADER_KIND);
}

export async function readAnchor({ demaHome, runId }) {
  try {
    return JSON.parse(await readFile(join(runDir(demaHome, runId), ENDURANCE_ANCHOR_FILE), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Judge a run that already exists on disk. Read-only.
 *
 * ── WHY INTEGRITY GATES THE VERDICT ──
 * Measured before this slice: deleting the last 10 of 26 samples left the
 * verdict at `HEALTHY ok:true`, still reporting "continuously observed", with no
 * field anywhere in the result that even mentioned integrity. Coverage was
 * judged over whatever bytes happened to remain.
 *
 * A record whose chain does not verify, or which the anchor says is missing its
 * tail, is not weak evidence — it is not evidence. It can never read HEALTHY.
 * An UNWITNESSED record (`ABSENT`: written before this slice existed) is left
 * judged as before but is explicitly marked not tamper-evident, because
 * accusing it of tampering would be as dishonest as vouching for it.
 */
/**
 * When `--judge` is invoked without an explicit `--target` / `--duration-ms`,
 * prefer the run header's recorded `target_ms` (and `interval_ms`). Otherwise a
 * 72h MULTI_DAY soak is silently judged against the 24h MINIMUM_OPERATIONAL
 * default — false progress framing mid-soak, and a false HEALTHY at 24h.
 */
export function resolveJudgeTimingFromHeader(records, { targetMs, intervalMs, explicitTarget }) {
  const header = Array.isArray(records)
    ? records.find((r) => r?.kind === ENDURANCE_HEADER_KIND)
    : null;
  if (explicitTarget) {
    return Object.freeze({
      targetMs,
      intervalMs,
      source: "cli",
      header_target_ms: Number.isFinite(Number(header?.target_ms)) ? Number(header.target_ms) : null,
    });
  }
  const headerTarget = Number(header?.target_ms);
  const headerInterval = Number(header?.interval_ms);
  return Object.freeze({
    targetMs: Number.isFinite(headerTarget) && headerTarget > 0 ? headerTarget : targetMs,
    intervalMs: Number.isFinite(headerInterval) && headerInterval > 0 ? headerInterval : intervalMs,
    source: Number.isFinite(headerTarget) && headerTarget > 0 ? "header" : "cli_default",
    header_target_ms: Number.isFinite(headerTarget) ? headerTarget : null,
  });
}

export async function judgeRun({ demaHome, runId, targetMs, intervalMs = DEFAULT_INTERVAL_MS }) {
  const records = await readRecords({ demaHome, runId });
  const chain = verifyEnduranceChain({
    records,
    anchor: await readAnchor({ demaHome, runId }),
    runId,
  });
  const samples = records.filter((r) => r?.kind !== ENDURANCE_HEADER_KIND);
  const verdict = evaluateEndurance({
    samples,
    targetMs,
    maxGapMs: intervalMs * GAP_MULTIPLIER,
  });

  if (!chain.ok && chain.chain_state !== "ABSENT") {
    return Object.freeze({
      ...verdict,
      ok: false,
      verdict: "BROKEN",
      reason: `endurance_record_integrity_failed:${chain.chain_state}:${chain.reason}`,
      chain,
    });
  }
  return Object.freeze({
    ...verdict,
    // An elapsed-run target claim needs BOTH a healthy judgment and a witnessed
    // ELAPSED record. A CUSTOM_TEST chain proves the judgment works, never that
    // a node endured anything.
    target_met_by_elapsed_run: verdict.ok === true && chain.ok === true && chain.elapsed_evidence === true,
    chain,
  });
}

/**
 * Rewrite the out-of-band anchor.
 *
 * ORDER IS LOAD-BEARING: the sample is appended and fsynced FIRST, then the
 * anchor is replaced. That way the records may lead the anchor by exactly one
 * (a crash in the window — recoverable, judged TORN_TAIL) but the anchor can
 * never lead the records except by removal, which is what makes truncation
 * detectable at all.
 */
async function writeAnchorAtomic({ dir, anchor }) {
  const finalPath = join(dir, ENDURANCE_ANCHOR_FILE);
  const temp = `${finalPath}.tmp`;
  await writeFile(temp, `${JSON.stringify(anchor, null, 2)}\n`);
  await rename(temp, finalPath);
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
  const explicitInterval = argValue(argv, "--interval-ms");
  const explicitDuration = argValue(argv, "--duration-ms");
  const explicitTargetKey = argValue(argv, "--target");
  const intervalMs = Number(explicitInterval ?? DEFAULT_INTERVAL_MS);
  const targetKey = (explicitTargetKey || "MINIMUM_OPERATIONAL").toUpperCase();
  const targetMs = Number(explicitDuration ?? ENDURANCE_TARGETS[targetKey] ?? ENDURANCE_TARGETS.MINIMUM_OPERATIONAL);
  const explicitTarget = explicitDuration != null || explicitTargetKey != null;

  // Run ids become directory names under DEMA_HOME — refuse traversal / separators.
  if (
    typeof runId !== "string" ||
    !runId ||
    runId === "." ||
    runId === ".." ||
    runId.includes("/") ||
    runId.includes("\\") ||
    runId.includes("\0")
  ) {
    console.error("Dema error: --run-id must be a single path segment (no separators). Nothing was written.");
    process.exitCode = 1;
    return;
  }

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    console.error("Dema error: --interval-ms must be a positive number. Nothing was written.");
    process.exitCode = 1;
    return;
  }
  if (!Number.isFinite(targetMs) || targetMs <= 0) {
    console.error("Dema error: --duration-ms / --target must resolve to a positive finite duration. Nothing was written.");
    process.exitCode = 1;
    return;
  }

  // ── FREEZE-1A: load the frozen instrumentation contract, fail-closed ──
  // A qualifying run binds the exact bytes that observe it. An unreadable or
  // invalid manifest refuses the run BEFORE anything is written — starting
  // "without the freeze this once" is exactly the hidden mutation the
  // contract exists to forbid.
  const manifestPath = argValue(argv, "--instrumentation-manifest");
  let frozenManifest = null;
  let frozenManifestRaw = null;
  let instrumentationBundleHash = null;
  if (manifestPath && !argv.includes("--judge")) {
    try {
      frozenManifestRaw = await readFile(manifestPath, "utf8");
      frozenManifest = JSON.parse(frozenManifestRaw);
    } catch (err) {
      console.error(`Dema error: instrumentation manifest unreadable at '${manifestPath}': ${err?.message ?? err}. Nothing was written.`);
      process.exitCode = 1;
      return;
    }
    const valid = validateInstrumentationManifest(frozenManifest);
    if (!valid.ok) {
      console.error(`Dema error: instrumentation manifest invalid: ${valid.problems.join("; ")}. Nothing was written.`);
      process.exitCode = 1;
      return;
    }
    instrumentationBundleHash = deriveInstrumentationBundleHash(frozenManifest);
  }

  const dir = runDir(home, runId);
  const samplesPath = join(dir, "samples.jsonl");

  // ── judge-only mode: read an existing record, write nothing ──
  // Do not mkdir: missing runs must stay missing (read-only home / absent id).
  if (argv.includes("--judge")) {
    const records = await readRecords({ demaHome: home, runId });
    const timing = resolveJudgeTimingFromHeader(records, { targetMs, intervalMs, explicitTarget });
    const verdict = await judgeRun({
      demaHome: home,
      runId,
      targetMs: timing.targetMs,
      intervalMs: timing.intervalMs,
    });
    if (wantJson) {
      console.log(JSON.stringify({
        preview_only: true,
        run_id: runId,
        target_source: timing.source,
        header_target_ms: timing.header_target_ms,
        ...verdict,
      }, null, 2));
    } else {
      console.log(`DEMA · node0 endurance judgment (read-only) · run ${runId}`);
      console.log(`  verdict: ${verdict.verdict} · reason: ${verdict.reason}`);
      console.log(`  observed span: ${verdict.observed_span_ms}ms of ${verdict.target_ms}ms target (source=${timing.source})`);      console.log(`  samples: ${verdict.sample_count} · failures: ${verdict.failure_count} · gaps: ${verdict.gap_count}`);
      console.log(`  continuously observed: ${verdict.continuously_observed}`);
    }
    process.exitCode = verdict.ok ? 0 : 1;
    return;
  }

  await mkdir(dir, { recursive: true });

  // ── FREEZE-1A class-27 guard: a terminally sealed run never grows ──
  // The endurance receipt is the runner's own terminal seal. Appending after
  // it would let a "resumed" tail borrow the sealed record's credibility.
  let sealed = false;
  try {
    await readFile(join(dir, "endurance-receipt.json"));
    sealed = true;
  } catch {
    sealed = false;
  }
  if (sealed) {
    console.error(
      `Dema error: run '${runId}' is terminally sealed — its endurance-receipt.json exists. `
      + "Refusing to append. Nothing was written. A new --run-id is free.",
    );
    process.exitCode = 1;
    return;
  }

  // Exclusive per-run ownership: two foreground recorders must not share a run id.
  // Crash recovery: a lock whose pid is dead (or unreadable) is cleared once.
  const lockPath = join(dir, "runner.lock");
  let lockFh = null;
  try {
    lockFh = await open(lockPath, "wx");
    await lockFh.writeFile(`${process.pid}\n`);
  } catch (err) {
    if (err?.code === "EEXIST") {
      let stale = false;
      try {
        const prior = Number((await readFile(lockPath, "utf8")).trim());
        if (Number.isInteger(prior) && prior > 0) {
          try {
            process.kill(prior, 0);
          } catch {
            stale = true;
          }
        } else {
          stale = true;
        }
      } catch {
        stale = true;
      }
      if (stale) {
        await unlink(lockPath);
        lockFh = await open(lockPath, "wx");
        await lockFh.writeFile(`${process.pid}\n`);
      } else {
        console.error(
          `Dema error: run '${runId}' is already owned by another live runner (lock ${lockPath}). `
          + "Nothing was written. A new --run-id is free.",
        );
        process.exitCode = 1;
        return;
      }
    } else {
      throw err;
    }
  }
  const releaseLock = async () => {
    try {
      await lockFh?.close();
    } catch {
      // ignore
    }
    try {
      await unlink(lockPath);
    } catch {
      // ignore
    }
  };

  let stopping = false;
  let wakeSleep = null;
  const stop = () => {
    stopping = true;
    if (typeof wakeSleep === "function") wakeSleep();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(`DEMA · node0 run · ${runId}`);
  console.log(`  home: ${home}`);
  console.log(`  interval: ${intervalMs}ms · target: ${targetMs}ms · samples: ${samplesPath}`);
  console.log("  foreground process · no daemon, no model, no network, no effect. Ctrl-C to end and seal.");

  // ── FREEZE-1A: co-locate the manifest bytes with the evidence ──
  if (frozenManifest) {
    const copyPath = join(dir, "instrumentation-manifest.json");
    let existingCopy = null;
    try {
      existingCopy = await readFile(copyPath, "utf8");
    } catch {
      existingCopy = null;
    }
    if (existingCopy === null) {
      const temp = `${copyPath}.tmp`;
      await writeFile(temp, frozenManifestRaw);
      await rename(temp, copyPath);
    } else if (deriveInstrumentationBundleHash(JSON.parse(existingCopy)) !== instrumentationBundleHash) {
      console.error(
        `Dema error: run '${runId}' already carries a DIFFERENT instrumentation manifest. `
        + "Refusing. Nothing was written. A new --run-id is free.",
      );
      await releaseLock();
      process.exitCode = 1;
      return;
    }
  }

  // ── establish the chain head before observing anything ──
  const existing = await readRecords({ demaHome: home, runId });
  let prev = null;
  let boundIntervalMs = intervalMs;
  let boundTargetMs = targetMs;
  if (existing.length === 0) {
    // Erased samples with a surviving anchor must not be silently rewritten —
    // that would destroy the evidence of erasure under the same run id.
    let survivingAnchor = null;
    try {
      survivingAnchor = await readAnchor({ demaHome: home, runId });
    } catch {
      survivingAnchor = null;
    }
    if (survivingAnchor) {
      console.error(
        `Dema error: run '${runId}' has an anchor but no samples — refusing to re-initialize. `
        + "Nothing was written. A new --run-id is free.",
      );
      await releaseLock();
      process.exitCode = 1;
      return;
    }
    // The header is seq 0, so every sample chains transitively to the code that
    // produced it. Measured from the executing bytes, never asserted.
    prev = chainEnduranceRecord({
      record: {
        kind: ENDURANCE_HEADER_KIND,
        run_id: runId,
        runner_code_hash: await measureRunnerCodeHash(),
        // Only an actual runner loop reaches this line. It is not settable from
        // the CLI, so a synthesised record cannot mint ELAPSED through it.
        evidence_class: ENDURANCE_EVIDENCE_CLASSES.ELAPSED,
        interval_ms: intervalMs,
        target_ms: targetMs,
        started_at_ms: Date.now(),
        // Bound only when a frozen contract governs the run; absent for
        // legacy/shakedown runs so their records stay byte-compatible.
        ...(instrumentationBundleHash
          ? { instrumentation_bundle_hash: instrumentationBundleHash }
          : {}),
      },
    });
    await appendSampleLine(samplesPath, JSON.stringify(prev));
    await writeAnchorAtomic({ dir, anchor: buildEnduranceAnchor({ head: prev, runId }) });
  } else {
    const resumed = verifyEnduranceChain({
      records: existing,
      anchor: await readAnchor({ demaHome: home, runId }),
      runId,
    });
    if (!resumed.ok) {
      // Appending to a record whose integrity cannot be established would launder
      // the damage into an otherwise-clean tail. Refuse; a new --run-id is free.
      console.error(
        `Dema error: refusing to extend run '${runId}' — ${resumed.chain_state}: ${resumed.reason}. `
        + "Nothing was written. Start a new --run-id.",
      );
      await releaseLock();
      process.exitCode = 1;
      return;
    }
    prev = existing[existing.length - 1];

    // Resume must bind the same runner bytes the header recorded — otherwise a
    // rebuilt CLI could quietly extend a foreign chain.
    const liveRunnerHash = await measureRunnerCodeHash();
    const headerRunnerHash = existing[0]?.runner_code_hash ?? null;
    if (headerRunnerHash && headerRunnerHash !== liveRunnerHash) {
      console.error(
        `Dema error: refusing to extend run '${runId}' — runner_code_hash mismatch `
        + `(header ${headerRunnerHash}, live ${liveRunnerHash}). Nothing was written. A new --run-id is free.`,
      );
      await releaseLock();
      process.exitCode = 1;
      return;
    }

    // Continuity contract is the header's interval — refuse a widened CLI gap
    // that would launder blackouts into HEALTHY.
    const headerInterval = Number(existing[0]?.interval_ms);
    if (Number.isFinite(headerInterval) && headerInterval > 0) {
      if (intervalMs > headerInterval) {
        console.error(
          `Dema error: refusing to extend run '${runId}' — --interval-ms ${intervalMs} widens `
          + `header interval ${headerInterval}. Nothing was written. A new --run-id is free.`,
        );
        await releaseLock();
        process.exitCode = 1;
        return;
      }
      boundIntervalMs = headerInterval;
    }
    const headerTarget = Number(existing[0]?.target_ms);
    if (Number.isFinite(headerTarget) && headerTarget > 0) {
      boundTargetMs = headerTarget;
    }

    // ── FREEZE-1A: a resumed qualifying run must resume under the SAME frozen
    // contract its header binds — including when this invocation omitted the
    // manifest (the restart vector that would drop per-sample drift checks).
    const headerHash = existing[0]?.instrumentation_bundle_hash ?? null;
    if (headerHash) {
      if (!frozenManifest || headerHash !== instrumentationBundleHash) {
        console.error(
          `Dema error: run '${runId}' binds instrumentation_bundle_hash ${headerHash}; `
          + "resume requires a matching --instrumentation-manifest. Nothing was written. A new --run-id is free.",
        );
        await releaseLock();
        process.exitCode = 1;
        return;
      }
    } else if (frozenManifest) {
      console.error(
        `Dema error: instrumentation manifest does not match run '${runId}' `
        + "(header binds none). Nothing was written. A new --run-id is free.",
      );
      await releaseLock();
      process.exitCode = 1;
      return;
    }

    // TORN_TAIL: repair the lagging anchor to the verified head before appending
    // so a second crash cannot leave the witness two samples behind.
    if (resumed.chain_state === "TORN_TAIL") {
      await writeAnchorAtomic({ dir, anchor: buildEnduranceAnchor({ head: prev, runId }) });
    }
  }

  const startedAt = Date.now();
  let taken = 0;
  let driftSamples = 0;

  try {
    while (!stopping) {
      const at = Date.now();
      // ── FREEZE-1A: re-derive the frozen surface BEFORE trusting the probe.
      // A drifted observer cannot certify health; the sample records what moved.
      // The chain continues — evidence is preserved, the clock is not laundered.
      let sample = null;
      if (frozenManifest) {
        const observed = await deriveInstrumentationObservation(frozenManifest, { demaHome: home });
        const cmp = compareInstrumentationObservation({
          frozen: frozenManifest.rederivable,
          observed,
        });
        if (cmp.drifted) {
          driftSamples += 1;
          sample = {
            at_ms: at,
            ok: false,
            mission_verdict: INSTRUMENTATION_DRIFT_VERDICT,
            instrumentation_drift: cmp.drift,
          };
        }
      }
      if (!sample) sample = await takeSample({ at, demaHome: home });
      const record = chainEnduranceRecord({
        record: { kind: ENDURANCE_SAMPLE_KIND, run_id: runId, ...sample },
        prev,
      });
      await appendSampleLine(samplesPath, JSON.stringify(record));
      await writeAnchorAtomic({ dir, anchor: buildEnduranceAnchor({ head: record, runId }) });
      prev = record;
      taken += 1;
      if (!wantJson) process.stdout.write(`  sample ${taken} · ok=${sample.ok} · ${new Date(at).toISOString()}\n`);

      if (Date.now() - startedAt >= boundTargetMs) break;
      if (stopping) break;
      await new Promise((r) => {
        const t = setTimeout(r, boundIntervalMs);
        wakeSleep = () => {
          clearTimeout(t);
          r();
        };
      });
      wakeSleep = null;
    }

    const verdict = await judgeRun({
      demaHome: home,
      runId,
      targetMs: boundTargetMs,
      intervalMs: boundIntervalMs,
    });
    const receipt = {
      schema: NODE0_RUN_SCHEMA,
      run_id: runId,
      endurance_schema: NODE0_ENDURANCE_SCHEMA,
      started_at_ms: startedAt,
      ended_at_ms: Date.now(),
      interval_ms: boundIntervalMs,
      target_ms: boundTargetMs,
      samples_taken: taken,
      stopped_by_signal: stopping,
      verdict,
      // Surfaced at the top level so a reader never has to infer integrity from
      // the absence of a complaint.
      tamper_evident: verdict.chain?.tamper_evident === true,
      chain_state: verdict.chain?.chain_state ?? null,
      evidence_class: verdict.chain?.evidence_class ?? null,
      runner_code_hash: verdict.chain?.runner_code_hash ?? null,
      target_met_by_elapsed_run: verdict.target_met_by_elapsed_run === true,
      instrumentation: {
        bundle_hash: instrumentationBundleHash,
        drift_sample_count: driftSamples,
      },
      boundary: {
        daemon: false,
        model_invoked: false,
        // Bridged health snapshots consult gateway-http / STATUS_COMMAND over the
        // loopback network stack — report that honestly (public internet still false).
        network: Boolean(
          process.env.DEMA_NODE0_ADAPTER ||
            process.env.DEMA_GATEWAY_URL ||
            process.env.DEMA_NODE0_STATUS_COMMAND,
        ),
        effect_executed: false,
        nonce_claimed: false,
        transaction_prepared: false,
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
  } finally {
    await releaseLock();
  }
}
