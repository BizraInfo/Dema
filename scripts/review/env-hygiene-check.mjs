#!/usr/bin/env node
import { pathToFileURL } from "node:url";

// Known DEMA_* env vars that affect test/runtime behavior. Discovery command
// (run from repo root):
//   grep -rhE 'process\.env\.DEMA_[A-Z0-9_]+' tests/ packages/ apps/ scripts/
//     | grep -oE 'DEMA_[A-Z0-9_]+' | sort -u
//
// T-13 in the companion test asserts this list stays in sync with source
// references — any DEMA_* env var added in source code without being added
// here will fail the test.
//
// Why this list matters: on 2026-05-16 a leaked DEMA_NODE0_ADAPTER=gateway-http
// in the operator shell produced 3 phantom test failures that were reported as
// "pre-existing on main" in PR #44 body, requiring public retraction. This
// gate institutionalizes the verification habit at infrastructure level.
const KNOWN_DEMA_ENV_VARS = Object.freeze([
  "DEMA_AGENT_DB_QUERY_PATH",
  "DEMA_BANNER_INTERACTIVE",
  "DEMA_CI_EVIDENCE_ATTESTATION_JSON",
  "DEMA_CI_EVIDENCE_ATTESTATION_PATH",
  "DEMA_CI_VENDOR_AVAILABILITY_MARKER_PATH",
  "DEMA_CORPUS_INDEX_STDOUT_ENVELOPE",
  "DEMA_CORPUS_SPEND_STDOUT_ENVELOPE",
  "DEMA_DOWNLOADS_ROOT",
  "DEMA_FDE_CI_FAILURE_JSON",
  "DEMA_GATEWAY_URL",
  "DEMA_GGUF_DIRS",
  "DEMA_HOME",
  "DEMA_HOMEBASE_LIVE",
  "DEMA_LLAMACPP_URL",
  "DEMA_LM_STUDIO_URL",
  "DEMA_LOCAL_ASSET_ROOT",
  "DEMA_LOCAL_PROOF_LANE",
  "DEMA_MODELS_SKIP_TCP",
  "DEMA_MODEL_DOWNLOADS_ROOT",
  "DEMA_MUMU_OUT",
  "DEMA_NODE0_ADAPTER",
  "DEMA_NODE0_STATUS_COMMAND",
  "DEMA_NO_TUI",
  "DEMA_OLLAMA_URL",
  "DEMA_TALK_MODEL",
  "DEMA_TALK_PROVIDER",
]);

/** Intentional operator/CI supply vars — tracked in KNOWN list but not strict polluters. */
const STRICT_EXEMPT_DEMA_ENV_VARS = Object.freeze(
  new Set([
    "DEMA_CI_EVIDENCE_ATTESTATION_JSON",
    "DEMA_CI_EVIDENCE_ATTESTATION_PATH",
    "DEMA_CI_VENDOR_AVAILABILITY_MARKER_PATH",
    "DEMA_FDE_CI_FAILURE_JSON",
    "DEMA_LOCAL_PROOF_LANE",
  ]),
);

export function checkEnvHygiene({ env = process.env, strict = false } = {}) {
  const polluters = KNOWN_DEMA_ENV_VARS.filter(
    (name) =>
      !STRICT_EXEMPT_DEMA_ENV_VARS.has(name) &&
      Object.hasOwn(env, name) &&
      env[name] !== undefined &&
      env[name] !== "",
  ).map((name) =>
    Object.freeze({ name, value_length: String(env[name]).length }),
  );

  const ok = polluters.length === 0;
  const remediation = ok
    ? null
    : `env ${polluters.map((p) => `-u ${p.name}`).join(" ")} <command>`;

  return Object.freeze({
    schema: "bizra.dema.review.env_hygiene.v0.1",
    ok,
    strict_mode: strict,
    polluters: Object.freeze(polluters),
    polluter_count: polluters.length,
    known_dema_env_vars: KNOWN_DEMA_ENV_VARS,
    remediation,
  });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const strict = process.argv.includes("--strict");
  const report = checkEnvHygiene({ strict });
  console.log(JSON.stringify(report, null, 2));
  if (strict && !report.ok) {
    process.exit(1);
  }
}
