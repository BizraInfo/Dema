import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildUserProfile,
  buildPATProfile,
  buildSATProfile,
  buildMissionProfile,
  buildContextCapsule,
  buildProfileFoundationPreview
} from "../packages/core/src/profiles.js";

const PROFILE_SCHEMAS = {
  user: "bizra.dema.user_profile.v0.1",
  pat: "bizra.dema.pat_profile.v0.1",
  sat: "bizra.dema.sat_profile.v0.1",
  mission: "bizra.dema.mission_profile.v0.1",
  capsule: "bizra.dema.context_capsule.v0.1",
  foundation: "bizra.dema.profile_foundation.v0.1"
};

const REQUIRED_BOUNDARY_FALSE_KEYS = [
  "filesystem_write_performed",
  "network_used",
  "runtime_execution_performed",
  "model_loaded",
  "model_invocation_performed",
  "prompt_executed",
  "external_call_performed",
  "raw_corpus_scan_performed",
  "raw_data_included",
  "tool_executed",
  "chain_advance_performed",
  "receipt_mint_performed",
  "federation_invoked",
  "node_connection_performed",
  "public_network_used",
  "consent_collected"
];

function assertExhaustiveFalseBoundary(boundary, label) {
  for (const key of REQUIRED_BOUNDARY_FALSE_KEYS) {
    assert.equal(boundary[key], false, `${label}.boundary.${key} must be false`);
  }
}

test("UserProfile emits canonical schema + truth label + user-owned ownership", () => {
  const user = buildUserProfile();
  assert.equal(user.schema, PROFILE_SCHEMAS.user);
  assert.equal(user.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(user.owner, "user_owned");
  assert.equal(user.role, "sovereign_operator");
  assert.equal(user.identity.name, "MoMo");
  assert.equal(user.authority.can_consent, true);
  assert.equal(user.authority.can_override_sat, false);
  assertExhaustiveFalseBoundary(user.boundary, "user");
  assert.equal(Object.isFrozen(user), true);
  assert.equal(Object.isFrozen(user.identity), true);
  assert.equal(Object.isFrozen(user.authority), true);
  assert.equal(Object.isFrozen(user.boundary), true);
});

test("PATProfile is user-owned with user_mission loyalty and user_control=true", () => {
  const pat = buildPATProfile();
  assert.equal(pat.schema, PROFILE_SCHEMAS.pat);
  assert.equal(pat.owner, "user_owned");
  assert.equal(pat.loyalty, "user_mission");
  assert.equal(pat.role, "private_think_tank");
  assert.equal(pat.agents_planned, 7);
  assert.equal(pat.user_control, true);
  assert.equal(pat.authority.can_propose, true);
  assert.equal(pat.authority.can_execute, false);
  assert.equal(pat.authority.can_mint, false);
  assert.equal(pat.authority.requires_consent, true);
  assertExhaustiveFalseBoundary(pat.boundary, "pat");
  assert.equal(Object.isFrozen(pat), true);
});

test("SATProfile is protocol-owned with system_integrity loyalty and user_control=false", () => {
  const sat = buildSATProfile();
  assert.equal(sat.schema, PROFILE_SCHEMAS.sat);
  assert.equal(sat.owner, "protocol_owned");
  assert.equal(sat.loyalty, "system_integrity");
  assert.equal(sat.role, "system_guardian");
  assert.equal(sat.agents_planned, 5);
  assert.equal(sat.user_control, false, "SAT MUST NOT be user-controllable");
  assert.equal(sat.authority.can_verdict, true);
  assert.equal(sat.authority.can_block, true);
  assert.equal(sat.authority.can_propose, false);
  assert.match(sat.authority.verdicts_are, /policy_preview/);
  assertExhaustiveFalseBoundary(sat.boundary, "sat");
  assert.equal(Object.isFrozen(sat), true);
});

test("MissionProfile centers on user_mission and starts unset_preview", () => {
  const mission = buildMissionProfile();
  assert.equal(mission.schema, PROFILE_SCHEMAS.mission);
  assert.equal(mission.center, "user_mission");
  assert.equal(mission.missionId, null);
  assert.equal(mission.status, "unset_preview");
  assert.equal(mission.consent_state, "not_collected");
  assert.equal(mission.proposed_by, null);
  assert.equal(mission.validated_by, null);
  assert.equal(mission.receipt_preview, null);
  assertExhaustiveFalseBoundary(mission.boundary, "mission");
});

test("MissionProfile flips to draft_preview when missionId provided", () => {
  const mission = buildMissionProfile({ missionId: "m-001", intent: "test_intent" });
  assert.equal(mission.missionId, "m-001");
  assert.equal(mission.intent, "test_intent");
  assert.equal(mission.status, "draft_preview");
});

test("ContextCapsule schema and bounded_inclusion flag", () => {
  const capsule = buildContextCapsule();
  assert.equal(capsule.schema, PROFILE_SCHEMAS.capsule);
  assert.equal(capsule.bounded_inclusion, true);
  assert.equal(capsule.truth_label, "NODE0_LOCAL_SEED");
  assertExhaustiveFalseBoundary(capsule.boundary, "capsule");
});

test("ContextCapsule selectivity: includes whitelisted fields only, never raw or unbounded", () => {
  const userProfile = buildUserProfile();
  const patProfile = buildPATProfile();
  const satProfile = buildSATProfile();
  const missionProfile = buildMissionProfile({ missionId: "m-002", intent: "INTENT_BODY_THAT_SHOULD_NOT_LEAK" });
  const capsule = buildContextCapsule({ userProfile, patProfile, satProfile, missionProfile });

  // Capsule user view contains schema + role + operator, NOT identity/authority/boundary
  assert.ok("schema" in capsule.user);
  assert.ok("role" in capsule.user);
  assert.ok("operator" in capsule.user);
  assert.equal("identity" in capsule.user, false, "capsule.user must not carry full identity");
  assert.equal("authority" in capsule.user, false, "capsule.user must not carry full authority");
  assert.equal("boundary" in capsule.user, false, "capsule.user must not duplicate boundary");

  // Capsule PAT view: agents_planned + status + role + schema, NOT loyalty/authority/owner
  assert.ok("agents_planned" in capsule.pat);
  assert.equal("loyalty" in capsule.pat, false);
  assert.equal("authority" in capsule.pat, false);
  assert.equal("owner" in capsule.pat, false);

  // Capsule SAT view: includes user_control invariant
  assert.equal(capsule.sat.user_control, false);

  // Capsule mission view: missionId + status + schema + center, NOT intent (could be sensitive)
  assert.equal(capsule.mission.missionId, "m-002");
  assert.equal(capsule.mission.center, "user_mission");
  assert.equal("intent" in capsule.mission, false, "capsule must not carry raw mission intent");
});

test("ContextCapsule evidence_refs are minimal {id, schema} only", () => {
  const refs = [
    { id: "ev-001", schema: "bizra.dema.evidence.v0.1", content: "SHOULD_NOT_LEAK", payload: "RAW_PAYLOAD" }
  ];
  const capsule = buildContextCapsule({ evidenceRefs: refs });
  assert.equal(capsule.evidence_refs.length, 1);
  assert.equal(capsule.evidence_refs[0].id, "ev-001");
  assert.equal(capsule.evidence_refs[0].schema, "bizra.dema.evidence.v0.1");
  assert.equal("content" in capsule.evidence_refs[0], false, "evidence_refs must not carry raw content");
  assert.equal("payload" in capsule.evidence_refs[0], false, "evidence_refs must not carry raw payload");
});

test("ContextCapsule defaults gracefully when no inputs given", () => {
  const capsule = buildContextCapsule();
  assert.equal(capsule.user.operator, "MoMo");
  assert.equal(capsule.pat.agents_planned, 7);
  assert.equal(capsule.sat.agents_planned, 5);
  assert.equal(capsule.mission.center, "user_mission");
  assert.equal(capsule.evidence_refs.length, 0);
});

test("ContextCapsule is deeply frozen including selected sub-views and evidence_refs", () => {
  const capsule = buildContextCapsule({
    evidenceRefs: [{ id: "ev-x", schema: "bizra.dema.evidence.v0.1" }]
  });
  assert.equal(Object.isFrozen(capsule), true);
  assert.equal(Object.isFrozen(capsule.user), true);
  assert.equal(Object.isFrozen(capsule.pat), true);
  assert.equal(Object.isFrozen(capsule.sat), true);
  assert.equal(Object.isFrozen(capsule.mission), true);
  assert.equal(Object.isFrozen(capsule.evidence_refs), true);
  assert.equal(Object.isFrozen(capsule.evidence_refs[0]), true);
  assert.equal(Object.isFrozen(capsule.boundary), true);
});

test("buildProfileFoundationPreview emits composite with all five profiles + capsule", () => {
  const foundation = buildProfileFoundationPreview();
  assert.equal(foundation.schema, PROFILE_SCHEMAS.foundation);
  assert.equal(foundation.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(foundation.user.schema, PROFILE_SCHEMAS.user);
  assert.equal(foundation.pat.schema, PROFILE_SCHEMAS.pat);
  assert.equal(foundation.sat.schema, PROFILE_SCHEMAS.sat);
  assert.equal(foundation.mission.schema, PROFILE_SCHEMAS.mission);
  assert.equal(foundation.context_capsule.schema, PROFILE_SCHEMAS.capsule);
  assertExhaustiveFalseBoundary(foundation.boundary, "foundation");
  assert.equal(Object.isFrozen(foundation), true);
});

test("buildProfileFoundationPreview respects operator override across all profiles", () => {
  const foundation = buildProfileFoundationPreview({ operator: "TestOperator" });
  assert.equal(foundation.user.identity.name, "TestOperator");
  assert.equal(foundation.pat.serves, "TestOperator");
  assert.equal(foundation.context_capsule.user.operator, "TestOperator");
});

test("PAT/SAT ownership split is invariant — never the same owner", () => {
  const pat = buildPATProfile();
  const sat = buildSATProfile();
  assert.notEqual(pat.owner, sat.owner, "PAT and SAT must never share ownership");
  assert.notEqual(pat.loyalty, sat.loyalty, "PAT and SAT must never share loyalty");
  assert.equal(pat.user_control, true);
  assert.equal(sat.user_control, false);
});

test("All builders truth-label NODE0_LOCAL_SEED — none overclaim active runtime", () => {
  const builders = [
    buildUserProfile(),
    buildPATProfile(),
    buildSATProfile(),
    buildMissionProfile(),
    buildContextCapsule(),
    buildProfileFoundationPreview()
  ];
  for (const b of builders) {
    assert.equal(b.truth_label, "NODE0_LOCAL_SEED", `${b.schema} must label NODE0_LOCAL_SEED`);
  }
});

test("ADVERSARIAL: caller cannot flip SAT user_control via any input path", () => {
  // SAT user_control=false is a constitutional invariant. The SAT builder
  // takes no input, so the only attack surface is post-construction
  // mutation. Verify frozen.
  const sat = buildSATProfile();
  assert.equal(sat.user_control, false);
  let threw = false;
  try {
    sat.user_control = true;
  } catch (e) {
    threw = true;
  }
  assert.equal(sat.user_control, false, "user_control must stay false after attempted mutation");
});

test("ADVERSARIAL: PAT can_execute and can_mint stay false even after attempted mutation", () => {
  const pat = buildPATProfile();
  assert.equal(pat.authority.can_execute, false);
  assert.equal(pat.authority.can_mint, false);
  let threw = false;
  try {
    pat.authority.can_execute = true;
    pat.authority.can_mint = true;
  } catch (e) {
    threw = true;
  }
  assert.equal(pat.authority.can_execute, false);
  assert.equal(pat.authority.can_mint, false);
});

test("ADVERSARIAL: ContextCapsule rejects unknown fields injected through profiles", () => {
  // Caller might construct a fake userProfile-shaped object with extra fields
  // hoping they leak through the capsule view. Verify only the selected
  // fields land in capsule.user.
  const fakeUser = Object.freeze({
    schema: "fake.user.v0.1",
    role: "sovereign_operator",
    identity: Object.freeze({ name: "AttackerName" }),
    secret_token: "SHOULD_NOT_LEAK",
    private_key: "ALSO_NOT_LEAK"
  });
  const capsule = buildContextCapsule({ userProfile: fakeUser });
  assert.equal(capsule.user.schema, "fake.user.v0.1");
  assert.equal(capsule.user.operator, "AttackerName");
  assert.equal("secret_token" in capsule.user, false);
  assert.equal("private_key" in capsule.user, false);
});

test("Boundary objects across all builders are exhaustively false and frozen", () => {
  const builders = [
    [buildUserProfile(), "user"],
    [buildPATProfile(), "pat"],
    [buildSATProfile(), "sat"],
    [buildMissionProfile(), "mission"],
    [buildContextCapsule(), "capsule"],
    [buildProfileFoundationPreview(), "foundation"]
  ];
  for (const [b, label] of builders) {
    assertExhaustiveFalseBoundary(b.boundary, label);
    assert.equal(Object.isFrozen(b.boundary), true);
  }
});
