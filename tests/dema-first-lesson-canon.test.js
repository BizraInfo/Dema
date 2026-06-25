// DEMA-FIRST-LESSON-CANON-1A — pure-kernel tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256, stableStringify } from "../packages/consent/src/consent-common.js";
import {
  buildDemaFirstLessonCanon,
  verifyDemaFirstLessonCanon,
  composeTalkPromptWithFirstLesson,
  buildRetrievalPromptFromLesson,
  DEMA_FIRST_LESSON_CANON_SCHEMA,
  DEMA_FIRST_LESSON_CANON_TRUTH_LABEL,
  MAX_RETRIEVAL_CHARS,
} from "../packages/core/src/dema-first-lesson-canon.js";

const LESSON = `# Dema — Your First Lesson

1. **Prove, don't assert** — trust comes from re-derivation.
2. **Proof has a floor** — receipts cannot bind intent.
`;

test("build: non-empty lesson → hash, retrieval, verify ok, boundary all-false", () => {
  const r = buildDemaFirstLessonCanon({
    lesson_markdown: LESSON,
    source_path: "/tmp/DEMA_FIRST_LESSON.md",
    read_at_iso: "2026-06-25T00:00:00.000Z",
  });
  assert.equal(r.rejected, false);
  assert.equal(r.schema, DEMA_FIRST_LESSON_CANON_SCHEMA);
  assert.equal(r.truth_label, DEMA_FIRST_LESSON_CANON_TRUTH_LABEL);
  assert.equal(r.content_hash, sha256(LESSON));
  assert.ok(r.retrieval_prompt.includes("BIZRA FIRST LESSON CANON"));
  assert.ok(r.axioms_detected >= 2);
  for (const v of Object.values(r.boundary)) assert.equal(v, false);
  assert.equal(verifyDemaFirstLessonCanon(r).ok, true);
});

test("build: empty lesson → rejected lesson_empty", () => {
  const r = buildDemaFirstLessonCanon({ lesson_markdown: "" });
  assert.equal(r.rejected, true);
  assert.equal(r.reason_code, "lesson_empty");
  assert.equal(verifyDemaFirstLessonCanon(r).ok, false);
});

test("verify: forged canon_hash → canon_hash_mismatch", () => {
  const r = buildDemaFirstLessonCanon({ lesson_markdown: LESSON });
  const forged = { ...r, canon_hash: "deadbeef" };
  const v = verifyDemaFirstLessonCanon(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("canon_hash_mismatch"));
});

test("verify: relaundered body → canon_relaundered", () => {
  const r = buildDemaFirstLessonCanon({ lesson_markdown: LESSON });
  const forged = { ...r, axioms_detected: 99 };
  const v = verifyDemaFirstLessonCanon(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("canon_relaundered"));
});

test("retrieval bounded at MAX_RETRIEVAL_CHARS", () => {
  const huge = "x".repeat(MAX_RETRIEVAL_CHARS + 500);
  const prompt = buildRetrievalPromptFromLesson(huge);
  assert.ok(prompt.length <= MAX_RETRIEVAL_CHARS + 80);
});

test("composeTalkPromptWithFirstLesson: canon prefix + operator question", () => {
  const canon = buildRetrievalPromptFromLesson(LESSON);
  const out = composeTalkPromptWithFirstLesson("What is SAT in BIZRA?", canon);
  assert.match(out, /BIZRA FIRST LESSON CANON/);
  assert.match(out, /What is SAT in BIZRA\?/);
  assert.match(out, /Operator question/);
});

test("stableStringify round-trip for verify", () => {
  const r = buildDemaFirstLessonCanon({
    lesson_markdown: LESSON,
    source_path: "/data/bizra/DEMA_FIRST_LESSON.md",
    read_at_iso: "2026-06-25T00:00:00.000Z",
  });
  const parsed = JSON.parse(stableStringify(r));
  assert.equal(verifyDemaFirstLessonCanon(parsed).ok, true);
});
