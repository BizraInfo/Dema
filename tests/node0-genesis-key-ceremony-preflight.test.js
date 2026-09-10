import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("preflight blocks second init when an active key pointer is present", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-existing-"));
  try {
    await mkdir(join(home, "keys"), { recursive: true });
    await writeFile(join(home, "keys", "active-key.json"), "{}\n", "utf8");

    const report = await assessNode0GenesisKeyCeremonyPreflight({
      demaHome: home,
      provenanceNextGate: "NODE0-GENESIS-KEY-CEREMONY-1A",
    });

    assert.equal(report.cleared_for_key_init, false);
    assert.equal(report.authorship_key_present, true);
    assert.ok(report.blockers.some((b) => b.code === "authorship_key_already_present"));
    assert.equal(report.recommended_command, null);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("preflight requires operator review for historical migration gate", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-migrate-"));
  try {
    const report = await assessNode0GenesisKeyCeremonyPreflight({
      demaHome: home,
      provenanceNextGate: "MIGRATE-HISTORICAL-GENESIS-PROOF-1A",
    });

    assert.equal(report.cleared_for_key_init, false);
    assert.equal(report.blockers[0].code, "migrate_review_required");
    assert.equal(report.recommended_command, null);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("preflight CLI emits JSON on fresh home with explicit key-ceremony provenance", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-cli-"));
  const provDir = await mkdtemp(join(tmpdir(), "dema-key-preflight-prov-"));
  const provFile = join(provDir, "provenance.json");
  try {
    await writeFile(
      provFile,
      JSON.stringify({ next_gate: { gate: "NODE0-GENESIS-KEY-CEREMONY-1A" } }),
      "utf8",
    );
    const { stdout } = await execFileAsync(
      "node",
      [scriptPath, "--json", "--provenance-json", provFile],
      { env: { ...process.env, DEMA_HOME: home } },
    );
    const report = JSON.parse(stdout);
    assert.equal(report.schema, NODE0_GENESIS_KEY_CEREMONY_PREFLIGHT_SCHEMA);
    assert.equal(report.cleared_for_key_init, true);
  } finally {
    await rm(home, { recursive: true, force: true });
    await rm(provDir, { recursive: true, force: true });
  }
});

test("preflight CLI can derive the current provenance gate without the historical summary", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-fresh-home-"));
  const cwd = await mkdtemp(join(tmpdir(), "dema-key-preflight-fresh-cwd-"));
  try {
    const { stdout } = await execFileAsync(
      "node",
      [scriptPath, "--json", "--fresh-provenance"],
      {
        cwd,
        env: { ...process.env, DEMA_HOME: home, CROSS_REPO_SKIP_GH: "1" },
      },
    );
    const report = JSON.parse(stdout);
    assert.equal(report.schema, NODE0_GENESIS_KEY_CEREMONY_PREFLIGHT_SCHEMA);
    assert.equal(report.provenance_next_gate, "NODE0-GENESIS-KEY-CEREMONY-1A");
    assert.equal(report.cleared_for_key_init, true);
    assert.equal(report.boundary.private_key_read, false);
    assert.equal(report.boundary.key_generated, false);
  } finally {
    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
});

test("preflight blocks when provenance gate is missing (no default)", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-missing-"));
  try {
    const report = await assessNode0GenesisKeyCeremonyPreflight({
      demaHome: home,
      // provenanceNextGate intentionally absent
    });
    assert.equal(report.cleared_for_key_init, false);
    assert.equal(report.blockers[0].code, "provenance_unresolved");
    assert.equal(report.recommended_command, null);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("preflight blocks with unknown_provenance_gate for unrecognized gate value", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-unknown-"));
  try {
    const report = await assessNode0GenesisKeyCeremonyPreflight({
      demaHome: home,
      provenanceNextGate: "SOME-UNKNOWN-GATE-XYZ",
    });
    assert.equal(report.cleared_for_key_init, false);
    assert.equal(report.blockers[0].code, "unknown_provenance_gate");
    assert.ok(report.blockers[0].message.includes("SOME-UNKNOWN-GATE-XYZ"));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("preflight CLI remains human-readable and fail-closed without provenance", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-human-"));
  try {
    await assert.rejects(
      execFileAsync("node", [scriptPath], {
        env: { ...process.env, DEMA_HOME: home },
      }),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stdout, /READ-ONLY/);
        assert.match(error.stdout, /provenance_unresolved/);
        assert.match(error.stdout, /pubkey=false ceremony=true signing_slots=11/);
        return true;
      },
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("preflight CLI blocks a missing explicit provenance file", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-missing-file-"));
  try {
    await assert.rejects(
      execFileAsync(
        "node",
        [scriptPath, "--json", "--provenance-json", join(home, "missing.json")],
        { env: { ...process.env, DEMA_HOME: home } },
      ),
      (error) => {
        assert.equal(error.code, 1);
        const report = JSON.parse(error.stdout);
        assert.equal(report.provenance_next_gate, "BLOCKED_BY_UNRESOLVED_PROVENANCE");
        assert.equal(report.cleared_for_key_init, false);
        return true;
      },
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("preflight CLI blocks malformed explicit provenance JSON", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-malformed-file-"));
  const provDir = await mkdtemp(join(tmpdir(), "dema-key-preflight-malformed-prov-"));
  const provFile = join(provDir, "provenance.json");
  try {
    await writeFile(provFile, "{not-json", "utf8");
    await assert.rejects(
      execFileAsync(
        "node",
        [scriptPath, "--json", "--provenance-json", provFile],
        { env: { ...process.env, DEMA_HOME: home } },
      ),
      (error) => {
        assert.equal(error.code, 1);
        const report = JSON.parse(error.stdout);
        assert.equal(report.provenance_next_gate, "BLOCKED_BY_UNRESOLVED_PROVENANCE");
        assert.equal(report.cleared_for_key_init, false);
        return true;
      },
    );
  } finally {
    await rm(home, { recursive: true, force: true });
    await rm(provDir, { recursive: true, force: true });
  }
});

test("preflight CLI human path shows the recommended key-init command", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-human-ready-"));
  const provDir = await mkdtemp(join(tmpdir(), "dema-key-preflight-human-ready-prov-"));
  const provFile = join(provDir, "provenance.json");
  try {
    await writeFile(
      provFile,
      JSON.stringify({ next_gate: { gate: "NODE0-GENESIS-KEY-CEREMONY-1A" } }),
      "utf8",
    );
    const { stdout } = await execFileAsync(
      "node",
      [scriptPath, "--provenance-json", provFile],
      { env: { ...process.env, DEMA_HOME: home } },
    );
    assert.match(stdout, /cleared:  YES/);
    assert.match(stdout, /next:.*authorship key init/);
  } finally {
    await rm(home, { recursive: true, force: true });
    await rm(provDir, { recursive: true, force: true });
  }
});

test("preflight CLI blocks malformed historical provenance JSON", async () => {
  const home = await mkdtemp(join(tmpdir(), "dema-key-preflight-historical-home-"));
  const cwd = await mkdtemp(join(tmpdir(), "dema-key-preflight-historical-cwd-"));
  const provenanceDir = join(cwd, "docs", "08-quality");
  try {
    await mkdir(provenanceDir, { recursive: true });
    await writeFile(
      join(provenanceDir, "CROSS_REPO_GENESIS_PROVENANCE_2026_06_05.json"),
      "{not-json",
      "utf8",
    );
    await assert.rejects(
      execFileAsync("node", [scriptPath, "--json"], {
        cwd,
        env: { ...process.env, DEMA_HOME: home },
      }),
      (error) => {
        assert.equal(error.code, 1);
        const report = JSON.parse(error.stdout);
        assert.equal(report.provenance_next_gate, "BLOCKED_BY_UNRESOLVED_PROVENANCE");
        assert.equal(report.cleared_for_key_init, false);
        return true;
      },
    );
  } finally {
    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
});
