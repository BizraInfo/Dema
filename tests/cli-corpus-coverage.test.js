// In-process coverage for apps/cli/src/commands/corpus.js refuse + sanitize paths.
// Spawned dema children do not attribute under --experimental-test-coverage.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cmd_corpus } from "../apps/cli/src/commands/corpus.js";

function withExitThrow(t, expectedCode) {
  process.exitCode = 0;
  const signal = new Error("test CLI exit");
  t.mock.method(process, "exit", (code) => {
    assert.equal(code, expectedCode);
    throw signal;
  });
  t.after(() => {
    process.exitCode = 0;
  });
  return signal;
}

test("dema corpus without subcommand → usage exit 1", async (t) => {
  const err = [];
  t.mock.method(process.stderr, "write", (chunk) => {
    err.push(String(chunk));
    return true;
  });
  const signal = withExitThrow(t, 1);
  await assert.rejects(cmd_corpus({ argv: ["corpus"] }), (e) => e === signal);
  assert.match(err.join(""), /corpus sanitize/);
});

test("dema corpus sanitize without --file → exit 1", async (t) => {
  const err = [];
  t.mock.method(process.stderr, "write", (chunk) => {
    err.push(String(chunk));
    return true;
  });
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_corpus({ argv: ["corpus", "sanitize", "--json"] }),
    (e) => e === signal,
  );
  assert.match(err.join(""), /--file/);
});

test("dema corpus sanitize relative --file → exit 1", async (t) => {
  const err = [];
  t.mock.method(process.stderr, "write", (chunk) => {
    err.push(String(chunk));
    return true;
  });
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_corpus({ argv: ["corpus", "sanitize", "--file", "relative.txt"] }),
    (e) => e === signal,
  );
  assert.match(err.join(""), /absolute path/);
});

test("dema corpus sanitize missing abs file --json → refused", async (t) => {
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_corpus({
      argv: ["corpus", "sanitize", "--file", "/tmp/dema-corpus-missing-no-such-file", "--json"],
    }),
    (e) => e === signal,
  );
  const body = JSON.parse(out[0]);
  assert.equal(body.refused, true);
  assert.equal(body.reason_code, "file_not_found");
});

test("dema corpus sanitize clean abs file --json → ALLOWED preview", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "dema-corpus-sanitize-"));
  const file = join(dir, "clean.txt");
  await writeFile(file, "hello founder work notes\n", "utf8");
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 0);
  await assert.rejects(
    cmd_corpus({ argv: ["corpus", "sanitize", "--file", file, "--json"] }),
    (e) => e === signal,
  );
  const body = JSON.parse(out[0]);
  assert.equal(body.preview_only, true);
  assert.equal(body.verdict, "ALLOWED");
  assert.equal(body.ingest_performed, false);
  assert.equal(body.mint_allowed, false);
});

test("dema corpus index without consent → exit 1", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "dema-corpus-index-"));
  const file = join(dir, "notes.txt");
  await writeFile(file, "founder note\n", "utf8");
  const out = [];
  t.mock.method(console, "log", (line) => out.push(String(line)));
  const signal = withExitThrow(t, 1);
  await assert.rejects(
    cmd_corpus({
      argv: ["corpus", "index", "--file", file],
    }),
    (e) => e === signal,
  );
  assert.match(out.join("\n"), /REFUSED|consent|GO:/i);
});
