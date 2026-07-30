// NODE0-FIRST-LIGHT-0A — deterministic corpus/retrieval/receipt kernels.
//
// Pure over caller-supplied documents and model output. Filesystem reads,
// localhost invocation, consent ceremony, and persistence live in the CLI
// adapter. Raw source excerpts are admitted to the prompt but never persisted
// in the index, receipt, or Proof Card.
import { createHash } from "node:crypto";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { canonicalizeJsonV1 } from "../../canon/src/canonical-json-v1.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "./boundary-schema.js";
export const FIRST_LIGHT_INDEX_SCHEMA = "bizra.node0.first_light_index.v0.1";
export const FIRST_LIGHT_RETRIEVAL_SCHEMA = "bizra.node0.first_light_retrieval.v0.1";
export const FIRST_LIGHT_PROMPT_SCHEMA = "bizra.node0.first_light_prompt.v0.1";
export const FIRST_LIGHT_RECEIPT_SCHEMA = "bizra.node0.first_light_receipt.v0.1";
export const FIRST_LIGHT_PROOF_CARD_SCHEMA = "bizra.dema.first_light_proof_card.v0.1";
const TRUTH_LABEL = "MEASURED_LOCAL";
const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for",
  "from", "how", "in", "is", "it", "of", "on", "or", "that", "the", "their",
  "they", "this", "to", "what", "when", "where", "which", "who", "why", "with",
]);
function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}
function hashText(value) {
  return `sha256:${createHash("sha256").update(String(value), "utf8").digest("hex")}`;
}
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function tokenize(value) {
  return (
    String(value)
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}._-]*/gu) ?? []
  );
}
function queryTerms(question) {
  return [...new Set(tokenize(question).filter((term) => !STOP_WORDS.has(term)))].sort();
}
function termCounts(value) {
  const counts = new Map();
  for (const term of tokenize(value)) counts.set(term, (counts.get(term) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
function validRelativePath(value) {
  const candidate = text(value).replaceAll("\\", "/");
  if (!candidate || candidate.startsWith("/") || candidate.includes("\0")) return null;
  const parts = candidate.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;
  return parts.join("/");
}
function rejected(reason, blockedBy = [reason]) {
  return deepFreeze({
    rejected: true,
    reason_code: reason,
    blocked_by: [...new Set(blockedBy)],
  });
}
function verifyIndex(index) {
  const blocked = [];
  if (!index || typeof index !== "object") return ["index_not_object"];
  if (index.schema !== FIRST_LIGHT_INDEX_SCHEMA) blocked.push("index_schema_mismatch");
  if (index.truth_label !== TRUTH_LABEL) blocked.push("index_truth_label_mismatch");
  if (!Array.isArray(index.files) || index.files.length === 0) blocked.push("index_files_missing");
  if (index.file_count !== index.files?.length) blocked.push("index_file_count_mismatch");
  for (const file of index.files ?? []) {
    if (!validRelativePath(file.relative_path)) blocked.push("index_path_invalid");
    if (!HASH_RE.test(file.source_sha256 ?? "")) blocked.push("index_source_hash_invalid");
    if (!Number.isInteger(file.token_count) || file.token_count < 0) {
      blocked.push("index_token_count_invalid");
    }
    if (Object.hasOwn(file, "terms")) blocked.push("index_terms_present");
    if (Object.hasOwn(file, "text")) blocked.push("index_raw_text_present");
  }
  const { index_hash, ...body } = index;
  try {
    if (sha256CanonicalJsonV1(body) !== index_hash) blocked.push("index_hash_mismatch");
  } catch {
    blocked.push("index_not_canonicalizable");
  }
  return [...new Set(blocked)];
}
export function verifyFirstLightIndex(index) {
  const blocked = verifyIndex(index);
  return deepFreeze({ verified: blocked.length === 0, blocked_by: blocked,
    index_hash: blocked.length === 0 ? index.index_hash : null });
}
export function buildFirstLightIndex({ mission_id, root_path, documents, indexed_at_iso } = {}) {
  if (!text(mission_id)) return rejected("mission_id_required");
  if (!text(root_path) || !String(root_path).startsWith("/")) {
    return rejected("absolute_root_required");
  }
  if (!Array.isArray(documents) || documents.length === 0) {
    return rejected("documents_required");
  }
  if (!text(indexed_at_iso) || Number.isNaN(Date.parse(indexed_at_iso))) {
    return rejected("indexed_at_invalid");
  }

  const files = [];
  const seen = new Set();
  for (const document of documents) {
    const relative_path = validRelativePath(document?.relative_path);
    if (!relative_path) return rejected("document_path_invalid");
    if (seen.has(relative_path)) return rejected("document_path_duplicate");
    if (typeof document?.text !== "string") return rejected("document_text_required");
    seen.add(relative_path);
    files.push({
      relative_path,
      source_sha256: hashText(document.text),
      size_bytes: Buffer.byteLength(document.text, "utf8"),
      line_count: document.text.split("\n").length,
      token_count: tokenize(document.text).length,
    });
  }
  files.sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  const body = {
    schema: FIRST_LIGHT_INDEX_SCHEMA,
    truth_label: TRUTH_LABEL,
    rejected: false,
    mission_id: text(mission_id),
    root_path: text(root_path),
    indexed_at_iso,
    file_count: files.length,
    files,
    raw_source_text_persisted: false,
  };
  return deepFreeze({ ...body, index_hash: sha256CanonicalJsonV1(body) });
}
function excerptFor(textValue, terms) {
  const lines = textValue.split("\n");
  let bestIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const counts = termCounts(lines[i]);
    const score = terms.reduce((sum, term) => sum + (counts[term] ?? 0), 0);
    if (score > bestScore) {
      bestIndex = i;
      bestScore = score;
    }
  }
  const start = Math.max(0, bestIndex - 2);
  const end = Math.min(lines.length, bestIndex + 3);
  const excerpt = lines.slice(start, end).join("\n");
  return {
    excerpt,
    line_start: start + 1,
    line_end: end,
    excerpt_sha256: hashText(excerpt),
  };
}
function retrievalSourceRecord(source) {
  const {
    excerpt: _rawExcerpt,
    ...record
  } = source;
  return record;
}
function retrievalBody({ indexHash, questionHash, sources }) {
  return {
    schema: FIRST_LIGHT_RETRIEVAL_SCHEMA,
    index_hash: indexHash,
    question_hash: questionHash,
    sources: sources.map(retrievalSourceRecord),
  };
}
export function retrieveFirstLightSources({ index, documents, question, max_sources = 4 } = {}) {
  const indexBlocked = verifyIndex(index);
  if (indexBlocked.length) return rejected("index_invalid", indexBlocked);
  if (!text(question)) return rejected("question_required");
  if (!Array.isArray(documents)) return rejected("documents_required");
  if (!Number.isInteger(max_sources) || max_sources < 1 || max_sources > 8) {
    return rejected("max_sources_invalid");
  }

  const byPath = new Map(documents.map((doc) => [validRelativePath(doc?.relative_path), doc]));
  const terms = queryTerms(question);
  if (terms.length === 0) return rejected("question_has_no_search_terms");
  const ranked = [];
  for (const file of index.files) {
    const document = byPath.get(file.relative_path);
    if (!document || typeof document.text !== "string") {
      return rejected("indexed_document_missing", [`indexed_document_missing:${file.relative_path}`]);
    }
    if (hashText(document.text) !== file.source_sha256) {
      return rejected("indexed_document_hash_mismatch", [`indexed_document_hash_mismatch:${file.relative_path}`]);
    }
    const counts = termCounts(document.text);
    const matchedTerms = terms.filter((term) => (counts[term] ?? 0) > 0);
    const contentScore = matchedTerms.reduce(
      (sum, term) => sum + Math.min(counts[term], 8),
      0,
    );
    const pathTerms = new Set(tokenize(file.relative_path));
    const pathScore = matchedTerms.reduce(
      (sum, term) => sum + (pathTerms.has(term) ? 4 : 0),
      0,
    );
    const score = contentScore + pathScore;
    if (score === 0) continue;
    ranked.push({
      relative_path: file.relative_path,
      source_sha256: file.source_sha256,
      size_bytes: file.size_bytes,
      score,
      matched_terms: matchedTerms.sort(),
      ...excerptFor(document.text, terms),
    });
  }
  ranked.sort((a, b) => b.score - a.score || a.relative_path.localeCompare(b.relative_path));
  const sources = ranked.slice(0, max_sources);
  if (sources.length === 0) return rejected("no_relevant_sources");
  const questionHash = hashText(text(question));
  const body = retrievalBody({
    indexHash: index.index_hash,
    questionHash,
    sources,
  });
  return deepFreeze({
    ...body,
    rejected: false,
    query_terms: terms,
    sources,
    retrieval_hash: sha256CanonicalJsonV1(body),
  });
}
export function buildFirstLightPrompt({ question, retrieval } = {}) {
  if (!text(question)) return rejected("question_required");
  if (retrieval?.rejected !== false || !Array.isArray(retrieval.sources)) {
    return rejected("retrieval_invalid");
  }
  const sourceBlocks = retrieval.sources.map(
    (source, index) =>
      `[S${index + 1}]\npath: ${source.relative_path}\nsha256: ${source.source_sha256}\nlines: ${source.line_start}-${source.line_end}\n${source.excerpt}`,
  );
  const prompt_text = [
    "You are Dema answering from a bounded local corpus.",
    "Use only the supplied source excerpts. If they conflict, name the conflict.",
    "Give a concise answer and cite source IDs like [S1]. Do not claim runtime capability.",
    "",
    `QUESTION:\n${text(question)}`,
    "",
    "SOURCES:",
    sourceBlocks.join("\n\n"),
  ].join("\n");
  return deepFreeze({
    schema: FIRST_LIGHT_PROMPT_SCHEMA,
    rejected: false,
    template_version: "first-light-grounded-v1",
    prompt_text,
    prompt_hash: hashText(prompt_text),
  });
}

export function composeFirstLightAnswer({ response_text, retrieval } = {}) {
  const response = text(response_text);
  if (!response || retrieval?.rejected !== false) return "";
  const citations = retrieval.sources.map(
    (source) =>
      `- ${source.relative_path}#L${source.line_start}-L${source.line_end} · ${source.source_sha256}`,
  );
  return `${response}\n\nVerified local sources:\n${citations.join("\n")}`;
}
export function verifyFirstLightResponseCitations({ response_text, retrieval } = {}) {
  const citedSourceIds = [
    ...new Set([...String(response_text ?? "").matchAll(/\[S([0-9]+)\]/g)]
      .map(([, number]) => `S${number}`)),
  ];
  const allowed = new Set((retrieval?.sources ?? []).map((_, index) => `S${index + 1}`));
  const blocked = citedSourceIds.length === 0
    ? ["model_response_citation_missing"]
    : citedSourceIds
        .filter((sourceId) => !allowed.has(sourceId))
        .map((sourceId) => `model_response_citation_unknown:${sourceId}`);
  return deepFreeze({
    verified: blocked.length === 0,
    blocked_by: blocked,
    cited_source_ids: citedSourceIds,
  });
}
function firstLightBoundary() {
  const trueKeys = new Set([
    "filesystem_write_performed",
    "network_used",
    "runtime_execution_performed",
    "model_loaded",
    "model_invocation_performed",
    "prompt_executed",
    "raw_corpus_scan_performed",
    "raw_data_included",
    "consent_collected",
    "content_read",
  ]);
  return Object.fromEntries(
    PREVIEW_BOUNDARY_CANONICAL_KEYS.map((key) => [key, trueKeys.has(key)]),
  );
}
function boundaryMatches(value) {
  try {
    return canonicalizeJsonV1(value) === canonicalizeJsonV1(firstLightBoundary());
  } catch {
    return false;
  }
}
export function buildFirstLightReceipt({
  mission_id,
  root_path,
  root_set_hash,
  consent,
  index,
  question,
  retrieval,
  prompt,
  model_result,
  answer_text,
  observed_at_iso,
} = {}) {
  const blocked = [];
  blocked.push(...verifyIndex(index));
  if (!text(mission_id) || mission_id !== index?.mission_id) blocked.push("mission_id_mismatch");
  if (!text(root_path) || root_path !== index?.root_path) blocked.push("root_path_mismatch");
  if (!HASH_RE.test(root_set_hash ?? "")) blocked.push("root_set_hash_invalid");
  if (consent?.verified !== true) blocked.push("consent_not_verified");
  if (!text(consent?.action_class)) blocked.push("consent_action_class_missing");
  if (!HASH_RE.test(consent?.consent_context_hash ?? "")) blocked.push("consent_context_hash_invalid");
  if (!HASH_RE.test(consent?.phrase_hash ?? "")) blocked.push("consent_phrase_hash_invalid");
  if (!text(question)) blocked.push("question_required");
  if (retrieval?.rejected !== false || !HASH_RE.test(retrieval?.retrieval_hash ?? "")) {
    blocked.push("retrieval_invalid");
  }
  if (prompt?.rejected !== false || !HASH_RE.test(prompt?.prompt_hash ?? "")) blocked.push("prompt_invalid");
  if (!text(model_result?.response_text)) blocked.push("model_response_required");
  blocked.push(...verifyFirstLightResponseCitations({
    response_text: model_result?.response_text,
    retrieval,
  }).blocked_by);
  if (!text(answer_text)) blocked.push("answer_required");
  if (
    answer_text !==
    composeFirstLightAnswer({
      response_text: model_result?.response_text,
      retrieval,
    })
  ) {
    blocked.push("answer_derivation_mismatch");
  }
  if (!text(observed_at_iso) || Number.isNaN(Date.parse(observed_at_iso))) blocked.push("observed_at_invalid");
  if (blocked.length) return rejected("first_light_receipt_blocked", blocked);

  const sources = retrieval.sources.map(retrievalSourceRecord);
  const body = {
    schema: FIRST_LIGHT_RECEIPT_SCHEMA,
    truth_label: TRUTH_LABEL,
    rejected: false,
    canonicalization: "bizra.canonical_json.v1",
    mission_id,
    observed_at_iso,
    root: { path: root_path, root_set_hash },
    consent: {
      verified: true,
      action_class: consent.action_class,
      consent_context_hash: consent.consent_context_hash,
      phrase_hash: consent.phrase_hash,
    },
    index: {
      index_hash: index.index_hash,
      file_count: index.file_count,
      indexed_at_iso: index.indexed_at_iso,
    },
    question: { text: text(question), sha256: hashText(text(question)) },
    retrieval: {
      schema: FIRST_LIGHT_RETRIEVAL_SCHEMA,
      retrieval_hash: retrieval.retrieval_hash,
      sources,
    },
    prompt: {
      template_version: prompt.template_version,
      prompt_hash: prompt.prompt_hash,
    },
    model: {
      provider: text(model_result.provider),
      model: text(model_result.model),
      target_endpoint: text(model_result.target_endpoint),
      raw_response_text: text(model_result.response_text),
      raw_response_sha256: hashText(text(model_result.response_text)),
    },
    answer: { text: answer_text, sha256: hashText(answer_text) },
    boundary: firstLightBoundary(),
    what_this_proves:
      "One consent-bound local folder question used hash-bound source excerpts, a localhost model, an exact persisted answer, and a content-addressed receipt.",
    what_this_does_not_prove:
      "The answer is a grounded model suggestion, not independent semantic truth, runtime autonomy, federation, token mint, or public proof.",
  };
  return deepFreeze({ ...body, receipt_id: sha256CanonicalJsonV1(body) });
}
export function verifyFirstLightReceipt(receipt) {
  const blocked = [];
  if (!receipt || typeof receipt !== "object") {
    return deepFreeze({ verified: false, blocked_by: ["receipt_not_object"] });
  }
  if (receipt.schema !== FIRST_LIGHT_RECEIPT_SCHEMA) blocked.push("receipt_schema_mismatch");
  if (receipt.truth_label !== TRUTH_LABEL) blocked.push("receipt_truth_label_mismatch");
  if (receipt.rejected !== false) blocked.push("receipt_rejected");
  if (hashText(receipt.question?.text ?? "") !== receipt.question?.sha256) blocked.push("question_hash_mismatch");
  if (hashText(receipt.model?.raw_response_text ?? "") !== receipt.model?.raw_response_sha256) {
    blocked.push("raw_response_hash_mismatch");
  }
  if (hashText(receipt.answer?.text ?? "") !== receipt.answer?.sha256) blocked.push("answer_hash_mismatch");
  const sources = receipt.retrieval?.sources;
  if (!Array.isArray(sources) || sources.length === 0) blocked.push("receipt_sources_missing");
  for (const source of sources ?? []) {
    if (!validRelativePath(source.relative_path)) blocked.push("receipt_source_path_invalid");
    if (!HASH_RE.test(source.source_sha256 ?? "")) blocked.push("receipt_source_hash_invalid");
    if (!HASH_RE.test(source.excerpt_sha256 ?? "")) blocked.push("receipt_excerpt_hash_invalid");
    if (Object.hasOwn(source, "excerpt")) blocked.push("receipt_raw_excerpt_present");
  }
  blocked.push(...verifyFirstLightResponseCitations({
    response_text: receipt.model?.raw_response_text,
    retrieval: { sources: sources ?? [] },
  }).blocked_by);
  const derivedAnswer = composeFirstLightAnswer({
    response_text: receipt.model?.raw_response_text,
    retrieval: { rejected: false, sources: sources ?? [] },
  });
  if (derivedAnswer !== receipt.answer?.text) {
    blocked.push("answer_derivation_mismatch");
  }
  const retrievalCore = {
    schema: FIRST_LIGHT_RETRIEVAL_SCHEMA,
    index_hash: receipt.index?.index_hash,
    question_hash: receipt.question?.sha256,
    sources: sources ?? [],
  };
  try {
    if (sha256CanonicalJsonV1(retrievalCore) !== receipt.retrieval?.retrieval_hash) {
      blocked.push("retrieval_hash_mismatch");
    }
  } catch {
    blocked.push("retrieval_not_canonicalizable");
  }
  if (!boundaryMatches(receipt.boundary)) blocked.push("boundary_mismatch");
  const { receipt_id, ...body } = receipt;
  try {
    if (sha256CanonicalJsonV1(body) !== receipt_id) blocked.push("receipt_id_mismatch");
  } catch {
    blocked.push("receipt_not_canonicalizable");
  }
  return deepFreeze({
    verified: blocked.length === 0,
    blocked_by: [...new Set(blocked)],
    receipt_id: blocked.length === 0 ? receipt.receipt_id : null,
  });
}
export function buildFirstLightProofCard(receipt) {
  const verified = verifyFirstLightReceipt(receipt);
  if (!verified.verified) return rejected("receipt_invalid", verified.blocked_by);
  const body = {
    schema: FIRST_LIGHT_PROOF_CARD_SCHEMA,
    truth_label: TRUTH_LABEL,
    rejected: false,
    verification_state: "RECEIPT_DERIVED",
    mission_id: receipt.mission_id,
    receipt_id: receipt.receipt_id,
    observed_at_iso: receipt.observed_at_iso,
    question: receipt.question,
    answer: receipt.answer,
    sources: receipt.retrieval.sources,
    model: {
      provider: receipt.model.provider,
      model: receipt.model.model,
      target_endpoint: receipt.model.target_endpoint,
    },
    limitation:
      "Receipt relationships verify; source bytes require the persisted-state verifier; model meaning remains a suggestion and is not independently semantically verified.",
  };
  return deepFreeze({ ...body, proof_card_hash: sha256CanonicalJsonV1(body) });
}
export function verifyFirstLightProofCard({ card, receipt } = {}) {
  const receiptVerdict = verifyFirstLightReceipt(receipt);
  const blocked = [];
  if (!receiptVerdict.verified) blocked.push("receipt_invalid");
  const expected = receiptVerdict.verified ? buildFirstLightProofCard(receipt) : null;
  try {
    if (!card || canonicalizeJsonV1(card) !== canonicalizeJsonV1(expected)) {
      blocked.push("proof_card_mismatch");
    }
  } catch {
    blocked.push("proof_card_not_canonicalizable");
  }
  return deepFreeze({
    verified: blocked.length === 0,
    blocked_by: [...new Set(blocked)],
  });
}
