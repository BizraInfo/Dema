// HOMEBASE-SCAN-CONSENT-1A — pure consent-ceremony kernel tests.
// The kernel GATES the homebase metadata scan: it produces the disclosure +
// the exact phrase required, and verifies an offered phrase. It performs NO
// scan itself (homebase_scan_performed is always false here) — the CLI runs
// the existing metadata-only scanner only after this kernel returns scan_allowed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildHomebaseScanConsent,
  HOMEBASE_SCAN_CONSENT_SCHEMA,
  EXPECTED_SCAN_CONSENT_PHRASE,
} from "../packages/core/src/homebase-scan-consent.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/homebase-scan-consent.js", import.meta.url),
);

const DOMAIN_BOUNDARY_KEYS = [
  "homebase_scan_performed",
  "file_content_read",
  "scanned_root_mutated",
  "symlink_followed",
  "network_used",
  "model_invoked",
  "task_executed",
  "runtime_activated",
  "federation_used",
  "token_minted",
  "poi_score_calculated",
  "reward_emitted",
];

function assertDeepFrozen(value, label = "value") {
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object") {
      assertDeepFrozen(child, `${label}.${key}`);
    }
  }
}

test("the expected consent phrase is the exact operator-specified string", () => {
  assert.equal(EXPECTED_SCAN_CONSENT_PHRASE, "GO: scan homebase metadata only");
});

test("no consent offered → not verified, scan not allowed, ceremony shown", () => {
  const c = buildHomebaseScanConsent({ offeredConsent: null });
  assert.equal(c.consent_required, true);
  assert.equal(c.consent_verified, false);
  assert.equal(c.scan_allowed, false);
  assert.equal(c.expected_consent_phrase, "GO: scan homebase metadata only");
  assert.ok(c.explanation_lines.length > 0);
  assert.ok(
    c.next_safe_actions.includes("grant_exact_consent_to_scan") &&
      c.next_safe_actions.includes("skip_scan"),
  );
});

test("wrong consent phrase → not verified, scan not allowed", () => {
  const c = buildHomebaseScanConsent({ offeredConsent: "scan it" });
  assert.equal(c.consent_verified, false);
  assert.equal(c.scan_allowed, false);
});

test("a near-miss (extra whitespace) does NOT verify — exact string only", () => {
  const c = buildHomebaseScanConsent({
    offeredConsent: " GO: scan homebase metadata only ",
  });
  assert.equal(c.consent_verified, false);
});

test("exact consent phrase → verified, scan_allowed true", () => {
  const c = buildHomebaseScanConsent({
    offeredConsent: "GO: scan homebase metadata only",
  });
  assert.equal(c.consent_verified, true);
  assert.equal(c.scan_allowed, true);
  assert.ok(c.next_safe_actions.includes("run_homebase_metadata_scan"));
});

test("scan_root is disclosed honestly when provided", () => {
  const c = buildHomebaseScanConsent({
    offeredConsent: null,
    scanRoot: "/home/op/Downloads",
  });
  assert.equal(c.scan_root, "/home/op/Downloads");
  assert.ok(
    c.explanation_lines.some((l) => l.includes("/home/op/Downloads")),
    "the disclosure must name the root that will be scanned",
  );
});

test("explanation discloses the refusals: no content, no upload, no symlink, no mutation", () => {
  const text = buildHomebaseScanConsent({ offeredConsent: null })
    .explanation_lines.join(" ");
  assert.match(text, /content/i);
  assert.match(text, /upload/i);
  assert.match(text, /symlink/i);
  assert.match(text, /mutate|mutation/i);
  assert.match(text, /skip/i);
});

test("kernel boundary is all-false on EVERY path — the kernel itself never scans", () => {
  for (const offered of [null, "wrong", "GO: scan homebase metadata only"]) {
    const c = buildHomebaseScanConsent({ offeredConsent: offered });
    for (const key of DOMAIN_BOUNDARY_KEYS) {
      assert.equal(
        c.boundary[key],
        false,
        `boundary.${key} must be false (offered=${offered})`,
      );
    }
  }
});

test("schema, truth_label, mode are the exact canonical strings; deep-frozen", () => {
  const c = buildHomebaseScanConsent({ offeredConsent: null });
  assert.equal(c.schema, "bizra.dema.homebase_scan_consent.v0.1");
  assert.equal(c.schema, HOMEBASE_SCAN_CONSENT_SCHEMA);
  assert.equal(c.truth_label, "HOMEBASE_SCAN_CONSENT_LOCAL_ONLY");
  assert.equal(c.mode, "preview_only");
  assertDeepFrozen(c, "consent");
});

test("what_this_does_not_prove states the kernel performed no scan", () => {
  const text = buildHomebaseScanConsent({
    offeredConsent: "GO: scan homebase metadata only",
  }).what_this_does_not_prove.join(" ");
  assert.match(text, /no scan|performed no scan|not.*scan/i);
  assert.match(text, /content/i);
});

test("module imports no fs, fs/promises, net, child process, os, or http APIs", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/,
  );
});
