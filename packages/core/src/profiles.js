// Profile Intelligence Foundation Preview — `dema profiles` first slice.
//
// Truth-safe: emits deep-frozen, schema-tagged builders for the 5 actor profiles
// that compose Node0's identity layer. All builders are preview-only with
// exhaustive false boundary objects. No runtime, no federation, no mint, no
// raw-data inclusion.
//
// Operating law applied:
//   Profile before prompt.
//   PAT serves the player; SAT serves the system; user_control=false on SAT.
//   ContextCapsule includes selective whitelisted fields only — never raw
//   conversation, never full-corpus injection.

import { buildPreviewBoundary } from "./preview-boundary.js";

function buildBoundary() {
  return buildPreviewBoundary();
}

export function buildUserProfile({ operator = "MoMo", node = "Node0" } = {}) {
  return Object.freeze({
    schema: "bizra.dema.user_profile.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    owner: "user_owned",
    role: "sovereign_operator",
    loyalty: "self_and_mission",
    identity: Object.freeze({ name: operator, node }),
    authority: Object.freeze({
      can_consent: true,
      can_revoke: true,
      can_override_pat: true,
      can_override_sat: false
    }),
    status: "planned_or_preview",
    boundary: buildBoundary()
  });
}

export function buildPATProfile({ operator = "MoMo" } = {}) {
  return Object.freeze({
    schema: "bizra.dema.pat_profile.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    owner: "user_owned",
    loyalty: "user_mission",
    role: "private_think_tank",
    serves: operator,
    agents_planned: 7,
    user_control: true,
    authority: Object.freeze({
      can_propose: true,
      can_execute: false,
      can_mint: false,
      requires_consent: true
    }),
    status: "planned_or_preview",
    boundary: buildBoundary()
  });
}

export function buildSATProfile() {
  return Object.freeze({
    schema: "bizra.dema.sat_profile.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    owner: "protocol_owned",
    loyalty: "system_integrity",
    role: "system_guardian",
    agents_planned: 5,
    user_control: false,
    authority: Object.freeze({
      can_verdict: true,
      can_block: true,
      can_propose: false,
      verdicts_are: "policy_preview_until_shared_urp_runtime_proven"
    }),
    status: "policy_preview_or_stub",
    boundary: buildBoundary()
  });
}

export function buildMissionProfile({
  missionId = null,
  intent = null,
  center = "user_mission"
} = {}) {
  return Object.freeze({
    schema: "bizra.dema.mission_profile.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    center,
    missionId,
    intent,
    status: missionId ? "draft_preview" : "unset_preview",
    proposed_by: null,
    validated_by: null,
    consent_state: "not_collected",
    receipt_preview: null,
    boundary: buildBoundary()
  });
}

// Capsule selectivity: each included field is explicitly whitelisted.
// Never includes raw conversation, full evidence payloads, or untruncated
// corpus references — only schema + minimal identifier shape.
function selectUserFields(profile) {
  return Object.freeze({
    schema: profile.schema,
    role: profile.role,
    operator: profile.identity.name
  });
}

function selectPATFields(profile) {
  return Object.freeze({
    schema: profile.schema,
    role: profile.role,
    agents_planned: profile.agents_planned,
    status: profile.status
  });
}

function selectSATFields(profile) {
  return Object.freeze({
    schema: profile.schema,
    role: profile.role,
    agents_planned: profile.agents_planned,
    user_control: profile.user_control,
    status: profile.status
  });
}

function selectMissionFields(profile) {
  return Object.freeze({
    schema: profile.schema,
    center: profile.center,
    missionId: profile.missionId,
    status: profile.status
  });
}

function selectEvidenceRefs(refs) {
  if (!Array.isArray(refs)) return Object.freeze([]);
  return Object.freeze(refs.map((ref) =>
    Object.freeze({
      id: ref?.id ?? null,
      schema: ref?.schema ?? null
    })
  ));
}

export function buildContextCapsule({
  userProfile = buildUserProfile(),
  patProfile = buildPATProfile(),
  satProfile = buildSATProfile(),
  missionProfile = buildMissionProfile(),
  evidenceRefs = []
} = {}) {
  return Object.freeze({
    schema: "bizra.dema.context_capsule.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    bounded_inclusion: true,
    user: selectUserFields(userProfile),
    pat: selectPATFields(patProfile),
    sat: selectSATFields(satProfile),
    mission: selectMissionFields(missionProfile),
    evidence_refs: selectEvidenceRefs(evidenceRefs),
    boundary: buildBoundary()
  });
}

export function buildProfileFoundationPreview(options = {}) {
  const user = buildUserProfile(options);
  const pat = buildPATProfile(options);
  const sat = buildSATProfile();
  const mission = buildMissionProfile(options);
  const capsule = buildContextCapsule({
    userProfile: user,
    patProfile: pat,
    satProfile: sat,
    missionProfile: mission,
    evidenceRefs: options.evidenceRefs ?? []
  });
  return Object.freeze({
    schema: "bizra.dema.profile_foundation.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    user,
    pat,
    sat,
    mission,
    context_capsule: capsule,
    boundary: buildBoundary()
  });
}

// Summary view of profile foundation — used by `dema profiles --summary`.
// Collapses 5 nested actor structures (~205 lines pretty-printed) to a
// ~25-line view that preserves schema-tagged identity for each actor and
// keeps the canonical 16-key top-level boundary intact.
//
// Machine-grep contract preserved:
//   - schema field tagged with `_summary` suffix so consumers can distinguish
//   - truth_label preserved verbatim
//   - boundary object is the same canonical 16-key all-false object
//   - actor presence visible via per-role schema string (drift-detectable)
export function buildProfileFoundationSummary(options = {}) {
  const full = buildProfileFoundationPreview(options);
  return Object.freeze({
    schema: "bizra.dema.profile_foundation_summary.v0.1",
    truth_label: full.truth_label,
    mode: "summary",
    source_schema: full.schema,
    actors: Object.freeze({
      user: full.user.schema,
      pat: full.pat.schema,
      sat: full.sat.schema,
      mission: full.mission.schema
    }),
    context_capsule_schema: full.context_capsule.schema,
    boundary: full.boundary
  });
}
