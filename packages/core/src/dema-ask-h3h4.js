// DEMA-ASK-H3H4 — Sanitizer-gated ask join (First Light H3/H4).
//
// Composes existing organs only:
//   • scanUntrustedText / untrusted-corpus-sanitizer (Layer -1 hard gate)
//   • dema-verified-answer-receipt-cache-preview (source_hashes + answer_digest)
//   • optional invokeLocalLLM (injected fetch for tests; live Ollama on operator machine)
//
// Hard rule: only ALLOWED corpus text reaches the retrieval index and the prompt.
// QUARANTINED and BLOCKED files are recorded in the perimeter report and never
// appear in prompt, answer, or source_refs.

import { createHash } from "node:crypto";

import { scanUntrustedText } from "./untrusted-corpus-sanitizer-preview.js";
import {
  buildDemaVerifiedAnswerReceiptCachePreviewPayload,
  verifyDemaVerifiedAnswerReceiptCachePreview,
  DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE,
} from "./dema-verified-answer-receipt-cache-preview.js";
import {
  invokeLocalLLM,
  llmAdapterConsentPhraseFor,
} from "./llm-adapter.js";

export const DEMA_ASK_H3H4_SCHEMA = "bizra.dema.ask_h3h4.v0.1";
export const DEMA_ASK_H3H4_TRUTH_LABEL = "DEMA_ASK_H3H4_MEASURED_REPO";
export const DEMA_ASK_H3H4_GO_PHRASE = "GO: dema ask H3/H4 sanitizer-gated";

export const DEMA_ASK_H3H4_BOUNDARY_KEYS = Object.freeze([
  "execution_allowed",
  "daemon_started",
  "network_used",
  "token_minted",
  "wallet_accessed",
  "live_execution_performed",
  "file_mutation_performed",
  "model_invocation_performed",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalizeQuestion(question) {
  return String(question).trim().toLowerCase().replace(/\s+/g, " ");
}

export function demaAskH3H4Boundary({ model_invocation_performed = false } = {}) {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: Boolean(model_invocation_performed),
  });
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((t) => t.length >= 3);
}

/**
 * Classify one document. ALLOWED is the only ingestable verdict.
 * @param {{ path: string, text: string }} doc
 */
export function classifyAskDocument(doc) {
  const path = typeof doc?.path === "string" ? doc.path : "";
  const text = typeof doc?.text === "string" ? doc.text : "";
  const content_hash = `sha256:${sha256(text)}`;
  const scan = scanUntrustedText(text);
  return Object.freeze({
    path,
    content_hash,
    verdict: scan.verdict,
    ingest_allowed: scan.verdict === "ALLOWED",
    secret_count: scan.secret_count,
    injection_count: scan.injection_count,
    authority_count: scan.authority_count,
    findings: scan.findings,
    // Never return raw text for non-ALLOWED; keep redacted only for audit.
    redacted_text: scan.verdict === "ALLOWED" ? null : scan.redacted_text,
    text: scan.verdict === "ALLOWED" ? text : null,
  });
}

/**
 * Hard gate: partition docs. Only ALLOWED texts enter the index.
 * @param {Array<{ path: string, text: string }>} docs
 */
export function sanitizeAskCorpus(docs) {
  const list = Array.isArray(docs) ? docs : [];
  const classified = list.map(classifyAskDocument);
  const allowed = classified.filter((c) => c.ingest_allowed);
  const quarantined = classified.filter((c) => c.verdict === "QUARANTINED");
  const blocked = classified.filter((c) => c.verdict === "BLOCKED");
  return Object.freeze({
    classified: Object.freeze(classified.map((c) => Object.freeze({ ...c }))),
    allowed: Object.freeze(allowed.map((c) => Object.freeze({ ...c }))),
    quarantined: Object.freeze(quarantined.map((c) => Object.freeze({
      path: c.path,
      content_hash: c.content_hash,
      verdict: c.verdict,
      secret_count: c.secret_count,
    }))),
    blocked: Object.freeze(blocked.map((c) => Object.freeze({
      path: c.path,
      content_hash: c.content_hash,
      verdict: c.verdict,
    }))),
    allowed_count: allowed.length,
    quarantined_count: quarantined.length,
    blocked_count: blocked.length,
  });
}

/**
 * Deterministic lexical rank over ALLOWED documents only.
 */
export function rankAllowedSources(question, allowedDocs, topK = 5) {
  const qTokens = new Set(tokenize(question));
  const scored = (Array.isArray(allowedDocs) ? allowedDocs : [])
    .map((doc) => {
      const bodyTokens = tokenize(doc.text || "");
      let score = 0;
      for (const t of bodyTokens) {
        if (qTokens.has(t)) score += 1;
      }
      // Prefer short path basename match lightly.
      const base = String(doc.path || "").split(/[/\\]/).pop()?.toLowerCase() || "";
      for (const t of qTokens) {
        if (base.includes(t)) score += 2;
      }
      return { doc, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || String(a.doc.path).localeCompare(String(b.doc.path)));

  // If nothing scored, still return first ALLOWED docs so ask can cite ≥1 file when corpus nonempty.
  const picked =
    scored.length > 0
      ? scored.slice(0, topK).map((s) => s.doc)
      : (allowedDocs || []).slice(0, Math.max(1, Math.min(topK, (allowedDocs || []).length)));

  return Object.freeze(picked.map((d) => Object.freeze({ ...d })));
}

function excerpt(text, max = 400) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

export function buildAskPrompt(question, ranked) {
  const lines = [
    "Answer ONLY from the ALLOWED sources below. Cite each source by path.",
    "If sources are insufficient, say so. Never invent files.",
    "",
    `Question: ${String(question).trim()}`,
    "",
    "ALLOWED sources:",
  ];
  for (const doc of ranked) {
    lines.push(`--- ${doc.path} (${doc.content_hash}) ---`);
    lines.push(excerpt(doc.text, 800));
    lines.push("");
  }
  return lines.join("\n");
}

export function buildExtractiveAnswer(question, ranked) {
  if (!ranked || ranked.length === 0) {
    return "No ALLOWED sources were available after sanitizer gate. Cannot answer from corpus.";
  }
  const cites = ranked.map((d) => d.path);
  const pieces = ranked.map(
    (d) => `From ${d.path}: ${excerpt(d.text, 240)}`,
  );
  return [
    `Question: ${String(question).trim()}`,
    `Cited sources (${cites.length}): ${cites.join("; ")}`,
    ...pieces,
  ].join("\n");
}

/**
 * Assert perimeter: no quarantined/blocked raw content leaked into prompt or answer.
 * Also asserts planted secret tokens from quarantined docs are absent.
 */
export function assertAskPerimeter({ prompt, answer, corpus }) {
  const blocked_by = [];
  const forbiddenPaths = [
    ...(corpus.quarantined || []).map((q) => q.path),
    ...(corpus.blocked || []).map((b) => b.path),
  ];
  for (const p of forbiddenPaths) {
    if (p && (String(prompt).includes(p) || String(answer).includes(p))) {
      // Path citation of quarantined file is also a leak of identity into the answer path —
      // refuse: non-ALLOWED paths must not appear in prompt/answer.
      blocked_by.push(`non_allowed_path_in_surface:${p}`);
    }
  }
  // Reconstruct secret material only from original classified entries that were not ALLOWED —
  // we do not store raw text on quarantined entries in the public corpus report.
  // Callers that still hold the original docs can pass planted_tokens.
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

export function assertPlantedSecretsAbsent({ prompt, answer, planted_tokens = [] }) {
  const blocked_by = [];
  for (const token of planted_tokens) {
    if (!token) continue;
    if (String(prompt).includes(token) || String(answer).includes(token)) {
      blocked_by.push(`planted_secret_leaked:${String(token).slice(0, 8)}…`);
    }
  }
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

export function planDemaAskH3H4({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_ASK_H3H4_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") blocked_by.push("input_not_object");
  else {
    if (typeof input.question !== "string" || input.question.trim() === "") {
      blocked_by.push("missing_question");
    }
    if (!Array.isArray(input.docs)) blocked_by.push("missing_docs");
  }
  return Object.freeze({
    schema: DEMA_ASK_H3H4_SCHEMA,
    truth_label: DEMA_ASK_H3H4_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function buildTruthBody({
  question,
  prompt,
  answer,
  ranked,
  corpus,
  consent_scope,
  created_at,
  answer_mode,
  model_invocation_performed,
  llm_meta,
}) {
  const source_refs = ranked.map((d) => d.path);
  const source_hashes = ranked.map((d) => d.content_hash);
  const prompt_hash = `sha256:${sha256(prompt)}`;
  const answer_hash = `sha256:${sha256(answer)}`;
  const canonical_question = canonicalizeQuestion(question);

  const cacheInput = {
    canonical_question,
    answer,
    answer_summary: excerpt(answer, 160),
    source_refs,
    source_hashes,
    consent_scope,
    freshness_policy: { ttl_ms: 7 * 24 * 60 * 60 * 1000 },
    created_at,
  };
  // Cache builder is pure once inputs are valid; consent for cache preview is separate ontology —
  // we embed the payload shape that verifyDemaVerifiedAnswerReceiptCachePreview accepts.
  const verified_answer_cache = buildDemaVerifiedAnswerReceiptCachePreviewPayload(cacheInput);

  return {
    schema: DEMA_ASK_H3H4_SCHEMA,
    truth_label: DEMA_ASK_H3H4_TRUTH_LABEL,
    go_phrase: DEMA_ASK_H3H4_GO_PHRASE,
    question: String(question).trim(),
    canonical_question,
    consent_scope,
    answer_mode,
    prompt,
    prompt_hash,
    answer,
    answer_hash,
    source_refs: Object.freeze([...source_refs]),
    source_hashes: Object.freeze([...source_hashes]),
    sanitizer: Object.freeze({
      allowed_count: corpus.allowed_count,
      quarantined_count: corpus.quarantined_count,
      blocked_count: corpus.blocked_count,
      quarantined: corpus.quarantined,
      blocked: corpus.blocked,
      allowed_paths: Object.freeze(corpus.allowed.map((a) => a.path)),
    }),
    verified_answer_cache,
    llm_meta: llm_meta ? Object.freeze({ ...llm_meta }) : null,
    created_at,
    grants_action: false,
    authority_delta: 0,
    mint_allowed: false,
    boundary: demaAskH3H4Boundary({ model_invocation_performed }),
    what_this_proves:
      "A question was answered only from sanitizer-ALLOWED corpus text; non-ALLOWED files were excluded from index and prompt; answer and sources are content-addressed; verified-answer cache record re-verifies.",
    what_this_does_not_prove:
      "Semantic correctness of the answer, live model honesty beyond injected/local invoke gates, or that novel obfuscated secrets were caught beyond the sanitizer pattern library.",
  };
}

/**
 * Pure compose: sanitize → rank ALLOWED → prompt → answer (extractive or injected LLM) → truth record.
 */
export async function runDemaAskH3H4({
  consent,
  input,
  answer_mode = "extractive",
  top_k = 5,
  created_at,
  model,
  llm_consent,
  fetchImpl,
  ollamaBaseUrl,
  planted_tokens = [],
} = {}) {
  const plan = planDemaAskH3H4({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_ASK_H3H4_SCHEMA,
      truth_label: DEMA_ASK_H3H4_TRUTH_LABEL,
      blocked_by: plan.blocked_by,
      receipt: null,
    });
  }

  const question = input.question;
  const consent_scope =
    typeof input.consent_scope === "string" && input.consent_scope
      ? input.consent_scope
      : "local_ask_scope";
  const when =
    typeof created_at === "number" && Number.isFinite(created_at)
      ? created_at
      : 0;

  const corpus = sanitizeAskCorpus(input.docs);
  const ranked = rankAllowedSources(question, corpus.allowed, top_k);
  const prompt = buildAskPrompt(question, ranked);

  let answer;
  let model_invocation_performed = false;
  let llm_meta = null;

  if (answer_mode === "llm_invoke") {
    const modelSafe = typeof model === "string" ? model : "";
    // invokeLocalLLM returns response_text_preview only — capture full body via wrap.
    let capturedResponse = null;
    const baseFetch = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
    const wrappingFetch = async (...args) => {
      const res = await baseFetch(...args);
      const raw = typeof res?.json === "function" ? await res.json() : null;
      if (raw && typeof raw.response === "string") capturedResponse = raw.response;
      return {
        ok: Boolean(res?.ok),
        status: res?.status ?? 0,
        statusText: res?.statusText ?? "",
        json: async () => raw,
      };
    };
    const result = await invokeLocalLLM({
      model: modelSafe,
      prompt,
      consentPhrase:
        typeof llm_consent === "string"
          ? llm_consent
          : llmAdapterConsentPhraseFor(modelSafe),
      fetchImpl: wrappingFetch,
      ollamaBaseUrl,
    });
    model_invocation_performed = result?.invocation_status === "completed";
    llm_meta = {
      invocation_status: result?.invocation_status ?? null,
      error_reason: result?.error_reason ?? null,
      model: modelSafe,
    };
    if (result?.invocation_status !== "completed" || typeof capturedResponse !== "string") {
      return Object.freeze({
        ok: false,
        schema: DEMA_ASK_H3H4_SCHEMA,
        truth_label: DEMA_ASK_H3H4_TRUTH_LABEL,
        blocked_by: Object.freeze([
          `llm_invoke_failed:${result?.error_reason || "missing_captured_response"}`,
        ]),
        receipt: null,
        corpus,
        prompt,
        prompt_hash: `sha256:${sha256(prompt)}`,
        llm_meta,
      });
    }
    answer = capturedResponse;
  } else {
    answer = buildExtractiveAnswer(question, ranked);
  }

  if (ranked.length === 0) {
    return Object.freeze({
      ok: false,
      schema: DEMA_ASK_H3H4_SCHEMA,
      truth_label: DEMA_ASK_H3H4_TRUTH_LABEL,
      blocked_by: Object.freeze(["no_allowed_sources"]),
      receipt: null,
      corpus,
      prompt,
      answer,
    });
  }

  const perimeter = assertAskPerimeter({ prompt, answer, corpus });
  const secrets = assertPlantedSecretsAbsent({ prompt, answer, planted_tokens });
  if (!perimeter.ok || !secrets.ok) {
    return Object.freeze({
      ok: false,
      schema: DEMA_ASK_H3H4_SCHEMA,
      truth_label: DEMA_ASK_H3H4_TRUTH_LABEL,
      blocked_by: Object.freeze([...perimeter.blocked_by, ...secrets.blocked_by]),
      receipt: null,
      corpus,
      prompt,
      answer,
    });
  }

  const body = buildTruthBody({
    question,
    prompt,
    answer,
    ranked,
    corpus,
    consent_scope,
    created_at: when,
    answer_mode: answer_mode === "llm_invoke" ? "llm_invoke" : "extractive",
    model_invocation_performed,
    llm_meta,
  });
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  const receipt = Object.freeze({ ...body, content_hash });

  return Object.freeze({
    ok: true,
    schema: DEMA_ASK_H3H4_SCHEMA,
    truth_label: DEMA_ASK_H3H4_TRUTH_LABEL,
    blocked_by: Object.freeze([]),
    receipt,
    corpus,
    verified_answer_cache_go: DEMA_VERIFIED_ANSWER_RECEIPT_CACHE_PREVIEW_GO_PHRASE,
  });
}

export function verifyDemaAskH3H4Receipt(receipt, { disk_source_hashes = null, planted_tokens = [] } = {}) {
  if (!receipt || typeof receipt !== "object") {
    return Object.freeze({
      ok: false,
      blocked_by: Object.freeze(["receipt_not_object"]),
    });
  }
  const blocked_by = [];
  const { content_hash, ...body } = receipt;
  if (content_hash !== `sha256:${sha256(stableStringify(body))}`) {
    blocked_by.push("content_hash_mismatch");
  }
  if (receipt.schema !== DEMA_ASK_H3H4_SCHEMA) blocked_by.push("schema_mismatch");
  if (receipt.truth_label !== DEMA_ASK_H3H4_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (receipt.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (receipt.grants_action !== false) blocked_by.push("grants_action_true");
  if (receipt.mint_allowed !== false) blocked_by.push("mint_allowed_true");
  if (receipt.answer_hash !== `sha256:${sha256(receipt.answer || "")}`) {
    blocked_by.push("answer_hash_mismatch");
  }
  if (receipt.prompt_hash !== `sha256:${sha256(receipt.prompt || "")}`) {
    blocked_by.push("prompt_hash_mismatch");
  }
  if (
    !Array.isArray(receipt.source_refs) ||
    !Array.isArray(receipt.source_hashes) ||
    receipt.source_refs.length === 0 ||
    receipt.source_refs.length !== receipt.source_hashes.length
  ) {
    blocked_by.push("source_refs_hashes_invalid");
  }
  if (disk_source_hashes && typeof disk_source_hashes === "object") {
    for (let i = 0; i < (receipt.source_refs || []).length; i++) {
      const ref = receipt.source_refs[i];
      const expected = disk_source_hashes[ref];
      if (!expected) blocked_by.push(`missing_disk_hash:${ref}`);
      else if (expected !== receipt.source_hashes[i]) {
        blocked_by.push(`source_hash_disk_mismatch:${ref}`);
      }
    }
  }
  const cacheV = verifyDemaVerifiedAnswerReceiptCachePreview(receipt.verified_answer_cache);
  if (!cacheV.ok) {
    blocked_by.push(
      ...(cacheV.blocked_by || ["verified_answer_cache_invalid"]).map(
        (c) => `cache:${c}`,
      ),
    );
  } else {
    // Bind cache digests to ask receipt fields.
    if (receipt.verified_answer_cache?.answer_digest !== receipt.answer_hash) {
      blocked_by.push("cache_answer_digest_mismatch");
    }
  }
  const secrets = assertPlantedSecretsAbsent({
    prompt: receipt.prompt,
    answer: receipt.answer,
    planted_tokens,
  });
  if (!secrets.ok) blocked_by.push(...secrets.blocked_by);

  // Non-ALLOWED paths must not appear in prompt/answer.
  const nonAllowed = [
    ...(receipt.sanitizer?.quarantined || []).map((q) => q.path),
    ...(receipt.sanitizer?.blocked || []).map((b) => b.path),
  ];
  for (const p of nonAllowed) {
    if (p && (String(receipt.prompt).includes(p) || String(receipt.answer).includes(p))) {
      blocked_by.push(`non_allowed_path_in_surface:${p}`);
    }
  }

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_ASK_H3H4_SCHEMA,
    truth_label: DEMA_ASK_H3H4_TRUTH_LABEL,
    blocked_by: Object.freeze(blocked_by),
  });
}
