import { createHash } from "node:crypto";
import { createReadStream, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { scanLibrary } from "../../../../packages/core/src/node0-library-scan.js";
import {
  sizeCandidates,
  confirmDuplicateSets,
  planQuarantine,
} from "../../../../packages/core/src/node0-library-dedupe.js";
import { isWithinRoot } from "../../../../packages/core/src/first-encounter-admission.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

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
      `  ${String(v.files).padStart(8)}  ${gb(v.bytes).padStart(10)}  ${escapeHtml(name)}${v.class === "node_space" ? "  ·node-space" : ""}`,
    );
  }
  lines.push("", "WHAT THIS DOES NOT PROVE");
  for (const d of c.does_not_prove) lines.push(`  · ${d}`);
  return lines.join("\n");
}

/**
 * Hashes ONLY the same-size candidates the kernel selected. On the real corpus
 * that is a few percent of 756,000 files — the difference between minutes and
 * most of a day.
 */
async function planDedupe({ census, roots, quarantine }) {
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
      if (done % 5000 === 0) process.stderr.write(`  …hashed ${done.toLocaleString()}\n`);
    }
  }

  const sets = confirmDuplicateSets(candidates.groups, hashes);
  const plan = planQuarantine(sets, { root_priority: roots.map((r) => resolve(r)), quarantine_root: quarantine });
  return { ...plan, candidates: { ...candidates, groups: undefined } };
}

function renderDedupe(p) {
  const lines = [
    "مكتبة نود0 · DEDUPE PLAN",
    `action            ${p.action} — deletes nothing`,
    `candidates hashed ${p.candidates.files_to_hash.toLocaleString()} of ${p.candidates.files_total.toLocaleString()}`,
    `duplicate sets    ${p.duplicate_sets.toLocaleString()}`,
    `copies to move    ${p.atoms.length.toLocaleString()}`,
    `reclaimable       ${gb(p.reclaimable_bytes)}`,
    "",
    "Run it through the steward, which backs up and writes undo receipts:",
    "  dema steward plan --job <plan.steward_job written to a file>",
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
      schema: "bizra.dema.library_cli.v0.1",
      subcommands: {
        census: "dema library census --root <abs dir> [--root <dir>…] [--out <file.json>] [--json]",
        dedupe:
          "dema library dedupe --root <abs dir> [--root <dir>…] --quarantine <abs dir> [--out <plan.json>] [--json]",
      },
      dedupe_note:
        "dedupe PLANS only. It hashes same-size candidates, confirms byte-identity, and emits a steward job that MOVES extra copies to quarantine. It never deletes and never runs itself.",
      boundary: "read-only · no content read · no symlink followed · no mutation · no network",
    };
    console.log(JSON.stringify(help, null, 2));
    return sub === undefined ? 0 : 1;
  }

  const roots = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--root" && argv[i + 1]) roots.push(argv[i + 1]);
  }
  if (roots.length === 0) {
    console.error("dema library census: at least one --root <abs dir> is required.");
    return 1;
  }

  // The stamp is taken here, once, and travels with the result.
  const measuredAt = new Date().toISOString();
  const census = scanLibrary(roots, measuredAt, {
    onProgress: (n) => process.stderr.write(`  …${n.toLocaleString()} files\n`),
  });

  if (sub === "dedupe") {
    const quarantine = argValue(argv, "--quarantine");
    if (!quarantine || !quarantine.startsWith("/")) {
      console.error("dema library dedupe: --quarantine <abs dir> is required (must be outside every --root).");
      return 1;
    }
    const qAbs = resolve(quarantine);
    const rootAbs = roots.map((r) => resolve(r));
    // Enforce the documented invariant before any hashing: quarantine must sit
    // outside every scanned root (segment-aware — `/demo/corpus-secret` is OK
    // next to `/demo/corpus`).
    for (const r of rootAbs) {
      if (isWithinRoot(r, qAbs)) {
        console.error(
          `dema library dedupe: --quarantine must be outside every --root (refused: ${qAbs} is inside ${r}).`,
        );
        return 1;
      }
    }
    const plan = await planDedupe({ census, roots: rootAbs, quarantine: qAbs });
    const out = argValue(argv, "--out");
    if (out) {
      writeFileSync(out, JSON.stringify(plan, null, 2));
      process.stderr.write(`wrote ${out}\n`);
    }
    console.log(wantJson ? JSON.stringify(plan, null, 2) : renderDedupe(plan));
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
