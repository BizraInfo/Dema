#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  PROOF_ROOM_ARTIFACT_RELATIVE_DIR,
  PROOF_ROOM_PUBLIC_SAFE_ARTIFACT_RELATIVE_DIR,
  PROOF_ROOM_PUBLIC_SAFE_WRITE_CONSENT,
  PROOF_ROOM_WRITE_CONSENT,
  buildProofRoomBundle,
  digestStdout,
  evaluateProofRoomWrite,
  formatProofRoomReport,
  redactProofRoomBundle,
} from "../packages/core/src/proof-room-bundle.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

function usage() {
  return [
    "Usage: node scripts/proof-room-bundle.mjs [--json] [--full] [--public-safe]",
    '       [--write --consent "GO: write proof room bundle to artifacts/proofs/proof-room-v0.1"]',
    '       [--public-safe --write --consent "GO: write proof room bundle to artifacts/proofs/proof-room-v0.1-public-safe"]',
    "",
    "Composes local proof gates (GTM readiness, URP discovery, LLM guidance,",
    "release readiness, git diff --check, node0 self-check verify).",
    "--full also runs npm test. Default mode skips npm test for faster iteration.",
    "--public-safe redacts the operator-absolute repo_root so the artifact",
    "is share-safe (passes Layer 1 artifact-safety eval with PUBLIC_SAFE).",
  ].join("\n");
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

function ordered(value) {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, ordered(value[key])]),
    );
  }
  return value;
}

function contentHash(report) {
  const copy = structuredClone(report);
  delete copy.content_sha256;
  const text = JSON.stringify(ordered(copy), null, 2);
  return digestStdout(text);
}

async function writeBundleArtifacts({
  root,
  report,
  consent_phrase,
  public_safe = false,
}) {
  const requiredPhrase = public_safe
    ? PROOF_ROOM_PUBLIC_SAFE_WRITE_CONSENT
    : PROOF_ROOM_WRITE_CONSENT;
  const writeCheck = evaluateProofRoomWrite({
    consent_phrase,
    allow_write: true,
    required_phrase: requiredPhrase,
  });
  if (!writeCheck.allowed) {
    return { ok: false, reason: "consent_denied", write_check: writeCheck };
  }

  const relativeDir = public_safe
    ? PROOF_ROOM_PUBLIC_SAFE_ARTIFACT_RELATIVE_DIR
    : PROOF_ROOM_ARTIFACT_RELATIVE_DIR;
  const dir = join(root, relativeDir);
  await mkdir(dir, { recursive: true });
  const payload = { ...report, content_sha256: null };
  payload.content_sha256 = contentHash(payload);
  const jsonPath = join(dir, "proof-room-bundle.json");
  const textPath = join(dir, "proof-room-bundle.txt");
  const jsonText = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(jsonPath, jsonText, "utf8");
  await writeFile(textPath, `${formatProofRoomReport(payload)}\n`, "utf8");
  return {
    ok: true,
    json_path: jsonPath,
    text_path: textPath,
    content_sha256: payload.content_sha256,
    filesystem_write_performed: true,
    public_safe,
  };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  const json = argv.includes("--json");
  const full = argv.includes("--full");
  const write = argv.includes("--write");
  const publicSafe = argv.includes("--public-safe");
  const consent = valueAfter(argv, "--consent") ?? "";

  const bundle = await buildProofRoomBundle({ root: REPO_ROOT, full });
  let report = JSON.parse(JSON.stringify(bundle));
  if (publicSafe) {
    report = JSON.parse(JSON.stringify(redactProofRoomBundle(report)));
  }
  if (write) {
    report.artifact_write = await writeBundleArtifacts({
      root: REPO_ROOT,
      report,
      consent_phrase: consent,
      public_safe: publicSafe,
    });
    if (!report.artifact_write.ok) {
      report.ok = false;
    } else {
      report.boundary = {
        ...report.boundary,
        filesystem_write_performed: true,
      };
    }
  }

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatProofRoomReport(report));
    if (report.artifact_write?.ok) {
      console.log("");
      console.log(`Wrote: ${report.artifact_write.json_path}`);
      console.log(`SHA-256: ${report.artifact_write.content_sha256}`);
    } else if (report.artifact_write && !report.artifact_write.ok) {
      console.log("");
      console.log(`Write refused: ${report.artifact_write.reason}`);
    }
  }

  return report.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().then((code) => {
    if (code !== 0) process.exitCode = code;
  });
}
