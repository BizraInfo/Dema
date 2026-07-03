// DEMA-STAND-1A — Morning Standing Receipt: composes injected local evidence
// (git state summary, gate-log metadata, declared blockers) into a daily
// first-user standing card with FDE lens buckets, exactly ONE next action, an
// operator-declared drain metric, stale-proof detection, and an orbit warning.
//
// PREVIEW/COMPOSER ONLY — this kernel observes and classifies; it executes
// nothing, infers no feelings (drain is declared, never inferred), and claims
// no live autonomy. The boundary is all-false.
//
// Pure kernel: no fs / network / process / clock / random. All evidence —
// including `observed_at_iso` and gate-log `age_hours` — is injected by the
// read-only gatherer at the CLI boundary.

import { createHash } from "node:crypto";

export const DEMA_STAND_SCHEMA = "bizra.dema.dema_stand.v0.1";
export const DEMA_STAND_TRUTH_LABEL = "FIRST_USER_STANDING_LOCAL_ONLY";
export const DEMA_STAND_GO_PHRASE = "GO: write first-user standing receipt";

export const DEMA_STAND_LENSES = Object.freeze([
  "INWARD",
  "OUTWARD",
  "AUTHORITY",
  "ECONOMIC",
]);
export const DEMA_STAND_DRAIN_VALUES = Object.freeze(["less", "same", "more"]);
export const DEMA_STAND_GATE_STATUSES = Object.freeze(["pass", "fail", "missing"]);
export const DEMA_STAND_COMMIT_KINDS = Object.freeze([
  "docs",
  "feat",
  "fix",
  "adr",
  "other",
]);
export const DEMA_STAND_STALE_AGE_HOURS = 24;
export const DEMA_STAND_ORBIT_DOCS_THRESHOLD = 3;

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
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

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function isCountOrNull(value) {
  return value === null || value === undefined || isCount(value);
}

function isNonNegativeNumberOrNull(value) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "number" && Number.isFinite(value) && value >= 0)
  );
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function demaStandBoundary() {
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

function validateGate(gate, name, blocked_by) {
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) {
    blocked_by.push(`${name}_gate_summary_required`);
    return;
  }
  if (!DEMA_STAND_GATE_STATUSES.includes(gate.status)) {
    blocked_by.push(`${name}_gate_status_invalid`);
  }
  if (!isNonNegativeNumberOrNull(gate.age_hours)) {
    blocked_by.push(`${name}_gate_age_hours_invalid`);
  }
  if (name === "test" && !isCountOrNull(gate.tests_total)) {
    blocked_by.push("test_gate_tests_total_invalid");
  }
}

function validateInput(input, blocked_by) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
    return;
  }
  if (!isText(input.observed_at_iso)) {
    blocked_by.push("observed_at_iso_required");
  }
  const git = input.git;
  if (!git || typeof git !== "object" || Array.isArray(git)) {
    blocked_by.push("git_summary_required");
  } else {
    if (!isText(git.head)) blocked_by.push("git_head_required");
    if (!isText(git.branch)) blocked_by.push("git_branch_required");
    if (!isCount(git.dirty_files)) blocked_by.push("git_dirty_files_invalid");
    if (!isCountOrNull(git.ahead)) blocked_by.push("git_ahead_invalid");
  }
  const gates = input.gates;
  if (!gates || typeof gates !== "object" || Array.isArray(gates)) {
    blocked_by.push("gates_summary_required");
  } else {
    validateGate(gates.test, "test", blocked_by);
    validateGate(gates.check, "check", blocked_by);
  }
  const blockers = input.blockers ?? [];
  if (!Array.isArray(blockers)) {
    blocked_by.push("blockers_must_be_array");
  } else {
    blockers.forEach((b, i) => {
      if (!b || typeof b !== "object" || !isText(b.id) || !isText(b.label)) {
        blocked_by.push(`blocker_${i}_malformed`);
      } else if (!DEMA_STAND_LENSES.includes(b.lens)) {
        blocked_by.push(`blocker_${i}_lens_invalid`);
      }
    });
  }
  if (
    input.drain !== undefined &&
    input.drain !== null &&
    !DEMA_STAND_DRAIN_VALUES.includes(input.drain)
  ) {
    blocked_by.push("drain_value_invalid");
  }
  const commits = input.recent_commits ?? [];
  if (!Array.isArray(commits)) {
    blocked_by.push("recent_commits_must_be_array");
  } else {
    commits.forEach((c, i) => {
      if (!c || typeof c !== "object" || !isText(c.sha)) {
        blocked_by.push(`recent_commit_${i}_malformed`);
      } else if (!DEMA_STAND_COMMIT_KINDS.includes(c.kind)) {
        blocked_by.push(`recent_commit_${i}_kind_invalid`);
      }
    });
  }
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
export function planDemaStand({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_STAND_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  validateInput(input, blocked_by);
  return Object.freeze({
    schema: DEMA_STAND_SCHEMA,
    truth_label: DEMA_STAND_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

function normalizeInput(input) {
  return {
    observed_at_iso: input.observed_at_iso,
    git: {
      head: input.git.head,
      branch: input.git.branch,
      dirty_files: input.git.dirty_files,
      ahead: input.git.ahead ?? null,
    },
    gates: {
      test: {
        status: input.gates.test.status,
        tests_total: input.gates.test.tests_total ?? null,
        age_hours: input.gates.test.age_hours ?? null,
        log_path: input.gates.test.log_path ?? null,
      },
      check: {
        status: input.gates.check.status,
        age_hours: input.gates.check.age_hours ?? null,
        log_path: input.gates.check.log_path ?? null,
      },
    },
    blockers: (input.blockers ?? []).map((b) => ({
      id: b.id,
      lens: b.lens,
      label: b.label,
    })),
    drain: input.drain ?? null,
    recent_commits: (input.recent_commits ?? []).map((c) => ({
      sha: c.sha,
      kind: c.kind,
    })),
  };
}

function deriveStanding(input) {
  const stale_reasons = [];
  const failing_gates = [];
  for (const name of ["test", "check"]) {
    const gate = input.gates[name];
    if (gate.status === "missing") stale_reasons.push(`${name}_gate_log_missing`);
    if (gate.status === "fail") failing_gates.push(name);
    if (
      gate.age_hours !== null &&
      gate.age_hours > DEMA_STAND_STALE_AGE_HOURS
    ) {
      stale_reasons.push(
        `${name}_gate_log_older_than_${DEMA_STAND_STALE_AGE_HOURS}h`,
      );
    }
  }
  return {
    tree_clean: input.git.dirty_files === 0,
    stale_proof: stale_reasons.length > 0,
    stale_reasons,
    failing_gates,
  };
}

function deriveFde(blockers) {
  const buckets = { INWARD: [], OUTWARD: [], AUTHORITY: [], ECONOMIC: [] };
  for (const b of blockers) buckets[b.lens].push({ id: b.id, label: b.label });
  const present = DEMA_STAND_LENSES.filter((l) => buckets[l].length > 0);
  const lens = present.length === 0 ? "CLEAR" : present.length === 1 ? present[0] : "MIXED";
  return {
    lens,
    inward: buckets.INWARD,
    outward: buckets.OUTWARD,
    authority: buckets.AUTHORITY,
    economic: buckets.ECONOMIC,
  };
}

// Exactly ONE next action — a deterministic priority ladder, first match wins:
// proof integrity (failing gates) → local hygiene (dirty tree) → stale proof →
// AUTHORITY → OUTWARD → INWARD → ECONOMIC (always no-mint) → all-clear.
function deriveNextAction(input, standing, fde) {
  if (standing.failing_gates.length > 0) {
    return {
      id: "fix_failing_gates",
      label: `Fix the failing local gate(s): ${standing.failing_gates.join(", ")}`,
      command: "npm test && npm run check",
      lens: "INWARD",
    };
  }
  if (!standing.tree_clean) {
    return {
      id: "resolve_dirty_tree",
      label: `Decide the ${input.git.dirty_files} dirty file(s): commit, stash, or drop`,
      command: "git status --short",
      lens: "INWARD",
    };
  }
  if (standing.stale_proof) {
    return {
      id: "rerun_gates",
      label: "Re-run the local gate set so proof binds to current HEAD",
      command: "npm test && npm run check",
      lens: "INWARD",
    };
  }
  if (fde.authority.length > 0) {
    return {
      id: "clear_authority_gate",
      label: `${fde.authority[0].label} (operator-only action)`,
      command: null,
      lens: "AUTHORITY",
    };
  }
  if (fde.outward.length > 0) {
    return {
      id: "address_outward_blocker",
      label: fde.outward[0].label,
      command: null,
      lens: "OUTWARD",
    };
  }
  if (fde.inward.length > 0) {
    return {
      id: "close_inward_blocker",
      label: fde.inward[0].label,
      command: null,
      lens: "INWARD",
    };
  }
  if (fde.economic.length > 0) {
    return {
      id: "economy_stays_blocked",
      label:
        "Economic lane stays blocked by design — continue the steward loop; no mint",
      command: null,
      lens: "ECONOMIC",
    };
  }
  return {
    id: "all_clear_pick_next_slice",
    label: "All clear — pick the next single slice (WIP = 1)",
    command: null,
    lens: null,
  };
}

// Orbit = motion without closure: 3+ consecutive docs-only commits while
// declared blockers stay open (docs grow, gates do not close).
function deriveOrbit(input, fde) {
  const commits = input.recent_commits;
  const docs = commits.filter((c) => c.kind === "docs").length;
  const others = commits.length - docs;
  const blockersOpen =
    fde.inward.length + fde.outward.length + fde.authority.length + fde.economic.length >
    0;
  const warning =
    docs >= DEMA_STAND_ORBIT_DOCS_THRESHOLD && others === 0 && blockersOpen;
  return {
    warning,
    reason: warning
      ? `${docs} docs-only commit(s) in the window while declared blockers stay open`
      : null,
  };
}

// Canonical, content-addressed payload. Carries the RAW evidence (`input`)
// plus every derived block, so verify can re-derive the whole body from raw.
export function buildDemaStandPayload(rawInput) {
  const blocked_by = [];
  validateInput(rawInput, blocked_by);
  if (blocked_by.length > 0) {
    return Object.freeze({
      schema: DEMA_STAND_SCHEMA,
      truth_label: DEMA_STAND_TRUTH_LABEL,
      rejected: true,
      blocked_by: Object.freeze(blocked_by),
      boundary: demaStandBoundary(),
    });
  }
  const input = normalizeInput(rawInput);
  const standing = deriveStanding(input);
  const fde = deriveFde(input.blockers);
  const next_action = deriveNextAction(input, standing, fde);
  const orbit = deriveOrbit(input, fde);
  const body = {
    schema: DEMA_STAND_SCHEMA,
    truth_label: DEMA_STAND_TRUTH_LABEL,
    observed_at_iso: input.observed_at_iso,
    input,
    standing,
    fde,
    next_action,
    drain: {
      declared: input.drain,
      status: input.drain === null ? "not_declared" : "declared",
    },
    orbit,
    what_this_proves: [
      "A deterministic standing card can be derived from injected local evidence and re-derived by any verifier.",
      "Exactly one next action is selected by a fixed priority ladder — never a menu, never a queue.",
      "The drain metric is operator-declared input, recorded verbatim; nothing is inferred about the operator.",
    ],
    what_this_does_not_prove: [
      "It does not prove the injected evidence is itself fresh or truthful — the gatherer's reads are trusted inputs.",
      "It does not prove live autonomy, scheduling, or any daily loop — each card is one bounded composition.",
      "It performs no runtime, network, model, mint, URP, or federation action.",
    ],
    boundary: demaStandBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier: recompute the hash over the body minus its
// hash field, then REBUILD the whole payload from the embedded raw input and
// require hash equality — so hand-editing any derived field (next_action, fde,
// orbit, standing, drain) is caught even if the outer hash was recomputed.
// Known limit (documented, not defended): tampering with the RAW input and
// recomputing is internally consistent; catching that needs an independent
// anchor (signature / externally measured state hash).
export function verifyDemaStand(payload) {
  const reject = (reason_code) =>
    Object.freeze({ ok: false, reason_code, schema: DEMA_STAND_SCHEMA });
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return reject("payload_not_object");
  }
  if (payload.rejected === true) return reject("payload_was_rejected");
  if (payload.schema !== DEMA_STAND_SCHEMA) return reject("schema_mismatch");
  if (payload.truth_label !== DEMA_STAND_TRUTH_LABEL) {
    return reject("truth_label_mismatch");
  }
  if (typeof payload.content_hash !== "string") {
    return reject("content_hash_missing");
  }
  const { content_hash, ...body } = payload;
  const recomputed = `sha256:${sha256(stableStringify(body))}`;
  if (recomputed !== content_hash) return reject("content_hash_mismatch");
  const boundary = payload.boundary ?? {};
  for (const [key, value] of Object.entries(boundary)) {
    if (value !== false) return reject(`boundary_not_false:${key}`);
  }
  const rebuilt = buildDemaStandPayload(payload.input);
  if (rebuilt.rejected === true) return reject("embedded_input_invalid");
  if (rebuilt.content_hash !== content_hash) {
    return reject("derived_fields_mismatch");
  }
  const na = payload.next_action;
  if (!na || typeof na !== "object" || Array.isArray(na) || !isText(na.id) || !isText(na.label)) {
    return reject("next_action_must_be_exactly_one");
  }
  return Object.freeze({
    ok: true,
    reason_code: "dema_stand_valid",
    schema: DEMA_STAND_SCHEMA,
    truth_label: DEMA_STAND_TRUTH_LABEL,
    content_hash,
  });
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject.
export function runDemaStand({ consent, input } = {}) {
  const boundary = demaStandBoundary();
  const plan = planDemaStand({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_STAND_SCHEMA,
      truth_label: DEMA_STAND_TRUTH_LABEL,
      blocked_by: plan.blocked_by,
      boundary,
    });
  }
  const payload = buildDemaStandPayload(input);
  const verdict = verifyDemaStand(payload);
  const blocked_by = [];
  if (verdict.ok !== true) blocked_by.push(`verify_failed:${verdict.reason_code}`);
  const tampered = verifyDemaStand({ ...payload, truth_label: "FORGED" });
  if (tampered.ok !== false) blocked_by.push("tamper_check_failed");
  if (blocked_by.length > 0) {
    return Object.freeze({
      ok: false,
      schema: DEMA_STAND_SCHEMA,
      truth_label: DEMA_STAND_TRUTH_LABEL,
      blocked_by: Object.freeze(blocked_by),
      boundary,
    });
  }
  return Object.freeze({
    ok: true,
    schema: DEMA_STAND_SCHEMA,
    truth_label: DEMA_STAND_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary,
    blocked_by: Object.freeze([]),
    payload,
  });
}
