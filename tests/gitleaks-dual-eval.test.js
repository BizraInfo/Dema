import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  decideDualEval,
  isLowercaseSha256Hex,
  buildDualEvalReport,
  resolveEventBinding,
  GITLEAKS_VERIFIER_CONTRACT,
} from "../scripts/review/gitleaks-dual-eval.mjs";
import { classifyContentOverlays } from "../scripts/review/content-required-gates.mjs";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/gitleaks-dual-eval",
);

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_M = "cccccccccccccccccccccccccccccccccccccccc";

test("D: 64-lowercase-hex digests are the intended false-positive class", () => {
  const fixture = JSON.parse(
    readFileSync(join(fixtureDir, "digest-values.json"), "utf8"),
  );
  for (const value of Object.values(fixture.digests)) {
    assert.equal(isLowercaseSha256Hex(value), true, value);
  }
});

test("E: synthetic non-digest credential is not classified as a digest", () => {
  const text = readFileSync(
    join(fixtureDir, "non-digest-credential.txt"),
    "utf8",
  );
  const match = text.match(/SYNTHETIC_NON_DIGEST_TOKEN=(.+)/);
  assert.ok(match, "fixture must contain SYNTHETIC_NON_DIGEST_TOKEN");
  assert.equal(isLowercaseSha256Hex(match[1].trim()), false);
});

test("POLICY_DELTA truth: BASE FAIL + CANDIDATE PASS => BLOCK", () => {
  const d = decideDualEval({
    basePolicy: "FAIL",
    candidatePolicy: "PASS",
    policyDelta: true,
  });
  assert.equal(d.self_certification_blocked, true);
  assert.equal(d.INDEPENDENT_ACCEPTANCE, "ABSENT");
  assert.equal(d.ok, false);
});

test("POLICY_DELTA truth: BASE UNKNOWN + CANDIDATE PASS => BLOCK", () => {
  const d = decideDualEval({
    basePolicy: "UNKNOWN",
    candidatePolicy: "PASS",
    policyDelta: true,
  });
  assert.equal(d.self_certification_blocked, true);
  assert.equal(d.ok, false);
  assert.equal(d.exit_code, 1);
});

test("POLICY_DELTA truth: BASE PASS + CANDIDATE PASS without VERIFIED => BLOCK", () => {
  const absent = decideDualEval({
    basePolicy: "PASS",
    candidatePolicy: "PASS",
    policyDelta: true,
  });
  const unknown = decideDualEval({
    basePolicy: "PASS",
    candidatePolicy: "PASS",
    policyDelta: true,
    independentAcceptance: "UNKNOWN",
  });
  assert.equal(absent.ok, false);
  assert.equal(absent.INDEPENDENT_ACCEPTANCE_REQUIRED, true);
  assert.equal(absent.INDEPENDENT_ACCEPTANCE, "ABSENT");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.INDEPENDENT_ACCEPTANCE, "UNKNOWN");
});

test("POLICY_DELTA truth: BASE PASS + CANDIDATE PASS + VERIFIED => eligible", () => {
  const d = decideDualEval({
    basePolicy: "PASS",
    candidatePolicy: "PASS",
    policyDelta: true,
    independentAcceptance: "VERIFIED",
  });
  assert.equal(d.ok, true);
  assert.equal(d.INDEPENDENT_ACCEPTANCE, "VERIFIED");
  assert.equal(d.exit_code, 0);
});

test("POLICY_DELTA truth: BASE PASS + CANDIDATE FAIL => BLOCK", () => {
  const d = decideDualEval({
    basePolicy: "PASS",
    candidatePolicy: "FAIL",
    policyDelta: true,
    independentAcceptance: "VERIFIED",
  });
  assert.equal(d.ok, false);
});

test("POLICY_DELTA truth: BASE UNKNOWN + CANDIDATE UNKNOWN => BLOCK", () => {
  const d = decideDualEval({
    basePolicy: "UNKNOWN",
    candidatePolicy: "UNKNOWN",
    policyDelta: true,
  });
  assert.equal(d.ok, false);
});

test("no POLICY_DELTA: candidate PASS is ok without independent VERIFIED", () => {
  const d = decideDualEval({
    basePolicy: "PASS",
    candidatePolicy: "PASS",
    policyDelta: false,
  });
  assert.equal(d.INDEPENDENT_ACCEPTANCE_REQUIRED, false);
  assert.equal(d.ok, true);
});

test("buildDualEvalReport preserves BASE FAIL under POLICY_DELTA", () => {
  const report = buildDualEvalReport({
    baseConfigText: 'title = "base"\n',
    candidateConfigText: 'title = "candidate"\nallowlist = []\n',
    sourceCommit: SHA_B,
    baseCommit: SHA_A,
    sourceDir: fixtureDir,
    gitleaksBin: "/nonexistent/gitleaks",
    runDetect: ({ configPath }) =>
      configPath.includes("gitleaks.base.toml") ? "FAIL" : "PASS",
  });

  assert.equal(report.verifier.version, GITLEAKS_VERIFIER_CONTRACT.version);
  assert.equal(
    report.verifier.tarball_sha256,
    GITLEAKS_VERIFIER_CONTRACT.tarball_sha256,
  );
  assert.equal(report.BASE_POLICY, "FAIL");
  assert.equal(report.CANDIDATE_POLICY, "PASS");
  assert.equal(report.POLICY_DELTA, true);
  assert.equal(report.self_certification_blocked, true);
  assert.equal(report.ok, false);
});

test("event binding: pull_request uses base/head and does not substitute merge SHA", () => {
  const b = resolveEventBinding({
    eventName: "pull_request",
    pullRequestBaseSha: SHA_A,
    pullRequestHeadSha: SHA_B,
    mergeSha: SHA_M,
  });
  assert.equal(b.ok, true);
  assert.equal(b.base_sha, SHA_A);
  assert.equal(b.candidate_sha, SHA_B);
  assert.equal(b.merge_sha, SHA_M);
  assert.equal(b.merge_sha_substituted_for_head, false);
  assert.notEqual(b.candidate_sha, b.merge_sha);
});

test("event binding: push uses before/after", () => {
  const b = resolveEventBinding({
    eventName: "push",
    pushBeforeSha: SHA_A,
    pushAfterSha: SHA_B,
  });
  assert.equal(b.ok, true);
  assert.equal(b.base_sha, SHA_A);
  assert.equal(b.candidate_sha, SHA_B);
});

test("event binding: workflow_dispatch does not invent a base", () => {
  const b = resolveEventBinding({
    eventName: "workflow_dispatch",
    dispatchSha: SHA_B,
  });
  assert.equal(b.ok, false);
  assert.equal(b.base_sha, null);
  assert.equal(b.candidate_sha, SHA_B);
  assert.match(b.reason, /unknown/i);
});

test("governance coverage includes tests/gitleaks-dual-eval.test.js", () => {
  const { overlays } = classifyContentOverlays([
    "tests/gitleaks-dual-eval.test.js",
  ]);
  assert.deepEqual(overlays, ["review_gate"]);
});

test("buildDualEvalReport removes its private temp directory", () => {
  const before = readdirSync(tmpdir()).filter((n) =>
    n.startsWith("gitleaks-dual-eval-"),
  );
  buildDualEvalReport({
    baseConfigText: 'title = "base"\n',
    candidateConfigText: 'title = "candidate"\n',
    sourceCommit: SHA_B,
    baseCommit: SHA_A,
    sourceDir: fixtureDir,
    gitleaksBin: "/nonexistent/gitleaks",
    runDetect: () => "PASS",
  });
  const after = readdirSync(tmpdir()).filter((n) =>
    n.startsWith("gitleaks-dual-eval-"),
  );
  assert.deepEqual(after, before);
});
