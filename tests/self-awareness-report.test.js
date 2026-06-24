import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildSelfAwarenessReport,
  normalizeSelfCapability,
  verifySelfAwarenessReport,
  SELF_AWARENESS_REPORT_SCHEMA,
  SELF_AWARENESS_STATUSES,
} from "../packages/core/src/self-awareness-report.js";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

function caps() {
  return [
    {
      id: "hhmm_kernel",
      name: "HHMM state-machine kernel",
      claim: "Models Node0 lifecycle deterministically.",
      evidence: ["packages/core/src/hhmm-state-machine.js"],
    },
    {
      id: "live_federation",
      name: "Live cross-node federation",
      claim: "Federates state across nodes.",
      // no evidence → BLIND_SPOT (claimed but cannot be evidenced)
    },
    {
      id: "diffusion_reasoner",
      name: "Diffusion reasoner",
      claim: "Iterative denoising reasoning over claims.",
      known_unknown: true, // honest known-unknown → NOT_KNOWN
    },
  ];
}

test("1 · builds a deterministic frozen self-awareness report", () => {
  const a = buildSelfAwarenessReport({ capabilities: caps(), namespace: "node0" });
  const b = buildSelfAwarenessReport({ capabilities: caps(), namespace: "node0" });
  assert.equal(a.schema, SELF_AWARENESS_REPORT_SCHEMA);
  assert.equal(a.schema, "bizra.dema.self_awareness_report.v0.1");
  assert.deepEqual(SELF_AWARENESS_STATUSES, ["EVIDENCED", "BLIND_SPOT", "NOT_KNOWN"]);
  assert.match(a.report_hash, SHA256_HEX);
  assert.equal(a.report_hash, b.report_hash);
  assert.equal(Object.isFrozen(a), true);
  assert.equal(verifySelfAwarenessReport(a).valid, true);
});

test("2 · classifies an evidenced capability as EVIDENCED", () => {
  const c = normalizeSelfCapability({ id: "x", name: "X", claim: "c", evidence: ["a.js"] }, 0);
  assert.equal(c.status, "EVIDENCED");
});

test("3 · classifies a claimed-but-unevidenced capability as BLIND_SPOT (the point)", () => {
  const c = normalizeSelfCapability({ id: "x", name: "X", claim: "c" }, 0);
  assert.equal(c.status, "BLIND_SPOT");
});

test("4 · classifies an explicit known_unknown as NOT_KNOWN (honest limit)", () => {
  const c = normalizeSelfCapability({ id: "x", name: "X", claim: "c", known_unknown: true }, 0);
  assert.equal(c.status, "NOT_KNOWN");
});

test("5 · self_knowledge_coverage = evidenced / declared (shown math, bounded [0,1])", () => {
  const r = buildSelfAwarenessReport({ capabilities: caps() });
  assert.equal(r.declared_count, 3);
  assert.equal(r.evidenced_count, 1);
  assert.equal(r.blind_spot_count, 1);
  assert.equal(r.not_known_count, 1);
  assert.equal(r.self_knowledge_coverage, 1 / 3);
  assert.ok(r.self_knowledge_coverage >= 0 && r.self_knowledge_coverage <= 1);
});

test("6 · blind_spots list names the unevidenced claims", () => {
  const r = buildSelfAwarenessReport({ capabilities: caps() });
  assert.equal(r.blind_spots.length, 1);
  assert.equal(r.blind_spots[0].id, "live_federation");
});

test("7 · fail-closed on a malformed capability", () => {
  const r = buildSelfAwarenessReport({ capabilities: [42] });
  assert.equal(r.valid, false);
  assert.match(r.reason_code, /capability_malformed/);
});

test("8 · fail-closed on a missing required field", () => {
  const noName = buildSelfAwarenessReport({ capabilities: [{ claim: "c" }] });
  assert.equal(noName.valid, false);
  assert.match(noName.reason_code, /name_required/);

  const noClaim = buildSelfAwarenessReport({ capabilities: [{ name: "X" }] });
  assert.equal(noClaim.valid, false);
  assert.match(noClaim.reason_code, /claim_required/);
});

test("9 · fail-closed on duplicate capability ids and empty input", () => {
  const [c] = caps();
  const dup = buildSelfAwarenessReport({ capabilities: [c, { ...c }] });
  assert.equal(dup.valid, false);
  assert.match(dup.reason_code, /duplicate_capability_id/);

  const empty = buildSelfAwarenessReport({ capabilities: [] });
  assert.equal(empty.valid, false);
  assert.match(empty.reason_code, /capabilities_empty/);
});

test("10 · does NOT claim consciousness/sentience/introspection; verify fails closed on overclaim", () => {
  const r = buildSelfAwarenessReport({ capabilities: caps() });
  assert.equal(r.claims_consciousness, false);
  assert.ok(
    r.what_this_does_not_prove.some((line) => /not.*(conscious|sentien|introspect|self-aware in any subjective)/i.test(line)),
  );
  const tampered = JSON.parse(JSON.stringify(r));
  tampered.claims_consciousness = true;
  const v = verifySelfAwarenessReport(tampered);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((b) => b.includes("consciousness_overclaim")));
});

test("11 · verify catches capability, coverage, and boundary tampering", () => {
  const r = buildSelfAwarenessReport({ capabilities: caps() });

  const capTamper = JSON.parse(JSON.stringify(r));
  capTamper.capabilities[0].claim = "tampered";
  assert.ok(verifySelfAwarenessReport(capTamper).blocked_by.some((b) => b.includes("capability_hash_mismatch")));

  const covTamper = JSON.parse(JSON.stringify(r));
  covTamper.self_knowledge_coverage = 1.0;
  // recompute report_hash so the report_hash backstop passes — isolate the coverage check
  const { report_hash: _d, ...body } = covTamper;
  covTamper.report_hash = sha256(stableStringify(body));
  assert.ok(verifySelfAwarenessReport(covTamper).blocked_by.some((b) => b.includes("coverage_mismatch")));

  const boundaryTamper = JSON.parse(JSON.stringify(r));
  boundaryTamper.boundary.network_call_performed = true;
  assert.ok(verifySelfAwarenessReport(boundaryTamper).blocked_by.some((b) => b.includes("boundary_not_false")));
});

test("12 · source has no fs/network/process/clock/random surfaces", async () => {
  const src = await readFile(
    new URL("../packages/core/src/self-awareness-report.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(src, /node:(fs|net|http|https|child_process|os|worker_threads)\b/);
  assert.doesNotMatch(src, /\bDate\.now\b|\bnew Date\b|\bMath\.random\b/);
  assert.doesNotMatch(src, /\bfetch\s*\(|\bimport\s*\(/);
});

test("13 · boundary is entirely false", () => {
  const r = buildSelfAwarenessReport({ capabilities: caps() });
  for (const [k, v] of Object.entries(r.boundary)) {
    assert.equal(v, false, `boundary.${k} must be false`);
  }
});

test("14 · coverage is non-gameable: a blind spot laundered to EVIDENCED (with all hashes/counts recomputed) is rejected", () => {
  const r = buildSelfAwarenessReport({ capabilities: caps() });
  const forged = JSON.parse(JSON.stringify(r));
  // launder the unevidenced (BLIND_SPOT) capability into EVIDENCED
  const target = forged.capabilities.find((c) => c.status === "BLIND_SPOT");
  assert.ok(target, "fixture has a blind spot");
  target.status = "EVIDENCED";
  // recompute its capability_hash over the lie so capability_hash_mismatch won't fire
  const { capability_hash: _ch, ...cbody } = target;
  target.capability_hash = sha256(stableStringify(cbody));
  // reconcile counts + coverage + blind_spots so those backstops also pass
  forged.evidenced_count += 1;
  forged.blind_spot_count -= 1;
  forged.self_knowledge_coverage = forged.evidenced_count / forged.declared_count;
  forged.blind_spots = forged.blind_spots.filter((b) => b.id !== target.id);
  // recompute report_hash so the report_hash backstop passes — only status_mismatch can catch it
  const { report_hash: _rh, ...body } = forged;
  forged.report_hash = sha256(stableStringify(body));

  const v = verifySelfAwarenessReport(forged);
  assert.equal(v.valid, false);
  assert.ok(v.blocked_by.some((b) => b.includes("status_mismatch")), JSON.stringify(v.blocked_by));
});
