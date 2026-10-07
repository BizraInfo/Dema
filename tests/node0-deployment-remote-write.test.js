import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  NODE0_DEPLOYMENT_REMOTE_WRITE_SCHEMA,
  NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
  REMOTE_WRITE_VERDICTS,
  REQUIRED_FACETS,
  deploymentSurfaceFacetCounts,
  evaluateDeploymentSurface,
} from "../packages/core/src/node0-deployment-remote-write.js";

import { REMOTE_WRITE_OBSERVATION_SCOPE } from "../packages/core/src/node0-closure-invariants.js";

/// A surface with every facet measured and nothing exposed.
function cleanSurface(over = {}) {
  return {
    measured_facets: [...REQUIRED_FACETS],
    listeners: [
      { address: "127.0.0.1", port: 11434, proto: "tcp" },
      { address: "::1", port: 8080, proto: "tcp" },
    ],
    mounts: [
      { target: "/data/bizra", fstype: "ext4", source: "/dev/nvme1n1p1" },
    ],
    state_roots: [
      { path: "/home/x/.dema", mode: "0700", owner_uid: 1000, group_writable: false, other_writable: false },
    ],
    process_authority: { visible_pids: 412, namespace_isolated: false },
    root_files: [
      { path: "bizra.pdf", sha256: "a".repeat(64), expected_sha256: "a".repeat(64), writable: false, under_sync_mount: false },
      { path: "themassage.pdf", sha256: "b".repeat(64), expected_sha256: "b".repeat(64), writable: false, under_sync_mount: false },
      { path: "BIZRA_Third_Fact_v0_1_FINAL.pdf", sha256: "c".repeat(64), expected_sha256: "c".repeat(64), writable: false, under_sync_mount: false },
    ],
    ...over,
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

describe("node0 deployment remote-write · the closed surface", () => {
  it("DRW-01: a fully measured, unexposed surface reports NO external write path", () => {
    const r = evaluateDeploymentSurface(cleanSurface());
    assert.equal(r.verdict, "NO_EXTERNAL_WRITE_PATH", `reason: ${r.reason}`);
    assert.equal(r.external_write_path_present, false);
    assert.deepEqual(r.findings, []);
  });

  it("DRW-02: the scope string matches the invariant's required_scope exactly", () => {
    assert.equal(NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE, REMOTE_WRITE_OBSERVATION_SCOPE);
    assert.equal(NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE, "node0_deployment_remote_write");
    for (const v of ["NO_EXTERNAL_WRITE_PATH", "EXTERNAL_WRITE_PATH_PRESENT", "INCOMPLETE"]) {
      assert.ok(REMOTE_WRITE_VERDICTS.includes(v));
    }
  });
});

describe("node0 deployment remote-write · unmeasured is never clean", () => {
  it("DRW-03 NO VACUOUS PROOF: absent input is INCOMPLETE, never NO_EXTERNAL_WRITE_PATH", () => {
    for (const bad of [undefined, {}, { measured_facets: [] }, null]) {
      const r = evaluateDeploymentSurface(bad);
      assert.notEqual(r.verdict, "NO_EXTERNAL_WRITE_PATH", `empty input must not read clean: ${JSON.stringify(bad)}`);
      assert.equal(r.verdict, "INCOMPLETE");
    }
  });

  it("DRW-04: ANY unmeasured facet forces INCOMPLETE even when everything measured looks clean", () => {
    for (const facet of REQUIRED_FACETS) {
      const s = cleanSurface({ measured_facets: REQUIRED_FACETS.filter((f) => f !== facet) });
      const r = evaluateDeploymentSurface(s);
      assert.equal(r.verdict, "INCOMPLETE", `missing ${facet} must be INCOMPLETE`);
      assert.match(String(r.reason), new RegExp(facet));
    }
  });

  it("DRW-05: a PID-namespaced observer cannot certify process authority", () => {
    // This is the exact condition inside the agent sandbox: 5 visible PIDs on a
    // machine with hundreds. Reporting "no processes" from there would be the
    // worst possible false GREEN — on the row that governs external writes.
    const s = cleanSurface({ process_authority: { visible_pids: 5, namespace_isolated: true } });
    const r = evaluateDeploymentSurface(s);
    assert.equal(r.verdict, "INCOMPLETE");
    assert.match(String(r.reason), /namespace/i);
  });
});

describe("node0 deployment remote-write · every exposure is a finding", () => {
  it("DRW-10 AMENDED 2026-08-25: a non-loopback listener alone is exposure, NOT a write path", () => {
    // Operator audit REMOTE-WRITE-CORRELATION-CONTRACT-1A: this test formerly
    // asserted listener ⇒ EXTERNAL_WRITE_PATH_PRESENT — the exact inference
    // ruled defective (ExternalReachability ≠ ExternalWriteAuthority). A
    // listener alone now settles nothing; see the CRW block below.
    const s = clone(cleanSurface());
    s.listeners.push({ address: "0.0.0.0", port: 8000, proto: "tcp" });
    const r = evaluateDeploymentSurface(s);
    assert.equal(r.verdict, "INCOMPLETE");
    assert.equal(r.external_write_path_present, false);
    assert.ok(r.findings.some((f) => f.kind === "non_loopback_listener"));
  });

  it("DRW-11: a sync/network mount over a state root is an external write path", () => {
    // gvfs is how cloud drives mount. A sync daemon writing into watched state is
    // precisely the silent external write this invariant names, and no source
    // scan can ever see it.
    const s = clone(cleanSurface());
    s.mounts.push({ target: "/home/x/.dema/corpus", fstype: "fuse.gvfsd-fuse", source: "gvfsd-fuse" });
    const r = evaluateDeploymentSurface(s);
    assert.equal(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT");
    assert.ok(r.findings.some((f) => f.kind === "sync_mount_over_state_root"));
  });

  it("DRW-12: a group- or other-writable state root is an external write path", () => {
    for (const over of [{ group_writable: true }, { other_writable: true }]) {
      const s = clone(cleanSurface());
      Object.assign(s.state_roots[0], over);
      const r = evaluateDeploymentSurface(s);
      assert.equal(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT");
      assert.ok(r.findings.some((f) => f.kind === "writable_state_root"));
    }
  });
});

describe("node0 deployment remote-write · the roots must not be writable BY ANYONE", () => {
  it("DRW-20: a writable root file is an external write path — the owner is not exempt", () => {
    // Operator instruction 2026-08-19: the root files must not be changeable
    // even by him. A root that only HE can rewrite is still a root that can be
    // rewritten, and the generation this protects is not present to object.
    const s = clone(cleanSurface());
    s.root_files[1].writable = true;
    const r = evaluateDeploymentSurface(s);
    assert.equal(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT");
    const f = r.findings.find((x) => x.kind === "writable_root_file");
    assert.ok(f, "a writable root file must be a finding");
    assert.equal(f.path, "themassage.pdf");
  });

  it("DRW-21: a root file whose hash drifted from its anchor is an external write path", () => {
    const s = clone(cleanSurface());
    s.root_files[0].sha256 = "9".repeat(64);
    const r = evaluateDeploymentSurface(s);
    assert.equal(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT");
    assert.ok(r.findings.some((f) => f.kind === "root_file_hash_drift"));
  });

  it("DRW-22: a root file under a sync mount is an external write path even if unchanged", () => {
    const s = clone(cleanSurface());
    s.root_files[2].under_sync_mount = true;
    const r = evaluateDeploymentSurface(s);
    assert.equal(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT");
    assert.ok(r.findings.some((f) => f.kind === "root_file_under_sync_mount"));
  });

  it("DRW-23: a missing root file is INCOMPLETE, not clean — absence is not proof", () => {
    const s = clone(cleanSurface());
    s.root_files = s.root_files.slice(0, 2);
    const r = evaluateDeploymentSurface(s);
    assert.notEqual(r.verdict, "NO_EXTERNAL_WRITE_PATH");
  });
});

describe("node0 deployment remote-write · the prose cannot outlive its verdict", () => {
  const sha = (s) => s ?? "";

  it("DRW-45: a VIOLATED artefact never claims 'carried no path' — the field must agree with the verdict", () => {
    const o = artefact({
      facts: {
        verdict: "EXTERNAL_WRITE_PATH_PRESENT",
        reason: "test",
        external_write_path_present: true,
        findings: [],
        facet_counts: {},
      },
    });
    assert.ok(o);
    assert.equal(o.remote_write_verdict, "EXTERNAL_WRITE_PATH_PRESENT");
    assert.ok(
      !/no path|carried no/i.test(sha(o.what_this_proves)),
      `prose contradicts a violated observation: ${o.what_this_proves}`,
    );
    assert.match(String(o.what_this_proves), /VIOLATED|external write path/i);
  });

  it("DRW-46: a SATISFIED artefact is the only one allowed the clean-surface claim", () => {
    const clean = artefact();
    assert.match(String(clean.what_this_proves), /carried no path/i);

    for (const v of ["EXTERNAL_WRITE_PATH_PRESENT", "INCOMPLETE"]) {
      const o = artefact({
        facts: {
          verdict: v,
          reason: "test",
          external_write_path_present: v === "EXTERNAL_WRITE_PATH_PRESENT",
          findings: [],
          facet_counts: {},
        },
      });
      assert.doesNotMatch(String(o.what_this_proves), /carried no path/i, `${v} must not read clean`);
    }
  });

  it("DRW-47 MUTATION CONTROL: prose stays inside the hashed body", () => {
    // The claim is evidence: flipping a word must break verification, so the
    // prose cannot be edited after the fact without detection.
    const o = artefact();
    assert.equal(verifyDeploymentRemoteWriteHash(o, sha256CanonicalJsonV1), true);
    const tampered = { ...o, what_this_proves: String(o.what_this_proves).replace(/host/, "HOST") };
    assert.equal(verifyDeploymentRemoteWriteHash(tampered, sha256CanonicalJsonV1), false);
  });
});

describe("node0 deployment remote-write · negative-control integrity", () => {
  it("DRW-30: every DIRECT-WRITE exposure case is reachable — an always-clean evaluator would fail here", () => {
    // AMENDED 2026-08-25: the pure-listener member moved out — reachability
    // alone is INCOMPLETE under the correlation contract (CRW-01).
    const mutations = [
      (s) => { s.mounts.push({ target: "/home/x/.dema/z", fstype: "nfs4", source: "nas:/x" }); return s; },
      (s) => { s.state_roots[0].other_writable = true; return s; },
      (s) => { s.root_files[0].writable = true; return s; },
      (s) => { s.root_files[0].sha256 = "0".repeat(64); return s; },
      (s) => { s.root_files[0].under_sync_mount = true; return s; },
    ];
    for (const m of mutations) {
      const r = evaluateDeploymentSurface(m(clone(cleanSurface())));
      assert.equal(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT");
    }
    // and the untouched control still reports clean, so the suite is not
    // simply refusing everything
    assert.equal(evaluateDeploymentSurface(cleanSurface()).verdict, "NO_EXTERNAL_WRITE_PATH");
  });

  it("DRW-44b DERIVATION BINDING: hand-edited verdict with carry-evidence mismatch is rejected", () => {
    // The audit exploit deleted carried findings, relabelled the result clean,
    // preserved contradictory summary fields, and recomputed the unkeyed hash.
    // v0.2 binds the original non-loopback listener in `surface`, so the adapter
    // re-derives INCOMPLETE and refuses the forged clean admission.
    const source = artefact({ surface: listenerSurface() });
    const { observation_hash: _h, ...body } = source;
    const forgedBody = {
      ...body,
      remote_write_verdict: "NO_EXTERNAL_WRITE_PATH",
      remote_write_reason: "contradictory_reason_preserved",
      external_write_path_present: true,
      findings: [],
      facet_counts: {},
    };
    const forged = { ...forgedBody, observation_hash: sha256CanonicalJsonV1(forgedBody) };
    assert.ok(verifyDeploymentRemoteWriteHash(forged, sha256CanonicalJsonV1), "forged hash must verify");
    assert.equal(remoteWriteDeploymentObservation({ readFile: reader(forged), now: NOW }), null);
    assert.equal(
      remoteWriteDeploymentDiagnostic({ readFile: reader(forged), now: NOW }).state,
      "DERIVATION_MISMATCH",
    );
  });
});

// ── the adapter · the highest bar in the ledger ───────────────────────────────
import {
  remoteWriteDeploymentObservation,
  remoteWriteDeploymentDiagnostic,
  currentRemoteWriteCollectorHash,
  currentRemoteWriteKernelHash,
  REMOTE_WRITE_INVARIANT_ID,
} from "../packages/core/src/node0-deployment-remote-write-adapter.js";
import {
  buildDeploymentRemoteWriteObservation,
  verifyDeploymentRemoteWriteHash,
} from "../packages/core/src/node0-deployment-remote-write.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

const KH = currentRemoteWriteKernelHash();
const CH = currentRemoteWriteCollectorHash();
const OBSERVED_AT = "2026-08-31T12:00:00.000Z";
const NOW = Date.parse("2026-08-31T12:30:00.000Z");

function listenerSurface() {
  const s = clone(cleanSurface());
  s.listeners.push({ address: "0.0.0.0", port: 8000, proto: "tcp" });
  return s;
}

function writableSurface() {
  const s = clone(cleanSurface());
  s.root_files[0].writable = true;
  return s;
}

function factsFor(surface) {
  return { ...evaluateDeploymentSurface(surface), facet_counts: deploymentSurfaceFacetCounts(surface) };
}

function artefact({
  surface = cleanSurface(),
  facts = factsFor(surface),
  evidenceClass = "OBSERVED",
  observedAt = OBSERVED_AT,
  executedCodeHash = KH,
  collectorCodeHash = CH,
} = {}) {
  return buildDeploymentRemoteWriteObservation({
    facts,
    surface,
    evidenceClass,
    observedAt,
    executedCodeHash,
    collectorCodeHash,
    hash: sha256CanonicalJsonV1,
  });
}
const reader = (o) => () => JSON.stringify(o);
const enoent = () => { const e = new Error("nope"); e.code = "ENOENT"; throw e; };

describe("node0 deployment remote-write · adapter", () => {
  it("DRW-40: a clean host artefact settles the row with observed:false", () => {
    const o = remoteWriteDeploymentObservation({ readFile: reader(artefact()), now: NOW });
    assert.ok(o);
    assert.equal(o.observed, false);          // required:false -> SATISFIED
    assert.equal(o.scope, "node0_deployment_remote_write");
  });

  it("DRW-41: a surface that FOUND a write path REFUTES the row with observed:true", () => {
    const o = remoteWriteDeploymentObservation({
      readFile: reader(artefact({ surface: writableSurface() })),
      now: NOW,
    });
    assert.ok(o, "a measured exposure must be able to refute, not fall silent");
    assert.equal(o.observed, true);           // required:false -> VIOLATED
  });

  it("DRW-42: an INCOMPLETE artefact settles NOTHING — the sandbox case", () => {
    const a = artefact({ surface: listenerSurface() });
    assert.equal(remoteWriteDeploymentObservation({ readFile: reader(a), now: NOW }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(a), now: NOW }).state, "NOT_CLEAN_ELIGIBLE");
  });

  it("DRW-43: a missing artefact is silence, not a clean surface", () => {
    assert.equal(remoteWriteDeploymentObservation({ readFile: enoent }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: enoent }).state, "NOT_RECORDED");
    assert.equal(REMOTE_WRITE_INVARIANT_ID, "remote_write");
  });

  it("DRW-44 MUTATION CONTROL: tampered body, foreign kernel bytes, relabelled scope", () => {
    const tampered = { ...artefact(), remote_write_verdict: "NO_EXTERNAL_WRITE_PATH", findings: [{ kind: "x" }] };
    assert.equal(remoteWriteDeploymentObservation({ readFile: reader(tampered), now: NOW }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(tampered), now: NOW }).state, "HASH_UNVERIFIED");

    const a = artefact();
    const { observation_hash: _h, ...body } = a;
    const foreign = { ...body, executed_code_hash: `sha256:${"0".repeat(64)}` };
    const forged = { ...foreign, observation_hash: sha256CanonicalJsonV1(foreign) };
    assert.equal(remoteWriteDeploymentObservation({ readFile: reader(forged), now: NOW }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(forged), now: NOW }).state, "KERNEL_BYTES_MISMATCH");

    const relabel = { ...body, scope: "node0_runtime_kill_resume" };
    const forged2 = { ...relabel, observation_hash: sha256CanonicalJsonV1(relabel) };
    assert.equal(remoteWriteDeploymentObservation({ readFile: reader(forged2), now: NOW }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(forged2), now: NOW }).state, "SCHEMA_MISMATCH");
  });

  it("DRW-45 v0.2: each rehashed decision-bearing mismatch is refused", () => {
    const source = artefact({ surface: listenerSurface() });
    const { observation_hash: _h, ...body } = source;
    const controls = [
      { remote_write_verdict: "NO_EXTERNAL_WRITE_PATH" },
      { remote_write_reason: "contradictory_reason_preserved" },
      { external_write_path_present: true },
      { findings: [] },
      { facet_counts: { ...body.facet_counts, listeners: 0 } },
    ];
    for (const mutation of controls) {
      const forgedBody = { ...body, ...mutation };
      const forged = { ...forgedBody, observation_hash: sha256CanonicalJsonV1(forgedBody) };
      assert.ok(verifyDeploymentRemoteWriteHash(forged, sha256CanonicalJsonV1));
      assert.equal(remoteWriteDeploymentObservation({ readFile: reader(forged), now: NOW }), null);
      assert.equal(
        remoteWriteDeploymentDiagnostic({ readFile: reader(forged), now: NOW }).state,
        "DERIVATION_MISMATCH",
      );
    }
  });

  it("DRW-46 v0.2: timestamp and collector bytes are admission-bound", () => {
    const source = artefact();
    const timestampTamper = { ...source, observed_at: "2026-08-31T12:01:00.000Z" };
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(timestampTamper), now: NOW }).state, "HASH_UNVERIFIED");

    const { observation_hash: _h, ...body } = source;
    const collectorForgery = { ...body, collector_code_hash: `sha256:${"0".repeat(64)}` };
    const forged = { ...collectorForgery, observation_hash: sha256CanonicalJsonV1(collectorForgery) };
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(forged), now: NOW }).state, "COLLECTOR_BYTES_MISMATCH");
  });

  it("DRW-47 v0.2: stale, future, legacy, and surface-less artefacts cannot settle the row", () => {
    const stale = artefact({ observedAt: "2026-08-30T12:00:00.000Z" });
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(stale), now: NOW }).state, "OBSERVATION_STALE");

    const future = artefact({ observedAt: "2026-08-31T12:36:00.000Z" });
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(future), now: NOW }).state, "OBSERVATION_FUTURE_DATED");

    const source = artefact();
    const { observation_hash: _h, ...body } = source;
    const legacyBody = { ...body, schema: "bizra.dema.node0_deployment_remote_write_observation.v0.1" };
    const legacy = { ...legacyBody, observation_hash: sha256CanonicalJsonV1(legacyBody) };
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(legacy), now: NOW }).state, "LEGACY_DERIVATION_UNVERIFIED");

    const { surface: _surface, ...surfaceLessBody } = body;
    const surfaceLess = { ...surfaceLessBody, observation_hash: sha256CanonicalJsonV1(surfaceLessBody) };
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(surfaceLess), now: NOW }).state, "DERIVATION_UNVERIFIED");
  });
});

// ── correlation contract · REMOTE-WRITE-CORRELATION-CONTRACT-1A ──────────────
// Operator audit 2026-08-25: ExternalReachability ≠ ExternalWriteAuthority.
// A listener proves EXPOSURE, not a write route. Only findings whose very
// structure binds an external write capability to sovereign state (sync mount
// over state root, writable state root/file, root under sync mount, hash
// drift) may assert EXTERNAL_WRITE_PATH_PRESENT. Reachability-only surfaces
// settle NOTHING — INCOMPLETE — which blocks closure exactly as hard as
// VIOLATED does, without claiming an uncorrelated causal fact.
import {
  DIRECT_WRITE_FINDING_KINDS,
  REACHABILITY_ONLY_FINDING_KINDS,
} from "../packages/core/src/node0-deployment-remote-write.js";

describe("node0 deployment remote-write · correlation contract (Trace ≠ Diagnosis)", () => {
  const listenerOnly = () => {
    const s = clone(cleanSurface());
    s.listeners.push({ address: "0.0.0.0", port: 8000, proto: "tcp" });
    return evaluateDeploymentSurface(s);
  };

  it("CRW-01: reachability alone is INCOMPLETE — never EXTERNAL_WRITE_PATH_PRESENT", () => {
    const r = listenerOnly();
    assert.equal(r.verdict, "INCOMPLETE");
    assert.notEqual(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT");
    assert.equal(r.external_write_path_present, false);
    assert.match(String(r.reason), /reachability_without_write_correlation/);
    assert.match(String(r.reason), /non_loopback_listener/);
  });

  it("CRW-02 VISIBILITY CONTROL: refused correlation still carries every finding", () => {
    const r = listenerOnly();
    assert.equal(r.findings.length, 1);
    assert.equal(r.findings[0].kind, "non_loopback_listener");
  });

  it("CRW-03: each DIRECT-WRITE kind remains independently sufficient for VIOLATED", () => {
    const cases = [
      (s) => { s.mounts.push({ target: "/home/x/.dema", fstype: "fuse.gvfsd-fuse", source: "gvfsd" }); },
      (s) => { s.state_roots[0].other_writable = true; },
      (s) => { s.root_files[0].writable = true; },
      (s) => { s.root_files[0].sha256 = "9".repeat(64); },
      (s) => { s.root_files[0].under_sync_mount = true; },
    ];
    for (const mutate of cases) {
      const s = clone(cleanSurface());
      mutate(s);
      const r = evaluateDeploymentSurface(s);
      assert.equal(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT", JSON.stringify(r.findings));
    }
  });

  it("CRW-04 MIXED: one direct-write finding dominates; listeners ride along as context", () => {
    const s = clone(cleanSurface());
    s.listeners.push({ address: "0.0.0.0", port: 8000, proto: "tcp" });
    s.state_roots[0].group_writable = true;
    const r = evaluateDeploymentSurface(s);
    assert.equal(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT");
    assert.ok(r.findings.some((f) => f.kind === "writable_state_root"));
    assert.ok(r.findings.some((f) => f.kind === "non_loopback_listener"));
  });

  it("CRW-05 TAXONOMY: the two tiers are exhaustive and disjoint over known kinds", () => {
    const all = new Set([...DIRECT_WRITE_FINDING_KINDS, ...REACHABILITY_ONLY_FINDING_KINDS]);
    for (const k of ["non_loopback_listener", "sync_mount_over_state_root", "writable_state_root",
      "writable_root_file", "root_file_under_sync_mount", "root_file_hash_drift"]) {
      assert.ok(all.has(k), `unclassified finding kind: ${k}`);
    }
    for (const k of DIRECT_WRITE_FINDING_KINDS) {
      assert.ok(!REACHABILITY_ONLY_FINDING_KINDS.includes(k));
    }
  });
});
