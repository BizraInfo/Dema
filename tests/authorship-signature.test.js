import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUTHORSHIP_SCHEMA,
  generateEd25519Keypair,
  buildAuthorshipPayload,
  buildSignedAuthorshipReceipt,
  signPayload,
  verifyPayload,
  sha256,
} from "../packages/receipts/src/authorship-signature.js";

function makeKeys() {
  return generateEd25519Keypair();
}

function makeReceipt(keys, overrides = {}) {
  return buildSignedAuthorshipReceipt({
    artifact_path: "docs/example.md",
    artifact_sha256: sha256("hello-bizra"),
    private_key_pem: keys.private_key_pem,
    public_key_pem: keys.public_key_pem,
    public_key_fingerprint: keys.public_key_fingerprint,
    ...overrides,
  });
}

describe("generateEd25519Keypair", () => {
  it("returns PEM keys and fingerprint", () => {
    const keys = makeKeys();
    assert.ok(keys.public_key_pem.startsWith("-----BEGIN PUBLIC KEY-----"));
    assert.ok(keys.private_key_pem.startsWith("-----BEGIN PRIVATE KEY-----"));
    assert.match(keys.public_key_fingerprint, /^[a-f0-9]{64}$/);
  });

  it("generates unique keypairs each call", () => {
    const a = makeKeys();
    const b = makeKeys();
    assert.notEqual(a.public_key_fingerprint, b.public_key_fingerprint);
  });
});

describe("buildAuthorshipPayload", () => {
  it("returns frozen schema-tagged payload", () => {
    const hash = sha256("test");
    const payload = buildAuthorshipPayload({
      artifact_path: "docs/test.md",
      artifact_sha256: hash,
    });
    assert.equal(payload.schema, AUTHORSHIP_SCHEMA);
    assert.equal(payload.author.node, "Node0");
    assert.equal(payload.author.key_type, "ed25519");
    assert.equal(payload.artifact.path, "docs/test.md");
    assert.equal(payload.artifact.sha256, hash);
    assert.equal(payload.truth_label, "LOCAL_AUTHORSHIP_ATTESTED");
    assert.ok(Object.isFrozen(payload));
  });

  it("rejects missing artifact_path", () => {
    assert.throws(
      () => buildAuthorshipPayload({ artifact_sha256: sha256("x") }),
      /artifact_path is required/,
    );
  });

  it("rejects invalid artifact_sha256", () => {
    assert.throws(
      () =>
        buildAuthorshipPayload({
          artifact_path: "x.md",
          artifact_sha256: "not-a-hash",
        }),
      /artifact_sha256 must be sha256 hex/,
    );
  });

  it("accepts custom node name", () => {
    const payload = buildAuthorshipPayload({
      artifact_path: "x.md",
      artifact_sha256: sha256("x"),
      node: "Node1",
    });
    assert.equal(payload.author.node, "Node1");
  });
});

describe("sign and verify", () => {
  it("signs and verifies an authorship receipt", () => {
    const keys = makeKeys();
    const receipt = makeReceipt(keys);

    assert.equal(receipt.schema, AUTHORSHIP_SCHEMA);
    assert.equal(receipt.signature.algorithm, "ed25519");
    assert.ok(receipt.signature.value.length > 0);
    assert.equal(
      receipt.author.public_key_fingerprint,
      keys.public_key_fingerprint,
    );

    const { signature, ...payload } = receipt;
    assert.equal(
      verifyPayload(payload, signature.value, keys.public_key_pem),
      true,
    );
  });

  it("fails verification after payload tampering", () => {
    const keys = makeKeys();
    const receipt = makeReceipt(keys);
    const { signature, ...payload } = receipt;

    const tampered = {
      ...payload,
      artifact: { ...payload.artifact, sha256: sha256("tampered") },
    };
    assert.equal(
      verifyPayload(tampered, signature.value, keys.public_key_pem),
      false,
    );
  });

  it("fails verification with wrong key", () => {
    const keys = makeKeys();
    const otherKeys = makeKeys();
    const receipt = makeReceipt(keys);
    const { signature, ...payload } = receipt;

    assert.equal(
      verifyPayload(payload, signature.value, otherKeys.public_key_pem),
      false,
    );
  });

  it("round-trips signPayload and verifyPayload directly", () => {
    const keys = makeKeys();
    const payload = buildAuthorshipPayload({
      artifact_path: "docs/test.md",
      artifact_sha256: sha256("test"),
    });
    const sig = signPayload(payload, keys.private_key_pem);
    assert.equal(verifyPayload(payload, sig, keys.public_key_pem), true);
  });
});

describe("boundary discipline", () => {
  it("preserves constitutional boundary", () => {
    const keys = makeKeys();
    const receipt = makeReceipt(keys);
    assert.deepEqual(receipt.boundary, {
      network_used: false,
      legal_identity_asserted: false,
      production_claimed: false,
    });
    assert.ok(Object.isFrozen(receipt.boundary));
  });

  it("receipt is deeply frozen", () => {
    const keys = makeKeys();
    const receipt = makeReceipt(keys);
    assert.ok(Object.isFrozen(receipt));
    assert.ok(Object.isFrozen(receipt.author));
    assert.ok(Object.isFrozen(receipt.artifact));
    assert.ok(Object.isFrozen(receipt.signature));
  });
});

describe("determinism", () => {
  it("same payload produces same signature with same key", () => {
    const keys = makeKeys();
    const payload = buildAuthorshipPayload({
      artifact_path: "docs/stable.md",
      artifact_sha256: sha256("stable"),
    });
    const sig1 = signPayload(payload, keys.private_key_pem);
    const sig2 = signPayload(payload, keys.private_key_pem);
    assert.equal(sig1, sig2);
  });
});
