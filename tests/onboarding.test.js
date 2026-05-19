import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

import {
  buildOnboardingPreview,
  formatOnboardingPreview
} from "../packages/core/src/onboarding.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

test("buildOnboardingPreview emits a schema-tagged preview-only first-run state", () => {
  const guide = buildOnboardingPreview();

  assert.equal(guide.schema, "bizra.dema.onboarding.preview.v0.1");
  assert.equal(guide.mode, "preview_only");
  assert.equal(guide.user_state.phase, "first_run");
  assert.equal(guide.user_state.node_role, "momo_node0");
  assert.deepEqual(guide.user_state.allowed_actions, ["read", "preview", "verify"]);
  assert.equal(guide.steps.length, 7);
  assert.equal(guide.boundary.consent_required_to_view, false);
  assert.equal(guide.boundary.files_mutated, false);
  assert.equal(guide.boundary.runtime_started, false);
  assert.equal(guide.boundary.daemon_started, false);
  assert.equal(guide.boundary.receipt_minted, false);
  assert.equal(guide.boundary.node1_or_node2_connected, false);
});

test("onboarding preview explicitly blocks runtime, missions, federation, and Step 7", () => {
  const guide = buildOnboardingPreview();

  assert.ok(guide.user_state.blocked_actions.includes("runtime_start"));
  assert.ok(guide.user_state.blocked_actions.includes("mission"));
  assert.ok(guide.user_state.blocked_actions.includes("federation"));
  assert.ok(guide.user_state.blocked_actions.includes("node_handshake"));
  assert.ok(guide.user_state.blocked_actions.includes("step7_mint"));
  assert.equal(guide.boundaries.no_runtime, true);
  assert.equal(guide.boundaries.no_network, true);
  assert.equal(guide.boundaries.no_receipt_mint, true);
  assert.equal(guide.boundaries.no_external_posting, true);
  assert.equal(guide.boundaries.no_step7_mint, true);
});

test("onboarding guide records shoulders-not-copying doctrine", () => {
  const guide = buildOnboardingPreview();

  assert.equal(guide.doctrine.stance, "stand_on_shoulders_do_not_copy");
  assert.ok(guide.inspiration.find((item) => item.source === "OpenClaw"));
  assert.ok(guide.inspiration.find((item) => item.source === "Hermes Agent"));
  assert.ok(guide.inspiration.find((item) => item.source === "Pi.dev"));
});

test("buildOnboardingPreview is deterministic and JSON-safe", () => {
  const first = buildOnboardingPreview();
  const second = buildOnboardingPreview();

  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
});

test("buildOnboardingPreview returns mutation-isolated guide collections", () => {
  const guide = buildOnboardingPreview();
  guide.inspiration[0].source = "Mutated";
  guide.steps[0].title = "Mutated";
  guide.user_state.blocked_actions.push("mutated");

  const nextGuide = buildOnboardingPreview();
  assert.equal(nextGuide.inspiration[0].source, "OpenClaw");
  assert.equal(nextGuide.steps[0].title, "Create the local home");
  assert.doesNotMatch(nextGuide.user_state.blocked_actions.join(","), /mutated/);
  assert.notEqual(nextGuide.inspiration, guide.inspiration);
  assert.notEqual(nextGuide.steps, guide.steps);
});

test("buildOnboardingPreview surfaces node_identity with Node0 ordinal, uid, and null language", () => {
  const guide = buildOnboardingPreview();
  assert.ok(guide.node_identity, "node_identity block present");
  assert.equal(guide.node_identity.node_ordinal, 0, "Node0 has ordinal=0 by canon");
  assert.equal(guide.node_identity.node_label, "Node0");
  assert.match(guide.node_identity.node_uid, /^bizra_node_0_[0-9a-f]{12}$/);
  assert.equal(guide.node_identity.language, null, "language null until first-run prompt");
  assert.equal(guide.node_identity.device_label, null);
  assert.equal(guide.node_identity.companion_of, null);
});

test("node_identity is stable across calls AND mutation-isolated from prior guide", () => {
  const first = buildOnboardingPreview();
  const second = buildOnboardingPreview();
  assert.equal(first.node_identity.node_uid, second.node_identity.node_uid, "uid is deterministic");
  // mutate first → does not leak into second
  first.node_identity.language = "ar";
  const third = buildOnboardingPreview();
  assert.equal(third.node_identity.language, null, "mutation on prior guide must not leak");
});

test("formatOnboardingGuide renders nontechnical CLI/TUI orientation", () => {
  const output = formatOnboardingPreview(buildOnboardingPreview());

  assert.match(output, /Welcome to Dema/);
  assert.match(output, /Dema — Sovereign AI Node Companion/);
  assert.match(output, /Current user state/);
  assert.match(output, /Standing on shoulders, not copying/);
  assert.match(output, /Guided first run/);
  assert.match(output, /dema setup/);
  assert.match(output, /does not mutate files/);
  assert.match(output, /Step 7 minting/);
});

test("dema onboard supports human output and --json", async () => {
  const human = await execFileAsync("node", [cliPath, "onboard"]);
  assert.match(human.stdout, /Welcome to Dema/);
  assert.match(human.stdout, /Guided first run/);

  const json = await execFileAsync("node", [cliPath, "onboard", "--json"]);
  const guide = JSON.parse(json.stdout);
  assert.equal(guide.schema, "bizra.dema.onboarding.preview.v0.1");
  assert.equal(guide.mode, "preview_only");
  assert.equal(guide.boundaries.no_runtime, true);
  assert.ok(guide.user_state.blocked_actions.includes("step7_mint"));
});

test("dema onboard does not call runtime adapters or network surfaces", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "onboard", "--json"]);
  const guide = JSON.parse(stdout);
  const source = await readFile(cliPath, "utf8");
  const onboardCase = source.slice(
    source.indexOf('case "welcome"'),
    source.indexOf('case "setup"')
  );

  assert.equal(guide.boundary.runtime_started, false);
  assert.equal(guide.boundary.network_connection_attempted, false);
  assert.equal(guide.boundaries.no_network, true);
  assert.doesNotMatch(onboardCase, /adapter\.status\(/);
  assert.doesNotMatch(onboardCase, /createNode0Adapter\(/);
});
