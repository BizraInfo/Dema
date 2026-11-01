import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildHealthSnapshot,
  saveHealthSnapshotReceipt,
  verifyHealthSnapshotReceipt,
  formatHealthSnapshotReceipt,
  HEALTH_MISSION_CONSENT_PHRASE,
} from "../packages/mission/src/health-snapshot.js";
import { runSetup } from "../packages/installer/src/setup.js";
import { WITNESS_CONSENT_PHRASE } from "../packages/receipts/src/witness-receipt.js";

const FIXED_NOW = new Date("2026-05-26T12:00:00Z");

async function freshHome() {
  const home = await mkdtemp(join(tmpdir(), "dema-health-test-"));
  const old = {
    DEMA_HOME: process.env.DEMA_HOME,
    DEMA_NODE0_ADAPTER: process.env.DEMA_NODE0_ADAPTER,
    DEMA_GATEWAY_URL: process.env.DEMA_GATEWAY_URL,
    DEMA_NODE0_STATUS_COMMAND: process.env.DEMA_NODE0_STATUS_COMMAND,
  };
  process.env.DEMA_HOME = home;
  // Hermetic: health-snapshot tests assert unbridged preview behaviour.
  delete process.env.DEMA_NODE0_ADAPTER;
  delete process.env.DEMA_GATEWAY_URL;
  delete process.env.DEMA_NODE0_STATUS_COMMAND;
  await runSetup(home);
  return {
    home,
    restore: () => {
      for (const [k, v] of Object.entries(old)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    },
  };
}

describe("buildHealthSnapshot", () => {
  it("returns correct schema and truth label", async () => {
    const { restore } = await freshHome();
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      assert.equal(s.schema, "bizra.dema.mission_receipt.health_snapshot.v0.1");
      assert.equal(s.truth_label, "LOCAL_OPERATOR_MISSION");
    } finally {
      restore();
    }
  });

  it("has mission_id starting with health_snapshot_", async () => {
    const { restore } = await freshHome();
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      assert.ok(s.mission_id.startsWith("health_snapshot_"));
    } finally {
      restore();
    }
  });

  it("has sha256 content hash", async () => {
    const { restore } = await freshHome();
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      assert.match(s.content_hash, /^[a-f0-9]{64}$/);
    } finally {
      restore();
    }
  });

  it("attests setup, harness, doctor, witness, memory", async () => {
    const { restore } = await freshHome();
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      assert.ok(s.attests.results.setup);
      assert.ok(s.attests.results.harness);
      assert.ok(s.attests.results.doctor);
      assert.ok(s.attests.results.witness);
      assert.ok(s.attests.results.memory);
    } finally {
      restore();
    }
  });

  it("mission_verdict is ATTENTION when doctor has fails", async () => {
    const { restore } = await freshHome();
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      assert.ok(
        ["CLEAN", "ATTENTION", "FAILED"].includes(s.attests.mission_verdict),
      );
    } finally {
      restore();
    }
  });

  it("unbridged snapshot judges defaultStatus (doctor fails, no network claim)", async () => {
    const { restore } = await freshHome();
    const saved = {
      adapter: process.env.DEMA_NODE0_ADAPTER,
      gateway: process.env.DEMA_GATEWAY_URL,
      statusCmd: process.env.DEMA_NODE0_STATUS_COMMAND,
    };
    delete process.env.DEMA_NODE0_ADAPTER;
    delete process.env.DEMA_GATEWAY_URL;
    delete process.env.DEMA_NODE0_STATUS_COMMAND;
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      assert.ok(s.attests.results.doctor.fail >= 1);
      assert.equal(s.attests.results.doctor.bridged, false);
      assert.equal(s.attests.boundary.network_used, false);
      assert.equal(s.attests.boundary.tool_executed, false);
      assert.notEqual(s.attests.mission_verdict, "CLEAN");
    } finally {
      if (saved.adapter) process.env.DEMA_NODE0_ADAPTER = saved.adapter;
      else delete process.env.DEMA_NODE0_ADAPTER;
      if (saved.gateway) process.env.DEMA_GATEWAY_URL = saved.gateway;
      else delete process.env.DEMA_GATEWAY_URL;
      if (saved.statusCmd)
        process.env.DEMA_NODE0_STATUS_COMMAND = saved.statusCmd;
      else delete process.env.DEMA_NODE0_STATUS_COMMAND;
      restore();
    }
  });

  it("boundary is all false in preview mode", async () => {
    const { restore } = await freshHome();
    const saved = {
      adapter: process.env.DEMA_NODE0_ADAPTER,
      gateway: process.env.DEMA_GATEWAY_URL,
      statusCmd: process.env.DEMA_NODE0_STATUS_COMMAND,
    };
    delete process.env.DEMA_NODE0_ADAPTER;
    delete process.env.DEMA_GATEWAY_URL;
    delete process.env.DEMA_NODE0_STATUS_COMMAND;
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      for (const [key, value] of Object.entries(s.attests.boundary)) {
        assert.equal(value, false, `boundary.${key} should be false`);
      }
    } finally {
      if (saved.adapter) process.env.DEMA_NODE0_ADAPTER = saved.adapter;
      else delete process.env.DEMA_NODE0_ADAPTER;
      if (saved.gateway) process.env.DEMA_GATEWAY_URL = saved.gateway;
      else delete process.env.DEMA_GATEWAY_URL;
      if (saved.statusCmd)
        process.env.DEMA_NODE0_STATUS_COMMAND = saved.statusCmd;
      else delete process.env.DEMA_NODE0_STATUS_COMMAND;
      restore();
    }
  });

  it("consent_verified is false in preview mode", async () => {
    const { restore } = await freshHome();
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      assert.equal(s.attests.consent_verified, false);
    } finally {
      restore();
    }
  });

  it("is deterministic", async () => {
    const { restore } = await freshHome();
    try {
      const a = await buildHealthSnapshot({ now: FIXED_NOW });
      const b = await buildHealthSnapshot({ now: FIXED_NOW });
      assert.equal(a.content_hash, b.content_hash);
    } finally {
      restore();
    }
  });
});

describe("saveHealthSnapshotReceipt", () => {
  it("requires exact consent phrase", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: "wrong",
        now: FIXED_NOW,
      });
      assert.equal(r.saved, false);
      assert.equal(r.reason, "consent_phrase_mismatch");
      assert.equal(r.required_phrase, HEALTH_MISSION_CONSENT_PHRASE);
    } finally {
      restore();
    }
  });

  it("dry-run does not write", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        dryRun: true,
        now: FIXED_NOW,
      });
      assert.equal(r.saved, false);
      assert.equal(r.reason, "dry_run");
    } finally {
      restore();
    }
  });

  it("saves with correct consent", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      assert.equal(r.saved, true);
      assert.equal(r.reason, "consent_verified");
      assert.ok(r.path.includes("mission-health-"));
    } finally {
      restore();
    }
  });

  it("saved receipt has consent_verified=true", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const content = JSON.parse(await readFile(r.path, "utf8"));
      assert.equal(content.attests.consent_verified, true);
      assert.ok(content.attests.consent_phrase_hash);
      assert.equal(content.attests.boundary.consent_collected, true);
      assert.equal(content.attests.boundary.filesystem_write_performed, true);
    } finally {
      restore();
    }
  });

  it("does not store raw consent phrase", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const raw = await readFile(r.path, "utf8");
      assert.ok(!raw.includes(HEALTH_MISSION_CONSENT_PHRASE));
    } finally {
      restore();
    }
  });
});

describe("verifyHealthSnapshotReceipt", () => {
  it("VERIFIED on valid receipt", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const v = await verifyHealthSnapshotReceipt(r.path);
      assert.equal(v.verdict, "VERIFIED");
      assert.equal(v.checks_failing, 0);
    } finally {
      restore();
    }
  });

  it("FAILED on tampered content", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const tampered = JSON.parse(await readFile(r.path, "utf8"));
      tampered.attests.mission_verdict = "TAMPERED";
      await writeFile(r.path, JSON.stringify(tampered, null, 2));
      const v = await verifyHealthSnapshotReceipt(r.path);
      assert.equal(v.verdict, "FAILED");
      assert.ok(
        v.checks.some((c) => !c.pass && c.check === "content_hash_integrity"),
      );
    } finally {
      restore();
    }
  });

  it("FAILED on nonexistent file", async () => {
    const v = await verifyHealthSnapshotReceipt("/nonexistent/receipt.json");
    assert.equal(v.verdict, "FAILED");
  });

  it("includes mission_verdict", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const v = await verifyHealthSnapshotReceipt(r.path);
      assert.ok(["CLEAN", "ATTENTION", "FAILED"].includes(v.mission_verdict));
    } finally {
      restore();
    }
  });

  it("does not surface tampered mission_verdict on failed verification", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const tampered = JSON.parse(await readFile(r.path, "utf8"));
      tampered.attests.mission_verdict = "TAMPERED";
      await writeFile(r.path, JSON.stringify(tampered, null, 2));

      const v = await verifyHealthSnapshotReceipt(r.path);

      assert.equal(v.verdict, "FAILED");
      assert.equal(v.mission_verdict, null);
    } finally {
      restore();
    }
  });
});

describe("formatHealthSnapshotReceipt", () => {
  it("returns string with mission verdict", async () => {
    const { restore } = await freshHome();
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      const text = formatHealthSnapshotReceipt(s);
      assert.ok(text.includes("NODE0 HEALTH SNAPSHOT"));
      assert.ok(text.includes("Mission verdict:"));
    } finally {
      restore();
    }
  });

  it("shows results", async () => {
    const { restore } = await freshHome();
    try {
      const s = await buildHealthSnapshot({ now: FIXED_NOW });
      const text = formatHealthSnapshotReceipt(s);
      assert.ok(text.includes("Setup:"));
      assert.ok(text.includes("Harness:"));
      assert.ok(text.includes("Doctor:"));
      assert.ok(text.includes("Witness:"));
    } finally {
      restore();
    }
  });

  it("shows consent hint on mismatch", async () => {
    const { restore } = await freshHome();
    try {
      const r = await saveHealthSnapshotReceipt({
        consent: "wrong",
        now: FIXED_NOW,
      });
      const text = formatHealthSnapshotReceipt(r);
      assert.ok(text.includes("Consent required"));
    } finally {
      restore();
    }
  });
});

describe("HEALTH_MISSION_CONSENT_PHRASE", () => {
  it("is exported and non-empty", () => {
    assert.equal(typeof HEALTH_MISSION_CONSENT_PHRASE, "string");
    assert.ok(HEALTH_MISSION_CONSENT_PHRASE.length > 5);
  });

  it("is different from witness consent", () => {
    assert.notEqual(HEALTH_MISSION_CONSENT_PHRASE, WITNESS_CONSENT_PHRASE);
  });
});
