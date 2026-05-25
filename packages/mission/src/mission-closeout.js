import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export async function resolveMissionReceipt(missionId, home) {
  const root = home || process.env.DEMA_HOME || join(homedir(), ".dema");
  const receiptsDir = join(root, "receipts");

  let entries;
  try {
    entries = await readdir(receiptsDir);
  } catch {
    return { error: "No mission receipts found. Run a mission first." };
  }

  const missionFiles = entries.filter(
    (f) => f.startsWith("mission-") && f.endsWith(".json"),
  );
  if (missionFiles.length === 0) {
    return { error: "No mission receipts found. Run a mission first." };
  }

  if (missionId) {
    const match = missionFiles.filter((f) => f.includes(missionId));
    if (match.length === 0) {
      return { error: `No receipt matching '${missionId}' found.` };
    }
    const picked = match[0];
    const fullPath = join(receiptsDir, picked);
    const raw = await readFile(fullPath, "utf8");
    return { receipt: JSON.parse(raw), path: fullPath, filename: picked };
  }

  const withMtime = await Promise.all(
    missionFiles.map(async (f) => {
      const fullPath = join(receiptsDir, f);
      const s = await stat(fullPath);
      return { filename: f, path: fullPath, mtime: s.mtimeMs };
    }),
  );
  withMtime.sort((a, b) => b.mtime - a.mtime);
  const latest = withMtime[0];
  const raw = await readFile(latest.path, "utf8");
  return {
    receipt: JSON.parse(raw),
    path: latest.path,
    filename: latest.filename,
  };
}

export function buildCloseoutReport(receipt, sourcePath, sourceFilename) {
  if (!receipt || !receipt.attests) {
    return { error: "Receipt is malformed — missing attests block." };
  }

  const attests = receipt.attests;
  const recomputedHash = sha256(stableStringify(attests));
  const originalHash = receipt.content_hash || "";
  const hashMatch = recomputedHash === originalHash;

  const boundary = attests.boundary || {};
  const boundaryKeys = Object.keys(boundary);
  const trueCount = boundaryKeys.filter((k) => boundary[k] === true).length;
  const falseCount = boundaryKeys.filter((k) => boundary[k] === false).length;

  return {
    schema: "bizra.dema.mission_closeout.v0.1",
    mission_id: receipt.mission_id || null,
    source_receipt: sourceFilename,
    source_path: sourcePath,
    verification: {
      content_hash_match: hashMatch,
      recomputed_hash: recomputedHash,
      original_hash: originalHash,
    },
    summary: {
      type: attests.mission_type || null,
      executed_at: attests.executed_at || null,
      verdict: attests.mission_verdict || null,
      results: attests.results || {},
      boundary: {
        ...boundary,
        total_keys: boundaryKeys.length,
        true_count: trueCount,
        false_count: falseCount,
      },
    },
  };
}

export function renderCloseoutText(report) {
  if (report.error) return report.error;

  const v = report.verification;
  const s = report.summary;
  const r = s.results;
  const hashStatus = v.content_hash_match ? "PASS" : "MISMATCH";

  const lines = [
    "Mission Closeout Evidence Report",
    "=".repeat(42),
    `  Mission ID:     ${report.mission_id || "unknown"}`,
    `  Type:           ${s.type || "unknown"}`,
    `  Executed:       ${s.executed_at || "unknown"}`,
    `  Verdict:        ${s.verdict || "unknown"}`,
    `  Content Hash:   sha256:${v.original_hash.slice(0, 16)}...`,
    `  Hash Verified:  ${hashStatus}`,
    "",
  ];

  if (r.setup) {
    lines.push("  Results:");
    lines.push(
      `    Setup:    ${r.setup.verdict} (${r.setup.checks} checks, ${r.setup.missing} missing)`,
    );
  }
  if (r.harness) {
    lines.push(
      `    Harness:  ${r.harness.verdict} (${r.harness.gates}, ${r.harness.hooks} hooks)`,
    );
  }
  if (r.doctor) {
    lines.push(
      `    Doctor:   ${r.doctor.ok} ok / ${r.doctor.fail} fail / ${r.doctor.warn} warn (of ${r.doctor.predicates})`,
    );
  }
  if (r.witness) {
    const wLabel = r.witness.exists
      ? `${r.witness.verdict || "present"}`
      : "not present";
    lines.push(`    Witness:  ${wLabel}`);
  }
  if (r.memory) {
    lines.push(`    Memory:   ${r.memory.entries} entries`);
  }

  lines.push("");

  const bKeys = Object.keys(s.boundary).filter(
    (k) => !["total_keys", "true_count", "false_count"].includes(k),
  );
  const trueKeys = bKeys.filter((k) => s.boundary[k] === true);
  if (trueKeys.length > 0) {
    const trueLabels = trueKeys.map(
      (k) => k.replace(/_performed$/, "").replace(/_/g, "_") + ": YES",
    );
    lines.push(`  Boundary (${s.boundary.total_keys} keys):`);
    lines.push(`    ${trueLabels.join(" | ")}`);
    lines.push("    All others: NO");
  } else {
    lines.push(`  Boundary (${s.boundary.total_keys} keys): all NO`);
  }

  lines.push("");
  const integrityMsg = v.content_hash_match
    ? "Integrity: content_hash recomputed and matches."
    : `Integrity: MISMATCH — expected ${v.original_hash.slice(0, 16)}..., got ${v.recomputed_hash.slice(0, 16)}...`;
  lines.push(`  ${integrityMsg}`);
  lines.push("=".repeat(42));

  return lines.join("\n");
}
