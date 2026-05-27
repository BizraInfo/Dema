import {
  generateKeyPairSync,
  createPublicKey,
  createPrivateKey,
  sign,
  verify,
} from "node:crypto";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const AUTHORSHIP_SCHEMA = "bizra.dema.authorship_signature.v0.1";

export { sha256 };

export function generateEd25519Keypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    public_key_pem: publicKey.export({ type: "spki", format: "pem" }),
    private_key_pem: privateKey.export({ type: "pkcs8", format: "pem" }),
    public_key_fingerprint: sha256(
      publicKey.export({ type: "spki", format: "der" }).toString("hex"),
    ),
  };
}

export function buildAuthorshipPayload({
  artifact_path,
  artifact_sha256,
  node = "Node0",
}) {
  if (!artifact_path || typeof artifact_path !== "string") {
    throw new Error("artifact_path is required");
  }
  if (!/^[a-f0-9]{64}$/.test(artifact_sha256 || "")) {
    throw new Error("artifact_sha256 must be sha256 hex");
  }
  return Object.freeze({
    schema: AUTHORSHIP_SCHEMA,
    author: Object.freeze({
      node,
      key_type: "ed25519",
    }),
    artifact: Object.freeze({
      path: artifact_path,
      sha256: artifact_sha256,
    }),
    boundary: Object.freeze({
      network_used: false,
      legal_identity_asserted: false,
      production_claimed: false,
    }),
    truth_label: "LOCAL_AUTHORSHIP_ATTESTED",
  });
}

export function signPayload(payload, privateKeyPem) {
  const privateKey = createPrivateKey(privateKeyPem);
  const message = Buffer.from(stableStringify(payload), "utf8");
  return sign(null, message, privateKey).toString("base64");
}

export function verifyPayload(payload, signatureBase64, publicKeyPem) {
  const publicKey = createPublicKey(publicKeyPem);
  const message = Buffer.from(stableStringify(payload), "utf8");
  return verify(
    null,
    message,
    publicKey,
    Buffer.from(signatureBase64, "base64"),
  );
}

export function buildSignedAuthorshipReceipt({
  artifact_path,
  artifact_sha256,
  private_key_pem,
  public_key_pem,
  public_key_fingerprint,
  node = "Node0",
}) {
  const base = buildAuthorshipPayload({
    artifact_path,
    artifact_sha256,
    node,
  });
  const payload = Object.freeze({
    ...base,
    author: Object.freeze({
      ...base.author,
      public_key_fingerprint,
    }),
  });
  const signature = signPayload(payload, private_key_pem);
  return Object.freeze({
    ...payload,
    signature: Object.freeze({
      algorithm: "ed25519",
      value: signature,
      public_key_pem,
    }),
  });
}
