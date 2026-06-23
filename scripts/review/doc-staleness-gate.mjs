#!/usr/bin/env node
// DOC-STALENESS-GATE-1A — read-only review check.
//
// Fails if a CURATED navigation-entrypoint doc contains a BROKEN internal link:
// an inline relative markdown link `](path)` whose target file/dir does not exist.
// It GUARDS navigation integrity for those entrypoints and stops NEW broken links
// from landing.
//
// What it does NOT do (claim bound to the weakest path): it does not by itself
// resolve the audit's `docs/public/third-fact-v0.1.md` gap. That target is
// unpublished by design (PDF exists; markdown not yet written) and tracked as
// DESIGNED_NOT_LIVE in the Rosetta Constitution ledger; here it is recorded as a
// tracked-pending target and the gate self-cleans when it is published. Dangling
// references in `.js` doc_anchors (e.g. canon-glossary.js), ADRs, and reference-
// style/HTML links are OUT of scope — only inline `](path)` links in the curated
// entrypoint docs are scanned. This gate is a forward guard, not a backfill.
//
// Known-pending escape hatch (tracked, not silent): a referenced-but-not-yet-
// published target may be listed in KNOWN_PENDING_TARGETS with a REASON. The gate
// SELF-CLEANS — if a pending target ever appears on disk, the gate fails so the
// stale allowlist entry is removed (mirrors the kernel-purity stale_allowlist
// discipline). A broken link that is NOT pending fails immediately.
//
// Date staleness is REPORT-ONLY by design: "Last verified/refreshed/updated"
// headers are surfaced for visibility but never fail the gate. A wall-clock
// hard-fail would red CI on time-passage alone with no code change (a time-bomb);
// enforcing a freshness threshold is deferred to a future slice with an explicit
// as-of date passed in, not read from the clock.
//
// Scope (a bound carries its scope): only CURATED_LINK_DOCS are scanned — the
// high-traffic entrypoints a reader actually follows. Frozen historical docs
// (ADRs, audits, archive, specs) are intentionally out of scope; their links are
// point-in-time records, not live navigation. External (http/mailto/tel) links
// and pure `#anchor` links are not checked.
//
// Discovery (from repo root):  node scripts/review/doc-staleness-gate.mjs
import { readFileSync, existsSync } from "node:fs";
import { join, isAbsolute, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");

export const SCHEMA = "bizra.dema.review.doc_staleness.v0.1";

// Navigation entrypoints scanned for broken internal links. Extend as new
// entrypoints appear; a renamed curated doc is surfaced as `missing_docs`.
export const CURATED_LINK_DOCS = Object.freeze([
  "docs/00_START_HERE.md",
  "docs/THIRD_FACT_CURRENT_STATE_DELTA.md",
  "docs/ROADMAP.md",
  "docs/QUICKSTART.md",
  "README.md",
]);

// Referenced-but-not-yet-published internal targets, deliberately allowed to
// dangle WHILE tracked elsewhere. Each MUST carry a non-empty reason. Keys are
// repo-relative, forward-slash. The gate fails if a key here already exists on
// disk (stale entry) or if its reason is empty.
export const KNOWN_PENDING_TARGETS = Object.freeze({
  "docs/public/third-fact-v0.1.md":
    "DESIGNED_NOT_LIVE — canonical Third Fact markdown (PDF exists) not yet published; tracked in docs/02-architecture/NODE0_ROSETTA_CONSTITUTION_v0_1.md ledger + docs/audits/NODE0_DEMA_NORTHSTAR_AUDIT_1A.md",
});

const STALENESS_LINE =
  /Last\s+(?:verified|refreshed|updated)\s*:?\s*(\d{4}-\d{2}-\d{2})/gi;

function repoRel(repoRoot, full) {
  let rel = normalize(full).slice(normalize(repoRoot).length);
  return rel.replace(/^[/\\]+/, "").split("\\").join("/");
}

// Extract relative internal link targets from markdown. Skips external links
// (http/https/mailto/tel), pure `#anchor` links, and `<placeholder>` targets.
export function extractRelativeLinks(markdown) {
  const out = [];
  for (const m of markdown.matchAll(/\]\(([^)]+)\)/g)) {
    let raw = m[1].trim();
    if (!raw || /^(https?:|mailto:|tel:|#)/i.test(raw)) continue;
    // strip an optional CommonMark link title:  ](path "Title")  /  ](path 'Title')
    raw = raw.replace(/\s+["'][^"']*["']\s*$/, "").trim();
    const target = raw.split("#")[0].split("?")[0].trim();
    if (!target || /^<.*>$/.test(target)) continue;
    out.push(target);
  }
  return out;
}

export function checkDocLinks({
  repoRoot = REPO_ROOT,
  curatedDocs = CURATED_LINK_DOCS,
  knownPending = KNOWN_PENDING_TARGETS,
} = {}) {
  const broken_links = [];
  const pending_satisfied = [];
  const missing_docs = [];
  const invalid_pending = [];

  for (const [rel, reason] of Object.entries(knownPending)) {
    if (typeof reason !== "string" || reason.trim().length === 0) {
      invalid_pending.push(rel);
    }
  }

  for (const docRel of curatedDocs) {
    const docFull = join(repoRoot, docRel);
    if (!existsSync(docFull)) {
      missing_docs.push(docRel);
      continue;
    }
    const md = readFileSync(docFull, "utf8");
    for (const link of extractRelativeLinks(md)) {
      const full = isAbsolute(link)
        ? join(repoRoot, link)
        : join(dirname(docFull), link);
      if (existsSync(full)) continue; // file OR directory both count as resolved
      const target = repoRel(repoRoot, full);
      if (Object.prototype.hasOwnProperty.call(knownPending, target)) {
        pending_satisfied.push({ doc: docRel, target });
      } else {
        broken_links.push({ doc: docRel, link, target });
      }
    }
  }

  // self-clean: a pending target that now exists is a stale allowlist entry.
  const stale_pending = [];
  for (const rel of Object.keys(knownPending)) {
    if (existsSync(join(repoRoot, rel))) stale_pending.push(rel);
  }

  const ok =
    broken_links.length === 0 &&
    missing_docs.length === 0 &&
    stale_pending.length === 0 &&
    invalid_pending.length === 0;

  return {
    schema: SCHEMA,
    ok,
    broken_links,
    missing_docs,
    pending_satisfied,
    stale_pending,
    invalid_pending,
  };
}

// Report-only: surface "Last verified/refreshed/updated: YYYY-MM-DD" headers.
// Never affects the gate verdict (no wall-clock dependency).
export function collectStalenessHeaders({
  repoRoot = REPO_ROOT,
  curatedDocs = CURATED_LINK_DOCS,
} = {}) {
  const out = [];
  for (const docRel of curatedDocs) {
    const docFull = join(repoRoot, docRel);
    if (!existsSync(docFull)) continue;
    const md = readFileSync(docFull, "utf8");
    for (const m of md.matchAll(STALENESS_LINE)) {
      out.push({ doc: docRel, date: m[1] });
    }
  }
  return out;
}

const isMain =
  process.argv[1] && process.argv[1].endsWith("doc-staleness-gate.mjs");

if (isMain) {
  const result = checkDocLinks();
  const staleness = collectStalenessHeaders();

  for (const p of result.pending_satisfied) {
    console.log(`[doc-staleness-gate] pending (allowed): ${p.doc} → ${p.target}`);
  }
  for (const s of staleness) {
    console.log(`[doc-staleness-gate] header date (report-only): ${s.doc} → ${s.date}`);
  }

  if (!result.ok) {
    console.error("[doc-staleness-gate] FAIL");
    for (const b of result.broken_links) {
      console.error(`  broken_link: ${b.doc} → ${b.link} (missing: ${b.target})`);
    }
    for (const d of result.missing_docs) {
      console.error(`  missing_curated_doc: ${d}`);
    }
    for (const s of result.stale_pending) {
      console.error(`  stale_pending (target now exists — remove from allowlist): ${s}`);
    }
    for (const p of result.invalid_pending) {
      console.error(`  invalid_pending (reason required): ${p}`);
    }
    process.exit(1);
  }

  console.log(
    `[doc-staleness-gate] OK — ${result.pending_satisfied.length} pending allowed, 0 broken across ${CURATED_LINK_DOCS.length} curated docs. boundary: read-only · no network · no exec`,
  );
}
