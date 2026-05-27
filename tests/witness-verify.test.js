import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  verifyWitnessReceipt,
  findLatestWitness,
  formatWitnessVerification,
} from "../packages/receipts/src/witness-verify.js";
import {
  saveWitnessReceipt,
  WITNESS_CONSENT_PHRASE,
} from "../packages/receipts/src/witness-receipt.js";
import { runSetup } from "../packages/installer/src/setup.js";

const FIXED_NOW = new Date("2026-05-25T20:00:00Z");

async function freshHomeWithWitness() {
  const home = await mkdtemp(join(tmpdir(), "dema-vfy-test-"));
  const old = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;
  await runSetup(home);
  const receipt = await saveWitnessReceipt({
    consent: WITNESS_CONSENT_PHRASE,
    now: FIXED_NOW,
  });
  return {
    home,
    receipt,
    restore: () => {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    },
  };
}

describe("verifyWitnessReceipt", () => {
  it("VERIFIED on valid receipt", async () => {
    const { receipt, restore } = await freshHomeWithWitness();
    try {
      const result = await verifyWitnessReceipt(receipt.path);
      assert.equal(result.schema, "bizra.dema.witness_verification.v0.1");
      assert.equal(result.verdict, "VERIFIED");
      assert.equal(result.checks_failing, 0);
    } finally {
      restore();
    }
  });

  it("all checks pass on valid receipt", async () => {
    const { receipt, restore } = await freshHomeWithWitness();
    try {
      const result = await verifyWitnessReceipt(receipt.path);
      for (const c of result.checks) {
        assert.equal(c.pass, true, `${c.check} should pass`);
      }
    } finally {
      restore();
    }
  });

  it("content_hash_integrity confirms tamper-evidence", async () => {
    const { receipt, restore } = await freshHomeWithWitness();
    try {
      const result = await verifyWitnessReceipt(receipt.path);
      const hashCheck = result.checks.find(
        (c) => c.check === "content_hash_integrity",
      );
      assert.ok(hashCheck);
      assert.equal(hashCheck.pass, true);
      assert.equal(hashCheck.expected, hashCheck.recomputed);
    } finally {
      restore();
    }
  });

  it("FAILED on nonexistent file", async () => {
    const result = await verifyWitnessReceipt("/nonexistent/receipt.json");
    assert.equal(result.verdict, "FAILED");
    assert.ok(
      result.checks.some((c) => !c.pass && c.check === "file_readable"),
    );
  });

  it("FAILED on tampered content", async () => {
    const { receipt, restore } = await freshHomeWithWitness();
    try {
      const tampered = JSON.parse(
        await (await import("node:fs/promises")).readFile(receipt.path, "utf8"),
      );
      tampered.attests.node = "TamperedNode";
      await writeFile(receipt.path, JSON.stringify(tampered, null, 2));
      const result = await verifyWitnessReceipt(receipt.path);
      assert.equal(result.verdict, "FAILED");
      const hashCheck = result.checks.find(
        (c) => c.check === "content_hash_integrity",
      );
      assert.equal(hashCheck.pass, false);
    } finally {
      restore();
    }
  });

  it("FAILED on wrong schema", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-vfy-schema-"));
    const fakePath = join(home, "fake-receipt.json");
    await writeFile(fakePath, JSON.stringify({ schema: "wrong", attests: {} }));
    const result = await verifyWitnessReceipt(fakePath);
    assert.equal(result.verdict, "FAILED");
    assert.ok(result.checks.some((c) => !c.pass && c.check === "schema_match"));
  });

  it("includes receipt_summary on valid receipt", async () => {
    const { receipt, restore } = await freshHomeWithWitness();
    try {
      const result = await verifyWitnessReceipt(receipt.path);
      assert.ok(result.receipt_summary);
      assert.equal(result.receipt_summary.node, "Node0");
      assert.equal(result.receipt_summary.epistemic_ground, "topology_canon");
    } finally {
      restore();
    }
  });
});

describe("findLatestWitness", () => {
  it("finds witness in receipts dir", async () => {
    const { home, restore } = await freshHomeWithWitness();
    try {
      const path = await findLatestWitness(home);
      assert.ok(path);
      assert.ok(path.includes("witness-"));
    } finally {
      restore();
    }
  });

  it("returns null when no witnesses exist", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-vfy-empty-"));
    await runSetup(home);
    const old = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;
    try {
      const path = await findLatestWitness(home);
      assert.equal(path, null);
    } finally {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    }
  });

  it("returns null on nonexistent home", async () => {
    const path = await findLatestWitness("/nonexistent/home");
    assert.equal(path, null);
  });
});

describe("formatWitnessVerification", () => {
  it("returns string with verdict", async () => {
    const { receipt, restore } = await freshHomeWithWitness();
    try {
      const result = await verifyWitnessReceipt(receipt.path);
      const text = formatWitnessVerification(result);
      assert.ok(text.includes("VERIFIED"));
      assert.ok(text.includes("WITNESS VERIFICATION"));
    } finally {
      restore();
    }
  });

  it("shows check results", async () => {
    const { receipt, restore } = await freshHomeWithWitness();
    try {
      const result = await verifyWitnessReceipt(receipt.path);
      const text = formatWitnessVerification(result);
      assert.ok(text.includes("PASS"));
      assert.ok(text.includes("content_hash_integrity"));
    } finally {
      restore();
    }
  });

  it("shows receipt summary", async () => {
    const { receipt, restore } = await freshHomeWithWitness();
    try {
      const result = await verifyWitnessReceipt(receipt.path);
      const text = formatWitnessVerification(result);
      assert.ok(text.includes("Node0"));
      assert.ok(text.includes("topology_canon"));
    } finally {
      restore();
    }
  });
});
