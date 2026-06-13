import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCorpusGate,
  findingKey,
  corpusFiles,
  scanCorpus,
  verifyCitations,
  scanCitations,
  registerIds,
} from "../scripts/claims/claim-corpus-gate.mjs";

const f = (file, kind, text) => ({ file, kind, text });

test("evaluateCorpusGate passes when current matches baseline", () => {
  const baseline = [f("README.md", "economic", "mints IMP rewards")];
  const current = [f("README.md", "economic", "mints IMP rewards")];
  const r = evaluateCorpusGate({ current, baseline });
  assert.equal(r.ok, true);
  assert.deepEqual(r.added, []);
});

test("evaluateCorpusGate fails closed on a NEW finding not in baseline", () => {
  const baseline = [f("README.md", "economic", "mints IMP rewards")];
  const current = [
    f("README.md", "economic", "mints IMP rewards"),
    f("docs/X.md", "first_or_only", "the world's first SDO"),
  ];
  const r = evaluateCorpusGate({ current, baseline });
  assert.equal(r.ok, false);
  assert.equal(r.added.length, 1);
  assert.equal(r.added[0].file, "docs/X.md");
});

test("evaluateCorpusGate allows ratchet-down: resolved baseline finding is ok", () => {
  const baseline = [
    f("README.md", "economic", "mints IMP rewards"),
    f("docs/Y.md", "benchmark", "99.94% F1"),
  ];
  const current = [f("README.md", "economic", "mints IMP rewards")];
  const r = evaluateCorpusGate({ current, baseline });
  assert.equal(r.ok, true);
  assert.equal(r.removed.length, 1);
  assert.equal(r.removed[0].file, "docs/Y.md");
});

test("findingKey is line-independent (file+kind+text identity)", () => {
  // Same claim text, different line numbers, must collide.
  const a = {
    file: "README.md",
    line: 10,
    kind: "economic",
    text: " mints IMP ",
  };
  const b = {
    file: "README.md",
    line: 99,
    kind: "economic",
    text: "mints IMP",
  };
  assert.equal(findingKey(a), findingKey(b));
});

test("corpusFiles includes README and top-level docs, returns absolute paths", () => {
  const files = corpusFiles();
  assert.ok(files.length > 1, "expected README + docs");
  assert.ok(
    files.some((p) => p.endsWith("/README.md")),
    "README.md must be in scope",
  );
  assert.ok(
    files.every((p) => p.startsWith("/")),
    "paths must be absolute",
  );
});

test("verifyCitations passes when every cited id resolves to the register", () => {
  const r = verifyCitations({
    citations: [{ file: "a.md", line: 1, id: "C-TOKEN-ECONOMY" }],
    validIds: new Set(["C-TOKEN-ECONOMY", "C-FEDERATION"]),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.dangling, []);
});

test("verifyCitations fails closed on a dangling citation (no knowledge object)", () => {
  const r = verifyCitations({
    citations: [
      { file: "a.md", line: 1, id: "C-TOKEN-ECONOMY" },
      { file: "b.md", line: 7, id: "C-GHOST" },
    ],
    validIds: new Set(["C-TOKEN-ECONOMY"]),
  });
  assert.equal(r.ok, false);
  assert.equal(r.dangling.length, 1);
  assert.equal(r.dangling[0].id, "C-GHOST");
});

test("registerIds returns the real register claim ids", () => {
  const ids = registerIds();
  assert.ok(ids.has("C-TOKEN-ECONOMY"), "register must expose C-TOKEN-ECONOMY");
  assert.ok(ids.size >= 5, "register should have several claims");
});

test("scanCitations finds [claim:ID] citations across given files", () => {
  // README has no citations yet → empty is fine; shape must be correct.
  const cites = scanCitations(corpusFiles());
  assert.ok(Array.isArray(cites));
  for (const c of cites.slice(0, 3)) {
    assert.ok(typeof c.id === "string" && typeof c.file === "string");
  }
});

test("scanCorpus returns findings with relative file, kind, text shape", () => {
  const findings = scanCorpus(corpusFiles());
  for (const x of findings.slice(0, 5)) {
    assert.ok(
      typeof x.file === "string" && !x.file.startsWith("/"),
      "file is repo-relative",
    );
    assert.ok(typeof x.kind === "string" && x.kind.length > 0);
    assert.ok("text" in x);
  }
});
