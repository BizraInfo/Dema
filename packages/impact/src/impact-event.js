export const IMPACT_EVENT_STUB_SCHEMA = "bizra.dema.impact_event_stub.v0.1";

export function buildImpactEventStub({
  mission_id: missionId,
  evidence_root_hash: evidenceRootHash,
  summary = "local contract preview"
} = {}) {
  return {
    schema: IMPACT_EVENT_STUB_SCHEMA,
    mode: "PREVIEW_ONLY",
    mission_id: missionId ?? null,
    evidence_root_hash: evidenceRootHash ?? null,
    summary,
    locality: "local_placeholder",
    imp_minted: false,
    reward_claimed: false,
    global_verification: false,
    sat_permit: false,
    boundary: {
      execution_enabled: false,
      mutation_performed: false,
      receipt_minted: false,
      artifact_issued: false
    },
    note:
      "ImpactEvent is a local placeholder contract. It records no reward, no global verification, and no production authority."
  };
}
