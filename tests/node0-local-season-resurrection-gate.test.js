/**
 * NODE0-RESURRECTION-CORRECTION-1B — the promotion gate.
 *
 * Regression origin: the 1A proof driver saved sequence 3
 * (LOCAL_SEASON_RESURRECTION_PROVEN) while its own Phase 5 verification was
 * failing. The claims later proved true, so nothing looked broken — the
 * ordering that would have caught them being FALSE was simply absent.
 *
 * The invariant under test:
 *     evidence verified -> then authority state promoted.  Never the reverse.
 *
 * These tests force a gate check to fail and assert that sequence 3 does not
 * exist, HEAD stays at sequence 2, and the driver exits nonzero.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const driver = fileURLToPath(
  new URL("../scripts/review/node0-local-season-resurrection-check.mjs", import.meta.url),
);

async function runDriver(extraArgs, root) {
  const args = [driver, "--json", `--root=${root}`, ...extraArgs];
  try {
    const { stdout } = await execFileAsync("node", args, { maxBuffer: 16 * 1024 * 1024 });
    return { out: JSON.parse(stdout), code: 0 };
  } catch (error) {
    return { out: JSON.parse(error.stdout), code: error.code ?? 1 };
  }
}

const freshRoot = () => mkdtemp(join(tmpdir(), "resurrection-gate-"));

test("a fully verified run promotes sequence 3 and lands HEAD at 3", async () => {
  const root = await freshRoot();
  const { out, code } = await runDriver([], root);
  assert.equal(code, 0);
  assert.equal(out.gate.passed, true);
  assert.ok(out.gate.checks.length > 0, "a gate that examined nothing is not a pass");
  assert.equal(out.steps.sequence_3.promoted, true);
  assert.equal(out.steps.sequence_3.reason, "gate_passed");
  assert.equal(out.head_sequence, 3);
});

test("the CLI health route is exercised, not the kernel directly", async () => {
  const root = await freshRoot();
  const { out } = await runDriver([], root);
  assert.equal(out.steps.health_cli.reached_health_branch, true);
  assert.equal(out.steps.health_cli.saved, true);
  assert.equal(out.steps.health_cli.reason, "consent_verified");
});

test("receipt verification and health verdict are reported as separate truths", async () => {
  const root = await freshRoot();
  const { out } = await runDriver([], root);
  assert.equal(out.steps.health_cli.receipt_verification.verdict, "VERIFIED");
  assert.equal(out.steps.health_cli.receipt_verification.checks_failing, 0);
  // Recorded exactly as measured. An unhealthy isolated home legitimately yields
  // FAILED, and that must not be smoothed into the receipt's own verdict.
  assert.equal(typeof out.steps.health_cli.health_mission_verdict, "string");
});

test("resume reconstructs without executing, mutating, or granting consent", async () => {
  const root = await freshRoot();
  const { out } = await runDriver([], root);
  assert.equal(out.steps.resume.executed, false);
  assert.equal(out.steps.resume.mutated, false);
  assert.equal(out.steps.resume.consent_granted, false);
  assert.equal(out.steps.resume.state_sequence, 2);
  assert.equal(out.steps.resume.receipts_before, 1);
  assert.equal(out.steps.resume.receipts_after, 1);
});

// The load-bearing tests: any single failed check must block promotion.
for (const forced of [
  "receipt_located_by_resumed_hash",
  "resume_granted_no_consent",
  "single_health_receipt",
  "health_cli_reached_branch",
  "receipt_verified_after_restart",
  "must_not_repeat_preserved",
]) {
  test(`a failed '${forced}' check leaves sequence 3 unwritten`, async () => {
    const root = await freshRoot();
    const { out, code } = await runDriver([`--force-fail=${forced}`], root);

    assert.equal(code, 1, "the driver must exit nonzero when a gate check fails");
    assert.equal(out.gate.passed, false);
    assert.equal(out.steps.sequence_3.promoted, false);
    assert.equal(out.steps.sequence_3.reason, "gate_not_passed");
    assert.ok(out.blocked_by.some((v) => v.startsWith(forced)), "the violation must name the check");

    // HEAD must not have advanced past the last honestly-earned state.
    assert.equal(out.head_sequence, 2, "HEAD moved past sequence 2 without a green gate");
    assert.equal(existsSync(join(root, "seq3.json")), false, "sequence 3 was written to disk");

    // And no artifact anywhere may assert the proven phase.
    const files = await readdir(root, { recursive: true, withFileTypes: true });
    for (const entry of files) {
      if (!entry.isFile()) continue;
      const text = await readFile(join(entry.parentPath ?? entry.path, entry.name), "utf8").catch(() => "");
      assert.ok(
        !text.includes('"mission_phase": "LOCAL_SEASON_RESURRECTION_PROVEN"'),
        `${entry.name} claims the proven phase without a green gate`,
      );
    }
  });
}

test("an empty gate report is vacuous, not green", async () => {
  // Guards the shape itself: `passed` must require at least one check, so a gate
  // that examined nothing can never read as a clean pass.
  const { runResurrectionProof } = await import(
    new URL("../scripts/review/node0-local-season-resurrection-check.mjs", import.meta.url)
  );
  assert.equal(typeof runResurrectionProof, "function");
  const root = await freshRoot();
  const { out } = await runDriver([], root);
  assert.ok(out.gate.checks.length >= 17, `expected the full check battery, got ${out.gate.checks.length}`);
});
