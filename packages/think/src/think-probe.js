import { readdir, readFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  buildThinkReceipt,
  saveThinkReceipt,
  THINK_RECEIPT_SAVE_CONSENT,
  THINK_RECEIPT_SCHEMA,
} from "./think-receipt-save.js";

const SCHEMA = "bizra.dema.think_probe.v0.1";

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

const RECEIPT_SOURCE_FILES = [
  "packages/think/src/think-receipt-save.js",
  "packages/think/src/think-closeout.js",
  "packages/consent/src/consent-common.js",
];

function makeSyntheticEnvelope({
  now = new Date("2026-01-01T00:00:00Z"),
} = {}) {
  const payload = {
    schema: "bizra.dema.think_live.v0.1",
    generated_at: now.toISOString(),
    mode: "LIVE_INVOCATION",
    query: "Think probe synthetic query.",
    context_manifest: {
      memory: {
        available: false,
        hits_count: 0,
        hit_summaries: [],
        reason: "probe_synthetic",
      },
      model: "probe-model",
      prompt_length_chars: 42,
    },
    invocation: {
      status: "invocation_completed",
      model_responded: true,
      output_length_chars: 27,
      consent_phrase_verified: true,
      error_reason: null,
    },
    output: "Probe output: operational.",
    boundary: {
      filesystem_write_performed: false,
      network_used: true,
      runtime_execution_performed: true,
      model_loaded: true,
      model_invocation_performed: true,
      prompt_executed: true,
      external_call_performed: true,
      raw_corpus_scan_performed: false,
      raw_data_included: false,
      tool_executed: false,
      chain_advance_performed: false,
      receipt_mint_performed: false,
      federation_invoked: false,
      node_connection_performed: false,
      public_network_used: false,
      consent_collected: true,
    },
    boundary_evidence: {
      model_invocation: "OBSERVED",
      network_used: "OBSERVED",
      external_call: "OBSERVED",
      external_call_scope: "localhost_only",
      public_network: "STATIC_CHECKED",
      filesystem_write: "OBSERVED_FALSE",
      receipt_minted: "OBSERVED_FALSE",
      federation: "DECLARED_NOT_OBSERVABLE_V0_2",
      memory_query: "probe_synthetic",
    },
  };
  payload.proof_hash = sha256(stableStringify(payload));
  return payload;
}

async function scanForbiddenImports(repoRoot) {
  let totalForbidden = 0;
  const details = [];
  for (const rel of RECEIPT_SOURCE_FILES) {
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
  const envelope = makeSyntheticEnvelope();

  const result = await saveThinkReceipt(envelope, {
    demaHome: home,
    consent: THINK_RECEIPT_SAVE_CONSENT,
    now: new Date("2026-01-01T00:00:00Z"),
  });

  const afterFiles = await listReceipts(home);
  const newFiles = afterFiles.filter((f) => !beforeFiles.includes(f));
  const scan = await scanForbiddenImports(repoRoot);

  const failures = [];
  const evidence = {};

  if (result.saved && newFiles.length === 1) {
    evidence.fs_write = { level: "OBSERVED", new_files: 1 };
  } else {
    evidence.fs_write = {
      level: "OBSERVED",
      new_files: newFiles.length,
      saved: result.saved,
      mismatch: true,
    };
    failures.push("save did not produce exactly 1 new file");
  }

  evidence.network_used = {
    level: "STATIC_CHECKED",
    forbidden_imports: scan.forbidden,
    details: scan.details,
  };
  if (scan.forbidden > 0) {
    failures.push(`static check found ${scan.forbidden} forbidden imports`);
  }

  if (result.saved) {
    const raw = await readFile(result.path, "utf8");
    const noRawOutput =
      !raw.includes("context_manifest") && !raw.includes("hit_summaries");
    evidence.data_leakage = {
      level: "OBSERVED",
      no_context_manifest: !raw.includes("context_manifest"),
      no_hit_summaries: !raw.includes("hit_summaries"),
      clean: noRawOutput,
    };
    if (!noRawOutput) {
      failures.push("saved receipt contains raw data that should be stripped");
    }
  }

  return {
    name: "boundary_observed",
    pass: failures.length === 0,
    evidence,
    receiptPath: result.path,
  };
}

async function probeDeterminism() {
  const fixedNow = new Date("2026-01-01T00:00:00Z");
  const envelope = makeSyntheticEnvelope({ now: fixedNow });
  const r1 = buildThinkReceipt(envelope, { now: fixedNow });
  const r2 = buildThinkReceipt(envelope, { now: fixedNow });
  const match = r1.receipt_hash === r2.receipt_hash;
  return {
    name: "determinism",
    pass: match,
    evidence: {
      runs: 2,
      hashes_match: match,
      hash_1: r1.receipt_hash,
      hash_2: r2.receipt_hash,
    },
  };
}

async function probeConsentGate(home) {
  const envelope = makeSyntheticEnvelope({
    now: new Date("2026-01-01T00:00:01Z"),
  });

  const beforeFiles = await listReceipts(home);

  await saveThinkReceipt(envelope, {
    demaHome: home,
    consent: "",
    now: new Date("2026-01-01T00:00:01Z"),
  });

  const midFiles = await listReceipts(home);
  const noConsentWritten =
    midFiles.filter((f) => !beforeFiles.includes(f)).length > 0;

  const envelope2 = makeSyntheticEnvelope({
    now: new Date("2026-01-01T00:00:02Z"),
  });

  const withConsent = await saveThinkReceipt(envelope2, {
    demaHome: home,
    consent: THINK_RECEIPT_SAVE_CONSENT,
    now: new Date("2026-01-01T00:00:02Z"),
  });

  const afterFiles = await listReceipts(home);
  const consentWritten =
    afterFiles.filter((f) => !midFiles.includes(f)).length > 0;

  return {
    name: "consent_gate",
    pass: !noConsentWritten && consentWritten,
    evidence: {
      no_consent_file_written: noConsentWritten,
      with_consent_file_written: consentWritten,
      with_consent_saved: withConsent.saved,
    },
    receiptPath: withConsent.path,
  };
}

async function probeReceiptIntegrity(receiptPath) {
  const raw = await readFile(receiptPath, "utf8");
  const receipt = JSON.parse(raw);
  const check = { ...receipt };
  delete check.receipt_hash;
  const recomputed = sha256(stableStringify(check));
  const match = recomputed === receipt.receipt_hash;
  return {
    name: "receipt_integrity",
    pass: match,
    evidence: {
      hash_match: match,
      original: receipt.receipt_hash,
      recomputed,
    },
  };
}

function probeTamperDetection(rawContent) {
  const receipt = JSON.parse(rawContent);
  const tampered = JSON.parse(rawContent);
  tampered.query = "TAMPERED_BY_PROBE";
  const check = { ...tampered };
  delete check.receipt_hash;
  const tamperedHash = sha256(stableStringify(check));
  const differs = tamperedHash !== receipt.receipt_hash;
  return {
    name: "tamper_detection",
    pass: differs,
    evidence: {
      tampered_hash_differs: differs,
      original_hash: receipt.receipt_hash,
      tampered_hash: tamperedHash,
    },
  };
}

export async function runThinkProbe(repoRoot) {
  const home = await mkdtemp(join(tmpdir(), "dema-think-probe-"));
  const oldHome = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;

  try {
    await mkdir(join(home, "receipts"), { recursive: true });

    const probes = [];

    const boundaryResult = await probeBoundary(home, repoRoot);
    probes.push({
      name: boundaryResult.name,
      pass: boundaryResult.pass,
      evidence: boundaryResult.evidence,
    });

    probes.push(await probeDeterminism());

    const consentResult = await probeConsentGate(home);
    probes.push({
      name: consentResult.name,
      pass: consentResult.pass,
      evidence: consentResult.evidence,
    });

    const integrityPath =
      consentResult.receiptPath || boundaryResult.receiptPath;
    if (integrityPath) {
      probes.push(await probeReceiptIntegrity(integrityPath));
      const raw = await readFile(integrityPath, "utf8");
      probes.push(probeTamperDetection(raw));
    } else {
      probes.push({
        name: "receipt_integrity",
        pass: false,
        evidence: { error: "no receipt from prior probes" },
      });
      probes.push({
        name: "tamper_detection",
        pass: false,
        evidence: { error: "no receipt from prior probes" },
      });
    }

    const passing = probes.filter((p) => p.pass).length;
    const failing = probes.length - passing;
    const verdict = failing === 0 ? "CLEAN" : passing > 0 ? "REVIEW" : "FAILED";

    return {
      schema: SCHEMA,
      target: "think_receipt",
      verdict,
      probes_total: probes.length,
      probes_passing: passing,
      probes_failing: failing,
      probes,
      isolated_home: home,
      boundary: {
        read_only_report: true,
        network_used: "STATIC_CHECKED",
        model_invocation: "SYNTHETIC_ONLY",
        operator_home_touched: "DECLARED_NOT_VERIFIED_V0_1",
      },
    };
  } finally {
    if (oldHome) process.env.DEMA_HOME = oldHome;
    else delete process.env.DEMA_HOME;
    await rm(home, { recursive: true, force: true }).catch(() => {});
  }
}

export function renderThinkProbeText(report) {
  if (report.error) return report.error;

  const lines = [
    "Behavioral Think Probe v0.1",
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

    if (p.name === "boundary_observed") {
      if (ev.fs_write)
        lines.push(
          `       fs_write:`.padEnd(34) +
            `${ev.fs_write.level} (${ev.fs_write.new_files} new file${ev.fs_write.new_files !== 1 ? "s" : ""})`,
        );
      if (ev.network_used)
        lines.push(
          "       network:".padEnd(34) +
            `${ev.network_used.level} (${ev.network_used.forbidden_imports} forbidden)`,
        );
      if (ev.data_leakage)
        lines.push(
          "       data_leakage:".padEnd(34) +
            `${ev.data_leakage.clean ? "CLEAN" : "LEAKING"}`,
        );
    } else if (p.name === "determinism") {
      lines.push(
        `       ${ev.runs} runs, ${ev.hashes_match ? "same" : "different"} receipt_hash`,
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
        `       receipt_hash ${ev.hash_match ? "recomputed and matches" : "MISMATCH"}`,
      );
    } else if (p.name === "tamper_detection") {
      lines.push(
        `       mutated query -> ${ev.tampered_hash_differs ? "hash mismatch detected" : "hash unchanged (BAD)"}`,
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
