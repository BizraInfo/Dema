// AGENT-DNA-ROOT-COHERENCE-1A · read-only coherence gate (Slice A).
//
// Proves the founding principles are ROOTED across the agent DNA — that the
// Law of Assumption and the immutable Root Canon are coherently present for
// every one of the 12 agents (PAT-7 + SAT-5), not merely asserted. Pure:
// injected inputs, same input → same verdict. It mutates nothing, signs
// nothing, changes no agent profile hash, and never touches the root canon.
//
// This is the COHERENCE layer (declared-consistency). It does NOT bind the
// root into the signed agent profile bodies — that is a separate genesis-aware
// slice (B), because signed profile bodies feed Block0 prerequisite hashes.

export const AGENT_DNA_ROOT_COHERENCE_SCHEMA =
  "bizra.dema.agent_dna_root_coherence.v0.1";

const REQUIRED_AGENT_TIERS = Object.freeze(["PAT-7 DNA", "SAT-5 DNA", "FATE DNA"]);

// Markers that must appear VERBATIM in the constitution's Law of Assumption
// section (§13). Sourced from the constitution's own wording — the gate asserts
// the canon, it does not impose phrasing on it.
const LOA_REQUIRED_MARKERS = Object.freeze([
  "Law of Assumption",
  "No agent may present assumption as fact",
  "forbids hiding uncertainty",
  "evidence boundary",
  "Ihsan",
]);

// Markers binding the immutable root canon (§14).
const ROOT_BINDING_MARKERS = Object.freeze([
  "BIZRA_ROOT_CANON",
  "root-canon.manifest.json",
]);

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

export function assessAgentDnaRootCoherence({
  rootCanon,
  agents,
  constitutionText,
  loaValidatorLive,
} = {}) {
  const text = isNonEmptyString(constitutionText) ? constitutionText : "";
  const agentList = Array.isArray(agents) ? agents : [];

  const patCount = agentList.filter((a) => a && a.agent_class === "PAT").length;
  const satCount = agentList.filter((a) => a && a.agent_class === "SAT").length;

  const checks = {
    // (1) the immutable seed is sealed
    root_canon_sealed:
      rootCanon != null &&
      rootCanon.verified === true &&
      rootCanon.result === "BIZRA_ROOT_CANON_SEALED",
    // (2) exactly the canonical 7 PAT + 5 SAT roster
    agents_complete:
      agentList.length === 12 && patCount === 7 && satCount === 5,
    // (3) the constitution covers every agent tier + the boundary gate
    constitution_covers_agents: REQUIRED_AGENT_TIERS.every((m) =>
      text.includes(m),
    ),
    // (4) the Law of Assumption is FIRST-CLASS DNA: the named section and its
    //     core duties (no-assumption-as-fact, declare the boundary, refuse to
    //     hide uncertainty, preserve Ihsan) are all present verbatim.
    constitution_has_law_of_assumption: LOA_REQUIRED_MARKERS.every((m) =>
      text.includes(m),
    ),
    // (5) the constitution binds the immutable Root Canon by name + manifest.
    constitution_binds_root_canon: ROOT_BINDING_MARKERS.every((m) =>
      text.includes(m),
    ),
    // (6) the LoA enforcement primitive is actually invocable (probed by caller)
    loa_validator_live: loaValidatorLive === true,
  };

  const missing = Object.keys(checks).filter((k) => checks[k] !== true);
  const coherent = missing.length === 0;

  return Object.freeze({
    schema: AGENT_DNA_ROOT_COHERENCE_SCHEMA,
    truth_label: coherent
      ? "AGENT_DNA_ROOT_COHERENCE_SEALED"
      : "AGENT_DNA_ROOT_COHERENCE_INCOHERENT",
    mode: "read_only",
    coherent,
    agent_roster: Object.freeze({
      total: agentList.length,
      pat: patCount,
      sat: satCount,
    }),
    checks: Object.freeze(checks),
    missing: Object.freeze(missing),
    what_this_proves:
      "The Law of Assumption and the immutable Root Canon are coherently present across the 12-agent DNA (declared-consistency).",
    what_this_does_not_prove:
      "It does not bind the root into the signed agent profile bodies, perform any signing, or seal Block0; that is a separate genesis-aware slice.",
    boundary: Object.freeze({
      filesystem_write_performed: false,
      root_modified: false,
      profile_hash_changed: false,
      signing_performed: false,
      block0_sealed: false,
      network_used: false,
      federation_invoked: false,
    }),
  });
}
