// FACE-CORRESPONDENCE-1A — bind runtime Ready to birth-loop node_state.
//
// Doctor/status historically reported adapter `ready:true` while `dema start`
// classified the same home as PARTIAL_NODE. That join launders face failure
// into progress. This kernel is pure: no fs/net/clock; callers supply both
// sides of the join.

export const FACE_CORRESPONDENCE_SCHEMA = "bizra.dema.face_correspondence.v0.1";
export const FACE_CORRESPONDENCE_TRUTH_LABEL = "FACE_CORRESPONDENCE_PREVIEW_ONLY";

export const FACE_INCOMPLETE_NODE_STATES = Object.freeze([
  "NEW_NODE",
  "PARTIAL_NODE",
  "CORRUPT_NODE",
]);

export const FACE_COMPLETE_NODE_STATES = Object.freeze(["EXISTING_NODE"]);

/**
 * @param {{ runtime_ready?: boolean, node_state?: string|null }} input
 * @returns {Readonly<{
 *   schema: string,
 *   truth_label: string,
 *   ok: boolean,
 *   binding: "BOUND"|"UNBOUND",
 *   face_ready: boolean,
 *   runtime_ready: boolean,
 *   node_state: string|null,
 *   profile_complete: boolean|null,
 *   ceiling_label: string,
 *   reasons: readonly string[],
 *   authority_delta: 0,
 * }>}
 */
export function assessFaceCorrespondence({
  runtime_ready = false,
  node_state = null,
} = {}) {
  const ready = Boolean(runtime_ready);
  const state =
    typeof node_state === "string" && node_state.length > 0 ? node_state : null;
  const reasons = [];

  if (state === null) {
    return Object.freeze({
      schema: FACE_CORRESPONDENCE_SCHEMA,
      truth_label: FACE_CORRESPONDENCE_TRUTH_LABEL,
      ok: true,
      binding: "UNBOUND",
      face_ready: false,
      runtime_ready: ready,
      node_state: null,
      profile_complete: null,
      ceiling_label: ready
        ? "RUNTIME_READY_PROFILE_UNBOUND"
        : "RUNTIME_NOT_READY_PROFILE_UNBOUND",
      reasons: Object.freeze(["node_state_omitted"]),
      authority_delta: 0,
    });
  }

  const profileComplete = FACE_COMPLETE_NODE_STATES.includes(state);
  const profileIncomplete = FACE_INCOMPLETE_NODE_STATES.includes(state);

  if (!profileComplete && !profileIncomplete) {
    reasons.push(`unknown_node_state:${state}`);
  }
  if (profileIncomplete) {
    reasons.push(`profile_incomplete:${state}`);
  }
  if (ready && profileIncomplete) {
    reasons.push("runtime_ready_with_incomplete_profile");
  }

  const faceReady = ready && profileComplete;
  const ok = !(ready && profileIncomplete) && reasons.every(
    (r) => !r.startsWith("unknown_node_state:"),
  );

  let ceiling_label;
  if (faceReady) ceiling_label = "FACE_READY";
  else if (ready && profileIncomplete)
    ceiling_label = "RUNTIME_READY_FACE_INCOMPLETE";
  else if (!ready && profileComplete)
    ceiling_label = "PROFILE_OK_RUNTIME_NOT_READY";
  else if (!ready && profileIncomplete)
    ceiling_label = "FACE_AND_RUNTIME_INCOMPLETE";
  else ceiling_label = "FACE_CORRESPONDENCE_UNKNOWN";

  return Object.freeze({
    schema: FACE_CORRESPONDENCE_SCHEMA,
    truth_label: FACE_CORRESPONDENCE_TRUTH_LABEL,
    ok,
    binding: "BOUND",
    face_ready: faceReady,
    runtime_ready: ready,
    node_state: state,
    profile_complete: profileComplete,
    ceiling_label,
    reasons: Object.freeze(reasons),
    authority_delta: 0,
  });
}

/** Human-readable Ready line that never collapses face into runtime alone. */
export function formatReadyForFace({ runtime_ready, node_state }) {
  const c = assessFaceCorrespondence({ runtime_ready, node_state });
  if (c.binding === "UNBOUND") return String(Boolean(runtime_ready));
  if (c.face_ready) return "true";
  if (c.runtime_ready && c.profile_complete === false) {
    return `true (runtime only — profile ${c.node_state}; face not ready)`;
  }
  return String(Boolean(runtime_ready));
}
