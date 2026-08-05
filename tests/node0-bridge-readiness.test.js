// NODE0-BRIDGE-READINESS-1A — the proof contract for a genuinely observed node.
//
// Before this slice, `buildHealthSnapshot` judged a hardcoded `defaultStatus()`
// literal. Nothing observed Node0, so "no runtime is bridged" and "the runtime
// is healthy" produced the same three doctor failures, and `CLEAN` — the only
// verdict an endurance sample counts as healthy — was unreachable by
// construction. A 24h soak could only ever spell DEGRADED.
//
// Operator ruling (2026-08-05): a HEALTHY endurance result MUST require a
// genuinely bridged Node0. An unbridged preview install must never be softened
// into CLEAN to make the soak pass. These tests encode that ruling, including
// the tests that must FAIL if anyone later tries to manufacture health.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildHealthSnapshot } from "../packages/mission/src/health-snapshot.js";
import { runSetup } from "../packages/installer/src/setup.js";
import {
  saveWitnessReceipt,
  WITNESS_CONSENT_PHRASE,
} from "../packages/receipts/src/witness-receipt.js";
import {
  findLatestWitness,
  verifyWitnessReceipt,
} from "../packages/receipts/src/witness-verify.js";
import { takeSample, HEALTHY_MISSION_VERDICT } from "../apps/cli/src/commands/node0-run.js";

const FIXED_NOW = new Date("2026-08-05T12:00:00Z");

// A status payload shaped like what a real bridged runtime reports through the
// adapter. Built explicitly rather than by mutating defaultStatus(), so a future
// change to the preview default cannot silently make this fixture "bridged".
function bridgedStatus(overrides = {}) {
  return {
    schema: "bizra.dema.status.v0.1",
    node: "Node0",
    human: null,
    ready: true,
    consoleReady: true,
    activationGate: "EXPLICIT_GO_REQUIRED",
    daemonStatus: "unknown",
    missionExecuted: false,
    runtimePulse: { fired: false },
    findings: [],
    model: { connected: false, loadedModelIds: [], tokenPresent: false },
    rustBus: { ready: false },
    proof: { nextArtifact: "ARTIFACT-011" },
    nextAdmissibleAction: "bounded_diagnostic_activation",
    gateway: { reachable: true },
    adapter: { available: true, source: "gateway-http" },
    ...overrides,
  };
}

function unbridgedStatus(overrides = {}) {
  return {
    ...bridgedStatus(),
    ready: false,
    consoleReady: false,
    activationGate: "BLOCKED",
    gateway: undefined,
    adapter: { available: false, source: "legacy-shellout-unavailable" },
    ...overrides,
  };
}

// A home with setup INTACT and a real, independently verified witness — every
// non-bridge precondition for CLEAN satisfied, so each test isolates the bridge.
async function witnessedHome() {
  const home = await mkdtemp(join(tmpdir(), "dema-bridge-readiness-"));
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await runSetup(home);
  await saveWitnessReceipt({ consent: WITNESS_CONSENT_PHRASE, now: FIXED_NOW });
  return {
    home,
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

describe("NODE0-BRIDGE-READINESS-1A", () => {
  it("BR-01 judges observed runtime status, not a hardcoded literal (AC1/AC4)", async () => {
    const { home, restore } = await witnessedHome();
    try {
      const bridged = await buildHealthSnapshot({
        now: FIXED_NOW,
        demaHome: home,
        statusFn: async () => bridgedStatus(),
      });
      const unbridged = await buildHealthSnapshot({
        now: FIXED_NOW,
        demaHome: home,
        statusFn: async () => unbridgedStatus(),
      });
      // Same home, same everything else — only the observation differs. If the
      // doctor tally is identical, nothing is being observed.
      assert.equal(bridged.attests.results.doctor.fail, 0);
      assert.notDeepEqual(
        bridged.attests.results.doctor,
        unbridged.attests.results.doctor,
        "doctor predicates must track the observed status",
      );
    } finally {
      restore();
    }
  });

  it("BR-02 fails closed when the adapter throws (AC1)", async () => {
    const { home, restore } = await witnessedHome();
    try {
      const snap = await buildHealthSnapshot({
        now: FIXED_NOW,
        demaHome: home,
        statusFn: async () => {
          throw new Error("gateway exploded");
        },
      });
      assert.equal(snap.attests.results.bridge.available, false);
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      restore();
    }
  });

  it("BR-03 fails closed when the adapter returns a non-object (AC1)", async () => {
    const { home, restore } = await witnessedHome();
    try {
      for (const bad of [null, undefined, "CLEAN", 42]) {
        const snap = await buildHealthSnapshot({
          now: FIXED_NOW,
          demaHome: home,
          statusFn: async () => bad,
        });
        assert.equal(snap.attests.results.bridge.available, false, `bad=${bad}`);
        assert.notEqual(snap.attests.mission_verdict, "CLEAN", `bad=${bad}`);
      }
    } finally {
      restore();
    }
  });

  it("BR-04 availability alone must not grant activation (AC2)", async () => {
    const { home, restore } = await witnessedHome();
    try {
      // Reachable adapter, but the runtime still reports BLOCKED. Being able to
      // see the node is not the node authorizing anything.
      const snap = await buildHealthSnapshot({
        now: FIXED_NOW,
        demaHome: home,
        statusFn: async () => bridgedStatus({ activationGate: "BLOCKED" }),
      });
      assert.equal(snap.attests.results.bridge.available, true);
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      restore();
    }
  });

  it("BR-05 reports the observed gate verbatim, never synthesizing one (AC2)", async () => {
    const { home, restore } = await witnessedHome();
    try {
      for (const gate of ["BLOCKED", "EXPLICIT_GO_REQUIRED", "SOMETHING_NEW"]) {
        const snap = await buildHealthSnapshot({
          now: FIXED_NOW,
          demaHome: home,
          statusFn: async () => bridgedStatus({ activationGate: gate }),
        });
        assert.equal(snap.attests.results.bridge.activation_gate, gate);
      }
    } finally {
      restore();
    }
  });

  it("BR-06 an unbridged install with everything else perfect stays ATTENTION (AC5)", async () => {
    const { home, restore } = await witnessedHome();
    try {
      const snap = await buildHealthSnapshot({
        now: FIXED_NOW,
        demaHome: home,
        statusFn: async () => unbridgedStatus(),
      });
      // The three readiness predicates soften to `expected` here — neither fail
      // nor warn — so doctorAllOk is TRUE. Setup is INTACT, harness CLEAN, the
      // witness VERIFIED. Every legacy precondition for CLEAN is met. This is
      // the exact hole the ruling closes: without a bridge requirement, "nothing
      // is observing Node0" would mint CLEAN and a soak would report HEALTHY.
      assert.equal(snap.attests.results.doctor.fail, 0);
      assert.equal(snap.attests.results.doctor.warn, 0);
      assert.equal(snap.attests.results.witness.verdict, "VERIFIED");
      assert.equal(snap.attests.results.bridge.available, false);
      assert.equal(snap.attests.mission_verdict, "ATTENTION");
    } finally {
      restore();
    }
  });

  // SUPERSEDED BY CORRECTION-1B (operator order, 2026-08-06). This asserted
  // that a favourable INJECTED status reaches CLEAN. Under the corrected
  // contract an injected status is TEST_INJECTION — it can exercise
  // composition and can never prove bridge readiness — so the same fixture
  // must now be REFUSED. The bridge fields it did assert remain pinned.
  it("BR-07 an injected status is bridged-shaped and still cannot reach CLEAN", async () => {
    const { home, restore } = await witnessedHome();
    try {
      const snap = await buildHealthSnapshot({
        now: FIXED_NOW,
        demaHome: home,
        statusFn: async () => bridgedStatus(),
      });
      assert.equal(snap.attests.results.bridge.available, true);
      assert.equal(
        snap.attests.results.bridge.activation_gate,
        "EXPLICIT_GO_REQUIRED",
      );
      assert.equal(snap.attests.evidence_class, "TEST_INJECTION");
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      restore();
    }
  });

  it("BR-08 a bridged node without a verified witness is not CLEAN (AC6)", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-bridge-nowitness-"));
    const old = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;
    try {
      await runSetup(home); // setup INTACT, but no witness saved
      const snap = await buildHealthSnapshot({
        now: FIXED_NOW,
        demaHome: home,
        statusFn: async () => bridgedStatus(),
      });
      assert.equal(snap.attests.results.witness.exists, false);
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    }
  });

  it("BR-09 the produced witness independently verifies (AC3)", async () => {
    const { home, restore } = await witnessedHome();
    try {
      // Verified through the standalone verifier, not through the snapshot's own
      // report — a component must not be the sole witness to its own validity.
      const path = await findLatestWitness(home);
      assert.ok(path, "a witness receipt must exist on disk");
      const v = await verifyWitnessReceipt(path);
      assert.equal(v.verdict, "VERIFIED");
      assert.equal(v.checks_failing, 0);
    } finally {
      restore();
    }
  });

  it("BR-10 defaults to real adapter observation with no injection (AC1)", async () => {
    const { home, restore } = await witnessedHome();
    try {
      // No statusFn: this environment has no bridge configured, so the default
      // path must observe that and refuse CLEAN — not throw, and not assume.
      const snap = await buildHealthSnapshot({ now: FIXED_NOW, demaHome: home });
      assert.equal(typeof snap.attests.results.bridge.available, "boolean");
      assert.equal(snap.attests.results.bridge.available, false);
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      restore();
    }
  });

  it("BR-11 a bridged node with an unreachable gateway warns, so not CLEAN", async () => {
    const { home, restore } = await witnessedHome();
    try {
      const snap = await buildHealthSnapshot({
        now: FIXED_NOW,
        demaHome: home,
        statusFn: async () => bridgedStatus({ gateway: { reachable: false } }),
      });
      assert.equal(snap.attests.results.doctor.warn, 1);
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      restore();
    }
  });

  it("BR-12 closes the loop: only a bridged snapshot yields an ok endurance sample", async () => {
    const { home, restore } = await witnessedHome();
    try {
      assert.equal(HEALTHY_MISSION_VERDICT, "CLEAN");

      const bridged = await takeSample({
        at: FIXED_NOW,
        demaHome: home,
        snapshotFn: (args) =>
          buildHealthSnapshot({ ...args, statusFn: async () => bridgedStatus() }),
      });
      // SUPERSEDED BY CORRECTION-1B: an injected status is TEST_INJECTION, so
      // even a bridged-SHAPED one can no longer mint a healthy sample. The loop
      // still closes — it now closes on refusal, which is the safer direction.
      assert.notEqual(bridged.mission_verdict, "CLEAN");
      assert.equal(bridged.ok, false, "an injected status must never sample healthy");

      const unbridged = await takeSample({
        at: FIXED_NOW,
        demaHome: home,
        snapshotFn: (args) =>
          buildHealthSnapshot({ ...args, statusFn: async () => unbridgedStatus() }),
      });
      assert.equal(unbridged.mission_verdict, "ATTENTION");
      assert.equal(unbridged.ok, false, "an unbridged node must never sample healthy");
    } finally {
      restore();
    }
  });

  // BR-01..BR-12 all inject `statusFn`, which bypasses createNode0Adapter AND
  // normalizeNode0Status. That leaves the real seam — raw snake_case runtime
  // JSON translated into the status shape this verdict reads — proven by
  // nothing. These three drive the DEFAULT path with no injection at all.
  // They exercise the wiring; they do not claim any node is bridged.
  async function statusCommand(home, raw, tag) {
    const p = join(home, `status-${tag}.sh`);
    await writeFile(p, `#!/bin/bash\ncat <<'EOF'\n${raw}\nEOF\n`);
    await chmod(p, 0o755);
    return p;
  }

  // The runtime's own contract is snake_case; the fixtures below are deliberately
  // written in it, so a rename in normalizeNode0Status breaks these tests rather
  // than silently downgrading every real node to unbridged.
  async function snapshotViaRealAdapter(home, raw, tag) {
    const old = process.env.DEMA_NODE0_STATUS_COMMAND;
    try {
      if (raw === null) delete process.env.DEMA_NODE0_STATUS_COMMAND;
      else process.env.DEMA_NODE0_STATUS_COMMAND = await statusCommand(home, raw, tag);
      return await buildHealthSnapshot({ now: FIXED_NOW, demaHome: home });
    } finally {
      if (old === undefined) delete process.env.DEMA_NODE0_STATUS_COMMAND;
      else process.env.DEMA_NODE0_STATUS_COMMAND = old;
    }
  }

  it("BR-13 real adapter: a bridged runtime reaches CLEAN with no injection", async () => {
    const { home, restore } = await witnessedHome();
    try {
      const snap = await snapshotViaRealAdapter(
        home,
        JSON.stringify({
          activation_gate: "EXPLICIT_GO_REQUIRED",
          ready: true,
          console_ready: true,
          daemon_status: "unknown",
        }),
        "bridged",
      );
      // SUPERSEDED BY CORRECTION-1B: the legacy adapter is an operator-owned
      // shell-out, so favourable JSON from an arbitrary script is
      // OPERATOR_ASSERTED_STATUS — real, useful for diagnostics, and never
      // proof of runtime identity. Translation and wiring are still pinned;
      // CLEAN is now refused.
      assert.equal(snap.attests.results.bridge.available, true);
      assert.equal(snap.attests.results.bridge.activation_gate, "EXPLICIT_GO_REQUIRED");
      assert.equal(snap.attests.results.doctor.fail, 0);
      assert.equal(snap.attests.evidence_class, "OPERATOR_ASSERTED");
      assert.equal(
        snap.attests.results.observation.verdict,
        "OPERATOR_ASSERTED_STATUS",
      );
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      restore();
    }
  });

  it("BR-14 real adapter: a reachable runtime reporting BLOCKED is not CLEAN", async () => {
    const { home, restore } = await witnessedHome();
    try {
      // AC2 through the real seam: the adapter answered, so the node is visible
      // — and it is still not authorized. A bridged node reporting not-ready
      // yields genuine `fail` predicates rather than the unbridged softening,
      // which is correct: there is something there, and it is not ready.
      const snap = await snapshotViaRealAdapter(
        home,
        JSON.stringify({ activation_gate: "BLOCKED", ready: false, console_ready: false }),
        "blocked",
      );
      assert.equal(snap.attests.results.bridge.available, true);
      assert.equal(snap.attests.results.bridge.activation_gate, "BLOCKED");
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      restore();
    }
  });

  // The receipt must not lie about its own effects. Wiring the adapter gave
  // this mission the power to spawn a child process or open a local connection,
  // while the attested boundary still said it had done neither. A receipt that
  // under-reports its own effect is worse than no receipt: it is evidence
  // pointing the wrong way.
  it("BR-16 a shellout observation attests the tool it actually executed", async () => {
    const { home, restore } = await witnessedHome();
    try {
      const snap = await snapshotViaRealAdapter(
        home,
        JSON.stringify({ activation_gate: "EXPLICIT_GO_REQUIRED", ready: true, console_ready: true }),
        "effects",
      );
      const b = snap.attests.boundary;
      assert.equal(snap.attests.results.bridge.source, "legacy-shellout");
      assert.equal(b.tool_executed, true, "a child process was executed");
      assert.equal(b.child_process_invoked, true);
      assert.equal(b.runtime_execution_performed, true);
      assert.equal(b.external_call_performed, true);
      assert.equal(b.network_used, false, "the shellout path uses no network");
      // CORRECTION-1B: a shell-out talks to a COMMAND. It is not provably a
      // connection to the node, so this must be false until independently
      // proven — my 1A version asserted true, which over-claimed the link.
      assert.equal(b.node_connection_performed, false);
      assert.equal(b.local_loopback_used, false);
      // The verifier requires this to stay false, and it is true: the bridge is
      // a local runtime, never an external provider (rules/01-dema-boundary).
      assert.equal(b.public_network_used, false);
    } finally {
      restore();
    }
  });

  it("BR-17 an observation that executed nothing attests nothing", async () => {
    const { home, restore } = await witnessedHome();
    try {
      const snap = await snapshotViaRealAdapter(home, null, "noeffect");
      const b = snap.attests.boundary;
      assert.equal(
        snap.attests.results.bridge.reason,
        "legacy_status_command_not_configured",
      );
      for (const k of [
        "tool_executed",
        "runtime_execution_performed",
        "node_connection_performed",
        "external_call_performed",
        "network_used",
      ]) {
        assert.equal(b[k], false, `${k} must be false when nothing ran`);
      }
    } finally {
      restore();
    }
  });

  it("BR-18 an adapter that threw still attests the attempt, never silence", async () => {
    const { home, restore } = await witnessedHome();
    try {
      // Fail-open on DISCLOSURE: we cannot prove the adapter died before it
      // spawned, so the effect is declared. Over-reporting an effect is
      // conservative; under-reporting one is a false boundary.
      const snap = await buildHealthSnapshot({
        now: FIXED_NOW,
        demaHome: home,
        statusFn: async () => {
          throw new Error("died mid-spawn");
        },
      });
      // CORRECTION-1B: with a typed observation the class is NONE — the adapter
      // never produced an observation at all — so the honest disclosure is that
      // nothing was observed, and the verdict is refused on the observation
      // rather than on a guessed effect.
      assert.equal(snap.attests.results.bridge.available, false);
      // The SOURCE was an injection, so that is what the receipt says — the
      // class describes where the status came from, not how well it went. The
      // observation separately records that nothing was configured to observe.
      assert.equal(snap.attests.evidence_class, "TEST_INJECTION");
      assert.equal(snap.attests.results.observation.verdict, "UNCONFIGURED");
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      restore();
    }
  });

  it("BR-15 real adapter: no status command configured is unbridged, not healthy", async () => {
    const { home, restore } = await witnessedHome();
    try {
      const snap = await snapshotViaRealAdapter(home, null, "none");
      assert.equal(snap.attests.results.bridge.available, false);
      assert.equal(
        snap.attests.results.bridge.reason,
        "legacy_status_command_not_configured",
      );
      assert.notEqual(snap.attests.mission_verdict, "CLEAN");
    } finally {
      restore();
    }
  });
});
