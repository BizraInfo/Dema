#!/usr/bin/env node
// URP-4.1D Stage 4 Choose Closeout drift-guard probe.
//
// Runs the real local chain end-to-end inside a throwaway DEMA_HOME:
// key init -> sign -> proof passport -> urp index -> urp verify ->
// choose MARK_SHAREABLE -> choose MARK_LOCAL_ONLY -> choose list ->
// choose verify.
//
// This is not a runtime authority and not a new dema subcommand. It is a
// replayable check harness that fails npm run check if the Stage 4 choose
// write/list/verify contract drifts.

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const NODE_BIN = process.execPath;

const SCHEMA = "bizra.dema.urp_stage4_closeout_demo.v0.1";
const PASS_LABEL = "URP_STAGE_4_CHOOSE_CLOSEOUT_VERIFIED";
const FAIL_LABEL = "URP_STAGE_4_CHOOSE_CLOSEOUT_FAILED";

const STEP_TIMEOUT_MS = Number.parseInt(
  process.env.URP_STAGE4_CLOSEOUT_TIMEOUT_MS ?? "30000",
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

function stepSucceeded(steps, name) {
  return steps.some((s) => s.name === name && s.ok);
}

function closeoutBoundary({ steps, temporaryArtifactWritten }) {
  return {
    local_only: true,
    temporary_dema_home_used: true,
    temporary_file_write_performed:
      temporaryArtifactWritten || hasSuccessfulChooseStep(steps),
    temporary_author_key_created: stepSucceeded(steps, "key_init"),
    temporary_authorship_signing_performed: stepSucceeded(steps, "sign"),
    temporary_choose_receipts_written: hasSuccessfulChooseStep(steps),
    operator_dema_home_mutated: false,
    operator_private_key_loaded: false,
    network_used: false,
    share_published: false,
    poi_score_calculated: false,
    token_minted: false,
    federation_used: false,
    economic_claim_made: false,
    persistent_closeout_receipt_written: false,
  };
}

function hasSuccessfulChooseStep(steps) {
  return steps.some(
    (s) => (s.name === "choose_share" || s.name === "choose_keep") && s.ok,
  );
}

async function main() {
  const demaHome = await mkdtemp(join(tmpdir(), "dema-urp-stage4-closeout-"));
  const steps = [];
  let failedStep = null;
  let indexPath = null;
  let envelope = null;
  let output = "stdout";
  let exitCode = 0;
  let temporaryArtifactWritten = false;
  const chooseReceiptPaths = [];
  const chooseHashes = [];

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

    const artifactPath = join(demaHome, "stage4-closeout-artifact.txt");
    await writeFile(
      artifactPath,
      `URP-4.1D closeout sentinel ${new Date().toISOString()}`,
    );
    temporaryArtifactWritten = true;
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
      indexPath = env.write_result?.index_path ?? null;
      if (!indexPath) throw new Error("missing_index_path");
      return {
        index_hash: env.write_result?.index_hash,
        index_filename: indexPath.split("/").pop(),
      };
    });
    steps.push(s4);
    if (!s4.ok) {
      failedStep = "index";
      throw new Error(s4.error);
    }

    const s5 = await runStep("index_verify", async () => {
      const r = await runCli(["urp", "verify", indexPath, "--json"], demaHome);
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.verdict !== "VERIFIED") {
        throw new Error(`verify_verdict=${env?.verdict}`);
      }
      return {
        verdict: env.verdict,
        filename_hash_matches: env.filename_hash_matches,
      };
    });
    steps.push(s5);
    if (!s5.ok) {
      failedStep = "index_verify";
      throw new Error(s5.error);
    }

    const s6 = await runStep("choose_share", async () => {
      const r = await runCli(
        [
          "urp",
          "choose",
          indexPath,
          "--decision",
          "MARK_SHAREABLE",
          "--consent",
          "MARK URP ENTRY SHAREABLE",
          "--json",
        ],
        demaHome,
      );
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.chosen !== true || env.written !== true) {
        throw new Error("choose_share_not_persisted");
      }
      if (env.next_share_status !== "CANDIDATE_SHAREABLE") {
        throw new Error(`bad_next_status=${env.next_share_status}`);
      }
      chooseReceiptPaths.push(env.receipt_path);
      chooseHashes.push(env.choose_hash);
      return {
        decision: env.decision,
        next_share_status: env.next_share_status,
        choose_hash: env.choose_hash,
        receipt_filename: env.receipt_path.split("/").pop(),
      };
    });
    steps.push(s6);
    if (!s6.ok) {
      failedStep = "choose_share";
      throw new Error(s6.error);
    }

    const s7 = await runStep("choose_keep", async () => {
      const r = await runCli(
        [
          "urp",
          "choose",
          indexPath,
          "--decision",
          "MARK_LOCAL_ONLY",
          "--consent",
          "MARK URP ENTRY LOCAL-ONLY",
          "--json",
        ],
        demaHome,
      );
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.chosen !== true || env.written !== true) {
        throw new Error("choose_keep_not_persisted");
      }
      if (env.next_share_status !== "MARKED_LOCAL_ONLY") {
        throw new Error(`bad_next_status=${env.next_share_status}`);
      }
      chooseReceiptPaths.push(env.receipt_path);
      chooseHashes.push(env.choose_hash);
      return {
        decision: env.decision,
        next_share_status: env.next_share_status,
        choose_hash: env.choose_hash,
        receipt_filename: env.receipt_path.split("/").pop(),
      };
    });
    steps.push(s7);
    if (!s7.ok) {
      failedStep = "choose_keep";
      throw new Error(s7.error);
    }

    const s8 = await runStep("choose_list", async () => {
      const r = await runCli(["urp", "choose", "list", "--json"], demaHome);
      if (r.exitCode !== 0) throw new Error(`exit=${r.exitCode}`);
      const env = parseJsonOrNull(r.stdout);
      if (!env || env.count !== 2 || env.corruption_detected !== false) {
        throw new Error(
          `bad_list count=${env?.count} corruption=${env?.corruption_detected}`,
        );
      }
      const listedHashes = new Set(env.entries.map((e) => e.choose_hash));
      for (const h of chooseHashes) {
        if (!listedHashes.has(h)) throw new Error(`missing_choose_hash=${h}`);
      }
      for (const e of env.entries) {
        if (!e.filename_hash_matches || !e.body_hash_intact) {
          throw new Error(`entry_corrupt ${e.filename}`);
        }
      }
      return { count: env.count, corruption_detected: false };
    });
    steps.push(s8);
    if (!s8.ok) {
      failedStep = "choose_list";
      throw new Error(s8.error);
    }

    const s9 = await runStep("choose_verify", async () => {
      for (const p of chooseReceiptPaths) {
        const r = await runCli(
          ["urp", "choose", "verify", p, "--json"],
          demaHome,
        );
        if (r.exitCode !== 0) throw new Error(`verify_exit=${r.exitCode}`);
        const env = parseJsonOrNull(r.stdout);
        if (!env || env.verdict !== "VERIFIED") {
          throw new Error(`verify_verdict=${env?.verdict}`);
        }
      }
      return {
        verdict: "VERIFIED",
        verified_count: chooseReceiptPaths.length,
      };
    });
    steps.push(s9);
    if (!s9.ok) {
      failedStep = "choose_verify";
      throw new Error(s9.error);
    }

    const totalMs = steps.reduce((sum, s) => sum + s.duration_ms, 0);
    envelope = {
      schema: SCHEMA,
      demo_passed: true,
      truth_label: PASS_LABEL,
      steps,
      total_duration_ms: totalMs,
      dema_home_used: demaHome,
      dema_home_cleaned: false,
      boundary: closeoutBoundary({ steps, temporaryArtifactWritten }),
    };
  } catch (err) {
    envelope = {
      schema: SCHEMA,
      demo_passed: false,
      truth_label: FAIL_LABEL,
      failed_step: failedStep,
      error: String(err?.message ?? err),
      steps,
      dema_home_used: demaHome,
      dema_home_cleaned: false,
      boundary: closeoutBoundary({ steps, temporaryArtifactWritten }),
    };
    output = "stderr";
    exitCode = 1;
  } finally {
    try {
      await rm(demaHome, { recursive: true, force: true });
      if (envelope) envelope.dema_home_cleaned = true;
    } catch (err) {
      if (envelope) {
        envelope.demo_passed = false;
        envelope.truth_label = FAIL_LABEL;
        envelope.failed_step = envelope.failed_step ?? "cleanup";
        envelope.cleanup_error = String(err?.message ?? err);
        envelope.dema_home_cleaned = false;
        output = "stderr";
        exitCode = 1;
      } else {
        throw err;
      }
    }

    if (envelope) {
      const stream = output === "stdout" ? process.stdout : process.stderr;
      stream.write(JSON.stringify(envelope, null, 2) + "\n");
      process.exitCode = exitCode;
    }
  }
}

main().catch((err) => {
  process.stderr.write(`urp-stage4-closeout crashed: ${err.stack || err}\n`);
  process.exit(2);
});
