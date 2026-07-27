import {
  generateEd25519Keypair,
  buildSignedAuthorshipReceipt,
  verifyPayload,
  sha256 as authorshipSha256,
} from "../../../../packages/receipts/src/authorship-signature.js";
import {
  initAuthorshipKey,
  migrateLegacyAuthorshipKey,
  KEY_INIT_CONSENT_PHRASE,
  KEY_MIGRATE_CONSENT_PHRASE,
  loadAuthorshipTrustSnapshot,
} from "../../../../packages/receipts/src/authorship-key-store.js";
import {
  signArtifact,
  SIGN_CONSENT_PHRASE,
} from "../../../../packages/receipts/src/authorship-sign-command.js";
import {
  getLatestAuthorshipReceiptSummary,
  findLatestAuthorshipReceipt,
} from "../../../../packages/receipts/src/authorship-latest.js";
import {
  verifyAuthorshipReceiptFile,
  formatAuthorshipVerification,
} from "../../../../packages/receipts/src/authorship-verify.js";
import {
  buildAuthorshipCloseout,
  formatAuthorshipCloseout,
} from "../../../../packages/receipts/src/authorship-closeout.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_authorship(ctx) {
  const { argv } = ctx;
  const subCmdA = argv[1] ?? "";
  const wantJsonA = wantsJson(argv);

  if (subCmdA === "key" && (argv[2] === "init" || !argv[2])) {
    const consent = argValue(argv, "--consent") ?? "";
    const result = await initAuthorshipKey({ consent });
    if (wantJsonA) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.initialized) {
      console.log("Authorship Key Initialized");
      console.log("=".repeat(40));
      console.log(`  Fingerprint: ${result.public_key_fingerprint}`);
      console.log(`  Private key: ${result.private_key_path}`);
      console.log(`  Public key:  ${result.public_key_path}`);
    } else if (result.error === "consent_required") {
      console.error(
        `Consent required. Use: --consent "${KEY_INIT_CONSENT_PHRASE}"`,
      );
    } else if (result.error === "key_already_exists") {
      console.error(
        `Key already exists at ${result.private_key_path}. Use dema authorship key rotate (future) to replace.`,
      );
    } else if (result.error === "unsafe_key_path") {
      console.error(`Unsafe authorship key path refused: ${result.key_path}`);
    } else if (result.error === "recovery_required") {
      console.error(
        `Identity recovery required (${result.recovery_class ?? result.transition_state}). ` +
          "No automatic mutation was performed; recovery is an explicit consented transaction.",
      );
    }
    if (!result.initialized) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (subCmdA === "key" && argv[2] === "migrate") {
    const consent = argValue(argv, "--consent") ?? "";
    const result = await migrateLegacyAuthorshipKey({ consent });
    if (wantJsonA) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.migrated) {
      console.log("Authorship Key Migrated to Generation Store");
      console.log("=".repeat(40));
      console.log(`  Fingerprint: ${result.fingerprint}`);
      console.log(`  Generation:  ${result.generation_path}`);
      console.log(`  Legacy files: ${result.legacy_policy}`);
    } else if (result.error === "consent_required") {
      console.error(
        `Consent required. Use: --consent "${KEY_MIGRATE_CONSENT_PHRASE}"`,
      );
    } else {
      console.error(`Migration refused: ${result.error}`);
    }
    if (!result.migrated) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (subCmdA === "sign") {
    const artifactPath = argv[2];
    const consent = argValue(argv, "--consent") ?? "";
    const result = await signArtifact({ artifactPath, consent });
    if (wantJsonA) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.signed) {
      console.log("Authorship Receipt Signed");
      console.log("=".repeat(40));
      console.log(`  Artifact SHA256: ${result.artifact_sha256}`);
      console.log(`  Fingerprint:     ${result.public_key_fingerprint}`);
      console.log(`  Receipt:         ${result.receipt_path}`);
      console.log(`  Self-verified:   ${result.self_verified}`);
    } else if (result.error === "consent_required") {
      console.error(
        `Consent required. Use: --consent "${SIGN_CONSENT_PHRASE}"`,
      );
    } else {
      console.error(`Signing failed: ${result.error}`);
    }
    if (!result.signed) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (subCmdA === "latest") {
    const summary = await getLatestAuthorshipReceiptSummary();
    if (wantJsonA) {
      console.log(JSON.stringify(summary, null, 2));
    } else if (summary.found) {
      console.log("Latest Authorship Receipt");
      console.log("=".repeat(40));
      console.log(`  File: ${summary.receipt_filename}`);
      console.log(`  Path: ${summary.receipt_path}`);
    } else {
      console.log("No authorship receipts found.");
    }
    if (!summary.found) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (subCmdA === "closeout") {
    const closeout = await buildAuthorshipCloseout();
    if (wantJsonA) {
      console.log(JSON.stringify(closeout, null, 2));
    } else {
      console.log(formatAuthorshipCloseout(closeout));
    }
    if (!closeout.verified) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (subCmdA === "verify") {
    let receiptPath = argv[2];
    const useLatest = argv.includes("--latest");

    if (useLatest) {
      const latest = await findLatestAuthorshipReceipt();
      if (!latest) {
        const err = {
          schema: "bizra.dema.authorship_verify_result.v0.2",
          verified: false,
          verdict: "FAILED",
          verification_scope: "ACTIVE_SIGNER_TRUST",
          error: "no_authorship_receipts_found",
        };
        console.log(
          wantJsonA
            ? JSON.stringify(err, null, 2)
            : "No authorship receipts found.",
        );
        process.exitCode = 1;
        process.exit(process.exitCode ?? 0);
      }
      receiptPath = latest.path;
    }

    if (!receiptPath) {
      console.error(
        "Usage: dema authorship verify <receipt.json> | --latest [--json]",
      );
      process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }

    const trustSnapshot = await loadAuthorshipTrustSnapshot();
    const result = await verifyAuthorshipReceiptFile(
      receiptPath,
      trustSnapshot,
    );
    if (wantJsonA) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatAuthorshipVerification(result));
    }
    if (!result.verified) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  if (subCmdA === "demo") {
    const keys = generateEd25519Keypair();
    const demoHash = authorshipSha256("dema-authorship-demo");
    const receipt = buildSignedAuthorshipReceipt({
      artifact_path: "demo/ephemeral-artifact.txt",
      artifact_sha256: demoHash,
      private_key_pem: keys.private_key_pem,
      public_key_pem: keys.public_key_pem,
      public_key_fingerprint: keys.public_key_fingerprint,
    });
    const { signature, ...payload } = receipt;
    const ok = verifyPayload(payload, signature.value, keys.public_key_pem);
    const out = {
      schema: "bizra.dema.authorship_demo.v0.1",
      mode: "EPHEMERAL_DEMO",
      receipt,
      self_verify: ok ? "VERIFIED" : "FAILED",
      boundary: {
        network_used: false,
        key_persisted: false,
        receipt_saved: false,
        mutation_performed: false,
      },
    };
    if (wantJsonA) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log("Ed25519 Authorship Demo (ephemeral)");
      console.log("=".repeat(40));
      console.log(`  Key fingerprint: ${keys.public_key_fingerprint}`);
      console.log(`  Artifact:        ${receipt.artifact.path}`);
      console.log(`  SHA256:          ${receipt.artifact.sha256}`);
      console.log(`  Signed:          yes (${receipt.signature.algorithm})`);
      console.log(`  Self-verify:     ${ok ? "VERIFIED" : "FAILED"}`);
      console.log("");
      console.log("  No keys or receipts were saved to disk.");
    }
    if (!ok) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }

  console.error(
    "Usage: dema authorship key init | key migrate | sign <path> | latest | closeout | verify <receipt> | demo",
  );
  process.exitCode = 1;
  process.exit(process.exitCode ?? 0);
}
