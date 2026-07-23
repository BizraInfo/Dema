import { readFile, writeFile, stat, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash, createPublicKey } from "node:crypto";
import {
  buildSignedAuthorshipReceipt,
  verifyPayload,
} from "./authorship-signature.js";
import {
  hasAuthorshipKey,
  loadActiveKeyPair,
} from "./authorship-key-store.js";
import { sha256 } from "../../consent/src/consent-common.js";

export const SIGN_CONSENT_PHRASE = "SIGN AUTHORSHIP RECEIPT";
export const SIGN_RESULT_SCHEMA = "bizra.dema.authorship_sign_result.v0.1";

const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;

function demaHome(override) {
  if (typeof override === "string" && override.length > 0) return override;
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function receiptsDir(home) {
  return join(home, "receipts");
}

export async function signArtifact({
  artifactPath,
  consent,
  demaHome: homeOverride,
} = {}) {
  if (consent !== SIGN_CONSENT_PHRASE) {
    return fail("consent_required", { required_phrase: SIGN_CONSENT_PHRASE });
  }

  if (!artifactPath || typeof artifactPath !== "string") {
    return fail("artifact_path_required");
  }

  let artifactStat;
  try {
    artifactStat = await stat(artifactPath);
  } catch {
    return fail("artifact_not_found", { path: artifactPath });
  }

  if (!artifactStat.isFile()) {
    return fail("artifact_not_file", { path: artifactPath });
  }

  if (artifactStat.size > MAX_ARTIFACT_BYTES) {
    return fail("artifact_too_large", {
      path: artifactPath,
      size: artifactStat.size,
      max: MAX_ARTIFACT_BYTES,
    });
  }

  const home = demaHome(homeOverride);

  if (!(await hasAuthorshipKey(home))) {
    return fail("key_not_initialized");
  }

  const artifactBytes = await readFile(artifactPath);
  if (artifactBytes.length > MAX_ARTIFACT_BYTES) {
    return fail("artifact_too_large", {
      path: artifactPath,
      size: artifactBytes.length,
      max: MAX_ARTIFACT_BYTES,
    });
  }
  const artifactSha256 = createHash("sha256")
    .update(artifactBytes)
    .digest("hex");

  const activePair = await loadActiveKeyPair(home);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  if (!privateKeyPem) {
    return fail("private_key_not_readable");
  }
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;
  if (!publicKeyPem) {
    return fail("public_key_not_readable");
  }

  let receipt;
  let fingerprint;
  try {
    fingerprint = sha256(
      createPublicKey(publicKeyPem)
        .export({ type: "spki", format: "der" })
        .toString("hex"),
    );
    receipt = buildSignedAuthorshipReceipt({
      artifact_path: artifactPath,
      artifact_sha256: artifactSha256,
      private_key_pem: privateKeyPem,
      public_key_pem: publicKeyPem,
      public_key_fingerprint: fingerprint,
    });
  } catch {
    return fail("signing_failed");
  }

  const { signature, ...payload } = receipt;
  let selfVerify;
  try {
    selfVerify = verifyPayload(payload, signature.value, publicKeyPem);
  } catch {
    return fail("self_verify_failed");
  }
  if (!selfVerify) {
    return fail("self_verify_failed");
  }

  const receiptJson = JSON.stringify(receipt, null, 2);
  const receiptHash = sha256(receiptJson);
  const receiptFilename = `authorship-${receiptHash}.json`;
  const receiptDir = receiptsDir(home);
  await mkdir(receiptDir, { recursive: true });

  const tmpPath = join(
    receiptDir,
    `.tmp-${receiptFilename}.${process.pid}.${Date.now()}`,
  );
  const finalPath = join(receiptDir, receiptFilename);
  await writeFile(tmpPath, receiptJson, { encoding: "utf8", flag: "wx" });
  await rename(tmpPath, finalPath);

  return Object.freeze({
    schema: SIGN_RESULT_SCHEMA,
    signed: true,
    receipt_path: finalPath,
    receipt_hash: receiptHash,
    artifact_sha256: artifactSha256,
    public_key_fingerprint: fingerprint,
    self_verified: true,
    boundary: Object.freeze({
      network_used: false,
      federation_used: false,
      token_minted: false,
      consent_collected: true,
      receipt_written: true,
      artifact_mutated: false,
      private_key_exposed: false,
    }),
  });
}

function fail(error, details = {}) {
  return Object.freeze({
    schema: SIGN_RESULT_SCHEMA,
    signed: false,
    error,
    ...details,
    boundary: Object.freeze({
      network_used: false,
      federation_used: false,
      token_minted: false,
      consent_collected: false,
      receipt_written: false,
      artifact_mutated: false,
      private_key_exposed: false,
    }),
  });
}
