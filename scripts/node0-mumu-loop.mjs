// N0-MUMU-1 · Node0 Mumu Closed Loop v0.1 (Genesis Single-Node Active Network).
//
// Local, offline, metadata-only. Stdlib only. No network/shell imports.
// Builds the first private production loop for one operator: see world ->
// strongest assets -> one mission -> PAT/SAT -> consent -> action artifact ->
// receipts -> impact preview -> reflection -> next step.
//
// See docs/06-adr/ADR-037-node0-mumu-closed-loop-v0.1.md.

import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readFileSync,
  readdirSync,
  lstatSync,
  rmSync,
  existsSync,
  realpathSync,
} from "node:fs";
import {
  join,
  resolve,
  relative,
  dirname,
  basename,
  extname,
  sep,
} from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const SCHEMA_PREFIX = "bizra.dema.node0_mumu";
const TEST_NOW = "2026-06-12T00:00:00.000Z";

// Resolve symlinks so the "output must not be inside the scanned root" check
// can't be bypassed by a symlinked path segment (resolve() is lexical only).
// realpathSync needs the path to exist, so for a not-yet-created output dir we
// canonicalize the deepest existing ancestor and re-append the remaining tail.
export function canonicalize(p) {
  let cur = resolve(p);
  const tail = [];
  while (!existsSync(cur)) {
    const parent = dirname(cur);
    if (parent === cur) return resolve(p);
    tail.unshift(basename(cur));
    cur = parent;
  }
  return tail.length ? join(realpathSync(cur), ...tail) : realpathSync(cur);
}

// ---- canonical primitives -------------------------------------------------

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}

export function sha256(value) {
  const data = typeof value === "string" ? value : stableStringify(value);
  return `sha256:${createHash("sha256").update(data).digest("hex")}`;
}

// ---- root canon (Layer 0) -------------------------------------------------
//
// Binds Node0 to the IMMUTABLE BIZRA Root Canon by re-deriving each source
// document's sha256 and comparing to docs/root-canon/root-canon.manifest.json.
// Reading the canon source documents is project-integrity verification, NOT a
// read of the operator's private scanned root (file_content_read stays false).

export function loadRootCanon() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const manifestPath = join(
    repoRoot,
    "docs",
    "root-canon",
    "root-canon.manifest.json",
  );
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { ok: false, error: "root_canon_manifest_missing", roots: [] };
  }
  if (manifest.status !== "IMMUTABLE") {
    return { ok: false, error: "root_canon_not_immutable", roots: [] };
  }
  const a = manifest.authority || {};
  const immutableAuthority =
    a.founder_can_modify === false &&
    a.network_vote_can_modify === false &&
    a.agent_can_modify === false &&
    a.model_can_modify === false &&
    a.validator_can_modify === false;
  if (!immutableAuthority) {
    return { ok: false, error: "root_canon_authority_mutable", roots: [] };
  }
  if (!Array.isArray(manifest.roots) || manifest.roots.length !== 3) {
    return { ok: false, error: "root_canon_count_invalid", roots: [] };
  }
  const roots = manifest.roots.map((r) => {
    let actual = null;
    let present = false;
    try {
      actual = createHash("sha256")
        .update(readFileSync(join(repoRoot, r.path)))
        .digest("hex");
      present = true;
    } catch {
      /* source missing */
    }
    return {
      id: r.id,
      title: r.title,
      role: r.role,
      path: r.path,
      expected_sha256: r.sha256,
      actual_sha256: actual,
      source_present: present,
      sha256_ok: present && actual === r.sha256,
    };
  });
  const verified = roots.every((x) => x.sha256_ok);
  return {
    ok: verified,
    canon_id: manifest.canon_id,
    status: manifest.status,
    verified,
    result: verified ? "BIZRA_ROOT_CANON_SEALED" : "BIZRA_ROOT_CANON_UNSEALED",
    roots,
  };
}

const ROOT_PRINCIPLES = {
  ROOT_1_THE_MESSAGE:
    "mercy — power without mercy is forbidden; Dema's tone stays humane.",
  ROOT_2_THE_SEED:
    "service — faith, ethics, and financial freedom as one working system; the human is served, not extracted.",
  ROOT_3_THE_THIRD_FACT:
    "proof — every claim binds to receipts, consent, and verified impact; humanity is infrastructure, not fuel.",
};

// ---- scan policy ----------------------------------------------------------

const DENY_DIRS = new Set([
  ".git",
  "node_modules",
  ".ssh",
  ".gnupg",
  ".aws",
  ".config",
  ".cache",
  "target",
  "dist",
  "build",
  ".next",
  ".venv",
  "venv",
  "__pycache__",
]);

const SECRET_TOKENS = [
  ".env",
  "id_rsa",
  "id_ed25519",
  "seed",
  "seed-phrase",
  "mnemonic",
  "wallet",
  "private_key",
  "credential",
  "secret",
];
const SECRET_EXTS = new Set([".pem", ".key", ".keystore"]);

export function isSecretName(name) {
  const lower = name.toLowerCase();
  if (SECRET_EXTS.has(extname(lower))) return true;
  return SECRET_TOKENS.some((t) => lower.includes(t));
}

const CODE_EXTS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".rs",
  ".go",
]);
const DOC_EXTS = new Set([".md", ".txt", ".pdf", ".docx"]);
const MEDIA_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".mov",
  ".mp3",
  ".wav",
]);
const DATA_EXTS = new Set([".json", ".csv", ".jsonl", ".ndjson", ".parquet"]);
const ARCHIVE_EXTS = new Set([".zip", ".tar", ".gz", ".tgz", ".7z"]);
const CODE_MANIFESTS = new Set([
  "package.json",
  "pyproject.toml",
  "cargo.toml",
]);

export function classifyAsset(name, relPath) {
  const lower = name.toLowerCase();
  const ext = extname(lower);
  const rel = relPath.toLowerCase();
  if (CODE_MANIFESTS.has(lower) || CODE_EXTS.has(ext)) return "code";
  if (/(research|notes|paper)/.test(rel) && DOC_EXTS.has(ext))
    return "research";
  if (DOC_EXTS.has(ext)) return "docs";
  if (MEDIA_EXTS.has(ext)) return "media";
  if (DATA_EXTS.has(ext)) return "data";
  if (ARCHIVE_EXTS.has(ext)) return "archive";
  return "unknown";
}

// ---- inventory (metadata-only) -------------------------------------------

export function buildInventory({ root, maxFiles = 50000, maxDepth = 8 }) {
  const absRoot = resolve(root);
  const records = [];
  let skippedSecret = 0;
  let skippedDenied = 0;
  let skippedDotfile = 0;
  let skippedSymlink = 0;
  let truncated = false;

  const queue = [{ path: absRoot, depth: 0 }];
  while (queue.length && !truncated) {
    const cur = queue.shift();
    let entries;
    try {
      entries = readdirSync(cur.path, { withFileTypes: true });
    } catch {
      continue;
    }
    entries = entries.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (records.length >= maxFiles) {
        truncated = true;
        break;
      }
      const name = entry.name;
      const abs = join(cur.path, name);
      if (name.startsWith(".")) {
        skippedDotfile += 1;
        continue;
      }
      let st;
      try {
        st = lstatSync(abs);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) {
        skippedSymlink += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (DENY_DIRS.has(name.toLowerCase())) {
          skippedDenied += 1;
          continue;
        }
        if (cur.depth < maxDepth)
          queue.push({ path: abs, depth: cur.depth + 1 });
        const relPath = relative(absRoot, abs).split(sep).join("/");
        records.push({
          relative_path: relPath,
          basename: name,
          extension: "",
          size: 0,
          mtime_iso: st.mtime.toISOString(),
          class: "dir",
          depth: cur.depth + 1,
        });
        continue;
      }
      if (!entry.isFile()) continue;
      if (isSecretName(name)) {
        skippedSecret += 1;
        continue;
      } // never recorded
      const relPath = relative(absRoot, abs).split(sep).join("/");
      records.push({
        relative_path: relPath,
        basename: name,
        extension: extname(name).toLowerCase(),
        size: st.size,
        mtime_iso: st.mtime.toISOString(),
        class: classifyAsset(name, relPath),
        depth: cur.depth + 1,
      });
    }
  }

  const ordered = records
    .slice()
    .sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  const inventory = {
    schema: `${SCHEMA_PREFIX}_inventory.v0.1`,
    mode: "metadata_only",
    root_path_hash: sha256(absRoot),
    file_count: ordered.filter((r) => r.class !== "dir").length,
    dir_count: ordered.filter((r) => r.class === "dir").length,
    skipped_secret_count: skippedSecret,
    skipped_denied_dir_count: skippedDenied,
    skipped_dotfile_count: skippedDotfile,
    skipped_symlink_count: skippedSymlink,
    truncated,
    records: ordered,
  };
  inventory.inventory_hash = sha256(inventory.records);
  return inventory;
}

// ---- world map ------------------------------------------------------------

export function buildWorldMap(inventory) {
  const classCounts = {};
  const dirClusters = {};
  const codeByCluster = {};
  for (const r of inventory.records) {
    classCounts[r.class] = (classCounts[r.class] ?? 0) + 1;
    const top = r.relative_path.split("/")[0] || "(root)";
    if (r.class !== "dir") dirClusters[top] = (dirClusters[top] ?? 0) + 1;
    if (r.class === "code") codeByCluster[top] = (codeByCluster[top] ?? 0) + 1;
  }
  const topClusters = Object.entries(dirClusters)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([dir, count]) => ({
      dir,
      count,
      code_files: codeByCluster[dir] ?? 0,
    }));
  return {
    schema: `${SCHEMA_PREFIX}_world_map.v0.1`,
    total_files_scanned: inventory.file_count,
    skipped_secret_count: inventory.skipped_secret_count,
    skipped_denied_dir_count: inventory.skipped_denied_dir_count,
    class_counts: classCounts,
    top_project_clusters: topClusters,
    // A cluster is a likely codebase only if IT contains code — not merely
    // because code exists somewhere in the scan (the prior global check).
    likely_codebases: topClusters.filter((c) => c.code_files > 0).slice(0, 5),
    inventory_hash: inventory.inventory_hash,
  };
}

// ---- value / opportunity register ----------------------------------------

const CLASS_WEIGHT = {
  code: 5,
  research: 4,
  docs: 3,
  data: 3,
  media: 2,
  archive: 1,
  unknown: 1,
  dir: 0,
};

export function buildValueRegister(inventory, worldMap) {
  const byCluster = {};
  for (const r of inventory.records) {
    if (r.class === "dir") continue;
    const top = r.relative_path.split("/")[0] || "(root)";
    byCluster[top] = byCluster[top] || {
      cluster: top,
      count: 0,
      score: 0,
      classes: {},
    };
    byCluster[top].count += 1;
    byCluster[top].score += CLASS_WEIGHT[r.class] ?? 1;
    byCluster[top].classes[r.class] =
      (byCluster[top].classes[r.class] ?? 0) + 1;
  }
  const ranked = Object.values(byCluster).sort(
    (a, b) =>
      b.score - a.score ||
      b.count - a.count ||
      a.cluster.localeCompare(b.cluster),
  );
  const assets = ranked.slice(0, 7).map((c, i) => ({
    rank: i + 1,
    cluster: c.cluster,
    file_count: c.count,
    metadata_score: c.score,
    class_mix: c.classes,
    evidence: `metadata suggests ${c.count} files under ${c.cluster} (score ${c.score})`,
  }));
  const opportunities = ranked.slice(0, 3).map((c, i) => ({
    rank: i + 1,
    title: `Consolidate and prove the "${c.cluster}" cluster`,
    why_it_matters: `metadata suggests ${c.cluster} is among the densest local clusters (${c.count} files)`,
    evidence: `class mix ${JSON.stringify(c.classes)} (metadata only; contents not read)`,
    risk_level: "low",
    proof_gap: "contents unread; quality unverified",
    estimated_effort: c.count > 50 ? "high" : c.count > 10 ? "medium" : "low",
    suggested_next_action: `inventory the "${c.cluster}" cluster and select 1 public-safe artifact`,
    public_demo_readiness: "none",
  }));
  return {
    schema: `${SCHEMA_PREFIX}_value_register.v0.1`,
    content_read: false,
    top_assets: assets,
    top_opportunities: opportunities,
  };
}

// ---- quest ----------------------------------------------------------------

export function buildQuest(valueRegister) {
  return {
    schema: `${SCHEMA_PREFIX}_quest.v0.1`,
    recommended_quest: "Build Mumu's First Public Living Proof Package Plan",
    rationale:
      "metadata suggests strong local clusters exist but none are public-demo ready",
    candidate_clusters: valueRegister.top_assets
      .slice(0, 3)
      .map((a) => a.cluster),
    produces: [
      "local markdown action plan",
      "candidate evidence artifacts by path metadata",
      "proof gaps",
      "60-120 minute task list",
      "receipt",
    ],
  };
}

// ---- PAT-7 ----------------------------------------------------------------

export function buildPatPanel(quest) {
  const roles = [
    [
      "Cartographer",
      "maps local assets",
      `mapped clusters: ${quest.candidate_clusters.join(", ")}`,
    ],
    ["Strategist", "selects mission", `mission: ${quest.recommended_quest}`],
    [
      "Builder",
      "defines artifact plan",
      "draft the proof-package plan markdown",
    ],
    [
      "Researcher",
      "identifies evidence candidates",
      "list candidate artifacts by path metadata only",
    ],
    [
      "Auditor",
      "checks claims/proof gaps",
      "flag any content-quality claim as unproven",
    ],
    [
      "Publisher",
      "prepares safe public-package plan",
      "redaction checklist before any share",
    ],
    ["Companion", "reduces overwhelm", "one humane next step in 60-120 min"],
  ];
  return {
    schema: `${SCHEMA_PREFIX}_pat_panel.v0.1`,
    agents: roles.map(([role, duty, output]) => ({
      role,
      duty,
      output,
      quest_tied: true,
    })),
  };
}

// ---- SAT-5 passports ------------------------------------------------------

export const SAT_ROLES = [
  "Constitution Guardian",
  "Security Guardian",
  "Ihsan Guardian",
  "PoI Guardian",
  "URP Guardian",
];

export function buildSatPassports(nodeId = "mumu-node0") {
  return {
    schema: `${SCHEMA_PREFIX}_sat_passports.v0.1`,
    passports: SAT_ROLES.map((role) => ({
      sat_id: `sat:${nodeId}:${role.split(" ")[0].toLowerCase()}`,
      node_id: nodeId,
      role,
      status: "probation",
      authority_weight: 0,
      can_validate_local: true,
      can_validate_urp: false,
      can_read_private_file_content: false,
      can_override_user_private_pat: false,
      receipt_required: true,
    })),
  };
}

// ---- SAT review (boundary enforcement) -----------------------------------

export const SAFE_BOUNDARY = Object.freeze({
  network_used: false,
  wallet_used: false,
  token_minted: false,
  file_content_read: false,
  source_tree_mutated: false,
  secret_names_recorded: false,
  output_inside_scanned_root: false,
  public_claim: false,
});

export function runSatReview(boundaryFlags) {
  const violations = Object.keys(SAFE_BOUNDARY).filter(
    (k) => boundaryFlags[k] !== false,
  );
  return {
    schema: `${SCHEMA_PREFIX}_sat_review.v0.1`,
    boundary_flags: { ...boundaryFlags },
    violations,
    verdict: violations.length === 0 ? "PASS" : "BLOCK",
  };
}

// ---- local URP ------------------------------------------------------------

export function buildLocalUrp() {
  return {
    schema: `${SCHEMA_PREFIX}_local_urp.v0.1`,
    membrane: "default_deny",
    federation_active: false,
    internet_adapter_active: false,
    resource_classes: [
      "compute",
      "storage",
      "data",
      "research",
      "idea",
      "code",
      "time",
      "review",
    ],
  };
}

export function buildSharedRoots() {
  return {
    schema: `${SCHEMA_PREFIX}_shared_roots.v0.1`,
    scope: "local_only",
    patterns: [
      "witness-ready package",
      "investor one-pager",
      "repo audit mission",
      "local knowledge cleanup",
      "proof-gap closure",
      "research-to-article",
      "contribution simulator",
    ],
  };
}

// ---- covenant decision + consent -----------------------------------------

export function buildCovenantDecision(quest, inventory, now) {
  // decision_id binds ONLY stable content (quest + inventory hash) so the
  // proposal run and the consent run agree on the id regardless of wall-clock.
  const bound = {
    quest: quest.recommended_quest,
    inventory_hash: inventory.inventory_hash,
  };
  const proposal_hash = sha256(bound);
  const decision_id = proposal_hash.slice(7, 19); // 12 hex chars
  return {
    schema: `${SCHEMA_PREFIX}_decision.v0.1`,
    proposal: { ...bound, created_at_iso: now },
    proposal_hash,
    decision_id,
    expected_consent_phrase: expectedConsentPhrase(decision_id),
    action_type: "START_MUMU_NODE0_QUEST",
  };
}

export function expectedConsentPhrase(decisionId) {
  return `GO: START MUMU NODE0 QUEST ${decisionId}`;
}

export function evaluateConsent({
  consent,
  decision,
  testMode,
  autoConsentTest,
}) {
  if (testMode && autoConsentTest) {
    return {
      granted: true,
      reason: "auto_consent_test",
      phrase: decision.expected_consent_phrase,
    };
  }
  if (!consent || consent.trim() === "")
    return { granted: false, reason: "consent_required" };
  if (consent.trim() === "GO")
    return { granted: false, reason: "bare_go_rejected" };
  if (consent.trim() !== decision.expected_consent_phrase) {
    return { granted: false, reason: "consent_phrase_mismatch" };
  }
  return { granted: true, reason: "exact_phrase", phrase: consent.trim() };
}

// ---- receipt chain --------------------------------------------------------

export function makeReceipt({
  eventType,
  actor,
  input,
  output,
  boundaryFlags,
  prevHash,
  now,
}) {
  const body = {
    schema: `${SCHEMA_PREFIX}_receipt.v0.1`,
    receipt_id: sha256({ eventType, prevHash, now }).slice(7, 23),
    previous_receipt_hash: prevHash,
    event_type: eventType,
    actor,
    input_hash: sha256(input ?? null),
    output_hash: sha256(output ?? null),
    boundary_flags: { ...boundaryFlags },
    timestamp: now,
  };
  body.receipt_hash = sha256(body);
  return body;
}

// ---- PoI + dual-token previews -------------------------------------------

export function buildPoiPreview(receiptHash) {
  return {
    schema: `${SCHEMA_PREFIX}_impact_preview.v0.1`,
    simulation_only: true,
    bound_receipt_hash: receiptHash,
    scores: {
      usefulness: 0.6,
      effort: 0.4,
      quality: 0.0,
      rarity: 0.5,
      replayability: 0.9,
      privacy_safety: 1.0,
      proof_strength: 0.5,
      ecosystem_benefit: 0.4,
    },
    proof_gap: "content quality unscored (contents not read)",
    review_required: true,
  };
}

export function buildDualTokenPreview() {
  return {
    schema: `${SCHEMA_PREFIX}_dual_token_preview.v0.1`,
    simulation_only: true,
    token_minted: false,
    wallet_used: false,
    network_used: false,
    resource_credit_estimate: 0,
    impact_token_eligibility: false,
    note: "Simulation only. No token minted.",
  };
}

// ---- arg parsing ----------------------------------------------------------

export function parseArgs(argv) {
  const opts = {
    root: null,
    offline: false,
    metadataOnly: false,
    maxFiles: 50000,
    maxDepth: 8,
    testMode: false,
    autoConsentTest: false,
    consent: null,
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") opts.root = argv[++i];
    else if (a === "--offline") opts.offline = true;
    else if (a === "--metadata-only") opts.metadataOnly = true;
    else if (a === "--test-mode") opts.testMode = true;
    else if (a === "--auto-consent-test") opts.autoConsentTest = true;
    else if (a === "--consent") opts.consent = argv[++i];
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--max-files") opts.maxFiles = Number(argv[++i]);
    else if (a === "--max-depth") opts.maxDepth = Number(argv[++i]);
  }
  return opts;
}

// ---- orchestration --------------------------------------------------------

export function runMumuLoop(opts) {
  const root = opts.root;
  if (!root) {
    return {
      ok: false,
      error: "root_required",
      message:
        "Set --root (or BIZRA_MUMU_ROOT). Refusing to scan the whole home directory.",
    };
  }
  if (!opts.metadataOnly) {
    return {
      ok: false,
      error: "metadata_only_required",
      message: "This gate requires --metadata-only.",
    };
  }
  if (opts.autoConsentTest && !opts.testMode) {
    return { ok: false, error: "auto_consent_requires_test_mode" };
  }
  // Reject non-finite scan limits before walking the tree: a non-numeric
  // `--max-files foo` becomes NaN, and `records.length >= NaN` is always false,
  // so an unvalidated limit silently disables truncation (unbounded scan).
  for (const [name, value] of [
    ["max_files", opts.maxFiles],
    ["max_depth", opts.maxDepth],
  ]) {
    if (!Number.isInteger(value) || value <= 0) {
      return {
        ok: false,
        error: `invalid_${name}`,
        message: `--${name.replace("_", "-")} must be a positive integer.`,
      };
    }
  }
  const now = opts.testMode ? TEST_NOW : new Date().toISOString();
  const outDir = canonicalize(opts.out || join("artifacts", "node0", "mumu"));
  const absRoot = canonicalize(root);

  // boundary fact: output must NOT be inside the scanned root.
  // Fail closed BEFORE any write so the source tree is never mutated.
  const rel = relative(absRoot, outDir);
  const outInsideRoot =
    rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep));
  if (outInsideRoot) {
    return {
      ok: false,
      error: "output_inside_scanned_root",
      out_dir: outDir,
      root: absRoot,
    };
  }

  const dirs = [
    "canon",
    "state",
    "inventory",
    "realm",
    "opportunity",
    "quest",
    "pat",
    "sat",
    "urp",
    "covenant",
    "action",
    "receipts",
    "poi",
    "economy",
    "mobile",
    "reflection",
    "replay",
  ];
  for (const d of dirs) mkdirSync(join(outDir, d), { recursive: true });
  const write = (rel, obj) =>
    writeFileSync(
      join(outDir, rel),
      `${JSON.stringify(obj, null, 2)}\n`,
      "utf8",
    );
  const writeText = (rel, text) =>
    writeFileSync(join(outDir, rel), text, "utf8");

  const chainPath = join(outDir, "receipts", "receipt-chain.v0.1.jsonl");
  rmSync(chainPath, { force: true });
  let prevHash = null;
  const receiptHashes = [];
  const appendReceipt = (eventType, actor, input, output, boundaryFlags) => {
    const r = makeReceipt({
      eventType,
      actor,
      input,
      output,
      boundaryFlags,
      prevHash,
      now,
    });
    appendFileSync(chainPath, `${JSON.stringify(r)}\n`, "utf8");
    prevHash = r.receipt_hash;
    receiptHashes.push(r.receipt_hash);
    return r;
  };

  // ROOT CANON (Layer 0) — load + verify FIRST; fail closed if unsealed.
  const canon = loadRootCanon();
  if (!canon.ok) {
    return {
      ok: false,
      error: canon.error || "root_canon_unsealed",
      out_dir: outDir,
    };
  }
  write("canon/root-canon.v0.1.json", {
    schema: `${SCHEMA_PREFIX}_root_canon.v0.1`,
    canon_id: canon.canon_id,
    status: canon.status,
    verified: canon.verified,
    result: canon.result,
    roots: canon.roots.map((r) => ({
      id: r.id,
      title: r.title,
      role: r.role,
      sha256: r.expected_sha256,
    })),
  });
  write("canon/root-source-receipt.v0.1.json", {
    schema: `${SCHEMA_PREFIX}_root_source_receipt.v0.1`,
    canon_id: canon.canon_id,
    verified: canon.verified,
    roots: canon.roots.map((r) => ({
      id: r.id,
      path: r.path,
      expected_sha256: r.expected_sha256,
      actual_sha256: r.actual_sha256,
      sha256_ok: r.sha256_ok,
    })),
  });
  writeText("canon/root-canon-map.v0.1.md", renderRootCanonMap(canon));
  appendReceipt(
    "root_canon",
    "sat.constitution",
    canon.canon_id,
    canon.result,
    SAFE_BOUNDARY,
  );

  // network mode
  const networkMode = {
    schema: `${SCHEMA_PREFIX}_network_mode.v0.1`,
    network_mode: "GENESIS_SINGLE_NODE_ACTIVE_NETWORK",
    node_count: 1,
    external_federation_active: false,
    global_kernel_active_locally: true,
    local_urp_active: true,
    public_network_claim: false,
    token_minted: false,
    wallet_used: false,
    network_used: false,
  };
  write("state/network-mode.v0.1.json", networkMode);
  write("state/node0-manifest.v0.1.json", {
    schema: `${SCHEMA_PREFIX}_node0_manifest.v0.1`,
    node_id: "mumu-node0",
    created_at_iso: now,
    components: {
      dema: true,
      pat_agents: 7,
      sat_guardians: 5,
      local_urp: true,
    },
    network_mode: networkMode.network_mode,
    token_minted: false,
    wallet_used: false,
    network_used: false,
  });

  // inventory
  const inventory = buildInventory({
    root,
    maxFiles: opts.maxFiles,
    maxDepth: opts.maxDepth,
  });
  write("inventory/metadata-inventory.v0.1.json", inventory);
  const secretRecorded = inventory.records.some((r) =>
    isSecretName(r.basename),
  );
  const boundary = {
    ...SAFE_BOUNDARY,
    secret_names_recorded: secretRecorded,
    output_inside_scanned_root: outInsideRoot,
  };
  appendReceipt(
    "inventory",
    "dema",
    { root_hash: inventory.root_path_hash },
    { inventory_hash: inventory.inventory_hash },
    boundary,
  );

  const worldMap = buildWorldMap(inventory);
  write("realm/world-map.v0.1.json", worldMap);
  appendReceipt(
    "world_map",
    "pat.cartographer",
    inventory.inventory_hash,
    worldMap.inventory_hash,
    boundary,
  );

  const valueRegister = buildValueRegister(inventory, worldMap);
  write("opportunity/value-register.v0.1.json", valueRegister);
  appendReceipt(
    "opportunity_register",
    "pat.strategist",
    worldMap.inventory_hash,
    sha256(valueRegister),
    boundary,
  );

  const quest = buildQuest(valueRegister);
  write("quest/recommended-quest.v0.1.json", quest);
  appendReceipt(
    "quest",
    "pat.strategist",
    sha256(valueRegister),
    sha256(quest),
    boundary,
  );

  const patPanel = buildPatPanel(quest);
  write("pat/pat-panel.v0.1.json", patPanel);
  appendReceipt("pat_panel", "dema", sha256(quest), sha256(patPanel), boundary);

  const satPassports = buildSatPassports();
  write("sat/sat-passports.v0.1.json", satPassports);

  // SAT review — enforce boundary; block if unsafe
  const satReview = runSatReview(boundary);
  write("sat/sat-review.v0.1.json", satReview);
  appendReceipt(
    "sat_review",
    "sat.security",
    sha256(boundary),
    satReview.verdict,
    boundary,
  );
  if (satReview.verdict === "BLOCK") {
    return {
      ok: false,
      error: "sat_blocked",
      violations: satReview.violations,
      out_dir: outDir,
    };
  }

  write("urp/local-urp.v0.1.json", buildLocalUrp());
  write("urp/shared-roots.local.v0.1.json", buildSharedRoots());

  const decision = buildCovenantDecision(quest, inventory, now);
  write("covenant/decision.v0.1.json", decision);
  write("covenant/consent-request.v0.1.json", {
    schema: `${SCHEMA_PREFIX}_consent_request.v0.1`,
    decision_id: decision.decision_id,
    expected_consent_phrase: decision.expected_consent_phrase,
    instruction:
      'Re-run with --consent "<phrase>" to authorize action artifacts.',
  });
  appendReceipt(
    "covenant_decision",
    "sat.constitution",
    sha256(quest),
    decision.proposal_hash,
    boundary,
  );

  const consent = evaluateConsent({
    consent: opts.consent,
    decision,
    testMode: opts.testMode,
    autoConsentTest: opts.autoConsentTest,
  });
  if (!consent.granted) {
    return {
      ok: false,
      error: "consent_not_granted",
      reason: consent.reason,
      decision_id: decision.decision_id,
      expected_consent_phrase: decision.expected_consent_phrase,
      out_dir: outDir,
      receipt_chain_head: prevHash,
    };
  }

  // action artifacts (post-consent)
  writeText(
    "action/mumu-today.v0.1.md",
    renderMumuToday(worldMap, valueRegister, quest, decision, canon),
  );
  writeText(
    "action/first-public-proof-package-plan.v0.1.md",
    renderProofPackagePlan(quest, valueRegister),
  );
  const actionReceipt = appendReceipt(
    "action_artifacts",
    "pat.builder",
    decision.proposal_hash,
    sha256(quest),
    boundary,
  );

  const poi = buildPoiPreview(actionReceipt.receipt_hash);
  write("poi/impact-preview.v0.1.json", poi);
  appendReceipt(
    "poi_preview",
    "sat.poi",
    actionReceipt.receipt_hash,
    sha256(poi),
    boundary,
  );

  write("economy/dual-token-preview.v0.1.json", buildDualTokenPreview());
  write("mobile/dema-today.mobile.v0.1.json", {
    schema: `${SCHEMA_PREFIX}_mobile.v0.1`,
    mission: quest.recommended_quest,
    next_action:
      valueRegister.top_opportunities[0]?.suggested_next_action ??
      "review clusters",
    proof_gap: "contents unread; nothing public-ready yet",
    consent_needed: false,
    receipt_hash: actionReceipt.receipt_hash,
    network_used: false,
    token_minted: false,
  });

  writeText(
    "reflection/muhasabah-report.v0.1.md",
    renderMuhasabah(worldMap, quest),
  );
  appendReceipt(
    "reflection",
    "dema",
    sha256(quest),
    sha256("muhasabah"),
    boundary,
  );

  return {
    ok: true,
    out_dir: outDir,
    canon_verified: canon.verified,
    canon_result: canon.result,
    inventory_hash: inventory.inventory_hash,
    decision_id: decision.decision_id,
    receipt_chain_head: prevHash,
    receipt_count: receiptHashes.length,
    network_mode: networkMode.network_mode,
    sat_verdict: satReview.verdict,
  };
}

// ---- markdown renderers ---------------------------------------------------

function renderMumuToday(worldMap, vr, quest, decision, canon) {
  const assets = vr.top_assets
    .map(
      (a) => `${a.rank}. ${a.cluster} — ${a.file_count} files (${a.evidence})`,
    )
    .join("\n");
  const opps = vr.top_opportunities
    .map((o) => `${o.rank}. ${o.title} — ${o.why_it_matters}`)
    .join("\n");
  const rootLine = (id) => {
    const r = canon.roots.find((x) => x.id === id);
    return `${r ? r.title : id} — ${ROOT_PRINCIPLES[id]}`;
  };
  return [
    "# Dema Today — Mumu Node0",
    "",
    "## Root Alignment",
    `Root Canon: ${canon.canon_id} · ${canon.result} (3/3 sources hash-verified).`,
    `- الرسالة / The Message: ${rootLine("ROOT_1_THE_MESSAGE")}`,
    `- البذرة / The Seed: ${rootLine("ROOT_2_THE_SEED")}`,
    `- The Third Fact: ${rootLine("ROOT_3_THE_THIRD_FACT")}`,
    "- Prohibited claims: no public demo, no token, no income, no security/Shariah maturity, no content-quality (contents unread).",
    "- Ihsan guardrail: this mission is useful, safe, proof-bounded, and traceable upward to the three roots — or it does not ship.",
    "",
    "## What Dema sees",
    `Scanned ${worldMap.total_files_scanned} files (metadata only). Skipped ${worldMap.skipped_secret_count} secret-like names and ${worldMap.skipped_denied_dir_count} denied directories.`,
    "",
    "## Top 7 assets",
    assets,
    "",
    "## Top 3 opportunities",
    opps,
    "",
    `## Today's mission`,
    quest.recommended_quest,
    "",
    "## Why this mission",
    quest.rationale,
    "",
    "## 60-120 minute action plan",
    "- 0-20 min: confirm the strongest cluster from the list above",
    "- 20-80 min: draft the public-proof-package plan (paths only, no content copied)",
    "- 80-120 min: list proof gaps and one redaction checklist",
    "",
    "## Proof gaps",
    "Contents were not read. No quality, public, or economic claim is supported yet.",
    "",
    "## Do not claim yet",
    "No public demo, no token, no income, no security/Shariah maturity.",
    "",
    "## Next consent phrase",
    `\`${decision.expected_consent_phrase}\``,
    "",
  ].join("\n");
}

function renderRootCanonMap(canon) {
  const lines = [
    "# Root Canon Map — Node0 Layer 0",
    "",
    `**Canon:** ${canon.canon_id} · **Status:** ${canon.status} · **${canon.result}**`,
    "",
    "Node0 binds to the three immutable roots by sha256. Every Node0 component must trace upward to architecture and downward to these roots.",
    "",
    "| Root | Title | Role | Inherited principle | sha256 verified |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const r of canon.roots) {
    lines.push(
      `| ${r.id} | ${r.title} | ${r.role} | ${ROOT_PRINCIPLES[r.id] ?? "—"} | ${r.sha256_ok ? "yes" : "NO"} |`,
    );
  }
  lines.push("");
  lines.push(
    "Mercy (الرسالة) → Service (البذرة) → Proof (Third Fact). Without the roots, Node0 is just software.",
  );
  lines.push("");
  return lines.join("\n");
}

function renderProofPackagePlan(quest, vr) {
  const cands = vr.top_assets
    .slice(0, 3)
    .map((a) => `- ${a.cluster} (${a.file_count} files, metadata only)`)
    .join("\n");
  return [
    "# First Public Proof Package Plan v0.1",
    "",
    `**Candidate package:** ${quest.recommended_quest}`,
    "",
    "## Candidate artifacts (relative path metadata only)",
    cands,
    "",
    "## Evidence needed",
    "- one reproducible artifact",
    "- a replay/verify step",
    "- a tamper demo",
    "",
    "## Claims allowed",
    '- "this artifact exists and verifies locally"',
    "",
    "## Claims prohibited",
    "- production scale, token, income, security/Shariah maturity, content-quality (contents unread)",
    "",
    "## Redaction checklist",
    "- no private file content",
    "- no secret-like names",
    "- no personal identifiers",
    "",
    "## Demo script outline",
    "1. show inventory  2. show world map  3. show receipt chain  4. replay-verify",
    "",
    "## Next build step",
    "Pick ONE cluster and produce a single public-safe, replay-verifiable artifact.",
    "",
  ].join("\n");
}

function renderMuhasabah(worldMap, quest) {
  return [
    "# Muhasabah — Node0 Reflection",
    "",
    "## What happened",
    `Dema ran the first private closed loop over your local world (${worldMap.total_files_scanned} files, metadata only) and produced a mission, consent gate, action plan, and receipts.`,
    "",
    "## What improved",
    "You now have a navigable map and one clear next mission instead of scattered work.",
    "",
    "## What remains unproven",
    "File quality, public readiness, and any economic value — none were measured.",
    "",
    "## What Dema learned",
    "Metadata alone is enough to orient and plan, without ever reading your private content.",
    "",
    "## What should not be claimed",
    "Nothing public, nothing economic, no maturity claim.",
    "",
    "## Next quest",
    quest.recommended_quest,
    "",
    "## A message to you",
    "You worked alone for a long time. Today the system finally worked *for* you. Pick one cluster and take the next small step — that is enough.",
    "",
  ].join("\n");
}

// ---- CLI ------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.root && process.env.BIZRA_MUMU_ROOT)
    opts.root = process.env.BIZRA_MUMU_ROOT;
  const result = runMumuLoop(opts);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok)
    process.exitCode = result.error === "consent_not_granted" ? 2 : 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
