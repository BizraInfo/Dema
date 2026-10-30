// In-process branch coverage for node0-transition-coverage-adapter classify paths.
// Injected readFile/kernelPath — no live DEMA_HOME dependency.

import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";
import {
  buildTransitionCoverageObservation,
  NODE0_TRANSITION_COVERAGE_SCHEMA,
} from "../packages/core/src/node0-transition-coverage.js";
import {
  COVERAGE_INTEGRITY_SUSPECT_STATES,
  currentCoverageKernelHash,
  resolveDemaHome,
  transitionCoverageDiagnostic,
  transitionCoverageObservation,
} from "../packages/core/src/node0-transition-coverage-adapter.js";

const KERNEL = join(
  dirname(fileURLToPath(import.meta.url)),
  "../packages/core/src/node0-transition-coverage.js",
);
const KERNEL_HASH = currentCoverageKernelHash(KERNEL);

const CX = {
  domain_id: "authorship_identity_rotation",
  writer: "packages/receipts/src/authorship-key-store.js",
  transition: "rotateAuthorshipKey",
  classification: "AUTHORITATIVE",
  authority_source: "operator consent",
  consumers_count: 1,
  receipt_call_present: false,
  receipt_mechanism_exists_elsewhere: true,
  receipt_mechanism: "appendCanonicalReceipt",
  verified_by: "independent_source_trace",
};

function artefact(over = {}) {
  return buildTransitionCoverageObservation({
    registry: {
      unclassified_count: 0,
      authoritative_domains: 1,
      receipted_domains: 1,
    },
    counterexamples: [],
    evidenceClass: "OBSERVED",
    executedCodeHash: KERNEL_HASH,
    hash: sha256CanonicalJsonV1,
    ...over,
  });
}

function enoent() {
  const err = new Error("missing");
  err.code = "ENOENT";
  throw err;
}

function opts(readFile, extra = {}) {
  return { demaHome: "/tmp/dema-adapter-cov", kernelPath: KERNEL, readFile, ...extra };
}

test("resolveDemaHome prefers DEMA_HOME then falls back", () => {
  assert.equal(resolveDemaHome({ DEMA_HOME: "/x/home" }), "/x/home");
  assert.match(resolveDemaHome({}), /\.dema$/);
});

test("currentCoverageKernelHash returns null for missing path", () => {
  assert.equal(currentCoverageKernelHash("/no/such/kernel.js"), null);
  assert.match(KERNEL_HASH, /^sha256:[a-f0-9]{64}$/);
});

test("diagnostic · NOT_RECORDED on ENOENT", () => {
  const d = transitionCoverageDiagnostic(opts(enoent));
  assert.equal(d.state, "NOT_RECORDED");
  assert.equal(d.integrity_suspect, false);
  assert.equal(d.settles_nothing, true);
});

test("diagnostic · UNREADABLE on non-ENOENT read failure", () => {
  const d = transitionCoverageDiagnostic(
    opts(() => {
      throw new Error("EACCES");
    }),
  );
  assert.equal(d.state, "UNREADABLE");
  assert.equal(d.integrity_suspect, true);
});

test("diagnostic · UNREADABLE on bad JSON / non-object", () => {
  assert.equal(transitionCoverageDiagnostic(opts(() => "{")).state, "UNREADABLE");
  assert.equal(transitionCoverageDiagnostic(opts(() => "null")).state, "UNREADABLE");
  assert.equal(transitionCoverageDiagnostic(opts(() => "[]")).state, "UNREADABLE");
  assert.equal(transitionCoverageDiagnostic(opts(() => '"x"')).state, "UNREADABLE");
});

test("diagnostic · SCHEMA_MISMATCH", () => {
  const a = artefact();
  const bad = { ...a, schema: "wrong.schema" };
  const d = transitionCoverageDiagnostic(opts(() => JSON.stringify(bad)));
  assert.equal(d.state, "SCHEMA_MISMATCH");
  assert.ok(COVERAGE_INTEGRITY_SUSPECT_STATES.includes(d.state));
});

test("diagnostic · HASH_UNVERIFIED", () => {
  const a = artefact();
  const bad = { ...a, observation_hash: "sha256:deadbeef" };
  assert.equal(
    transitionCoverageDiagnostic(opts(() => JSON.stringify(bad))).state,
    "HASH_UNVERIFIED",
  );
});

test("diagnostic · KERNEL_BYTES_MISMATCH (hash drift + missing kernel)", () => {
  const drift = artefact({ executedCodeHash: "sha256:not-the-kernel" });
  assert.equal(
    transitionCoverageDiagnostic(opts(() => JSON.stringify(drift))).state,
    "KERNEL_BYTES_MISMATCH",
  );
  const ok = artefact();
  assert.equal(
    transitionCoverageDiagnostic(
      opts(() => JSON.stringify(ok), { kernelPath: "/no/such/kernel.js" }),
    ).state,
    "KERNEL_BYTES_MISMATCH",
  );
});

test("diagnostic · ACCEPTED carries coverage_verdict", () => {
  const a = artefact();
  const d = transitionCoverageDiagnostic(opts(() => JSON.stringify(a)));
  assert.equal(d.state, "ACCEPTED");
  assert.equal(d.coverage_verdict, "COVERAGE_SATISFIED");
  assert.equal(d.integrity_suspect, false);
});

test("observation · emits observed:true for ACCEPTED SATISFIED", () => {
  const a = artefact();
  const o = transitionCoverageObservation(opts(() => JSON.stringify(a)));
  assert.equal(o.observed, true);
  assert.match(o.source, /COVERAGE_SATISFIED/);
  assert.equal(o.scope, "node0_transition_receipt_chain");
});

test("observation · emits observed:false for ACCEPTED VIOLATED", () => {
  const a = artefact({
    counterexamples: [CX],
    registry: {
      unclassified_count: 0,
      authoritative_domains: 1,
      receipted_domains: 0,
    },
  });
  assert.equal(a.coverage_verdict, "COVERAGE_VIOLATED");
  const o = transitionCoverageObservation(opts(() => JSON.stringify(a)));
  assert.equal(o.observed, false);
  assert.match(o.source, /authorship_identity_rotation/);
});

test("observation · null when not ACCEPTED / not OBSERVED / observed null", () => {
  assert.equal(transitionCoverageObservation(opts(enoent)), null);

  const asserted = artefact({ evidenceClass: "OPERATOR_ASSERTED" });
  assert.equal(
    transitionCoverageObservation(opts(() => JSON.stringify(asserted))),
    null,
  );

  const incomplete = artefact({
    counterexamples: [],
    registry: {
      unclassified_count: 0,
      authoritative_domains: 2,
      receipted_domains: 1,
    },
  });
  assert.equal(incomplete.observed, null);
  assert.equal(
    transitionCoverageObservation(opts(() => JSON.stringify(incomplete))),
    null,
  );

  // Defensive: ACCEPTED artefact with evidence_class OBSERVED but observed neither bool.
  const weird = {
    ...artefact(),
    observed: "maybe",
  };
  // Re-stamp hash so classify accepts; observation still refuses non-bool observed.
  const { observed_at: _oa, observation_hash: _oh, ...body } = weird;
  const stamped = {
    ...body,
    observed: "maybe",
    observation_hash: sha256CanonicalJsonV1({ ...body, observed: "maybe" }),
  };
  assert.equal(stamped.schema, NODE0_TRANSITION_COVERAGE_SCHEMA);
  assert.equal(
    transitionCoverageObservation(opts(() => JSON.stringify(stamped))),
    null,
  );
});
