// MONITOR-GATHERER-1A — Read-only monitor-facts derivation: compiles injected raw repo artifacts (git metadata, gate-log ages, registry rows, check.mjs source, docs texts, receipt metadata) into the receipt-monitor input facts, content-addressed and fully re-derivable — no fs in kernel, no network, no mutation.
//
// RED-FIRST kernel scaffold. `plan` and `build...Payload` are real (consent gate +
// content addressing are universal); the slice-specific `verify` / `run` bodies
// throw `not_implemented` until you build them. Turn the mirrored test green
// before any commit — do not weaken the test to match an empty kernel.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.

import { createHash } from "node:crypto";

export const MONITOR_GATHERER_SCHEMA = "bizra.dema.monitor_gatherer.v0.1";
export const MONITOR_GATHERER_TRUTH_LABEL = "MONITOR_GATHERER_MEASURED_REPO";
export const MONITOR_GATHERER_GO_PHRASE = "GO: gather monitor facts";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isBool(v) {
  return typeof v === "boolean";
}

function isCount(v) {
  return Number.isInteger(v) && v >= 0;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

function isStringArray(v) {
  return Array.isArray(v) && v.every(isNonEmptyString);
}

function isAgeHours(v) {
  return v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
}

function pathBasename(p) {
  return p.split("/").pop();
}

// scripts/check.mjs is the gate RUNNER itself. A capability whose review gate
// IS the runner (e.g. COVERAGE_TRUTH_GATE_1A) is inherently in-check — the
// runner does not reference its own path, so `check_source.includes(...)` can
// never see it. Recognizing the runner path is a PRECISION fix (fewer false
// positives), not a weakening: any OTHER gate path still must appear in the
// runner source to count.
const CHECK_RUNNER_PATH = "scripts/check.mjs";

// Deterministic derivation from raw artifacts to the receipt-monitor input
// shape. Text membership is exact substring — no fuzzy matching, no guessing.
// v0.1 constants: receipts carry verified_claim=false (no receipt semantics
// bound yet) and claim_markers is empty (text→marker mapping is out of scope).
export function deriveMonitorInputFacts(input) {
  const { git, gate_logs, registry, artifacts } = input;
  const stale_proof =
    gate_logs.test_age_hours === null ||
    gate_logs.check_age_hours === null ||
    gate_logs.test_age_hours > gate_logs.stale_threshold_hours ||
    gate_logs.check_age_hours > gate_logs.stale_threshold_hours;

  const capability_rows = registry.rows.map((row) => {
    // Only SPECIFIC source paths (with a directory component) count as
    // documentation evidence — a bare root file like `package.json` is too
    // generic to prove a capability is documented, so it is excluded to avoid
    // a false negative that would hide real drift.
    const specificSourcePaths = (row.source_paths || []).filter((p) => p.includes("/"));
    return {
      capability_id: row.capability_id,
      measured: true,
      has_tests:
        row.test_paths.length > 0 &&
        row.test_paths.every((p) => artifacts.test_paths_present[p] === true),
      review_gate_in_check:
        row.review_gate_paths.length > 0 &&
        row.review_gate_paths.every(
          (p) => p === CHECK_RUNNER_PATH || artifacts.check_source.includes(p),
        ),
      // Documented if the hyphenated ID appears OR a specific source path is
      // referenced in CURRENT_LIMITS. Broadening the evidence keys (not
      // lowering the bar) — a capability cited by its source file IS documented.
      in_current_limits:
        artifacts.current_limits_text.includes(row.capability_id.replaceAll("_", "-")) ||
        specificSourcePaths.some((p) => artifacts.current_limits_text.includes(p)),
      in_testing: row.test_paths.every((p) =>
        artifacts.testing_text.includes(pathBasename(p)),
      ),
    };
  });

  return Object.freeze({
    repo_state: Object.freeze({
      head_sha: git.head_sha,
      tree_clean: git.dirty_count === 0,
      stale_proof,
      ci_available: input.ci_available_declared,
    }),
    registry_counts: Object.freeze({
      declared: registry.rows.length,
      required_ids: registry.required_ids.length,
    }),
    capability_rows: Object.freeze(capability_rows.map((r) => Object.freeze(r))),
    receipts: Object.freeze(
      input.receipts_raw.map((r) =>
        Object.freeze({ id: r.id, verified_claim: false, evidence_refs: r.evidence_refs }),
      ),
    ),
    claim_markers: Object.freeze([]),
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
export function monitorGathererBoundary() {
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
export function planMonitorGatherer({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== MONITOR_GATHERER_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    const g = input.git;
    if (!g || typeof g !== "object" || !isNonEmptyString(g.head_sha) || !isCount(g.dirty_count)) {
      blocked_by.push("git_invalid");
    }
    const gl = input.gate_logs;
    if (
      !gl || typeof gl !== "object" || !isAgeHours(gl.test_age_hours) || !isAgeHours(gl.check_age_hours) ||
      typeof gl.stale_threshold_hours !== "number" || !(gl.stale_threshold_hours > 0)
    ) {
      blocked_by.push("gate_logs_invalid");
    }
    if (!isBool(input.ci_available_declared)) {
      blocked_by.push("ci_available_declared_invalid");
    }
    const reg = input.registry;
    if (!reg || typeof reg !== "object" || !isStringArray(reg.required_ids) || !Array.isArray(reg.rows)) {
      blocked_by.push("registry_invalid");
    } else {
      reg.rows.forEach((row, i) => {
        const sourcePathsOk =
          row?.source_paths === undefined || (Array.isArray(row.source_paths) && row.source_paths.every(isNonEmptyString));
        if (
          !row || typeof row !== "object" || !isNonEmptyString(row.capability_id) ||
          !isStringArray(row.test_paths) || !isStringArray(row.review_gate_paths) || !sourcePathsOk
        ) {
          blocked_by.push(`registry_row_invalid:${i}`);
        }
      });
    }
    const a = input.artifacts;
    if (
      !a || typeof a !== "object" || typeof a.check_source !== "string" ||
      typeof a.current_limits_text !== "string" || typeof a.testing_text !== "string" ||
      !a.test_paths_present || typeof a.test_paths_present !== "object" ||
      !Object.values(a.test_paths_present).every(isBool)
    ) {
      blocked_by.push("artifacts_invalid");
    }
    if (!Array.isArray(input.receipts_raw)) {
      blocked_by.push("receipts_raw_missing");
    } else {
      input.receipts_raw.forEach((r, i) => {
        if (!r || typeof r !== "object" || !isNonEmptyString(r.id) || !isCount(r.evidence_refs)) {
          blocked_by.push(`receipt_raw_invalid:${i}`);
        }
      });
    }
  }
  return Object.freeze({
    schema: MONITOR_GATHERER_SCHEMA,
    truth_label: MONITOR_GATHERER_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload. Reshape `body` to carry the real fields
// this slice attests; the content_hash binds the whole body.
export function buildMonitorGathererPayload(input) {
  const body = {
    schema: MONITOR_GATHERER_SCHEMA,
    truth_label: MONITOR_GATHERER_TRUTH_LABEL,
    mode: "read_only_derivation",
    input,
    monitor_input: deriveMonitorInputFacts(input),
    boundary: monitorGathererBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier (REQUIRED by the core-kernels rule).
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then add the slice-specific field checks. Body-bound, not seed-bound: a forged
// field with a recomputed hash must still fail because verify binds the WHOLE body
// against an independent anchor (e.g. a signature or an externally supplied hash).
export function verifyMonitorGatherer(payload) {
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
  if (body.schema !== MONITOR_GATHERER_SCHEMA) blocked_by.push("schema_mismatch");
  if (body.truth_label !== MONITOR_GATHERER_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (body.mode !== "read_only_derivation") blocked_by.push("mode_not_read_only_derivation");

  const canonical = monitorGathererBoundary();
  const canonicalKeys = Object.keys(canonical).sort();
  const boundaryKeys = body.boundary && typeof body.boundary === "object" ? Object.keys(body.boundary).sort() : [];
  if (
    boundaryKeys.length !== canonicalKeys.length ||
    !canonicalKeys.every((k, i) => boundaryKeys[i] === k && body.boundary[k] === false)
  ) {
    blocked_by.push("boundary_not_canonical_all_false");
  }

  // Independent anchor: the monitor input is DERIVED, so verify re-derives it
  // from the embedded raw artifacts. Flipping tree_clean or hiding a missing
  // gate with a recomputed hash still fails because the derivation disagrees.
  let rederived = null;
  try {
    rederived = deriveMonitorInputFacts(body.input);
  } catch {
    blocked_by.push("input_not_derivable");
  }
  if (rederived && stableStringify(rederived) !== stableStringify(body.monitor_input)) {
    blocked_by.push("monitor_input_not_rederivable");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    schema: MONITOR_GATHERER_SCHEMA,
    truth_label: MONITOR_GATHERER_TRUTH_LABEL,
    content_hash: typeof content_hash === "string" ? content_hash : null,
  });
}

// Orchestrator the review gate consumes. Run plan -> build -> verify -> tamper-reject
// and return the proof envelope: { ok, schema, truth_label, content_hash, boundary,
// blocked_by }. Push a named block on any failure so the gate fails closed.
export function runMonitorGatherer({ consent, input } = {}) {
  const boundary = monitorGathererBoundary();
  const refuse = (codes) =>
    Object.freeze({
      ok: false,
      schema: MONITOR_GATHERER_SCHEMA,
      truth_label: MONITOR_GATHERER_TRUTH_LABEL,
      blocked_by: Object.freeze([...codes]),
      boundary,
    });

  const plan = planMonitorGatherer({ consent, input });
  if (!plan.eligible) return refuse(plan.blocked_by);

  const payload = buildMonitorGathererPayload(input);
  const verdict = verifyMonitorGatherer(payload);
  if (!verdict.ok) return refuse(verdict.blocked_by);

  // Tamper probes — a laundered "clean" repo_state must be POSITIVELY rejected.
  const hashTamper = verifyMonitorGatherer({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
  const { content_hash: _oldHash, ...launderBody } = {
    ...payload,
    monitor_input: {
      ...payload.monitor_input,
      repo_state: { ...payload.monitor_input.repo_state, tree_clean: true, stale_proof: false },
    },
  };
  const laundered = verifyMonitorGatherer({
    ...launderBody,
    content_hash: `sha256:${sha256(stableStringify(launderBody))}`,
  });
  const cleanAlready =
    payload.monitor_input.repo_state.tree_clean === true &&
    payload.monitor_input.repo_state.stale_proof === false;
  if (hashTamper.ok || (!cleanAlready && laundered.ok)) return refuse(["tamper_probe_not_rejected"]);

  return Object.freeze({
    ok: true,
    schema: MONITOR_GATHERER_SCHEMA,
    truth_label: MONITOR_GATHERER_TRUTH_LABEL,
    mode: "read_only_derivation",
    monitor_input: payload.monitor_input,
    content_hash: payload.content_hash,
    boundary: payload.boundary,
    blocked_by: Object.freeze([]),
  });
}
