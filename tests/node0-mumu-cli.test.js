import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMumuLoop } from "../scripts/node0-mumu-loop.mjs";
import {
  buildMumuStatus,
  buildMumuVerify,
  NETWORK_MODE,
} from "../scripts/node0-mumu-cli.mjs";

// N0-MUMU-CLI-1: read-only CLI surface over the sealed Mumu closed loop.
// Dema is the face: it READS/REPORTS the loop's receipts; it never runs the
// governed runtime (that stays `npm run node0`). These builders back
// `dema node0 mumu status` and `dema node0 mumu verify`.

function freshOut() {
  return mkdtempSync(join(tmpdir(), "n0-cli-out-"));
}

// Generate a real, replay-verifiable chain by driving the sealed loop in
// deterministic test-mode against a throwaway root.
function generateChain() {
  const root = mkdtempSync(join(tmpdir(), "n0-cli-root-"));
  writeFileSync(join(root, "notes.txt"), "hello world");
  writeFileSync(join(root, "main.js"), "export const x = 1;\n");
  const out = freshOut();
  const r = runMumuLoop({
    root,
    out,
    offline: true,
    metadataOnly: true,
    testMode: true,
    autoConsentTest: true,
    consent: null,
    maxFiles: 50000,
    maxDepth: 8,
  });
  assert.equal(r.ok, true, "loop should produce a chain in test-mode");
  return { root, out };
}

describe("node0 mumu CLI — status (read-only)", () => {
  it("reports an absent chain without running anything", () => {
    const out = freshOut();
    try {
      const s = buildMumuStatus({ outDir: out });
      assert.equal(s.loop_available, true);
      assert.equal(s.chain_present, false);
      assert.equal(s.receipt_count, 0);
      assert.equal(s.boundary.read_only, true);
      assert.equal(s.boundary.runtime_execution_performed, false);
      assert.equal(s.boundary.token_minted, false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("carries the GENESIS single-node network-mode invariants", () => {
    const s = buildMumuStatus({ outDir: freshOut() });
    assert.equal(
      s.network_mode.network_mode,
      "GENESIS_SINGLE_NODE_ACTIVE_NETWORK",
    );
    assert.equal(s.network_mode.node_count, 1);
    assert.equal(s.network_mode.external_federation_active, false);
    assert.equal(s.network_mode.token_minted, false);
    assert.equal(s.network_mode.network_used, false);
  });

  it("reports a present chain after a real loop run", () => {
    const { root, out } = generateChain();
    try {
      const s = buildMumuStatus({ outDir: out });
      assert.equal(s.chain_present, true);
      assert.ok(s.receipt_count > 0);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("drift guard: NETWORK_MODE matches the loop's persisted state artifact", () => {
    const { root, out } = generateChain();
    try {
      const persisted = JSON.parse(
        readFileSync(join(out, "state", "network-mode.v0.1.json"), "utf8"),
      );
      for (const key of Object.keys(NETWORK_MODE)) {
        assert.equal(
          NETWORK_MODE[key],
          persisted[key],
          `network-mode drift on '${key}'`,
        );
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("node0 mumu CLI — verify (read-only replay)", () => {
  it("verdict ABSENT when no chain exists", () => {
    const out = freshOut();
    try {
      const v = buildMumuVerify({ outDir: out });
      assert.equal(v.chain_present, false);
      assert.equal(v.verdict, "ABSENT");
      assert.equal(v.boundary.runtime_execution_performed, false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("verdict VERIFIED on a clean chain", () => {
    const { root, out } = generateChain();
    try {
      const v = buildMumuVerify({ outDir: out });
      assert.equal(v.chain_present, true);
      assert.equal(v.verdict, "VERIFIED");
      assert.equal(v.replay.ok, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("verdict TAMPERED when the inventory artifact is corrupted", () => {
    const { root, out } = generateChain();
    try {
      writeFileSync(
        join(out, "inventory", "metadata-inventory.v0.1.json"),
        JSON.stringify({ records: [], inventory_hash: "sha256:bad" }),
      );
      const v = buildMumuVerify({ outDir: out });
      assert.equal(v.verdict, "TAMPERED");
      assert.equal(v.replay.ok, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});
