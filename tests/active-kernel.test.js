import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  formatBanner,
  gatherBannerInputs,
  probeGateway
} from "../packages/core/src/banner.js";
import { tokenize } from "../packages/core/src/shell.js";
import {
  TASK_REGISTRY,
  formatTaskReceipt,
  runDownloadsAuditPreview
} from "../packages/tasks/src/downloads-audit-preview.js";
import {
  formatVerdict,
  verifyGatewayHandoffReceipt,
  verifyReceipt,
  verifyReceiptPlaceholder
} from "../packages/verifier/src/sat-placeholder.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const HEALTHY_DOMAIN = "bizra-cognition-gateway-v1";

function startFakeGateway(routes) {
  const server = createServer((req, res) => {
    const handler = routes[req.url];
    if (!handler) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const result = handler(req);
    res.writeHead(result.status ?? 200, result.headers ?? { "content-type": "application/json" });
    res.end(typeof result.body === "string" ? result.body : JSON.stringify(result.body));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        async stop() {
          await new Promise((r) => server.close(r));
        }
      });
    });
  });
}

// ─── probeGateway ─────────────────────────────────────────────────────

test("probeGateway returns reachable when /health responds with correct domain", async () => {
  const gw = await startFakeGateway({
    "/health": () => ({ body: { status: "ok", domain: HEALTHY_DOMAIN } })
  });
  try {
    const result = await probeGateway(gw.url);
    assert.equal(result.reachable, true);
    assert.equal(result.domain, HEALTHY_DOMAIN);
    assert.equal(result.status, "ok");
  } finally {
    await gw.stop();
  }
});

test("probeGateway returns unreachable when domain mismatches", async () => {
  const gw = await startFakeGateway({
    "/health": () => ({ body: { status: "ok", domain: "some-other-server" } })
  });
  try {
    const result = await probeGateway(gw.url);
    assert.equal(result.reachable, false);
    assert.equal(result.domain, "some-other-server");
  } finally {
    await gw.stop();
  }
});

test("probeGateway returns unreachable on connection failure", async () => {
  const result = await probeGateway("http://127.0.0.1:1", { timeoutMs: 500 });
  assert.equal(result.reachable, false);
  assert.ok(result.error);
});

// ─── gatherBannerInputs + formatBanner ─────────────────────────────────

test("gatherBannerInputs returns null profile + null bizraContext when ~/.dema is empty", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-banner-empty-"));
  await mkdir(join(root, "memory"), { recursive: true });
  const inputs = await gatherBannerInputs({
    home: root,
    gatewayUrl: "http://127.0.0.1:1"
  });
  assert.equal(inputs.profile, null);
  assert.equal(inputs.bizraContext, null);
  assert.equal(inputs.receiptCount, 0);
  assert.equal(inputs.gateway.reachable, false);
});

test("gatherBannerInputs surfaces profile name + stage + receipt count", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-banner-full-"));
  await mkdir(join(root, "memory"), { recursive: true });
  await mkdir(join(root, "receipts"), { recursive: true });
  await writeFile(
    join(root, "profile.json"),
    JSON.stringify({ schema: "bizra.dema.profile.v0.1", preferred_name: "Mumu" })
  );
  await writeFile(
    join(root, "memory", "bizra-context.json"),
    JSON.stringify({ stage: { current: "SPROUT", next: "TREE" } })
  );
  await writeFile(
    join(root, "receipts", "artifact-011.json"),
    JSON.stringify({
      receipt_id: "r-1",
      artifact_id: "ARTIFACT-011",
      action: "bounded_diagnostic_activation",
      truth_label: "MEASURED",
      created_at: "2026-05-06T00:00:00Z"
    })
  );

  const inputs = await gatherBannerInputs({
    home: root,
    gatewayUrl: "http://127.0.0.1:1"
  });
  assert.equal(inputs.profile.preferred_name, "Mumu");
  assert.equal(inputs.bizraContext.stage.current, "SPROUT");
  assert.equal(inputs.receiptCount, 1);
  assert.ok(inputs.receiptHighlights.find((r) => r.artifact_id === "ARTIFACT-011"));
});

test("formatBanner suggests setup when profile is missing", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-banner-no-profile-"));
  await mkdir(join(root, "memory"), { recursive: true });
  const inputs = await gatherBannerInputs({ home: root, gatewayUrl: "http://127.0.0.1:1" });
  const banner = formatBanner(inputs);
  assert.match(banner, /Operator:\s+operator/);
  assert.match(banner, /\$ dema setup/);
  assert.match(banner, /First run/i);
});

test("formatBanner suggests downloads.audit.preview when fully ready", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-banner-ready-"));
  await mkdir(join(root, "memory"), { recursive: true });
  await mkdir(join(root, "receipts"), { recursive: true });
  await writeFile(
    join(root, "profile.json"),
    JSON.stringify({ preferred_name: "Mumu" })
  );
  await writeFile(
    join(root, "memory", "bizra-context.json"),
    JSON.stringify({ stage: { current: "SPROUT", next: "TREE" } })
  );
  await writeFile(
    join(root, "receipts", "artifact-011.json"),
    JSON.stringify({ receipt_id: "r-1", artifact_id: "ARTIFACT-011" })
  );

  const gw = await startFakeGateway({
    "/health": () => ({ body: { status: "ok", domain: HEALTHY_DOMAIN } })
  });
  try {
    const inputs = await gatherBannerInputs({ home: root, gatewayUrl: gw.url });
    const banner = formatBanner(inputs);
    assert.match(banner, /Operator:\s+Mumu/);
    assert.match(banner, /Stage:\s+SPROUT/);
    assert.match(banner, /Gateway:\s+connected/);
    assert.match(banner, /\$ dema task downloads\.audit\.preview/);
  } finally {
    await gw.stop();
  }
});

// ─── shell tokenize ────────────────────────────────────────────────────

test("shell tokenize handles plain words, quotes, and escapes", () => {
  assert.deepEqual(tokenize("status"), ["status"]);
  assert.deepEqual(tokenize("memory show profile"), ["memory", "show", "profile"]);
  assert.deepEqual(tokenize('mission propose --consent "GO: phrase"'), [
    "mission",
    "propose",
    "--consent",
    "GO: phrase"
  ]);
  assert.deepEqual(tokenize("a\\ b c"), ["a b", "c"]);
});

test("shell tokenize throws on unclosed quote", () => {
  assert.throws(() => tokenize('say "hello'), /Unclosed quote/);
});

// ─── downloads.audit.preview task ──────────────────────────────────────

async function makeFixtureDownloads() {
  const downloadsRoot = await mkdtemp(join(tmpdir(), "dema-fixture-downloads-"));
  const demaRoot = await mkdtemp(join(tmpdir(), "dema-fixture-home-"));
  await writeFile(join(downloadsRoot, "alpha.txt"), "hello\n");
  await writeFile(join(downloadsRoot, "bravo.pdf"), "fake-pdf\n");
  await writeFile(join(downloadsRoot, "charlie.pdf"), "another-fake\n");
  await mkdir(join(downloadsRoot, "subdir"), { recursive: true });
  return { downloadsRoot, demaRoot };
}

test("runDownloadsAuditPreview produces a schema-tagged read-only receipt with payload digest", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const before = await readdir(downloadsRoot);
  before.sort();

  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });

  assert.equal(receipt.schema, "bizra.dema.task_receipt.v0.1");
  assert.equal(receipt.task_id, "downloads.audit.preview");
  assert.equal(receipt.scope, "read-only");
  assert.equal(receipt.rollback_required, false);
  assert.equal(receipt.truth_label, "MEASURED");
  assert.equal(receipt.sat_verdict, "PARTIAL_PLACEHOLDER");
  assert.match(receipt.payload_digest, /^[0-9a-f]{64}$/);
  assert.equal(receipt.target, downloadsRoot);
  assert.equal(receipt.result.file_count, 3);
  assert.equal(receipt.result.dir_count, 1);
  assert.equal(receipt.result.by_extension[".pdf"], 2);
  assert.equal(receipt.result.by_extension[".txt"], 1);

  // CRITICAL: source dir must be byte-for-byte unchanged.
  const after = await readdir(downloadsRoot);
  after.sort();
  assert.deepEqual(after, before, "downloads dir must not be mutated by a read-only preview");
});

test("runDownloadsAuditPreview writes the receipt under ~/.dema/receipts/", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  assert.ok(receipt.written_to);
  const written = JSON.parse(await readFile(receipt.written_to, "utf8"));
  assert.equal(written.receipt_id, receipt.receipt_id);
  assert.equal(written.payload_digest, receipt.payload_digest);
});

test("runDownloadsAuditPreview reports error gracefully when target missing", async () => {
  const { demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({
    downloadsRoot: "/nonexistent-dema-test-target-xyz",
    demaRoot
  });
  assert.match(receipt.error, /not_found/);
  assert.equal(receipt.scope, "read-only");
});

test("formatTaskReceipt renders the key fields without throwing", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const text = formatTaskReceipt(receipt);
  assert.match(text, /Task:\s+downloads\.audit\.preview/);
  assert.match(text, /Scope:\s+read-only/);
  assert.match(text, /SAT verdict:\s+PARTIAL_PLACEHOLDER/);
});

test("TASK_REGISTRY exposes downloads.audit.preview with autonomy_level", () => {
  const t = TASK_REGISTRY["downloads.audit.preview"];
  assert.ok(t);
  assert.equal(t.id, "downloads.audit.preview");
  assert.match(t.autonomy_level, /L0\/L1/);
});

// ─── SAT placeholder verifier ──────────────────────────────────────────

test("verifyReceiptPlaceholder returns PARTIAL_PLACEHOLDER on a valid task receipt", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const verdict = verifyReceiptPlaceholder(receipt);
  assert.equal(verdict.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(verdict.truth_label, "DECLARED");
  assert.ok(verdict.checks.every((c) => c.pass), `all shallow checks should pass; got ${JSON.stringify(verdict.checks)}`);
});

test("verifyReceiptPlaceholder REJECTs a tampered receipt that claims a stronger verdict", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const tampered = { ...receipt, sat_verdict: "PERMIT" };
  const verdict = verifyReceiptPlaceholder(tampered);
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "verdict_honestly_declared_as_placeholder" && !c.pass));
});

test("verifyReceiptPlaceholder REJECTs receipt missing payload_digest", () => {
  const verdict = verifyReceiptPlaceholder({
    scope: "read-only",
    rollback_required: false,
    sat_verdict: "PARTIAL_PLACEHOLDER"
  });
  assert.equal(verdict.verdict, "REJECT");
});

test("formatVerdict renders all checks with pass/fail marks", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const receipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const verdict = verifyReceiptPlaceholder(receipt);
  const text = formatVerdict(verdict);
  assert.match(text, /SAT verdict:\s+PARTIAL_PLACEHOLDER/);
  assert.match(text, /✓ scope_declared_read_only/);
});

// ─── v0.3.2 verifier sibling — verifyReceipt router + gateway-handoff ──
// Per docs/02-architecture/sat-verifier-sibling-spec.md.

function makeGatewayHandoffReceipt(overrides = {}) {
  // Shape mirrors SPROUT_PIN.md §3 capture (the real ARTIFACT-011 mirror).
  return {
    schema: "bizra.dema.gateway_receipt_handoff.v0.1",
    receipt_id: "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
    artifact_id: "ARTIFACT-011",
    action: "bounded_diagnostic_activation",
    truth_label: "GATEWAY_ISSUED_HANDOFF",
    created_at: "2026-05-06T12:00:00.000Z",
    handoff_note: "Gateway sealed first mission; Dema-local mirror for listReceipts/readReceipt.",
    gateway: {
      base_url: "http://127.0.0.1:7421",
      mission_id: "04273dc2427284446a5aa7ec6727d33c085bbe6396659602dad9ba05ffb9fe86",
      receipt_id: "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
      chain_head: "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483",
      chain_length: 8,
      admissibility_verdict: "Permit",
      final_stage: "Replayability"
    },
    proof_anchors: {
      evidence_hash_niyyah_sha256: "659d822ba4cbaa61dac2d61008da0ed06f5c824a6208dc02f9b2b7fb2d5f8b27",
      preview_json_sha256: "d7cc50207ea88004eafbc54e01225de46fcf8d4701114b78b3c36bbcfaaf9f0d",
      ideal_state_hash_sha256: "24938181d3b2d4e85ca9abb924557857552e6493a6343b87a1e989abc10a6efe"
    },
    preserved_post_response_body: {
      missionId: "04273dc2427284446a5aa7ec6727d33c085bbe6396659602dad9ba05ffb9fe86",
      admissibility: {
        verdict: "Permit",
        gateVerdicts: [
          { scorerId: "ZANN_ZERO", invariant: "ZANN_ZERO", verdict: "Permit", reason: "Claim carries evidence binding", score: 1 },
          { scorerId: "CLAIM_MUST_BIND", invariant: "CLAIM_MUST_BIND", verdict: "Permit", reason: "Claim bound to evidence artifact", score: 1 },
          { scorerId: "RIBA_ZERO", invariant: "RIBA_ZERO", verdict: "Permit", reason: "No economic pattern present", score: 1 },
          { scorerId: "NO_SHADOW_STATE", invariant: "NO_SHADOW_STATE", verdict: "Permit", reason: "State mutation derives from canonical runtime", score: 1 },
          { scorerId: "IHSAN_FLOOR", invariant: "IHSAN_FLOOR", verdict: "Permit", reason: "Ihsan score 0.9800 ≥ floor 0.9500", score: 0.98 }
        ]
      },
      receiptId: "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
      finalStage: "Replayability",
      chainHead: "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483"
    },
    consent_phrase_record: "GO: Node0 bounded diagnostic activation only",
    ...overrides
  };
}

test("verifyReceipt routes task-receipt schema to verifyReceiptPlaceholder", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const taskReceipt = await runDownloadsAuditPreview({ downloadsRoot, demaRoot });
  const a = verifyReceipt(taskReceipt);
  const b = verifyReceiptPlaceholder(taskReceipt);
  // Same logic — route through verifyReceipt produces the same verdict on
  // task receipts. (Timestamps may differ; compare verdict + checks.)
  assert.equal(a.verdict, b.verdict);
  assert.equal(a.verdict, "PARTIAL_PLACEHOLDER");
  assert.deepEqual(
    a.checks.map((c) => ({ check: c.check, pass: c.pass })),
    b.checks.map((c) => ({ check: c.check, pass: c.pass }))
  );
});

test("verifyReceipt routes gateway-handoff schema to verifyGatewayHandoffReceipt", () => {
  const receipt = makeGatewayHandoffReceipt();
  const a = verifyReceipt(receipt);
  const b = verifyGatewayHandoffReceipt(receipt);
  assert.equal(a.verdict, b.verdict);
  assert.equal(a.verdict, "PARTIAL_PLACEHOLDER");
});

test("verifyReceipt REJECTs unsupported schema (fail-closed)", () => {
  const verdict = verifyReceipt({
    schema: "bizra.dema.unknown.v0.1",
    receipt_id: "x"
  });
  assert.equal(verdict.verdict, "REJECT");
  assert.equal(verdict.truth_label, "DECLARED");
  assert.match(verdict.checks[0].detail, /unsupported_schema/);
});

test("verifyReceipt REJECTs missing schema (fail-closed)", () => {
  const verdict = verifyReceipt({ receipt_id: "x" });
  assert.equal(verdict.verdict, "REJECT");
  assert.match(verdict.note, /Refused by default/);
});

test("verifyGatewayHandoffReceipt PARTIAL_PLACEHOLDER on a valid handoff receipt", () => {
  const verdict = verifyGatewayHandoffReceipt(makeGatewayHandoffReceipt());
  assert.equal(verdict.verdict, "PARTIAL_PLACEHOLDER");
  assert.equal(verdict.truth_label, "DECLARED");
  assert.ok(verdict.checks.every((c) => c.pass), `all checks should pass; got ${JSON.stringify(verdict.checks)}`);
});

test("verifyGatewayHandoffReceipt REJECTs when gateway.admissibility_verdict is not Permit", () => {
  const verdict = verifyGatewayHandoffReceipt(
    makeGatewayHandoffReceipt({
      gateway: {
        ...makeGatewayHandoffReceipt().gateway,
        admissibility_verdict: "Reject"
      }
    })
  );
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "gateway_admissibility_permit" && !c.pass));
});

test("verifyGatewayHandoffReceipt REJECTs when chain_head is missing or malformed", () => {
  const verdict = verifyGatewayHandoffReceipt(
    makeGatewayHandoffReceipt({
      gateway: {
        ...makeGatewayHandoffReceipt().gateway,
        chain_head: "not-a-hash"
      }
    })
  );
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "chain_head_present_64hex" && !c.pass));
});

test("verifyGatewayHandoffReceipt REJECTs when consent_phrase_record is missing", () => {
  const r = makeGatewayHandoffReceipt();
  delete r.consent_phrase_record;
  const verdict = verifyGatewayHandoffReceipt(r);
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "consent_phrase_recorded_and_canonical" && !c.pass));
});

test("verifyGatewayHandoffReceipt REJECTs wrong consent phrase for a known action (action-aware)", () => {
  // Per CodeRabbit + Copilot review on PR #18: receipts with
  // action=bounded_diagnostic_activation must carry exactly the
  // BOUNDED_DIAGNOSTIC_CONSENT_PHRASE per A4.5 anti-pattern #4
  // (shadow consent surfaces — only the typed exact phrase is valid).
  const verdict = verifyGatewayHandoffReceipt(
    makeGatewayHandoffReceipt({
      action: "bounded_diagnostic_activation",
      consent_phrase_record: "GO: anything else"
    })
  );
  assert.equal(verdict.verdict, "REJECT");
  const consentCheck = verdict.checks.find((c) => c.check === "consent_phrase_recorded_and_canonical");
  assert.ok(consentCheck);
  assert.equal(consentCheck.pass, false);
  assert.match(consentCheck.detail, /does NOT match canonical phrase/);
});

test("verifyGatewayHandoffReceipt PASSes consent check when action has no canonical phrase registered", () => {
  // Future actions (not yet defined) fall back to "non-empty string" with an
  // informational detail — do not block the verdict on an unknown action.
  const verdict = verifyGatewayHandoffReceipt(
    makeGatewayHandoffReceipt({
      action: "future_action_not_yet_defined",
      consent_phrase_record: "GO: future phrase tbd"
    })
  );
  // Other checks may or may not pass depending on the rest of the receipt;
  // assert specifically that the consent check passes (not blocking).
  const consentCheck = verdict.checks.find((c) => c.check === "consent_phrase_recorded_and_canonical");
  assert.equal(consentCheck.pass, true);
  assert.match(consentCheck.detail, /no canonical phrase registered yet/);
});

test("verifyGatewayHandoffReceipt PASSes when gateVerdicts is entirely missing (informational, not blocking)", () => {
  // Per CodeRabbit + Copilot + Codex 3-way convergence on PR #18: absent
  // gateVerdicts is a SOFT finding, not a hard REJECT. The gateway's
  // top-level admissibility_verdict is the load-bearing field; the
  // scorer breakdown is nice-to-have. Live cross-check (PLANNED with
  // real SAT-5 upstream) would resolve the breakdown.
  const r = makeGatewayHandoffReceipt();
  delete r.preserved_post_response_body;
  const verdict = verifyGatewayHandoffReceipt(r);
  assert.equal(verdict.verdict, "PARTIAL_PLACEHOLDER");
  const gatesCheck = verdict.checks.find((c) => c.check === "gate_verdicts_exposed");
  assert.ok(gatesCheck);
  assert.equal(gatesCheck.pass, true);
  assert.match(gatesCheck.detail, /informational/);
});

test("verifyGatewayHandoffReceipt REJECTs when IHSAN_FLOOR score is below 0.95", () => {
  const r = makeGatewayHandoffReceipt();
  r.preserved_post_response_body.admissibility.gateVerdicts = r.preserved_post_response_body.admissibility.gateVerdicts.map(
    (v) => (v.scorerId === "IHSAN_FLOOR" ? { ...v, score: 0.94 } : v)
  );
  const verdict = verifyGatewayHandoffReceipt(r);
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "gate_verdicts_all_permit_with_required_scorers" && !c.pass));
});

test("verifyGatewayHandoffReceipt REJECTs when a required scorer is missing", () => {
  const r = makeGatewayHandoffReceipt();
  r.preserved_post_response_body.admissibility.gateVerdicts =
    r.preserved_post_response_body.admissibility.gateVerdicts.filter(
      (v) => v.scorerId !== "ZANN_ZERO"
    );
  const verdict = verifyGatewayHandoffReceipt(r);
  assert.equal(verdict.verdict, "REJECT");
  assert.ok(verdict.checks.find((c) => c.check === "gate_verdicts_all_permit_with_required_scorers" && !c.pass));
});

test("verifyGatewayHandoffReceipt never returns PERMIT (caps at PARTIAL_PLACEHOLDER per spec)", () => {
  // Even the best-case path returns PARTIAL_PLACEHOLDER. Real PERMIT only
  // arrives when the SAT-5 Rust roster lands upstream and the verifier is
  // upgraded to cross-check the live gateway.
  const verdict = verifyGatewayHandoffReceipt(makeGatewayHandoffReceipt());
  assert.notEqual(verdict.verdict, "PERMIT");
  assert.equal(verdict.verdict, "PARTIAL_PLACEHOLDER");
});

// ─── v0.3.2 CLI wiring regression ──────────────────────────────────────
// Per docs/02-architecture/sat-verifier-sibling-spec.md acceptance
// criterion #5: the production CLI path MUST route receipt verification
// through verifyReceipt (the schema dispatcher), NOT through
// verifyReceiptPlaceholder directly. The placeholder may remain
// importable by tests for unit-level coverage, but the production
// dispatch surface must use the dispatcher so:
//   - unknown schemas fail closed
//   - gateway-handoff receipts route to verifyGatewayHandoffReceipt
//   - the SAT-5 PERMIT discipline is uniformly enforced

test("regression: apps/cli/src/index.js routes verification through verifyReceipt dispatcher", async () => {
  const cliSrcPath = new URL("../apps/cli/src/index.js", import.meta.url);
  const cliSrc = await readFile(cliSrcPath, "utf8");

  // The CLI must import verifyReceipt (the dispatcher).
  assert.match(
    cliSrc,
    /import\s*\{[^}]*\bverifyReceipt\b(?!Placeholder)[^}]*\}\s*from\s*["']\.\.\/\.\.\/\.\.\/packages\/verifier\/src\/sat-placeholder\.js["']/s,
    "apps/cli/src/index.js must import verifyReceipt from packages/verifier/src/sat-placeholder.js"
  );

  // The CLI must NOT import verifyReceiptPlaceholder directly. The
  // placeholder is for unit-test coverage only; production dispatch
  // is via verifyReceipt.
  assert.doesNotMatch(
    cliSrc,
    /import\s*\{[^}]*\bverifyReceiptPlaceholder\b[^}]*\}\s*from\s*["']\.\.\/\.\.\/\.\.\/packages\/verifier\/src\/sat-placeholder\.js["']/s,
    "apps/cli/src/index.js must NOT import verifyReceiptPlaceholder directly — route through verifyReceipt dispatcher per v0.3.2 spec criterion #5"
  );

  // Belt-and-braces: confirm the call site uses verifyReceipt(receipt)
  // and does not retain the legacy verifyReceiptPlaceholder(receipt) call.
  assert.match(cliSrc, /\bverifyReceipt\s*\(\s*receipt\s*\)/);
  assert.doesNotMatch(cliSrc, /\bverifyReceiptPlaceholder\s*\(\s*receipt\s*\)/);
});

// ─── CLI integration ───────────────────────────────────────────────────

test("dema task (no arg) lists registered tasks as schema-tagged JSON", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "task"]);
  const output = JSON.parse(stdout);
  assert.equal(output.schema, "bizra.dema.task_list.v0.1");
  assert.ok(output.tasks.find((t) => t.id === "downloads.audit.preview"));
});

test("dema task downloads.audit.preview runs end-to-end with DEMA_DOWNLOADS_ROOT override", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const { stdout } = await execFileAsync("node", [cliPath, "task", "downloads.audit.preview"], {
    env: {
      ...process.env,
      DEMA_DOWNLOADS_ROOT: downloadsRoot,
      DEMA_HOME: demaRoot
    }
  });
  assert.match(stdout, /Task:\s+downloads\.audit\.preview/);
  assert.match(stdout, /SAT verdict:\s+PARTIAL_PLACEHOLDER/);
  assert.match(stdout, /✓ scope_declared_read_only/);
  // Receipt must be on disk.
  const receiptsDir = join(demaRoot, "receipts");
  const files = await readdir(receiptsDir);
  assert.ok(files.find((f) => f.includes("downloads.audit.preview")));
});

test("dema bare invocation (no args) prints the active-kernel banner", async () => {
  const { downloadsRoot, demaRoot } = await makeFixtureDownloads();
  const { stdout } = await execFileAsync("node", [cliPath], {
    env: {
      ...process.env,
      DEMA_HOME: demaRoot,
      // Force gateway probe to fail fast — fixture demaRoot has no profile.
      DEMA_NODE0_ADAPTER: ""
    }
  });
  assert.match(stdout, /Dema — Sovereign AI Node Companion/);
  assert.match(stdout, /Operator:\s+operator/);
  assert.match(stdout, /Next safe task/);
  assert.match(stdout, /Boundary: no action without explicit consent/);
});

test("dema help still works after the active-kernel refactor", async () => {
  const { stdout } = await execFileAsync("node", [cliPath, "help"]);
  assert.match(stdout, /Dema CLI/);
  assert.match(stdout, /dema task/);
  assert.match(stdout, /v0\.3\.0/);
});

test("bin/dema script exists and is executable", async () => {
  const binPath = fileURLToPath(new URL("../bin/dema", import.meta.url));
  const s = await stat(binPath);
  assert.ok(s.isFile(), "bin/dema should be a regular file");
  // Owner execute bit (0o100 in mode):
  assert.ok((s.mode & 0o100) !== 0, "bin/dema should be executable by owner");
});
