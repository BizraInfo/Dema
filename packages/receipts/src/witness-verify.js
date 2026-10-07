import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

const SCHEMA = "bizra.dema.witness_verification.v0.1";
const WITNESS_SCHEMA = "bizra.dema.node0_witness_receipt.v0.1";

/**
 * `expected` is ADDITIVE: omitting it preserves the previous verdict behaviour
 * byte-for-byte for every existing caller. Supplying it answers the new,
 * stricter question — whether this witness is bound to a specific observed
 * runtime — via `eligible_for_bridge_clean`.
 */
export async function verifyWitnessReceipt(receiptPath, expected = null) {
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
      // An unreadable witness is fail-closed on the new question too — never
      // let a missing answer default to eligible.
      witness_schema: null,
      binding: Object.freeze({
        valid: false,
        reason: "receipt_unreadable",
        mismatches: Object.freeze(["receipt_unreadable"]),
        bound_schema: null,
      }),
      eligible_for_bridge_clean: false,
    };
  }

  checks.push({
    // Both versions of the witness family verify. v0.2 adds the runtime
    // binding; it does not replace v0.1, and historical receipts must keep
    // verifying exactly as they did. Eligibility for bridge CLEAN is the
    // separate, stricter question answered by `binding` below.
    check: "schema_match",
    pass:
      receipt.schema === WITNESS_SCHEMA ||
      receipt.schema === WITNESS_RUNTIME_BOUND_SCHEMA,
    expected: `${WITNESS_SCHEMA} | ${WITNESS_RUNTIME_BOUND_SCHEMA}`,
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
  const binding = evaluateWitnessBinding(receipt, expected);

  return {
    schema: SCHEMA,
    verdict: allPass ? "VERIFIED" : "FAILED",
    path: receiptPath,
    checks_total: checks.length,
    checks_passing: checks.filter((c) => c.pass).length,
    checks_failing: checks.filter((c) => !c.pass).length,
    checks,
    // A v0.1 witness still VERIFIES — historical receipts are not invalidated —
    // but verifying is not the same question as "does this witness testify
    // about the runtime I just observed?". That second question is new.
    witness_schema: receipt.schema ?? null,
    binding,
    eligible_for_bridge_clean: allPass && binding.valid,
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

export const WITNESS_RUNTIME_BOUND_SCHEMA =
  "bizra.dema.node0_witness_receipt.v0.2";

/**
 * Does this witness testify about THIS runtime, home, endpoint, code and
 * observation — or merely about "a Node0, once"?
 *
 * v0.1 receipts carry a generic topology attestation: schema, self-recomputed
 * content hash, the literal string `node === "Node0"` and some negative claims.
 * None of that distinguishes one installation from another, so a perfectly
 * valid v0.1 witness from a different runtime satisfied the old CLEAN check.
 * This is the fix, and it is deliberately fail-closed: with no expectation
 * supplied there is nothing to bind to, so nothing is eligible.
 *
 * Pure — no fs, no clock. Every mismatch is named rather than collapsed into a
 * boolean, because "this witness is for another endpoint" and "this witness is
 * for stale code" are different operator problems.
 */
export function evaluateWitnessBinding(receipt, expected) {
  const mismatches = [];
  if (!expected || typeof expected !== "object") {
    return Object.freeze({
      valid: false,
      reason: "no_expected_binding_supplied",
      mismatches: Object.freeze(["expected_binding_absent"]),
      bound_schema: receipt?.schema ?? null,
    });
  }
  if (receipt?.schema !== WITNESS_RUNTIME_BOUND_SCHEMA) {
    return Object.freeze({
      valid: false,
      reason: "witness_not_runtime_bound",
      mismatches: Object.freeze(["schema_is_not_v0_2"]),
      bound_schema: receipt?.schema ?? null,
    });
  }

  const b = receipt?.attests?.binding;
  if (!b || typeof b !== "object") {
    return Object.freeze({
      valid: false,
      reason: "binding_block_absent",
      mismatches: Object.freeze(["binding_absent"]),
      bound_schema: receipt?.schema ?? null,
    });
  }

  // Each expectation is checked only when the caller supplied it, but a
  // supplied expectation that the witness cannot answer is a MISMATCH, never a
  // pass — absence must never read as agreement.
  const pairs = [
    ["home_identity", expected.expectedHomeIdentity],
    ["runtime_identity", expected.expectedRuntimeIdentity],
    ["observed_endpoint", expected.expectedEndpoint],
    ["observation_hash", expected.expectedObservationHash],
    ["code_identity", expected.expectedCodeIdentity],
  ];
  for (const [key, want] of pairs) {
    if (want === undefined || want === null) continue;
    if (b[key] !== want) mismatches.push(`${key}_mismatch`);
  }
  if (b.authority_delta !== 0) mismatches.push("authority_delta_nonzero");
  if (b.federation_invoked === true) mismatches.push("federation_invoked");

  return Object.freeze({
    valid: mismatches.length === 0,
    reason: mismatches.length === 0 ? "bound" : "binding_mismatch",
    mismatches: Object.freeze(mismatches),
    bound_schema: receipt.schema,
  });
}

/**
 * Select a witness by EXACT BINDING, then by deterministic receipt identity —
 * never by newest mtime. `findLatestWitness` picks whatever file was touched
 * last, so `touch` on an unrelated receipt could hand it authority. Ordering by
 * filename keeps the choice reproducible across machines and clocks.
 */
export async function findBoundWitness(home, expected) {
  const receiptsDir = join(home, "receipts");
  let entries;
  try {
    entries = await readdir(receiptsDir);
  } catch {
    return null;
  }
  const candidates = entries
    .filter((f) => f.startsWith("witness-") && f.endsWith(".json"))
    .sort();
  for (const name of candidates) {
    const p = join(receiptsDir, name);
    const result = await verifyWitnessReceipt(p, expected);
    if (result.eligible_for_bridge_clean) return p;
  }
  return null;
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
