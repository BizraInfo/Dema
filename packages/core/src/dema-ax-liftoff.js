// DEMA-AX-LIFTOFF-1A — minimum companion AX special case: one non-chat
// "flow strip" projected from measured Dema-face + soak + halt gates.
//
// WHY THIS EXISTS
// Chatbot UX collapses bonded presence into a transcript. The Experience
// liftoff is the opposite: one glanceable strip (Herdr-shaped "Needs you" /
// presence NEEDS_HUMAN grammar) over verified local truth. This kernel is
// PURE — it plans/renders nothing that executes, mints, or widens authority.
//
// WHAT IT CONSUMES (caller-supplied measurements — never invented here)
//   dema_face:      { ready?: boolean, operational?: boolean, verdict?: string }
//   soak_runtime:   { unit_active?: boolean, freeze?: { drift_count?: number },
//                     samples?: { last_ok?: boolean, last_mission_verdict?: string } }
//   halt_gates_exact: string[]  (exact GO phrases still blocking outward acts)
//
// WHAT IT EMITS
//   One frozen strip: flow_state + mode + headline + needs_you[].
//   Truth labels stay honest: never NODE0_CLOSED, never RSI_LIVE.

export const AX_LIFTOFF_SCHEMA = "bizra.dema.ax_liftoff_strip.v0.1";
export const AX_LIFTOFF_TRUTH_LABEL = "DEMA_AX_LIFTOFF_PREVIEW_LOCAL";
export const AX_LIFTOFF_GO_PHRASE = "GO: dema ax liftoff preview";

export const AX_FLOW_STATES = Object.freeze([
  "IN_FLOW",
  "BLOCKED",
  "HOLD",
  "UNKNOWN",
]);

export const AX_MODES = Object.freeze([
  "FLOW",
  "NEEDS_YOU",
  "HOLD",
  "UNKNOWN",
]);

export function demaAxLiftoffBoundary() {
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

function asObj(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? x : null;
}

function asGates(x) {
  if (!Array.isArray(x)) return null;
  if (!x.every((g) => typeof g === "string" && g.trim().length > 0)) return null;
  return x.map((g) => g.trim());
}

/**
 * Project one AX liftoff strip from measured inputs. Fail-closed to UNKNOWN
 * when inputs are malformed. Never invents soak health or Node0 closure.
 */
export function projectAxLiftoffStrip({
  dema_face = null,
  soak_runtime = null,
  halt_gates_exact = [],
  now = null,
} = {}) {
  const face = asObj(dema_face);
  const soak = asObj(soak_runtime);
  const gates = asGates(halt_gates_exact);

  if (!face || gates === null) {
    return Object.freeze({
      schema: AX_LIFTOFF_SCHEMA,
      truth_label: AX_LIFTOFF_TRUTH_LABEL,
      generated_at: typeof now === "string" ? now : null,
      mode: "UNKNOWN",
      flow_state: "UNKNOWN",
      headline: "AX strip unavailable",
      subtitle: "inputs_malformed",
      needs_you: Object.freeze([]),
      dema_ready: null,
      soak_in_flow: null,
      authority_delta: 0,
      boundary: demaAxLiftoffBoundary(),
      what_this_proves: "Fail-closed refusal of a malformed AX projection.",
      what_this_does_not_prove: "Node0 closed, RSI live, or a rendered UI.",
      ok: false,
      reason: "inputs_malformed",
    });
  }

  const dema_ready = face.ready === true && face.operational === true;
  const freezeDrift = Number(soak?.freeze?.drift_count);
  const samples = asObj(soak?.samples) || {};
  const soak_in_flow =
    soak?.unit_active === true &&
    (Number.isFinite(freezeDrift) ? freezeDrift === 0 : false) &&
    samples.last_ok === true &&
    samples.last_mission_verdict === "CLEAN";

  const needs_you = Object.freeze([...gates]);
  const blocked = needs_you.length > 0;

  let mode;
  let flow_state;
  let headline;
  let subtitle;
  let reason;

  if (!dema_ready) {
    mode = "HOLD";
    flow_state = "HOLD";
    headline = "Dema face not ready";
    subtitle = typeof face.verdict === "string" ? face.verdict : "face_not_ready";
    reason = "dema_face_not_ready";
  } else if (blocked) {
    mode = "NEEDS_YOU";
    flow_state = "BLOCKED";
    headline = `Needs you · ${needs_you.length} gate${needs_you.length === 1 ? "" : "s"}`;
    subtitle = "Exact consent required before outward acts";
    reason = "halt_gates_present";
  } else if (soak?.unit_active === true && !soak_in_flow) {
    mode = "HOLD";
    flow_state = "HOLD";
    headline = "Soak live · attention";
    subtitle = "unit active but sample/freeze not CLEAN";
    reason = "soak_not_in_flow";
  } else if (soak_in_flow) {
    mode = "FLOW";
    flow_state = "IN_FLOW";
    headline = "In flow · Dema ready · soak CLEAN";
    subtitle = "Companion strip green on measured local truth only";
    reason = "measured_in_flow";
  } else {
    mode = "FLOW";
    flow_state = "IN_FLOW";
    headline = "In flow · Dema ready";
    subtitle = "No soak unit; face ready; no halt gates";
    reason = "face_ready_no_halts";
  }

  return Object.freeze({
    schema: AX_LIFTOFF_SCHEMA,
    truth_label: AX_LIFTOFF_TRUTH_LABEL,
    generated_at: typeof now === "string" ? now : null,
    mode,
    flow_state,
    headline,
    subtitle,
    needs_you,
    dema_ready,
    soak_in_flow: soak_in_flow === true,
    authority_delta: 0,
    boundary: demaAxLiftoffBoundary(),
    what_this_proves:
      "One non-chat AX strip projected from caller-measured face/soak/halt inputs.",
    what_this_does_not_prove:
      "NODE0_CLOSED, RSI live, OpenBot/Herdr integration, UI ship, or listener clearance.",
    ok: true,
    reason,
  });
}

/** Human-facing strip (pure). Intention first; machinery last. */
export function formatAxLiftoffStrip(strip = {}) {
  const gates = Array.isArray(strip.needs_you) ? strip.needs_you : [];
  const lines = [
    `DEMA · AX LIFTOFF · ${strip.flow_state || "UNKNOWN"}`,
    strip.headline || "(no headline)",
    strip.subtitle || "",
    "",
    `NEEDS YOU (${gates.length}):`,
    ...(gates.length ? gates.map((g) => `  - ${g}`) : ["  (none)"]),
    "",
    "PROOF",
    `  dema_ready     ${strip.dema_ready === true}`,
    `  soak_in_flow   ${strip.soak_in_flow === true}`,
    `  authority_delta ${strip.authority_delta === 0 ? 0 : strip.authority_delta}`,
    `  truth_label    ${strip.truth_label || "UNKNOWN"}`,
  ];
  return lines.join("\n");
}
