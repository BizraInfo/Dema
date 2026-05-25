import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildWitnessAttestation,
  saveWitnessReceipt,
  formatWitnessReceipt,
  WITNESS_CONSENT_PHRASE,
} from "../packages/receipts/src/witness-receipt.js";

const FIXED_NOW = new Date("2026-05-25T18:00:00Z");

async function freshHome() {
  const home = await mkdtemp(join(tmpdir(), "dema-witness-test-"));
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  const { runSetup } = await import("../packages/installer/src/setup.js");
  await runSetup(home);
  return {
    home,
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

describe("buildWitnessAttestation", () => {
  it("returns correct schema and truth label", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      assert.equal(att.schema, "bizra.dema.node0_witness_receipt.v0.1");
      assert.equal(att.truth_label, "LOCAL_OPERATOR_WITNESS");
    } finally {
      restore();
    }
  });

  it("attests Node0 with N=1", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      assert.equal(att.attests.node, "Node0");
      assert.equal(att.attests.connected_nodes, 1);
    } finally {
      restore();
    }
  });

  it("attests PAT-7 and SAT-5", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      assert.equal(att.attests.pat_count, 7);
      assert.equal(att.attests.sat_count, 5);
    } finally {
      restore();
    }
  });

  it("attests no federation, no token, no model, no public network", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      assert.equal(att.attests.federation, false);
      assert.equal(att.attests.token_claim, false);
      assert.equal(att.attests.model_invocation, false);
      assert.equal(att.attests.public_network, false);
    } finally {
      restore();
    }
  });

  it("has sha256 content hash", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      assert.match(att.content_hash, /^[a-f0-9]{64}$/);
    } finally {
      restore();
    }
  });

  it("content hash is deterministic", async () => {
    const { home, restore } = await freshHome();
    try {
      const a = await buildWitnessAttestation({ now: FIXED_NOW });
      const b = await buildWitnessAttestation({ now: FIXED_NOW });
      assert.equal(a.content_hash, b.content_hash);
    } finally {
      restore();
    }
  });

  it("boundary is all false in preview mode", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      for (const [key, value] of Object.entries(att.boundary)) {
        assert.equal(value, false, `boundary.${key} should be false`);
      }
    } finally {
      restore();
    }
  });

  it("attests harness verdict", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      assert.ok(["CLEAN", "REVIEW"].includes(att.attests.harness_verdict));
    } finally {
      restore();
    }
  });

  it("attests setup integrity", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      assert.equal(att.attests.setup_integrity, "INTACT");
    } finally {
      restore();
    }
  });

  it("attests epistemic ground", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      assert.equal(att.attests.epistemic_ground, "topology_canon");
    } finally {
      restore();
    }
  });
});

describe("saveWitnessReceipt", () => {
  it("requires exact consent phrase", async () => {
    const { home, restore } = await freshHome();
    try {
      const result = await saveWitnessReceipt({
        consent: "wrong",
        now: FIXED_NOW,
      });
      assert.equal(result.saved, false);
      assert.equal(result.reason, "consent_phrase_mismatch");
      assert.equal(result.required_phrase, WITNESS_CONSENT_PHRASE);
    } finally {
      restore();
    }
  });

  it("dry-run does not write", async () => {
    const { home, restore } = await freshHome();
    try {
      const result = await saveWitnessReceipt({
        consent: WITNESS_CONSENT_PHRASE,
        dryRun: true,
        now: FIXED_NOW,
      });
      assert.equal(result.saved, false);
      assert.equal(result.reason, "dry_run");
      const files = await readdir(join(home, "receipts"));
      assert.ok(!files.some((f) => f.startsWith("witness-")));
    } finally {
      restore();
    }
  });

  it("saves with correct consent", async () => {
    const { home, restore } = await freshHome();
    try {
      const result = await saveWitnessReceipt({
        consent: WITNESS_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      assert.equal(result.saved, true);
      assert.equal(result.reason, "consent_verified");
      assert.ok(result.path.includes("witness-"));
      assert.match(result.file_hash, /^[a-f0-9]{64}$/);
    } finally {
      restore();
    }
  });

  it("saved file is valid JSON matching schema", async () => {
    const { home, restore } = await freshHome();
    try {
      const result = await saveWitnessReceipt({
        consent: WITNESS_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const content = await readFile(result.path, "utf8");
      const parsed = JSON.parse(content);
      assert.equal(parsed.schema, "bizra.dema.node0_witness_receipt.v0.1");
      assert.equal(parsed.truth_label, "LOCAL_OPERATOR_WITNESS");
    } finally {
      restore();
    }
  });

  it("saved receipt has consent_collected=true and filesystem_write=true", async () => {
    const { home, restore } = await freshHome();
    try {
      const result = await saveWitnessReceipt({
        consent: WITNESS_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const content = JSON.parse(await readFile(result.path, "utf8"));
      assert.equal(content.boundary.consent_collected, true);
      assert.equal(content.boundary.filesystem_write_performed, true);
      assert.equal(content.boundary.federation_invoked, false);
      assert.equal(content.boundary.public_network_used, false);
    } finally {
      restore();
    }
  });
});

describe("formatWitnessReceipt", () => {
  it("returns a string with header", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      const text = formatWitnessReceipt(att);
      assert.ok(text.includes("NODE0 SELF-WITNESS"));
      assert.ok(text.includes("LOCAL_OPERATOR_WITNESS"));
    } finally {
      restore();
    }
  });

  it("shows attests fields", async () => {
    const { home, restore } = await freshHome();
    try {
      const att = await buildWitnessAttestation({ now: FIXED_NOW });
      const text = formatWitnessReceipt(att);
      assert.ok(text.includes("node: Node0"));
      assert.ok(text.includes("pat_count: 7"));
      assert.ok(text.includes("federation: false"));
    } finally {
      restore();
    }
  });

  it("shows saved path when saved", async () => {
    const { home, restore } = await freshHome();
    try {
      const result = await saveWitnessReceipt({
        consent: WITNESS_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const text = formatWitnessReceipt(result);
      assert.ok(text.includes("Saved to:"));
    } finally {
      restore();
    }
  });

  it("shows consent hint when not saved", async () => {
    const { home, restore } = await freshHome();
    try {
      const result = await saveWitnessReceipt({
        consent: "wrong",
        now: FIXED_NOW,
      });
      const text = formatWitnessReceipt(result);
      assert.ok(text.includes("Consent required"));
    } finally {
      restore();
    }
  });
});

describe("WITNESS_CONSENT_PHRASE", () => {
  it("is exported and non-empty", () => {
    assert.equal(typeof WITNESS_CONSENT_PHRASE, "string");
    assert.ok(WITNESS_CONSENT_PHRASE.length > 5);
  });
});
