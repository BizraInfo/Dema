import test from "node:test";
import assert from "node:assert/strict";
import { computeReleaseVerdict } from "../packages/core/src/node0-release-verdict.js";
import { buildControlPlaneBoundary } from "../packages/core/src/node0-proof-rails.js";

// Same positive rail values as the upstream hermetic fixture; no host access.
const input = {
  checks: { schema: true, invariants: true, fail_closed: true, test: true,
    coverage: true, check: true, perf: true, delivery: true, sha256: true,
    codeql: "PASS", gitleaks: "PASS", bizra_review_gate: "PASS",
    local_operator_seal: "PASS", ci_remote_seal: "PENDING" },
  workflows: { ci_matrix: "PASS", local_operator_seal: "PASS",
    ci_remote_seal: "PENDING", codeql: "PASS", gitleaks: "PASS" },
  coverage: { present: true, lines: 95, threshold: 80 },
  perf: { present: true, boot_latency_ms: 120, ceiling: 150,
    mode: "A_PLUS_LOCAL_OR_CI_HEADROOM" },
  claims: [], boundaries: buildControlPlaneBoundary(), release_mode: false,
};
const keys = Object.keys(input.boundaries);

test("RVB-01: intact upstream boundary retains READY_LOCAL ceiling", () => {
  assert.equal(computeReleaseVerdict(input), "READY_LOCAL");
});
test("RVB-02: existing default-boundary semantics are unchanged", () => {
  const { boundaries, ...rest } = input;
  assert.equal(computeReleaseVerdict(rest), "READY_LOCAL");
});
for (const key of keys) {
  test(`RVB-03: explicit ${key}=false must prevent READY_LOCAL`, () => {
    assert.equal(computeReleaseVerdict({ ...input,
      boundaries: { ...input.boundaries, [key]: false } }), "BLOCKED");
  });
}
test("RVB-04: exhaustive boolean boundary matrix (128 inputs)", () => {
  assert.equal(keys.length, 7, "Update matrix if the boundary schema changes");
  const results = [];
  for (let mask = 0; mask < 2 ** keys.length; mask++) {
    const boundaries = Object.fromEntries(keys.map((key, bit) => [key, Boolean(mask & (1 << bit))]));
    const expected = Object.values(boundaries).every(Boolean) ? "READY_LOCAL" : "BLOCKED";
    const actual = computeReleaseVerdict({ ...input, boundaries });
    if (actual !== expected) results.push({ mask, boundaries, expected, actual });
  }
  assert.deepEqual(results, []);
});
test("RVB-05: caller-owned input stays unchanged", () => {
  const candidate = structuredClone(input);
  candidate.boundaries.no_network_required = false;
  const before = structuredClone(candidate);
  computeReleaseVerdict(candidate);
  assert.deepEqual(candidate, before);
});
test("RVB-06: refusal does not poison a later valid evaluation", () => {
  assert.equal(computeReleaseVerdict({ ...input,
    boundaries: { ...input.boundaries, no_token_mint: false } }), "BLOCKED");
  assert.equal(computeReleaseVerdict(input), "READY_LOCAL");
});
test("RVB-07: missing evidence remains BLOCKED", () => {
  assert.equal(computeReleaseVerdict(), "BLOCKED");
});
test("RVB-08: economic overclaim remains BLOCKED", () => {
  assert.equal(computeReleaseVerdict({ ...input, claims: ["LIVE_TOKEN"] }), "BLOCKED");
});
