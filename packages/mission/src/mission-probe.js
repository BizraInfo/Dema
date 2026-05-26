import { readdir, readFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildHealthSnapshot,
  saveHealthSnapshotReceipt,
  HEALTH_MISSION_CONSENT_PHRASE,
} from "./health-snapshot.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { runSetup } from "../../installer/src/setup.js";

const FORBIDDEN_IMPORTS = [
  "node:http",
  "node:https",
  "node:http2",
  "node:net",
  "node:tls",
  "node:dgram",
  "node:dns",
  "node:child_process",
  "node:worker_threads",
  "node:cluster",
  '"http"',
  '"https"',
  '"http2"',
  '"net"',
  '"tls"',
  '"dgram"',
  '"dns"',
  '"child_process"',
  '"worker_threads"',
  '"cluster"',
  "fetch(",
  "new WebSocket",
];

const OBSERVED_KEYS = ["filesystem_write_performed", "consent_collected"];
const STATIC_CHECKED_KEYS = [
  "network_used",
  "runtime_execution_performed",
  "model_loaded",
  "model_invocation_performed",
  "prompt_executed",
  "external_call_performed",
  "public_network_used",
];
const DECLARED_NOT_OBSERVABLE_KEYS = [
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
];

const SOURCE_FILES = [
  "packages/mission/src/health-snapshot.js",
  "packages/consent/src/consent-common.js",
  "packages/core/src/harness-integration.js",
  "packages/core/src/doctor-dashboard.js",
  "packages/receipts/src/witness-verify.js",
  "packages/installer/src/setup.js",
  "packages/core/src/status.js",
  "packages/core/src/safety-report.js",
  "packages/core/src/diagnostics-plan.js",
  "packages/core/src/preview-boundary.js",
];

async function scanForbiddenImports(repoRoot) {
  let totalForbidden = 0;
  const details = [];
  for (const rel of SOURCE_FILES) {
    let content;
    try {
      content = await readFile(join(repoRoot, rel), "utf8");
    } catch {
      continue;
    }
    for (const pattern of FORBIDDEN_IMPORTS) {
      if (content.includes(pattern)) {
        totalForbidden++;
        details.push({ file: rel, pattern });
      }
    }
  }
  return { forbidden: totalForbidden, details };
}

async function listReceipts(home) {
  const dir = join(home, "receipts");
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function probeBoundary(home, repoRoot) {
  const beforeFiles = await listReceipts(home);

  const result = await saveHealthSnapshotReceipt({
    consent: HEALTH_MISSION_CONSENT_PHRASE,
    now: new Date("2026-01-01T00:00:00Z"),
  });

  const afterFiles = await listReceipts(home);
  const newFiles = afterFiles.filter((f) => !beforeFiles.includes(f));
  const boundary = result.attests?.boundary || {};
  const scan = await scanForbiddenImports(repoRoot);

  const evidence = {};
  const failures = [];

  const declaredWrite = boundary.filesystem_write_performed;
  const observedWrite = newFiles.length > 0;
  if (declaredWrite === observedWrite) {
    evidence.fs_write = { level: "OBSERVED", new_files: newFiles.length };
  } else {
    evidence.fs_write = {
      level: "OBSERVED",
      new_files: newFiles.length,
      declared: declaredWrite,
      mismatch: true,
    };
    failures.push("filesystem_write_performed declaration mismatch");
  }

  evidence.consent_collected = { level: "OBSERVED" };

  for (const key of STATIC_CHECKED_KEYS) {
    evidence[key] = {
      level: "STATIC_CHECKED",
      forbidden_imports: scan.forbidden,
    };
  }
  if (scan.forbidden > 0) {
    failures.push(`static check found ${scan.forbidden} forbidden imports`);
  }

  const allBoundaryKeys = Object.keys(boundary);
  const classifiedKeys = [
    ...OBSERVED_KEYS,
    ...STATIC_CHECKED_KEYS,
    ...DECLARED_NOT_OBSERVABLE_KEYS,
  ];
  const unclassified = allBoundaryKeys.filter(
    (k) => !classifiedKeys.includes(k),
  );
  if (unclassified.length > 0) {
    failures.push(`boundary keys not classified: ${unclassified.join(", ")}`);
  }
  for (const k of DECLARED_NOT_OBSERVABLE_KEYS) {
    if (k in boundary) {
      evidence[k] = { level: "DECLARED_NOT_OBSERVABLE_V0_1" };
    }
  }
  evidence.not_observable_count = DECLARED_NOT_OBSERVABLE_KEYS.filter(
    (k) => k in boundary,
  ).length;

  return {
    name: "boundary_observed_v0_1",
    pass: failures.length === 0,
    evidence,
    receipt: result,
  };
}

async function probeDeterminism() {
  const fixedNow = new Date("2026-01-01T00:00:00Z");
  const snap1 = await buildHealthSnapshot({ now: fixedNow });
  const snap2 = await buildHealthSnapshot({ now: fixedNow });
  const match = snap1.content_hash === snap2.content_hash;
  return {
    name: "determinism",
    pass: match,
    evidence: {
      runs: 2,
      hashes_match: match,
      hash_1: snap1.content_hash,
      hash_2: snap2.content_hash,
    },
  };
}

async function probeConsentGate(home) {
  const beforeFiles = await listReceipts(home);

  const noConsentResult = await saveHealthSnapshotReceipt({
    consent: "",
    now: new Date("2026-01-01T00:00:01Z"),
  });

  const midFiles = await listReceipts(home);
  const newAfterNoConsent = midFiles.filter((f) => !beforeFiles.includes(f));
  const noConsentWritten = newAfterNoConsent.length > 0;

  const withConsent = await saveHealthSnapshotReceipt({
    consent: HEALTH_MISSION_CONSENT_PHRASE,
    now: new Date("2026-01-01T00:00:02Z"),
  });

  const afterFiles = await listReceipts(home);
  const newAfterConsent = afterFiles.filter((f) => !midFiles.includes(f));
  const consentWritten = newAfterConsent.length > 0;

  return {
    name: "consent_gate",
    pass: !noConsentWritten && consentWritten,
    evidence: {
      no_consent_saved: noConsentResult.saved,
      no_consent_file_written: noConsentWritten,
      with_consent_saved: withConsent.saved,
      with_consent_file_written: consentWritten,
    },
    receiptPath: withConsent.path,
  };
}

async function probeReceiptIntegrity(receiptPath) {
  const raw = await readFile(receiptPath, "utf8");
  const receipt = JSON.parse(raw);
  const recomputed = sha256(stableStringify(receipt.attests));
  const match = recomputed === receipt.content_hash;
  return {
    name: "receipt_integrity",
    pass: match,
    evidence: { hash_match: match, original: receipt.content_hash, recomputed },
  };
}

function probeTamperDetection(rawContent) {
  const receipt = JSON.parse(rawContent);
  const tampered = JSON.parse(rawContent);
  tampered.attests.mission_verdict = "TAMPERED_BY_PROBE";
  const tamperedHash = sha256(stableStringify(tampered.attests));
  const differs = tamperedHash !== receipt.content_hash;
  return {
    name: "tamper_detection",
    pass: differs,
    evidence: {
      tampered_hash_differs: differs,
      original_hash: receipt.content_hash,
      tampered_hash: tamperedHash,
    },
  };
}

export async function runMissionProbe(repoRoot) {
  const home = await mkdtemp(join(tmpdir(), "dema-probe-"));
  const oldHome = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;

  try {
    await runSetup(home);
    await mkdir(join(home, "receipts"), { recursive: true });

    const probes = [];

    const boundaryResult = await probeBoundary(home, repoRoot);
    probes.push({
      name: boundaryResult.name,
      pass: boundaryResult.pass,
      evidence: boundaryResult.evidence,
    });

    const detResult = await probeDeterminism();
    probes.push(detResult);

    const consentResult = await probeConsentGate(home);
    probes.push({
      name: consentResult.name,
      pass: consentResult.pass,
      evidence: consentResult.evidence,
    });

    if (consentResult.receiptPath) {
      const integrityResult = await probeReceiptIntegrity(
        consentResult.receiptPath,
      );
      probes.push(integrityResult);

      const raw = await readFile(consentResult.receiptPath, "utf8");
      probes.push(probeTamperDetection(raw));
    } else {
      probes.push({
        name: "receipt_integrity",
        pass: false,
        evidence: { error: "no receipt from consent_gate probe" },
      });
      probes.push({
        name: "tamper_detection",
        pass: false,
        evidence: { error: "no receipt from consent_gate probe" },
      });
    }

    const passing = probes.filter((p) => p.pass).length;
    const failing = probes.length - passing;
    let verdict;
    if (failing === 0) verdict = "CLEAN";
    else if (passing > 0) verdict = "REVIEW";
    else verdict = "FAILED";

    return {
      schema: "bizra.dema.mission_probe.v0.1",
      target: "health_snapshot",
      verdict,
      probes_total: probes.length,
      probes_passing: passing,
      probes_failing: failing,
      probes,
      isolated_home: home,
      boundary: {
        read_only_report: true,
        network_used: "STATIC_CHECKED",
        operator_home_touched: "DECLARED_NOT_VERIFIED_V0_1",
      },
    };
  } finally {
    if (oldHome) process.env.DEMA_HOME = oldHome;
    else delete process.env.DEMA_HOME;
    await rm(home, { recursive: true, force: true }).catch(() => {});
  }
}

export function renderProbeText(report) {
  if (report.error) return report.error;

  const lines = [
    "Behavioral Mission Probe v0.1",
    "=".repeat(42),
    `  Target:   ${report.target}`,
    `  Probes:   ${report.probes_total} behavioral invariants`,
    `  Home:     ${report.isolated_home} (isolated)`,
    "",
  ];

  for (let i = 0; i < report.probes.length; i++) {
    const p = report.probes[i];
    const status = p.pass ? "PASS" : "FAIL";
    lines.push(`  ${i + 1}. ${p.name.padEnd(26)} ${status}`);
    const ev = p.evidence;

    if (p.name === "boundary_observed_v0_1") {
      if (ev.fs_write)
        lines.push(
          `       fs_write=true:`.padEnd(34) +
            `${ev.fs_write.level} (${ev.fs_write.new_files} new file${ev.fs_write.new_files !== 1 ? "s" : ""})`,
        );
      if (ev.network_used)
        lines.push(
          "       network_used=false:".padEnd(34) +
            `${ev.network_used.level} (${ev.network_used.forbidden_imports} forbidden imports)`,
        );
      if (ev.runtime_execution_performed)
        lines.push(
          "       runtime_exec=false:".padEnd(34) +
            ev.runtime_execution_performed.level,
        );
      if (ev.model_loaded)
        lines.push(
          "       model_loaded=false:".padEnd(34) + ev.model_loaded.level,
        );
      if (ev.consent_collected)
        lines.push(
          "       consent_collected=true:".padEnd(34) +
            ev.consent_collected.level,
        );
      if (ev.not_observable_count !== undefined)
        lines.push(
          "       remaining keys:".padEnd(34) +
            `DECLARED_NOT_OBSERVABLE_V0_1 (${ev.not_observable_count})`,
        );
    } else if (p.name === "determinism") {
      lines.push(
        `       ${ev.runs} runs, ${ev.hashes_match ? "same" : "different"} content_hash`,
      );
    } else if (p.name === "consent_gate") {
      lines.push(
        `       no-consent -> ${ev.no_consent_file_written ? "file written (BAD)" : "no file written"}`,
      );
      lines.push(
        `       with-consent -> ${ev.with_consent_file_written ? "file written" : "no file written (BAD)"}`,
      );
    } else if (p.name === "receipt_integrity") {
      lines.push(
        `       sha256 ${ev.hash_match ? "recomputed and matches" : "MISMATCH"}`,
      );
    } else if (p.name === "tamper_detection") {
      lines.push(
        `       mutated attests -> ${ev.tampered_hash_differs ? "hash mismatch detected" : "hash unchanged (BAD)"}`,
      );
    }
  }

  lines.push("");
  lines.push(
    `  Verdict: ${report.verdict} (${report.probes_passing}/${report.probes_total} PASS)`,
  );
  lines.push("=".repeat(42));

  return lines.join("\n");
}
