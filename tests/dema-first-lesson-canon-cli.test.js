// DEMA-FIRST-LESSON-CANON-1A — gatherer + canon CLI tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveFirstLessonPath,
  readFirstLessonMarkdown,
} from "../apps/cli/src/commands/first-lesson-gatherer.js";
import {
  buildDemaFirstLessonCanon,
  composeTalkPromptWithFirstLesson,
} from "../packages/core/src/dema-first-lesson-canon.js";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

const SAMPLE = `# Lesson\n\n1. **Daughter Test** — would you subject your family to this output?\n`;

const { DEMA_TALK_MODEL: _m, DEMA_TALK_PROVIDER: _p, ...CLEAN_ENV } = process.env;

function dema(args, env = {}) {
  return execFileSync("node", [BIN, ...args], {
    encoding: "utf8",
    env: { ...CLEAN_ENV, ...env },
  });
}

test("resolveFirstLessonPath: explicit abs wins; relative throws", () => {
  assert.equal(
    resolveFirstLessonPath({ explicitPath: "/data/bizra/DEMA_FIRST_LESSON.md" }),
    "/data/bizra/DEMA_FIRST_LESSON.md",
  );
  assert.throws(
    () => resolveFirstLessonPath({ explicitPath: "relative.md" }),
    /absolute path/i,
  );
});

test("resolveFirstLessonPath: env DEMA_FIRST_LESSON_PATH", () => {
  assert.equal(
    resolveFirstLessonPath({ env: { DEMA_FIRST_LESSON_PATH: "/tmp/custom.md" } }),
    "/tmp/custom.md",
  );
});

test("readFirstLessonMarkdown: injected read succeeds", () => {
  const read = readFirstLessonMarkdown({
    path: "/tmp/x.md",
    readFileImpl: () => SAMPLE,
  });
  assert.equal(read.ok, true);
  assert.equal(read.lesson_markdown, SAMPLE);
});

test("gatherer → kernel: injected lesson builds verified canon", () => {
  const read = readFirstLessonMarkdown({
    path: "/tmp/x.md",
    readFileImpl: () => SAMPLE,
  });
  const canon = buildDemaFirstLessonCanon({
    lesson_markdown: read.lesson_markdown,
    source_path: read.source_path,
    read_at_iso: "2026-06-25T00:00:00.000Z",
  });
  assert.equal(canon.rejected, false);
  assert.equal(canon.axioms_detected, 1);
});

test("dema canon first-lesson --json with DEMA_FIRST_LESSON_PATH", () => {
  const dir = mkdtempSync(join(tmpdir(), "dema-lesson-"));
  const lessonPath = join(dir, "DEMA_FIRST_LESSON.md");
  writeFileSync(lessonPath, SAMPLE, "utf8");
  const out = dema(["canon", "first-lesson", "--json"], {
    DEMA_FIRST_LESSON_PATH: lessonPath,
  });
  const j = JSON.parse(out);
  assert.equal(j.rejected, false);
  assert.equal(j.verify.ok, true);
  assert.ok(j.retrieval_prompt.includes("Daughter Test"));
});

test("dema talk --with-first-lesson preview lengthens prompt (no model call)", () => {
  const dir = mkdtempSync(join(tmpdir(), "dema-lesson-"));
  const lessonPath = join(dir, "DEMA_FIRST_LESSON.md");
  writeFileSync(lessonPath, SAMPLE, "utf8");
  const base = JSON.parse(
    dema(["talk", "what is SAT?", "--json"], { DEMA_FIRST_LESSON_PATH: lessonPath }),
  );
  const withCanon = JSON.parse(
    dema(["talk", "what is SAT?", "--with-first-lesson", "--json"], {
      DEMA_FIRST_LESSON_PATH: lessonPath,
    }),
  );
  assert.equal(base.model_invoked, false);
  assert.equal(withCanon.model_invoked, false);
  assert.ok(withCanon.prompt_length_chars > base.prompt_length_chars);
  const composed = composeTalkPromptWithFirstLesson(
    "what is SAT?",
    buildDemaFirstLessonCanon({
      lesson_markdown: SAMPLE,
      source_path: lessonPath,
      read_at_iso: "2026-06-25T00:00:00.000Z",
    }).retrieval_prompt,
  );
  assert.equal(withCanon.prompt_length_chars, composed.length);
});

test("dema canon first-lesson missing file → exit error", () => {
  assert.throws(
    () =>
      dema(["canon", "first-lesson"], {
        DEMA_FIRST_LESSON_PATH: "/tmp/does-not-exist-lesson-xyz.md",
      }),
    (err) => err.status !== 0,
  );
});
