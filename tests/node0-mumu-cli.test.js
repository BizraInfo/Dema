import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runMumuLoop } from "../scripts/node0-mumu-loop.mjs";
import {
  buildMumuStatus,
  buildMumuVerify,
  buildMumuConsent,
  buildMumuJourney,
  JOURNEY_STAGES,
  NETWORK_MODE,
  defaultOutDir,
} from "../scripts/node0-mumu-cli.mjs";

// N0-MUMU-CLI-1/2: read-only CLI surface over the sealed Mumu closed loop.
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

  it("verdict TAMPERED (does not crash) when a receipt-chain line is malformed JSON", () => {
    const { root, out } = generateChain();
    try {
      const chainPath = join(out, "receipts", "receipt-chain.v0.1.jsonl");
      writeFileSync(
        chainPath,
        readFileSync(chainPath, "utf8") + "{ this is not valid json\n",
      );
      const v = buildMumuVerify({ outDir: out }); // must fail closed, not throw
      assert.equal(v.verdict, "TAMPERED");
      assert.ok(
        v.replay.tamper_detected.some((t) => t.includes("malformed")),
        `expected a malformed-line tamper signal, got ${JSON.stringify(v.replay.tamper_detected)}`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("node0 mumu CLI — default out dir", () => {
  it("prefers DEMA_HOME chain when present", () => {
    const { root, out } = generateChain();
    const demaHome = mkdtempSync(join(tmpdir(), "n0-cli-home-"));
    const homeOut = join(demaHome, "node0", "mumu");
    try {
      const prevHome = process.env.DEMA_HOME;
      const prevOut = process.env.DEMA_MUMU_OUT;
      process.env.DEMA_HOME = demaHome;
      delete process.env.DEMA_MUMU_OUT;
      cpSync(out, homeOut, { recursive: true });
      assert.equal(defaultOutDir(), resolve(homeOut));
      process.env.DEMA_HOME = prevHome;
      if (prevOut === undefined) delete process.env.DEMA_MUMU_OUT;
      else process.env.DEMA_MUMU_OUT = prevOut;
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
      rmSync(demaHome, { recursive: true, force: true });
    }
  });
});

describe("node0 mumu CLI — consent (read-only)", () => {
  it("reports no pending consent on a fresh out dir", () => {
    const out = freshOut();
    try {
      const c = buildMumuConsent({ outDir: out });
      assert.equal(c.consent_pending, false);
      assert.equal(c.loop_complete, false);
      assert.equal(c.boundary.runtime_execution_performed, false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("surfaces the exact phrase after a proposal-only run", () => {
    const root = mkdtempSync(join(tmpdir(), "n0-cli-root-"));
    const out = freshOut();
    writeFileSync(join(root, "notes.txt"), "hello");
    try {
      const proposal = runMumuLoop({
        root,
        out,
        offline: true,
        metadataOnly: true,
        testMode: true,
        autoConsentTest: false,
        consent: null,
        maxFiles: 50000,
        maxDepth: 8,
      });
      assert.equal(proposal.ok, false);
      assert.equal(proposal.error, "consent_not_granted");
      const c = buildMumuConsent({ outDir: out });
      assert.equal(c.consent_pending, true);
      assert.equal(
        c.expected_consent_phrase,
        proposal.expected_consent_phrase,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("node0 mumu CLI — journey (read-only)", () => {
  it("stage INACTIVE when no chain exists", () => {
    const out = freshOut();
    try {
      const j = buildMumuJourney({ outDir: out, operator: "Mumu" });
      assert.equal(j.stage, JOURNEY_STAGES.INACTIVE);
      assert.equal(j.activation_target, "Mumu");
      assert.equal(j.boundary.read_only, true);
      assert.ok(j.next_command.includes("npm run node0"));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("stage ACTIVE after a full consented loop", () => {
    const { root, out } = generateChain();
    try {
      const j = buildMumuJourney({ outDir: out, operator: "Mumu" });
      assert.equal(j.stage, JOURNEY_STAGES.ACTIVE);
      assert.equal(j.status_summary.verify_verdict, "VERIFIED");
      assert.equal(j.next_command, "dema realm");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("stage AWAITING_CONSENT after proposal without consent", () => {
    const root = mkdtempSync(join(tmpdir(), "n0-cli-root-"));
    const out = freshOut();
    writeFileSync(join(root, "a.txt"), "x");
    try {
      runMumuLoop({
        root,
        out,
        offline: true,
        metadataOnly: true,
        testMode: true,
        autoConsentTest: false,
        consent: null,
        maxFiles: 50000,
        maxDepth: 8,
      });
      const j = buildMumuJourney({ outDir: out });
      assert.equal(j.stage, JOURNEY_STAGES.AWAITING_CONSENT);
      assert.ok(
        j.consent?.expected_consent_phrase?.startsWith("GO: START MUMU"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});
