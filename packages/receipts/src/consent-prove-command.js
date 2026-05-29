// KEYCONSENT-1C · CLI wrapper for `dema consent prove`.
//
// Reads operator key from $DEMA_HOME via the KEYCONSENT-1A kernel
// (buildConsentProof), optionally writes the consent proof envelope to
// `--out`. Pure wrapper: no new cryptographic primitive, no integration
// with existing mutation gates, no token / PoI / economy field anywhere.

import { writeFile } from "node:fs/promises";
import { buildConsentProof } from "./consent-proof.js";

export async function runConsentProveCli({
  phrase,
  actionType,
  targetHash,
  ruleId,
  outPath,
  demaHome,
}) {
  const actionScope = ruleId
    ? { action_type: actionType, target_hash: targetHash, rule_id: ruleId }
    : { action_type: actionType, target_hash: targetHash };

  const result = await buildConsentProof({
    phrase: phrase ?? "",
    actionScope,
    demaHome,
  });

  if (result.built && outPath) {
    try {
      await writeFile(outPath, JSON.stringify(result.consent_proof, null, 2), {
        flag: "w",
      });
      return Object.freeze({ ...result, out_path: outPath });
    } catch (e) {
      return Object.freeze({
        ...result,
        error: "consent_proof_write_failed",
        details: String(e?.message ?? e),
      });
    }
  }

  return result;
}
