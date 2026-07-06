// RECEIPT-MONITOR-PREVIEW-1A — Operator-invoked proof-health monitor: classifies injected proof-surface facts (stale proof, registry/docs drift, missing review gates, evidence-free verified claims, forbidden-claim markers) into severity findings with evidence refs — deterministic, no daemon, no autofix, no authority increase.
//
// RED-FIRST kernel scaffold. `plan` and `build...Payload` are real (consent gate +
// content addressing are universal); the slice-specific `verify` / `run` bodies
// throw `not_implemented` until you build them. Turn the mirrored test green
// before any commit — do not weaken the test to match an empty kernel.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.

import { createHash } from "node:crypto";

export const RECEIPT_MONITOR_PREVIEW_SCHEMA = "bizra.dema.receipt_monitor_preview.v0.1";
export const RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL = "RECEIPT_MONITOR_PREVIEW_MEASURED_REPO";
export const RECEIPT_MONITOR_PREVIEW_GO_PHRASE = "GO: run receipt monitor preview";

// Closed vocabularies. Marker keys are SYMBOLIC — mapping raw prose to a
// marker is a future gatherer's job; this kernel never scans text itself.
export const RECEIPT_MONITOR_SEVERITIES = Object.freeze(["info", "warning", "critical"]);

export const RECEIPT_MONITOR_ALLOWED_ACTIONS = Object.freeze([
  "inspect",
  "repair_proof",
  "stop_and_ask_operator",
]);

export const RECEIPT_MONITOR_CLAIM_MARKERS = Object.freeze([
  "mint_claim",
  "wallet_claim",
  "urp_live_claim",
  "federation_claim",
  "public_safe_claim",
  "live_autonomy_claim",
  "live_invocation_claim",
  "approval_claim",
]);

export const RECEIPT_MONITOR_SURFACES = Object.freeze([
  "repo_state",
  "capability_registry",
  "current_limits",
  "testing",
  "review_gates",
  "receipts",
  "claim_markers",
]);

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

// Deterministic finding matrix. Every rule names its severity, surface,
// evidence ref, and the ONLY allowed follow-up — never an execution.
export function deriveReceiptMonitorFindings(input) {
  const findings = [];
  const push = (severity, surface, finding, evidence_ref, allowed_action) =>
    findings.push({ severity, surface, finding, evidence_ref, allowed_action });

  const rs = input.repo_state;
  if (rs.stale_proof === true) {
    push("warning", "repo_state", "stale_proof_detected", `repo_state.stale_proof@${rs.head_sha}`, "repair_proof");
  }
  if (rs.tree_clean === false) {
    push("warning", "repo_state", "tree_not_clean", `repo_state.tree_clean@${rs.head_sha}`, "inspect");
  }
  if (rs.ci_available === false) {
    // FDE outward lens: unavailable infrastructure is an operator blocker,
    // never a code failure and never a reason to weaken gates.
    push("info", "repo_state", "ci_unavailable_outward_not_code", `repo_state.ci_available@${rs.head_sha}`, "stop_and_ask_operator");
  }
  const rc = input.registry_counts;
  if (rc.declared !== rc.required_ids) {
    push(
      "critical",
      "capability_registry",
      "registry_count_drift",
      `registry_counts.declared=${rc.declared},required_ids=${rc.required_ids}`,
      "stop_and_ask_operator",
    );
  }
  input.capability_rows.forEach((row) => {
    if (!row.measured) return;
    if (!row.in_current_limits) {
      push("warning", "current_limits", "current_limits_row_missing", `capability_rows.${row.capability_id}`, "repair_proof");
    }
    if (!row.in_testing) {
      push("warning", "testing", "testing_row_missing", `capability_rows.${row.capability_id}`, "repair_proof");
    }
    if (!row.review_gate_in_check) {
      push("critical", "review_gates", "review_gate_missing", `capability_rows.${row.capability_id}`, "stop_and_ask_operator");
    }
    if (!row.has_tests) {
      push("critical", "capability_registry", "capability_row_lacks_tests", `capability_rows.${row.capability_id}`, "stop_and_ask_operator");
    }
  });
  input.receipts.forEach((receipt) => {
    if (receipt.verified_claim === true && receipt.evidence_refs === 0) {
      push("critical", "receipts", "verified_claim_without_evidence", `receipts.${receipt.id}`, "stop_and_ask_operator");
    }
  });
  input.claim_markers.forEach((m) => {
    push("critical", "claim_markers", "forbidden_claim_marker", `${m.surface}:${m.marker}`, "stop_and_ask_operator");
  });

  findings.sort((a, b) =>
    `${a.finding}|${a.evidence_ref}`.localeCompare(`${b.finding}|${b.evidence_ref}`),
  );
  return Object.freeze(findings.map((f) => Object.freeze(f)));
}

export function summarizeReceiptMonitorFindings(findings) {
  const critical_count = findings.filter((f) => f.severity === "critical").length;
  const warning_count = findings.filter((f) => f.severity === "warning").length;
  const info_count = findings.filter((f) => f.severity === "info").length;
  return Object.freeze({
    critical_count,
    warning_count,
    info_count,
    all_clear: critical_count === 0 && warning_count === 0 && info_count === 0,
    // Critical findings fail closed: nothing may proceed past them.
    proceed_allowed: critical_count === 0,
    // A monitor verdict can never raise what the system is allowed to do.
    authority_delta: 0,
    mint_allowed: false,
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
export function receiptMonitorPreviewBoundary() {
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
export function planReceiptMonitorPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== RECEIPT_MONITOR_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    const rs = input.repo_state;
    if (
      !rs || typeof rs !== "object" || !isNonEmptyString(rs.head_sha) ||
      !isBool(rs.tree_clean) || !isBool(rs.stale_proof) || !isBool(rs.ci_available)
    ) {
      blocked_by.push("repo_state_invalid");
    }
    const rc = input.registry_counts;
    if (!rc || typeof rc !== "object" || !isCount(rc.declared) || !isCount(rc.required_ids)) {
      blocked_by.push("registry_counts_invalid");
    }
    if (!Array.isArray(input.capability_rows)) {
      blocked_by.push("capability_rows_missing");
    } else {
      input.capability_rows.forEach((row, i) => {
        if (
          !row || typeof row !== "object" || !isNonEmptyString(row.capability_id) ||
          !isBool(row.measured) || !isBool(row.has_tests) || !isBool(row.review_gate_in_check) ||
          !isBool(row.in_current_limits) || !isBool(row.in_testing)
        ) {
          blocked_by.push(`capability_row_invalid:${i}`);
        }
      });
    }
    if (!Array.isArray(input.receipts)) {
      blocked_by.push("receipts_missing");
    } else {
      input.receipts.forEach((r, i) => {
        if (!r || typeof r !== "object" || !isNonEmptyString(r.id) || !isBool(r.verified_claim) || !isCount(r.evidence_refs)) {
          blocked_by.push(`receipt_entry_invalid:${i}`);
        }
      });
    }
    if (!Array.isArray(input.claim_markers)) {
      blocked_by.push("claim_markers_missing");
    } else {
      input.claim_markers.forEach((m, i) => {
        if (!m || typeof m !== "object" || !isNonEmptyString(m.surface) || !RECEIPT_MONITOR_CLAIM_MARKERS.includes(m.marker)) {
          blocked_by.push(`claim_marker_invalid:${i}`);
        }
      });
    }
  }
  return Object.freeze({
    schema: RECEIPT_MONITOR_PREVIEW_SCHEMA,
    truth_label: RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload. Reshape `body` to carry the real fields
// this slice attests; the content_hash binds the whole body.
export function buildReceiptMonitorPreviewPayload(input) {
  const findings = deriveReceiptMonitorFindings(input);
  const body = {
    schema: RECEIPT_MONITOR_PREVIEW_SCHEMA,
    truth_label: RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL,
    mode: "operator_invoked_preview",
    monitored_surfaces: RECEIPT_MONITOR_SURFACES,
    input,
    findings,
    summary: summarizeReceiptMonitorFindings(findings),
    autofix_performed: false,
    receipt_written: false,
    boundary: receiptMonitorPreviewBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier (REQUIRED by the core-kernels rule).
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then add the slice-specific field checks. Body-bound, not seed-bound: a forged
// field with a recomputed hash must still fail because verify binds the WHOLE body
// against an independent anchor (e.g. a signature or an externally supplied hash).
export function verifyReceiptMonitorPreview(payload) {
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
  if (body.schema !== RECEIPT_MONITOR_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (body.truth_label !== RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (body.mode !== "operator_invoked_preview") blocked_by.push("mode_not_operator_invoked_preview");
  if (body.autofix_performed !== false) blocked_by.push("autofix_claimed");
  if (body.receipt_written !== false) blocked_by.push("receipt_write_claimed");

  const canonical = receiptMonitorPreviewBoundary();
  const canonicalKeys = Object.keys(canonical).sort();
  const boundaryKeys = body.boundary && typeof body.boundary === "object" ? Object.keys(body.boundary).sort() : [];
  if (
    boundaryKeys.length !== canonicalKeys.length ||
    !canonicalKeys.every((k, i) => boundaryKeys[i] === k && body.boundary[k] === false)
  ) {
    blocked_by.push("boundary_not_canonical_all_false");
  }

  // Independent anchor: findings and summary are DERIVED, so verify re-derives
  // both from input. A forged clean verdict (findings stripped, counts zeroed,
  // hash recomputed) still fails because the matrix disagrees.
  const rebuilt = buildReceiptMonitorPreviewPayload(body.input);
  if (stableStringify(rebuilt.findings) !== stableStringify(body.findings)) {
    blocked_by.push("findings_not_rederivable");
  }
  if (stableStringify(rebuilt.summary) !== stableStringify(body.summary)) {
    blocked_by.push("summary_not_rederivable");
  }
  const summary = body.summary && typeof body.summary === "object" ? body.summary : {};
  if (summary.authority_delta !== 0) blocked_by.push("authority_delta_nonzero");
  if (summary.mint_allowed !== false) blocked_by.push("mint_allowed_claimed");
  for (const f of Array.isArray(body.findings) ? body.findings : []) {
    if (!RECEIPT_MONITOR_SEVERITIES.includes(f?.severity)) blocked_by.push("finding_severity_invalid");
    if (!RECEIPT_MONITOR_ALLOWED_ACTIONS.includes(f?.allowed_action)) blocked_by.push("finding_action_invalid");
    if (!isNonEmptyString(f?.evidence_ref)) blocked_by.push("finding_missing_evidence_ref");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    schema: RECEIPT_MONITOR_PREVIEW_SCHEMA,
    truth_label: RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL,
    content_hash: typeof content_hash === "string" ? content_hash : null,
  });
}

// Orchestrator the review gate consumes. Run plan -> build -> verify -> tamper-reject
// and return the proof envelope: { ok, schema, truth_label, content_hash, boundary,
// blocked_by }. Push a named block on any failure so the gate fails closed.
export function runReceiptMonitorPreview({ consent, input } = {}) {
  const boundary = receiptMonitorPreviewBoundary();
  const refuse = (codes) =>
    Object.freeze({
      ok: false,
      schema: RECEIPT_MONITOR_PREVIEW_SCHEMA,
      truth_label: RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL,
      blocked_by: Object.freeze([...codes]),
      boundary,
    });

  const plan = planReceiptMonitorPreview({ consent, input });
  if (!plan.eligible) return refuse(plan.blocked_by);

  const payload = buildReceiptMonitorPreviewPayload(input);
  const verdict = verifyReceiptMonitorPreview(payload);
  if (!verdict.ok) return refuse(verdict.blocked_by);

  // Tamper probes — ok only when a forged clean verdict is POSITIVELY rejected.
  const hashTamper = verifyReceiptMonitorPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
  const cleanFindings = Object.freeze([]);
  const { content_hash: _oldHash, ...launderBody } = {
    ...payload,
    findings: cleanFindings,
    summary: summarizeReceiptMonitorFindings(cleanFindings),
  };
  const laundered = verifyReceiptMonitorPreview({
    ...launderBody,
    content_hash: `sha256:${sha256(stableStringify(launderBody))}`,
  });
  const launderedMustFail = payload.findings.length > 0 ? laundered.ok === false : true;
  if (hashTamper.ok || !launderedMustFail) return refuse(["tamper_probe_not_rejected"]);

  // ok means the monitor RAN and its report verifies — findings may still be
  // present; proceed_allowed carries the fail-closed verdict on criticals.
  return Object.freeze({
    ok: true,
    schema: RECEIPT_MONITOR_PREVIEW_SCHEMA,
    truth_label: RECEIPT_MONITOR_PREVIEW_TRUTH_LABEL,
    mode: "operator_invoked_preview",
    summary: payload.summary,
    findings: payload.findings,
    proceed_allowed: payload.summary.proceed_allowed,
    content_hash: payload.content_hash,
    boundary: payload.boundary,
    blocked_by: Object.freeze([]),
  });
}
