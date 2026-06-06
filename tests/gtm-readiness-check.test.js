import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildGtmReadinessReport,
  formatGtmReadinessReport,
  resolveLighthousePackDir,
  verifyManifestLines,
} from "../scripts/gtm-readiness-check.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/gtm-readiness-check.mjs", import.meta.url),
);

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function createPack(files) {
  const dir = await mkdtemp(join(tmpdir(), "dema-gtm-pack-"));
  await mkdir(dir, { recursive: true });
  const lines = [];
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, name), body, "utf8");
    lines.push(`${sha256(body)}  ${name}`);
  }
  await writeFile(
    join(dir, "MANIFEST.sha256"),
    `${lines.join("\n")}\n`,
    "utf8",
  );
  return dir;
}

test("buildGtmReadinessReport passes when pointed at in-repo launch pack", async () => {
  const inRepoPack = join(REPO_ROOT, "docs/launch-pack-v0.1");
  const report = await buildGtmReadinessReport({
    root: REPO_ROOT,
    lighthousePackDir: inRepoPack,
  });
  assert.equal(report.ok, true);
  assert.equal(report.lighthouse_pack.dir, inRepoPack);
});

test("resolveLighthousePackDir finds vendored manifest without external Documents path", () => {
  const resolved = resolveLighthousePackDir({ root: REPO_ROOT });
  assert.ok(existsSync(join(resolved, "MANIFEST.sha256")));
});

test("buildGtmReadinessReport verifies current GTM docs and Lighthouse pack boundaries", async () => {
  const packDir = await createPack({
    "00_START_HERE.md": "start\n",
    "08_INVITATION_DRAFT.md": "private invitation\n",
  });
  try {
    const report = await buildGtmReadinessReport({
      lighthousePackDir: packDir,
    });

    assert.equal(report.schema, "bizra.dema.gtm_readiness_check.v0.1");
    assert.equal(report.mode, "READ_ONLY_AUDIT");
    assert.equal(report.ok, true);
    assert.equal(report.boundary.runtime_execution, false);
    assert.equal(report.boundary.receipt_minted, false);
    assert.equal(report.boundary.send_performed, false);
    assert.equal(report.lighthouse_pack.ok, true);
    assert.equal(report.findings.length, 0);
    assert.equal(report.open_operator_gates.length, 8);
    assert.ok(
      report.open_operator_gates.every((gate) =>
        gate.status.startsWith("open_"),
      ),
    );
    assert.ok(
      report.checks.some(
        (check) => check.name === "phase1_packet_required_phrases" && check.ok,
      ),
    );
    assert.ok(
      report.checks.some(
        (check) => check.name === "gtm_current_state_markers" && check.ok,
      ),
    );
    assert.ok(
      report.checks.some(
        (check) => check.name === "open_operator_gates_declared" && check.ok,
      ),
    );
    assert.ok(
      report.checks.some(
        (check) => check.name === "phase_milestone_gates_declared" && check.ok,
      ),
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test("buildGtmReadinessReport exposes exact open operator gates without failing readiness", async () => {
  const packDir = await createPack({ "00_START_HERE.md": "start\n" });
  try {
    const report = await buildGtmReadinessReport({
      lighthousePackDir: packDir,
    });
    const gatesById = new Map(
      report.open_operator_gates.map((gate) => [gate.id, gate]),
    );

    assert.equal(report.ok, true);
    assert.equal(
      gatesById.get("send_lighthouse_pack_ring1").phrase,
      "GO send pack to <name>",
    );
    assert.equal(
      gatesById.get("author_poi_v0_1_test_plan").phrase,
      "GO author POI v0.1 test plan (no impl)",
    );
    assert.equal(
      gatesById.get("sync_adr_013_status").phrase,
      "GO sync ADR-013 status to Accepted",
    );
    assert.deepEqual(gatesById.get("resolve_sat5_schema_canon_drift").phrases, [
      "GO resolve SAT-5 canon drift by founding-doc verification",
      "GO accept SAT-5 parallel vocabularies",
    ]);
    assert.equal(gatesById.get("urp_local_pool_init_n1").phase, 2);
    assert.equal(gatesById.get("send_ring3_cohort").phase, 3);
    assert.ok(
      report.open_operator_gates.every(
        (gate) => gate.boundary_effect_performed === false,
      ),
    );
    assert.deepEqual(
      report.phase_status.map((phase) => phase.id),
      ["phase_1", "phase_2", "phase_3"],
    );
    assert.equal(
      report.phase_status[0].status,
      "open_operator_and_external_evidence_required",
    );
    assert.deepEqual(report.phase_status[0].open_gate_ids, [
      "send_lighthouse_pack_ring1",
      "author_poi_v0_1_test_plan",
      "sync_adr_013_status",
      "resolve_sat5_schema_canon_drift",
    ]);
    assert.deepEqual(report.phase_status[0].external_evidence_required, [
      "~/.dema/lighthouse/ring-1/send-receipts/",
      "~/.dema/lighthouse/ring-1/feedback/",
      "phase-1-close receipt after authorized Ring-1 feedback parsing",
    ]);
    assert.deepEqual(report.phase_status[0].milestone_gate_phrases, [
      "GO author amendment ADR from <finding>",
      "GO mint phase-1-close",
      "GO phase-2 kick-off authorized",
    ]);
    assert.equal(report.phase_status[1].status, "blocked_until_phase_1_closes");
    assert.deepEqual(report.phase_status[1].milestone_gate_phrases, [
      "GO receipt POI envelope #1 to chain",
      "GO refresh lighthouse pack to v1.1",
      "GO send v1.1 pack to <names>",
      "GO mint phase-2-close",
    ]);
    assert.equal(report.phase_status[2].status, "blocked_until_phase_2_closes");
    assert.deepEqual(report.phase_status[2].milestone_gate_phrases, [
      "GO impl <amendment N>",
      "GO impl URP PAT-SAT allocation preview",
      "GO ots anchor current main",
      "GO mint 90-day close",
    ]);
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test("buildGtmReadinessReport scans missing Phase 1 evidence without failing readiness", async () => {
  const packDir = await createPack({ "00_START_HERE.md": "start\n" });
  const demaHome = await mkdtemp(join(tmpdir(), "dema-gtm-home-"));
  try {
    const report = await buildGtmReadinessReport({
      lighthousePackDir: packDir,
      demaHome,
    });

    assert.equal(report.ok, true);
    assert.equal(
      report.phase1_evidence.status,
      "waiting_for_operator_send_and_reviewer_feedback",
    );
    assert.equal(report.phase1_evidence.required_counts.send_receipts, 1);
    assert.equal(report.phase1_evidence.required_counts.feedback_documents, 1);
    assert.equal(report.phase1_evidence.counts.send_receipts, 0);
    assert.equal(report.phase1_evidence.counts.feedback_documents, 0);
    assert.deepEqual(report.phase1_evidence.send_receipts, []);
    assert.deepEqual(report.phase1_evidence.feedback_documents, []);
    assert.equal(report.phase1_evidence.boundary.read_only_audit, true);
    assert.equal(report.phase1_evidence.boundary.feedback_content_read, false);
    assert.equal(
      report.phase1_evidence.boundary.reviewer_identity_published,
      false,
    );
    assert.match(
      report.phase1_evidence.next_safe_action,
      /GO send pack to <name>/,
    );
    assert.ok(
      report.checks.some(
        (check) => check.name === "phase1_evidence_scanned" && check.ok,
      ),
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(demaHome, { recursive: true, force: true });
  }
});

test("buildGtmReadinessReport counts Phase 1 evidence metadata without reading private content", async () => {
  const packDir = await createPack({ "00_START_HERE.md": "start\n" });
  const demaHome = await mkdtemp(join(tmpdir(), "dema-gtm-home-"));
  try {
    const sendDir = join(demaHome, "lighthouse", "ring-1", "send-receipts");
    const feedbackDir = join(demaHome, "lighthouse", "ring-1", "feedback");
    await mkdir(sendDir, { recursive: true });
    await mkdir(feedbackDir, { recursive: true });
    await writeFile(
      join(sendDir, "2026-05-22-ring1-001.md"),
      "schema: bizra.dema.gtm.lighthouse_send_receipt.v0.1\nprivate_reviewer_name: do-not-leak\n",
      "utf8",
    );
    await writeFile(
      join(feedbackDir, "ring1-001-2026-Q2.md"),
      "# Feedback\nprivate finding and reviewer identity must not be surfaced\n",
      "utf8",
    );

    const report = await buildGtmReadinessReport({
      lighthousePackDir: packDir,
      demaHome,
    });

    assert.equal(report.ok, true);
    assert.equal(
      report.phase1_evidence.status,
      "evidence_present_ready_for_operator_review",
    );
    assert.equal(report.phase1_evidence.counts.send_receipts, 1);
    assert.equal(report.phase1_evidence.counts.feedback_documents, 1);
    assert.deepEqual(
      report.phase1_evidence.send_receipts.map((entry) => entry.name),
      ["2026-05-22-ring1-001.md"],
    );
    assert.deepEqual(
      report.phase1_evidence.feedback_documents.map((entry) => entry.name),
      ["ring1-001-2026-Q2.md"],
    );
    assert.equal("content" in report.phase1_evidence.send_receipts[0], false);
    assert.equal(
      "content" in report.phase1_evidence.feedback_documents[0],
      false,
    );
    assert.match(
      report.phase1_evidence.next_safe_action,
      /GO author amendment ADR from <finding>/,
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(demaHome, { recursive: true, force: true });
  }
});

test("buildGtmReadinessReport exposes Phase 1 success criteria ledger", async () => {
  const packDir = await createPack({ "00_START_HERE.md": "start\n" });
  const demaHome = await mkdtemp(join(tmpdir(), "dema-gtm-home-"));
  try {
    const report = await buildGtmReadinessReport({
      lighthousePackDir: packDir,
      demaHome,
    });
    const criteriaById = new Map(
      report.phase1_success_criteria.criteria.map((criterion) => [
        criterion.id,
        criterion,
      ]),
    );

    assert.equal(
      report.phase1_success_criteria.schema,
      "bizra.dema.gtm.phase1_success_criteria.v0.1",
    );
    assert.equal(report.phase1_success_criteria.status, "phase1_open");
    assert.equal(report.phase1_success_criteria.summary.total, 7);
    assert.equal(report.phase1_success_criteria.summary.satisfied, 2);
    assert.equal(report.phase1_success_criteria.summary.open, 5);
    assert.equal(criteriaById.get("adr_009_accepted").status, "satisfied");
    assert.equal(criteriaById.get("adr_014_accepted").status, "satisfied");
    assert.equal(
      criteriaById.get("ring1_feedback_on_record").status,
      "open_external_evidence_required",
    );
    assert.equal(
      criteriaById.get("poi_gate_1_ring1_feedback_closed").status,
      "blocked_until_send_receipt_and_feedback_exist",
    );
    assert.equal(
      criteriaById.get("poi_gate_4_test_plan_closed").exact_phrase,
      "GO author POI v0.1 test plan (no impl)",
    );
    assert.equal(
      criteriaById.get("phase1_close_receipt_recorded").exact_phrase,
      "GO mint phase-1-close",
    );
    assert.equal(
      criteriaById.get("reviewer_surprising_finding_memory")
        .boundary_effect_performed,
      false,
    );
    assert.ok(
      report.checks.some(
        (check) => check.name === "phase1_success_criteria_tracked" && check.ok,
      ),
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(demaHome, { recursive: true, force: true });
  }
});

test("buildGtmReadinessReport updates Phase 1 success criteria from evidence metadata", async () => {
  const packDir = await createPack({ "00_START_HERE.md": "start\n" });
  const demaHome = await mkdtemp(join(tmpdir(), "dema-gtm-home-"));
  try {
    const sendDir = join(demaHome, "lighthouse", "ring-1", "send-receipts");
    const feedbackDir = join(demaHome, "lighthouse", "ring-1", "feedback");
    await mkdir(sendDir, { recursive: true });
    await mkdir(feedbackDir, { recursive: true });
    await writeFile(
      join(sendDir, "2026-05-22-ring1-001.md"),
      "send metadata only\n",
      "utf8",
    );
    await writeFile(
      join(feedbackDir, "ring1-001-2026-Q2.md"),
      "private feedback content\n",
      "utf8",
    );

    const report = await buildGtmReadinessReport({
      lighthousePackDir: packDir,
      demaHome,
    });
    const criteriaById = new Map(
      report.phase1_success_criteria.criteria.map((criterion) => [
        criterion.id,
        criterion,
      ]),
    );

    assert.equal(report.phase1_success_criteria.summary.satisfied, 3);
    assert.equal(report.phase1_success_criteria.summary.open, 4);
    assert.equal(
      criteriaById.get("ring1_feedback_on_record").status,
      "satisfied",
    );
    assert.equal(
      criteriaById.get("ring1_feedback_on_record").evidence[0],
      "1 private feedback document(s) counted metadata-only",
    );
    assert.equal(
      criteriaById.get("poi_gate_1_ring1_feedback_closed").status,
      "evidence_present_operator_review_required",
    );
    assert.equal(
      criteriaById.get("poi_gate_1_ring1_feedback_closed").satisfied,
      false,
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(demaHome, { recursive: true, force: true });
  }
});

test("verifyManifestLines catches tampered Lighthouse pack content", async () => {
  const packDir = await createPack({ "00_START_HERE.md": "start\n" });
  try {
    await writeFile(join(packDir, "00_START_HERE.md"), "tampered\n", "utf8");
    const result = await verifyManifestLines({
      dir: packDir,
      manifestText: `${sha256("start\n")}  00_START_HERE.md\n`,
    });

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.entries.map((entry) => entry.status),
      ["mismatch"],
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test("verifyManifestLines ignores sha256sum-compatible comment lines", async () => {
  const packDir = await createPack({ "00_START_HERE.md": "start\n" });
  try {
    const result = await verifyManifestLines({
      dir: packDir,
      manifestText: [
        "# Lighthouse Pack v1.0 · SHA-256 manifest",
        "# Generated by pack ceremony",
        `${sha256("start\n")}  00_START_HERE.md`,
      ].join("\n"),
    });

    assert.equal(result.ok, true);
    assert.equal(result.entry_count, 1);
    assert.deepEqual(
      result.entries.map((entry) => entry.status),
      ["ok"],
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
});

test("formatGtmReadinessReport renders concise human output", async () => {
  const packDir = await createPack({ "00_START_HERE.md": "start\n" });
  const demaHome = await mkdtemp(join(tmpdir(), "dema-gtm-home-"));
  try {
    const output = formatGtmReadinessReport(
      await buildGtmReadinessReport({ lighthousePackDir: packDir, demaHome }),
    );

    assert.match(output, /DEMA GTM Readiness Check/);
    assert.match(output, /Result: PASS/);
    assert.match(output, /Open Operator Gates:/);
    assert.match(output, /GO send pack to <name>/);
    assert.match(output, /GO sync ADR-013 status to Accepted/);
    assert.match(output, /Phase Status:/);
    assert.match(
      output,
      /phase_1: open_operator_and_external_evidence_required/,
    );
    assert.match(output, /phase_2: blocked_until_phase_1_closes/);
    assert.match(output, /milestone phrases: 3/);
    assert.match(output, /milestone phrases: 4/);
    assert.match(output, /Phase 1 Evidence:/);
    assert.match(output, /waiting_for_operator_send_and_reviewer_feedback/);
    assert.match(output, /send receipts: 0\/1/);
    assert.match(output, /feedback documents: 0\/1/);
    assert.match(output, /Phase 1 Success Criteria:/);
    assert.match(output, /satisfied: 2\/7/);
    assert.match(
      output,
      /ring1_feedback_on_record: open_external_evidence_required/,
    );
    assert.match(
      output,
      /Boundary: read-only audit; no send; no runtime; no receipt mint/,
    );
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(demaHome, { recursive: true, force: true });
  }
});

test("gtm-readiness-check script supports --json", async () => {
  const packDir = await createPack({ "00_START_HERE.md": "start\n" });
  const demaHome = await mkdtemp(join(tmpdir(), "dema-gtm-home-"));
  try {
    const { stdout } = await execFileAsync("node", [
      scriptPath,
      "--json",
      "--lighthouse-pack-dir",
      packDir,
      "--dema-home",
      demaHome,
    ]);
    const report = JSON.parse(stdout);

    assert.equal(report.schema, "bizra.dema.gtm_readiness_check.v0.1");
    assert.equal(report.ok, true);
    assert.equal(report.lighthouse_pack.ok, true);
    assert.equal(report.phase1_evidence.dema_home, demaHome);
    assert.equal(report.phase1_success_criteria.summary.total, 7);
  } finally {
    await rm(packDir, { recursive: true, force: true });
    await rm(demaHome, { recursive: true, force: true });
  }
});
