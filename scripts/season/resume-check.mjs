#!/usr/bin/env node
// Season handoff resume preflight (operator tooling over proven kernels).
//
// Re-verifies, from bytes alone:
//   1. the sealed PRE0 reality reconciliation receipt  (pin f5078a9e…)
//   2. the PROD01 2B rebind receipt                    (pin 27c07d9d…)
//      including the hash chain 2B → PRE0,
//   3. that every configured worktree is clean,
//   4. that the gateway loopback port is free.
//
// Digest scheme (verified against the committed artifacts):
//   body_digest  = sha256(canonicalJson(envelope.body))
//   receipt_hash = sha256(canonicalJson(envelope minus receipt_hash))
//   canonicalJson = recursively key-sorted compact JSON.
//
// Verdict is fail-closed: any failed check yields NOT_READY_FOR_HUMAN_GO and
// exit 1. This preflight grants nothing — it reports environment readiness
// only; authority still enters exclusively through the exact H1 consent block.
//
// Overrides (flags win over env): --audits-dir, --worktrees (colon-separated),
// --port, --dema-home | DEMA_SEASON_AUDITS_DIR, DEMA_SEASON_WORKTREES,
// DEMA_SEASON_PORT, DEMA_HOME.

import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PREFLIGHT_SCHEMA = "bizra.dema.season_handoff_preflight.v0.1";

export const PRE0_AUDIT_FILE = "PRE0_REALITY_RECONCILIATION_1A.json";
export const TWOB_AUDIT_FILE = "PROD01_2B_REBIND_1A.json";

export const PRE0_BODY_DIGEST_PIN =
  "f5078a9eef984f14acbace3fec91d2d6597bf25d7f9de04c8a40ac96b42c6b7c";
export const PROD01_2B_RECEIPT_HASH_PIN =
  "27c07d9d456d2ec29045e2fcd370156ad378ea526e259516f4e5431385ae5f18";

export const DEFAULT_PORT = 7421;

const REPO_ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), "..", ".."));

const HASH_RE = /^(?:sha256:)?([0-9a-f]{64})$/;

export function sha256Hex(s) {
  return createHash("sha256").update(s).digest("hex");
}

export function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortDeep(value[k]);
    return out;
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(sortDeep(value));
}

/** Recompute { body_digest, receipt_hash } for a bizra.genesis.receipt_envelope.v1. */
export function digestEnvelope(envelope) {
  return {
    body_digest: sha256Hex(canonicalJson(envelope.body)),
    receipt_hash: sha256Hex(canonicalJson({ ...envelope, receipt_hash: undefined })),
  };
}

function check(name, pass, detail = null) {
  return { name, pass, ...(detail === null ? {} : { detail }) };
}

/**
 * Verify both sealed genesis-phase receipts against their own recorded
 * digests, the pinned values, and each other (hash chain 2B → PRE0).
 * Content judgment (A1–A6, verdicts) belongs to the qualification package
 * verifier; this answers only "are these the same sealed bytes".
 */
export async function verifyGenesisReceipts({ auditsDir } = {}) {
  const dir = auditsDir ?? join(REPO_ROOT, "docs", "audits");
  const checks = [];

  const loadEnvelope = async (file) => {
    try {
      const raw = await readFile(join(dir, file), "utf8");
      return JSON.parse(raw);
    } catch (err) {
      return { _error: err?.code ?? "unparseable" };
    }
  };

  const pre0 = await loadEnvelope(PRE0_AUDIT_FILE);
  const twob = await loadEnvelope(TWOB_AUDIT_FILE);

  if (pre0._error) checks.push(check("pre0_audit_readable", false, `${PRE0_AUDIT_FILE}:${pre0._error}`));
  if (twob._error) checks.push(check("prod01_2b_audit_readable", false, `${TWOB_AUDIT_FILE}:${twob._error}`));
  if (pre0._error || twob._error) return { ok: false, checks, pre0: null, twob: null };

  const pre0Digest = digestEnvelope(pre0);
  const twobDigest = digestEnvelope(twob);

  checks.push(
    check(
      "pre0_body_digest_matches_pin",
      pre0.body_digest === PRE0_BODY_DIGEST_PIN && pre0Digest.body_digest === pre0.body_digest,
      pre0Digest.body_digest,
    ),
    check(
      "pre0_receipt_rederived",
      pre0Digest.receipt_hash === pre0.receipt_hash,
      pre0Digest.receipt_hash,
    ),
    check(
      "prod01_2b_receipt_matches_pin",
      twob.receipt_hash === PROD01_2B_RECEIPT_HASH_PIN && twobDigest.receipt_hash === twob.receipt_hash,
      twobDigest.receipt_hash,
    ),
    check(
      "prod01_2b_body_digest_rederived",
      twobDigest.body_digest === twob.body_digest,
      twobDigest.body_digest,
    ),
    check(
      "chain_2b_predecessor_is_pre0",
      twob.body?.previous_receipt_hash === pre0.receipt_hash &&
        twob.previous_receipt_hash === pre0.receipt_hash,
      twob.body?.previous_receipt_hash ?? null,
    ),
    check(
      "chain_2b_binds_pre0_body_digest",
      twob.body?.bindings?.pre0_body_digest === pre0.body_digest,
      twob.body?.bindings?.pre0_body_digest ?? null,
    ),
  );

  return { ok: checks.every((c) => c.pass), checks, pre0, twob };
}

/** Measure cleanliness of each worktree independently via git. */
export function checkWorktrees(paths) {
  return paths.map((wt) => {
    const inside = spawnSync("git", ["-C", wt, "rev-parse", "--is-inside-work-tree"], {
      encoding: "utf8",
    });
    if (inside.status !== 0 || inside.stdout?.trim() !== "true") {
      return { path: wt, clean: false, dirty_count: null, reason: "not_a_git_worktree" };
    }
    const status = spawnSync("git", ["-C", wt, "status", "--porcelain"], { encoding: "utf8" });
    if (status.status !== 0) {
      return { path: wt, clean: false, dirty_count: null, reason: `git_status_failed:${status.status}` };
    }
    const lines = (status.stdout ?? "").split("\n").filter((l) => l.length > 0);
    return {
      path: wt,
      clean: lines.length === 0,
      dirty_count: lines.length,
      ...(lines.length > 0 ? { reason: "dirty_worktree" } : {}),
    };
  });
}

/** Probe loopback availability by actually binding — the OS is the witness. */
export function checkPortFree(port, host = "127.0.0.1") {
  return new Promise((res) => {
    const srv = createServer();
    srv.once("error", (err) => res({ port, host, free: false, reason: err?.code ?? "listen_error" }));
    srv.once("listening", () => srv.close(() => res({ port, host, free: true, reason: null })));
    srv.listen(port, host);
  });
}

function resolveDemaHome(demaHome) {
  if (typeof demaHome === "string" && demaHome.length > 0) return demaHome;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

/**
 * Locate saved handoff objects matching --from under DEMA_HOME.
 * Informational only: a fresh machine legitimately holds none yet.
 */
export async function findHandoffObjects({ demaHome, hash }) {
  const bare = (hash.match(HASH_RE)?.[1]) ?? hash;
  const fileName = `sha256-${bare}.json`;
  const seasonsDir = join(resolveDemaHome(demaHome), "seasons");
  const found = [];
  let seasonIds = [];
  try {
    seasonIds = (await readdir(seasonsDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return found;
  }
  for (const id of seasonIds) {
    for (const kind of ["states", "receipts"]) {
      const p = join(seasonsDir, id, kind, fileName);
      try {
        await readFile(p, "utf8");
        found.push({ season_id: id, kind, path: p });
      } catch {
        /* absent in this season — expected */
      }
    }
  }
  return found;
}

export async function runPreflight({
  from,
  auditsDir,
  worktrees,
  port = DEFAULT_PORT,
  demaHome,
} = {}) {
  const blockedBy = [];

  const genesis = await verifyGenesisReceipts({ auditsDir });
  for (const c of genesis.checks) if (!c.pass) blockedBy.push(c.name);

  const wtResults = checkWorktrees(worktrees);
  for (const w of wtResults) {
    if (!w.clean) blockedBy.push(w.reason === "dirty_worktree" ? `worktree_dirty:${w.path}` : `${w.reason}:${w.path}`);
  }

  const portNum = Number(port);
  let portResult;
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    portResult = { port, host: "127.0.0.1", free: false, reason: "invalid_port" };
    blockedBy.push(`port_invalid:${port}`);
  } else {
    portResult = await checkPortFree(portNum);
    if (!portResult.free) blockedBy.push(`port_${portResult.reason}:${portResult.port}`);
  }

  const handoffObjects = await findHandoffObjects({ demaHome, hash: from });

  return {
    ready: blockedBy.length === 0,
    outcome: blockedBy.length === 0 ? "READY_FOR_HUMAN_GO" : "NOT_READY_FOR_HUMAN_GO",
    blocked_by: blockedBy,
    from,
    pins: { pre0_body_digest: PRE0_BODY_DIGEST_PIN, prod01_2b_receipt_hash: PROD01_2B_RECEIPT_HASH_PIN },
    genesis_checks: genesis.checks,
    worktrees: wtResults,
    port: portResult,
    handoff_objects: handoffObjects,
    dema_home: resolveDemaHome(demaHome),
  };
}

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(argv) {
  const json = argv.includes("--json");
  const emitErr = (msg) => {
    const r = { ok: false, outcome: "REFUSED", reason: msg };
    if (json) console.log(JSON.stringify(r, null, 2));
    else console.error(`resume preflight refused: ${msg}`);
    return 1;
  };

  const from = argValue(argv, "--from");
  if (!from) return emitErr("--from <handoff-receipt-hash> is required");
  if (!HASH_RE.test(from)) return emitErr("from_malformed: expected 64 hex chars, optionally sha256:-prefixed");

  const auditsDir = argValue(argv, "--audits-dir") ?? process.env.DEMA_SEASON_AUDITS_DIR ?? undefined;
  const worktreesArg = argValue(argv, "--worktrees") ?? process.env.DEMA_SEASON_WORKTREES;
  const worktrees = (worktreesArg ? worktreesArg.split(":").map((s) => s.trim()).filter(Boolean) : [REPO_ROOT])
    .map((p) => resolve(p));
  const port = Number(argValue(argv, "--port") ?? process.env.DEMA_SEASON_PORT ?? DEFAULT_PORT);
  const demaHome = argValue(argv, "--dema-home");

  const report = await runPreflight({ from, auditsDir, worktrees, port, demaHome });

  if (json) {
    console.log(JSON.stringify({ schema: PREFLIGHT_SCHEMA, ok: report.ready, ...report }, null, 2));
  } else {
    console.log("Season handoff resume preflight");
    console.log(`  from:              ${report.from}`);
    for (const c of report.genesis_checks) {
      console.log(`  ${c.name.padEnd(34)} ${c.pass ? "OK" : `FAIL (${c.detail ?? ""})`}`);
    }
    for (const w of report.worktrees) {
      console.log(`  worktree ${w.path.padEnd(40)} ${w.clean ? "CLEAN" : `NOT CLEAN (${w.reason}${w.dirty_count != null ? `, ${w.dirty_count}` : ""})`}`);
    }
    console.log(`  port ${report.port.port} (loopback)      ${report.port.free ? "FREE" : `NOT FREE (${report.port.reason})`}`);
    console.log(
      report.handoff_objects.length > 0
        ? `  handoff objects:   found under ${report.dema_home} (${report.handoff_objects.map((o) => `${o.season_id}/${o.kind}`).join(", ")})`
        : `  handoff objects:   none under ${report.dema_home} yet (normal on a fresh machine — informational)`,
    );
    console.log("");
    if (report.ready) {
      console.log("READY_FOR_HUMAN_GO — awaiting exact H1 block");
    } else {
      console.log("NOT_READY_FOR_HUMAN_GO — blocked_by:");
      for (const b of report.blocked_by) console.log(`  - ${b}`);
    }
  }

  return report.ready ? 0 : 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`resume preflight crashed: ${err?.stack ?? err}`);
      process.exit(1);
    },
  );
}
