import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildMissionManifest } from "../packages/mission/src/mission-manifest.js";
import {
  saveHealthSnapshotReceipt,
  HEALTH_MISSION_CONSENT_PHRASE,
} from "../packages/mission/src/health-snapshot.js";
import { buildCloseoutReport } from "../packages/mission/src/mission-closeout.js";
import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";
import { runSetup } from "../packages/installer/src/setup.js";

const FIXED_NOW = new Date("2026-01-01T00:00:00Z");

describe("mission-lifecycle-coherence", () => {
  it("manifest predictions match executed mission behavior", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-lifecycle-"));
    const old = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;

    try {
      await runSetup(home);
      await mkdir(join(home, "receipts"), { recursive: true });

      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });
      assert.ok(!manifest.error);

      const result = await saveHealthSnapshotReceipt({
        consent: manifest.consent_boundary.required_phrase,
        now: FIXED_NOW,
      });
      assert.equal(result.saved, true);

      const raw = await readFile(result.path, "utf8");
      const receipt = JSON.parse(raw);

      const closeout = buildCloseoutReport(receipt, result.path, "test.json");
      assert.ok(!closeout.error);
      assert.equal(closeout.verification.content_hash_match, true);

      const emb = manifest.expected_mission_boundary;
      const rb = receipt.attests.boundary;

      for (const key of Object.keys(rb)) {
        if (
          key === "consent_collected" ||
          key === "filesystem_write_performed"
        ) {
          assert.equal(
            rb[key],
            true,
            `receipt.boundary.${key} should be true after execution`,
          );
          if (key === "filesystem_write_performed") {
            assert.equal(
              emb[key],
              true,
              `manifest predicted filesystem_write_performed=true`,
            );
          }
        } else {
          const manifestValue = emb[key];
          if (manifestValue !== undefined) {
            assert.equal(
              rb[key],
              manifestValue,
              `manifest predicted ${key}=${manifestValue} but receipt has ${rb[key]}`,
            );
          }
        }
      }
    } finally {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    }
  });

  it("manifest consent phrase is the same constant the mission uses", () => {
    const manifest = buildMissionManifest("health_snapshot", {
      now: FIXED_NOW,
    });
    assert.equal(
      manifest.consent_boundary.required_phrase,
      HEALTH_MISSION_CONSENT_PHRASE,
    );
    assert.equal(
      manifest.consent_boundary.required_phrase_hash,
      sha256(HEALTH_MISSION_CONSENT_PHRASE),
    );
  });

  it("manifest proof_boundary declares the algorithm closeout actually uses", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-lifecycle-proof-"));
    const old = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;

    try {
      await runSetup(home);
      await mkdir(join(home, "receipts"), { recursive: true });

      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });

      const result = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const raw = await readFile(result.path, "utf8");
      const receipt = JSON.parse(raw);

      const recomputed = sha256(stableStringify(receipt.attests));
      assert.equal(recomputed, receipt.content_hash);
      assert.equal(manifest.proof_boundary.content_hash_algorithm, "sha256");
      assert.equal(
        manifest.proof_boundary.content_hash_input,
        "stableStringify(attests)",
      );
    } finally {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    }
  });

  it("manifest manifest_hash uses same algorithm as receipt content_hash", () => {
    const manifest = buildMissionManifest("health_snapshot", {
      now: FIXED_NOW,
    });
    const payload = { ...manifest };
    delete payload.manifest_hash;
    const expected = sha256(stableStringify(payload));
    assert.equal(manifest.manifest_hash, expected);
  });

  it("closeout report schema matches what manifest proof_boundary declares", async () => {
    const home = await mkdtemp(join(tmpdir(), "dema-lifecycle-schema-"));
    const old = process.env.DEMA_HOME;
    process.env.DEMA_HOME = home;

    try {
      await runSetup(home);
      await mkdir(join(home, "receipts"), { recursive: true });

      const manifest = buildMissionManifest("health_snapshot", {
        now: FIXED_NOW,
      });

      const result = await saveHealthSnapshotReceipt({
        consent: HEALTH_MISSION_CONSENT_PHRASE,
        now: FIXED_NOW,
      });
      const raw = await readFile(result.path, "utf8");
      const receipt = JSON.parse(raw);

      assert.equal(receipt.schema, manifest.proof_boundary.receipt_schema);
    } finally {
      if (old) process.env.DEMA_HOME = old;
      else delete process.env.DEMA_HOME;
    }
  });
});
