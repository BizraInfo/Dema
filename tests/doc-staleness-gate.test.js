// DOC-STALENESS-GATE-1A — proves a read-only gate that fails on a BROKEN internal
// link in a curated navigation-entrypoint doc (a relative markdown link whose
// target file/dir is absent), closing the dangling-reference defect class the
// northstar audit found. A referenced-but-unpublished target may be tracked in
// KNOWN_PENDING_TARGETS (with a reason); the allowlist self-cleans if the target
// ever appears. Date staleness is report-only (no wall-clock fail).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  checkDocLinks,
  collectStalenessHeaders,
  extractRelativeLinks,
  SCHEMA,
  CURATED_LINK_DOCS,
  KNOWN_PENDING_TARGETS,
} from "../scripts/review/doc-staleness-gate.mjs";

const SCRIPT = fileURLToPath(
  new URL("../scripts/review/doc-staleness-gate.mjs", import.meta.url),
);
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

function withRepo(files, fn) {
  const root = mkdtempSync(join(tmpdir(), "dsg-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("contract: stable schema; curated list frozen + non-empty; pending entries carry reasons", () => {
  assert.equal(SCHEMA, "bizra.dema.review.doc_staleness.v0.1");
  assert.equal(Object.isFrozen(CURATED_LINK_DOCS), true);
  assert.ok(CURATED_LINK_DOCS.length > 0);
  assert.equal(Object.isFrozen(KNOWN_PENDING_TARGETS), true);
  for (const [k, reason] of Object.entries(KNOWN_PENDING_TARGETS)) {
    assert.equal(typeof reason, "string");
    assert.ok(reason.trim().length > 0, `pending ${k} needs a reason`);
  }
});

test("extractRelativeLinks: relative only — skips http/mailto/anchor/placeholder", () => {
  const md = [
    "[a](docs/a.md) [b](./b.md) [c](../c.md)",
    "[ext](https://x.y) [mail](mailto:a@b) [anc](#section) [ph](<placeholder>)",
    "[withanchor](docs/d.md#part)",
  ].join("\n");
  const links = extractRelativeLinks(md);
  // the #anchor is stripped — the contract is the relative FILE target to resolve
  assert.deepEqual(links.sort(), ["../c.md", "./b.md", "docs/a.md", "docs/d.md"].sort());
});

test("extractRelativeLinks: strips an optional CommonMark link title", () => {
  assert.deepEqual(extractRelativeLinks('[a](public/x.md "Title")'), ["public/x.md"]);
  assert.deepEqual(extractRelativeLinks("[a](./y.md 'T')"), ["./y.md"]);
});

test("REAL REPO: gate passes — every curated link resolves, third-fact tracked as pending", () => {
  const r = checkDocLinks({ repoRoot: REPO_ROOT });
  assert.equal(r.ok, true, JSON.stringify({ broken: r.broken_links, missing: r.missing_docs, stale: r.stale_pending }));
  assert.deepEqual(r.broken_links, []);
  assert.deepEqual(r.missing_docs, []);
  assert.deepEqual(r.stale_pending, []);
  assert.ok(
    r.pending_satisfied.some((p) => p.target === "docs/public/third-fact-v0.1.md"),
    "third-fact recognized as a pending (allowed) target",
  );
});

test("fails closed on a broken link that is NOT pending", () => {
  withRepo(
    { "docs/x.md": "see [gone](./missing-file.md) and [ok](./there.md)", "docs/there.md": "hi" },
    (root) => {
      const r = checkDocLinks({ repoRoot: root, curatedDocs: ["docs/x.md"], knownPending: {} });
      assert.equal(r.ok, false);
      assert.equal(r.broken_links.length, 1);
      assert.equal(r.broken_links[0].target, "docs/missing-file.md");
    },
  );
});

test("a relative link to an existing DIRECTORY resolves (not broken)", () => {
  withRepo(
    { "docs/x.md": "browse the [adrs](./06-adr/)", "docs/06-adr/ADR-1.md": "adr" },
    (root) => {
      const r = checkDocLinks({ repoRoot: root, curatedDocs: ["docs/x.md"], knownPending: {} });
      assert.equal(r.ok, true);
      assert.deepEqual(r.broken_links, []);
    },
  );
});

test("known-pending target is allowed while absent, and SELF-CLEANS when it appears", () => {
  const pending = { "docs/pending.md": "tracked: not yet published" };
  // absent → allowed
  withRepo({ "docs/x.md": "[p](./pending.md)" }, (root) => {
    const r = checkDocLinks({ repoRoot: root, curatedDocs: ["docs/x.md"], knownPending: pending });
    assert.equal(r.ok, true);
    assert.equal(r.pending_satisfied.length, 1);
  });
  // now exists → stale allowlist entry, fail closed
  withRepo({ "docs/x.md": "[p](./pending.md)", "docs/pending.md": "now here" }, (root) => {
    const r = checkDocLinks({ repoRoot: root, curatedDocs: ["docs/x.md"], knownPending: pending });
    assert.equal(r.ok, false);
    assert.deepEqual(r.stale_pending, ["docs/pending.md"]);
  });
});

test("a pending entry with an empty reason fails closed", () => {
  withRepo({ "docs/x.md": "[p](./pending.md)" }, (root) => {
    const r = checkDocLinks({
      repoRoot: root,
      curatedDocs: ["docs/x.md"],
      knownPending: { "docs/pending.md": "  " },
    });
    assert.equal(r.ok, false);
    assert.deepEqual(r.invalid_pending, ["docs/pending.md"]);
  });
});

test("a missing curated doc fails closed (rename-rot guard)", () => {
  withRepo({ "docs/present.md": "ok" }, (root) => {
    const r = checkDocLinks({ repoRoot: root, curatedDocs: ["docs/renamed-away.md"], knownPending: {} });
    assert.equal(r.ok, false);
    assert.deepEqual(r.missing_docs, ["docs/renamed-away.md"]);
  });
});

test("staleness header collection is report-only and does not affect the verdict", () => {
  withRepo(
    { "docs/x.md": "Last verified: 2020-01-01\n\nbody [ok](./y.md)", "docs/y.md": "y" },
    (root) => {
      const headers = collectStalenessHeaders({ repoRoot: root, curatedDocs: ["docs/x.md"] });
      assert.equal(headers.length, 1);
      assert.equal(headers[0].date, "2020-01-01");
      // an ancient date does NOT fail the gate (no wall-clock time-bomb)
      const r = checkDocLinks({ repoRoot: root, curatedDocs: ["docs/x.md"], knownPending: {} });
      assert.equal(r.ok, true);
    },
  );
});

test("gate script runs clean against the real repo (exit 0)", () => {
  const out = execFileSync("node", [SCRIPT], { encoding: "utf8" });
  assert.match(out, /\[doc-staleness-gate\] OK/);
});
