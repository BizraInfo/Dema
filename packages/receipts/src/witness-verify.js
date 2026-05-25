import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

const SCHEMA = "bizra.dema.witness_verification.v0.1";
const WITNESS_SCHEMA = "bizra.dema.node0_witness_receipt.v0.1";

export async function verifyWitnessReceipt(receiptPath) {
  const checks = [];
  let receipt;

  try {
    const raw = await readFile(receiptPath, "utf8");
    receipt = JSON.parse(raw);
    checks.push({ check: "file_readable", pass: true });
    checks.push({ check: "valid_json", pass: true });
  } catch (err) {
    checks.push({ check: "file_readable", pass: false, detail: err.message });
    return {
      schema: SCHEMA,
      verdict: "FAILED",
      path: receiptPath,
      checks,
      receipt: null,
    };
  }

  checks.push({
    check: "schema_match",
    pass: receipt.schema === WITNESS_SCHEMA,
    expected: WITNESS_SCHEMA,
    actual: receipt.schema,
  });

  checks.push({
    check: "truth_label_present",
    pass:
      typeof receipt.truth_label === "string" && receipt.truth_label.length > 0,
  });

  checks.push({
    check: "attests_present",
    pass: receipt.attests !== null && typeof receipt.attests === "object",
  });

  const recomputedHash = receipt.attests
    ? sha256(stableStringify(receipt.attests))
    : null;

  checks.push({
    check: "content_hash_integrity",
    pass: recomputedHash !== null && recomputedHash === receipt.content_hash,
    expected: receipt.content_hash,
    recomputed: recomputedHash,
  });

  checks.push({
    check: "witnessed_at_valid",
    pass:
      typeof receipt.witnessed_at === "string" &&
      !isNaN(Date.parse(receipt.witnessed_at)),
  });

  checks.push({
    check: "boundary_present",
    pass: receipt.boundary !== null && typeof receipt.boundary === "object",
  });

  if (receipt.boundary) {
    checks.push({
      check: "no_federation",
      pass: receipt.boundary.federation_invoked === false,
    });
    checks.push({
      check: "no_public_network",
      pass: receipt.boundary.public_network_used === false,
    });
    checks.push({
      check: "consent_collected",
      pass: receipt.boundary.consent_collected === true,
    });
  }

  if (receipt.attests) {
    checks.push({
      check: "node_is_node0",
      pass: receipt.attests.node === "Node0",
    });
    checks.push({
      check: "no_token_claim",
      pass: receipt.attests.token_claim === false,
    });
    checks.push({
      check: "no_model_invocation",
      pass: receipt.attests.model_invocation === false,
    });
  }

  const allPass = checks.every((c) => c.pass);

  return {
    schema: SCHEMA,
    verdict: allPass ? "VERIFIED" : "FAILED",
    path: receiptPath,
    checks_total: checks.length,
    checks_passing: checks.filter((c) => c.pass).length,
    checks_failing: checks.filter((c) => !c.pass).length,
    checks,
    receipt_summary: receipt.attests
      ? {
          node: receipt.attests.node,
          harness_verdict: receipt.attests.harness_verdict,
          connected_nodes: receipt.attests.connected_nodes,
          epistemic_ground: receipt.attests.epistemic_ground,
        }
      : null,
  };
}

export async function findLatestWitness(
  home = process.env.DEMA_HOME || join(homedir(), ".dema"),
) {
  const receiptsDir = join(home, "receipts");
  try {
    const entries = await readdir(receiptsDir);
    const witnesses = entries.filter(
      (f) => f.startsWith("witness-") && f.endsWith(".json"),
    );
    if (witnesses.length === 0) return null;

    let latest = null;
    let latestMtime = 0;
    for (const w of witnesses) {
      const p = join(receiptsDir, w);
      const s = await stat(p);
      if (s.mtimeMs > latestMtime) {
        latestMtime = s.mtimeMs;
        latest = p;
      }
    }
    return latest;
  } catch {
    return null;
  }
}

export function formatWitnessVerification(result) {
  const lines = [
    "WITNESS VERIFICATION v0.1",
    "",
    `Verdict: ${result.verdict}`,
    `Path: ${result.path}`,
    `Checks: ${result.checks_passing}/${result.checks_total} passing`,
    "",
  ];

  for (const c of result.checks) {
    const icon = c.pass ? "PASS" : "FAIL";
    lines.push(`  ${icon}  ${c.check}${c.detail ? ` — ${c.detail}` : ""}`);
  }

  if (result.receipt_summary) {
    lines.push("");
    lines.push("Receipt summary:");
    lines.push(`  node: ${result.receipt_summary.node}`);
    lines.push(`  harness: ${result.receipt_summary.harness_verdict}`);
    lines.push(`  N=${result.receipt_summary.connected_nodes}`);
    lines.push(`  ground: ${result.receipt_summary.epistemic_ground}`);
  }

  lines.push("");
  lines.push(
    "Boundary: read-only verification. No mutation, no network, no mint.",
  );

  return lines.join("\n");
}
