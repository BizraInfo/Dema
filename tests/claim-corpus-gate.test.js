import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCorpusGate,
  findingKey,
  corpusFiles,
  scanCorpus,
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
