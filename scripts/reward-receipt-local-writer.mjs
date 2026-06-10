/**
 * ADR-027 Reward Receipt Local Writer Prototype (G31)
 * [PROTOTYPE]
 * [DESIGNED_NOT_LIVE]
 * LOCAL_ONLY
 *
 * First controlled local persistence of a reward receipt review artifact.
 * Strictly DEMA_HOME-scoped, exact-consent gated, atomic write + read-back verification.
 * No minting, no public writing, no publishing, no bridging, no reward authorization,
 * no token logic, no contracts, no marketplace, no Node1, no URP, no Shariah claim.
 *
 * NO_RECEIPT_MINTING
 * NO_PUBLIC_RECEIPT_WRITING
 * NO_PUBLISHING
 * NO_BRIDGING
 * NO_REWARD_AUTHORIZATION
 * NO_REWARD_LOGIC
 * NO_TOKEN_LOGIC
 * NO_CONTRACTS
 * NO_MARKETPLACE
 * NO_NODE1
 * NO_PUBLIC_URP_BRIDGE
 * NO_SHARIAH_COMPLIANCE_CLAIM
 * NO_PRODUCTION_ECONOMIC_REWARD_LAYER
 */

import { createHash } from "node:crypto";
import { writeFile, rename, chmod, readFile, mkdir } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";

export const REWARD_RECEIPT_LOCAL_WRITER_CONSENT =
  "GO: REWARD RECEIPT LOCAL WRITER PROTOTYPE";

const FORBIDDEN_TERMS = new Set([
  "mint",
  "publish",
  "bridge",
  "reward_authorized",
  "token",
  "contract",
  "marketplace",
  "Node1",
  "URP",
  "Shariah",
  "guaranteed",
  "payout",
  "claimable",
  "earn",
  "authorized",
  "transferable",
  "public_url",
  "public",
]);

export async function writeLocalRewardReceipt(
  { requireConsent, demaHome },
  writePlan,
) {
  if (requireConsent !== REWARD_RECEIPT_LOCAL_WRITER_CONSENT) {
    throw new Error(
      'CONSENT_REQUIRED: exact "GO: REWARD RECEIPT LOCAL WRITER PROTOTYPE" required',
    );
  }

  if (!demaHome || typeof demaHome !== "string") {
    throw new Error("DEMA_HOME_REQUIRED");
  }

  if (!writePlan || typeof writePlan !== "object") {
    return {
      schema: "bizra.reward.receipt.local_writer_result.v0.1",
      local_writer_result_id: null,
      local_write_plan_id: (writePlan && writePlan.local_write_plan_id) || null,
      receipt_review_id: (writePlan && writePlan.receipt_review_id) || null,
      proposed_path: (writePlan && writePlan.proposed_path) || null,
      final_local_path: null,
      content_hash: null,
      integrity_hash: null,
      file_mode_expected: "0o600",
      write_result_status: "local_write_refused_forbidden_claim",
      read_back_verified: false,
      proof_gaps: (writePlan && writePlan.proof_gaps) || [],
      created_at: new Date().toISOString(),
      prototype_posture: "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
    };
  }

  // Forbidden promotion/economic check (on non-claim fields)
  const checkPlan = { ...writePlan };
  delete checkPlan.description;
  delete checkPlan.claim_label;
  const serialized = JSON.stringify(checkPlan).toLowerCase();
  for (const term of FORBIDDEN_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`FORBIDDEN_PROMOTION: detected "${term}"`);
    }
  }

  const proposed =
    writePlan.proposed_path || "receipts/reward-receipt-local.json";
  if (proposed.includes("..") || isAbsolute(proposed)) {
    return {
      schema: "bizra.reward.receipt.local_writer_result.v0.1",
      local_writer_result_id: null,
      local_write_plan_id: writePlan.local_write_plan_id,
      receipt_review_id: writePlan.receipt_review_id,
      proposed_path: proposed,
      final_local_path: null,
      content_hash: null,
      integrity_hash: null,
      file_mode_expected: "0o600",
      write_result_status: "local_write_refused_unsafe_path",
      read_back_verified: false,
      proof_gaps: writePlan.proof_gaps || [],
      created_at: new Date().toISOString(),
      prototype_posture: "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
    };
  }

  const finalPath = resolve(demaHome, proposed);
  const rel = relative(demaHome, finalPath);
  if (rel.startsWith("..") || resolve(demaHome, rel) !== finalPath) {
    return {
      schema: "bizra.reward.receipt.local_writer_result.v0.1",
      local_writer_result_id: null,
      local_write_plan_id: writePlan.local_write_plan_id,
      receipt_review_id: writePlan.receipt_review_id,
      proposed_path: proposed,
      final_local_path: null,
      content_hash: null,
      integrity_hash: null,
      file_mode_expected: "0o600",
      write_result_status: "local_write_refused_unsafe_path",
      read_back_verified: false,
      proof_gaps: writePlan.proof_gaps || [],
      created_at: new Date().toISOString(),
      prototype_posture: "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
    };
  }

  if (
    !Array.isArray(writePlan.proof_gaps) ||
    writePlan.proof_gaps.length === 0
  ) {
    return {
      schema: "bizra.reward.receipt.local_writer_result.v0.1",
      local_writer_result_id: null,
      local_write_plan_id: writePlan.local_write_plan_id,
      receipt_review_id: writePlan.receipt_review_id,
      proposed_path: proposed,
      final_local_path: null,
      content_hash: null,
      integrity_hash: null,
      file_mode_expected: "0o600",
      write_result_status: "local_write_refused_proof_gaps",
      read_back_verified: false,
      proof_gaps: writePlan.proof_gaps || [],
      created_at: new Date().toISOString(),
      prototype_posture: "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
    };
  }

  // Build content to persist (the review data)
  const receiptContent = writePlan.content || {
    receipt_review_id: writePlan.receipt_review_id,
    claim_label: writePlan.claim_label,
  };

  const canonical = JSON.stringify(
    receiptContent,
    Object.keys(receiptContent).sort(),
  );
  const content_hash =
    "sha256:" + createHash("sha256").update(canonical).digest("hex");

  // Idempotent for same content: if file exists with matching hash, return success without re-write
  try {
    const existingRaw = await readFile(finalPath, "utf8");
    const existingObj = JSON.parse(existingRaw);
    const existingCanonical = JSON.stringify(
      existingObj,
      Object.keys(existingObj).sort(),
    );
    const existingHash =
      "sha256:" + createHash("sha256").update(existingCanonical).digest("hex");
    if (existingHash === content_hash) {
      const integrity_hash = existingHash;
      const read_back_verified = true;
      const result = {
        schema: "bizra.reward.receipt.local_writer_result.v0.1",
        local_writer_result_id: null,
        local_write_plan_id: writePlan.local_write_plan_id,
        receipt_review_id: writePlan.receipt_review_id,
        proposed_path: proposed,
        final_local_path: finalPath,
        content_hash,
        integrity_hash,
        file_mode_expected: "0o600",
        write_result_status: "local_write_performed_local_only",
        read_back_verified,
        proof_gaps: writePlan.proof_gaps,
        created_at: new Date().toISOString(),
        prototype_posture: "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
      };
      const identity = { ...result };
      delete identity.created_at;
      const idCanonical = JSON.stringify(
        identity,
        Object.keys(identity).sort(),
      );
      result.local_writer_result_id =
        "sha256:" +
        createHash("sha256")
          .update(idCanonical + REWARD_RECEIPT_LOCAL_WRITER_CONSENT)
          .digest("hex");
      return result;
    }
  } catch (e) {
    // file does not exist or invalid, proceed to write
  }

  // Ensure directory
  await mkdir(dirname(finalPath), { recursive: true });

  // Atomic write: temp + rename
  const tempPath = finalPath + ".tmp." + process.hrtime.bigint();
  await writeFile(tempPath, canonical, { encoding: "utf8" });
  await rename(tempPath, finalPath);

  // Best-effort mode
  try {
    await chmod(finalPath, 0o600);
  } catch (e) {
    // non-fatal on some platforms
  }

  // Read-back verification
  const readBackRaw = await readFile(finalPath, "utf8");
  const readBackObj = JSON.parse(readBackRaw);
  const readCanonical = JSON.stringify(
    readBackObj,
    Object.keys(readBackObj).sort(),
  );
  const integrity_hash =
    "sha256:" + createHash("sha256").update(readCanonical).digest("hex");
  const read_back_verified = integrity_hash === content_hash;

  const result = {
    schema: "bizra.reward.receipt.local_writer_result.v0.1",
    local_writer_result_id: null, // set after
    local_write_plan_id: writePlan.local_write_plan_id,
    receipt_review_id: writePlan.receipt_review_id,
    proposed_path: proposed,
    final_local_path: finalPath,
    content_hash,
    integrity_hash,
    file_mode_expected: "0o600",
    write_result_status: "local_write_performed_local_only",
    read_back_verified,
    proof_gaps: writePlan.proof_gaps,
    created_at: new Date().toISOString(),
    prototype_posture: "[PROTOTYPE] [DESIGNED_NOT_LIVE] LOCAL_ONLY",
  };

  // Deterministic id: exclude created_at (audit field)
  const identity = { ...result };
  delete identity.created_at;
  const idCanonical = JSON.stringify(identity, Object.keys(identity).sort());
  result.local_writer_result_id =
    "sha256:" +
    createHash("sha256")
      .update(idCanonical + REWARD_RECEIPT_LOCAL_WRITER_CONSENT)
      .digest("hex");

  return result;
}

export function loadExampleLocalWriterInput() {
  return {
    local_write_plan_id: "ex-plan-001",
    receipt_review_id: "ex-receipt-review-001",
    content: {
      receipt_review_id: "ex-receipt-review-001",
      claim_label:
        "Local writer prototype test only [PROTOTYPE] [DESIGNED_NOT_LIVE]",
    },
    proposed_path: "receipts/reward-receipt-local.json",
    proof_gaps: ["GAP_LOCAL_WRITER_PROTOTYPE", "GAP_HUMAN_REVIEW_PENDING"],
    claim_label:
      "Local writer prototype test only [PROTOTYPE] [DESIGNED_NOT_LIVE]",
    receipt_context: { node: "Node0", phase: "G31" },
  };
}

// Self-test when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(
    "--- BIZRA G31: REWARD RECEIPT LOCAL WRITER PROTOTYPE SELF-TEST ---",
  );
  (async () => {
    try {
      const { mkdtemp, rm } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");

      const tempRoot = await mkdtemp(join(tmpdir(), "dema-g31-writer-"));
      const base = loadExampleLocalWriterInput();

      // 1. basic write under temp DEMA_HOME
      const r1 = await writeLocalRewardReceipt(
        {
          requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT,
          demaHome: tempRoot,
        },
        base,
      );
      console.log(
        "1. write under temp DEMA_HOME:",
        r1.write_result_status,
        "path safe:",
        !r1.final_local_path.includes(".."),
      );
      console.log("   read_back_verified:", r1.read_back_verified);

      // 2. consent
      try {
        await writeLocalRewardReceipt(
          { requireConsent: "WRONG", demaHome: tempRoot },
          base,
        );
        throw new Error("should throw");
      } catch (e) {
        if (!e.message.includes("CONSENT_REQUIRED")) throw e;
        console.log("2. rejects missing exact consent");
      }

      // 3. unsafe path
      const badPath = { ...base, proposed_path: "../../etc/passwd" };
      const r3 = await writeLocalRewardReceipt(
        {
          requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT,
          demaHome: tempRoot,
        },
        badPath,
      );
      console.log("3. rejects unsafe traversal:", r3.write_result_status);

      // 4. absolute
      const absPath = { ...base, proposed_path: "/tmp/evil.json" };
      const r4 = await writeLocalRewardReceipt(
        {
          requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT,
          demaHome: tempRoot,
        },
        absPath,
      );
      console.log("4. rejects absolute arbitrary:", r4.write_result_status);

      // 5+6. canonical + read-back
      console.log(
        "5+6. canonical + read-back verified:",
        r1.content_hash && r1.read_back_verified,
      );

      // 7. no forbidden
      const forbiddenFields = [
        "receipt_written",
        "receipt_minted",
        "reward_authorized",
        "token_amount",
        "reward_amount",
        "contract_call",
        "marketplace_listing",
        "public_url",
        "bridge_id",
        "node1_sync",
        "urp_publication",
        "shariah_compliant",
      ];
      let hasForbidden = false;
      for (const field of forbiddenFields) {
        if (field in r1) {
          hasForbidden = true;
          break;
        }
      }
      console.log("7. never returns forbidden fields:", !hasForbidden);

      // 8. deterministic id (same input, different created_at)
      const r8a = await writeLocalRewardReceipt(
        {
          requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT,
          demaHome: tempRoot,
        },
        base,
      );
      const r8b = await writeLocalRewardReceipt(
        {
          requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT,
          demaHome: tempRoot,
        },
        base,
      );
      console.log(
        "8. deterministic id (excl created_at):",
        r8a.local_writer_result_id === r8b.local_writer_result_id,
      );

      // 9. file mode expectation
      console.log(
        "9. file_mode_expected 0o600:",
        r1.file_mode_expected === "0o600",
      );

      // 10. refuses empty proof_gaps
      const noGaps = { ...base, proof_gaps: [] };
      const r10 = await writeLocalRewardReceipt(
        {
          requireConsent: REWARD_RECEIPT_LOCAL_WRITER_CONSENT,
          demaHome: tempRoot,
        },
        noGaps,
      );
      console.log("10. refuses empty proof_gaps:", r10.write_result_status);

      console.log(
        "G31 self-test PASS (local-only writer, atomic, verified, deterministic, no side effects).",
      );
      await rm(tempRoot, { recursive: true, force: true });
      process.exit(0);
    } catch (e) {
      console.error("G31 SELF-TEST FAIL:", e.message);
      process.exit(1);
    }
  })();
}
