#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCHEMA = "bizra.dema.gtm_readiness_check.v0.1";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

const REQUIRED_FILES = [
  "docs/gtm/BIZRA_90_Day_GTM_v0_1.md",
  "docs/gtm/BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md",
  "docs/LIGHTHOUSE.md",
  "docs/CLAIM_REGISTER_v0_1.md",
  "docs/GTM.md",
  "docs/LLM_SYSTEM_FLOW.md",
  "docs/HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md"
];

const STALE_MARKERS = [
  { pattern: /~2240|~2280|~2340/, reason: "stale projected test counts" },
  { pattern: /#N where N|N ≥ (?:71|75|80|90)/, reason: "stale projected receipt thresholds" },
  { pattern: /Phase-1-close receipt minted|Phase-2-close receipt minted|90-day close receipt minted/, reason: "ungated receipt-mint wording" },
  { pattern: /Next exact phrases after Ring-1 feedback/, reason: "POI test-plan phrase must be independent from Ring-1 feedback" },
  { pattern: /\/tmp\/bizra-overnight\/lighthouse-pack\/ AND/, reason: "non-durable Lighthouse pack path promoted as current" },
  { pattern: /Issue #56 open|see prior turn|TBD|TODO/, reason: "open placeholder or stale issue wording" }
];

const REQUIRED_MARKERS = [
  {
    name: "gtm_current_state_markers",
    file: "docs/gtm/BIZRA_90_Day_GTM_v0_1.md",
    markers: [
      "ac6dd63",
      "2423/2423",
      "73 indexed",
      "GO send pack to <name>",
      "GO author POI v0.1 test plan (no impl)",
      "~/.dema/lighthouse/ring-1/feedback/"
    ]
  },
  {
    name: "phase1_packet_required_phrases",
    file: "docs/gtm/BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md",
    markers: [
      "Documentation only; no outreach; no send; no runtime execution; no receipt mint; no URP initialization; no POI implementation",
      "GO send pack to <name>",
      "GO author POI v0.1 test plan (no impl)",
      "GO impl POI v0.1",
      "independent of the Ring-1 send",
      "~/.dema/lighthouse/ring-1/send-receipts/",
      "~/.dema/lighthouse/ring-1/feedback/"
    ]
  },
  {
    name: "lighthouse_operator_packet_link",
    file: "docs/LIGHTHOUSE.md",
    markers: [
      "docs/gtm/BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md",
      "GO send pack to <name>",
      "authorize a public post, a batch send, a receipt mint, or any runtime action"
    ]
  },
  {
    name: "claim_register_uke_urp_boundary",
    file: "docs/CLAIM_REGISTER_v0_1.md",
    markers: [
      "UKE is the designed SAT-governed House of Wisdom knowledge cortex inside URP",
      "URP is the designed shared substrate",
      "DESIGNED_NOT_LIVE"
    ]
  }
];

const IN_REPO_LAUNCH_PACK_DIR = "docs/launch-pack-v0.1";

function defaultLighthousePackDir() {
  if (!process.env.HOME) return null;
  return join(process.env.HOME, "Documents", "bizra", "lighthouse-pack-v1.0");
}

/** Prefer operator pack on disk; fall back to vendored launch pack for CI and fresh clones. */
export function resolveLighthousePackDir({ root = REPO_ROOT, explicit = null } = {}) {
  if (explicit) return explicit;
  const candidates = [
    defaultLighthousePackDir(),
    join(root, IN_REPO_LAUNCH_PACK_DIR)
  ].filter(Boolean);
  for (const dir of candidates) {
    if (existsSync(join(dir, "MANIFEST.sha256"))) return dir;
  }
  return candidates[0] ?? join(root, IN_REPO_LAUNCH_PACK_DIR);
}

async function readTextIfExists(root, path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) return null;
  return await readFile(fullPath, "utf8");
}

function digestBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function withinDirectory(parent, child) {
  const parentPath = resolve(parent);
  const childPath = resolve(child);
  return childPath === parentPath || childPath.startsWith(`${parentPath}/`);
}

export async function verifyManifestLines({ dir, manifestText }) {
  const entries = [];
  for (const line of manifestText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
    if (!match) {
      entries.push({ path: null, expected_sha256: null, actual_sha256: null, status: "invalid_manifest_line" });
      continue;
    }

    const [, expected, relativePath] = match;
    const fullPath = resolve(dir, relativePath);
    if (!withinDirectory(dir, fullPath)) {
      entries.push({ path: relativePath, expected_sha256: expected, actual_sha256: null, status: "path_outside_pack" });
      continue;
    }
    if (!existsSync(fullPath)) {
      entries.push({ path: relativePath, expected_sha256: expected, actual_sha256: null, status: "missing" });
      continue;
    }

    const actual = digestBuffer(await readFile(fullPath));
    entries.push({
      path: relativePath,
      expected_sha256: expected,
      actual_sha256: actual,
      status: actual === expected ? "ok" : "mismatch"
    });
  }

  return {
    ok: entries.length > 0 && entries.every((entry) => entry.status === "ok"),
    entry_count: entries.length,
    entries
  };
}

function checkRequiredFiles({ root }) {
  return REQUIRED_FILES.map((path) => ({
    name: `file:${path}`,
    ok: existsSync(join(root, path)),
    file: path
  }));
}

function checkRequiredMarkers(fileTexts) {
  return REQUIRED_MARKERS.map((check) => {
    const text = fileTexts.get(check.file) ?? "";
    const missing = check.markers.filter((marker) => !text.includes(marker));
    return {
      name: check.name,
      ok: missing.length === 0,
      file: check.file,
      missing
    };
  });
}

function checkStaleMarkers(fileTexts) {
  const findings = [];
  for (const [file, text] of fileTexts) {
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const stale of STALE_MARKERS) {
        if (!stale.pattern.test(line)) continue;
        findings.push({
          file,
          line: index + 1,
          kind: "stale_gtm_marker",
          reason: stale.reason,
          text: line.trim()
        });
      }
    });
  }

  return {
    name: "stale_gtm_markers_absent",
    ok: findings.length === 0,
    findings
  };
}

async function checkLighthousePack(lighthousePackDir) {
  if (!lighthousePackDir) {
    return {
      ok: false,
      dir: null,
      manifest_path: null,
      finding: "lighthouse_pack_dir_unavailable",
      entries: []
    };
  }

  const manifestPath = join(lighthousePackDir, "MANIFEST.sha256");
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      dir: lighthousePackDir,
      manifest_path: manifestPath,
      finding: "manifest_missing",
      entries: []
    };
  }

  const manifest = await verifyManifestLines({
    dir: lighthousePackDir,
    manifestText: await readFile(manifestPath, "utf8")
  });

  return {
    ok: manifest.ok,
    dir: lighthousePackDir,
    manifest_path: manifestPath,
    finding: manifest.ok ? null : "manifest_mismatch_or_invalid",
    entries: manifest.entries
  };
}

function flattenFindings({ fileChecks, markerChecks, staleCheck, lighthousePack }) {
  const findings = [];
  for (const check of fileChecks) {
    if (check.ok) continue;
    findings.push({ file: check.file, line: null, kind: "missing_file", reason: "required GTM readiness file is missing", text: check.file });
  }
  for (const check of markerChecks) {
    for (const marker of check.missing) {
      findings.push({ file: check.file, line: null, kind: "missing_marker", reason: check.name, text: marker });
    }
  }
  findings.push(...staleCheck.findings);
  if (!lighthousePack.ok) {
    findings.push({
      file: lighthousePack.manifest_path,
      line: null,
      kind: "lighthouse_manifest",
      reason: lighthousePack.finding,
      text: lighthousePack.dir
    });
  }
  return findings;
}

export async function buildGtmReadinessReport({
  root = REPO_ROOT,
  lighthousePackDir = resolveLighthousePackDir({ root })
} = {}) {
  const fileTexts = new Map();
  for (const file of REQUIRED_FILES) {
    const text = await readTextIfExists(root, file);
    if (text !== null) fileTexts.set(file, text);
  }

  const fileChecks = checkRequiredFiles({ root });
  const markerChecks = checkRequiredMarkers(fileTexts);
  const staleCheck = checkStaleMarkers(fileTexts);
  const lighthousePack = await checkLighthousePack(lighthousePackDir);
  const checks = [
    ...fileChecks,
    ...markerChecks,
    {
      name: staleCheck.name,
      ok: staleCheck.ok,
      finding_count: staleCheck.findings.length
    },
    {
      name: "lighthouse_pack_manifest",
      ok: lighthousePack.ok,
      entry_count: lighthousePack.entries.length
    }
  ];
  const findings = flattenFindings({ fileChecks, markerChecks, staleCheck, lighthousePack });

  return {
    schema: SCHEMA,
    mode: "READ_ONLY_AUDIT",
    ok: findings.length === 0,
    checked_files: REQUIRED_FILES,
    checks,
    lighthouse_pack: lighthousePack,
    findings,
    boundary: {
      read_only_audit: true,
      send_performed: false,
      outreach_performed: false,
      runtime_execution: false,
      mutation_performed: false,
      receipt_minted: false,
      urp_initialized: false,
      poi_implemented: false,
      public_post_performed: false
    }
  };
}

export function formatGtmReadinessReport(report) {
  const lines = [
    "DEMA GTM Readiness Check",
    "",
    `Schema: ${report.schema}`,
    `Mode: ${report.mode}`,
    `Result: ${report.ok ? "PASS" : "FAIL"}`,
    "",
    "Checks:"
  ];

  for (const check of report.checks) {
    lines.push(`- ${check.ok ? "PASS" : "FAIL"} ${check.name}`);
  }

  if (report.findings.length > 0) {
    lines.push("", "Findings:");
    for (const finding of report.findings) {
      const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
      lines.push(`- ${location} ${finding.kind}: ${finding.reason}`);
      if (finding.text) lines.push(`  ${finding.text}`);
    }
  }

  lines.push("", "Boundary: read-only audit; no send; no runtime; no receipt mint.");
  return lines.join("\n");
}

function usage() {
  return [
    "Usage: node scripts/gtm-readiness-check.mjs [--json] [--root DIR] [--lighthouse-pack-dir DIR]",
    "",
    "Runs a read-only GTM readiness audit for current docs and the Lighthouse pack manifest."
  ].join("\n");
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  return argv[index + 1] ?? null;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  const json = argv.includes("--json");
  const root = valueAfter(argv, "--root") ?? REPO_ROOT;
  const explicitPack = valueAfter(argv, "--lighthouse-pack-dir");
  const report = await buildGtmReadinessReport({
    root,
    lighthousePackDir: resolveLighthousePackDir({ root, explicit: explicitPack })
  });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatGtmReadinessReport(report));
  }

  return report.ok ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().then((code) => {
    process.exitCode = code;
  }, (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
