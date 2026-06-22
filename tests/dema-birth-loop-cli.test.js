// DEMA-BIRTH-LOOP-1A — CLI smoke tests for `dema start`.
// Spawns the real CLI against a temporary DEMA_HOME so the profile read + node
// classification + render are exercised end-to-end. Preview-only: the command
// performs no scan, model, task, or runtime.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

function runStart(home, args = []) {
  return execFileSync("node", [BIN, "start", ...args], {
    encoding: "utf8",
    env: { ...process.env, DEMA_HOME: home },
  });
}

function withHome(profile, fn) {
  const home = mkdtempSync(join(tmpdir(), "dbl-cli-"));
  if (profile !== undefined) {
    writeFileSync(
      join(home, "profile.json"),
      typeof profile === "string" ? profile : JSON.stringify(profile),
    );
  }
  try {
    return fn(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("`dema start --json` on an empty home → NEW_NODE, scan not performed", () => {
  withHome(undefined, (home) => {
    const env = JSON.parse(runStart(home, ["--json"]));
    assert.equal(env.schema, "bizra.dema.birth_loop.v0.1");
    assert.equal(env.node_state, "NEW_NODE");
    assert.equal(env.boundary.homebase_scan_performed, false);
    assert.equal(env.boundary.model_invoked, false);
  });
});

test("`dema start --json` with a valid profile → EXISTING_NODE, greets by name", () => {
  withHome(
    { schema: "bizra.dema.profile.v0.1", preferred_name: "Beshr", language_code: "ar" },
    (home) => {
      const env = JSON.parse(runStart(home, ["--json"]));
      assert.equal(env.node_state, "EXISTING_NODE");
      assert.ok(env.greeting.includes("Beshr"));
      assert.equal(env.language_status.language_code, "ar");
    },
  );
});

test("`dema start` with a legacy name-only profile → EXISTING_NODE (no PARTIAL misfire)", () => {
  withHome(
    { schema: "bizra.dema.profile.v0.1", name: "Beshr", language_code: "en" },
    (home) => {
      const env = JSON.parse(runStart(home, ["--json"]));
      assert.equal(env.node_state, "EXISTING_NODE");
      assert.ok(env.greeting.includes("Beshr"));
    },
  );
});

test("`dema start` human output is preview-only and lists next safe actions", () => {
  withHome(
    { schema: "bizra.dema.profile.v0.1", preferred_name: "Beshr", language_code: "en" },
    (home) => {
      const out = runStart(home);
      assert.match(out, /Preview only/i);
      assert.match(out, /Request homebase scan consent/i);
    },
  );
});

test("`dema start --json` on a malformed profile → CORRUPT_NODE, fails closed (no scan suggestion)", () => {
  withHome("{ not valid json", (home) => {
    const env = JSON.parse(runStart(home, ["--json"]));
    assert.equal(env.node_state, "CORRUPT_NODE");
    assert.equal(
      JSON.stringify(env).includes("request_homebase_scan_consent"),
      false,
    );
  });
});
