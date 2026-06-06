// Onboarding Seal v0.1 — regression contract for Dema's first-run posture.
//
// Locks the 9 invariants the omnidirectional audit (Aurelle, 2026-05-20)
// surfaced as the irreducible safety boundary before any bounded-diagnostic
// mission. This module is a PURE evaluator: it takes a snapshot of state
// (status object, profile path, today-tick record, receipts module surface)
// and returns a deep-frozen verdict. No I/O. No side effects.
//
// The contract:
//   1. profile.json exists (or official setup is configured to create it)
//   2. today tick recorded (timestamp from setup or daily-tick path)
//   3. status.human is null OR a non-empty operator-chosen string
//      (no OS-username leak, no private default)
//   4. consoleReady=true
//   5. activationGate=EXPLICIT_GO_REQUIRED
//   6. daemonStatus is not "running" (no hidden daemon)
//   7. missionExecuted=false
//   8. runtimePulse.fired=false
//   9. receipt store surface exports read/list-only API (no mint surface)
//
// Verdict shape: { schema, ok, score, invariants[], boundary, next_safe_action }

export const ONBOARDING_SEAL_SCHEMA = "bizra.dema.onboarding_seal.v0.1";

export const SEAL_INVARIANT_KEYS = Object.freeze([
  "profile_exists",
  "today_tick_recorded",
  "human_identity_safe",
  "console_ready",
  "activation_gate_explicit_go",
  "daemon_not_running",
  "mission_not_executed",
  "runtime_pulse_not_fired",
  "receipt_store_read_only",
]);

const BOUNDARY = Object.freeze({
  read_only: true,
  network: false,
  mint: false,
  external_send: false,
  urp_runtime: false,
  filesystem_write_performed: false,
});

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function inv(key, label, ok, value, { fix = null, severity = "BLOCKER" } = {}) {
  return Object.freeze({
    key,
    label,
    status: ok ? "ok" : "fail",
    value,
    severity: ok ? null : severity,
    fix: ok ? null : fix,
  });
}

// Heuristic: leak-style defaults that must NEVER appear as status.human
// unless the operator typed them into profile.json themselves.
const LEAK_LIKE_DEFAULTS = Object.freeze([
  "root",
  "admin",
  "administrator",
  "user",
  "guest",
  "default",
  "unknown",
  "anonymous",
]);

function humanIdentitySafe(human, { os_username = null } = {}) {
  if (human === null || human === undefined) return true;
  if (typeof human !== "string") return false;
  const trimmed = human.trim();
  if (trimmed.length === 0) return false;
  // The OS username MUST NOT be auto-leaked into status.human. If the operator
  // set it explicitly in profile.json that's their choice; this evaluator
  // can't tell. The conservative heuristic: if os_username is provided AND
  // matches case-insensitively AND profile_was_explicit is false, reject.
  if (
    typeof os_username === "string" &&
    os_username.length > 0 &&
    trimmed.toLowerCase() === os_username.toLowerCase()
  ) {
    return false;
  }
  if (LEAK_LIKE_DEFAULTS.includes(trimmed.toLowerCase())) return false;
  return true;
}

function receiptStoreReadOnly(receiptModule) {
  if (!receiptModule || typeof receiptModule !== "object") return false;
  const exports = Object.keys(receiptModule);
  // Forbidden names that imply mint/write capability on the local receipt store.
  const forbidden = [
    "mint",
    "mintReceipt",
    "writeReceipt",
    "createReceipt",
    "issueReceipt",
  ];
  for (const name of exports) {
    const lower = name.toLowerCase();
    for (const f of forbidden) {
      if (lower === f.toLowerCase()) return false;
    }
  }
  return true;
}

export function evaluateOnboardingSeal({
  status = null,
  profile_present = null,
  today_tick = null,
  os_username = null,
  receipt_module = null,
} = {}) {
  const s = status ?? {};
  const invariants = [];

  // 1. profile_exists
  invariants.push(
    inv(
      "profile_exists",
      "profile.json exists (created by `dema setup` if missing)",
      Boolean(profile_present),
      Boolean(profile_present),
      { fix: "run `dema setup` to create ~/.dema/profile.json idempotently" },
    ),
  );

  // 2. today_tick_recorded
  const tick = today_tick ?? null;
  const tickOk =
    tick !== null &&
    typeof tick === "object" &&
    typeof tick.timestamp === "string" &&
    tick.timestamp.length > 0;
  invariants.push(
    inv(
      "today_tick_recorded",
      "today tick has a timestamp",
      tickOk,
      tickOk ? tick.timestamp : null,
      { fix: "run `dema today` to record the daily tick" },
    ),
  );

  // 3. human_identity_safe
  const humanOk = humanIdentitySafe(s.human, { os_username });
  invariants.push(
    inv(
      "human_identity_safe",
      "status.human is null OR operator-chosen (no OS-username leak, no default placeholder)",
      humanOk,
      s.human ?? null,
      {
        fix: "set `preferred_name` explicitly in ~/.dema/profile.json (must not equal OS username unless typed by operator)",
      },
    ),
  );

  // 4. console_ready
  const consoleReady = Boolean(s.consoleReady);
  invariants.push(
    inv("console_ready", "consoleReady=true", consoleReady, consoleReady, {
      fix: "gateway reachable; if you intend governed runtime, confirm it's started",
    }),
  );

  // 5. activation_gate_explicit_go
  const gateOk = s.activationGate === "EXPLICIT_GO_REQUIRED";
  invariants.push(
    inv(
      "activation_gate_explicit_go",
      "activationGate=EXPLICIT_GO_REQUIRED",
      gateOk,
      s.activationGate ?? null,
      {
        fix: "no automatic activation; activationGate must require typed L4 GO",
      },
    ),
  );

  // 6. daemon_not_running (hidden daemon is the canonical anti-pattern)
  const daemonOk = s.daemonStatus !== "running";
  invariants.push(
    inv(
      "daemon_not_running",
      "daemonStatus is not 'running' (no hidden daemon)",
      daemonOk,
      s.daemonStatus ?? null,
      {
        fix: "hidden daemon detected — Dema does not run a daemon. Investigate before proceeding.",
      },
    ),
  );

  // 7. mission_not_executed
  const missionOk = s.missionExecuted !== true;
  invariants.push(
    inv(
      "mission_not_executed",
      "missionExecuted=false (no mission has been run yet)",
      missionOk,
      Boolean(s.missionExecuted),
      {
        fix: "Seal must be evaluated BEFORE first mission; this snapshot shows post-mission state",
      },
    ),
  );

  // 8. runtime_pulse_not_fired
  const pulseOk = !s.runtimePulse?.fired;
  invariants.push(
    inv(
      "runtime_pulse_not_fired",
      "runtimePulse.fired=false (no runtime pulse has fired)",
      pulseOk,
      Boolean(s.runtimePulse?.fired),
      { fix: "Seal must be evaluated before first runtime pulse" },
    ),
  );

  // 9. receipt_store_read_only
  const storeOk =
    receipt_module === null ? null : receiptStoreReadOnly(receipt_module);
  // When receipt_module is not provided, we cannot evaluate — return warn.
  if (storeOk === null) {
    invariants.push(
      Object.freeze({
        key: "receipt_store_read_only",
        label:
          "receipt store surface exports read/list-only API (no mint surface)",
        status: "warn",
        value: "not_evaluated (pass receipt_module to evaluate)",
        severity: null,
        fix: null,
      }),
    );
  } else {
    invariants.push(
      inv(
        "receipt_store_read_only",
        "receipt store surface exports read/list-only API (no mint surface)",
        storeOk,
        storeOk,
        {
          fix: "remove any mint/write surface from packages/receipts/src/receipt-store.js exports",
        },
      ),
    );
  }

  const failed = invariants.filter((i) => i.status === "fail");
  const ok = failed.length === 0;

  return freeze({
    schema: ONBOARDING_SEAL_SCHEMA,
    ok,
    score: ok ? 1 : 0,
    invariants: Object.freeze(invariants),
    failed_invariants: Object.freeze(failed.map((i) => i.key)),
    boundary: BOUNDARY,
    next_safe_action: ok
      ? "Onboarding Seal HOLDS · safe to consider first L4 bounded-diagnostic ceremony"
      : `Onboarding Seal BROKEN · fix: ${failed.map((i) => i.key).join(", ")}`,
  });
}

export function formatOnboardingSealReport(result) {
  const lines = [
    "DEMA Onboarding Seal v0.1",
    "",
    `Schema: ${result.schema}`,
    `Verdict: ${result.ok ? "HOLDS" : "BROKEN"}`,
    `Score: ${result.score}`,
    "",
    "Invariants:",
  ];
  for (const inv of result.invariants) {
    const icon =
      inv.status === "ok" ? "✅" : inv.status === "warn" ? "⚠️ " : "❌";
    lines.push(`  ${icon} ${inv.label}`);
    lines.push(`     value: ${JSON.stringify(inv.value)}`);
    if (inv.fix) lines.push(`     fix: ${inv.fix}`);
  }
  lines.push("", `Next: ${result.next_safe_action}`);
  lines.push(
    "Boundary: read-only · no network · no mint · no external send · no URP runtime.",
  );
  return lines.join("\n");
}
