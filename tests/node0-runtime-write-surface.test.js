import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";
import {
  buildRuntimeWriteSurfaceObservation,
  classifySurface,
  coverageOf,
  isDecidedRuntimeWriteSurface,
  REQUIRED_SURFACES,
  NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE,
  NODE0_RUNTIME_WRITE_SURFACE_SCHEMA,
} from "../packages/core/src/node0-runtime-write-surface.js";
import {
  remoteWriteObservation,
  runtimeWriteSurfaceDiagnostic,
  currentRuntimeWriteSurfaceKernelHash,
  RUNTIME_WRITE_SURFACE_ARTEFACT_RELPATH,
} from "../packages/core/src/node0-runtime-write-surface-adapter.js";
import { REMOTE_WRITE_OBSERVATION_SCOPE } from "../packages/core/src/node0-closure-invariants.js";

/**
 * NODE0-RUNTIME-WRITE-SURFACE-1A — `remote_write`, the tenth closure row.
 *
 * THE MISREADING THIS ENDS. `node0_deployment_remote_write` was read for a while
 * as "a Node0 already deployed on the internet", which made closure circular:
 * Node0 had to be deployed before it could close, and closed before it could
 * deploy. The guard that refused the old source scan says what a source scan
 * actually misses — "another LOCAL process writing to DEMA_HOME, a cloud-sync
 * daemon, a git remote fetched by a LOCAL action, a mounted share" — and every
 * one of those is a property of the machine the node runs on. The axis is
 * DECLARED-IN-SOURCE vs ACTUALLY-RUNNING, not local vs remote.
 *
 * WHAT THESE TESTS PROTECT. The failure mode here is not a wrong answer, it is a
 * CONFIDENT one. `ss` printing nothing because it lacked permission is
 * byte-identical to `ss` printing nothing because nothing is there. So RWS-03
 * and RWS-04 pin that an unmeasurable or unresolved surface holds the verdict at
 * UNKNOWN, and never collapses into a convenient `false`. RWS-02 pins the other
 * direction: an observed writer outranks everything, because a positive
 * observation cannot be softened by a probe that failed somewhere else.
 *
 * NO REAL HOST IS MUTATED TO MANUFACTURE A WITNESS. Every positive and negative
 * is produced from INJECTED probe results. The one end-to-end row (RWS-08) runs
 * the real producer and deliberately asserts nothing about which verdict it
 * reaches — only that it is well-formed, hash-verifiable, and leaves the observed
 * subject untouched. Asserting CLOSED there would encode a desired output, which
 * is the exact defect the closure ladder exists to refuse.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCER = join(REPO, "scripts/proof/node0-runtime-write-surface-proof.mjs");

const clear = () => ({ measured: true, writer_found: false, unresolved: [], evidence: {} });
const allClear = () => Object.fromEntries(REQUIRED_SURFACES.map((k) => [k, clear()]));

const build = (surfaces, over = {}) => buildRuntimeWriteSurfaceObservation({
  surfaces,
  subject: { node_id: "node0-test", dema_home: "/fixture/home" },
  evidenceClass: "OBSERVED",
  observedAt: "2026-08-11T00:00:00.000Z",
  executedCodeHash: currentRuntimeWriteSurfaceKernelHash(),
  hash: sha256CanonicalJsonV1,
  ...over,
});

// ── RWS-01 ────────────────────────────────────────────────────────────────
test("RWS-01: every required surface measured and clear closes the row", () => {
  const o = build(allClear());
  assert.equal(o.surface_verdict, "RUNTIME_WRITE_SURFACE_CLOSED");
  assert.equal(o.observed, false, "remote_write required:false, so false is SATISFIED");
  assert.equal(o.scope, NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE);
  assert.equal(o.schema, NODE0_RUNTIME_WRITE_SURFACE_SCHEMA);
  assert.equal(o.authority_delta, 0);
  assert.equal(o.effect_delta, 0);
  assert.deepEqual(o.coverage.unavailable, []);
  assert.deepEqual(o.coverage.unresolved, []);
  assert.equal(isDecidedRuntimeWriteSurface(o), true);
});

// ── RWS-02 ────────────────────────────────────────────────────────────────
test("RWS-02: an observed writer outranks everything, including unmeasured surfaces", () => {
  for (const id of REQUIRED_SURFACES) {
    const s = allClear();
    s[id] = { measured: true, writer_found: true, unresolved: [], evidence: {} };
    const o = build(s);
    assert.equal(o.surface_verdict, "REMOTE_WRITE_OBSERVED", `${id} writer`);
    assert.equal(o.observed, true, "a writer must score VIOLATED, not UNKNOWN");
    assert.deepEqual([...o.writers_observed], [id]);
  }
  // A writer plus a broken probe elsewhere is still a writer.
  const mixed = allClear();
  mixed.filesystem = { measured: true, writer_found: true, unresolved: [], evidence: {} };
  mixed.listener = { measured: false, reason: "probe_failed:EPERM" };
  assert.equal(build(mixed).surface_verdict, "REMOTE_WRITE_OBSERVED");
});

// ── RWS-03 ── the whole point ─────────────────────────────────────────────
test("RWS-03: an unmeasurable surface holds UNKNOWN — it never becomes false", () => {
  for (const id of REQUIRED_SURFACES) {
    const s = allClear();
    s[id] = { measured: false, reason: "probe_failed:EPERM" };
    const o = build(s);
    assert.equal(o.surface_verdict, "RUNTIME_WRITE_SURFACE_INCOMPLETE", id);
    assert.equal(o.observed, null, "absence of evidence must not become evidence of absence");
    assert.ok(o.coverage.unavailable.includes(id));
  }
  // A surface that reports no verdict at all is equally unmeasured.
  const missing = allClear();
  missing.mount = { measured: true, unresolved: [], evidence: {} };
  assert.equal(build(missing).observed, null);
});

// ── RWS-04 ────────────────────────────────────────────────────────────────
test("RWS-04: a measured-but-unresolved surface also holds UNKNOWN", () => {
  const s = allClear();
  // Exactly the real case: the socket is bound to all interfaces but its owning
  // process cannot be identified, so LISTENER -> PROCESS -> HANDLER -> DEMA_HOME
  // is broken at step two.
  s.listener = {
    measured: true, writer_found: false,
    unresolved: ["listener_process_unidentified:*:3128"], evidence: {},
  };
  const o = build(s);
  assert.equal(o.surface_verdict, "RUNTIME_WRITE_SURFACE_INCOMPLETE");
  assert.equal(o.observed, null);
  assert.ok(o.coverage.unresolved.some((u) => u.startsWith("listener:")));
  assert.ok(o.coverage.measured.includes("listener"), "it WAS measured — just not settled");
});

// ── RWS-05 ── drift guard ─────────────────────────────────────────────────
test("RWS-05: the kernel's scope constant equals the evaluator's required_scope", () => {
  assert.equal(NODE0_DEPLOYMENT_REMOTE_WRITE_SCOPE, REMOTE_WRITE_OBSERVATION_SCOPE,
    "a scope that drifts silently would make every observation unroutable");
});

// ── RWS-06 ────────────────────────────────────────────────────────────────
test("RWS-06: surface classification and coverage are exhaustive and honest", () => {
  assert.equal(classifySurface(null), "MALFORMED");
  assert.equal(classifySurface({ measured: false }), "UNMEASURED");
  assert.equal(classifySurface({ measured: true, writer_found: true }), "WRITER_OBSERVED");
  assert.equal(classifySurface({ measured: true, writer_found: false, unresolved: [] }), "CLEAR");
  assert.equal(classifySurface({ measured: true, writer_found: false, unresolved: ["x"] }), "UNRESOLVED");
  // A writer is reported even when the probe never set `measured` — a positive
  // observation must not be discarded on a technicality.
  assert.equal(classifySurface({ writer_found: true }), "WRITER_OBSERVED");

  const cov = coverageOf({ ...allClear(), mount: { measured: false, reason: "x" } });
  assert.ok(cov.unavailable.includes("mount"));
  assert.equal(cov.measured.length, REQUIRED_SURFACES.length - 1);
});

// ── RWS-07 ── adapter ─────────────────────────────────────────────────────
test("RWS-07: the adapter refuses tampered artefacts and sources nothing when undecided", () => {
  const home = mkdtempSync(join(tmpdir(), "rws-"));
  const write = (o) => {
    const p = join(home, RUNTIME_WRITE_SURFACE_ARTEFACT_RELPATH);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(o, null, 2));
  };
  try {
    write(build(allClear()));
    assert.equal(remoteWriteObservation({ demaHome: home })?.observed, false,
      "control: an honest CLOSED artefact IS accepted");

    // An INCOMPLETE verdict must source nothing at all.
    const s = allClear();
    s.listener = { measured: false, reason: "probe_failed:EPERM" };
    write(build(s));
    assert.equal(remoteWriteObservation({ demaHome: home }), null,
      "an undecided surface must contribute silence, not false");
    assert.equal(runtimeWriteSurfaceDiagnostic({ demaHome: home }).settles_nothing, true);

    const good = build(allClear());
    write({ ...good, observed: false, surface_verdict: "RUNTIME_WRITE_SURFACE_CLOSED", coverage: { measured: [], unavailable: [], unresolved: [] } });
    assert.equal(remoteWriteObservation({ demaHome: home }), null, "edited body fails the hash");
    assert.equal(runtimeWriteSurfaceDiagnostic({ demaHome: home }).state, "HASH_UNVERIFIED");

    write({ ...good, schema: "other.v9" });
    assert.equal(runtimeWriteSurfaceDiagnostic({ demaHome: home }).state, "SCHEMA_MISMATCH");

    write(build(allClear(), { executedCodeHash: `sha256:${"0".repeat(64)}` }));
    const stale = runtimeWriteSurfaceDiagnostic({ demaHome: home });
    assert.equal(stale.state, "KERNEL_BYTES_MISMATCH");
    assert.equal(stale.integrity_suspect, true);

    rmSync(join(home, "node0"), { recursive: true, force: true });
    assert.equal(runtimeWriteSurfaceDiagnostic({ demaHome: home }).state, "NOT_RECORDED");
    assert.equal(runtimeWriteSurfaceDiagnostic({ demaHome: home }).integrity_suspect, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

// ── RWS-08 ── end to end, verdict-agnostic ────────────────────────────────
test("RWS-08: the real producer observes a subject read-only and never writes to it", () => {
  const subject = mkdtempSync(join(tmpdir(), "rws-subject-"));
  const dest = mkdtempSync(join(tmpdir(), "rws-dest-"));
  const before = readdirSync(subject);
  try {
    let out;
    try {
      out = execFileSync("node", [PRODUCER, "--dema-home", dest, "--subject-home", subject, "--json"],
        { cwd: REPO, encoding: "utf8", timeout: 60_000 });
    } catch (e) {
      // Exit 1 is a legitimate outcome: it means the verdict was UNDECIDED.
      out = e.stdout ?? "";
    }
    const report = JSON.parse(out.trim());

    // Deliberately NOT asserting which verdict. Asserting CLOSED here would
    // encode a desired output and would depend on the privileges of whoever runs
    // the suite — the exact shape of a false GREEN.
    assert.ok(["RUNTIME_WRITE_SURFACE_CLOSED", "REMOTE_WRITE_OBSERVED",
               "RUNTIME_WRITE_SURFACE_INCOMPLETE"].includes(report.surface_verdict),
      report.surface_verdict);
    assert.equal(report.coverage.measured.length + report.coverage.unavailable.length,
      REQUIRED_SURFACES.length, "every required surface must be accounted for");

    // THE AUTHORIZATION BOUNDARY: the observed subject is untouched.
    assert.deepEqual(readdirSync(subject), before,
      "observing a home must never write into it");
    assert.equal(existsSync(join(dest, RUNTIME_WRITE_SURFACE_ARTEFACT_RELPATH)), true);

    // Whatever it decided, the artefact must be internally verifiable.
    const artefact = JSON.parse(readFileSync(join(dest, RUNTIME_WRITE_SURFACE_ARTEFACT_RELPATH), "utf8"));
    assert.equal(artefact.subject.dema_home, subject, "the verdict must name what it observed");
    assert.equal(runtimeWriteSurfaceDiagnostic({ demaHome: dest }).state, "ACCEPTED");
  } finally {
    rmSync(subject, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

// ── RWS-09 ── negative-control integrity ──────────────────────────────────
test("RWS-09: a kernel that never closes would fail RWS-01 — one path must reach CLOSED", () => {
  // Every rejection above is satisfied by an implementation that returns
  // INCOMPLETE for everything. This is the row that proves it does not.
  const o = build(allClear());
  assert.equal(o.observed, false);
  assert.equal(remoteWriteObservationFromArtefact(o), false);

  function remoteWriteObservationFromArtefact(art) {
    const home = mkdtempSync(join(tmpdir(), "rws9-"));
    try {
      const p = join(home, RUNTIME_WRITE_SURFACE_ARTEFACT_RELPATH);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify(art));
      return remoteWriteObservation({ demaHome: home })?.observed;
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  }
});
