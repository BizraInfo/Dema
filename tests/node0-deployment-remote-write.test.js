import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  NODE0_DEPLOYMENT_REMOTE_WRITE_SCHEMA,
  NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
  REMOTE_WRITE_VERDICTS,
  REQUIRED_FACETS,
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
  it("DRW-10: a listener on a non-loopback address is an external write path", () => {
    const s = clone(cleanSurface());
    s.listeners.push({ address: "0.0.0.0", port: 8000, proto: "tcp" });
    const r = evaluateDeploymentSurface(s);
    assert.equal(r.verdict, "EXTERNAL_WRITE_PATH_PRESENT");
    assert.equal(r.external_write_path_present, true);
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

describe("node0 deployment remote-write · negative-control integrity", () => {
  it("DRW-30: every exposure case is reachable — a always-clean evaluator would fail here", () => {
    const mutations = [
      (s) => { s.listeners.push({ address: "0.0.0.0", port: 9, proto: "tcp" }); return s; },
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
});

// ── the adapter · the highest bar in the ledger ───────────────────────────────
import {
  remoteWriteDeploymentObservation,
  remoteWriteDeploymentDiagnostic,
  currentRemoteWriteKernelHash,
  REMOTE_WRITE_INVARIANT_ID,
} from "../packages/core/src/node0-deployment-remote-write-adapter.js";
import { buildDeploymentRemoteWriteObservation } from "../packages/core/src/node0-deployment-remote-write.js";
import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";

const KH = currentRemoteWriteKernelHash();
function artefact({ verdict = "NO_EXTERNAL_WRITE_PATH", evidenceClass = "OBSERVED", findings = [] } = {}) {
  return buildDeploymentRemoteWriteObservation({
    facts: { verdict, reason: null, external_write_path_present: verdict === "EXTERNAL_WRITE_PATH_PRESENT", findings, facet_counts: {} },
    evidenceClass, observedAt: "2026-08-19T00:00:00.000Z",
    executedCodeHash: KH, hash: sha256CanonicalJsonV1,
  });
}
const reader = (o) => () => JSON.stringify(o);
const enoent = () => { const e = new Error("nope"); e.code = "ENOENT"; throw e; };

describe("node0 deployment remote-write · adapter", () => {
  it("DRW-40: a clean host artefact settles the row with observed:false", () => {
    const o = remoteWriteDeploymentObservation({ readFile: reader(artefact()) });
    assert.ok(o);
    assert.equal(o.observed, false);          // required:false -> SATISFIED
    assert.equal(o.scope, "node0_deployment_remote_write");
  });

  it("DRW-41: a surface that FOUND a write path REFUTES the row with observed:true", () => {
    const o = remoteWriteDeploymentObservation({
      readFile: reader(artefact({ verdict: "EXTERNAL_WRITE_PATH_PRESENT", findings: [{ kind: "writable_root_file", path: "bizra.pdf" }] })),
    });
    assert.ok(o, "a measured exposure must be able to refute, not fall silent");
    assert.equal(o.observed, true);           // required:false -> VIOLATED
  });

  it("DRW-42: an INCOMPLETE artefact settles NOTHING — the sandbox case", () => {
    const a = artefact({ verdict: "INCOMPLETE" });
    assert.equal(remoteWriteDeploymentObservation({ readFile: reader(a) }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(a) }).state, "NOT_CLEAN_ELIGIBLE");
  });

  it("DRW-43: a missing artefact is silence, not a clean surface", () => {
    assert.equal(remoteWriteDeploymentObservation({ readFile: enoent }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: enoent }).state, "NOT_RECORDED");
    assert.equal(REMOTE_WRITE_INVARIANT_ID, "remote_write");
  });

  it("DRW-44 MUTATION CONTROL: tampered body, foreign kernel bytes, relabelled scope", () => {
    const tampered = { ...artefact(), remote_write_verdict: "NO_EXTERNAL_WRITE_PATH", findings: [{ kind: "x" }] };
    assert.equal(remoteWriteDeploymentObservation({ readFile: reader(tampered) }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(tampered) }).state, "HASH_UNVERIFIED");

    const a = artefact();
    const { observed_at: t, observation_hash: _h, ...body } = a;
    const foreign = { ...body, executed_code_hash: `sha256:${"0".repeat(64)}` };
    const forged = { ...foreign, observed_at: t, observation_hash: sha256CanonicalJsonV1(foreign) };
    assert.equal(remoteWriteDeploymentObservation({ readFile: reader(forged) }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(forged) }).state, "KERNEL_BYTES_MISMATCH");

    const relabel = { ...body, scope: "node0_runtime_kill_resume" };
    const forged2 = { ...relabel, observed_at: t, observation_hash: sha256CanonicalJsonV1(relabel) };
    assert.equal(remoteWriteDeploymentObservation({ readFile: reader(forged2) }), null);
    assert.equal(remoteWriteDeploymentDiagnostic({ readFile: reader(forged2) }).state, "SCHEMA_MISMATCH");
  });
});
