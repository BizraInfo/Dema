import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  writesUnderRoot,
  hasMutatingHttpCall,
  OPEN_DOMAINS,
  classifyOpenDomains,
} from "../scripts/proof/node0-transition-coverage-proof.mjs";

/**
 * NODE0-TRANSITION-DOMAIN-CLASSIFICATION-1A.
 *
 * THE DEFECT, measured on 7c41c068 before repair. The producer for
 * `receipt_per_transition` emitted its registry completeness as a LITERAL:
 *
 *     registry: { unclassified_count: 2, ... }
 *
 * with a comment naming the two open domains (`BIZRA_MUMU_ROOT`, the gateway
 * chain). The kernel refuses SATISFIED while that count is above zero, so the
 * row read UNKNOWN — correctly, because nobody had measured those domains.
 *
 * But a literal cannot become true by being edited. Setting it to 0 would move
 * the canonical ledger without measuring anything, which is the precise shape of
 * a false GREEN. So the count must be DERIVED from a classification that is
 * itself measured from source, and that is what these tests pin.
 *
 * WHAT "CLASSIFIED" HAS TO MEAN. Each open domain is a different question:
 *
 *   BIZRA_MUMU_ROOT   Is it an authoritative STATE root, or a read-only SCAN
 *                     scope? Decided by where the tool's writes actually land.
 *                     Measured: all five write sites target `outDir`/`chainPath`
 *                     (repo artefacts, already classified DERIVED by the
 *                     registry); zero target the scan root.
 *
 *   gateway chain     Does any local code advance it? Decided by whether the
 *                     adapter ever issues a mutating HTTP call. Measured: it
 *                     issues only GETs, and canon says the operator and gateway
 *                     advance the chain, never local code.
 *
 * EVERY NEGATIVE IS PAIRED WITH A POSITIVE CONTROL, for the same reason as
 * `node0-transition-coverage-detector.test.js`: a detector that answers "no" to
 * everything would classify both domains and drive the ledger to SATISFIED
 * without observing anything. TDC-02 and TDC-04 prove each detector fires on
 * source that should trip it — and TDC-04's control is not synthetic-only, since
 * four real files in this tree do issue mutating calls.
 *
 * TDC-06 is the anti-gaming row: a domain whose evidence cannot be read must
 * count as UNCLASSIFIED, so the count can never be driven to zero by breaking
 * the reader.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCER = join(REPO, "scripts/proof/node0-transition-coverage-proof.mjs");
const read = (rel) => readFileSync(join(REPO, rel), "utf8");

// ── TDC-01 ────────────────────────────────────────────────────────────────
test("TDC-01: both open domains are classified from source, not asserted", async () => {
  const result = classifyOpenDomains({ readSource: read });

  assert.equal(result.unclassified_count, 0, JSON.stringify(result.undetermined));
  assert.equal(result.determined.length, OPEN_DOMAINS.length);

  const byId = Object.fromEntries(result.determined.map((d) => [d.domain_id, d]));
  assert.equal(byId.bizra_mumu_root.classification, "SCAN_SCOPE");
  assert.equal(byId.gateway_chain.classification, "EXTERNAL_AUTHORITATIVE");

  // Each determination must carry the measurement that produced it, so a reader
  // can re-derive it rather than trust the label.
  for (const d of result.determined) {
    assert.equal(d.verified_by, "independent_source_trace");
    assert.ok(d.evidence.length > 0, `${d.domain_id} must carry evidence`);
  }
});

// ── TDC-02 ── positive control ────────────────────────────────────────────
test("TDC-02: the scan-root detector fires on a write that targets the root", () => {
  assert.equal(
    writesUnderRoot('writeFileSync(join(root, "x.json"), data);', "root"),
    true,
    "a write joined from the scan root must be detected",
  );
  assert.equal(
    writesUnderRoot('mkdirSync(join(opts.root, "d"), { recursive: true });', "root"),
    true,
  );
  // A comment or string naming the root is not a write to it.
  assert.equal(
    writesUnderRoot('// writeFileSync(join(root, "x"))\nconst s = "writeFileSync(join(root";', "root"),
    false,
    "prose must not be able to manufacture a write",
  );
});

// ── TDC-03 ────────────────────────────────────────────────────────────────
test("TDC-03: BIZRA_MUMU_ROOT is a read-only scan scope — no write targets it", () => {
  const src = read("scripts/node0-mumu-loop.mjs");
  // Control first: the file must genuinely contain writes, or "no write to the
  // root" would be true of a file that writes nothing at all.
  assert.match(src, /writeFileSync|appendFileSync|mkdirSync/, "precondition: the tool does write");
  assert.equal(writesUnderRoot(src, "root"), false,
    "every write must land outside the scan root");
});

// ── TDC-04 ── positive control ────────────────────────────────────────────
test("TDC-04: the mutating-call detector fires, and fires on real files", () => {
  assert.equal(hasMutatingHttpCall('await fetch(u, { method: "POST" });'), true);
  assert.equal(hasMutatingHttpCall("await fetch(u, { method: 'DELETE' });"), true);
  assert.equal(hasMutatingHttpCall('await fetch(u, { method: "GET" });'), false);

  // Not synthetic-only: this tree really does contain mutating callers, so the
  // detector is proven against production source and not just a fixture.
  const realCallers = ["packages/core/src/llm-adapter.js"];
  for (const f of realCallers) {
    assert.equal(hasMutatingHttpCall(read(f)), true, `${f} should trip the detector`);
  }
});

// ── TDC-05 ────────────────────────────────────────────────────────────────
test("TDC-05: the gateway chain has no local writer — the adapter only reads", () => {
  const src = read("packages/node-adapter/src/gateway-http-adapter.js");
  // Control: it must genuinely make HTTP calls, or "no mutating call" is vacuous.
  assert.match(src, /fetch\s*\(/, "precondition: the adapter does make HTTP calls");
  assert.equal(hasMutatingHttpCall(src), false,
    "no local code may advance the gateway chain");
});

// ── TDC-06 ── anti-gaming ─────────────────────────────────────────────────
test("TDC-06: an unreadable domain stays UNCLASSIFIED — the count cannot be gamed", () => {
  const blind = classifyOpenDomains({
    readSource: () => { throw Object.assign(new Error("nope"), { code: "ENOENT" }); },
  });
  assert.equal(blind.unclassified_count, OPEN_DOMAINS.length,
    "a reader that can see nothing must classify nothing");
  assert.equal(blind.determined.length, 0);

  // And a detector that always answers "no" must NOT classify a domain, because
  // "no" is only meaningful when the paired control proves the detector works.
  const emptySource = classifyOpenDomains({ readSource: () => "" });
  assert.equal(emptySource.unclassified_count, OPEN_DOMAINS.length,
    "an empty source proves nothing and must not classify a domain");
});

// ── TDC-07 ── the emitted count is derived, never written ─────────────────
test("TDC-07: the producer emits the DERIVED count, with no literal in the registry", () => {
  const home = mkdtempSync(join(tmpdir(), "tdc-"));
  try {
    execFileSync("node", [PRODUCER, "--dema-home", home, "--json"], { cwd: REPO, encoding: "utf8" });
    const artefact = JSON.parse(
      readFileSync(join(home, "node0", "coverage", "observation.json"), "utf8"));
    const derived = classifyOpenDomains({ readSource: read });

    assert.equal(artefact.registry_unclassified_count, derived.unclassified_count,
      "the artefact's count must equal the independently derived count");

    // The producer must not carry a hand-written completeness number.
    const producerSrc = readFileSync(PRODUCER, "utf8");
    assert.doesNotMatch(producerSrc, /unclassified_count:\s*\d/,
      "registry completeness must be measured, never asserted as a literal");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
