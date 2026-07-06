// CAPABILITY-BLAST-RADIUS-1A — Deterministic blast-radius classifier: derives blast_radius (low|medium|high) and reversibility from declared action mutation flags — never from prose — so graduated consent can name what an action touches before it runs. No execution, no network, no mutation.
//
// RED-FIRST kernel scaffold. `plan` and `build...Payload` are real (consent gate +
// content addressing are universal); the slice-specific `verify` / `run` bodies
// throw `not_implemented` until you build them. Turn the mirrored test green
// before any commit — do not weaken the test to match an empty kernel.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.

import { createHash } from "node:crypto";

export const CAPABILITY_BLAST_RADIUS_SCHEMA = "bizra.dema.capability_blast_radius.v0.1";
export const CAPABILITY_BLAST_RADIUS_TRUTH_LABEL = "CAPABILITY_BLAST_RADIUS_MEASURED_REPO";
export const CAPABILITY_BLAST_RADIUS_GO_PHRASE = "GO: classify capability blast radius";

// Closed classification vocabulary. There is deliberately no "auto_approved"
// or "safe" level — this kernel names what an action touches; it never grants.
export const CAPABILITY_BLAST_RADIUS_LEVELS = Object.freeze(["low", "medium", "high"]);

// Canonical mutation-flag key set. Every action descriptor must carry EXACTLY
// these seven booleans — a missing key is a refusal, not a default.
export const CAPABILITY_BLAST_RADIUS_FLAG_KEYS = Object.freeze([
  "mutates_local_files",
  "mutates_remote_state",
  "deletes_data",
  "publishes_external",
  "binds_identity",
  "writes_receipt",
  "network_used",
]);

// Closed recovery vocabulary. `none` is the only irreversible value.
export const CAPABILITY_BLAST_RADIUS_RECOVERIES = Object.freeze([
  "git_revert",
  "file_restore",
  "history_rewrite_needed",
  "none",
  "not_applicable",
]);

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validActionDescriptor(action) {
  if (!action || typeof action !== "object") return false;
  if (typeof action.action !== "string" || action.action.trim() === "") return false;
  const flags = action.flags;
  if (!flags || typeof flags !== "object") return false;
  const keys = Object.keys(flags).sort();
  const canonical = [...CAPABILITY_BLAST_RADIUS_FLAG_KEYS].sort();
  if (keys.length !== canonical.length) return false;
  if (!canonical.every((k, i) => keys[i] === k && typeof flags[k] === "boolean")) return false;
  return CAPABILITY_BLAST_RADIUS_RECOVERIES.includes(action.recovery);
}

// Deterministic decision matrix — highest triggered rule wins, every triggered
// rule is named in `reasons` so the classification is auditable, never a vibe.
export function classifyBlastRadius(action) {
  const { flags, recovery } = action;
  const reasons = [];
  const anyMutation =
    flags.mutates_local_files || flags.mutates_remote_state || flags.deletes_data ||
    flags.publishes_external || flags.binds_identity || flags.writes_receipt;

  if (flags.binds_identity) reasons.push("binds_identity->high");
  if (flags.publishes_external) reasons.push("publishes_external->high");
  if (anyMutation && recovery === "none") reasons.push("irreversible_mutation->high");
  if (flags.mutates_remote_state) reasons.push("mutates_remote_state->medium");
  if (flags.deletes_data) reasons.push("deletes_data->medium");
  if (flags.writes_receipt) reasons.push("writes_receipt->medium");
  if (flags.mutates_local_files && recovery === "history_rewrite_needed") {
    reasons.push("history_rewrite_needed->medium");
  }
  if (flags.mutates_local_files) reasons.push("mutates_local_files->low");
  if (flags.network_used) reasons.push("network_used->low");
  if (!anyMutation && !flags.network_used) reasons.push("read_only->low");

  let blast_radius = "low";
  if (reasons.some((r) => r.endsWith("->medium"))) blast_radius = "medium";
  if (reasons.some((r) => r.endsWith("->high"))) blast_radius = "high";
  return Object.freeze({
    action: action.action,
    blast_radius,
    reversible: recovery !== "none",
    recovery,
    reasons: Object.freeze([...reasons].sort()),
  });
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
export function capabilityBlastRadiusBoundary() {
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
export function planCapabilityBlastRadius({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== CAPABILITY_BLAST_RADIUS_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else if (!Array.isArray(input.actions) || input.actions.length === 0) {
    blocked_by.push("actions_missing");
  } else {
    input.actions.forEach((action, i) => {
      if (!validActionDescriptor(action)) blocked_by.push(`action_descriptor_invalid:${i}`);
    });
  }
  return Object.freeze({
    schema: CAPABILITY_BLAST_RADIUS_SCHEMA,
    truth_label: CAPABILITY_BLAST_RADIUS_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload. Reshape `body` to carry the real fields
// this slice attests; the content_hash binds the whole body.
export function buildCapabilityBlastRadiusPayload(input) {
  const actions = Array.isArray(input?.actions) ? input.actions : [];
  const classifications = actions.filter(validActionDescriptor).map(classifyBlastRadius);
  const counts = { low: 0, medium: 0, high: 0 };
  for (const c of classifications) counts[c.blast_radius] += 1;
  const body = {
    schema: CAPABILITY_BLAST_RADIUS_SCHEMA,
    truth_label: CAPABILITY_BLAST_RADIUS_TRUTH_LABEL,
    input,
    classifications,
    counts,
    irreversible_count: classifications.filter((c) => !c.reversible).length,
    boundary: capabilityBlastRadiusBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier (REQUIRED by the core-kernels rule).
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then add the slice-specific field checks. Body-bound, not seed-bound: a forged
// field with a recomputed hash must still fail because verify binds the WHOLE body
// against an independent anchor (e.g. a signature or an externally supplied hash).
export function verifyCapabilityBlastRadius(payload) {
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
  if (body.schema !== CAPABILITY_BLAST_RADIUS_SCHEMA) blocked_by.push("schema_mismatch");
  if (body.truth_label !== CAPABILITY_BLAST_RADIUS_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");

  // Boundary must deep-equal the canonical all-false set — `{}` or a subset fails.
  const canonical = capabilityBlastRadiusBoundary();
  const canonicalKeys = Object.keys(canonical).sort();
  const boundaryKeys = body.boundary && typeof body.boundary === "object" ? Object.keys(body.boundary).sort() : [];
  if (
    boundaryKeys.length !== canonicalKeys.length ||
    !canonicalKeys.every((k, i) => boundaryKeys[i] === k && body.boundary[k] === false)
  ) {
    blocked_by.push("boundary_not_canonical_all_false");
  }

  // Independent anchor: classifications are DERIVED, so verify re-derives the
  // entire set from input.actions. A laundered downgrade (high edited to low
  // with a recomputed hash) still fails because the matrix disagrees.
  const rebuilt = buildCapabilityBlastRadiusPayload(body.input);
  if (stableStringify(rebuilt.classifications) !== stableStringify(body.classifications)) {
    blocked_by.push("classification_not_rederivable");
  }
  if (stableStringify(rebuilt.counts) !== stableStringify(body.counts)) {
    blocked_by.push("counts_not_rederivable");
  }
  if (rebuilt.irreversible_count !== body.irreversible_count) {
    blocked_by.push("irreversible_count_not_rederivable");
  }
  for (const c of Array.isArray(body.classifications) ? body.classifications : []) {
    if (!CAPABILITY_BLAST_RADIUS_LEVELS.includes(c?.blast_radius)) blocked_by.push("blast_radius_invalid");
    if (c && c.reversible !== (c.recovery !== "none")) blocked_by.push("reversibility_inconsistent");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    schema: CAPABILITY_BLAST_RADIUS_SCHEMA,
    truth_label: CAPABILITY_BLAST_RADIUS_TRUTH_LABEL,
    content_hash: typeof content_hash === "string" ? content_hash : null,
  });
}

// Orchestrator the review gate consumes. Run plan -> build -> verify -> tamper-reject
// and return the proof envelope: { ok, schema, truth_label, content_hash, boundary,
// blocked_by }. Push a named block on any failure so the gate fails closed.
export function runCapabilityBlastRadius({ consent, input } = {}) {
  const boundary = capabilityBlastRadiusBoundary();
  const refuse = (codes) =>
    Object.freeze({
      ok: false,
      schema: CAPABILITY_BLAST_RADIUS_SCHEMA,
      truth_label: CAPABILITY_BLAST_RADIUS_TRUTH_LABEL,
      blocked_by: Object.freeze([...codes]),
      boundary,
    });

  const plan = planCapabilityBlastRadius({ consent, input });
  if (!plan.eligible) return refuse(plan.blocked_by);

  const payload = buildCapabilityBlastRadiusPayload(input);
  const verdict = verifyCapabilityBlastRadius(payload);
  if (!verdict.ok) return refuse(verdict.blocked_by);

  // Tamper probes — ok only when forgery is POSITIVELY rejected.
  const hashTamper = verifyCapabilityBlastRadius({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
  const downgraded = payload.classifications.map((c) => ({ ...c, blast_radius: "low", reasons: [] }));
  const { content_hash: _oldHash, ...launderBody } = { ...payload, classifications: downgraded };
  const laundered = verifyCapabilityBlastRadius({
    ...launderBody,
    content_hash: `sha256:${sha256(stableStringify(launderBody))}`,
  });
  if (hashTamper.ok || laundered.ok) return refuse(["tamper_probe_not_rejected"]);

  return Object.freeze({
    ok: true,
    schema: CAPABILITY_BLAST_RADIUS_SCHEMA,
    truth_label: CAPABILITY_BLAST_RADIUS_TRUTH_LABEL,
    counts: payload.counts,
    irreversible_count: payload.irreversible_count,
    content_hash: payload.content_hash,
    boundary: payload.boundary,
    blocked_by: Object.freeze([]),
  });
}
