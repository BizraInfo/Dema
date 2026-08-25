import test from "node:test";
import assert from "node:assert/strict";

import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";
import {
  buildDemaMasterRegistryEffectiveConfigPayload,
  demaMasterRegistryEffectiveConfigBoundary,
  DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_SCHEMA,
  DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_TRUTH_LABEL,
  resolveDemaMasterRegistryEffectiveConfig,
  runDemaMasterRegistryEffectiveConfig,
  verifyDemaMasterRegistryEffectiveConfig,
} from "../packages/core/src/dema-master-registry-effective-config.js";
import { runDemaMasterRegistryEffectiveConfigCheck } from "../scripts/review/dema-master-registry-effective-config-check.mjs";

const REVISION_HASH = `sha256:${"a".repeat(64)}`;

function desiredState({ binding = {}, route = {}, extra = {} } = {}) {
  return {
    schema: "bizra.dema.master_registry.desired.v0.1",
    revision: { id: "mr-001", content_hash: REVISION_HASH },
    policy: { fallback: "DISABLED", locality: "LOCAL_ONLY" },
    bindings: [
      {
        id: "llamacpp-gemma4-12b",
        capability_class: "INFERENCE_PROVIDER",
        model_id: "gemma4-12b",
        admission_state: "ACTIVE",
        qualification_state: "QUALIFIED",
        roles: ["DEMA_FACE"],
        locality: "LOOPBACK",
        authority_class: "PROPOSAL_ONLY",
        ...binding,
      },
    ],
    routes: [
      {
        role: "DEMA_FACE",
        primary_binding_id: "llamacpp-gemma4-12b",
        fallback: "DISABLED",
        ...route,
      },
    ],
    ...extra,
  };
}

function observation({ binding = {}, extra = {} } = {}) {
  return {
    schema: "bizra.dema.master_registry.observation.v0.1",
    mr_revision: { id: "mr-001", content_hash: REVISION_HASH },
    freshness_state: "FRESH",
    bindings: [
      {
        binding_id: "llamacpp-gemma4-12b",
        model_id: "gemma4-12b",
        observation_state: "VERIFIED",
        runtime_state: "READY",
        ...binding,
      },
    ],
    ...extra,
  };
}

const REQUEST = Object.freeze({
  role: "DEMA_FACE",
  locality: "LOOPBACK",
  authority_class: "PROPOSAL_ONLY",
});

function resolverInput(overrides = {}) {
  return {
    desired: desiredState(),
    observed: observation(),
    request: REQUEST,
    ...overrides,
  };
}

function diagnosticCodes(result) {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

test("deterministically resolves one active, ready, qualified primary binding", () => {
  const input = resolverInput();
  const first = resolveDemaMasterRegistryEffectiveConfig(input);
  const second = resolveDemaMasterRegistryEffectiveConfig(input);

  assert.deepEqual(first, second);
  assert.equal(first.resolution_status, "EFFECTIVE");
  assert.equal(first.decision, "SELECT");
  assert.deepEqual(first.selected_route, {
    role: "DEMA_FACE",
    binding_id: "llamacpp-gemma4-12b",
    capability_class: "INFERENCE_PROVIDER",
    model_id: "gemma4-12b",
    locality: "LOOPBACK",
    authority_class: "PROPOSAL_ONLY",
  });
  assert.equal(first.mr_revision.id, "mr-001");
  assert.equal(first.authority_delta, 0);
});

test("native configuration is non-authoritative and a material conflict refuses", () => {
  const matching = resolveDemaMasterRegistryEffectiveConfig(
    resolverInput({
      native_config: {
        source: "environment",
        requested_binding_id: "llamacpp-gemma4-12b",
        requested_model_id: "gemma4-12b",
      },
    }),
  );
  assert.equal(matching.resolution_status, "EFFECTIVE");
  assert.ok(diagnosticCodes(matching).includes("NATIVE_CONFIG_NON_AUTHORITATIVE"));

  const conflicting = resolveDemaMasterRegistryEffectiveConfig(
    resolverInput({
      native_config: {
        source: "environment",
        requested_binding_id: "ollama-fast-model",
      },
    }),
  );
  assert.equal(conflicting.resolution_status, "REFUSED");
  assert.equal(conflicting.selected_route, null);
  assert.ok(diagnosticCodes(conflicting).includes("CONFIG_CONFLICT"));
  assert.doesNotMatch(JSON.stringify(conflicting), /ollama-fast-model/);
});

test("missing verified observation remains UNKNOWN rather than selecting a declared binding", () => {
  const result = resolveDemaMasterRegistryEffectiveConfig(
    resolverInput({ observed: observation({ extra: { bindings: [] } }) }),
  );

  assert.equal(result.resolution_status, "UNKNOWN");
  assert.equal(result.decision, "UNKNOWN");
  assert.equal(result.selected_route, null);
  assert.ok(diagnosticCodes(result).includes("OBSERVATION_MISSING"));
});

test("stale or revision-mismatched evidence remains UNKNOWN", () => {
  const stale = resolveDemaMasterRegistryEffectiveConfig(
    resolverInput({ observed: observation({ extra: { freshness_state: "STALE" } }) }),
  );
  assert.equal(stale.resolution_status, "UNKNOWN");
  assert.ok(diagnosticCodes(stale).includes("OBSERVATION_STALE"));

  const mismatched = resolveDemaMasterRegistryEffectiveConfig(
    resolverInput({
      observed: observation({
        extra: { mr_revision: { id: "mr-002", content_hash: `sha256:${"b".repeat(64)}` } },
      }),
    }),
  );
  assert.equal(mismatched.resolution_status, "UNKNOWN");
  assert.ok(diagnosticCodes(mismatched).includes("OBSERVATION_REVISION_MISMATCH"));
});

test("malformed desired state refuses while malformed observation remains UNKNOWN", () => {
  const invalidDesired = resolveDemaMasterRegistryEffectiveConfig(
    resolverInput({ desired: { schema: "wrong" } }),
  );
  assert.equal(invalidDesired.resolution_status, "REFUSED");
  assert.ok(diagnosticCodes(invalidDesired).includes("DESIRED_INVALID"));

  const invalidObservation = resolveDemaMasterRegistryEffectiveConfig(
    resolverInput({ observed: { schema: "wrong" } }),
  );
  assert.equal(invalidObservation.resolution_status, "UNKNOWN");
  assert.ok(diagnosticCodes(invalidObservation).includes("OBSERVATION_INVALID"));
});

test("route eligibility refuses admission, qualification, locality, authority, and runtime failures", () => {
  const cases = [
    {
      name: "inactive admission",
      input: resolverInput({ desired: desiredState({ binding: { admission_state: "REGISTERED" } }) }),
      code: "BINDING_NOT_ACTIVE",
    },
    {
      name: "unqualified binding",
      input: resolverInput({ desired: desiredState({ binding: { qualification_state: "DISCOVERED" } }) }),
      code: "BINDING_NOT_QUALIFIED",
    },
    {
      name: "locality mismatch",
      input: resolverInput({ desired: desiredState({ binding: { locality: "EXTERNAL" } }) }),
      code: "LOCALITY_REFUSED",
    },
    {
      name: "authority mismatch",
      input: resolverInput({ request: { ...REQUEST, authority_class: "READ_ONLY" } }),
      code: "AUTHORITY_REFUSED",
    },
    {
      name: "offline primary",
      input: resolverInput({ observed: observation({ binding: { runtime_state: "OFFLINE" } }) }),
      code: "PRIMARY_NOT_READY",
    },
  ];

  for (const fixture of cases) {
    const result = resolveDemaMasterRegistryEffectiveConfig(fixture.input);
    assert.equal(result.resolution_status, "REFUSED", fixture.name);
    assert.equal(result.selected_route, null, fixture.name);
    assert.ok(diagnosticCodes(result).includes(fixture.code), fixture.name);
    assert.equal(result.fallback.activated, false, fixture.name);
  }
});

test("a raw secret field is refused and never reflected in the diagnostic output", () => {
  const result = resolveDemaMasterRegistryEffectiveConfig(
    resolverInput({
      desired: desiredState({ extra: { api_token: "do-not-emit-this-secret" } }),
    }),
  );

  assert.equal(result.resolution_status, "REFUSED");
  assert.equal(result.selected_route, null);
  assert.ok(diagnosticCodes(result).includes("RAW_SECRET_REFUSED"));
  assert.doesNotMatch(JSON.stringify(result), /do-not-emit-this-secret/);
});

test("fallback remains disabled when the primary is unavailable", () => {
  const desired = desiredState({
    extra: {
      bindings: [
        ...desiredState().bindings,
        {
          id: "ollama-fast-model",
          capability_class: "INFERENCE_PROVIDER",
          model_id: "llama3.1:8b",
          admission_state: "ACTIVE",
          qualification_state: "QUALIFIED",
          roles: ["DEMA_FACE"],
          locality: "LOOPBACK",
          authority_class: "PROPOSAL_ONLY",
        },
      ],
    },
  });
  const result = resolveDemaMasterRegistryEffectiveConfig(
    resolverInput({ desired, observed: observation({ binding: { runtime_state: "OFFLINE" } }) }),
  );

  assert.equal(result.resolution_status, "REFUSED");
  assert.equal(result.selected_route, null);
  assert.deepEqual(result.fallback, { policy: "DISABLED", activated: false });
  assert.ok(diagnosticCodes(result).includes("PRIMARY_NOT_READY"));
});

test("payload is content-addressed, boundary-complete, and independently re-verifiable", () => {
  const payload = buildDemaMasterRegistryEffectiveConfigPayload(resolverInput());

  assert.equal(payload.schema, DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_SCHEMA);
  assert.equal(payload.truth_label, DEMA_MASTER_REGISTRY_EFFECTIVE_CONFIG_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(payload.resolution_status, "EFFECTIVE");
  assert.equal(payload.boundary.provider_invocation_performed, false);
  assert.equal(payload.boundary.provider_state_changed, false);
  assert.equal(payload.boundary.consent_consumed, false);
  assert.equal(verifyDemaMasterRegistryEffectiveConfig(payload).ok, false);
  assert.equal(
    verifyDemaMasterRegistryEffectiveConfig(payload).blocked_by.includes("independent_input_required"),
    true,
  );
  assert.equal(verifyDemaMasterRegistryEffectiveConfig(payload, resolverInput()).ok, true);
});

test("verification rejects both an un-rehashed edit and a rehashed authority escalation", () => {
  const payload = buildDemaMasterRegistryEffectiveConfigPayload(resolverInput());
  const tampered = { ...payload, truth_label: "FORGED" };
  assert.equal(verifyDemaMasterRegistryEffectiveConfig(tampered, resolverInput()).ok, false);

  const { content_hash, ...body } = payload;
  const escalatedBody = { ...body, authority_delta: 1 };
  const rehashed = {
    ...escalatedBody,
    content_hash: sha256CanonicalJsonV1(escalatedBody),
  };
  const result = verifyDemaMasterRegistryEffectiveConfig(rehashed, resolverInput());
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("authority_delta_nonzero"));
  assert.ok(result.blocked_by.includes("independent_rederivation_mismatch"));
});

test("review gate proves the actual pure resolver contract", () => {
  const result = runDemaMasterRegistryEffectiveConfigCheck();
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.equal(result.resolution_status, "EFFECTIVE");
  assert.equal(result.selected_route.binding_id, "llamacpp-gemma4-12b");
});

test("run exposes no execution, provider, fallback, runtime, or consent authority", () => {
  const result = runDemaMasterRegistryEffectiveConfig({ input: resolverInput() });
  assert.equal(result.ok, true, result.blocked_by?.join(", "));
  assert.deepEqual(result.boundary, demaMasterRegistryEffectiveConfigBoundary());
  assert.equal(result.authority_delta, 0);
  assert.equal(result.fallback.activated, false);
});
