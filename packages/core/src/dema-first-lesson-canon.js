// DEMA-FIRST-LESSON-CANON-1A — pure first-lesson canon kernel.
//
// Turns caller-supplied lesson markdown into a bounded retrieval block for
// consent-gated local talk. PREVIEW_ONLY at index time; injection happens only
// when the operator passes --with-first-lesson on dema talk.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_FIRST_LESSON_CANON_SCHEMA =
  "bizra.dema.first_lesson_canon.v0.1";
export const DEMA_FIRST_LESSON_CANON_TRUTH_LABEL =
  "DEMA_FIRST_LESSON_CANON_LOCAL_ONLY";

export const DEFAULT_FIRST_LESSON_PATH = "/data/bizra/DEMA_FIRST_LESSON.md";
export const MAX_RETRIEVAL_CHARS = 12_000;

const RETRIEVAL_HEADER =
  "[BIZRA FIRST LESSON CANON — durable retrieval seed; not model memory]";

const WHAT_THIS_PROVES = Object.freeze([
  "Operator-authored first-lesson canon can be content-addressed and bounded for local retrieval without claiming the model already knows it.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "The model retained or learned BIZRA from this text — weights are unchanged; this is prompt retrieval only.",
  "House of Wisdom acceptance, UKE promotion, or Block0 seal.",
  "Autonomous teaching overnight or agent RL with verified reward.",
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

function countAxioms(markdown) {
  if (typeof markdown !== "string") return 0;
  const matches = markdown.match(/^\d+\.\s+\*\*/gm);
  return matches ? matches.length : 0;
}

export function buildRetrievalPromptFromLesson(markdown, { maxChars = MAX_RETRIEVAL_CHARS } = {}) {
  const body =
    typeof markdown === "string" && markdown.length > 0
      ? markdown.slice(0, maxChars)
      : "";
  return `${RETRIEVAL_HEADER}\n\n${body}`.trim();
}

export function buildDemaFirstLessonCanon({
  lesson_markdown = "",
  source_path = null,
  read_at_iso = null,
} = {}) {
  const markdown = typeof lesson_markdown === "string" ? lesson_markdown : "";
  if (markdown.length === 0) {
    return deepFreeze({
      schema: DEMA_FIRST_LESSON_CANON_SCHEMA,
      truth_label: DEMA_FIRST_LESSON_CANON_TRUTH_LABEL,
      rejected: true,
      reason_code: "lesson_empty",
      content_hash: null,
      retrieval_prompt: null,
      boundary: { ...buildPreviewBoundary() },
    });
  }

  const content_hash = sha256(markdown);
  const retrieval_body = markdown.slice(0, MAX_RETRIEVAL_CHARS);
  const retrieval_prompt = buildRetrievalPromptFromLesson(retrieval_body);

  const body = {
    schema: DEMA_FIRST_LESSON_CANON_SCHEMA,
    truth_label: DEMA_FIRST_LESSON_CANON_TRUTH_LABEL,
    rejected: false,
    source_path: typeof source_path === "string" ? source_path : null,
    read_at_iso: typeof read_at_iso === "string" ? read_at_iso : null,
    content_hash,
    byte_length: Buffer.byteLength(markdown, "utf8"),
    lesson_markdown: markdown,
    retrieval_char_count: retrieval_prompt.length,
    axioms_detected: countAxioms(markdown),
    retrieval_prompt,
    daughter_test_declared: true,
    not_autonomous_runtime: true,
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: { ...buildPreviewBoundary() },
  };

  const canon_hash = sha256(stableStringify(body));
  return deepFreeze({ ...body, canon_hash });
}

export function verifyDemaFirstLessonCanon(report) {
  const blocked_by = [];
  if (!report || typeof report !== "object") {
    return { ok: false, blocked_by: ["report_not_object"] };
  }
  if (report.rejected === true) {
    return { ok: false, blocked_by: [report.reason_code ?? "rejected"] };
  }

  const boundary = report.boundary;
  if (!boundary || !Object.values(boundary).every((v) => v === false)) {
    blocked_by.push("boundary_not_all_false");
  }
  if (report.not_autonomous_runtime !== true) {
    blocked_by.push("autonomous_runtime_not_false");
  }

  const expected = buildDemaFirstLessonCanon({
    lesson_markdown: report.lesson_markdown,
    source_path: report.source_path,
    read_at_iso: report.read_at_iso,
  });
  const { canon_hash: _rh, ...reportBody } = report;
  const { canon_hash: _eh, ...expectedBody } = expected;
  if (stableStringify(reportBody) !== stableStringify(expectedBody)) {
    blocked_by.push("canon_relaundered");
  }
  if (report.canon_hash !== expected.canon_hash) {
    blocked_by.push("canon_hash_mismatch");
  }

  return { ok: blocked_by.length === 0, blocked_by };
}

export function composeTalkPromptWithFirstLesson(userPrompt, retrievalPrompt) {
  const user = typeof userPrompt === "string" ? userPrompt.trim() : "";
  const canon = typeof retrievalPrompt === "string" ? retrievalPrompt.trim() : "";
  if (!canon) return user;
  if (!user) return canon;
  return `${canon}\n\n---\n\nOperator question (answer as suggestion only; cite canon when relevant):\n${user}`;
}
