// CLI wrapper for `dema attest`: reads input file → calls attestVerdict()
// → optionally writes bundle to --out.

import { readFile, writeFile } from "node:fs/promises";
import { attestVerdict, ATTEST_CONSENT_PHRASE } from "./verdict-attest.js";

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

  const result = await attestVerdict({
    rule,
    input,
    consent: consent ?? "",
    demaHome,
  });

  if (result.attested && outPath) {
    const bundle = {
      body: result.body,
      signature_b64: result.signature_b64,
      signer_public_key_pem: result.signer_public_key_pem,
      input: result.input,
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
