#!/usr/bin/env node
/**
 * NODE0-HISTORY-REPLAY-1A producer — settle `full_history_replayable` by
 * re-walking a recorded season history from genesis and proving its tail is
 * exactly HEAD.
 *
 * The other five "running loop" invariants were settled by producers that ran a
 * loop and disclosed an artefact. This producer does not need to run a new loop,
 * because the loop already ran: the season store it replays was written by a
 * producer that killed a real worker. What it must do — and what no read-only
 * gate could do for it — is READ that history off disk and re-derive it.
 *
 * It reads. It writes exactly one artefact. It starts nothing, kills nothing,
 * opens no socket, and never touches key material.
 *
 *   node scripts/proof/node0-history-replay-proof.mjs [--dema-home <path>]
 *                                                     [--season-id <id>] [--json]
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  renameSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import {
  replaySeasonHistory,
  aggregateReplayVerdicts,
  buildHistoryReplayObservation,
} from "../../packages/core/src/node0-history-replay.js";

const argv = process.argv.slice(2);
const arg = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
const wantJson = argv.includes("--json");

const demaHome = arg("--dema-home") || process.env.DEMA_HOME || join(homedir(), ".dema");
const seasonsDir = join(demaHome, "seasons");

const KERNEL_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "packages",
  "core",
  "src",
  "node0-history-replay.js",
);

const die = (msg, code = 2) => {
  console.error(msg);
  process.exit(code);
};

if (!existsSync(seasonsDir)) {
  die(`No season store at ${seasonsDir}. Nothing to replay — that is INCOMPLETE, not a failure.`);
}

const only = arg("--season-id");
const seasonIds = readdirSync(seasonsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((n) => existsSync(join(seasonsDir, n, "HEAD.json")))
  .filter((n) => (only ? n === only : true))
  .sort();

if (seasonIds.length === 0) {
  die(only ? `No season named ${only} under ${seasonsDir}.` : `No season with a HEAD.json under ${seasonsDir}.`);
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

/// Key the bodies by the hash they CARRY, never by their filename. A file
/// renamed to match a different hash must not be able to answer for it.
function loadByCarriedHash(dir, field) {
  const map = {};
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const body = readJson(join(dir, f));
      const h = body?.[field];
      if (typeof h === "string" && h.length > 0) map[h] = body;
    } catch {
      /* an unreadable body is simply absent; replay will report INCOMPLETE */
    }
  }
  return map;
}

function gather(seasonId) {
  const seasonDir = join(seasonsDir, seasonId);
  const seqDir = join(seasonDir, "seq");
  const seq = existsSync(seqDir)
    ? readdirSync(seqDir).filter((f) => f.endsWith(".json")).sort().map((f) => readJson(join(seqDir, f)))
    : [];
  return {
    seq,
    states: loadByCarriedHash(join(seasonDir, "states"), "state_hash"),
    receipts: loadByCarriedHash(join(seasonDir, "receipts"), "receipt_hash"),
    head: existsSync(join(seasonDir, "HEAD.json")) ? readJson(join(seasonDir, "HEAD.json")) : null,
  };
}

const perSeason = [];
for (const id of seasonIds) {
  let r;
  try {
    r = replaySeasonHistory(gather(id));
  } catch (error) {
    r = { verdict: "INCOMPLETE", reason: `gather_failed: ${error.message}`, steps_replayed: 0 };
  }
  perSeason.push({ ...r, season_id: id });
}

// EVERY season must reconstruct. One that does not answers for the node.
const facts = aggregateReplayVerdicts(perSeason);

const executedCodeHash = `sha256:${createHash("sha256")
  .update(readFileSync(KERNEL_PATH))
  .digest("hex")}`;

const observation = buildHistoryReplayObservation({
  facts,
  // The producer genuinely read a recorded history off disk and re-derived it.
  evidenceClass: "OBSERVED",
  observedAt: new Date().toISOString(),
  executedCodeHash,
  hash: sha256CanonicalJsonV1,
});

const outPath = join(demaHome, "node0", "history-replay", "observation.json");
try {
  mkdirSync(dirname(outPath), { recursive: true });
  const tmp = `${outPath}.tmp.${process.pid}.${randomBytes(6).toString("hex")}`;
  writeFileSync(tmp, `${JSON.stringify(observation, null, 2)}\n`);
  renameSync(tmp, outPath);
} catch (error) {
  die(`Could not write ${outPath}: ${error.message}`);
}

if (wantJson) {
  console.log(JSON.stringify({ artefact_path: outPath, observation }, null, 2));
} else {
  console.log(`seasons replayed:  ${facts.seasons.length}`);
  for (const s of facts.seasons) {
    console.log(`  ${s.verdict.padEnd(20)} ${s.season_id}  (${s.steps_replayed} steps)${s.reason ? ` — ${s.reason}` : ""}`);
  }
  console.log("");
  console.log(`NODE verdict:      ${facts.verdict}`);
  if (facts.reason) console.log(`reason:            ${facts.reason}`);
  console.log(`artefact:          ${outPath}`);
  console.log("");
  console.log("  Read-only over a recorded history. No loop started, no process");
  console.log("  killed, no socket opened, no key material touched.");
}

// A history that does not reconstruct is a real finding, not a crash.
process.exit(facts.verdict === "RECONSTRUCTED_EXACT" ? 0 : 1);
