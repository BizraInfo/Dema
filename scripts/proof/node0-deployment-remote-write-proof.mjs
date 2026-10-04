#!/usr/bin/env node
/**
 * NODE0-DEPLOYMENT-REMOTE-WRITE-1A producer — measure this machine's own exposure
 * surface and record whether any external party can silently write into local
 * sovereign state.
 *
 * MUST RUN ON THE HOST. Inside a PID- or network-namespaced sandbox the machine
 * looks almost empty — a handful of PIDs, a couple of proxy listeners — and a
 * clean report from there would be a false GREEN on the one row that governs
 * external writes. The kernel refuses such a surface, and this producer declares
 * the condition rather than hiding it.
 *
 * It reads. It writes exactly one artefact. No socket is opened, no runtime is
 * started, no key material is touched, and nothing on the machine is modified.
 *
 *   node scripts/proof/node0-deployment-remote-write-proof.mjs [--dema-home <p>] [--json]
 */

import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import {
  evaluateDeploymentSurface,
  deploymentSurfaceFacetCounts,
  buildDeploymentRemoteWriteObservation,
  REQUIRED_FACETS,
  ROOT_FILE_NAMES,
  SYNC_FSTYPE_RE,
} from "../../packages/core/src/node0-deployment-remote-write.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const COLLECTOR_PATH = fileURLToPath(import.meta.url);
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const wantJson = argv.includes("--json");
const demaHome = arg("--dema-home") || process.env.DEMA_HOME || join(homedir(), ".dema");

const KERNEL_PATH = join(REPO, "packages", "core", "src", "node0-deployment-remote-write.js");
const sh = (file, args) => {
  try {
    return execFileSync(file, args, { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "ignore"], shell: false });
  } catch { return null; }
};

const measured = [];

// ── listeners ────────────────────────────────────────────────────────────────
let listeners = null;
{
  const out = sh("ss", ["-tuln"]) ?? sh("netstat", ["-tuln"]);
  if (out !== null) {
    listeners = [];
    for (const line of out.split("\n").slice(1)) {
      const m = line.match(/(\S+):(\d+)\s+\S+\s*$/) || line.match(/(\S+):(\d+)/);
      if (!m) continue;
      listeners.push({ address: m[1].replace(/^\*$/, "0.0.0.0"), port: Number(m[2]), proto: line.trim().split(/\s+/)[0] });
    }
    measured.push("listeners");
  }
}

// ── mounts ───────────────────────────────────────────────────────────────────
let mounts = null;
{
  const out = sh("findmnt", ["-rno", "TARGET,SOURCE,FSTYPE"]);
  if (out !== null) {
    mounts = out.split("\n").filter(Boolean).map((l) => {
      const p = l.split(/\s+/);
      return { target: p[0], source: p[1] ?? null, fstype: p[2] ?? null };
    });
    measured.push("mounts");
  }
}

// ── writable state roots ─────────────────────────────────────────────────────
let stateRoots = null;
{
  const roots = [demaHome, "/data/bizra", REPO].filter((p) => existsSync(p));
  if (roots.length) {
    stateRoots = roots.map((p) => {
      const st = statSync(p);
      const mode = (st.mode & 0o777).toString(8).padStart(4, "0");
      return {
        path: p,
        mode,
        owner_uid: st.uid,
        group_writable: Boolean(st.mode & 0o020),
        other_writable: Boolean(st.mode & 0o002),
      };
    });
    measured.push("state_roots");
  }
}

// ── process authority ────────────────────────────────────────────────────────
let processAuthority = null;
{
  let visible = 0;
  try { visible = readdirSync("/proc").filter((n) => /^\d+$/.test(n)).length; } catch { visible = 0; }
  // Two independent signals that this observer cannot see the machine: an
  // implausibly small process table, and a pid namespace that differs from PID 1's.
  let nsDiffers = false;
  try {
    const self = readFileSync("/proc/self/ns/pid", "utf8");
    const one = readFileSync("/proc/1/ns/pid", "utf8");
    nsDiffers = self !== one;
  } catch {
    try {
      const a = statSync("/proc/self/ns/pid").ino;
      const b = statSync("/proc/1/ns/pid").ino;
      nsDiffers = a !== b;
    } catch { nsDiffers = false; }
  }
  const isolated = visible < 50 || nsDiffers;
  processAuthority = { visible_pids: visible, namespace_isolated: isolated };
  measured.push("process_authority");
}

// ── root files, against the Bitcoin-anchored manifest ────────────────────────
let rootFiles = null;
{
  const manifestPath = join(REPO, "proof-of-priority", "manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const expected = new Map((manifest.files ?? []).map((f) => [f.filename, f.file_sha256]));
    rootFiles = [];
    for (const name of ROOT_FILE_NAMES) {
      const p = join(REPO, name);
      if (!existsSync(p)) { rootFiles.push({ path: name, missing: true }); continue; }
      const st = statSync(p);
      const bytes = readFileSync(p);
      const underSync = (mounts ?? []).some(
        (m) => SYNC_FSTYPE_RE.test(String(m.fstype)) && p.startsWith(String(m.target).replace(/\/?$/, "/")),
      );
      rootFiles.push({
        path: name,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        expected_sha256: expected.get(name) ?? null,
        // writable by ANYONE, owner included — the roots must not be changeable
        // even by the operator.
        writable: Boolean(st.mode & 0o222),
        mode: (st.mode & 0o777).toString(8).padStart(4, "0"),
        under_sync_mount: underSync,
      });
    }
    measured.push("root_files");
  }
}

const surface = {
  measured_facets: measured,
  listeners, mounts, state_roots: stateRoots,
  process_authority: processAuthority, root_files: rootFiles,
};
const verdict = evaluateDeploymentSurface(surface);

const facts = {
  ...verdict,
  facet_counts: deploymentSurfaceFacetCounts(surface),
};

const observation = buildDeploymentRemoteWriteObservation({
  facts,
  surface,
  evidenceClass: "OBSERVED",
  observedAt: new Date().toISOString(),
  executedCodeHash: `sha256:${createHash("sha256").update(readFileSync(KERNEL_PATH)).digest("hex")}`,
  collectorCodeHash: `sha256:${createHash("sha256").update(readFileSync(COLLECTOR_PATH)).digest("hex")}`,
  hash: sha256CanonicalJsonV1,
});

const outPath = join(demaHome, "node0", "deployment", "observation.json");
mkdirSync(dirname(outPath), { recursive: true });
const tmp = `${outPath}.tmp.${process.pid}.${randomBytes(6).toString("hex")}`;
writeFileSync(tmp, `${JSON.stringify(observation, null, 2)}\n`);
renameSync(tmp, outPath);

if (wantJson) {
  console.log(JSON.stringify({ artefact_path: outPath, surface, observation }, null, 2));
} else {
  const p = (s = "") => console.log(s);
  p("");
  p("  NODE0 DEPLOYMENT REMOTE-WRITE OBSERVATION");
  p("  " + "=".repeat(64));
  p(`  facets measured : ${measured.length}/${REQUIRED_FACETS.length}  [${measured.join(", ")}]`);
  p(`  listeners       : ${facts.facet_counts.listeners ?? "unmeasured"}`);
  p(`  mounts          : ${facts.facet_counts.mounts ?? "unmeasured"}`);
  p(`  state roots     : ${facts.facet_counts.state_roots ?? "unmeasured"}`);
  p(`  visible pids    : ${facts.facet_counts.visible_pids ?? "unmeasured"}${processAuthority?.namespace_isolated ? "   << NAMESPACE ISOLATED" : ""}`);
  p(`  root files      : ${facts.facet_counts.root_files ?? "unmeasured"}`);
  p("");
  p(`  VERDICT         : ${verdict.verdict}`);
  if (verdict.reason) p(`  reason          : ${verdict.reason}`);
  for (const f of verdict.findings) p(`    finding  ${f.kind.padEnd(30)} ${f.path ?? f.address ?? f.target ?? ""}`);
  p("");
  p(`  artefact        : ${outPath}`);
  p("");
  p("  Read-only. No socket opened, no runtime started, no key material touched.");
  p("");
}

process.exit(verdict.verdict === "NO_EXTERNAL_WRITE_PATH" ? 0 : 1);
