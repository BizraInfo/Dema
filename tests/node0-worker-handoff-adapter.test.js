// NODE0-WORKER-HANDOFF-1A — the adapter, and the wiring it completes.
//
// The kernel's own tests prove the classification. These prove the part that
// actually moves a ledger: that a recorded handoff reaches `worker_is_replaceable`
// at the right scope, and that every way of arriving there dishonestly is refused.
//
// Each test writes into its own temp DEMA_HOME. Nothing here touches ~/.dema.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";
import {
  buildWorkerHandoffObservation,
  NODE0_WORKER_HANDOFF_SCOPE,
} from "../packages/core/src/node0-worker-handoff.js";
import {
  workerHandoffObservation,
  currentKernelHash,
  WORKER_HANDOFF_INVARIANT_ID,
  HANDOFF_ARTEFACT_RELPATH,
} from "../packages/core/src/node0-worker-handoff-adapter.js";
import {
  evaluateNode0ClosureInvariants,
  CLOSURE_INVARIANTS,
  INVARIANT_STATUS,
} from "../packages/core/src/node0-closure-invariants.js";

/// A handoff artefact that is genuinely well-formed: hash re-derives, verdict is
/// HANDOFF_PROVEN, and it names the kernel bytes on disk right now.
function provenArtefact(over = {}) {
  return buildWorkerHandoffObservation({
    evidenceClass: "OBSERVED",
    executedCodeHash: currentKernelHash(),
    observedAt: "2026-08-09T00:00:00.000Z",
    predecessor: {
      worker_id: "A", pid: 11, boot_identity_hash: "boot:x", exited: true,
      checkpoint_sequence: 3, checkpoint_head_hash: "head:3", season_id: "s1",
    },
    successor: {
      worker_id: "B", pid: 12, boot_identity_hash: "boot:x",
      claim_kind: "DEAD_OWNER_TAKEOVER", predecessor_fence_status: "STALE_OWNER_FENCED",
      fencing_token: 2, predecessor_fencing_token: 1,
      resumed_sequence: 4, resumed_from_head_hash: "head:3", season_id: "s1",
    },
    hash: sha256CanonicalJsonV1,
    ...over,
  });
}

function withHome(artefact, fn) {
  const home = mkdtempSync(join(tmpdir(), "node0-handoff-adapter-"));
  try {
    if (artefact !== undefined) {
      const file = join(home, HANDOFF_ARTEFACT_RELPATH);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(artefact));
    }
    return fn(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("WHA-01 no recorded handoff is silence, not a negative observation", () => {
  // The row must stay UNKNOWN. An adapter that returned `{observed: false}` would
  // be handing the ledger a refutation it never measured.
  withHome(undefined, (home) => {
    assert.equal(workerHandoffObservation({ demaHome: home }), null);
  });
});

test("WHA-02 a recorded, proven, kernel-bound handoff settles the invariant", () => {
  // THE WIRING. Everything else in this file is a way of failing this one.
  withHome(provenArtefact(), (home) => {
    const observation = workerHandoffObservation({ demaHome: home });
    assert.ok(observation, "a valid artefact must produce an observation");
    assert.equal(observation.observed, true);

    // The scope is IMPORTED from the kernel, and must equal what the registry
    // demands. NCG-09 cannot check this adapter while it returns null, so the
    // binding is asserted here directly.
    const canon = CLOSURE_INVARIANTS.find((i) => i.id === WORKER_HANDOFF_INVARIANT_ID);
    assert.equal(observation.scope, NODE0_WORKER_HANDOFF_SCOPE);
    assert.equal(observation.scope, canon.required_scope);

    // The source binds to the recorded handoff itself, not merely to the kernel.
    assert.match(observation.source, /^NODE0-WORKER-HANDOFF-1A HANDOFF_PROVEN /);

    // And it actually moves the row it targets.
    const report = evaluateNode0ClosureInvariants({ [WORKER_HANDOFF_INVARIANT_ID]: observation });
    const row = report.invariants.find((r) => r.id === WORKER_HANDOFF_INVARIANT_ID);
    assert.equal(row.status, INVARIANT_STATUS.SATISFIED);
    assert.equal(report.node0_closed, false, "one settled row is not closure");
  });
});

test("WHA-03 an artefact edited after recording is refused", () => {
  // The most direct attack: take a real refusal and upgrade its verdict by hand.
  const forged = { ...provenArtefact({ predecessor: null, successor: null }), verdict: "HANDOFF_PROVEN" };
  withHome(forged, (home) => {
    assert.equal(workerHandoffObservation({ demaHome: home }), null);
  });
  // Editing any covered fact breaks re-derivation, not just the verdict.
  withHome({ ...provenArtefact(), checkpoint_sequence: 99 }, (home) => {
    assert.equal(workerHandoffObservation({ demaHome: home }), null);
  });
});

test("WHA-04 an injected or asserted handoff never reaches the ledger", () => {
  for (const cls of ["TEST_INJECTION", "OPERATOR_ASSERTED", "NONE"]) {
    withHome(provenArtefact({ evidenceClass: cls }), (home) => {
      assert.equal(workerHandoffObservation({ demaHome: home }), null, `${cls} must be refused`);
    });
  }
});

test("WHA-05 an artefact recorded under different kernel bytes stops counting", () => {
  // Loosen the classification rules and every artefact judged by the old ones is
  // invalidated. That is the intended direction of failure: a rule change must
  // not silently inherit the verdicts of the rules it replaced.
  withHome(provenArtefact({ executedCodeHash: "sha256:not-the-kernel" }), (home) => {
    assert.equal(workerHandoffObservation({ demaHome: home }), null);
  });
  // A missing binding is refused for the same reason.
  withHome(provenArtefact({ executedCodeHash: null }), (home) => {
    assert.equal(workerHandoffObservation({ demaHome: home }), null);
  });
});

test("WHA-06 an unproven handoff is refused even when honestly recorded", () => {
  // A real observation of a real FAILED handoff is valuable and must not settle
  // anything. Honesty about the artefact is not the same as success in it.
  withHome(provenArtefact({ predecessor: { worker_id: "A", pid: 11, exited: false, checkpoint_sequence: 3, checkpoint_head_hash: "head:3", season_id: "s1" } }), (home) => {
    assert.equal(workerHandoffObservation({ demaHome: home }), null);
  });
});

test("WHA-07 malformed, mis-schemaed and mis-scoped artefacts are refused", () => {
  for (const bad of [
    "not json at all",
    JSON.stringify({ schema: "something.else.v1" }),
    JSON.stringify({ ...provenArtefact(), schema: "bizra.dema.other.v0.1" }),
    JSON.stringify({ ...provenArtefact(), scope: "node0_bridge_readiness" }),
  ]) {
    const home = mkdtempSync(join(tmpdir(), "node0-handoff-adapter-"));
    try {
      const file = join(home, HANDOFF_ARTEFACT_RELPATH);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bad);
      assert.equal(workerHandoffObservation({ demaHome: home }), null);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  }
});
