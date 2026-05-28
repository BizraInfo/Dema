#!/usr/bin/env node
// URP-3.1D Stage 3 Local Index Closeout — drift-guard probe.
//
// Runs the real cryptographic chain end-to-end inside a throwaway
// DEMA_HOME and emits a schema-tagged envelope on stdout. Exits 0
// only when every step passes; emits failure envelope on stderr and
// exits 1 otherwise. NO mock passport. NO persistent receipt.
// NO network, federation, PoI, mint, or share.

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const NODE_BIN = process.execPath;

const SCHEMA = "bizra.dema.urp_stage3_closeout_demo.v0.1";
const PASS_LABEL = "URP_STAGE_3_LOCAL_INDEX_DEMO_VERIFIED";
const FAIL_LABEL = "URP_STAGE_3_LOCAL_INDEX_DEMO_FAILED";

const STEP_TIMEOUT_MS = Number.parseInt(
  process.env.URP_STAGE3_CLOSEOUT_TIMEOUT_MS ?? "30000",
  10,
);

function runCli(argv, demaHome) {
  return new Promise((resolveOne) => {
    const child = spawn(NODE_BIN, [CLI_PATH, ...argv], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEMA_HOME: demaHome,
        DEMA_NO_TUI: "1",
        NODE_ENV: "test",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), STEP_TIMEOUT_MS);
    child.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    child.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolveOne({ exitCode: code, signal, stdout, stderr });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolveOne({
        exitCode: null,
        signal: null,
        stdout: "",
        stderr: `spawn_error: ${err.message}`,
      });
    });
  });
}

function parseJsonOrNull(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function runStep(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, duration_ms: Date.now() - t0, ...detail };
  } catch (err) {
    return {
      name,
      ok: false,
      duration_ms: Date.now() - t0,
      error: String(err?.message ?? err),
    };
  }
}

async function main() {
  const demaHome = await mkdtemp(join(tmpdir(), "dema-urp-stage3-closeout-"));
  const steps = [];
  let failedStep = null;

  try {
    const s1 = await runStep("key_init", async () => {
      const r = await runCli(
        [
          "authorship",
          "key",
          "init",
          "--consent",
          "GENERATE AUTHORSHIP KEY",
          "--json",
        ],
        demaHome,
      );
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.initialized !== true) {
        throw new Error("envelope_missing_initialized_true");
      }
      return { fingerprint: env.public_key_fingerprint };
    });
    steps.push(s1);
    if (!s1.ok) {
      failedStep = "key_init";
      throw new Error(s1.error);
    }

    const artifactPath = join(demaHome, "closeout-artifact.txt");
    await writeFile(
      artifactPath,
      `URP-3.1D closeout sentinel · ${new Date().toISOString()}`,
    );
    const s2 = await runStep("sign", async () => {
      const r = await runCli(
        [
          "authorship",
          "sign",
          artifactPath,
          "--consent",
          "SIGN AUTHORSHIP RECEIPT",
          "--json",
        ],
        demaHome,
      );
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.signed !== true) {
        throw new Error("envelope_missing_signed_true");
      }
      return {
        receipt_filename: env.receipt_path
          ? env.receipt_path.split("/").pop()
          : null,
      };
    });
    steps.push(s2);
    if (!s2.ok) {
      failedStep = "sign";
      throw new Error(s2.error);
    }

    const passportPath = join(demaHome, "passport.json");
    const s3 = await runStep("passport", async () => {
      const r = await runCli(["proof", "passport", "--json"], demaHome);
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      const v = env?.aggregate?.verdict;
      if (!env || (v !== "ALL_VERIFIED" && v !== "VERIFIED")) {
        throw new Error(`bad_verdict=${v}`);
      }
      await writeFile(passportPath, JSON.stringify(env, null, 2));
      return {
        verdict: v,
        receipts_count: env.aggregate.total_receipts,
      };
    });
    steps.push(s3);
    if (!s3.ok) {
      failedStep = "passport";
      throw new Error(s3.error);
    }

    const s4 = await runStep("index", async () => {
      const r = await runCli(
        ["urp", "index", "--passport", passportPath, "--json"],
        demaHome,
      );
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.written !== true) {
        throw new Error("envelope_missing_written_true");
      }
      return { index_hash: env.write_result?.index_hash };
    });
    steps.push(s4);
    if (!s4.ok) {
      failedStep = "index";
      throw new Error(s4.error);
    }

    const s5 = await runStep("list", async () => {
      const r = await runCli(["urp", "list", "--json"], demaHome);
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.count < 1 || env.corruption_detected !== false) {
        throw new Error(
          `bad_list count=${env?.count} corruption=${env?.corruption_detected}`,
        );
      }
      for (const e of env.entries) {
        if (!e.filename_hash_matches || !e.body_hash_intact) {
          throw new Error(`entry_corrupt ${e.filename}`);
        }
      }
      return { count: env.count, corruption_detected: false };
    });
    steps.push(s5);
    if (!s5.ok) {
      failedStep = "list";
      throw new Error(s5.error);
    }

    const s6 = await runStep("verify", async () => {
      const indexDir = join(demaHome, "urp", "indexes");
      const files = (await readdir(indexDir)).filter((f) =>
        /^urp-index-[a-f0-9]{64}\.json$/.test(f),
      );
      if (files.length === 0) throw new Error("no_index_files");
      for (const f of files) {
        const r = await runCli(
          ["urp", "verify", join(indexDir, f), "--json"],
          demaHome,
        );
        if (r.exitCode !== 0) throw new Error(`verify_exit=${r.exitCode}`);
        const env = parseJsonOrNull(r.stdout);
        if (!env || env.verdict !== "VERIFIED") {
          throw new Error(`verify_verdict=${env?.verdict}`);
        }
      }
      return { verdict: "VERIFIED", verified_count: files.length };
    });
    steps.push(s6);
    if (!s6.ok) {
      failedStep = "verify";
      throw new Error(s6.error);
    }

    const totalMs = steps.reduce((sum, s) => sum + s.duration_ms, 0);
    const envelope = {
      schema: SCHEMA,
      demo_passed: true,
      truth_label: PASS_LABEL,
      steps,
      total_duration_ms: totalMs,
      dema_home_used: demaHome,
      dema_home_cleaned: true,
      boundary: {
        local_only: true,
        network_used: false,
        share_decision_made: false,
        poi_score_calculated: false,
        token_minted: false,
        federation_used: false,
        persistent_closeout_receipt_written: false,
      },
    };
    process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
    process.exitCode = 0;
  } catch (err) {
    const envelope = {
      schema: SCHEMA,
      demo_passed: false,
      truth_label: FAIL_LABEL,
      failed_step: failedStep,
      error: String(err?.message ?? err),
      steps,
      dema_home_used: demaHome,
      dema_home_cleaned: true,
      boundary: {
        local_only: true,
        network_used: false,
        share_decision_made: false,
        poi_score_calculated: false,
        token_minted: false,
        federation_used: false,
        persistent_closeout_receipt_written: false,
      },
    };
    process.stderr.write(JSON.stringify(envelope, null, 2) + "\n");
    process.exitCode = 1;
  } finally {
    await rm(demaHome, { recursive: true, force: true });
  }
}

main().catch((err) => {
  process.stderr.write(`urp-stage3-closeout crashed: ${err.stack || err}\n`);
  process.exit(2);
});
