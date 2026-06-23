import { readFile } from "node:fs/promises";

import {
  buildConsentPlanPreview,
  formatConsentPlanPreview,
} from "../../../../packages/consent/src/consent-planner.js";
import {
  buildMobileQrChallengePreview,
  verifyMobileQrChallengePreview,
} from "../../../../packages/consent/src/mobile-qr-challenge-preview.js";
import { runConsentProveCli } from "../../../../packages/receipts/src/consent-prove-command.js";
import { runConsentVerifyCli } from "../../../../packages/receipts/src/consent-verify-command.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function formatMobileChallenge(c) {
  if (!c.valid) {
    return `Mobile challenge FAILED: ${c.denial?.code} · ${c.denial?.detail}`;
  }
  return [
    "Mobile QR consent challenge (PREVIEW_ONLY)",
    "  The phone displays this; the operator types the phrase back on the laptop.",
    `  challenge_id: ${c.challenge_id}`,
    `  phrase:       ${c.phrase}   ← type this on the laptop to confirm`,
    `  expires_at:   ${c.expires_at}`,
    `  ${c.note}`,
    "  Boundary: the phone holds/sends/executes nothing authoritative.",
    "  NOTE: replay protection is in-memory per-process — it is NOT enforced across separate CLI invocations (preview only).",
  ].join("\n");
}

function formatMobileVerify(r) {
  return r.ok
    ? `VERIFIED · ${r.reason} · challenge_id=${r.challenge_id} · NOT an authorization (preview only)`
    : `REJECTED:${r.reason}${r.detail ? " · " + r.detail : ""}`;
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

export async function cmd_consent(ctx) {
  const { argv, subcommand } = ctx;
  if (subcommand === "plan") {
    const json = argv.includes("--json");
    const intent = argv
      .slice(2)
      .filter((arg) => arg !== "--json")
      .join(" ")
      .trim();
    if (!intent)
      throw new Error('Usage: dema consent plan [--json] "<intent>"');
    const plan = buildConsentPlanPreview({ intent });
    console.log(
      json ? JSON.stringify(plan, null, 2) : formatConsentPlanPreview(plan),
    );
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "prove") {
    const wantJsonC = wantsJson(argv);
    const phrase = argValue(argv, "--phrase") ?? "";
    const actionType = argValue(argv, "--action-type") ?? "";
    const targetHash = argValue(argv, "--target-hash") ?? "";
    const ruleId = argValue(argv, "--rule-id");
    const outPath = argValue(argv, "--out");
    const result = await runConsentProveCli({
      phrase,
      actionType,
      targetHash,
      ruleId,
      outPath,
    });
    if (wantJsonC) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.built) {
      console.log("Consent Proof");
      console.log("=".repeat(40));
      console.log(`  Schema:       ${result.consent_proof.schema}`);
      console.log(`  Phrase:       ${result.consent_proof.consent_phrase}`);
      console.log(
        `  Action type:  ${result.consent_proof.action_scope.action_type}`,
      );
      console.log(
        `  Target hash:  ${result.consent_proof.action_scope.target_hash}`,
      );
      console.log(`  Nonce:        ${result.consent_proof.nonce}`);
      console.log(`  Created at:   ${result.consent_proof.created_at_iso}`);
      console.log(`  Expires at:   ${result.consent_proof.expires_at_iso}`);
      console.log(
        `  Fingerprint:  ${result.consent_proof.operator_public_key_fingerprint}`,
      );
      console.log(`  Proof hash:   ${result.consent_proof.consent_proof_hash}`);
      if (result.out_path) console.log(`  Saved:        ${result.out_path}`);
    } else {
      console.error(`Consent proof failed: ${result.error}`);
    }
    if (!result.built) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "verify") {
    const wantJsonC = wantsJson(argv);
    const proofPath = argv[2] && !argv[2].startsWith("--") ? argv[2] : null;
    const pubkeyPath = argValue(argv, "--pubkey");
    const expectedActionType = argValue(argv, "--expected-action-type");
    const expectedTargetHash = argValue(argv, "--expected-target-hash");
    const result = await runConsentVerifyCli({
      proofPath,
      pubkeyPath,
      expectedActionType,
      expectedTargetHash,
    });
    if (wantJsonC) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.verified) {
      console.log(
        `VERIFIED · proof_hash=${result.consent_proof_hash} · action_type=${result.action_scope?.action_type}`,
      );
    } else {
      console.error(`REJECTED:${result.reason}`);
    }
    if (!result.verified) process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  if (subcommand === "mobile-challenge") {
    const op = argv[2];
    const wantJsonM = wantsJson(argv);
    if (op === "issue") {
      const challenge = buildMobileQrChallengePreview({
        mission_id: argValue(argv, "--mission-id") ?? "",
        action: argValue(argv, "--action") ?? "",
        purpose: argValue(argv, "--purpose") ?? "",
      });
      console.log(
        wantJsonM
          ? JSON.stringify(challenge, null, 2)
          : formatMobileChallenge(challenge),
      );
      if (!challenge.valid) process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    if (op === "verify") {
      const challengePath = argValue(argv, "--challenge");
      const phrase = argValue(argv, "--phrase") ?? "";
      let challenge;
      try {
        challenge = JSON.parse(await readFile(challengePath, "utf8"));
      } catch {
        const err = {
          ok: false,
          reason: "challenge_unreadable",
          detail: `cannot read --challenge ${challengePath ?? "<missing>"}`,
        };
        console.log(
          wantJsonM
            ? JSON.stringify(err, null, 2)
            : `REJECTED:${err.reason} · ${err.detail}`,
        );
        process.exitCode = 1;
        process.exit(1);
      }
      const result = verifyMobileQrChallengePreview(challenge, phrase);
      console.log(
        wantJsonM ? JSON.stringify(result, null, 2) : formatMobileVerify(result),
      );
      if (!result.ok) process.exitCode = 1;
      process.exit(process.exitCode ?? 0);
    }
    throw new Error(
      "Usage: dema consent mobile-challenge issue --mission-id <id> --action <a> --purpose <p> [--json] | dema consent mobile-challenge verify --challenge <path> --phrase <typed> [--json]",
    );
  }
  throw new Error(
    'Unknown consent command. Use `dema consent plan "<intent>"`, `dema consent prove --phrase ... --action-type ... --target-hash ... [--rule-id ...] [--out <path>] [--json]`, `dema consent verify <proof.json> --pubkey <pem-path> [--expected-action-type ...] [--expected-target-hash ...] [--json]`, or `dema consent mobile-challenge issue|verify` (mobile second-factor preview).',
  );
}
