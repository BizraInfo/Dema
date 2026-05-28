import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  gatherDemaRealmCouncil,
  renderDemaRealmCouncil,
  DEMA_REALM_COUNCIL_CHAMBER_SCHEMA,
} from "../packages/core/src/dema-realm-council.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-05-28T20:54:00Z");

const EXPECTED_PROFILES = [
  "Guardian",
  "Reasoner",
  "Builder",
  "Critic",
  "Archivist",
];

const FORBIDDEN_FIELDS = [
  "private_key",
  "private_key_pem",
  "raw_artifact",
  "artifact_content",
  "full_receipt_json",
  "personal_memory",
  "mint_candidate",
  "token_eligible",
  "reward",
  "bzc",
  "imp",
  "economic_value",
  "federation_target",
];

function runCli(argv) {
  return new Promise((resolveOne) => {
    const child = spawn(process.execPath, [CLI_PATH, ...argv], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEMA_NO_TUI: "1",
        NODE_ENV: "test",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    child.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    child.on("close", (code) => resolveOne({ exitCode: code, stdout, stderr }));
  });
}

describe("gatherDemaRealmCouncil — declared council presence", () => {
  it("emits schema-tagged envelope with all 5 profiles", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    assert.equal(c.schema, DEMA_REALM_COUNCIL_CHAMBER_SCHEMA);
    assert.equal(c.truth_label, "DECLARED_COUNCIL_CHAMBER");
    assert.equal(c.profile_count, 5);
    assert.deepEqual(
      c.profiles.map((p) => p.name),
      EXPECTED_PROFILES,
    );
  });

  it("each profile carries role/doctrine/active_ability/current_state/truth_label/boundary_note", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    for (const p of c.profiles) {
      assert.equal(typeof p.name, "string");
      assert.equal(typeof p.role, "string");
      assert.equal(typeof p.doctrine, "string");
      assert.equal(typeof p.active_ability, "string");
      assert.equal(typeof p.current_state, "string");
      assert.equal(typeof p.truth_label, "string");
      assert.equal(typeof p.boundary_note, "string");
    }
  });

  it("every profile's truth_label is DECLARED_COUNCIL_PROFILE (not READY/RUNTIME)", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    for (const p of c.profiles) {
      assert.equal(p.truth_label, "DECLARED_COUNCIL_PROFILE");
      assert.notEqual(p.truth_label, "READY");
      assert.notEqual(p.truth_label, "RUNTIME");
    }
  });

  it("every profile's current_state is DECLARED or PARTIAL (no false RUNTIME claim)", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    const allowedStates = new Set(["DECLARED", "PARTIAL"]);
    for (const p of c.profiles) {
      assert.ok(
        allowedStates.has(p.current_state),
        `${p.name} current_state="${p.current_state}" must be DECLARED or PARTIAL`,
      );
    }
  });

  it("Builder + Archivist are PARTIAL (honest about partial runtime backing); others DECLARED", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    const states = Object.fromEntries(
      c.profiles.map((p) => [p.name, p.current_state]),
    );
    assert.equal(states.Builder, "PARTIAL");
    assert.equal(states.Archivist, "PARTIAL");
    assert.equal(states.Guardian, "DECLARED");
    assert.equal(states.Reasoner, "DECLARED");
    assert.equal(states.Critic, "DECLARED");
  });
});

describe("gatherDemaRealmCouncil — boundary + freeze + no leaks", () => {
  it("envelope frozen with 10-flag all-false boundary block", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    assert.equal(Object.isFrozen(c), true);
    assert.equal(Object.isFrozen(c.profiles), true);
    assert.equal(c.boundary.file_write_performed, false);
    assert.equal(c.boundary.network_used, false);
    assert.equal(c.boundary.federation_used, false);
    assert.equal(c.boundary.share_decision_made, false);
    assert.equal(c.boundary.poi_score_calculated, false);
    assert.equal(c.boundary.token_minted, false);
    assert.equal(c.boundary.economic_claim_made, false);
    assert.equal(c.boundary.private_key_loaded, false);
    assert.equal(c.boundary.raw_artifact_included, false);
    assert.equal(c.boundary.mutation_performed, false);
  });

  it("no forbidden JSON keys in serialized envelope", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    const json = JSON.stringify(c);
    for (const field of FORBIDDEN_FIELDS) {
      assert.equal(
        json.includes(`"${field}":`),
        false,
        `envelope must not include "${field}" as a JSON key`,
      );
    }
  });

  it("disclaimer is non-empty and includes 'DECLARED, not runtime-backed'", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    assert.ok(c.disclaimer.length > 0);
    assert.match(c.disclaimer, /DECLARED.*not runtime-backed/);
  });
});

describe("renderDemaRealmCouncil (no color)", () => {
  it("includes DEMA REALM · COUNCIL CHAMBER header + all 5 profile names + disclaimer", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    const out = renderDemaRealmCouncil(c, { useColor: false });
    assert.match(out, /DEMA REALM · COUNCIL CHAMBER/);
    for (const name of EXPECTED_PROFILES) {
      assert.match(
        out,
        new RegExp(name.toUpperCase()),
        `output missing profile name ${name}`,
      );
    }
    assert.match(out, /Disclaimer:/);
    assert.match(out, /DECLARED.*not runtime-backed/);
  });

  it("each profile card renders Doctrine + Ability + State + Boundary lines", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    const out = renderDemaRealmCouncil(c, { useColor: false });
    const doctrineCount = (out.match(/Doctrine:/g) || []).length;
    const abilityCount = (out.match(/Ability:/g) || []).length;
    const stateCount = (out.match(/State:/g) || []).length;
    const boundaryCount = (out.match(/Boundary:/g) || []).length;
    assert.equal(doctrineCount, 5);
    assert.equal(abilityCount, 5);
    assert.equal(stateCount, 5);
    assert.equal(boundaryCount, 5);
  });

  it("renders DECLARED_COUNCIL_PROFILE truth label on every card", () => {
    const c = gatherDemaRealmCouncil({ now: FIXED_NOW });
    const out = renderDemaRealmCouncil(c, { useColor: false });
    const matches = out.match(/DECLARED_COUNCIL_PROFILE/g) || [];
    assert.equal(matches.length, 5);
  });
});

describe("dema realm council CLI", () => {
  it("--json emits schema-tagged envelope with all 5 profiles, exit 0", async () => {
    const r = await runCli(["realm", "council", "--json"]);
    assert.equal(r.exitCode, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.schema, DEMA_REALM_COUNCIL_CHAMBER_SCHEMA);
    assert.equal(out.profile_count, 5);
    assert.deepEqual(
      out.profiles.map((p) => p.name),
      EXPECTED_PROFILES,
    );
  });

  it("--no-color human render includes DEMA REALM · COUNCIL CHAMBER + 5 profile names + disclaimer", async () => {
    const r = await runCli(["realm", "council", "--no-color"]);
    assert.equal(r.exitCode, 0);
    assert.match(r.stdout, /DEMA REALM · COUNCIL CHAMBER/);
    for (const name of EXPECTED_PROFILES) {
      assert.match(r.stdout, new RegExp(name.toUpperCase()));
    }
    assert.match(r.stdout, /Disclaimer:/);
  });

  it("no private key / no forbidden JSON keys in output", async () => {
    const r = await runCli(["realm", "council", "--json"]);
    const combined = r.stdout + r.stderr;
    assert.equal(combined.includes("BEGIN PRIVATE KEY"), false);
    for (const field of FORBIDDEN_FIELDS) {
      assert.equal(combined.includes(`"${field}":`), false);
    }
  });
});
