import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  auditMarkdown,
  LABELS,
  RISK_PATTERNS,
} from "../scripts/claim-ledger-check.mjs";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(
  new URL("../scripts/claim-ledger-check.mjs", import.meta.url),
);

test("auditMarkdown passes truth-labeled measured and cited claims", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: [
      "# Paper",
      "[CITED] Prior work reports 99.94% F1 on a hadith-chain dataset.",
      "[MEASURED] Local test command completed in 12 ms on commit abc123.",
      "[PLANNED] Post-quantum receipts are future work.",
    ].join("\n"),
  });

  assert.equal(report.ok, true);
  assert.deepEqual(report.findings, []);
});

test("auditMarkdown flags risky unlabeled benchmark and first-ever claims", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: [
      "# Paper",
      "BIZRA Node0 achieves 523,793 requests/second with 0.089 milliseconds latency.",
      "This is the first formally verified Sovereign Digital Organism.",
    ].join("\n"),
  });

  assert.equal(report.ok, false);
  assert.equal(report.findings.length, 3);
  assert.deepEqual(
    report.findings.map((finding) => finding.kind),
    ["benchmark", "first_or_only", "formal_verification"],
  );
});

test("auditMarkdown flags unlabeled percentage benchmark claims", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: "The classifier reaches 99.94% F1-score on the benchmark.",
  });

  assert.equal(report.ok, false);
  assert.deepEqual(
    report.findings.map((finding) => finding.kind),
    ["benchmark"],
  );
});

test("benchmark flags metric percentages, hard units, and hyphenated fold", () => {
  const claims = [
    "BIZRA serves 523,793 requests/second.",
    "Latency is 0.089 milliseconds.",
    "The classifier reaches 99.94% F1.",
    "The probe took 12 ms.",
    "We measured a 10x improvement.",
    "We measured a 10-fold improvement.",
    "The model hits 95% accuracy.",
    "The service holds 99.9% uptime.",
  ];
  for (const body of claims) {
    const report = auditMarkdown({ file: "paper.md", body });
    assert.ok(
      report.findings.some((f) => f.kind === "benchmark"),
      `benchmark claim missed: ${body}`,
    );
  }
});

test("benchmark does not flag posture or constitutional percentages", () => {
  const benign = [
    "Dema is 100% local-first.",
    "Dema is 100% offline by default.",
    "Zakat is 2.5% of holdings.",
    "The project keeps a 50% community pool.",
    "The founder promised a 50% sadaqah pool.",
  ];
  for (const body of benign) {
    const report = auditMarkdown({ file: "spec.md", body });
    assert.deepEqual(
      report.findings.filter((f) => f.kind === "benchmark"),
      [],
      `posture percentage wrongly flagged: ${body}`,
    );
  }
});

test("auditMarkdown allows a label on the previous non-empty line", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: [
      "[DECLARED]",
      "We define the 7-3-6-9 discipline as a proposed verification framework.",
      "",
      "[PLANNED]",
      "ML-KEM and Dilithium receipts are future implementation work.",
    ].join("\n"),
  });

  assert.equal(report.ok, true);
});

test("auditMarkdown does not let a labeled claim label the next claim", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: [
      "[CITED] Prior work reports 99.94% F1.",
      "BIZRA mints IMP rewards from PAT self-certification.",
    ].join("\n"),
  });

  assert.equal(report.ok, false);
  assert.deepEqual(
    report.findings.map((finding) => finding.kind),
    ["economic"],
  );
});

test("economic flags real token/reward/mint economic claims", () => {
  const overclaims = [
    "BIZRA mints IMP rewards from PAT self-certification.",
    "The protocol is minting new tokens for contributors.",
    "The token economy rewards verified work.",
    "Rewards are minted on each verification.",
    "Economic value accrues to participants.",
    "Utility token issuance follows the schedule.",
  ];
  for (const body of overclaims) {
    const report = auditMarkdown({ file: "paper.md", body });
    assert.ok(
      report.findings.some((f) => f.kind === "economic"),
      `economic claim missed: ${body}`,
    );
  }
});

test("economic does not flag generic, ML, or incidental token/reward/mint vocab", () => {
  const benign = [
    "The wrapper passes an auth token to the gateway.",
    "The RL reward function converges after training.",
    "See the token discipline playbook for budget rules.",
    "Next token prediction uses the local model.",
    "The host runs Linux Mint.",
    "Tokens are budgeted per session for cost hygiene.",
    "Expected first impression of the cockpit.",
    "It names the receipt and impact posture.",
    "We implement the consent gate first.",
  ];
  for (const body of benign) {
    const report = auditMarkdown({ file: "spec.md", body });
    assert.deepEqual(
      report.findings.filter((f) => f.kind === "economic"),
      [],
      `benign token/reward/mint vocab wrongly flagged: ${body}`,
    );
  }
});

test("a claim labeled with repo maturity vocab is not flagged (formatted forms)", () => {
  const labeled = [
    "| Token economy / PoI | **DESIGNED_NOT_LIVE** | future work |",
    "Ed25519 signing is **MECHANISM_VERIFIED_SYNTHETIC** on local fixtures.",
    "The token mint is `DESIGNED` only.",
    "[PRODUCTION_ACTIVE] the gateway holds 99.9% uptime.",
  ];
  for (const body of labeled) {
    const report = auditMarkdown({ file: "m.md", body });
    assert.equal(
      report.ok,
      true,
      `maturity-labeled claim wrongly flagged: ${body}`,
    );
  }
});

test("risk vocab only inside inline-code is not flagged (references, not claims)", () => {
  const benign = [
    "Do not use `production-ready` in public copy.",
    "Run `dema urp verify` against the index.",
    "Forbidden terms include `token economy` and `PoI rewards`.",
  ];
  for (const body of benign) {
    const report = auditMarkdown({ file: "g.md", body });
    assert.equal(
      report.ok,
      true,
      `inline-code reference wrongly flagged: ${body}`,
    );
  }
});

test("risk vocab in prose still flags even when other code spans exist on the line", () => {
  const report = auditMarkdown({
    file: "p.md",
    body: "The `gateway` module is production-ready today.",
  });
  assert.ok(
    report.findings.some((f) => f.kind === "deployment"),
    "prose 'production-ready' must still flag despite an inline-code span",
  );
});

test("bare maturity words (unformatted) still flag the claim", () => {
  // "designed" as prose is NOT a proof-state label; only **DESIGNED** / [DESIGNED]
  // / `DESIGNED` count. The claim must still flag.
  const report = auditMarkdown({
    file: "p.md",
    body: "BIZRA is designed to mint reward tokens for every user.",
  });
  assert.ok(
    report.findings.some((f) => f.kind === "economic"),
    "bare 'designed' must not suppress an unlabeled economic claim",
  );
});

test("first_or_only does not flag BIZRA's own safety vocabulary", () => {
  const benign = [
    "Dema is local-first and offline by default.",
    "The scanner is metadata-only; it never reads file content.",
    "Node1 and Node2 remain preview-only until proof gates pass.",
    "Receipts are read-only in this repo.",
    "This is the first implementation of the realm cockpit.",
    "There are only five screens in the seed realm.",
    "The smoke test passes only if every artifact verifies.",
  ];
  for (const body of benign) {
    const report = auditMarkdown({ file: "spec.md", body });
    assert.deepEqual(
      report.findings.filter((f) => f.kind === "first_or_only"),
      [],
      `benign safety vocab wrongly flagged: ${body}`,
    );
  }
});

test("first_or_only still flags real exclusivity overclaims", () => {
  const overclaims = [
    "BIZRA is the world's first Sovereign Digital Organism.",
    "This is the first-ever constitutional execution engine.",
    "Dema is the only system that proves every action.",
    "It is the first proof cockpit in existence.",
    "This is the definitive verification framework.",
  ];
  for (const body of overclaims) {
    const report = auditMarkdown({ file: "paper.md", body });
    assert.ok(
      report.findings.some((f) => f.kind === "first_or_only"),
      `real overclaim missed: ${body}`,
    );
  }
});

test("first_or_only flags hyphenated 'formally-verified' exclusivity", () => {
  const report = auditMarkdown({
    file: "paper.md",
    body: "Dema is the first formally-verified proof cockpit.",
  });
  assert.ok(
    report.findings.some((f) => f.kind === "first_or_only"),
    "hyphenated 'first formally-verified' overclaim missed",
  );
});

test("first_or_only flags unprecedented / first-of-its-kind / one-of-a-kind / truly-unique", () => {
  const overclaims = [
    "Dema is an unprecedented breakthrough in agent design.",
    "This is the first-of-its-kind proof ledger.",
    "BIZRA is a one-of-a-kind Sovereign Digital Organism.",
    "The realm cockpit is a truly unique architecture.",
  ];
  for (const body of overclaims) {
    const report = auditMarkdown({ file: "paper.md", body });
    assert.ok(
      report.findings.some((f) => f.kind === "first_or_only"),
      `exclusivity overclaim missed: ${body}`,
    );
  }
});

test("first_or_only does not flag technical 'unique' vocabulary", () => {
  const benign = [
    "Each receipt carries a unique hash committed to the chain.",
    "Sessions are keyed by a unique identifier.",
    "The index enforces a unique constraint per artifact.",
  ];
  for (const body of benign) {
    const report = auditMarkdown({ file: "spec.md", body });
    assert.deepEqual(
      report.findings.filter((f) => f.kind === "first_or_only"),
      [],
      `technical 'unique' wrongly flagged: ${body}`,
    );
  }
});

test("first_or_only is ReDoS-safe on adversarial input", () => {
  const body = `the only ${"a".repeat(60000)}`;
  const started = process.hrtime.bigint();
  auditMarkdown({ file: "evil.md", body });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(elapsedMs < 1000, `regex took ${elapsedMs}ms — possible ReDoS`);
});

test("claim-ledger-check CLI emits schema-tagged JSON and exits nonzero on findings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dema-claims-"));
  const path = join(dir, "paper.md");
  await writeFile(
    path,
    "BIZRA achieves 523,793 req/s and mints IMP rewards.\n",
    "utf8",
  );

  await assert.rejects(
    async () => execFileAsync("node", [cliPath, "--json", path]),
    (error) => {
      const report = JSON.parse(error.stdout);
      assert.equal(report.schema, "bizra.dema.claim_ledger_check.v0.1");
      assert.equal(report.ok, false);
      assert.equal(report.scanned_files.length, 1);
      assert.equal(report.findings.length, 2);
      return true;
    },
  );
});

test("claim-ledger-check CLI exits zero when risky claims are labeled", async () => {
  const dir = await mkdtemp(join(tmpdir(), "dema-claims-"));
  const path = join(dir, "paper.md");
  await writeFile(
    path,
    "[DECLARED] IMP authorization is a proposed governance rule.\n",
    "utf8",
  );

  const { stdout } = await execFileAsync("node", [cliPath, "--json", path]);
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true);
  assert.equal(report.findings.length, 0);
});

test("claim-ledger-check exposes stable labels and risk pattern metadata", () => {
  assert.deepEqual(LABELS, [
    "MEASURED",
    "CITED",
    "DECLARED",
    "PLANNED",
    "REMOVE_OR_HARDEN",
  ]);
  assert.ok(RISK_PATTERNS.some((pattern) => pattern.kind === "benchmark"));
  assert.ok(RISK_PATTERNS.some((pattern) => pattern.kind === "economic"));
});
