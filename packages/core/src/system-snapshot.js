import { existsSync } from "node:fs";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildHarnessIntegrationSummary } from "./harness-integration.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = join(__dirname, "..", "..", "..");

const SCHEMA = "bizra.dema.system_snapshot.v0.1";

const MISSION_SOURCES = Object.freeze([
  { id: "health_snapshot", path: "packages/mission/src/health-snapshot.js" },
  { id: "mission_probe", path: "packages/mission/src/mission-probe.js" },
  { id: "mission_closeout", path: "packages/mission/src/mission-closeout.js" },
  { id: "mission_manifest", path: "packages/mission/src/mission-manifest.js" },
]);

const THINK_SOURCES = Object.freeze([
  { id: "think_live", path: "packages/think/src/think-live.js" },
  {
    id: "think_receipt_save",
    path: "packages/think/src/think-receipt-save.js",
  },
  { id: "think_closeout", path: "packages/think/src/think-closeout.js" },
  { id: "think_probe", path: "packages/think/src/think-probe.js" },
]);

const LOCKED_LAYERS = Object.freeze([
  { id: "federation", status: "LOCKED", truth_label: "LOCKED" },
  { id: "token_economy", status: "LOCKED", truth_label: "LOCKED" },
  { id: "node1_urp", status: "LOCKED", truth_label: "LOCKED" },
  { id: "ed25519_authorship", status: "LOCKED", truth_label: "LOCKED" },
  { id: "multi_model_router", status: "LOCKED", truth_label: "LOCKED" },
]);

function checkSources(repoRoot, sources) {
  const results = sources.map((s) => ({
    id: s.id,
    present: existsSync(join(repoRoot, s.path)),
  }));
  const allPresent = results.every((r) => r.present);
  return {
    truth_label: allPresent ? "SOURCE_PRESENT" : "SOURCE_MISSING",
    all_sources_present: allPresent,
    sources: results,
  };
}

function classifyReceipt(filename, dir) {
  try {
    const raw = readFileSync(join(dir, filename), "utf8");
    const parsed = JSON.parse(raw);
    const schema = parsed.schema ?? "";
    if (schema.includes("think_receipt")) return "think";
    if (schema.includes("think_live")) return "think";
    if (schema.includes("mission") || schema.includes("health_snapshot"))
      return "mission";
    if (
      schema.includes("route_receipt") ||
      schema.includes("local_model_route")
    )
      return "route";
  } catch {
    return "corrupt";
  }
  if (filename.startsWith("think-")) return "think";
  if (filename.startsWith("mission-")) return "mission";
  if (filename.startsWith("route-")) return "route";
  return "other";
}

function buildReceiptSummary(demaHome) {
  const dir = join(demaHome, "receipts");
  const warnings = [];
  let total = 0;
  let mission = 0;
  let think = 0;
  let route = 0;
  let corrupt = 0;
  let other = 0;

  if (!existsSync(dir)) {
    return Object.freeze({
      directory: dir,
      total_count: 0,
      mission_count: 0,
      think_count: 0,
      route_count: 0,
      corrupt_count: 0,
      other_count: 0,
      warnings: Object.freeze([]),
      truth_label: "LOCAL_OBSERVED",
    });
  }

  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return Object.freeze({
      directory: dir,
      total_count: 0,
      mission_count: 0,
      think_count: 0,
      route_count: 0,
      corrupt_count: 0,
      other_count: 0,
      warnings: Object.freeze(["receipts directory unreadable"]),
      truth_label: "LOCAL_OBSERVED",
    });
  }

  for (const f of files) {
    total++;
    const kind = classifyReceipt(f, dir);
    if (kind === "mission") mission++;
    else if (kind === "think") think++;
    else if (kind === "route") route++;
    else if (kind === "corrupt") {
      corrupt++;
      warnings.push(`corrupt receipt: ${f}`);
    } else other++;
  }

  return Object.freeze({
    directory: dir,
    total_count: total,
    mission_count: mission,
    think_count: think,
    route_count: route,
    corrupt_count: corrupt,
    other_count: other,
    warnings: Object.freeze(warnings),
    truth_label: "LOCAL_OBSERVED",
  });
}

export function buildSystemSnapshot({
  now = new Date(),
  repoRoot = DEFAULT_REPO_ROOT,
  demaHome,
} = {}) {
  const home =
    typeof demaHome === "string" && demaHome.length > 0
      ? demaHome
      : process.env.DEMA_HOME || join(homedir(), ".dema");

  const harnessSummary = buildHarnessIntegrationSummary({
    now,
    repoRoot,
  });

  const missionLoop = checkSources(repoRoot, MISSION_SOURCES);
  const thinkLoop = checkSources(repoRoot, THINK_SOURCES);
  const receipts = buildReceiptSummary(home);

  return Object.freeze({
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    node: Object.freeze({
      id: "Node0",
      truth_label: "LOCAL_OBSERVED",
    }),
    harness: Object.freeze({
      verdict: harnessSummary.verdict,
      verdict_inputs: Object.freeze({ ...harnessSummary }),
      truth_label: "COMPOSED_FROM_HARNESS",
    }),
    proof_loops: Object.freeze({
      mission: Object.freeze(missionLoop),
      think: Object.freeze(thinkLoop),
    }),
    receipts,
    locked_layers: LOCKED_LAYERS,
    snapshot_inputs: Object.freeze({
      harness_summary: true,
      receipt_directory: true,
      proof_loop_sources: true,
      locked_layers_static_policy: true,
    }),
    boundary: buildPreviewBoundary(),
  });
}

export function formatSystemSnapshot(snapshot) {
  if (snapshot.error) return snapshot.error;

  const lines = [
    "DEMA System Snapshot v0.1",
    "=".repeat(50),
    `  Generated: ${snapshot.generated_at}`,
    `  Node:      ${snapshot.node.id}`,
    "",
    "Harness:",
    `  Verdict:   ${snapshot.harness.verdict} (${snapshot.harness.truth_label})`,
  ];

  lines.push("");
  lines.push("Proof Loops:");
  for (const [name, loop] of Object.entries(snapshot.proof_loops)) {
    const status = loop.all_sources_present ? "COMPLETE" : "INCOMPLETE";
    lines.push(`  ${name}: ${status} (${loop.truth_label})`);
    for (const s of loop.sources) {
      lines.push(`    ${s.present ? "PRESENT" : "MISSING"} ${s.id}`);
    }
  }

  lines.push("");
  lines.push("Receipts:");
  lines.push(`  Directory: ${snapshot.receipts.directory}`);
  lines.push(
    `  Total:     ${snapshot.receipts.total_count} (${snapshot.receipts.truth_label})`,
  );
  if (snapshot.receipts.total_count > 0) {
    lines.push(`    mission: ${snapshot.receipts.mission_count}`);
    lines.push(`    think:   ${snapshot.receipts.think_count}`);
    lines.push(`    route:   ${snapshot.receipts.route_count}`);
    if (snapshot.receipts.other_count > 0)
      lines.push(`    other:   ${snapshot.receipts.other_count}`);
    if (snapshot.receipts.corrupt_count > 0)
      lines.push(`    corrupt: ${snapshot.receipts.corrupt_count}`);
  }
  for (const w of snapshot.receipts.warnings) {
    lines.push(`    ! ${w}`);
  }

  lines.push("");
  lines.push("Locked Layers:");
  for (const layer of snapshot.locked_layers) {
    lines.push(`  ${layer.status} ${layer.id}`);
  }

  lines.push("");
  lines.push("=".repeat(50));
  lines.push(
    "Boundary: read-only snapshot; no execution; no mutation; no model; no network.",
  );

  return lines.join("\n");
}
