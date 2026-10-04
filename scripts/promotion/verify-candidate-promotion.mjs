#!/usr/bin/env node
/**
 * G6-CANONICAL-PROMOTION-1A — verify-candidate-promotion
 *
 * Release-engineering gate: converts a locally measured dirty worktree into an
 * exactly-described, independently reconstructible promotion candidate and
 * emits READY_FOR_COMMIT_GO — WITHOUT committing, pushing, merging, starting
 * anything, or touching keys. Commit/push/merge remain separate explicit human
 * authority transitions (never collapsed; AUTO-SHIP must not be used here).
 *
 * Artifacts (written under proof-of-promotion/<MISSION>/):
 *   PROMOTION_DESCRIPTOR.json   exact base/scope/bindings
 *   QUALIFICATION_REPORT.json   every gate with typed result + evidence
 *   PROMOTION_RECEIPT.json      hash-chained verdict incl. READY_FOR_COMMIT_GO
 *
 * Usage:
 *   node scripts/promotion/verify-candidate-promotion.mjs \
 *     --mission G6-CANONICAL-PROMOTION-1A --allowlist scripts/promotion/G6.allowlist.json
 *   [--skip-aggregate]  (forces READY_FOR_COMMIT_GO=false, aggregate_mode=skipped)
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const argv = process.argv.slice(2);
const arg = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
};
const MISSION = arg("--mission") ?? "G6-CANONICAL-PROMOTION-1A";
const ALLOWLIST_PATH = arg("--allowlist") ?? join(HERE, `${MISSION}.allowlist.json`);
const SKIP_AGGREGATE = argv.includes("--skip-aggregate");
const OUT_DIR = join(REPO, "proof-of-promotion", MISSION);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const sh = (file, args, opts = {}) => {
  try {
    return {
      ok: true,
      stdout: execFileSync(file, args, {
        encoding: "utf8",
        cwd: opts.cwdOverride ?? REPO,
        timeout: opts.timeout ?? 900_000,
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
      }),
    };
  } catch (e) {
    return { ok: false, stdout: e.stdout ?? "", stderr: e.stderr ?? String(e), code: e.status };
  }
};
const git = (...args) => sh("git", args);
const jsonOut = (obj) => JSON.stringify(obj, null, 2);

// ---------------------------------------------------------------------------
// Secret patterns over candidate bytes (added lines + untracked allowlisted files)
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  [/\bsk-[A-Za-z0-9]{20,}\b/, "openai-style secret key prefix"],
  [/(BEGIN|END) [A-Z ]*PRIVATE KEY/, "embedded private key block"],
  [/ghp_[A-Za-z0-9]{20,}/, "github PAT"],
  [/github_pat_[A-Za-z0-9_]{20,}/, "github fine-grained PAT"],
  [/AKIA[0-9A-Z]{16}/, "aws access key id"],
  [/xox[abprs]-[A-Za-z0-9-]{10,}/, "slack token"],
  [/-----BEGIN [A-Z ]*KEY-----/, "pem key material"],
  [/eyJ[A-Za-z0-9_-]{40,}\./, "bare JWT credential"],
];

function scanText(text) {
  const findings = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(lines[i])) findings.push({ line: i + 1, label });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Gate registry — each returns {id, status: PASS|FAIL|SKIPPED|UNKNOWN, detail}
// ---------------------------------------------------------------------------

function gatherScope() {
  const base_sha = git("-c", "core.quotepath=false", "rev-parse", "HEAD").stdout.trim();
  const base_tree = git("rev-parse", "HEAD^{tree}").stdout.trim();
  const st = git("-c", "core.quotepath=false", "status", "--porcelain").stdout
    .split("\n")
    .filter((l) => l.trim());
  const changed = st.map((l) => ({ x: l.slice(0, 2).trim(), path: l.slice(3).replace(/^"|"$/g, "") }));
  // Candidate content digest: every changed path's current blob hash (or 'absent')
  const files = {};
  for (const c of changed) {
    const p = join(REPO, c.path);
    if (!existsSync(p)) {
      files[c.path] = "deleted-in-worktree";
    } else if (statSync(p).isDirectory()) {
      continue;
    } else {
      files[c.path] = git("hash-object", p).stdout.trim();
    }
  }
  const dirty_tree_digest = sha256(
    JSON.stringify(Object.fromEntries(Object.entries(files).sort(([a], [b]) => (a < b ? -1 : 1)))),
  );
  return { base_sha, base_tree, changed, files, dirty_tree_digest };
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return null;
  return JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
}

function runFocused(cwd = REPO) {
  const files = [
    "tests/drs-realm-contracts.test.js",
    "tests/drs-presence-reducer.test.js",
    "tests/drs-fixture-publisher.test.js",
    "tests/node0-fate-staged-effect.test.js",
    "tests/node0-deployment-remote-write.test.js",
    "tests/dema-capability-truth-registry.test.js",
  ];
  const results = [];
  let allPass = true;
  for (const f of files) {
    const r = sh("node", ["--test", f], { timeout: 300_000, cwdOverride: cwd });
    const pass = r.ok && /fail 0\b/.test(r.stdout.replace(/\r/g, ""));
    const m = r.stdout.match(/# pass (\d+)/);
    const failM = r.stdout.match(/# fail (\d+)/);
    results.push({
      suite: f,
      status: pass ? "PASS" : "FAIL",
      passed: m ? Number(m[1]) : null,
      failed: failM ? Number(failM[1]) : null,
    });
    if (!pass) allPass = false;
  }
  return { status: allPass ? "PASS" : "FAIL", suites: results };
}

function runAggregate(cwd = REPO) {
  if (SKIP_AGGREGATE) return { mode: "skipped", gates: [] };
  // v0.2: aggregate gates run against CANDIDATE bytes (the fresh clone), never
  // the source dirty worktree — KnownRed ≠ AcceptableGreen. A deliberately-red
  // scaffold excluded from the candidate must not block it, and candidate
  // greenness must be judged on exactly the bytes that will be committed.
  const gates = [];
  const t = sh("npm", ["test"], { timeout: 900_000, cwdOverride: cwd });
  mkdirSync(join(OUT_DIR, "gate-logs"), { recursive: true });
  writeFileSync(join(OUT_DIR, "gate-logs", "npm-test.log"), t.stdout + "\n---stderr---\n" + t.stderr);
  const tm = t.stdout.match(/# fail (\d+)/);
  gates.push({
    id: "npm_test_fail_zero",
    status: t.ok && Number(tm?.[1] ?? 1) === 0 ? "PASS" : "FAIL",
    failed: tm ? Number(tm[1]) : null,
    exit: t.code,
  });
  const c = sh("npm", ["run", "check"], { timeout: 1_200_000, cwdOverride: cwd });
  writeFileSync(join(OUT_DIR, "gate-logs", "npm-check.log"), c.stdout + "\n---stderr---\n" + c.stderr);
  gates.push({ id: "npm_run_check_exit_zero", status: c.ok ? "PASS" : "FAIL", exit: c.code ?? 0 });
  const g = sh("npm", ["run", "llm:guidance"], { timeout: 300_000, cwdOverride: cwd });
  gates.push({ id: "llm_guidance_pass", status: g.ok ? "PASS" : "FAIL" });
  const d = sh("git", ["diff", "--check"], { cwdOverride: cwd });
  gates.push({ id: "git_diff_check_clean", status: d.ok ? "PASS" : "FAIL" });
  const allPass = gates.every((x) => x.status === "PASS");
  return { mode: "full_candidate_tree", gates, status: allPass ? "PASS" : "FAIL" };
}

function scanSecrets(changedPaths) {
  const findings = [];
  const diff = git("diff", "HEAD").stdout;
  const added = diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .join("\n");
  for (const f of scanText(added)) findings.push({ where: "diff-added-lines", ...f });
  for (const rel of changedPaths) {
    const p = join(REPO, rel);
    if (existsSync(p) && statSync(p).isFile()) {
      for (const f of scanText(readFileSync(p, "utf8"))) {
        findings.push({ where: `untracked-or-modified:${rel}`, ...f });
      }
    }
  }
  return { status: findings.length === 0 ? "PASS" : "FAIL", findings };
}

function scanCaptures(changedPaths) {
  const tracked = git("ls-files").stdout.split("\n");
  const bad = [
    ...tracked.filter((f) => /(^|\/)(codex|session)-ses[_-][^/]*\.md$/.test(f)),
    ...changedPaths.filter((f) => /(^|\/)(codex|session)-ses[_-][^/]*\.md$/.test(f)),
  ];
  return { status: bad.length === 0 ? "PASS" : "FAIL", tracked_or_candidate_captures: bad };
}

function scopeCheck(changed, allowlist) {
  if (!allowlist) {
    return { status: "UNKNOWN", detail: "allowlist_missing", unexpected_paths: [], missing_expected: [] };
  }
  const expected = new Set(allowlist.expected_paths);
  const forbidden = new Set(allowlist.forbidden_paths ?? []);
  // v0.2 DECLARED EXCLUSIONS: paths named here are knowingly left OUT of the
  // candidate (e.g. the TASK-080.01 red-first scaffold). They are not
  // "unexpected drift"; they are reviewed, versioned absence.
  const excluded = new Set(allowlist.excluded_paths ?? []);
  const actual = new Set(changed.map((c) => c.path));
  const candidate = [...actual].filter((p) => !excluded.has(p));
  const unexpected = candidate.filter((p) => !expected.has(p));
  const hitForbidden = candidate.filter((p) => matchForbidden(p, forbidden));
  const excludedSeen = [...actual].filter((p) => excluded.has(p));
  const missingExpected = [...expected].filter((p) => !actual.has(p));
  const status =
    unexpected.length === 0 && hitForbidden.length === 0 ? "PASS" : "FAIL";
  return {
    status,
    unexpected_paths: unexpected,
    forbidden_hits: hitForbidden,
    excluded_declared: excludedSeen,
    missing_expected: allowlist.enforce_all_expected ? missingExpected : [],
  };
}

function matchForbidden(path, forbiddenSet) {
  for (const pat of forbiddenSet) {
    if (pat.endsWith("/**")) {
      if (path.startsWith(pat.slice(0, -3))) return true;
    } else if (path === pat) {
      return true;
    }
  }
  return false;
}

function candidatePaths(scope, allowlist) {
  const excluded = new Set(allowlist?.excluded_paths ?? []);
  const expected = new Set(allowlist?.expected_paths ?? []);
  return scope.changed
    .map((c) => c.path)
    .filter((p) => expected.has(p) && !excluded.has(p));
}

// Directory entries in an allowlist stand for every file beneath them.
// Without this, an untracked directory is "copied" as zero files and the
// candidate silently loses its own tooling.
function expandCandidateFiles(paths) {
  const out = [];
  const walk = (rel) => {
    const abs = join(REPO, rel);
    if (!existsSync(abs)) return;
    if (statSync(abs).isDirectory()) {
      for (const child of readdirSync(abs)) walk(join(rel, child));
    } else {
      out.push(rel);
    }
  };
  for (const p of paths) {
    if (p.endsWith("/")) {
      // trailing-slash dir form: enumerate via parent listing
      const base = p.slice(0, -1);
      if (existsSync(join(REPO, base)) && statSync(join(REPO, base)).isDirectory()) {
        for (const child of readdirSync(join(REPO, base))) walk(join(base, child));
      }
    } else {
      walk(p);
    }
  }
  return [...new Set(out)];
}

function freshReconstruction(scope, allowlist) {
  const cand = expandCandidateFiles(candidatePaths(scope, allowlist));
  const focusedFiles = [
    "tests/drs-realm-contracts.test.js",
    "tests/drs-presence-reducer.test.js",
    "tests/drs-fixture-publisher.test.js",
    "tests/node0-fate-staged-effect.test.js",
    "tests/node0-deployment-remote-write.test.js",
    "tests/dema-capability-truth-registry.test.js",
  ];
  let tmp;
  try {
    tmp = mkTemp("promo-recon-");
    const cloneDir = join(tmp, "repo");
    const clone = sh("git", ["clone", "-q", "--no-hardlinks", REPO, cloneDir], { timeout: 600_000 });
    if (!clone.ok) return { status: "FAIL", detail: "clone_failed" };

    // Apply the exact CANDIDATE delta INSIDE THE CLONE ONLY — tracked paths via
    // a scope-limited patch, untracked allowlisted files verbatim. Never touch
    // the source worktree.
    const tracked = cand.filter((p) => git("ls-files", "--error-unmatch", p).ok);
    const patchPath = join(tmp, "candidate.patch");
    writeFileSync(patchPath, git("diff", "HEAD", "--", ...tracked).stdout);
    const applyInClone = sh("git", ["-C", cloneDir, "apply", "--whitespace=nowarn", patchPath], {
      timeout: 120_000,
    });
    let copied = 0;
    for (const rel of cand) {
      if (tracked.includes(rel)) continue;
      const src = join(REPO, rel);
      if (!existsSync(src) || statSync(src).isDirectory()) continue;
      const dst = join(cloneDir, rel);
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, readFileSync(src));
      copied += 1;
    }

    // DECLARED EXCLUSION: strip the red scaffold and its wiring from the
    // candidate bytes only. Reviewed script; fails closed if incomplete.
    const excl = sh("node", ["scripts/promotion/exclude-rd-genome-scaffold.mjs"], {
      cwdOverride: cloneDir,
      timeout: 60_000,
    });

    // Tree equality over the candidate path set via blob hashes.
    const mismatches = [];
    for (const rel of cand) {
      const src = join(REPO, rel);
      const dst = join(cloneDir, rel);
      const want = existsSync(src) && statSync(src).isFile()
        ? git("hash-object", src).stdout.trim()
        : null;
      if (want === null) continue; // directory entries covered by children
      // Exclusion-rewritten files intentionally differ from source bytes.
      if (excl.ok && REWRITE_AFFECTED.includes(rel)) continue;
      const got = existsSync(dst) ? sh("git", ["hash-object", dst]).stdout.trim() : "absent";
      if (got !== want) mismatches.push(rel);
    }

    // Focused proof inside the reconstruction.
    const fr = sh("node", ["--test", ...focusedFiles], {
      timeout: 600_000,
      cwdOverride: cloneDir,
    });
    const focusedPass = fr.ok && /fail 0\b/.test(fr.stdout.replace(/\r/g, ""));
    if (!focusedPass) {
      const notOk = fr.stdout.split("\n").filter((l) => l.startsWith("not ok")).slice(0, 4);
      const stack = fr.stdout.split("\n").filter((l) => l.includes("error:") || l.includes("at ")).slice(0, 4);
      console.error(`[recon-focused-FAIL] ${[...notOk, ...stack].join(" | ").slice(0, 700)}`);
    }

    const outcome = {
      status:
        !applyInClone.ok || !excl.ok
          ? "FAIL"
          : mismatches.length === 0 && focusedPass
            ? "PASS"
            : "FAIL",
      tree_mismatches: mismatches,
      candidate_path_count: cand.length,
      untracked_files_copied: copied,
      exclusion_applied: excl.ok,
      exclusion_output: (excl.stdout + "\n" + excl.stderr).trim().split("\n")[0] ?? "",
      focused_reconstruction: focusedPass ? "PASS" : "FAIL",
      apply_tracked_ok: applyInClone.ok,
      clone_dir: cloneDir,
      _tmp: tmp,
    };
    if (outcome.status !== "PASS") {
      rmSync(tmp, { recursive: true, force: true });
      delete outcome._tmp;
      delete outcome.clone_dir;
    }
    return outcome;
  } catch (e) {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
    return { status: "FAIL", detail: String(e) };
  }
}
const REWRITE_AFFECTED = [
  "packages/core/src/dema-capability-truth-registry.js",
  "tests/dema-capability-truth-registry.test.js",
  "scripts/check.mjs",
  "docs/TESTING.md",
  "docs/CURRENT_LIMITS.md",
  "scripts/review/canonical-json-v1-check.mjs",
];

function mkTemp(prefix) {
  const base = join(tmpdir(), `${prefix}${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(base, { recursive: true });
  return base;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const startedIso = new Date().toISOString();
  const scope = gatherScope();
  const allowlist = loadAllowlist();

  const descriptor = {
    schema: "bizra.promotion.descriptor.v0.1",
    mission_id: MISSION,
    issued_at: startedIso,
    base_commit_sha: scope.base_sha,
    base_tree_sha: scope.base_tree,
    source_worktree: REPO,
    source_dirty_path_count: scope.changed.length,
    source_dirty_tree_digest: `sha256:${scope.dirty_tree_digest}`,
    expected_paths: allowlist?.expected_paths ?? null,
    forbidden_paths: allowlist?.forbidden_paths ?? [],
    aggregate_mode: SKIP_AGGREGATE ? "skipped" : "full",
    authority: Object.freeze({
      runtime_started: false,
      network_used_for_promotion_actions: false,
      keys_used: false,
      push_performed: false,
      merge_performed: false,
      commit_performed: false,
      authority_delta: 0,
    }),
  };

  const scopeGate = scopeCheck(scope.changed, allowlist);
  const secrets = scanSecrets(scope.changed.map((c) => c.path).filter((p) => existsSync(join(REPO, p))));
  const captures = scanCaptures(scope.changed.map((c) => c.path));
  const focusedSource = runFocused(REPO);
  const reconstruction = freshReconstruction(scope, allowlist);

  // v0.2: aggregate gates are judged INSIDE the reconstructed candidate clone,
  // then the candidate tree is hashed and re-hashed after the gates to prove
  // zero post-verification drift.
  let aggregate = { mode: "not_run", gates: [], status: "FAIL" };
  let candidateTreeSha = null;
  let drift = null;
  if (reconstruction.status === "PASS" && reconstruction.clone_dir) {
    try {
      aggregate = runAggregate(reconstruction.clone_dir);
      const CAND = reconstruction.clone_dir;
      const add1 = sh("git", ["-C", CAND, "add", "-A"]);
      if (!add1.ok) console.error(`[tree-add-FAIL] ${(add1.stderr || "").slice(0, 300)}`);
      const wt1 = sh("git", ["-C", CAND, "write-tree"]);
      if (!wt1.ok) console.error(`[tree-write-FAIL] ${(wt1.stderr || "").slice(0, 300)}`);
      candidateTreeSha = wt1.stdout.trim();
      aggregate.gates.forEach((g) => (g.judged_on = "candidate_tree"));
      sh("git", ["-C", CAND, "add", "-A"]);
      const postTree = sh("git", ["-C", CAND, "write-tree"]).stdout.trim();
      drift = {
        status:
          candidateTreeSha && postTree && postTree === candidateTreeSha
            ? "PASS"
            : candidateTreeSha || postTree ? "FAIL" : "FAIL",
        candidate_tree_oid: candidateTreeSha,
        post_verification_tree_oid: postTree,
      };
    } finally {
      if (!process.env.PROMO_KEEP) rmSync(reconstruction._tmp, { recursive: true, force: true });
    }
  } else {
    aggregate = SKIP_AGGREGATE
      ? { mode: "skipped", gates: [], status: "FAIL" }
      : { mode: "full_candidate_tree", gates: [], status: "FAIL", note: "reconstruction_failed" };
  }

  const qualification = {
    schema: "bizra.promotion.qualification_report.v0.2",
    mission_id: MISSION,
    issued_at: new Date().toISOString(),
    focused_suites_source_worktree: focusedSource,
    aggregate_gates_candidate_tree: aggregate,
    secret_scan: secrets,
    session_capture_scan: captures,
    scope_gate: scopeGate,
    fresh_reconstruction: { ...reconstruction, clone_dir: undefined, _tmp: undefined },
    zero_post_verification_drift: drift ?? { status: "UNKNOWN" },
    environment: {
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
    },
  };

  const blockers = [];
  if (scopeGate.status !== "PASS") blockers.push(`scope:${scopeGate.status}`);
  if (secrets.status !== "PASS") blockers.push(`secret_scan:${secrets.findings.length}`);
  if (captures.status !== "PASS") blockers.push("session_capture_tracked");
  if (focusedSource.status !== "PASS") blockers.push("focused_suites_source");
  if (reconstruction.status !== "PASS") blockers.push(`reconstruction:${reconstruction.status}`);
  if (SKIP_AGGREGATE) blockers.push("aggregate_skipped");
  else if (aggregate.status !== "PASS") blockers.push("aggregate_gates_candidate_tree");
  if (!candidateTreeSha) blockers.push("candidate_tree_unhashed");
  else if (drift?.status !== "PASS") blockers.push("post_verification_drift");

  const ready = blockers.length === 0;
  const receipt = {
    schema: "bizra.promotion.receipt.v0.2",
    mission_id: MISSION,
    sealed_at: new Date().toISOString(),
    base_commit_sha: scope.base_sha,
    dirty_tree_digest: `sha256:${scope.dirty_tree_digest}`,
    candidate_tree_oid: candidateTreeSha || null,
    object_format: git("rev-parse", "--show-object-format").stdout.trim() || "sha1",
    zero_post_verification_drift: drift?.status ?? "UNKNOWN",
    landing_law:
      "On explicit human GO for commit: apply this exact delta to base, commit, and REFUSE unless HEAD^{tree} == candidate_tree_oid (Git tree OID in the repo object format). Push remains a separate later GO.",
    truth_status: ready ? "READY_FOR_COMMIT_GO" : "BLOCKED",
    blocked_by: blockers,
    next_authority_required: ready ? "commit (explicit human word; push stays separate)" : "none until blockers clear",
    authority_delta: 0,
    runtime_started: false,
    network_used_for_promotion_actions: false,
    keys_used: false,
    push_performed: false,
    merge_performed: false,
    commit_performed: false,
    body_digest: null,
    previous_receipt: null,
  };
  const bodyForHash = { ...receipt };
  delete bodyForHash.body_digest;
  receipt.body_digest = `sha256:${sha256(jsonOut(bodyForHash))}`;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "PROMOTION_DESCRIPTOR.json"), jsonOut(descriptor));
  writeFileSync(join(OUT_DIR, "QUALIFICATION_REPORT.json"), jsonOut(qualification));
  writeFileSync(join(OUT_DIR, "PROMOTION_RECEIPT.json"), jsonOut(receipt));

  // Console summary
  const line = (s) => console.log(s);
  line(`PROMOTION ${MISSION}`);
  line(`  base        ${scope.base_sha.slice(0, 12)} (dirty paths: ${scope.changed.length})`);
  line(`  scope       ${scopeGate.status}${scopeGate.unexpected_paths.length ? " -> " + scopeGate.unexpected_paths.join(", ") : ""}`);
  line(`  secrets     ${secrets.status}`);
  line(`  captures    ${captures.status}`);
  line(`  focused     ${focusedSource.status} (src: ${focusedSource.suites.map((s) => `${s.suite.split("/")[1]}:${s.passed}`).join(" · ")})`);
  line(`  aggregate   ${aggregate.status}${aggregate.mode === "skipped" ? " (SKIPPED)" : " (candidate tree)"}`);
  line(`  cand.tree   ${candidateTreeSha ? candidateTreeSha.slice(0, 16) + "…" : "n/a"} drift=${drift?.status ?? "n/a"}`);
  line(`  recon       ${reconstruction.status}${reconstruction.tree_mismatches?.length ? " -> " + reconstruction.tree_mismatches.slice(0, 5).join(",") : ""}`);
  line(`  VERDICT     ${receipt.truth_status}`);
  if (blockers.length) line(`  blocked_by  ${blockers.join(" · ")}`);
  process.exitCode = ready ? 0 : 1;
}

main();
