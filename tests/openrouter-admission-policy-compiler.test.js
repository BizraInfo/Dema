import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { sha256CanonicalJsonV1 } from "../packages/canon/src/sha256-canonical-json-v1.js";
import {
  compileOpenrouterAdmissionPolicy,
  buildOpenrouterAdmissionPolicyCompilerPayload,
  verifyOpenrouterAdmissionPolicyCompiler,
  runOpenrouterAdmissionPolicyCompiler,
  openrouterAdmissionPolicyCompilerBoundary,
  OPENROUTER_ADMISSION_POLICY_COMPILER_SCHEMA,
  OPENROUTER_ADMISSION_POLICY_COMPILER_TRUTH_LABEL,
} from "../packages/core/src/openrouter-admission-policy-compiler.js";
import { runOpenrouterAdmissionPolicyCompilerCheck } from "../scripts/review/openrouter-admission-policy-compiler-check.mjs";

function fixture(overrides = {}) {
  const base = {
    mr_revision: {
      id: "mr-external-001",
      content_hash: `sha256:${"a".repeat(64)}`,
    },
    route: {
      binding_id: "openrouter-evaluation-001",
      model_id: "example/model:free",
      locality: "EXTERNAL",
      authority_class: "PROPOSAL_ONLY",
      purpose: "EXPERIMENTAL_EVALUATION",
    },
    policy: {
      provider_id: "openrouter",
      credential_ref: "native_auth/openrouter",
      underlying_provider_allowlist: ["example-provider"],
      fallback: "DISABLED",
      data_collection: "DENY",
      zero_data_retention: "REQUIRED",
      router_metadata: "REQUIRED",
    },
  };
  return {
    ...base,
    ...overrides,
    route: { ...base.route, ...overrides.route },
    policy: { ...base.policy, ...overrides.policy },
  };
}

function codes(result) {
  return result.diagnostics.map(({ code }) => code);
}

test("deterministically compiles one explicitly constrained external proposal plan", () => {
  const first = compileOpenrouterAdmissionPolicy(fixture());
  const second = compileOpenrouterAdmissionPolicy(fixture());

  assert.deepEqual(first, second);
  assert.equal(first.compilation_status, "ADMITTED");
  assert.equal(first.processing_classification, "EXTERNAL_PROCESSING");
  assert.deepEqual(first.consent, { required: true, status: "NOT_REQUESTED" });
  assert.deepEqual(first.plan.provider, {
    only: ["example-provider"],
    allow_fallbacks: false,
    data_collection: "deny",
    zdr: true,
  });
  assert.equal(first.plan.request_headers["X-OpenRouter-Metadata"], "enabled");
});

test("requires the complete external privacy, allowlist, metadata, and no-fallback policy", () => {
  for (const [field, value, expected] of [
    ["fallback", "ALLOWED", "FALLBACK_NOT_DISABLED"],
    ["data_collection", "ALLOW", "DATA_COLLECTION_NOT_DENIED"],
    ["zero_data_retention", "OPTIONAL", "ZDR_NOT_REQUIRED"],
    ["router_metadata", "OPTIONAL", "ROUTER_METADATA_NOT_REQUIRED"],
  ]) {
    const result = compileOpenrouterAdmissionPolicy(fixture({ policy: { [field]: value } }));
    assert.equal(result.compilation_status, "REFUSED");
    assert.ok(codes(result).includes(expected));
    assert.equal(result.plan, null);
  }

  const missingAllowlist = compileOpenrouterAdmissionPolicy(
    fixture({ policy: { underlying_provider_allowlist: [] } }),
  );
  assert.ok(codes(missingAllowlist).includes("PROVIDER_ALLOWLIST_INVALID"));
});

test("refuses random free routing and keeps an explicit free variant evaluation-only", () => {
  const random = compileOpenrouterAdmissionPolicy(fixture({ route: { model_id: "openrouter/free" } }));
  assert.ok(codes(random).includes("RANDOM_FREE_ROUTER_REFUSED"));

  const broadened = compileOpenrouterAdmissionPolicy(
    fixture({ route: { purpose: "EXTERNAL_SPECIALIST" } }),
  );
  assert.ok(codes(broadened).includes("FREE_VARIANT_EVALUATION_ONLY"));
});

test("refuses unsupported route authority, locality, and provider identity", () => {
  for (const [input, expected] of [
    [fixture({ route: { locality: "LOCAL" } }), "EXTERNAL_ROUTE_INVALID"],
    [fixture({ route: { authority_class: "READ_ONLY" } }), "EXTERNAL_ROUTE_INVALID"],
    [fixture({ policy: { provider_id: "not-openrouter" } }), "PROVIDER_REFUSED"],
  ]) {
    const result = compileOpenrouterAdmissionPolicy(input);
    assert.equal(result.compilation_status, "REFUSED");
    assert.ok(codes(result).includes(expected));
  }
});

test("raw credential material and supplied self-consent are refused without output leakage", () => {
  const rawSecret = "not-a-real-openrouter-key";
  const secret = compileOpenrouterAdmissionPolicy({ ...fixture(), api_key: rawSecret });
  assert.equal(secret.compilation_status, "REFUSED");
  assert.ok(codes(secret).includes("RAW_SECRET_REFUSED"));
  assert.equal(JSON.stringify(secret).includes(rawSecret), false);

  const selfConsent = compileOpenrouterAdmissionPolicy({ ...fixture(), consent: "GO: self-authorize" });
  assert.ok(codes(selfConsent).includes("INPUT_INVALID"));
  assert.deepEqual(selfConsent.consent, { required: true, status: "NOT_REQUESTED" });
});

test("only the approved native credential reference is admitted and never becomes an Authorization value", () => {
  const invalid = compileOpenrouterAdmissionPolicy(
    fixture({ policy: { credential_ref: "native_auth/other" } }),
  );
  assert.ok(codes(invalid).includes("CREDENTIAL_REFERENCE_INVALID"));

  const result = compileOpenrouterAdmissionPolicy(fixture());
  assert.equal(result.plan.credential_ref, "native_auth/openrouter");
  assert.equal(Object.hasOwn(result.plan.request_headers, "Authorization"), false);
});

test("payload is content-addressed, non-executable, and independently re-verifiable", () => {
  const payload = buildOpenrouterAdmissionPolicyCompilerPayload(fixture());
  assert.equal(payload.schema, OPENROUTER_ADMISSION_POLICY_COMPILER_SCHEMA);
  assert.equal(payload.truth_label, OPENROUTER_ADMISSION_POLICY_COMPILER_TRUTH_LABEL);
  assert.match(payload.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(payload.boundary, openrouterAdmissionPolicyCompilerBoundary());
  assert.equal(verifyOpenrouterAdmissionPolicyCompiler(payload).ok, false);
  assert.ok(verifyOpenrouterAdmissionPolicyCompiler(payload).blocked_by.includes("independent_input_required"));
  assert.equal(verifyOpenrouterAdmissionPolicyCompiler(payload, fixture()).ok, true);
});

test("verification rejects both ordinary tampering and a rehashed authority escalation", () => {
  const payload = buildOpenrouterAdmissionPolicyCompilerPayload(fixture());
  assert.equal(
    verifyOpenrouterAdmissionPolicyCompiler({ ...payload, truth_label: "FORGED" }, fixture()).ok,
    false,
  );

  const { content_hash, ...body } = payload;
  const escalatedBody = { ...body, authority_delta: 1 };
  const rehashed = {
    ...escalatedBody,
    content_hash: sha256CanonicalJsonV1(escalatedBody),
  };
  const result = verifyOpenrouterAdmissionPolicyCompiler(rehashed, fixture());
  assert.equal(result.ok, false);
  assert.ok(result.blocked_by.includes("authority_delta_nonzero"));
  assert.ok(result.blocked_by.includes("independent_rederivation_mismatch"));
});

test("review gate proves a static compiler fixture without contacting OpenRouter", () => {
  const result = runOpenrouterAdmissionPolicyCompilerCheck();
  assert.equal(result.ok, true, result.blocked_by.join(", "));
  assert.equal(result.compilation_status, "ADMITTED");
  assert.equal(result.plan.model_id, "example/model:free");
  assert.equal(result.boundary.network_used, false);
});

test("run exposes no invocation, provider-state, fallback, consent, credit, receipt, or runtime authority", () => {
  const result = runOpenrouterAdmissionPolicyCompiler({ input: fixture() });
  assert.equal(result.ok, true, result.blocked_by.join(", "));
  assert.equal(result.authority_delta, 0);
  assert.deepEqual(result.boundary, openrouterAdmissionPolicyCompilerBoundary());
  assert.equal(result.consent.status, "NOT_REQUESTED");
  assert.equal(result.plan.provider.allow_fallbacks, false);
});

test("canonical all-agent flow defines policy, boundary, constitution, and no self-consent", () => {
  const flow = readFileSync(new URL("../docs/LLM_SYSTEM_FLOW.md", import.meta.url), "utf8");
  assert.match(flow, /Policy can narrow choices or refuse a request; it never creates authority\./);
  assert.match(flow, /An all-false boundary means no execution, network, provider call, state change,/);
  assert.match(flow, /A model, CLI, adapter, or deterministic harness cannot grant itself consent,/);
  assert.match(flow, /Stop at `UNKNOWN` or `REFUSED`\./);
});
