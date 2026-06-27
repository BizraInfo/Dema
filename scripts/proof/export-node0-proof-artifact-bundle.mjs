#!/usr/bin/env node
// NODE0-PROOF-ARTIFACT-EXPORT-1A — compose proof ledger + verdict + attestation artifacts.
//
// Default: stdout JSON summary (no filesystem write). --write requires exact micro-consent.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildNode0ProofArtifactManifest,
  buildNode0ReleaseVerdictArtifact,
  evaluateProofArtifactWrite,
  formatNode0ProofArtifactReplay,
  verifyNode0ProofArtifactManifest,
  redactNode0ProofArtifactManifest,
  PROOF_ARTIFACT_RELATIVE_DIR,
  PROOF_ARTIFACT_PUBLIC_SAFE_RELATIVE_DIR,
  PROOF_ARTIFACT_WRITE_CONSENT,
  PROOF_ARTIFACT_PUBLIC_SAFE_WRITE_CONSENT,
  PROOF_LEDGER_ARTIFACT,
  RELEASE_VERDICT_ARTIFACT,
  CI_ATTESTATION_ARTIFACT,
  MANIFEST_ARTIFACT,
  REPLAY_ARTIFACT,
  NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA,
  NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL,
} from "../../packages/core/src/node0-proof-artifact-bundle.js";
import { runNode0ProofOfTruthControlPlaneAudit } from "../audit/node0-proof-of-truth-control-plane.mjs";
import {
  buildNode0ProofOfTruthControlPlane,
  HERMETIC_CONTROL_PLANE_FIXTURE,
} from "../../packages/core/src/node0-proof-of-truth-control-plane.js";
import {
  buildNode0CiEvidenceAttestation,
  CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
} from "../../packages/core/src/node0-ci-evidence-attestation.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(dirname(SCRIPT_DIR));

const JSON_MODE = process.argv.includes("--json");
const HERMETIC = process.argv.includes("--hermetic");
const PUBLIC_SAFE = process.argv.includes("--public-safe");
const WRITE = process.argv.includes("--write");

function parseArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function valueAfter(flag) {
  return parseArg(flag, "");
}

export function gatherNode0ProofArtifactBundle(options = {}) {
  const hermetic = options.hermetic ?? HERMETIC;
  let ledger;
  let attestation = options.ci_evidence_attestation ?? null;
  let attestation_merged = false;
  let commit;

  if (hermetic) {
    commit = HERMETIC_CONTROL_PLANE_FIXTURE.commit;
    ledger = buildNode0ProofOfTruthControlPlane({ ...HERMETIC_CONTROL_PLANE_FIXTURE });
    attestation =
      attestation ??
      buildNode0CiEvidenceAttestation({
        commit,
        ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
      });
    attestation_merged = attestation != null;
  } else {
    const audit = runNode0ProofOfTruthControlPlaneAudit({ hermetic: false });
    ledger = audit.ledger;
    commit = ledger.commit;
    attestation = audit.ci_evidence_attestation ?? attestation;
    attestation_merged = audit.attestation_merged === true;
  }

  const release_verdict_artifact = buildNode0ReleaseVerdictArtifact({ ledger });
  const public_safe = options.public_safe ?? PUBLIC_SAFE;
  const artifact_dir = public_safe
    ? PROOF_ARTIFACT_PUBLIC_SAFE_RELATIVE_DIR
    : PROOF_ARTIFACT_RELATIVE_DIR;

  let manifest = buildNode0ProofArtifactManifest({
    commit,
    ledger,
    release_verdict_artifact,
    ci_evidence_attestation: attestation,
    attestation_merged,
    artifact_dir,
    public_safe,
  });
  if (public_safe) {
    manifest = redactNode0ProofArtifactManifest(manifest);
  }

  const verified = verifyNode0ProofArtifactManifest(manifest);
  return Object.freeze({
    ok: verified.ok,
    schema: NODE0_PROOF_ARTIFACT_BUNDLE_SCHEMA,
    truth_label: NODE0_PROOF_ARTIFACT_BUNDLE_TRUTH_LABEL,
    verified,
    manifest,
    ledger,
    release_verdict_artifact,
    ci_evidence_attestation: attestation,
    attestation_merged,
    replay_text: formatNode0ProofArtifactReplay(manifest),
  });
}

function writeArtifactBundle(bundle, { outDir, consent_phrase, public_safe }) {
  const requiredPhrase = public_safe
    ? PROOF_ARTIFACT_PUBLIC_SAFE_WRITE_CONSENT
    : PROOF_ARTIFACT_WRITE_CONSENT;
  const writeCheck = evaluateProofArtifactWrite({
    consent_phrase,
    allow_write: true,
    required_phrase: requiredPhrase,
  });
  if (!writeCheck.allowed) {
    return Object.freeze({
      ok: false,
      reason: "consent_denied",
      write_check: writeCheck,
    });
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, PROOF_LEDGER_ARTIFACT),
    `${JSON.stringify(bundle.ledger, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(outDir, RELEASE_VERDICT_ARTIFACT),
    `${JSON.stringify(bundle.release_verdict_artifact, null, 2)}\n`,
    "utf8",
  );
  if (bundle.ci_evidence_attestation) {
    writeFileSync(
      join(outDir, CI_ATTESTATION_ARTIFACT),
      `${JSON.stringify(bundle.ci_evidence_attestation, null, 2)}\n`,
      "utf8",
    );
  }
  writeFileSync(
    join(outDir, MANIFEST_ARTIFACT),
    `${JSON.stringify(bundle.manifest, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(join(outDir, REPLAY_ARTIFACT), `${bundle.replay_text}\n`, "utf8");

  return Object.freeze({
    ok: true,
    out_dir: outDir,
    manifest_receipt_hash: bundle.manifest.manifest_receipt_hash,
    filesystem_write_performed: true,
    public_safe,
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const bundle = gatherNode0ProofArtifactBundle();
    if (!bundle.ok) {
      throw new Error(
        `export-node0-proof-artifact-bundle: manifest verify failed (${bundle.verified.blocked_by.join(", ")})`,
      );
    }

    let artifact_write = null;
    if (WRITE) {
      const outDir = resolve(
        REPO_ROOT,
        parseArg(
          "--out-dir",
          join(
            REPO_ROOT,
            PUBLIC_SAFE
              ? PROOF_ARTIFACT_PUBLIC_SAFE_RELATIVE_DIR
              : PROOF_ARTIFACT_RELATIVE_DIR,
          ),
        ),
      );
      artifact_write = writeArtifactBundle(bundle, {
        outDir,
        consent_phrase: valueAfter("--consent"),
        public_safe: PUBLIC_SAFE,
      });
      if (!artifact_write.ok) {
        throw new Error(
          `export-node0-proof-artifact-bundle: write denied (${artifact_write.reason})`,
        );
      }
    }

    const result = Object.freeze({
      ok: true,
      schema: bundle.schema,
      truth_label: bundle.manifest.truth_label,
      commit: bundle.manifest.commit,
      release_verdict: bundle.manifest.release_verdict,
      attestation_merged: bundle.attestation_merged,
      manifest_receipt_hash: bundle.manifest.manifest_receipt_hash,
      artifact_write,
      manifest: bundle.manifest,
    });

    if (JSON_MODE) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("DEMA · Node0 proof artifact export (local-only)");
      console.log(`  schema: ${result.schema}`);
      console.log(`  truth: ${result.truth_label}`);
      console.log(`  commit: ${result.commit}`);
      console.log(`  release_verdict: ${result.release_verdict}`);
      console.log(`  attestation_merged: ${result.attestation_merged}`);
      console.log(`  manifest_receipt_hash: ${result.manifest_receipt_hash}`);
      if (artifact_write?.out_dir) {
        console.log(`  out_dir: ${artifact_write.out_dir}`);
      } else {
        console.log(
          `  write: skipped (use --write --consent "${PROOF_ARTIFACT_WRITE_CONSENT}")`,
        );
      }
      console.log("  result: PASS");
    }
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(1);
  }
}
