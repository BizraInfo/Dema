import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  assessNode0GenesisKeyCeremonyPreflight,
  NODE0_GENESIS_KEY_CEREMONY_PREFLIGHT_SCHEMA,
} from "../packages/genesis/src/node0-genesis-key-ceremony-preflight.js";
import { KEY_INIT_CONSENT_PHRASE } from "../packages/receipts/src/authorship-key-store.js";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL(
    "../scripts/node0-genesis-key-ceremony-preflight.mjs",
    import.meta.url,
  ),
);

test("preflight clears fresh home when provenance gate is key ceremony", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-"));
  try {
    const report = await assessNode0GenesisKeyCeremonyPreflight({
      demaHome: home,
      provenanceNextGate: "NODE0-GENESIS-KEY-CEREMONY-1A",
      block0LiveReadiness: {
        operator_pubkey_present: false,
        ceremony_required: true,
        needs_operator_signing_count: 11,
        poi_rule_verifiable: false,
      },
    });

    assert.equal(report.schema, NODE0_GENESIS_KEY_CEREMONY_PREFLIGHT_SCHEMA);
    assert.equal(report.cleared_for_key_init, true);
    assert.equal(report.consent_phrase, KEY_INIT_CONSENT_PHRASE);
    assert.ok(report.recommended_command.includes("authorship key init"));
    assert.equal(report.boundary.key_generated, false);
    assert.equal(report.boundary.private_key_read, false);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("preflight blocks when provenance unresolved", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-block-"));
  try {
    const report = await assessNode0GenesisKeyCeremonyPreflight({
      demaHome: home,
      provenanceNextGate: "BLOCKED_BY_UNRESOLVED_PROVENANCE",
    });
    assert.equal(report.cleared_for_key_init, false);
    assert.equal(report.blockers[0].code, "provenance_unresolved");
    assert.equal(report.recommended_command, null);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("preflight CLI emits JSON on fresh home", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-cli-"));
  try {
    const { stdout } = await execFileAsync("node", [scriptPath, "--json"], {
      env: { ...process.env, DEMA_HOME: home },
    });
    const report = JSON.parse(stdout);
    assert.equal(report.schema, NODE0_GENESIS_KEY_CEREMONY_PREFLIGHT_SCHEMA);
    assert.equal(report.cleared_for_key_init, true);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
