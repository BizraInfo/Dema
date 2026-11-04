import { createHash } from "node:crypto";
import { createReadStream, writeFileSync } from "node:fs";

import { scanLibrary } from "../../../../packages/core/src/node0-library-scan.js";
import {
  sizeCandidates,
  confirmDuplicateSets,
} from "../../../../packages/core/src/node0-library-dedupe.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

const DUPLICATE_MEASUREMENT_SCHEMA =
  "bizra.dema.node0_library_duplicate_measurement.v0.2";
const AUTHORITATIVE_SAFE_PLAN_REQUIRED =
  "NODE0_LIBRARY_AUTHORITATIVE_COMPLETION_1A_REQUIRED";

function sha256File(absPath) {
  return new Promise((res, rej) => {
    const hash = createHash("sha256");
    const stream = createReadStream(absPath, { highWaterMark: 1024 * 1024 });
    stream.on("data", (c) => hash.update(c));
    stream.on("end", () => res(hash.digest("hex")));
    stream.on("error", rej);
  });
}

/**
 * `dema library census` — مكتبة نود0, the "where do we stand" pass.
 *
 * Read-only: no content read, no symlink followed, nothing moved or deleted, no
 * network. It counts; the steward shelves. Every result carries the roots it
 * covered and the moment it was taken, because a corpus that grows daily makes
 * an undated total false within hours.
 */

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

const gb = (b) => `${(b / 1000 ** 3).toFixed(1)} GB`;

function renderSummary(c) {
  const lines = [
    "مكتبة نود0 · NODE0 LIBRARY CENSUS",
    `measured_at  ${c.provenance.measured_at}`,
    `roots        ${c.provenance.roots.join(", ")}`,
    "",
    `files        ${c.totals.files.toLocaleString()}`,
    `total        ${gb(c.totals.bytes)}`,
    `  library    ${gb(c.totals.library_bytes)}`,
    `  node space ${gb(c.totals.node_space_bytes)}   (VMs, model weights, OS images — not your work)`,
    `  unshelved  ${gb(c.totals.unshelved_bytes)}   (taxonomy does not cover these)`,
    "",
    "SHELVES",
  ];
  const rows = Object.entries(c.shelves)
    .filter(([, v]) => v.files > 0)
    .sort((a, b) => b[1].bytes - a[1].bytes);
  for (const [name, v] of rows) {
    lines.push(
      `  ${String(v.files).padStart(8)}  ${gb(v.bytes).padStart(10)}  ${name}${v.class === "node_space" ? "  ·node-space" : ""}`,
    );
  }
  lines.push("", "WHAT THIS DOES NOT PROVE");
  for (const d of c.does_not_prove) lines.push(`  · ${d}`);
  return lines.join("\n");
}

/**
 * Hash ONLY the same-size candidates selected by the legacy measurement kernel.
 * The result is deliberately NOT an action plan. The old CLI handed absolute,
 * cross-root paths to a basename-only reversible steward and could not execute
 * the advertised transition. Eligibility, keeper selection, freshness and
 * protected-zone checks belong to the authoritative safe-plan pipeline.
 */
async function measureDuplicates({ census }) {
  const candidates = sizeCandidates(census.records ?? []);
  process.stderr.write(
    `  candidates: ${candidates.files_to_hash.toLocaleString()} of ${candidates.files_total.toLocaleString()} files ` +
      `(${candidates.hash_avoided.toLocaleString()} never hashed)\n`,
  );

  const hashes = {};
  let done = 0;
  for (const group of candidates.groups) {
    for (const p of group.paths) {
      try {
        hashes[p] = await sha256File(p);
      } catch {
        // unreadable → no hash → dropped from its set by the kernel
      }
      done += 1;
      if (done % 5000 === 0) {
        process.stderr.write(`  …hashed ${done.toLocaleString()}\n`);
      }
    }
  }

  const sets = confirmDuplicateSets(candidates.groups, hashes);
  const duplicateCopies = sets.reduce(
    (total, set) => total + Math.max(0, (set.paths?.length ?? 0) - 1),
    0,
  );
  const duplicateBytesIdentified = sets.reduce(
    (total, set) => total + (set.reclaimable_bytes ?? 0),
    0,
  );

  return Object.freeze({
    schema: DUPLICATE_MEASUREMENT_SCHEMA,
    truth_label: "LOCAL_DUPLICATE_MEASUREMENT_NOT_ACTION_PLAN",
    status: "BLOCKED_PENDING_AUTHORITATIVE_SAFE_PLAN",
    mutation_performed: false,
    candidates: Object.freeze({
      files_total: candidates.files_total,
      files_to_hash: candidates.files_to_hash,
      hash_avoided: candidates.hash_avoided,
    }),
    duplicate_sets: sets.length,
    duplicate_copies: duplicateCopies,
    duplicate_bytes_identified: duplicateBytesIdentified,
    next_authority_surface: AUTHORITATIVE_SAFE_PLAN_REQUIRED,
    blockers: Object.freeze([
      "legacy quarantine eligibility is not authoritative",
      "legacy cross-root steward handoff is incompatible with basename-only reversible effects",
      "protected-zone, keeper, freshness, readability and precondition adjudication must run before mutation",
    ]),
    boundary: Object.freeze({
      content_read_for_hashing: true,
      filesystem_mutation: false,
      source_path_removed: false,
      executable_job_emitted: false,
      network_used: false,
    }),
    does_not_prove: Object.freeze([
      "that any byte-identical copy is unnecessary",
      "that a keeper is authoritative or original",
      "that a copy is eligible for relocation",
      "that quarantine would reclaim disk space",
      "that any filesystem mutation is authorized",
    ]),
  });
}

function renderDedupe(p) {
  const lines = [
    "مكتبة نود0 · DUPLICATE MEASUREMENT",
    `status            ${p.status}`,
    `candidates hashed ${p.candidates.files_to_hash.toLocaleString()} of ${p.candidates.files_total.toLocaleString()}`,
    `duplicate sets    ${p.duplicate_sets.toLocaleString()}`,
    `extra copies      ${p.duplicate_copies.toLocaleString()}`,
    `bytes identified  ${gb(p.duplicate_bytes_identified)}`,
    "",
    "SEALED DOOR",
    `  ${p.next_authority_surface}`,
    "  No executable file-move job is emitted by this command.",
    "",
    "WHAT THIS DOES NOT PROVE",
    ...p.does_not_prove.map((d) => `  · ${d}`),
  ];
  return lines.join("\n");
}

export async function cmd_library(ctx) {
  // Commands receive the full argv including the command name; the subcommand is argv[1].
  const { argv } = ctx;
  const sub = argv[1];
  const wantJson = wantsJson(argv);

  if (sub !== "census" && sub !== "dedupe") {
    const help = {
      schema: "bizra.dema.library_cli.v0.2",
      subcommands: {
        census:
          "dema library census --root <abs dir> [--root <dir>…] [--out <file.json>] [--json]",
        dedupe:
          "dema library dedupe --root <abs dir> [--root <dir>…] [--out <measurement.json>] [--json]",
      },
      dedupe_note:
        "dedupe measures full-hash byte identity only. It emits no executable move job. Protected-zone review, keeper resolution and fresh preconditions are required before any mutation.",
      boundary:
        "census: metadata-only; dedupe: read-only SHA-256 confirmation; no mutation · no network",
    };
    console.log(JSON.stringify(help, null, 2));
    return sub === undefined ? 0 : 1;
  }

  const roots = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root" && argv[i + 1]) roots.push(argv[i + 1]);
  }
  if (roots.length === 0) {
    console.error(
      `dema library ${sub}: at least one --root <abs dir> is required.`,
    );
    return 1;
  }

  // The stamp is taken here, once, and travels with the result.
  const measuredAt = new Date().toISOString();
  const census = scanLibrary(roots, measuredAt, {
    onProgress: (n) =>
      process.stderr.write(`  …${n.toLocaleString()} files\n`),
  });

  if (sub === "dedupe") {
    const measurement = await measureDuplicates({ census });
    const out = argValue(argv, "--out");
    if (out) {
      writeFileSync(out, JSON.stringify(measurement, null, 2));
      process.stderr.write(`wrote ${out}\n`);
    }
    console.log(
      wantJson ? JSON.stringify(measurement, null, 2) : renderDedupe(measurement),
    );
    return 0;
  }

  const out = argValue(argv, "--out");
  if (out) {
    writeFileSync(out, JSON.stringify(census, null, 2));
    process.stderr.write(`wrote ${out}\n`);
  }
  console.log(wantJson ? JSON.stringify(census, null, 2) : renderSummary(census));
  return 0;
}
