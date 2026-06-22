import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildDemaBirthLoop,
  DEMA_BIRTH_LOOP_SCHEMA,
} from "../packages/core/src/dema-birth-loop.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/dema-birth-loop.js", import.meta.url),
);

const DOMAIN_BOUNDARY_KEYS = [
  "network_used",
  "model_invoked",
  "file_content_read",
  "homebase_scan_performed",
  "task_executed",
  "runtime_activated",
  "federation_used",
  "token_minted",
  "poi_score_calculated",
  "reward_emitted",
];

const validProfile = Object.freeze({
  schema: "bizra.dema.profile.v0.1",
  preferred_name: "Beshr",
  language_code: "ar",
  secondary_language_code: "en",
  memory_consent: "local",
  hidden_autonomy: false,
  device_label: "VivoBook",
});

function assertDeepFrozen(value, label = "value") {
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object") {
      assertDeepFrozen(child, `${label}.${key}`);
    }
  }
}

function assertAllFalseBoundary(boundary) {
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
  for (const key of DOMAIN_BOUNDARY_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
}

test("no profile (absent) routes to NEW_NODE with setup action", () => {
  const env = buildDemaBirthLoop({ profile: null });

  assert.equal(env.valid, true);
  assert.equal(env.node_state, "NEW_NODE");
  assert.equal(env.profile_status, "absent");
  assert.ok(
    env.next_safe_actions.includes("setup_profile"),
    "NEW_NODE must offer setup_profile",
  );
  assert.equal(
    env.greeting.includes("Beshr"),
    false,
    "NEW_NODE must not greet by an unknown name",
  );
});

test("valid profile routes to EXISTING_NODE and greets by preferred_name", () => {
  const env = buildDemaBirthLoop({ profile: validProfile });

  assert.equal(env.node_state, "EXISTING_NODE");
  assert.equal(env.profile_status, "valid");
  assert.ok(
    env.greeting.includes("Beshr"),
    "EXISTING_NODE greeting must include the preferred_name",
  );
  assert.ok(
    env.next_safe_actions.includes("request_homebase_scan_consent"),
    "EXISTING_NODE must offer the homebase scan consent action",
  );
});

test("partial profile (preferred_name null) routes to PARTIAL_NODE with repair", () => {
  const env = buildDemaBirthLoop({
    profile: {
      schema: "bizra.dema.profile.v0.1",
      preferred_name: null,
      language_code: "en",
    },
  });

  assert.equal(env.node_state, "PARTIAL_NODE");
  assert.equal(env.profile_status, "partial");
  assert.ok(
    env.next_safe_actions.includes("repair_profile_via_setup"),
    "PARTIAL_NODE must offer a repair action",
  );
});

test("partial profile (language absent) also routes to PARTIAL_NODE", () => {
  const env = buildDemaBirthLoop({
    profile: {
      schema: "bizra.dema.profile.v0.1",
      preferred_name: "Beshr",
      language_code: null,
    },
  });

  assert.equal(env.node_state, "PARTIAL_NODE");
  assert.equal(env.profile_status, "partial");
});

test("legacy 'language' field satisfies the language requirement", () => {
  const env = buildDemaBirthLoop({
    profile: {
      schema: "bizra.dema.profile.v0.1",
      preferred_name: "Beshr",
      language: "en",
    },
  });

  assert.equal(env.node_state, "EXISTING_NODE");
  assert.equal(env.language_status.language_code, "en");
  assert.equal(env.language_status.status, "set");
});

test("legacy 'name' field (no preferred_name) → EXISTING_NODE and greets by name", () => {
  // profiles.js writes `name:` and operator-profile.js:23 falls back to it, so
  // valid returning operators can have `name` and no `preferred_name`. They must
  // be greeted, NOT misclassified PARTIAL_NODE ("your profile is incomplete").
  const env = buildDemaBirthLoop({
    profile: {
      schema: "bizra.dema.profile.v0.1",
      name: "Beshr",
      language_code: "en",
    },
  });

  assert.equal(env.node_state, "EXISTING_NODE");
  assert.equal(env.profile_status, "valid");
  assert.ok(
    env.greeting.includes("Beshr"),
    "EXISTING_NODE greeting must include the legacy `name` value",
  );
});

test("profileError routes to CORRUPT_NODE, fails closed, does not greet by name", () => {
  const env = buildDemaBirthLoop({
    profile: { schema: "bizra.dema.profile.v0.1", preferred_name: "Beshr" },
    profileError: "invalid_json",
  });

  assert.equal(env.valid, true);
  assert.equal(env.node_state, "CORRUPT_NODE");
  assert.equal(env.profile_status, "malformed");
  assert.deepEqual(env.next_safe_actions, ["rerun_setup_to_rebuild_profile"]);
  assert.equal(
    env.greeting.includes("Beshr"),
    false,
    "CORRUPT_NODE must not greet by name",
  );
  assert.equal(
    JSON.stringify(env).includes("request_homebase_scan_consent"),
    false,
    "CORRUPT_NODE must not suggest scanning",
  );
});

test("wrong-schema object routes to CORRUPT_NODE and does not greet by name", () => {
  const env = buildDemaBirthLoop({
    profile: {
      schema: "something.else.v9",
      preferred_name: "Beshr",
      language_code: "en",
    },
  });

  assert.equal(env.node_state, "CORRUPT_NODE");
  assert.equal(env.profile_status, "malformed");
  assert.equal(
    env.greeting.includes("Beshr"),
    false,
    "CORRUPT_NODE must not greet by name",
  );
});

test("non-object profile routes to CORRUPT_NODE", () => {
  const env = buildDemaBirthLoop({ profile: "not-an-object" });

  assert.equal(env.node_state, "CORRUPT_NODE");
  assert.equal(env.profile_status, "malformed");
});

test("language_status is set when language_code present, unset when null", () => {
  const set = buildDemaBirthLoop({ profile: validProfile });
  assert.equal(set.language_status.language_code, "ar");
  assert.equal(set.language_status.secondary_language_code, "en");
  assert.equal(set.language_status.status, "set");

  const unset = buildDemaBirthLoop({ profile: null });
  assert.equal(unset.language_status.language_code, null);
  assert.equal(unset.language_status.status, "unset");
});

test("boundary flags are all false including the 10 domain keys", () => {
  for (const env of [
    buildDemaBirthLoop({ profile: validProfile }),
    buildDemaBirthLoop({ profile: null }),
    buildDemaBirthLoop({ profileError: "unreadable" }),
  ]) {
    assertAllFalseBoundary(env.boundary);
  }
});

test("envelope is deep-frozen recursively across every node state", () => {
  for (const env of [
    buildDemaBirthLoop({ profile: validProfile }),
    buildDemaBirthLoop({ profile: null }),
    buildDemaBirthLoop({
      profile: { schema: "bizra.dema.profile.v0.1", preferred_name: null },
    }),
    buildDemaBirthLoop({ profileError: "invalid_json" }),
  ]) {
    assertDeepFrozen(env, "envelope");
  }
});

test("schema and truth_label are the exact canonical strings", () => {
  const env = buildDemaBirthLoop({ profile: validProfile });

  assert.equal(env.schema, "bizra.dema.birth_loop.v0.1");
  assert.equal(env.schema, DEMA_BIRTH_LOOP_SCHEMA);
  assert.equal(env.truth_label, "DEMA_BIRTH_LOOP_LOCAL_ONLY");
  assert.equal(env.mode, "preview_only");
});

test("what_this_does_not_prove blocks scan, model, task, runtime/federation, receipt", () => {
  const text = buildDemaBirthLoop({ profile: validProfile })
    .what_this_does_not_prove.join(" ");

  assert.match(text, /homebase|home base/i);
  assert.match(text, /scan/i);
  assert.match(text, /model/i);
  assert.match(text, /task/i);
  assert.match(text, /runtime|federation/i);
  assert.match(text, /receipt|mint/i);
});

test("module imports no fs, fs/promises, net, child process, os, or http APIs", () => {
  const source = readFileSync(MODULE_PATH, "utf8");

  assert.doesNotMatch(
    source,
    /node:(fs|fs\/promises|net|http|https|child_process|os)\b/,
  );
  assert.doesNotMatch(
    source,
    /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/,
  );
});
