// NODE0-PROOF-ARTIFACT-EXPORT-1A — pure manifest + redaction for Node0 proof replay bundle.
//
// Composes proof ledger, release verdict, and optional CI attestation digests into
// one replayable manifest. Filesystem write stays in scripts/proof/* with micro-consent.
//
// Purity: no fs, no network, no process, no Date/clock. Enforced by kernel-purity.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
  NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
} from "./node0-ci-evidence-attestation.js";
import {
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
} from "./node0-proof-of-truth-control-plane.js";
import {
  NODE0_RELEASE_VERDICT_SCHEMA,
  NODE0_RELEASE_VERDICT_TRUTH_LABEL,
  RELEASE_VERDICT_OVERCLAIM,
  verifyReleaseVerdict,
} from "./node0-release-verdict.js";

export const NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA =
  "bizra.dema.node0_proof_artifact_bundle.v0.1";

export const NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL =
  "NODE0_PROOF_ARTIFACT_BUNDLE_LOCAL_ONLY";

export const NODE0_PROOF_ARTIFACT_BUNDLE_PUBLIC_SAFE_TRUTH_LABEL =
  "NODE0_PROOF_ARTIFACT_BUNDLE_SHARE_SAFE_REDACTED";

export const PROOF_ARTIFACT_WRITE_CONSENT =
  "GO: write node0 proof artifact bundle to artifacts/proofs/node0-proof-artifact-v0.1";

export const PROOF_ARTIFACT_PUBLIC_SAFE_WRITE_CONSENT =
  "GO: write node0 proof artifact bundle to artifacts/proofs/node0-proof-artifact-v0.1-public-safe";

export const PROOF_ARTIFACT_RELATIVE_DIR =
  "artifacts/proofs/node0-proof-artifact-v0.1";

export const PROOF_ARTIFACT_PUBLIC_SAFE_RELATIVE_DIR =
  "artifacts/proofs/node0-proof-artifact-v0.1-public-safe";

export const PROOF_LEDGER_ARTIFACT = "node0-proof-ledger.json";
export const RELEASE_VERDICT_ARTIFACT = "node0-release-verdict.json";
export const CI_ATTESTATION_ARTIFACT = "node0-ci-evidence-attestation.json";
export const MANIFEST_ARTIFACT = "node0-proof-artifact-manifest.json";
export const REPLAY_ARTIFACT = "node0-proof-artifact-replay.txt";

export const REDACTED_PATH_PLACEHOLDER = "<path:redacted>";

const ABSOLUTE_PATH_PATTERN =
  /(?:^|[\s"'(])(\/(?:home|Users|tmp|var|data|opt)[^\s"'(),]*|~\/[^\s"'(),]*|[A-Za-z]:\\[^\s"'(),]*)/g;

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function digestJson(value) {
  return `sha256:${sha256(stableStringify(value))}`;
}

export function evaluateProofArtifactWrite({
  consent_phrase = "",
  allow_write = true,
  required_phrase = PROOF_ARTIFACT_WRITE_CONSENT,
} = {}) {
  const phrase = typeof consent_phrase === "string" ? consent_phrase.trim() : "";
  const violations = [];
  if (!allow_write) violations.push({ code: "write_disabled" });
  if (phrase !== required_phrase) {
    violations.push({ code: "consent_phrase_mismatch" });
  }
  return deepFreeze({
    schema: "bizra.dema.proof_artifact_write_boundary.v0.1",
    mode: "MICRO_CONSENT_GATE",
    allowed: violations.length === 0,
    consent_phrase_required: required_phrase,
    consent_phrase_provided: phrase || null,
    violations: Object.freeze(violations.map((v) => Object.freeze({ ...v }))),
    filesystem_write_performed: false,
    boundary: buildPreviewBoundary(),
  });
}

export function buildNode0ReleaseVerdictArtifact({ ledger, next_action = null } = {}) {
  const verdict = ledger?.release_verdict ?? "BLOCKED";
  const verified = verifyReleaseVerdict(verdict);
  return deepFreeze({
    schema: NODE0_RELEASE_VERDICT_SCHEMA,
    truth_label: NODE0_RELEASE_VERDICT_TRUTH_LABEL,
    verdict,
    verified,
    next_action: next_action ?? ledger?.next_action ?? "Resolve blocking proof rails before release",
    boundary: buildPreviewBoundary(),
  });
}

export function buildNode0ProofArtifactManifest({
  commit,
  ledger,
  release_verdict_artifact,
  ci_evidence_attestation = null,
  attestation_merged = false,
  artifact_dir = PROOF_ARTIFACT_RELATIVE_DIR,
  public_safe = false,
} = {}) {
  if (!commit || String(commit).trim() === "") {
    throw new Error("node0_proof_artifact_bundle: commit required");
  }
  if (!ledger || ledger.schema !== NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA) {
    throw new Error("node0_proof_artifact_bundle: proof ledger required");
  }
  if (
    !release_verdict_artifact ||
    release_verdict_artifact.schema !== NODE0_RELEASE_VERDICT_SCHEMA
  ) {
    throw new Error("node0_proof_artifact_bundle: release verdict artifact required");
  }

  const attestationEntry =
    ci_evidence_attestation && ci_evidence_attestation.schema
      ? Object.freeze({
          path: CI_ATTESTATION_ARTIFACT,
          schema: NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
          truth_label: NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
          commit: ci_evidence_attestation.commit ?? null,
          receipt_hash: ci_evidence_attestation.receipt_hash ?? null,
          rails: Object.freeze({ ...(ci_evidence_attestation.rails ?? {}) }),
        })
      : null;

  const artifacts = Object.freeze({
    proof_ledger: Object.freeze({
      path: PROOF_LEDGER_ARTIFACT,
      schema: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
      truth_label: NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
      receipt_hash: ledger.receipt_hash,
      release_verdict: ledger.release_verdict,
    }),
    release_verdict: Object.freeze({
      path: RELEASE_VERDICT_ARTIFACT,
      schema: NODE0_RELEASE_VERDICT_SCHEMA,
      truth_label: NODE0_RELEASE_VERDICT_TRUTH_LABEL,
      verdict: release_verdict_artifact.verdict,
      verified_ok: release_verdict_artifact.verified?.ok === true,
    }),
    ci_evidence_attestation: attestationEntry,
  });

  const body = {
    schema: NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA,
    truth_label: public_safe
      ? NODE0_PROOF_ARTIFACT_BUNDLE_PUBLIC_SAFE_TRUTH_LABEL
      : NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL,
    commit: String(commit),
    artifact_dir,
    release_verdict: ledger.release_verdict,
    attestation_merged: attestation_merged === true,
    artifacts,
    replay: Object.freeze({
      proof_truth: "npm run proof:truth",
      proof_verdict: "npm run proof:verdict",
      proof_attest_aggregate: "npm run proof:attest:ci:aggregate",
      proof_export: "npm run proof:export",
      apply_attestation:
        'export DEMA_CI_EVIDENCE_ATTESTATION_PATH=/path/to/node0-ci-evidence-attestation-aggregated.json',
      convergence:
        "node apps/cli/src/index.js demo node0-value-loop convergence --json",
    }),
    public_safe: public_safe === true,
    redacted: public_safe === true,
    boundary: buildPreviewBoundary(),
  };

  const manifest_receipt_hash = digestJson(body);
  return deepFreeze({ ...body, manifest_receipt_hash });
}

export function verifyNode0ProofArtifactManifest(manifest) {
  const blocked_by = [];
  if (!manifest || manifest.schema !== NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA) {
    blocked_by.push("invalid_schema");
    return deepFreeze({ ok: false, blocked_by });
  }
  if (
    manifest.truth_label !== NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL &&
    manifest.truth_label !== NODE0_PROOF_ARTIFACT_BUNDLE_PUBLIC_SAFE_TRUTH_LABEL
  ) {
    blocked_by.push("invalid_truth_label");
  }
  if (!manifest.commit || String(manifest.commit).trim() === "") {
    blocked_by.push("missing_commit");
  }
  if (RELEASE_VERDICT_OVERCLAIM.includes(manifest.release_verdict)) {
    blocked_by.push("overclaim_release_verdict");
  }
  if (!manifest.manifest_receipt_hash?.startsWith("sha256:")) {
    blocked_by.push("missing_manifest_receipt_hash");
  }

  const expectedBody = { ...manifest };
  delete expectedBody.manifest_receipt_hash;
  const expectedHash = digestJson(expectedBody);
  if (manifest.manifest_receipt_hash !== expectedHash) {
    blocked_by.push("manifest_receipt_hash_mismatch");
  }

  if (!manifest.artifacts?.proof_ledger?.receipt_hash) {
    blocked_by.push("proof_ledger_digest_missing");
  }
  if (manifest.artifacts?.release_verdict?.verified_ok !== true) {
    blocked_by.push("release_verdict_not_verified");
  }
  if (manifest.attestation_merged === true && !manifest.artifacts?.ci_evidence_attestation) {
    blocked_by.push("attestation_merged_without_artifact");
  }

  return deepFreeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

function redactString(value) {
  if (typeof value !== "string") return value;
  return value.replace(ABSOLUTE_PATH_PATTERN, (match, pathPart) =>
    match.replace(pathPart, REDACTED_PATH_PLACEHOLDER),
  );
}

function redactDeep(value) {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, redactDeep(child)]),
    );
  }
  return value;
}

export function redactNode0ProofArtifactManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("redactNode0ProofArtifactManifest: manifest must be an object");
  }
  if (manifest.redacted === true) return manifest;
  const redactedBody = redactDeep(JSON.parse(JSON.stringify(manifest)));
  delete redactedBody.manifest_receipt_hash;
  redactedBody.artifact_dir =
    manifest.artifact_dir === PROOF_ARTIFACT_RELATIVE_DIR
      ? PROOF_ARTIFACT_PUBLIC_SAFE_RELATIVE_DIR
      : redactString(String(manifest.artifact_dir ?? PROOF_ARTIFACT_PUBLIC_SAFE_RELATIVE_DIR));
  redactedBody.truth_label = NODE0_PROOF_ARTIFACT_BUNDLE_PUBLIC_SAFE_TRUTH_LABEL;
  redactedBody.public_safe = true;
  redactedBody.redacted = true;
  const manifest_receipt_hash = digestJson(redactedBody);
  return deepFreeze({ ...redactedBody, manifest_receipt_hash });
}

export function formatNode0ProofArtifactReplay(manifest) {
  const lines = [
    "DEMA · Node0 proof artifact replay (local-only)",
    "",
    `Schema: ${manifest.schema}`,
    `Truth: ${manifest.truth_label}`,
    `Commit: ${manifest.commit}`,
    `Release verdict: ${manifest.release_verdict}`,
    `Attestation merged: ${manifest.attestation_merged === true}`,
    "",
    "Artifacts:",
    `- ${manifest.artifacts?.proof_ledger?.path} (${manifest.artifacts?.proof_ledger?.receipt_hash ?? "?"})`,
    `- ${manifest.artifacts?.release_verdict?.path} (verdict=${manifest.artifacts?.release_verdict?.verdict ?? "?"})`,
  ];
  if (manifest.artifacts?.ci_evidence_attestation) {
    lines.push(
      `- ${manifest.artifacts.ci_evidence_attestation.path} (${manifest.artifacts.ci_evidence_attestation.receipt_hash ?? "?"})`,
    );
  } else {
    lines.push("- (no CI attestation artifact — advisory rails only)");
  }
  lines.push(
    "",
    "Replay commands:",
    `1. ${manifest.replay?.proof_truth ?? "npm run proof:truth"}`,
    `2. ${manifest.replay?.proof_verdict ?? "npm run proof:verdict"}`,
    `3. ${manifest.replay?.proof_attest_aggregate ?? "npm run proof:attest:ci:aggregate"}`,
    `4. ${manifest.replay?.apply_attestation ?? "export DEMA_CI_EVIDENCE_ATTESTATION_PATH=..."}`,
    `5. ${manifest.replay?.convergence ?? "dema demo node0-value-loop convergence --json"}`,
    "",
    `Manifest receipt: ${manifest.manifest_receipt_hash ?? "?"}`,
    "Boundary: read/list only; no runtime; no mint; no federation; max verdict READY_LOCAL.",
  );
  return lines.join("\n");
}
