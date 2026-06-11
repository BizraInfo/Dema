// N0-MUMU-1 · Node0 Mumu replay verifier v0.1.
//
// Recomputes receipt hashes, verifies the previous_receipt_hash chain,
// re-derives the inventory hash from on-disk records, checks required
// artifacts + boundary flags, and detects tampering. Stdlib only.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256, SCHEMA_PREFIX, SAFE_BOUNDARY } from "./node0-mumu-loop.mjs";

const REQUIRED_ARTIFACTS = [
  "canon/root-canon.v0.1.json",
  "canon/root-source-receipt.v0.1.json",
  "canon/root-canon-map.v0.1.md",
  "state/network-mode.v0.1.json",
  "inventory/metadata-inventory.v0.1.json",
  "realm/world-map.v0.1.json",
  "opportunity/value-register.v0.1.json",
  "quest/recommended-quest.v0.1.json",
  "pat/pat-panel.v0.1.json",
  "sat/sat-passports.v0.1.json",
  "sat/sat-review.v0.1.json",
  "covenant/decision.v0.1.json",
  "receipts/receipt-chain.v0.1.jsonl",
  "poi/impact-preview.v0.1.json",
  "economy/dual-token-preview.v0.1.json",
  "reflection/muhasabah-report.v0.1.md",
];

export function readReceiptChain(outDir) {
  const path = join(outDir, "receipts", "receipt-chain.v0.1.jsonl");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

export function verifyReplay({ outDir }) {
  const abs = resolve(outDir);
  const tamper = [];

  // 1. receipt chain: recompute each hash + verify prev-link
  const receipts = readReceiptChain(abs);
  let chainOk = receipts.length > 0;
  let prev = null;
  for (const r of receipts) {
    const { receipt_hash, ...rest } = r;
    if (sha256(rest) !== receipt_hash) {
      chainOk = false;
      tamper.push(`receipt_hash_mismatch:${r.event_type}`);
    }
    if (r.previous_receipt_hash !== prev) {
      chainOk = false;
      tamper.push(`chain_link_broken:${r.event_type}`);
    }
    prev = receipt_hash;
  }
  const chainHead = prev;

  // 2. inventory integrity: re-derive hash from on-disk records
  let inventoryOk = false;
  const invPath = join(abs, "inventory", "metadata-inventory.v0.1.json");
  if (existsSync(invPath)) {
    try {
      const inv = JSON.parse(readFileSync(invPath, "utf8"));
      inventoryOk = sha256(inv.records) === inv.inventory_hash;
      if (!inventoryOk) tamper.push("inventory_hash_mismatch");
    } catch {
      tamper.push("inventory_unreadable");
    }
  } else {
    tamper.push("inventory_missing");
  }

  // 3. required artifacts present
  const missing = REQUIRED_ARTIFACTS.filter(
    (rel) => !existsSync(join(abs, rel)),
  );
  const artifactsOk = missing.length === 0;
  if (!artifactsOk) tamper.push(...missing.map((m) => `artifact_missing:${m}`));

  // 4. boundary flags safe across all receipts
  const boundaryKeys = Object.keys(SAFE_BOUNDARY);
  const boundaryOk = receipts.every(
    (r) =>
      r.boundary_flags &&
      boundaryKeys.every((k) => r.boundary_flags[k] === false),
  );
  if (!boundaryOk) tamper.push("unsafe_boundary_flags");

  const ok = chainOk && inventoryOk && artifactsOk && boundaryOk;
  const report = {
    schema: `${SCHEMA_PREFIX}_replay_report.v0.1`,
    ok,
    out_dir: abs,
    checks: {
      receipt_chain: chainOk,
      inventory_integrity: inventoryOk,
      required_artifacts_present: artifactsOk,
      boundary_flags_safe: boundaryOk,
    },
    receipt_count: receipts.length,
    receipt_chain_head: chainHead,
    tamper_detected: tamper,
  };
  return report;
}

export function writeReplayReport(outDir, report) {
  const dir = join(resolve(outDir), "replay");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "replay-report.v0.1.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
}

function main() {
  const argv = process.argv.slice(2);
  let outDir = join("artifacts", "node0", "mumu");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") outDir = argv[++i];
  }
  const report = verifyReplay({ outDir });
  writeReplayReport(outDir, report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
