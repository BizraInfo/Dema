// CLI wrapper for `dema verify-grounded`: reads bundle + external pubkey
// → calls verifyVerdictBundle(). Permissionless: no consent required.

import { readFile } from "node:fs/promises";
import { verifyVerdictBundle } from "./verdict-verify.js";

function rejectShape(reason, extra = {}) {
  return Object.freeze({
    verified: false,
    rejected: true,
    reason,
    ...extra,
  });
}

export async function runVerifyGroundedCli({ bundlePath, pubkeyPath, ruleId }) {
  if (!bundlePath) {
    return rejectShape("missing_bundle_path", {
      required: "<bundle.json>",
    });
  }
  if (!pubkeyPath) {
    return rejectShape("missing_pubkey_path", {
      required: "--pubkey <external-pem-path>",
    });
  }
  if (!ruleId) {
    return rejectShape("missing_rule_id", { required: "--rule <rule_id>" });
  }

  let bundle;
  try {
    const raw = await readFile(bundlePath, "utf8");
    bundle = JSON.parse(raw);
  } catch (e) {
    return rejectShape("bundle_read_failed", {
      details: String(e?.message ?? e),
    });
  }

  let pubkeyPem;
  try {
    pubkeyPem = await readFile(pubkeyPath, "utf8");
  } catch (e) {
    return rejectShape("pubkey_read_failed", {
      details: String(e?.message ?? e),
    });
  }

  return verifyVerdictBundle({ bundle, pubkeyPem, ruleId });
}
