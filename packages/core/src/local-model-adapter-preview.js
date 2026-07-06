// LOCAL-MODEL-ADAPTER-PREVIEW-1A — Preview-only local model adapter contract: binds an injected discovery report into a content-addressed adapter envelope (model always null, boundary all-false) that refuses live-invocation, wallet, mint, and URP fields — no model invocation, no network.
//
// RED-FIRST kernel scaffold. `plan` and `build...Payload` are real (consent gate +
// content addressing are universal); the slice-specific `verify` / `run` bodies
// throw `not_implemented` until you build them. Turn the mirrored test green
// before any commit — do not weaken the test to match an empty kernel.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.

import { createHash } from "node:crypto";

export const LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA = "bizra.dema.local_model_adapter_preview.v0.1";
export const LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL = "LOCAL_MODEL_ADAPTER_PREVIEW_MEASURED_REPO";
export const LOCAL_MODEL_ADAPTER_PREVIEW_GO_PHRASE = "GO: build preview-only local model adapter";

// Contract vocabulary — frozen so a mutated copy can never pass list equality.
export const LOCAL_MODEL_ADAPTER_PREVIEW_RUNTIMES = Object.freeze([
  "ollama",
  "llama_cpp",
  "lm_studio",
  "unknown",
]);

export const LOCAL_MODEL_ADAPTER_PREVIEW_ALLOWED_USE = Object.freeze([
  "summarize explicit operator-provided text",
  "draft proposals",
  "classify diagnostics",
  "generate candidate patches only after explicit scope",
]);

export const LOCAL_MODEL_ADAPTER_PREVIEW_FORBIDDEN_USE = Object.freeze([
  "autonomous file mutation",
  "silent receipt writing",
  "wallet access",
  "minting",
  "URP live claim",
  "cross-node federation",
  "public-safe claim",
]);

export const LOCAL_MODEL_ADAPTER_PREVIEW_CONSENT_REQUIRED_FOR = Object.freeze([
  "model invocation",
  "reading files",
  "writing files",
  "patch generation",
  "receipt creation",
]);

// Exact key names that must never appear ANYWHERE in an adapter envelope or its
// input. Exact-name match only — attestation keys like `private_key_loaded`
// remain legal boundary vocabulary.
export const LOCAL_MODEL_ADAPTER_PREVIEW_FORBIDDEN_FIELDS = Object.freeze([
  "private_key",
  "wallet",
  "wallet_address",
  "mint",
  "mint_authority",
  "urp_live",
  "api_key",
  "access_token",
  "seed_phrase",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function collectForbiddenFields(value, found = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenFields(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (LOCAL_MODEL_ADAPTER_PREVIEW_FORBIDDEN_FIELDS.includes(key)) found.add(key);
      collectForbiddenFields(value[key], found);
    }
  }
  return found;
}

function sameStringList(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}

// Runtime derivation: first reachable provider in priority order; anything else
// is "unknown". Never guesses — an empty or malformed discovery is "unknown".
const RUNTIME_BY_PROVIDER = Object.freeze({ ollama: "ollama", llamacpp: "llama_cpp", lm_studio: "lm_studio" });

export function deriveLocalModelAdapterRuntime(providerDiscovery) {
  if (!providerDiscovery || typeof providerDiscovery !== "object") return "unknown";
  for (const provider of Object.keys(RUNTIME_BY_PROVIDER)) {
    if (providerDiscovery[provider]?.reachable === true) return RUNTIME_BY_PROVIDER[provider];
  }
  return "unknown";
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function localModelAdapterPreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
// Absence of a block is NEVER validation: push a block until you can POSITIVELY
// prove the input is well-formed for this slice's ontology.
export function planLocalModelAdapterPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== LOCAL_MODEL_ADAPTER_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    const discovery = input.discovery;
    if (!discovery || typeof discovery !== "object") {
      blocked_by.push("discovery_missing");
    } else {
      const pd = discovery.provider_discovery;
      if (!pd || typeof pd !== "object" || Object.keys(pd).length === 0) {
        blocked_by.push("provider_discovery_missing");
      } else if (!Object.values(pd).every((p) => p && typeof p === "object" && typeof p.reachable === "boolean")) {
        blocked_by.push("provider_entry_invalid");
      }
      if (!Array.isArray(discovery.models) || !discovery.models.every((m) => typeof m === "string")) {
        blocked_by.push("models_not_string_array");
      }
    }
    for (const name of collectForbiddenFields(input)) {
      blocked_by.push(`forbidden_field_present:${name}`);
    }
  }
  return Object.freeze({
    schema: LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA,
    truth_label: LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload. Reshape `body` to carry the real fields
// this slice attests; the content_hash binds the whole body.
export function buildLocalModelAdapterPreviewPayload(input) {
  const discovery = input && typeof input === "object" ? input.discovery : undefined;
  const models = Array.isArray(discovery?.models)
    ? discovery.models.filter((m) => typeof m === "string")
    : [];
  const body = {
    schema: LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA,
    truth_label: LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    runtime: deriveLocalModelAdapterRuntime(discovery?.provider_discovery),
    // model stays null in the preview contract: the adapter never auto-selects
    // or invokes a model; selection is a future consent-gated act.
    model: null,
    models_visible: models,
    execution_authority: false,
    operator_files_accessed: false,
    allowed_use: LOCAL_MODEL_ADAPTER_PREVIEW_ALLOWED_USE,
    forbidden_use: LOCAL_MODEL_ADAPTER_PREVIEW_FORBIDDEN_USE,
    consent_required_for: LOCAL_MODEL_ADAPTER_PREVIEW_CONSENT_REQUIRED_FOR,
    boundary: localModelAdapterPreviewBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier (REQUIRED by the core-kernels rule).
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then add the slice-specific field checks. Body-bound, not seed-bound: a forged
// field with a recomputed hash must still fail because verify binds the WHOLE body
// against an independent anchor (e.g. a signature or an externally supplied hash).
export function verifyLocalModelAdapterPreview(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, ...body } = payload;
  if (typeof content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(content_hash)) {
    blocked_by.push("content_hash_missing");
  } else if (`sha256:${sha256(stableStringify(body))}` !== content_hash) {
    blocked_by.push("content_hash_mismatch");
  }
  if (body.schema !== LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (body.truth_label !== LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (body.mode !== "preview_only") blocked_by.push("mode_not_preview_only");
  if (body.model !== null) blocked_by.push("model_not_null");
  if (!LOCAL_MODEL_ADAPTER_PREVIEW_RUNTIMES.includes(body.runtime)) blocked_by.push("runtime_invalid");
  if (body.execution_authority !== false) blocked_by.push("execution_authority_claimed");
  if (body.operator_files_accessed !== false) blocked_by.push("operator_files_claimed");

  // Boundary must deep-equal the canonical all-false set: exact key set, every
  // value strictly false. `{}` or a subset must FAIL (vacuous all-false trap).
  const canonical = localModelAdapterPreviewBoundary();
  const canonicalKeys = Object.keys(canonical).sort();
  const boundaryKeys = body.boundary && typeof body.boundary === "object" ? Object.keys(body.boundary).sort() : [];
  if (
    boundaryKeys.length !== canonicalKeys.length ||
    !canonicalKeys.every((k, i) => boundaryKeys[i] === k && body.boundary[k] === false)
  ) {
    blocked_by.push("boundary_not_canonical_all_false");
  }

  if (!sameStringList(body.allowed_use, [...LOCAL_MODEL_ADAPTER_PREVIEW_ALLOWED_USE])) {
    blocked_by.push("allowed_use_mismatch");
  }
  if (!sameStringList(body.forbidden_use, [...LOCAL_MODEL_ADAPTER_PREVIEW_FORBIDDEN_USE])) {
    blocked_by.push("forbidden_use_mismatch");
  }
  if (!sameStringList(body.consent_required_for, [...LOCAL_MODEL_ADAPTER_PREVIEW_CONSENT_REQUIRED_FOR])) {
    blocked_by.push("consent_required_for_mismatch");
  }
  for (const name of collectForbiddenFields(body)) {
    blocked_by.push(`forbidden_field_present:${name}`);
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    schema: LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA,
    truth_label: LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL,
    content_hash: typeof content_hash === "string" ? content_hash : null,
  });
}

// Orchestrator the review gate consumes. Run plan -> build -> verify -> tamper-reject
// and return the proof envelope: { ok, schema, truth_label, content_hash, boundary,
// blocked_by }. Push a named block on any failure so the gate fails closed.
export function runLocalModelAdapterPreview({ consent, input } = {}) {
  const boundary = localModelAdapterPreviewBoundary();
  const refuse = (codes) =>
    Object.freeze({
      ok: false,
      schema: LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA,
      truth_label: LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL,
      blocked_by: Object.freeze([...codes]),
      boundary,
    });

  const plan = planLocalModelAdapterPreview({ consent, input });
  if (!plan.eligible) return refuse(plan.blocked_by);

  const payload = buildLocalModelAdapterPreviewPayload(input);
  const verdict = verifyLocalModelAdapterPreview(payload);
  if (!verdict.ok) return refuse(verdict.blocked_by);

  // Tamper probes: the loop only reports ok when forgery is POSITIVELY rejected.
  const hashTamper = verifyLocalModelAdapterPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
  const fieldTamper = verifyLocalModelAdapterPreview({ ...payload, truth_label: "FORGED" });
  const { content_hash: _oldHash, ...launderBody } = { ...payload, model: "ollama:forged-live-claim" };
  const laundered = verifyLocalModelAdapterPreview({
    ...launderBody,
    content_hash: `sha256:${sha256(stableStringify(launderBody))}`,
  });
  if (hashTamper.ok || fieldTamper.ok || laundered.ok) return refuse(["tamper_probe_not_rejected"]);

  return Object.freeze({
    ok: true,
    schema: LOCAL_MODEL_ADAPTER_PREVIEW_SCHEMA,
    truth_label: LOCAL_MODEL_ADAPTER_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    runtime: payload.runtime,
    model: null,
    models_visible_count: payload.models_visible.length,
    content_hash: payload.content_hash,
    boundary: payload.boundary,
    blocked_by: Object.freeze([]),
  });
}
