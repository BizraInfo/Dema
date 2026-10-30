import test from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DELIVERY_CHECK = join(REPO_ROOT, "scripts", "delivery-check.mjs");

test("delivery check accepts measurements exactly at the A+ ceilings", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "dema-delivery-check-test-"));
  const fakeNpmDir = join(tempRoot, "bin");
  const fakeNpm = join(fakeNpmDir, "npm");
  const fakeNpmCallLog = join(tempRoot, "npm-calls.log");

  try {
    mkdirSync(fakeNpmDir);
    writeFileSync(
      fakeNpm,
      `#!/bin/sh
if [ -n "$FAKE_NPM_CALL_LOG" ]; then printf '%s\\n' "$*" >> "$FAKE_NPM_CALL_LOG"; fi
case "$*" in
  "run perf")
    case "\${PERF_MODE}" in
      missing-measurements)
        printf '%s\\n' 'gate: OK (within A+ ceilings)'
        ;;
      missing-ok)
        printf '%s\\n' "dema_boot_latency_ms \${PERF_BOOT_MS:-150.000}" "verification_latency_ms \${PERF_VERIFY_MS:-1.000}"
        ;;
      *)
        printf '%s\\n' "dema_boot_latency_ms \${PERF_BOOT_MS:-150.000}" "verification_latency_ms \${PERF_VERIFY_MS:-1.000}" 'gate: OK (within A+ ceilings)'
        ;;
    esac
    exit \${PERF_EXIT_CODE:-0}
    ;;
  "run release:readiness -- --json")
      printf '%s\\n' '{"schema":"bizra.dema.release_readiness.v0.1","readiness_score":97,"risks":[],"ci":{"workflow":{"worktree_status_available":true,"worktree_changes":[]}}}'
    exit \${RELEASE_EXIT_CODE:-0}
    ;;
  "run pre-push:seal")
    printf '%s\\n' '104/104 PUSH_READY'
    exit \${MU_EXIT_CODE:-0}
    ;;
  "run llm:guidance")
    ;;
  *)
    printf 'unexpected fake npm invocation: %s\\n' "$*" >&2
    exit 2
    ;;
esac
`,
      { mode: 0o700 },
    );
    chmodSync(fakeNpm, 0o700);

    const run = (boot, verify, exitCode, mode, overrides = {}) =>
      spawnSync(process.execPath, [DELIVERY_CHECK], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeNpmDir}:${process.env.PATH}`,
          FAKE_NPM_CALL_LOG: fakeNpmCallLog,
          CI: "",
          GITHUB_ACTIONS: "",
          PERF_BOOT_MS: String(boot),
          PERF_VERIFY_MS: String(verify),
          PERF_EXIT_CODE: String(exitCode),
          PERF_MODE: mode,
          ...overrides,
        },
        timeout: 30_000,
      });

    const atCeilings = run(150, 1, 0, "normal");
    assert.equal(atCeilings.error, undefined);
    assert.equal(atCeilings.status, 0, atCeilings.stdout + atCeilings.stderr);
    assert.doesNotMatch(readFileSync(fakeNpmCallLog, "utf8"), /run pre-push:seal/);
    assert.match(atCeilings.stdout, /boot: 150\.00ms \(target <=150\) OK/);
    assert.match(atCeilings.stdout, /verify: 1\.000ms \(target <=1\) OK/);
    assert.match(atCeilings.stdout, /gate: PASS \(A\+\)/);
    assert.match(atCeilings.stdout, /this subcheck verifies configuration; coverage results come from the full check/);
    assert.match(atCeilings.stdout, /COVERAGE CONFIG \(configuration only\): PRESENT/);
    assert.match(atCeilings.stdout, /COVERAGE CONFIGURATION/);
    assert.doesNotMatch(atCeilings.stdout, /COVERAGE Advisory Gate|RELEASE \+ PERF QA/);
    assert.match(atCeilings.stdout, /RELEASE READINESS: PASS/);
    assert.match(atCeilings.stdout, /OVERALL LOCAL DELIVERY CHECK: PASS/);
    assert.match(atCeilings.stdout, /full tests, coverage, pre-push seal, remote CI, and production behavior remain separate evidence/);
    assert.doesNotMatch(atCeilings.stdout, /OVERALL A\+:|Blueprint delivered locally|completes the local A\+ delivery loop/);
    assert.doesNotMatch(atCeilings.stdout, /COVERAGE ADVISORY: PASS/);

    const bootOver = run(151, 1, 0, "normal");
    assert.equal(bootOver.error, undefined);
    assert.notEqual(bootOver.status, 0);
    assert.match(bootOver.stdout, /boot: 151\.00ms \(target <=150\) BREACH/);
    assert.match(bootOver.stdout, /gate: FAIL/);

    const verifyOver = run(150, 1.01, 0, "normal");
    assert.equal(verifyOver.error, undefined);
    assert.notEqual(verifyOver.status, 0);
    assert.match(verifyOver.stdout, /verify: 1\.010ms \(target <=1\) BREACH/);
    assert.match(verifyOver.stdout, /gate: FAIL/);

    const failedCommandWithPassingOutput = run(150, 1, 1, "normal");
    assert.equal(failedCommandWithPassingOutput.error, undefined);
    assert.notEqual(failedCommandWithPassingOutput.status, 0);
    assert.match(failedCommandWithPassingOutput.stdout, /gate: FAIL/);

    const missingMeasurements = run(150, 1, 0, "missing-measurements");
    assert.notEqual(missingMeasurements.status, 0);
    assert.match(missingMeasurements.stdout, /gate: FAIL/);

    const missingOkVerdict = run(150, 1, 0, "missing-ok");
    assert.notEqual(missingOkVerdict.status, 0);
    assert.match(missingOkVerdict.stdout, /gate: FAIL/);

    const failedReleaseCommandWithPassingJson = run(150, 1, 0, "normal", {
      RELEASE_EXIT_CODE: "1",
    });
    assert.notEqual(failedReleaseCommandWithPassingJson.status, 0);
    assert.match(failedReleaseCommandWithPassingJson.stdout, /release-readiness command exited 1/);
    assert.match(failedReleaseCommandWithPassingJson.stdout, /RELEASE READINESS: FAIL/);

    const failedMuCommandWithPassingText = run(150, 1, 0, "normal", {
      MU_EXIT_CODE: "1",
    });
    assert.equal(failedMuCommandWithPassingText.status, 0);
    assert.match(failedMuCommandWithPassingText.stdout, /PRE-PUSH SEAL: NOT RUN/);
    assert.doesNotMatch(readFileSync(fakeNpmCallLog, "utf8"), /run pre-push:seal/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
