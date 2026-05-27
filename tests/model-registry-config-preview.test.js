import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import {
  DEFAULT_SAMPLE_REGISTRY,
  LOCAL_MODEL_REGISTRY_CONFIG_SCHEMA,
  buildRegistryFromConfig,
  mergeRegistries,
  validateRegistryEntry,
  buildLocalModelRegistryConfigPreview,
} from "../packages/models/src/model-registry-config-preview.js";

import {
  buildModelBrokerPreview,
  routeForTask,
} from "../packages/models/src/model-broker-preview.js";

const PLACEHOLDER_ROLES = [
  "dema_face",
  "pat_worker",
  "sat_validator",
  "router",
  "classifier",
  "consent_detector",
];

test("DEFAULT_SAMPLE_REGISTRY contains exactly the 6 placeholder roles named by the architect", () => {
  assert.equal(DEFAULT_SAMPLE_REGISTRY.length, 6);
  const sampleRoles = DEFAULT_SAMPLE_REGISTRY.map((e) => e.role);
  for (const expectedRole of PLACEHOLDER_ROLES) {
    assert.ok(
      sampleRoles.includes(expectedRole),
      `expected role ${expectedRole} in sample registry, got ${JSON.stringify(sampleRoles)}`,
    );
  }
});

test("every sample entry is an honest placeholder (no claimed real model identity)", () => {
  for (const entry of DEFAULT_SAMPLE_REGISTRY) {
    assert.equal(
      entry.status,
      "source_pending",
      `entry ${entry.id} should be source_pending`,
    );
    assert.equal(
      entry.locality,
      "unknown",
      `entry ${entry.id} should be locality=unknown`,
    );
    assert.equal(
      entry.provider,
      "unknown",
      `entry ${entry.id} should be provider=unknown`,
    );
    assert.equal(
      entry.size_class,
      "unknown",
      `entry ${entry.id} should be size_class=unknown`,
    );
    assert.deepEqual(
      entry.allowed_tasks,
      [],
      `entry ${entry.id} should have empty allowed_tasks`,
    );
    assert.equal(entry.context_limit, null);
    // id must contain "placeholder" — no real model name leakage allowed.
    assert.ok(
      entry.id.includes("placeholder"),
      `entry id ${entry.id} should contain "placeholder" to mark it as a non-real entry`,
    );
    // model_name matches id (no real name).
    assert.equal(entry.model_name, entry.id);
  }
});

test("validateRegistryEntry accepts a well-formed operator entry", () => {
  const validEntry = {
    id: "operator-test-7b",
    provider: "ollama",
    model_name: "operator-test-7b",
    role: "pat_worker",
    size_class: "7B",
    locality: "local",
    allowed_tasks: ["planning"],
    max_concurrency: 2,
    context_limit: 16384,
    status: "active",
  };
  assert.equal(validateRegistryEntry(validEntry), true);
});

test("validateRegistryEntry rejects malformed and null entries without throwing", () => {
  assert.equal(validateRegistryEntry(null), false);
  assert.equal(validateRegistryEntry(undefined), false);
  assert.equal(validateRegistryEntry({}), false);
  assert.equal(validateRegistryEntry({ id: "" }), false);
  assert.equal(validateRegistryEntry({ id: "x" }), false); // missing required fields
  // Wrong role
  assert.equal(
    validateRegistryEntry({
      id: "x",
      role: "not-a-real-role",
      size_class: "7B",
      locality: "local",
      status: "active",
    }),
    false,
  );
  // Wrong size_class
  assert.equal(
    validateRegistryEntry({
      id: "x",
      role: "pat_worker",
      size_class: "999B",
      locality: "local",
      status: "active",
    }),
    false,
  );
  // Wrong locality
  assert.equal(
    validateRegistryEntry({
      id: "x",
      role: "pat_worker",
      size_class: "7B",
      locality: "moon",
      status: "active",
    }),
    false,
  );
  // Wrong status
  assert.equal(
    validateRegistryEntry({
      id: "x",
      role: "pat_worker",
      size_class: "7B",
      locality: "local",
      status: "imaginary",
    }),
    false,
  );
});

test("buildRegistryFromConfig returns frozen sanitized registry array from { entries }", () => {
  const config = {
    entries: [
      {
        id: "test-dema-face",
        provider: "ollama",
        role: "dema_face",
        size_class: "32B",
        locality: "local",
        status: "active",
        allowed_tasks: ["synthesis"],
        max_concurrency: 1,
        context_limit: 32768,
      },
    ],
  };
  const registry = buildRegistryFromConfig(config);
  assert.ok(Array.isArray(registry));
  assert.equal(registry.length, 1);
  assert.equal(registry[0].id, "test-dema-face");
  assert.equal(registry[0].role, "dema_face");
  // Frozen at top + child level.
  assert.equal(Object.isFrozen(registry), true);
  assert.equal(Object.isFrozen(registry[0]), true);
});

test("buildRegistryFromConfig drops malformed entries safely; passing array directly also works", () => {
  // Mixed valid + malformed entries.
  const config = {
    entries: [
      null,
      undefined,
      "string-not-object",
      {
        /* missing id */ role: "pat_worker",
        size_class: "7B",
        locality: "local",
        status: "active",
      },
      {
        id: "",
        role: "pat_worker",
        size_class: "7B",
        locality: "local",
        status: "active",
      }, // empty id
      {
        id: "real-pat-7b",
        provider: "ollama",
        role: "pat_worker",
        size_class: "7B",
        locality: "local",
        status: "active",
        allowed_tasks: ["planning"],
        max_concurrency: 2,
        context_limit: 8192,
      },
    ],
  };
  const registry = buildRegistryFromConfig(config);
  assert.equal(registry.length, 1, "only the one valid entry should survive");
  assert.equal(registry[0].id, "real-pat-7b");

  // Array passed directly is also accepted.
  const directArray = [
    {
      id: "x",
      role: "pat_worker",
      size_class: "7B",
      locality: "local",
      status: "active",
    },
  ];
  const direct = buildRegistryFromConfig(directArray);
  assert.equal(direct.length, 1);
  assert.equal(direct[0].id, "x");

  // Non-array / non-config input returns frozen empty array.
  assert.equal(buildRegistryFromConfig(null).length, 0);
  assert.equal(buildRegistryFromConfig("garbage").length, 0);
  assert.equal(buildRegistryFromConfig({ no_entries_here: true }).length, 0);
});

test("mergeRegistries uses operator-wins precedence on id conflicts", () => {
  const sample = [
    {
      id: "shared-id",
      provider: "unknown",
      role: "dema_face",
      size_class: "unknown",
      locality: "unknown",
      status: "source_pending",
      allowed_tasks: [],
      max_concurrency: 0,
      context_limit: null,
    },
    {
      id: "sample-only-id",
      provider: "unknown",
      role: "pat_worker",
      size_class: "unknown",
      locality: "unknown",
      status: "source_pending",
      allowed_tasks: [],
      max_concurrency: 0,
      context_limit: null,
    },
  ];
  const operator = [
    {
      id: "shared-id",
      provider: "ollama",
      role: "dema_face",
      size_class: "32B",
      locality: "local",
      status: "active",
      allowed_tasks: ["synthesis"],
      max_concurrency: 1,
      context_limit: 32768,
    },
    {
      id: "operator-only-id",
      provider: "ollama",
      role: "sat_validator",
      size_class: "4B",
      locality: "local",
      status: "active",
      allowed_tasks: ["claim_review"],
      max_concurrency: 1,
      context_limit: 8192,
    },
  ];
  const merged = mergeRegistries(sample, operator);
  // 3 unique ids total (shared collapsed to operator).
  assert.equal(merged.length, 3);

  const sharedEntry = merged.find((e) => e.id === "shared-id");
  assert.ok(sharedEntry, "shared-id should be in merged");
  // Operator wins: status should be "active", not "source_pending".
  assert.equal(sharedEntry.status, "active");
  assert.equal(sharedEntry.locality, "local");
  assert.equal(sharedEntry.size_class, "32B");

  // Sample-only and operator-only are preserved.
  assert.ok(merged.find((e) => e.id === "sample-only-id"));
  assert.ok(merged.find((e) => e.id === "operator-only-id"));

  // Frozen output.
  assert.equal(Object.isFrozen(merged), true);
});

test("default sample registry alone feeds broker and routes nothing (placeholder discipline)", () => {
  // The broker built from only the sample placeholders should reject every
  // entry (status=source_pending) and return selected_model_id=null.
  const broker = buildModelBrokerPreview({ registry: DEFAULT_SAMPLE_REGISTRY });
  const receipt = routeForTask(broker, { task_kind: "synthesis" });
  assert.equal(receipt.selected_model_id, null);
  assert.equal(receipt.reason, "no_acceptable_candidate");
  // Every sample entry should appear in rejected_candidates with reason
  // referencing source_pending.
  assert.ok(
    receipt.rejected_candidates.length >= 1,
    "expected at least one rejection",
  );
  // Find a sample-id rejection and confirm its reason names source_pending.
  const samplePlaceholderRejection = receipt.rejected_candidates.find(
    (r) =>
      r.model_id.startsWith("operator-") && r.model_id.endsWith("-placeholder"),
  );
  assert.ok(
    samplePlaceholderRejection,
    "expected at least one placeholder in rejections",
  );
  assert.match(samplePlaceholderRejection.reason, /source_pending|unknown/);
});

test("operator-provided local Dema face entry feeds broker and routes synthesis to that model", () => {
  const operatorConfig = {
    entries: [
      {
        id: "operator-real-dema-face",
        provider: "ollama",
        model_name: "operator-real-dema-face",
        role: "dema_face",
        size_class: "32B",
        locality: "local",
        allowed_tasks: ["synthesis", "summarization"],
        max_concurrency: 1,
        context_limit: 32768,
        status: "active",
      },
    ],
  };
  // Build the operator registry from config, merge with the sample, and
  // feed the broker. Synthesis task should route to the operator entry,
  // not to any placeholder.
  const operatorRegistry = buildRegistryFromConfig(operatorConfig);
  const merged = mergeRegistries(DEFAULT_SAMPLE_REGISTRY, operatorRegistry);
  const broker = buildModelBrokerPreview({ registry: merged });
  const receipt = routeForTask(broker, { task_kind: "synthesis" });
  assert.equal(receipt.selected_model_id, "operator-real-dema-face");
  assert.equal(receipt.selected_model_role, "dema_face");
  assert.equal(receipt.selected_model_locality, "local");
});

test("buildLocalModelRegistryConfigPreview returns a schema-tagged envelope with zero-effect boundary", () => {
  const envelope = buildLocalModelRegistryConfigPreview({
    entries: [
      {
        id: "operator-real-pat",
        provider: "ollama",
        role: "pat_worker",
        size_class: "7B",
        locality: "local",
        status: "active",
        allowed_tasks: ["planning"],
        max_concurrency: 2,
        context_limit: 16384,
      },
    ],
  });
  assert.equal(envelope.schema, LOCAL_MODEL_REGISTRY_CONFIG_SCHEMA);
  assert.equal(envelope.mode, "PREVIEW_ONLY");
  assert.equal(envelope.source, "config_input");
  assert.equal(envelope.registry.length, 1);
  assert.equal(envelope.registry[0].id, "operator-real-pat");

  // Placeholder roles array.
  assert.deepEqual(envelope.placeholder_roles, PLACEHOLDER_ROLES);

  // Canon refs all 4.
  assert.equal(envelope.canon_refs.length, 4);

  // Boundary declares no effects.
  assert.equal(envelope.boundary.runtime, false);
  assert.equal(envelope.boundary.file_io, false);
  assert.equal(envelope.boundary.network_used, false);
  assert.equal(envelope.boundary.model_invocation, false);
  assert.equal(envelope.boundary.federation, false);
  assert.equal(envelope.boundary.mint, false);
  assert.equal(envelope.boundary.token_economy, false);
  assert.equal(envelope.boundary.urp_networking, false);

  // Frozen deeply.
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(Object.isFrozen(envelope.registry), true);
  assert.equal(Object.isFrozen(envelope.boundary), true);
});

test("module is a pure preview: no fs/network/child_process imports", () => {
  // Read the source verbatim and grep for forbidden imports. The module
  // should not pull in fs/promises, fs, http, https, net, child_process,
  // or anything that could load a model.
  const thisFile = fileURLToPath(import.meta.url);
  const moduleSrcPath = join(
    dirname(thisFile),
    "..",
    "packages",
    "models",
    "src",
    "model-registry-config-preview.js",
  );
  const src = readFileSync(moduleSrcPath, "utf8");
  const forbidden = [
    "node:fs",
    "node:fs/promises",
    "node:http",
    "node:https",
    "node:net",
    "node:child_process",
    "import 'fs'",
    'import "fs"',
    'require("fs")',
    "require('fs')",
  ];
  for (const f of forbidden) {
    assert.ok(
      !src.includes(f),
      `model-registry-config-preview.js must not import ${f} (got it in source)`,
    );
  }
});
