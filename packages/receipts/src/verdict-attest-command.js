// CLI wrapper for `dema attest`: reads input file → auto-builds a key-bound
// consent proof from the typed phrase + input hash (KEYCONSENT-1B back-compat
// for operator-side ergonomics) → calls attestVerdict() → optionally writes
// bundle to --out.
//
// KEYCONSENT-1C (future): add an explicit `--consent-proof <path>` flag so
// callers can supply an externally-pre-signed consent proof for separation-
// of-authority workflows. Until then, the CLI is a one-process auto-build.

import { readFile, writeFile } from "node:fs/promises";
import {
  attestVerdict,
  ATTEST_CONSENT_PHRASE,
  ATTEST_ACTION_TYPE,
} from "./verdict-attest.js";
import { buildConsentProof } from "./consent-proof.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export { ATTEST_CONSENT_PHRASE };

export async function runAttestCli({
  rule,
  inputPath,
  consent,
  outPath,
  demaHome,
}) {
  if (!rule) {
    return Object.freeze({
      attested: false,
      error: "missing_rule",
      required: "--rule <rule_id>",
    });
  }
  if (!inputPath) {
    return Object.freeze({
      attested: false,
      error: "missing_input",
      required: "--input <path>",
    });
  }

  let input;
  try {
    const raw = await readFile(inputPath, "utf8");
    input = JSON.parse(raw);
  } catch (e) {
    return Object.freeze({
      attested: false,
      error: "input_read_failed",
      details: String(e?.message ?? e),
    });
  }

  // KEYCONSENT-1B: auto-build the consent proof from the typed phrase +
  // input hash. If the phrase is wrong or the key is absent, the build
  // fails and `consentProof` stays null; attestVerdict's own checks then
  // surface the canonical error (consent_required / no_authorship_key)
  // BEFORE the consent_proof_required check fires.
  let consentProof = null;
  try {
    const inputHash = sha256(stableStringify(input));
    const cpResult = await buildConsentProof({
      phrase: consent ?? "",
      actionScope: {
        action_type: ATTEST_ACTION_TYPE,
        target_hash: inputHash,
        rule_id: rule,
      },
      demaHome,
    });
    if (cpResult.built) {
      consentProof = cpResult.consent_proof;
    }
  } catch {
    consentProof = null;
  }

  const result = await attestVerdict({
    rule,
    input,
    consent: consent ?? "",
    consentProof,
    demaHome,
  });

  if (result.attested && outPath) {
    // Bundle on --out ships the full quad: body + sig + pubkey + input +
    // consent_proof (matches the on-disk bundle in $DEMA_HOME/receipts/).
    const bundle = {
      body: result.body,
      signature_b64: result.signature_b64,
      signer_public_key_pem: result.signer_public_key_pem,
      input: result.input,
      consent_proof: result.consent_proof,
    };
    try {
      await writeFile(outPath, JSON.stringify(bundle, null, 2), { flag: "w" });
      return Object.freeze({ ...result, out_path: outPath });
    } catch (e) {
      return Object.freeze({
        ...result,
        error: "bundle_write_failed",
        details: String(e?.message ?? e),
      });
    }
  }

  return result;
}
