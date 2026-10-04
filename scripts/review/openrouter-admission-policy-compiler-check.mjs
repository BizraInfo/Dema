#!/usr/bin/env node
// OPENROUTER-ADMISSION-POLICY-COMPILER-1A — static, no-network review gate.

import { pathToFileURL } from "node:url";

import {
  runOpenrouterAdmissionPolicyCompiler,
  OPENROUTER_ADMISSION_POLICY_COMPILER_SCHEMA,
  OPENROUTER_ADMISSION_POLICY_COMPILER_TRUTH_LABEL,
} from "../../packages/core/src/openrouter-admission-policy-compiler.js";

const JSON_MODE = process.argv.includes("--json");

const STATIC_INPUT = Object.freeze({
  mr_revision: Object.freeze({
    id: "mr-external-001",
    content_hash: `sha256:${"a".repeat(64)}`,
  }),
  route: Object.freeze({
    binding_id: "openrouter-evaluation-001",
    model_id: "example/model:free",
    locality: "EXTERNAL",
    authority_class: "PROPOSAL_ONLY",
    purpose: "EXPERIMENTAL_EVALUATION",
  }),
  policy: Object.freeze({
    provider_id: "openrouter",
    credential_ref: "native_auth/openrouter",
    underlying_provider_allowlist: Object.freeze(["example-provider"]),
    fallback: "DISABLED",
    data_collection: "DENY",
    zero_data_retention: "REQUIRED",
    router_metadata: "REQUIRED",
  }),
});

export function runOpenrouterAdmissionPolicyCompilerCheck() {
  return runOpenrouterAdmissionPolicyCompiler({ input: STATIC_INPUT });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runOpenrouterAdmissionPolicyCompilerCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA - OPENROUTER-ADMISSION-POLICY-COMPILER-1A");
    console.log(`  schema: ${OPENROUTER_ADMISSION_POLICY_COMPILER_SCHEMA}`);
    console.log(`  truth: ${OPENROUTER_ADMISSION_POLICY_COMPILER_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) for (const code of result.blocked_by) console.log(`    ${code}`);
  }
  if (!result.ok) process.exit(1);
}
