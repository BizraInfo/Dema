import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderLiveHomebase,
  derivePhase,
  keysForPhase,
} from "../packages/core/src/live-homebase.js";

function makePreview(overrides = {}) {
  return {
    schema: "bizra.dema.homebase_v0_1.v0.1",
    header: {
      node_name: "Node0",
      date_human_gst: "Mon 25 May 2026",
      dema_version: "0.1.0-alpha.0",
      ...overrides.header,
    },
    greeting: {
      text: "Welcome to Dema.",
      has_name: false,
      ...overrides.greeting,
    },
    status: {
      ring: { label: "Ring 0 verified", ratio: 0.2, ...overrides.ring },
      mission: { label: "idle", active_count: 0, ...overrides.mission },
      gateway: {
        label: "unreachable",
        reachable: false,
        ...overrides.gateway,
      },
      memory_bar: {
        label: "0 entries",
        ratio: 0,
        entries: 0,
        ...overrides.memory,
      },
    },
    next_action: { text: null, command: null, ...overrides.next_action },
    warnings: overrides.warnings ?? [],
    ...overrides.root,
  };
}

describe("derivePhase", () => {
  it("returns first_run for fresh state", () => {
    const preview = makePreview();
    assert.equal(derivePhase(preview), "first_run");
  });

  it("returns setup_done when memory has entries", () => {
    const preview = makePreview({ memory: { entries: 3, ratio: 0.1 } });
    assert.equal(derivePhase(preview), "setup_done");
  });

  it("returns setup_done when greeting has name", () => {
    const preview = makePreview({
      greeting: { has_name: true, text: "Welcome, Mumu." },
    });
    assert.equal(derivePhase(preview), "setup_done");
  });

  it("returns active when ring ratio > 0.2", () => {
    const preview = makePreview({ ring: { ratio: 0.4 } });
    assert.equal(derivePhase(preview), "active");
  });

  it("handles null preview gracefully", () => {
    assert.equal(derivePhase(null), "first_run");
  });
});

describe("keysForPhase", () => {
  it("first_run has fewer keys", () => {
    const keys = keysForPhase("first_run");
    assert.ok(keys.length <= 4);
    assert.ok(keys.some((k) => k.key === "s"));
  });

  it("active has more keys", () => {
    const keys = keysForPhase("active");
    assert.ok(keys.length >= 6);
    assert.ok(keys.some((k) => k.key === "m"));
    assert.ok(keys.some((k) => k.key === "h"));
  });

  it("setup_done is between first_run and active", () => {
    const fr = keysForPhase("first_run");
    const sd = keysForPhase("setup_done");
    const ac = keysForPhase("active");
    assert.ok(fr.length <= sd.length);
    assert.ok(sd.length <= ac.length);
  });

  it("all phases include help key", () => {
    for (const phase of ["first_run", "setup_done", "active"]) {
      const keys = keysForPhase(phase);
      assert.ok(
        keys.some((k) => k.key === "?"),
        `${phase} missing ? key`,
      );
    }
  });

  it("each key has cmd array", () => {
    for (const phase of ["first_run", "setup_done", "active"]) {
      for (const k of keysForPhase(phase)) {
        assert.ok(Array.isArray(k.cmd), `${phase}.${k.key} missing cmd`);
        assert.ok(k.cmd.length > 0);
      }
    }
  });

  it("unknown phase falls back to active", () => {
    const keys = keysForPhase("unknown_phase");
    assert.deepEqual(keys, keysForPhase("active"));
  });
});

describe("renderLiveHomebase", () => {
  it("returns a string", () => {
    const output = renderLiveHomebase(makePreview(), { noColor: true });
    assert.ok(typeof output === "string");
  });

  it("contains DEMA header", () => {
    const output = renderLiveHomebase(makePreview(), { noColor: true });
    assert.ok(output.includes("DEMA"));
    assert.ok(output.includes("Node0"));
  });

  it("contains status rows", () => {
    const output = renderLiveHomebase(makePreview(), { noColor: true });
    assert.ok(output.includes("Ring"));
    assert.ok(output.includes("Mission"));
    assert.ok(output.includes("Gateway"));
    assert.ok(output.includes("Memory"));
  });

  it("contains key menu", () => {
    const output = renderLiveHomebase(makePreview(), { noColor: true });
    assert.ok(output.includes("[s]"));
    assert.ok(output.includes("[q]"));
  });

  it("contains boundary footer", () => {
    const output = renderLiveHomebase(makePreview(), { noColor: true });
    assert.ok(output.includes("preview-only"));
    assert.ok(output.includes("consent"));
  });

  it("shows next action when present", () => {
    const preview = makePreview({
      next_action: { text: "Run dema setup to begin.", command: "dema setup" },
    });
    const output = renderLiveHomebase(preview, { noColor: true });
    assert.ok(output.includes("Run dema setup"));
    assert.ok(output.includes("dema setup"));
  });

  it("shows warnings", () => {
    const preview = makePreview({ warnings: ["no memory directory"] });
    const output = renderLiveHomebase(preview, { noColor: true });
    assert.ok(output.includes("no memory directory"));
  });

  it("first_run phase shows fewer keys", () => {
    const preview = makePreview();
    const output = renderLiveHomebase(preview, { noColor: true });
    assert.ok(!output.includes("[m]"));
    assert.ok(!output.includes("[h]"));
  });

  it("active phase shows mission and harness keys", () => {
    const preview = makePreview({ ring: { ratio: 0.4 } });
    const output = renderLiveHomebase(preview, { noColor: true });
    assert.ok(output.includes("[m]"));
    assert.ok(output.includes("[h]"));
  });

  it("respects noColor", () => {
    const colored = renderLiveHomebase(makePreview());
    const plain = renderLiveHomebase(makePreview(), { noColor: true });
    assert.ok(!plain.includes("\x1b["));
    assert.ok(colored.includes("\x1b[") || plain === colored);
  });

  it("respects termDumb", () => {
    const output = renderLiveHomebase(makePreview(), {
      noColor: true,
      termDumb: true,
    });
    assert.ok(output.includes("+"));
    assert.ok(output.includes("-"));
    assert.ok(!output.includes("┌"));
  });

  it("respects custom width", () => {
    const narrow = renderLiveHomebase(makePreview(), {
      noColor: true,
      width: 60,
    });
    const wide = renderLiveHomebase(makePreview(), {
      noColor: true,
      width: 100,
    });
    const narrowLines = narrow.split("\n");
    const wideLines = wide.split("\n");
    assert.ok(narrowLines[0].length < wideLines[0].length);
  });

  it("box lines have consistent width", () => {
    const output = renderLiveHomebase(makePreview(), {
      noColor: true,
      width: 76,
    });
    const lines = output.split("\n");
    for (const l of lines) {
      assert.equal(l.length, 76, `Line width mismatch: "${l}"`);
    }
  });
});

describe("progressive disclosure", () => {
  it("first_run shows Setup not Status", () => {
    const keys = keysForPhase("first_run");
    const sKey = keys.find((k) => k.key === "s");
    assert.equal(sKey.label, "Setup");
    assert.deepEqual(sKey.cmd, ["setup"]);
  });

  it("setup_done shows Status not Setup", () => {
    const keys = keysForPhase("setup_done");
    const sKey = keys.find((k) => k.key === "s");
    assert.equal(sKey.label, "Status");
    assert.deepEqual(sKey.cmd, ["status"]);
  });

  it("active shows Harness key", () => {
    const keys = keysForPhase("active");
    assert.ok(keys.some((k) => k.key === "h" && k.label === "Harness"));
  });

  it("first_run does not show Mission key", () => {
    const keys = keysForPhase("first_run");
    assert.ok(!keys.some((k) => k.key === "m"));
  });
});
