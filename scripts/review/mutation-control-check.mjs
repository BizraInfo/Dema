#!/usr/bin/env node
/**
 * MUTATION-CONTROL-REGISTRY-1A — prove the safeguards are load-bearing.
 *
 * WHY THIS EXISTS. Across this campaign the two deepest defects were not found
 * by a test failing. They were found by a MUTATION CONTROL REFUSING TO REDDEN:
 * a guard was deleted, the suite stayed green, and investigating why exposed
 * that the test had been passing for an unrelated reason. Both times the real
 * defect was one layer below where anyone was looking.
 *
 * Those controls were run by hand, in a shell, and they survive only in a
 * transcript. A future auditor cannot reproduce them without hand-editing
 * source. So the tree currently contains safeguards whose load-bearing-ness is
 * asserted in commit messages and provable nowhere — and a Genesis root would
 * bind exactly that.
 *
 *     A SAFEGUARD IS NOT PROVEN UNTIL REMOVING IT BREAKS THE INVARIANT.
 *
 * This makes that law executable: for each registered guard, delete it and
 * require its named test to go RED.
 *
 * THREE WAYS THIS GATE COULD LIE, AND WHAT STOPS EACH:
 *
 *   1. A STALE CONTROL. If the anchor text no longer appears — the guard was
 *      refactored or renamed — the mutation applies to nothing and the control
 *      silently tests nothing forever. `anchor_missing` FAILS. This is the
 *      vacuity check on the vacuity checker, and it is the whole point.
 *
 *   2. A BROKEN BASELINE. "Removing X reddens test Y" is meaningless if Y was
 *      already red. Every control proves its named tests GREEN before mutating.
 *
 *   3. A SYNTAX ERROR MASQUERADING AS A CAUGHT DEFECT. A mutation that breaks
 *      parsing reddens everything, which looks like success. The mutated run
 *      must still REPORT tests (a load failure reports zero), so a module that
 *      no longer parses is refused rather than credited.
 *
 * SAFE BY CONSTRUCTION. Every mutation is applied to a throwaway CLONE of HEAD. The working tree is never written to — measured motivation: doing
 * this by hand, a backup went to a read-only path, the restore silently failed,
 * and a mutated kernel survived into the next command.
 *
 * SCOPE: the gate clones HEAD, so it proves the COMMITTED tree. Uncommitted
 * work is deliberately invisible to it — a qualification gate should describe
 * what a fresh extraction would see, not what happens to be in the editor.
 *
 *   node scripts/review/mutation-control-check.mjs [--json]
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const SCHEMA = "bizra.dema.review.mutation_control.v0.1";

/**
 * Each entry says: remove THIS, and THOSE tests must fail. `why` records the
 * invariant in one line so a reader knows what is being protected, not merely
 * that something is.
 */
export const MUTATION_CONTROLS = Object.freeze([
  {
    id: "undo-transition-binding",
    file: "packages/core/src/dema-reversible-file-steward.js",
    find: "          row.receipt.of_receipt_hash === provisional.content_hash &&\n",
    replace: "",
    tests: ["tests/pre-r0-composition.test.js"],
    must_fail: ["PRC-04"],
    why: "an undo of a different apply must not satisfy p3 — a restored world is not a governed undo",
  },
  {
    id: "undo-receipt-integrity",
    file: "packages/core/src/dema-reversible-file-steward.js",
    find: "    recomputeReceiptContentHash(r) === r.content_hash &&\n",
    replace: "",
    tests: ["tests/pre-r0-composition.test.js"],
    must_fail: ["PRC-04b"],
    why: "log membership matches a hash STRING; without re-derivation an edited artifact keeps its seal",
  },
  {
    id: "observation-integrity",
    file: "packages/core/src/dema-reversible-file-steward.js",
    find: "      recomputeReceiptContentHash(o) !== o.content_hash ||\n",
    replace: "",
    tests: ["tests/pre-r0-composition.test.js"],
    must_fail: ["PRC-04c"],
    why: "an observation re-labelled to a later phase must not pass on its old content hash",
  },
  {
    id: "absence-requires-absent",
    file: "packages/core/src/dema-reversible-file-steward.js",
    find: "        ? seen.state === OBSERVED_ABSENT",
    replace: "        ? seen.state !== OBSERVED_PRESENT",
    tests: ["tests/observation-absence-semantics.test.js"],
    must_fail: ["OA-02"],
    why: "UNSAFE and UNREADABLE are failures to observe; blindness must never satisfy expected absence",
  },
  {
    id: "post-move-identity",
    file: "packages/core/src/node0-reversible-execute-gate.js",
    find: "    if (after_hash !== before_hash) {",
    replace: "    if (false) {",
    tests: ["tests/effect-time-toctou-identity.test.js"],
    must_fail: ["TOC-01"],
    why: "renameSync moves a pathname; without this, swapped bytes carry an authoritative success receipt",
  },
  {
    id: "effect-time-precondition",
    file: "packages/core/src/node0-reversible-execute-gate.js",
    find: "  if (plan.expected_before_hash && plan.expected_before_hash !== before_hash) {",
    replace: "  if (false) {",
    tests: ["tests/effect-time-preconditions.test.js"],
    must_fail: ["TEMP-01"],
    why: "a sealed observation is a past fact, not a lease — the mutating phase re-derives its own preconditions",
  },
  {
    id: "p1-content-inheritance",
    file: "packages/core/src/dema-reversible-file-steward.js",
    find: "    return capsule.source_content?.[capsule.effect_preview.atoms[0]?.from] ?? null;",
    replace: "    return null;",
    tests: ["tests/p1-source-content-consent-binding.test.js"],
    must_fail: ["CB-03"],
    why: "p1 must inherit the bytes the sovereign approved, not whatever occupies the path",
  },
  {
    id: "compensation-provenance",
    file: "packages/core/src/node0-reversible-execute-gate.js",
    find: "    const compensation = renamed",
    replace: "    const compensation = false && renamed",
    tests: ["tests/effect-time-toctou-identity.test.js"],
    must_fail: ["TOC-06"],
    why: "a physical move that was detected and reversed must not vanish from constitutional history",
  },
  {
    id: "earned-harness-plane",
    file: "scripts/review/plane-ownership-report.mjs",
    find: "    if (declared === HARNESS_PLANE && !PROVIDER_SURFACE.test(source)) {",
    replace: "    if (false) {",
    tests: ["tests/test-plane-classification.test.js"],
    must_fail: ["TPC-02"],
    why: "a harness label must be earned; relabelling a Dema test would move it out of the strict lane",
  },
  {
    id: "pre-push-posture-nullity",
    file: "packages/core/src/pre-push-proof-seal.js",
    find: "  let porcelain = null;\n",
    replace: '  let porcelain = "";\n',
    tests: ["tests/pre-push-proof-seal.test.js"],
    must_fail: ["PPN-01"],
    why: "restoring the empty-string seed makes a throwing git status indistinguishable from an empty porcelain — a failed measurement must never serialize as CLEAN",
  },
  {
    id: "recovery-atomic-publication",
    file: "scripts/proof/node0-recovery-worker.mjs",
    find: "writeFactsAtomic(p(n), o); };",
    replace: 'writeFileSync(p(n), JSON.stringify(o, null, 2)); };',
    tests: ["tests/node0-recovery-torn-read.test.js"],
    must_fail: ["RTR-06"],
    why: "a direct writeFileSync at the final pathname truncates it to zero first, so a polling reader sees an empty file and throws — the recovery family must publish through rename(2) like its runtime-mission and worker-handoff siblings",
  },
]);

const REPO = fileURLToPath(new URL("../..", import.meta.url));

/** Run test files and return { ran, failed: Set<name> }. */
function runTests(cwd, files) {
  let out = "";
  try {
    // NODE_TEST_CONTEXT must not be inherited. When this gate is itself invoked
    // from inside `node --test`, the child sees the parent's context, switches
    // reporter behaviour, and never emits the `# tests N` trailer — so every
    // control reported `baseline_did_not_run` and the gate silently measured
    // nothing. The harness leaking into the measurement, in the instrument built
    // to catch exactly that.
    const { NODE_TEST_CONTEXT: _drop, ...env } = process.env;
    out = execFileSync("node", ["--test", "--test-reporter=tap", ...files], {
      cwd,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
  // String.match, not RegExp's same-named method: the actuator gate scans source
  // text for the raw-shell execution token and cannot tell the two apart. Second
  // file in this campaign to trip it.
  const total = out.match(/^# tests (\d+)$/m);
  const failed = new Set();
  for (const m of out.matchAll(/^not ok \d+ - (.*)$/gm)) failed.add(m[1].trim());
  return { ran: total ? Number(total[1]) : 0, failed };
}

const hits = (failed, names) => names.filter((n) => [...failed].some((f) => f.startsWith(n)));

export function runMutationControls({ extractionRoot, controls = MUTATION_CONTROLS } = {}) {
  const results = [];
  for (const c of controls) {
    const path = join(extractionRoot, c.file);
    const original = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (original === null) {
      results.push({ id: c.id, ok: false, reason: "file_missing" });
      continue;
    }
    // 2. A broken baseline makes "it reddens" meaningless.
    const base = runTests(extractionRoot, c.tests);
    const alreadyRed = hits(base.failed, c.must_fail);
    if (base.ran === 0 || alreadyRed.length > 0) {
      results.push({
        id: c.id,
        ok: false,
        reason: base.ran === 0 ? "baseline_did_not_run" : "baseline_already_red",
        detail: alreadyRed,
      });
      continue;
    }
    // 1. A stale anchor silently tests nothing. Fail loudly.
    if (!original.includes(c.find)) {
      results.push({ id: c.id, ok: false, reason: "anchor_missing", detail: c.find.trim().slice(0, 60) });
      continue;
    }
    writeFileSync(path, original.replace(c.find, c.replace));
    const mutated = runTests(extractionRoot, c.tests);
    writeFileSync(path, original);

    // 3. A parse failure reddens everything and would read as success.
    //
    // `ran === 0` alone does NOT detect it: when an imported module fails to
    // parse, node reports the FILE as a single failing test and still prints
    // `# tests 1`. Measured by MC-04 against this very check — the first version
    // of this guard let a broken module through as `did_not_redden`. A failure
    // whose name is a test FILE is a load failure, not a caught defect.
    const loadFailed = [...mutated.failed].some((f) => f.endsWith(".test.js"));
    if (mutated.ran === 0 || loadFailed) {
      results.push({ id: c.id, ok: false, reason: "mutation_broke_the_module" });
      continue;
    }
    const reddened = hits(mutated.failed, c.must_fail);
    results.push({
      id: c.id,
      ok: reddened.length > 0,
      reason: reddened.length > 0 ? null : "guard_removal_did_not_redden_its_test",
      reddened,
      why: c.why,
    });
  }
  return results;
}

function main() {
  const json = process.argv.includes("--json");
  const work = mkdtempSync(join(tmpdir(), "mutation-control-"));
  try {
    // Never mutate the working tree. Measured motivation: doing this by hand, a
    // backup went to a read-only path, the restore failed silently, and a
    // mutated kernel survived into the next command.
    // A CLONE, not an archive. Measured: a tarball has no .git, and the
    // test-plane suite enumerates via `git ls-files` — so every git-dependent
    // test was already red in the extraction, which the baseline check caught as
    // `baseline_already_red` rather than letting the control pass on a corpse.
    execFileSync("git", ["clone", "--quiet", "--no-local", REPO, work], { stdio: "ignore" });
    execFileSync("git", ["checkout", "--quiet", "--detach", "HEAD"], { cwd: work, stdio: "ignore" });

    const results = runMutationControls({ extractionRoot: work });
    const ok = results.every((r) => r.ok);
    const report = {
      schema: SCHEMA,
      ok,
      controls: results.length,
      proven: results.filter((r) => r.ok).length,
      results,
      boundary: { read_only_working_tree: true, mutates_only_a_throwaway_extraction: true },
    };
    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(`mutation-control: ${ok ? "OK" : "FAIL"} · ${report.proven}/${report.controls} guards proven load-bearing`);
      for (const r of results) {
        const mark = r.ok ? "  ok  " : "  FAIL";
        console.log(`${mark} ${r.id}${r.ok ? "" : ` — ${r.reason}${r.detail ? ` (${r.detail})` : ""}`}`);
        if (r.ok) console.log(`        ${r.why}`);
      }
    }
    process.exit(ok ? 0 : 1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && process.argv[1].endsWith("mutation-control-check.mjs")) main();
