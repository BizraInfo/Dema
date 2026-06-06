#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCHEMA = "bizra.dema.gtm_readiness_check.v0.1";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIR);

const GTM_PLAN_FILE = "docs/gtm/BIZRA_90_Day_GTM_v0_1.md";
const ADR_009_FILE = "docs/06-adr/ADR-009-poi-proof-of-impact-design.md";
const ADR_014_FILE =
  "docs/06-adr/ADR-014-three-runtime-architecture-canonization.md";

const REQUIRED_FILES = [
  "docs/gtm/BIZRA_90_Day_GTM_v0_1.md",
  "docs/gtm/BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md",
  "docs/LIGHTHOUSE.md",
  "docs/CLAIM_REGISTER_v0_1.md",
  "docs/GTM.md",
  "docs/LLM_SYSTEM_FLOW.md",
  "docs/HOUSE_OF_WISDOM_UKE_URP_CANON_v0_1.md",
  ADR_009_FILE,
  ADR_014_FILE,
];

const OPEN_OPERATOR_GATES = [
  {
    id: "send_lighthouse_pack_ring1",
    decision: "Send Lighthouse Pack to specific reviewer",
    phase: 1,
    status: "open_operator_required",
    phrase: "GO send pack to <name>",
    expected_evidence: "~/.dema/lighthouse/ring-1/send-receipts/",
  },
  {
    id: "author_poi_v0_1_test_plan",
    decision: "Author POI v0.1 test plan",
    phase: 1,
    status: "open_exact_go_required",
    phrase: "GO author POI v0.1 test plan (no impl)",
    expected_evidence: "dedicated POI v0.1 test-plan artifact",
  },
  {
    id: "urp_local_pool_init_n1",
    decision: "Authorize URP local-pool preview init at N=1",
    phase: 2,
    status: "open_phase2_exact_go_required",
    phrase: "GO urp local init N=1",
    expected_evidence: "dema urp status --json",
  },
  {
    id: "impl_poi_v0_1",
    decision: "Authorize POI v0.1 implementation",
    phase: 2,
    status: "open_phase2_exact_go_required",
    phrase: "GO impl POI v0.1",
    expected_evidence: "tests/poi-v0_1*.test.js",
  },
  {
    id: "sync_adr_013_status",
    decision: "Resolve ADR-013 status sync",
    phase: 1,
    status: "open_exact_go_required",
    phrase: "GO sync ADR-013 status to Accepted",
    expected_evidence:
      "docs/06-adr/ADR-013-visual-language-isomorphism-bizra-cli-to-dema.md",
  },
  {
    id: "resolve_sat5_schema_canon_drift",
    decision: "Resolve SAT-5 schema canon drift",
    phase: 1,
    status: "open_exact_go_required",
    phrases: [
      "GO resolve SAT-5 canon drift by founding-doc verification",
      "GO accept SAT-5 parallel vocabularies",
    ],
    expected_evidence: "self-contained SAT-5 canon note",
  },
  {
    id: "materialize_11_agents",
    decision: "Authorize 12-agent materialization",
    phase: 2,
    status: "open_phase2_exact_go_required",
    phrase: "GO materialize 11 agents",
    expected_evidence: "~/.dema/agents/*/capability.yaml",
  },
  {
    id: "send_ring3_cohort",
    decision: "Authorize Ring-3 cohort send",
    phase: 3,
    status: "open_phase3_exact_go_required",
    phrase: "GO send v1.1 pack to <cohort>",
    expected_evidence: "Ring-3 send receipt after Phase 2 close",
  },
].map((gate) => ({ ...gate, boundary_effect_performed: false }));

const PHASE_STATUS_TEMPLATE = [
  {
    id: "phase_1",
    label: "Phase 1 · Ring-1 external witness conversion",
    status: "open_operator_and_external_evidence_required",
    open_gate_ids: [
      "send_lighthouse_pack_ring1",
      "author_poi_v0_1_test_plan",
      "sync_adr_013_status",
      "resolve_sat5_schema_canon_drift",
    ],
    external_evidence_required: [
      "~/.dema/lighthouse/ring-1/send-receipts/",
      "~/.dema/lighthouse/ring-1/feedback/",
      "phase-1-close receipt after authorized Ring-1 feedback parsing",
    ],
    milestone_gate_phrases: [
      "GO author amendment ADR from <finding>",
      "GO mint phase-1-close",
      "GO phase-2 kick-off authorized",
    ],
    next_safe_action:
      "Await one Phase 1 exact-GO phrase from the operator or external Ring-1 feedback evidence.",
  },
  {
    id: "phase_2",
    label: "Phase 2 · POI activation and Ring-2 cohort",
    status: "blocked_until_phase_1_closes",
    open_gate_ids: [
      "urp_local_pool_init_n1",
      "impl_poi_v0_1",
      "materialize_11_agents",
    ],
    external_evidence_required: [
      "all Phase 1 success criteria closed",
      "phase-2 kick-off authorization",
    ],
    milestone_gate_phrases: [
      "GO receipt POI envelope #1 to chain",
      "GO refresh lighthouse pack to v1.1",
      "GO send v1.1 pack to <names>",
      "GO mint phase-2-close",
    ],
    next_safe_action:
      "Keep POI, URP local init, and agent materialization in planning mode until Phase 1 closes.",
  },
  {
    id: "phase_3",
    label: "Phase 3 · design-partner cohort and pre-public readiness",
    status: "blocked_until_phase_2_closes",
    open_gate_ids: ["send_ring3_cohort"],
    external_evidence_required: [
      "phase-2-close receipt",
      "Ring-2 cohort evidence",
    ],
    milestone_gate_phrases: [
      "GO impl <amendment N>",
      "GO impl URP PAT-SAT allocation preview",
      "GO ots anchor current main",
      "GO mint 90-day close",
    ],
    next_safe_action:
      "Keep Ring-3 send and public-adjacent activity blocked until Phase 2 closes.",
  },
].map((phase) => ({ ...phase, boundary_effect_performed: false }));

const STALE_MARKERS = [
  { pattern: /~2240|~2280|~2340/, reason: "stale projected test counts" },
  {
    pattern: /#N where N|N ≥ (?:71|75|80|90)/,
    reason: "stale projected receipt thresholds",
  },
  {
    pattern:
      /Phase-1-close receipt minted|Phase-2-close receipt minted|90-day close receipt minted/,
    reason: "ungated receipt-mint wording",
  },
  {
    pattern: /Next exact phrases after Ring-1 feedback/,
    reason: "POI test-plan phrase must be independent from Ring-1 feedback",
  },
  {
    pattern: /\/tmp\/bizra-overnight\/lighthouse-pack\/ AND/,
    reason: "non-durable Lighthouse pack path promoted as current",
  },
  {
    pattern: /Issue #56 open|see prior turn|TBD|TODO/,
    reason: "open placeholder or stale issue wording",
  },
];

const REQUIRED_MARKERS = [
  {
    name: "gtm_current_state_markers",
    file: "docs/gtm/BIZRA_90_Day_GTM_v0_1.md",
    markers: [
      "004e887",
      "2443/2443",
      "73 indexed",
      "GO send pack to <name>",
      "GO author POI v0.1 test plan (no impl)",
      "npm run urp:discovery",
      "npm run proof:room",
      "~/.dema/lighthouse/ring-1/feedback/",
    ],
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
      "~/.dema/lighthouse/ring-1/feedback/",
    ],
  },
  {
    name: "lighthouse_operator_packet_link",
    file: "docs/LIGHTHOUSE.md",
    markers: [
      "docs/gtm/BIZRA_GTM_PHASE1_OPERATOR_PACKET_v0_1.md",
      "GO send pack to <name>",
      "authorize a public post, a batch send, a receipt mint, or any runtime action",
    ],
  },
  {
    name: "claim_register_uke_urp_boundary",
    file: "docs/CLAIM_REGISTER_v0_1.md",
    markers: [
      "UKE is the designed SAT-governed House of Wisdom knowledge cortex inside URP",
      "URP is the designed shared substrate",
      "DESIGNED_NOT_LIVE",
    ],
  },
];

const IN_REPO_LAUNCH_PACK_DIR = "docs/launch-pack-v0.1";

function defaultLighthousePackDir() {
  if (!process.env.HOME) return null;
  return join(process.env.HOME, "Documents", "bizra", "lighthouse-pack-v1.0");
}

export function resolveDemaHome({ explicit = null } = {}) {
  if (explicit) return explicit;
  if (process.env.DEMA_HOME) return process.env.DEMA_HOME;
  if (process.env.HOME) return join(process.env.HOME, ".dema");
  return null;
}

/** Prefer operator pack on disk; fall back to vendored launch pack for CI and fresh clones. */
export function resolveLighthousePackDir({
  root = REPO_ROOT,
  explicit = null,
} = {}) {
  if (explicit) return explicit;
  const candidates = [
    defaultLighthousePackDir(),
    join(root, IN_REPO_LAUNCH_PACK_DIR),
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
      entries.push({
        path: null,
        expected_sha256: null,
        actual_sha256: null,
        status: "invalid_manifest_line",
      });
      continue;
    }

    const [, expected, relativePath] = match;
    const fullPath = resolve(dir, relativePath);
    if (!withinDirectory(dir, fullPath)) {
      entries.push({
        path: relativePath,
        expected_sha256: expected,
        actual_sha256: null,
        status: "path_outside_pack",
      });
      continue;
    }
    if (!existsSync(fullPath)) {
      entries.push({
        path: relativePath,
        expected_sha256: expected,
        actual_sha256: null,
        status: "missing",
      });
      continue;
    }

    const actual = digestBuffer(await readFile(fullPath));
    entries.push({
      path: relativePath,
      expected_sha256: expected,
      actual_sha256: actual,
      status: actual === expected ? "ok" : "mismatch",
    });
  }

  return {
    ok: entries.length > 0 && entries.every((entry) => entry.status === "ok"),
    entry_count: entries.length,
    entries,
  };
}

function checkRequiredFiles({ root }) {
  return REQUIRED_FILES.map((path) => ({
    name: `file:${path}`,
    ok: existsSync(join(root, path)),
    file: path,
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
      missing,
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
          text: line.trim(),
        });
      }
    });
  }

  return {
    name: "stale_gtm_markers_absent",
    ok: findings.length === 0,
    findings,
  };
}

function gatePhrases(gate) {
  return gate.phrases ?? [gate.phrase];
}

function checkOpenOperatorGates(fileTexts) {
  const text = fileTexts.get(GTM_PLAN_FILE) ?? "";
  const missing = [];
  for (const gate of OPEN_OPERATOR_GATES) {
    for (const phrase of gatePhrases(gate)) {
      if (text.includes(phrase)) continue;
      missing.push({ id: gate.id, phrase });
    }
  }

  return {
    name: "open_operator_gates_declared",
    ok: missing.length === 0,
    file: GTM_PLAN_FILE,
    gate_count: OPEN_OPERATOR_GATES.length,
    missing,
  };
}

function checkPhaseMilestoneGates(fileTexts) {
  const text = fileTexts.get(GTM_PLAN_FILE) ?? "";
  const missing = [];
  for (const phase of PHASE_STATUS_TEMPLATE) {
    for (const phrase of phase.milestone_gate_phrases) {
      if (text.includes(phrase)) continue;
      missing.push({ id: phase.id, phrase });
    }
  }

  return {
    name: "phase_milestone_gates_declared",
    ok: missing.length === 0,
    file: GTM_PLAN_FILE,
    gate_count: PHASE_STATUS_TEMPLATE.reduce(
      (count, phase) => count + phase.milestone_gate_phrases.length,
      0,
    ),
    missing,
  };
}

function buildPhaseStatus(openOperatorGates = OPEN_OPERATOR_GATES) {
  const gatesById = new Map(openOperatorGates.map((gate) => [gate.id, gate]));
  return PHASE_STATUS_TEMPLATE.map((phase) => ({
    ...phase,
    open_gates: phase.open_gate_ids
      .map((id) => gatesById.get(id))
      .filter(Boolean),
  }));
}

function isAdrAccepted(fileTexts, file) {
  const text = fileTexts.get(file) ?? "";
  return /^\*\*Status:\*\*\s*Accepted\b/m.test(text);
}

async function listMarkdownEvidenceFiles(dir) {
  if (!dir) {
    return {
      ok: false,
      error: "dema_home_unavailable",
      entries: [],
    };
  }

  try {
    const dirents = await readdir(dir, { withFileTypes: true });
    const entries = [];
    for (const dirent of dirents) {
      if (!dirent.isFile()) continue;
      if (!dirent.name.endsWith(".md")) continue;
      const fullPath = join(dir, dirent.name);
      const fileStat = await stat(fullPath);
      entries.push({
        name: dirent.name,
        path: fullPath,
        size_bytes: fileStat.size,
      });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return {
      ok: true,
      error: null,
      entries,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        ok: true,
        error: null,
        entries: [],
      };
    }
    return {
      ok: false,
      error: error?.code ?? error?.message ?? "evidence_scan_failed",
      entries: [],
    };
  }
}

function phase1EvidenceStatus(counts) {
  if (counts.send_receipts > 0 && counts.feedback_documents > 0) {
    return "evidence_present_ready_for_operator_review";
  }
  if (counts.send_receipts > 0)
    return "send_recorded_waiting_for_reviewer_feedback";
  if (counts.feedback_documents > 0)
    return "feedback_recorded_waiting_for_send_receipt";
  return "waiting_for_operator_send_and_reviewer_feedback";
}

function phase1EvidenceNextSafeAction(status) {
  if (status === "evidence_present_ready_for_operator_review") {
    return "Review Ring-1 feedback privately; only exact `GO author amendment ADR from <finding>` can start amendment drafting, and no phase-close receipt is implied.";
  }
  if (status === "send_recorded_waiting_for_reviewer_feedback") {
    return "Await one filled Ring-1 feedback document under the private feedback path before treating POI Gate 1 as review-ready.";
  }
  if (status === "feedback_recorded_waiting_for_send_receipt") {
    return "Record the private Ring-1 send receipt before treating Phase 1 evidence as review-ready.";
  }
  if (status === "evidence_scan_unavailable") {
    return "Set DEMA_HOME or HOME so the read-only Phase 1 evidence paths can be inspected.";
  }
  return "Await exact `GO send pack to <name>` and then one Ring-1 feedback document; no send, outreach, or receipt mint is performed by this audit.";
}

async function buildPhase1EvidenceReport({
  demaHome = resolveDemaHome(),
} = {}) {
  const sendReceiptsDir = demaHome
    ? join(demaHome, "lighthouse", "ring-1", "send-receipts")
    : null;
  const feedbackDir = demaHome
    ? join(demaHome, "lighthouse", "ring-1", "feedback")
    : null;
  const sendReceipts = await listMarkdownEvidenceFiles(sendReceiptsDir);
  const feedbackDocuments = await listMarkdownEvidenceFiles(feedbackDir);
  const counts = {
    send_receipts: sendReceipts.entries.length,
    feedback_documents: feedbackDocuments.entries.length,
  };
  const scanErrors = [
    sendReceipts.ok ? null : `send_receipts:${sendReceipts.error}`,
    feedbackDocuments.ok
      ? null
      : `feedback_documents:${feedbackDocuments.error}`,
  ].filter(Boolean);
  const scanOk = Boolean(demaHome) && scanErrors.length === 0;
  const status = scanOk
    ? phase1EvidenceStatus(counts)
    : "evidence_scan_unavailable";

  return {
    schema: "bizra.dema.gtm.phase1_evidence.v0.1",
    mode: "READ_ONLY_AUDIT",
    status,
    dema_home: demaHome,
    private_paths: {
      send_receipts_dir: sendReceiptsDir,
      feedback_dir: feedbackDir,
    },
    required_counts: {
      send_receipts: 1,
      feedback_documents: 1,
    },
    counts,
    send_receipts: sendReceipts.entries,
    feedback_documents: feedbackDocuments.entries,
    scan_ok: scanOk,
    scan_errors: scanErrors,
    next_safe_action: phase1EvidenceNextSafeAction(status),
    boundary: {
      read_only_audit: true,
      feedback_content_read: false,
      reviewer_identity_published: false,
      feedback_published: false,
      send_performed: false,
      receipt_minted: false,
      runtime_execution: false,
    },
  };
}

function phase1Criterion({
  id,
  label,
  satisfied,
  status,
  evidence = [],
  required_evidence = [],
  exact_phrase = null,
}) {
  return {
    id,
    label,
    satisfied,
    status,
    evidence,
    required_evidence,
    exact_phrase,
    boundary_effect_performed: false,
  };
}

function buildPhase1SuccessCriteria({ fileTexts, phase1Evidence }) {
  const adr009Accepted = isAdrAccepted(fileTexts, ADR_009_FILE);
  const adr014Accepted = isAdrAccepted(fileTexts, ADR_014_FILE);
  const hasSendReceipt = phase1Evidence.counts.send_receipts > 0;
  const hasFeedback = phase1Evidence.counts.feedback_documents > 0;
  const hasSendAndFeedback = hasSendReceipt && hasFeedback;
  const criteria = [
    phase1Criterion({
      id: "adr_009_accepted",
      label: "ADR-009 status: Accepted",
      satisfied: adr009Accepted,
      status: adr009Accepted ? "satisfied" : "open_adr_status_required",
      evidence: adr009Accepted
        ? [`${ADR_009_FILE} declares **Status:** Accepted`]
        : [],
      required_evidence: adr009Accepted
        ? []
        : [`${ADR_009_FILE} status field must declare Accepted`],
    }),
    phase1Criterion({
      id: "adr_014_accepted",
      label: "ADR-014 status: Accepted",
      satisfied: adr014Accepted,
      status: adr014Accepted ? "satisfied" : "open_adr_status_required",
      evidence: adr014Accepted
        ? [`${ADR_014_FILE} declares **Status:** Accepted`]
        : [],
      required_evidence: adr014Accepted
        ? []
        : [`${ADR_014_FILE} status field must declare Accepted`],
    }),
    phase1Criterion({
      id: "ring1_feedback_on_record",
      label: "Ring-1 N=1 reviewer has signed feedback on record",
      satisfied: hasFeedback,
      status: hasFeedback ? "satisfied" : "open_external_evidence_required",
      evidence: hasFeedback
        ? [
            `${phase1Evidence.counts.feedback_documents} private feedback document(s) counted metadata-only`,
          ]
        : [],
      required_evidence: hasFeedback
        ? []
        : ["~/.dema/lighthouse/ring-1/feedback/*.md"],
    }),
    phase1Criterion({
      id: "poi_gate_1_ring1_feedback_closed",
      label: "POI v0.1 Gate 1 (Ring-1 feedback) closed",
      satisfied: false,
      status: hasSendAndFeedback
        ? "evidence_present_operator_review_required"
        : "blocked_until_send_receipt_and_feedback_exist",
      evidence: [
        `${phase1Evidence.counts.send_receipts} private send receipt(s) counted metadata-only`,
        `${phase1Evidence.counts.feedback_documents} private feedback document(s) counted metadata-only`,
      ],
      required_evidence: [
        "private send receipt for one Ring-1 reviewer",
        "filled feedback form from that reviewer",
        "at least one finding classified as hold, fixable gap, or structural blocker",
        "written operator decision on whether Phase 1 advances, repeats, or halts",
      ],
    }),
    phase1Criterion({
      id: "poi_gate_4_test_plan_closed",
      label: "POI v0.1 Gate 4 (>=15 adversarial test plan) closed",
      satisfied: false,
      status: "open_exact_go_required",
      required_evidence: [
        "dedicated POI v0.1 test-plan artifact; no implementation",
      ],
      exact_phrase: "GO author POI v0.1 test plan (no impl)",
    }),
    phase1Criterion({
      id: "phase1_close_receipt_recorded",
      label: "Phase-1-close proof-forge receipt recorded",
      satisfied: false,
      status: "blocked_until_phase1_evidence_and_exact_go",
      required_evidence: [
        "authorized phase-1-close proof-forge receipt after Ring-1 evidence review",
      ],
      exact_phrase: "GO mint phase-1-close",
    }),
    phase1Criterion({
      id: "reviewer_surprising_finding_memory",
      label: "Memory entry captures reviewer's most surprising finding",
      satisfied: false,
      status: "blocked_until_feedback_review",
      required_evidence: [
        "operator-local memory entry after authorized private feedback review",
      ],
    }),
  ];
  const satisfiedCount = criteria.filter(
    (criterion) => criterion.satisfied,
  ).length;

  return {
    schema: "bizra.dema.gtm.phase1_success_criteria.v0.1",
    mode: "READ_ONLY_AUDIT",
    status:
      satisfiedCount === criteria.length
        ? "phase1_success_criteria_satisfied"
        : "phase1_open",
    summary: {
      total: criteria.length,
      satisfied: satisfiedCount,
      open: criteria.length - satisfiedCount,
    },
    criteria,
    boundary: {
      read_only_audit: true,
      private_feedback_content_read: false,
      operator_memory_written: false,
      receipt_minted: false,
      poi_implemented: false,
      runtime_execution: false,
    },
  };
}

async function checkLighthousePack(lighthousePackDir) {
  if (!lighthousePackDir) {
    return {
      ok: false,
      dir: null,
      manifest_path: null,
      finding: "lighthouse_pack_dir_unavailable",
      entries: [],
    };
  }

  const manifestPath = join(lighthousePackDir, "MANIFEST.sha256");
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      dir: lighthousePackDir,
      manifest_path: manifestPath,
      finding: "manifest_missing",
      entries: [],
    };
  }

  const manifest = await verifyManifestLines({
    dir: lighthousePackDir,
    manifestText: await readFile(manifestPath, "utf8"),
  });

  return {
    ok: manifest.ok,
    dir: lighthousePackDir,
    manifest_path: manifestPath,
    finding: manifest.ok ? null : "manifest_mismatch_or_invalid",
    entries: manifest.entries,
  };
}

function flattenFindings({
  fileChecks,
  markerChecks,
  staleCheck,
  openGateCheck,
  phaseMilestoneCheck,
  phase1Evidence,
  lighthousePack,
}) {
  const findings = [];
  for (const check of fileChecks) {
    if (check.ok) continue;
    findings.push({
      file: check.file,
      line: null,
      kind: "missing_file",
      reason: "required GTM readiness file is missing",
      text: check.file,
    });
  }
  for (const check of markerChecks) {
    for (const marker of check.missing) {
      findings.push({
        file: check.file,
        line: null,
        kind: "missing_marker",
        reason: check.name,
        text: marker,
      });
    }
  }
  findings.push(...staleCheck.findings);
  for (const missing of openGateCheck.missing) {
    findings.push({
      file: openGateCheck.file,
      line: null,
      kind: "missing_open_operator_gate",
      reason: missing.id,
      text: missing.phrase,
    });
  }
  for (const missing of phaseMilestoneCheck.missing) {
    findings.push({
      file: phaseMilestoneCheck.file,
      line: null,
      kind: "missing_phase_milestone_gate",
      reason: missing.id,
      text: missing.phrase,
    });
  }
  if (!phase1Evidence.scan_ok) {
    findings.push({
      file: phase1Evidence.dema_home,
      line: null,
      kind: "phase1_evidence_scan",
      reason: phase1Evidence.scan_errors.join(", ") || "dema_home_unavailable",
      text: "Phase 1 evidence scan could not resolve DEMA_HOME or ~/.dema",
    });
  }
  if (!lighthousePack.ok) {
    findings.push({
      file: lighthousePack.manifest_path,
      line: null,
      kind: "lighthouse_manifest",
      reason: lighthousePack.finding,
      text: lighthousePack.dir,
    });
  }
  return findings;
}

export async function buildGtmReadinessReport({
  root = REPO_ROOT,
  lighthousePackDir = resolveLighthousePackDir({ root }),
  demaHome = resolveDemaHome(),
} = {}) {
  const fileTexts = new Map();
  for (const file of REQUIRED_FILES) {
    const text = await readTextIfExists(root, file);
    if (text !== null) fileTexts.set(file, text);
  }

  const fileChecks = checkRequiredFiles({ root });
  const markerChecks = checkRequiredMarkers(fileTexts);
  const staleCheck = checkStaleMarkers(fileTexts);
  const openGateCheck = checkOpenOperatorGates(fileTexts);
  const phaseMilestoneCheck = checkPhaseMilestoneGates(fileTexts);
  const phaseStatus = buildPhaseStatus(OPEN_OPERATOR_GATES);
  const phase1Evidence = await buildPhase1EvidenceReport({ demaHome });
  const phase1SuccessCriteria = buildPhase1SuccessCriteria({
    fileTexts,
    phase1Evidence,
  });
  const lighthousePack = await checkLighthousePack(lighthousePackDir);
  const checks = [
    ...fileChecks,
    ...markerChecks,
    {
      name: staleCheck.name,
      ok: staleCheck.ok,
      finding_count: staleCheck.findings.length,
    },
    {
      name: openGateCheck.name,
      ok: openGateCheck.ok,
      gate_count: openGateCheck.gate_count,
      missing_count: openGateCheck.missing.length,
    },
    {
      name: phaseMilestoneCheck.name,
      ok: phaseMilestoneCheck.ok,
      gate_count: phaseMilestoneCheck.gate_count,
      missing_count: phaseMilestoneCheck.missing.length,
    },
    {
      name: "phase1_evidence_scanned",
      ok: phase1Evidence.scan_ok,
      send_receipt_count: phase1Evidence.counts.send_receipts,
      feedback_document_count: phase1Evidence.counts.feedback_documents,
    },
    {
      name: "phase1_success_criteria_tracked",
      ok: true,
      total: phase1SuccessCriteria.summary.total,
      satisfied: phase1SuccessCriteria.summary.satisfied,
      open: phase1SuccessCriteria.summary.open,
    },
    {
      name: "lighthouse_pack_manifest",
      ok: lighthousePack.ok,
      entry_count: lighthousePack.entries.length,
    },
  ];
  const findings = flattenFindings({
    fileChecks,
    markerChecks,
    staleCheck,
    openGateCheck,
    phaseMilestoneCheck,
    phase1Evidence,
    lighthousePack,
  });

  return {
    schema: SCHEMA,
    mode: "READ_ONLY_AUDIT",
    ok: findings.length === 0,
    checked_files: REQUIRED_FILES,
    checks,
    open_operator_gates: OPEN_OPERATOR_GATES,
    phase_status: phaseStatus,
    phase1_evidence: phase1Evidence,
    phase1_success_criteria: phase1SuccessCriteria,
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
      public_post_performed: false,
    },
  };
}

function formatGatePhrase(gate) {
  return gatePhrases(gate).join(" OR ");
}

export function formatGtmReadinessReport(report) {
  const lines = [
    "DEMA GTM Readiness Check",
    "",
    `Schema: ${report.schema}`,
    `Mode: ${report.mode}`,
    `Result: ${report.ok ? "PASS" : "FAIL"}`,
    "",
    "Checks:",
  ];

  for (const check of report.checks) {
    lines.push(`- ${check.ok ? "PASS" : "FAIL"} ${check.name}`);
  }

  if (report.open_operator_gates?.length > 0) {
    lines.push("", "Open Operator Gates:");
    for (const gate of report.open_operator_gates) {
      lines.push(
        `- Phase ${gate.phase} ${gate.id}: ${gate.status}; phrase: ${formatGatePhrase(gate)}`,
      );
    }
  }

  if (report.phase_status?.length > 0) {
    lines.push("", "Phase Status:");
    for (const phase of report.phase_status) {
      lines.push(
        `- ${phase.id}: ${phase.status}; milestone phrases: ${phase.milestone_gate_phrases.length}`,
      );
    }
  }

  if (report.phase1_evidence) {
    lines.push("", "Phase 1 Evidence:");
    lines.push(`- status: ${report.phase1_evidence.status}`);
    lines.push(
      `- send receipts: ${report.phase1_evidence.counts.send_receipts}/${report.phase1_evidence.required_counts.send_receipts}`,
    );
    lines.push(
      `- feedback documents: ${report.phase1_evidence.counts.feedback_documents}/${report.phase1_evidence.required_counts.feedback_documents}`,
    );
    lines.push(`- next: ${report.phase1_evidence.next_safe_action}`);
  }

  if (report.phase1_success_criteria) {
    lines.push("", "Phase 1 Success Criteria:");
    lines.push(
      `- satisfied: ${report.phase1_success_criteria.summary.satisfied}/${report.phase1_success_criteria.summary.total}`,
    );
    for (const criterion of report.phase1_success_criteria.criteria) {
      lines.push(`- ${criterion.id}: ${criterion.status}`);
    }
  }

  if (report.findings.length > 0) {
    lines.push("", "Findings:");
    for (const finding of report.findings) {
      const location = finding.line
        ? `${finding.file}:${finding.line}`
        : finding.file;
      lines.push(`- ${location} ${finding.kind}: ${finding.reason}`);
      if (finding.text) lines.push(`  ${finding.text}`);
    }
  }

  lines.push(
    "",
    "Boundary: read-only audit; no send; no runtime; no receipt mint.",
  );
  return lines.join("\n");
}

function usage() {
  return [
    "Usage: node scripts/gtm-readiness-check.mjs [--json] [--root DIR] [--lighthouse-pack-dir DIR] [--dema-home DIR]",
    "",
    "Runs a read-only GTM readiness audit for current docs and the Lighthouse pack manifest.",
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
  const explicitDemaHome = valueAfter(argv, "--dema-home");
  const report = await buildGtmReadinessReport({
    root,
    lighthousePackDir: resolveLighthousePackDir({
      root,
      explicit: explicitPack,
    }),
    demaHome: resolveDemaHome({ explicit: explicitDemaHome }),
  });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatGtmReadinessReport(report));
  }

  return report.ok ? 0 : 1;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
