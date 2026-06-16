import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  sha256,
  stableStringify,
} from "../packages/consent/src/consent-common.js";
import { ONBOARDING_LIFECYCLE_STAGE_IDS } from "../packages/core/src/onboarding-lifecycle.js";

const specPath = new URL(
  "../docs/02-architecture/dema-first-time-onboarding-protocol-v0.1.md",
  import.meta.url,
);

function readSpec() {
  return readFileSync(specPath, "utf8");
}

function onboardingProtocolDescriptorHash({ phases, stages, laws }) {
  const descriptor = {
    schema: "bizra.dema.onboarding_protocol_descriptor.v0.1",
    truth_label: "DECLARED_SPEC",
    phases,
    stages,
    laws,
  };
  return sha256(
    stableStringify({
      schema: "bizra.dema.onboarding_protocol_replay_hash_input.v0.1",
      descriptor,
    }),
  );
}

test("onboarding spec declares DECLARED_SPEC / DESIGNED_NOT_LIVE status", () => {
  const spec = readSpec();
  assert.match(
    spec,
    /\*\*Status:\*\*\s*`DECLARED_SPEC`\s*\/\s*`DESIGNED_NOT_LIVE`/,
  );
});

test("spec stage list exactly matches ONBOARDING_LIFECYCLE_STAGE_IDS in canonical order", () => {
  const spec = readSpec();
  assert.equal(ONBOARDING_LIFECYCLE_STAGE_IDS.length, 7);
  let prevIndex = -1;
  for (const id of ONBOARDING_LIFECYCLE_STAGE_IDS) {
    const idx = spec.indexOf(`\`${id}\``);
    assert.ok(idx > -1, `stage id ${id} must appear (backticked) in the spec`);
    assert.ok(
      idx > prevIndex,
      `stage id ${id} must appear after the previous stage (canonical order)`,
    );
    prevIndex = idx;
  }
});

test("four-phase view is present and ordered Bond -> Foundation -> Discovery -> First Mission", () => {
  const spec = readSpec();
  assert.ok(spec.includes("Bond → Foundation → Discovery → First Mission"));
  const bond = spec.indexOf("Bond");
  const foundation = spec.indexOf("Foundation");
  const discovery = spec.indexOf("Discovery");
  const firstMission = spec.indexOf("First Mission");
  assert.ok(bond > -1 && foundation > bond, "Foundation follows Bond");
  assert.ok(discovery > foundation, "Discovery follows Foundation");
  assert.ok(firstMission > discovery, "First Mission follows Discovery");
});

test("Law 1: ephemeral decline path persists nothing", () => {
  const spec = readSpec();
  assert.match(spec, /ephemeral/i);
  assert.ok(spec.includes("nothing was saved"));
  assert.ok(spec.includes("filesystem_write_performed: false"));
});

test("Law 2: zero-model Bootstrap Mode — a model-less node is complete", () => {
  const spec = readSpec();
  assert.ok(spec.includes("Bootstrap Mode"));
  assert.ok(spec.includes("model-less"));
});

test("Law 3: model-discovery independence — tier 0 still reaches discovery", () => {
  const spec = readSpec();
  assert.ok(spec.includes("tier 0"));
  assert.ok(spec.includes("must not skip model-capability discovery"));
});

test("Law 4: preview-vs-live wording — forbidden terms only inside the forbidden list", () => {
  const spec = readSpec();
  const forbiddenMarker = spec.indexOf("Forbidden as live wording");
  assert.ok(forbiddenMarker > -1, "the forbidden-wording list must be present");
  // allowed-wording vocabulary present
  assert.ok(spec.includes("`session ready`"));
  // every occurrence of the live-claim phrase sits inside/after the forbidden list
  assert.ok(spec.includes("node is born"));
  assert.equal(
    spec.indexOf("node is born") > forbiddenMarker,
    true,
    "`node is born` must not appear as live wording before the forbidden list",
  );
});

test("onboarding-protocol descriptor hashes deterministically and diverges on change", () => {
  const phases = {
    Bond: ["language", "name_bond"],
    Foundation: [
      "technical_level",
      "node_role",
      "purpose",
      "resources",
      "consent_constitution",
    ],
    Discovery: ["asset_map", "model_capability_discovery"],
    FirstMission: ["first_mission"],
  };
  const stages = [...ONBOARDING_LIFECYCLE_STAGE_IDS];
  const laws = [
    "ephemeral_decline",
    "zero_model_bootstrap",
    "model_discovery_independence",
    "preview_vs_live_wording",
  ];

  const hashA = onboardingProtocolDescriptorHash({ phases, stages, laws });
  const hashB = onboardingProtocolDescriptorHash({
    laws: [...laws],
    stages: [...stages],
    phases: {
      FirstMission: ["first_mission"],
      Discovery: ["asset_map", "model_capability_discovery"],
      Foundation: [
        "technical_level",
        "node_role",
        "purpose",
        "resources",
        "consent_constitution",
      ],
      Bond: ["language", "name_bond"],
    },
  });
  const changedHash = onboardingProtocolDescriptorHash({
    phases,
    stages,
    laws: [...laws, "extra_unlawful_step"],
  });

  assert.match(hashA, /^[0-9a-f]{64}$/);
  assert.equal(hashA, hashB);
  assert.notEqual(hashA, changedHash);
});
