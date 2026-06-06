import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const verifyScript = join(repoRoot, "scripts", "verify_artifacts.py");
const forgeScript = join(repoRoot, "scripts", "forge_evidence.py");
const summaryScript = join(repoRoot, "scripts", "proof_summary.py");

const pythonStatus = spawnSync(
  "python3",
  ["-c", "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"],
  { encoding: "utf8" },
);
const pythonSkip =
  pythonStatus.status === 0 ? false : "python3 >= 3.10 is required";

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function makeProject(name) {
  const root = await mkdtemp(join(tmpdir(), name));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "artifact.txt"), "local proof artifact\n");
  return root;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test(
  "verify_artifacts records hashes without shell injection or absolute path leakage",
  { skip: pythonSkip },
  async () => {
    const project = await makeProject("dema-proof-verify-");
    const reportPath = join(project, "verification.json");
    const pwnedPath = join(project, "pwned.txt");

    try {
      const { stdout } = await execFileAsync("python3", [
        verifyScript,
        "--project-dir",
        project,
        "--description",
        "Verify local proof script safety",
        "--artifact",
        join(project, "src", "artifact.txt"),
        "--command",
        "echo safe; touch pwned.txt",
        "--output",
        reportPath,
      ]);
      const summary = JSON.parse(stdout);
      const report = await readJson(reportPath);

      assert.equal(summary.all_passed, true);
      assert.equal(report.schema, "bizra.proof-forge.verification_report.v0.1");
      assert.equal(report.project_dir, ".");
      assert.equal(report.artifacts.length, 1);
      assert.equal(report.artifacts[0].path, "src/artifact.txt");
      assert.equal("absolute_path" in report.artifacts[0], false);
      assert.equal(report.commands[0].passed, true);
      assert.equal(report.commands[0].cwd, ".");
      assert.match(report.commands[0].stdout, /safe; touch pwned\.txt/);
      assert.equal(await exists(pwnedPath), false);
      assert.equal(JSON.stringify(report).includes(project), false);
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  },
);

test(
  "forge_evidence appends and verifies a local proof-forge chain",
  { skip: pythonSkip },
  async () => {
    const project = await makeProject("dema-proof-chain-");
    const reportPath = join(project, "verification.json");

    try {
      await writeFile(
        reportPath,
        JSON.stringify(
          {
            schema: "bizra.proof-forge.verification_report.v0.1",
            timestamp_utc: "2026-05-15T00:00:00+00:00",
            description: "Proof chain fixture",
            project_dir: ".",
            artifacts: [
              {
                path: "src/artifact.txt",
                type: "doc",
                size_bytes: 21,
                mtime_utc: "2026-05-15T00:00:00+00:00",
                sha256: "0".repeat(64),
              },
            ],
            commands: [
              {
                command: "true",
                cwd: ".",
                exit_code: 0,
                duration_seconds: 0,
                stdout: "",
                stderr: "",
                passed: true,
              },
            ],
            verification_type: "automated",
            all_passed: true,
          },
          null,
          2,
        ),
      );

      const first = JSON.parse(
        (
          await execFileAsync("python3", [
            forgeScript,
            "--project-dir",
            project,
            "--description",
            "First local proof anchor",
            "--verification-report",
            reportPath,
          ])
        ).stdout,
      );
      const second = JSON.parse(
        (
          await execFileAsync("python3", [
            forgeScript,
            "--project-dir",
            project,
            "--description",
            "Second local proof anchor",
            "--verification-report",
            reportPath,
          ])
        ).stdout,
      );

      const firstReceipt = await readJson(first.receipt);
      const secondReceipt = await readJson(second.receipt);
      const index = await readJson(
        join(project, ".proof-forge", "EVIDENCE_INDEX.json"),
      );

      assert.equal(index.chain_length, 2);
      assert.equal(firstReceipt.chain.previous_hash, null);
      assert.equal(
        secondReceipt.chain.previous_hash,
        firstReceipt.chain.evidence_hash,
      );

      const verified = JSON.parse(
        (
          await execFileAsync("python3", [
            forgeScript,
            "--verify",
            "--project-dir",
            project,
          ])
        ).stdout,
      );
      assert.equal(verified.ok, true);

      firstReceipt.description = "tampered";
      await writeFile(first.receipt, JSON.stringify(firstReceipt, null, 2));
      await assert.rejects(
        execFileAsync("python3", [
          forgeScript,
          "--verify",
          "--project-dir",
          project,
        ]),
        (error) => {
          assert.equal(error.code, 1);
          assert.match(error.stdout, /evidence_hash does not recompute/);
          return true;
        },
      );
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  },
);

test(
  "proof_summary writes only inside the requested project",
  { skip: pythonSkip },
  async () => {
    const project = await makeProject("dema-proof-summary-");
    const receiptDir = join(project, ".proof-forge", "receipts");
    const receiptPath = join(receiptDir, "fixture.json");
    const repoProofDirExisted = await exists(join(repoRoot, ".proof-forge"));
    const repoSummaryExisted = await exists(join(repoRoot, "PROOF_SUMMARY.md"));

    try {
      await mkdir(receiptDir, { recursive: true });
      await writeFile(
        receiptPath,
        JSON.stringify(
          {
            receipt_id: "fixture",
            anchor_type: "proof_forge_evidence",
            description: "Summary fixture",
            artifacts: [
              { path: "src/artifact.txt", type: "doc", sha256: "1".repeat(64) },
            ],
            verification_report: {
              commands: [
                { command: "true", passed: true, duration_seconds: 0 },
              ],
            },
            chain: {
              position: 1,
              previous_hash: null,
              evidence_hash: "2".repeat(64),
            },
            confidence: { label: "Strong" },
          },
          null,
          2,
        ),
      );

      const result = JSON.parse(
        (
          await execFileAsync("python3", [
            summaryScript,
            "--receipt",
            receiptPath,
            "--project-dir",
            project,
          ])
        ).stdout,
      );

      assert.equal(await exists(result.summary), true);
      assert.equal(await exists(result.latest), true);
      assert.equal(
        result.summary.startsWith(join(project, ".proof-forge", "summaries")),
        true,
      );
      assert.equal(result.latest, join(project, "PROOF_SUMMARY.md"));
      assert.equal(
        await exists(join(repoRoot, ".proof-forge")),
        repoProofDirExisted,
      );
      assert.equal(
        await exists(join(repoRoot, "PROOF_SUMMARY.md")),
        repoSummaryExisted,
      );
    } finally {
      await rm(project, { recursive: true, force: true });
    }
  },
);
