// EVENT-WITNESS SEMANTICS GUARD — a copy-propagation defect earns a check.
//
// Three observation kernels carried the same false rationale for excluding
// `observed_at`: that two identical observations recorded years apart "must bind
// to the same witness". Measured 2026-08-10, that cannot happen — run identity
// (pid, boot identity, fencing state) is inside the digest by design, so two
// executions of the same experiment hash differently while demonstrating the
// same invariant.
//
// The sentence spread by copy, so this guards against it spreading again. It
// asserts a DOCUMENTED SEMANTIC, not behaviour: no hash, schema or adapter is
// touched by this file.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const OBSERVATION_KERNELS = [
  "packages/core/src/node0-worker-handoff.js",
  "packages/core/src/node0-runtime-mission-observation.js",
  "packages/core/src/node0-recovery-observation.js",
];

// The retired claim, in the shapes it actually appeared in.
const FALSE_RATIONALE = /recorded years apart\s+\*?\s*(must )?bind to the same witness/;

test("no observation kernel claims separate executions bind to the same witness", () => {
  const offenders = OBSERVATION_KERNELS.filter((p) =>
    FALSE_RATIONALE.test(readFileSync(p, "utf8").replace(/\s+/g, " ")),
  );
  assert.deepEqual(offenders, [], "the retired property-witness rationale has returned");
});

test("control: the matcher would still catch the retired sentence", () => {
  // Without this, the empty result above could come from a regex that matches
  // nothing at all — which is how a guard quietly stops guarding.
  const retired = "the digest excludes observed_at: two identical observations recorded years apart must bind to the same witness.";
  assert.equal(FALSE_RATIONALE.test(retired.replace(/\s+/g, " ")), true);
});

// Comment prose wraps, so a phrase like "Run identity" exists on disk as
// "Run\n * identity". Normalise the leading asterisks and whitespace before
// matching, or the check silently fails on formatting rather than on meaning.
const prose = (p) => readFileSync(p, "utf8").replace(/^\s*\*/gm, " ").replace(/\s+/g, " ");

test("each observation kernel states event-witness semantics explicitly", () => {
  for (const p of OBSERVATION_KERNELS) {
    const text = prose(p);
    assert.match(text, /EVENT-WITNESS HASH SEMANTICS/, `${p} must name the semantics it implements`);
    assert.match(text, /Run identity .{0,120}load-bearing/, `${p} must say run identity is deliberate`);
    assert.match(text, /CORRECTED 2026-08-10/, `${p} must record what it previously claimed`);
  }
});
