// POI-TIME-COMPRESSION-1A — `dema poi compression` CLI.
//
// Composition happens in the pure kernel (packages/core/src/poi-time-compression.js).
// Every field is operator-declared via flags — nothing is inferred, timed, or
// scanned. The ONLY write path is the candidate receipt under
// $DEMA_HOME/poi/compression/receipts (exact consent phrase, mode 0600, atomic,
// file content is the byte-exact payload — the timestamp lives in the filename,
// never injected into the hashed body). No network, no model call, no mint, no URP.

import { mkdir, readdir, readFile, rename, realpath, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  runPoiTimeCompression,
  verifyPoiTimeCompression,
  POI_TIME_COMPRESSION_GO_PHRASE,
  POI_TIME_COMPRESSION_TRUTH_LABEL,
  POI_TIME_COMPRESSION_BASELINE_SOURCES,
} from "../../../../packages/core/src/poi-time-compression.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function numberOrRaw(value) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function booleanOrRaw(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value; // kernel fails closed on anything non-boolean
}

function csvList(value) {
  if (value === undefined) return undefined;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function receiptsDir() {
  const home = process.env.DEMA_HOME || join(homedir(), ".dema");
  return join(home, "poi", "compression", "receipts");
}

async function writeCandidateReceipt(payload) {
  const dir = receiptsDir();
  await mkdir(dir, { recursive: true });
  const realDir = await realpath(dir);
  const day = new Date().toISOString().slice(0, 10);
  const hash8 = payload.content_hash.replace("sha256:", "").slice(0, 8);
  const finalPath = join(realDir, `poi-compression-${day}-${hash8}.json`);
  const tmpPath = `${finalPath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(payload, null, 2), {
    encoding: "utf8",
    mode: 0o600,
    flag: "w",
  });
  await rename(tmpPath, finalPath);
  return finalPath;
}

async function readCandidateReceipts() {
  let names = [];
  try {
    names = (await readdir(receiptsDir())).filter(
      (n) => n.startsWith("poi-compression-") && n.endsWith(".json"),
    );
  } catch {
    return [];
  }
  const receipts = [];
  for (const name of names.sort()) {
    try {
      receipts.push({ name, payload: JSON.parse(await readFile(join(receiptsDir(), name), "utf8")) });
    } catch {
      receipts.push({ name, payload: null });
    }
  }
  return receipts;
}

function renderCard(payload, receiptPath) {
  const gates = payload.quality_gates;
  return [
    `DEMA · POI TIME COMPRESSION — ${POI_TIME_COMPRESSION_TRUTH_LABEL}`,
    `  task      ${payload.task.id}${payload.task.name ? ` · ${payload.task.name}` : ""}`,
    `  baseline  ${payload.baseline.duration_hours}h · ${payload.baseline.source} · ${payload.baseline.reference_class} (${payload.baseline.status})`,
    `  actual    ${payload.actual.duration_hours}h · ${payload.actual.operating_mode} (${payload.actual.status})`,
    `  gates     ${gates.passed.length}/${gates.required.length} required passed — a failed gate refuses the receipt`,
    `  ratio     ${payload.compression.ratio}x — ${payload.compression.claim_status}`,
    `  clocks    proof-time ${payload.clocks.proof_time_hours}h · life proof ${payload.clocks.life_proof_status}`,
    `  no_mint   ${payload.no_mint}`,
    "",
    `  receipt   ${receiptPath ?? `not written (requires --receipt --consent "${POI_TIME_COMPRESSION_GO_PHRASE}")`}`,
    "  boundary  declared inputs only · candidate not verified impact · no mint · no URP · no network",
  ].join("\n");
}

async function cmd_compression_record(argv) {
  const wantJson = argv.includes("--json");
  const wantReceipt = argv.includes("--receipt");
  const input = {
    task_id: argValue(argv, "--task"),
    task_name: argValue(argv, "--task-name"),
    baseline: {
      duration_hours: numberOrRaw(argValue(argv, "--baseline-hours")),
      source: argValue(argv, "--baseline-source"),
      reference_class: argValue(argv, "--reference-class"),
    },
    actual: {
      duration_hours: numberOrRaw(argValue(argv, "--actual-hours")),
      operating_mode: argValue(argv, "--operating-mode"),
    },
    quality_gates: {
      required: csvList(argValue(argv, "--gates-required")),
      passed: csvList(argValue(argv, "--gates-passed")),
    },
    observation_required: booleanOrRaw(argValue(argv, "--observation-required")),
  };

  const result = runPoiTimeCompression({ consent: POI_TIME_COMPRESSION_GO_PHRASE, input });
  if (!result.ok) {
    if (wantJson) {
      console.log(JSON.stringify({ ok: false, blocked_by: result.blocked_by }, null, 2));
    } else {
      console.error(`Dema error: time-compression record blocked: ${result.blocked_by.join(", ")}`);
      console.error(
        `  (baseline sources: ${POI_TIME_COMPRESSION_BASELINE_SOURCES.join(" | ")}; a failed required gate refuses the receipt)`,
      );
    }
    process.exitCode = 1;
    return;
  }

  let receiptPath = null;
  if (wantReceipt) {
    const consent = argValue(argv, "--consent");
    if (consent !== POI_TIME_COMPRESSION_GO_PHRASE) {
      console.error(
        `Dema error: receipt write requires the exact consent phrase --consent "${POI_TIME_COMPRESSION_GO_PHRASE}"`,
      );
      process.exitCode = 1;
      return;
    }
    receiptPath = await writeCandidateReceipt(result.payload);
  }

  if (wantJson) {
    console.log(JSON.stringify({ ...result.payload, receipt_path: receiptPath }, null, 2));
    return;
  }
  console.log(renderCard(result.payload, receiptPath));
}

async function cmd_compression_show(argv) {
  const wantJson = argv.includes("--json");
  const receipts = await readCandidateReceipts();
  if (wantJson) {
    console.log(JSON.stringify({ truth_label: POI_TIME_COMPRESSION_TRUTH_LABEL, receipts }, null, 2));
    return;
  }
  console.log(`DEMA · POI TIME COMPRESSION RECEIPTS — ${POI_TIME_COMPRESSION_TRUTH_LABEL}`);
  if (!receipts.length) {
    console.log("  (none recorded)");
    return;
  }
  for (const { name, payload } of receipts) {
    if (!payload) {
      console.log(`  ${name} — UNREADABLE`);
      continue;
    }
    console.log(
      `  ${name} — ${payload.task?.id} · ${payload.compression?.ratio}x · gates ${payload.quality_gates?.passed?.length}/${payload.quality_gates?.required?.length} · ${payload.clocks?.life_proof_status}`,
    );
  }
}

async function cmd_compression_verify(argv) {
  const wantJson = argv.includes("--json");
  const receipts = await readCandidateReceipts();
  const results = receipts.map(({ name, payload }) => {
    const verdict = payload ? verifyPoiTimeCompression(payload) : { ok: false, blocked_by: ["unreadable_receipt"] };
    return { name, ok: verdict.ok, blocked_by: verdict.blocked_by };
  });
  const allOk = results.length > 0 && results.every((r) => r.ok);
  if (wantJson) {
    console.log(
      JSON.stringify(
        { truth_label: POI_TIME_COMPRESSION_TRUTH_LABEL, ok: allOk, receipt_count: results.length, results },
        null,
        2,
      ),
    );
  } else {
    console.log(`DEMA · POI TIME COMPRESSION VERIFY — ${POI_TIME_COMPRESSION_TRUTH_LABEL}`);
    if (!results.length) console.log("  (no receipts to verify)");
    for (const r of results) {
      console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : ` — ${r.blocked_by.join(", ")}`}`);
    }
  }
  if (!allOk) process.exitCode = 1;
}

export async function cmd_poi(ctx) {
  const { argv } = ctx;
  if (argv[1] !== "compression") {
    console.error(
      'Dema error: unknown poi subcommand. Use `dema poi compression record|show|verify` (see `dema help`).',
    );
    process.exitCode = 1;
    return;
  }
  const sub = argv[2];
  if (sub === "record") return cmd_compression_record(argv);
  if (sub === "show") return cmd_compression_show(argv);
  if (sub === "verify") return cmd_compression_verify(argv);
  console.error('Dema error: use `dema poi compression record|show|verify`.');
  process.exitCode = 1;
}
