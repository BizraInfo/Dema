// ============================================================================
// Resource vs Asset semantics — a typed distinction so telemetry observation
// can never accidentally become an "accepted asset" claim.
//
//   HOST_RESOURCE      — a raw local measurement (cpu/ram/storage/gpu/model).
//                         This is what src/lib/telemetry/node-resources-core.ts
//                         produces. It carries no provenance, no mission-ref,
//                         no truth_label beyond MEASURED/UNAVAILABLE/UNKNOWN.
//
//   DISCOVERED_ITEM     — something noticed while scanning a HOST_RESOURCE
//                         (e.g. an ollama model entry, a mount point). Still
//                         not an asset: no id, no provenance, no acceptance.
//
//   ASSET_CANDIDATE     — a DISCOVERED_ITEM promoted with an id + provenance
//                         + mission-ref + truth_label. Still not accepted —
//                         a candidate is a proposal, not a fact.
//
//   HUMAN_ACCEPTED_ASSET — the ONLY state where a human verdict exists. This
//                         gate (Step 6/7 telemetry work) MUST NOT create one.
//                         Acceptance is a separate, explicit, human-gated path
//                         that does not exist in this slice.
//
// This file is types + doc only — no runtime wiring. Nothing in this repo
// slice may synthesize a HUMAN_ACCEPTED_ASSET from telemetry.
// ============================================================================

export interface HostResource {
  kind: "cpu" | "ram" | "storage" | "gpu" | "model";
  observed: true;
}

export interface DiscoveredItem {
  kind: "discovered_item";
  sourceResource: HostResource["kind"];
  label: string;
}

export interface AssetCandidate {
  kind: "asset_candidate";
  id: string;
  provenance: string;
  missionRef: string;
  truth_label: "DECLARED" | "PREVIEW_ONLY" | "UNKNOWN";
}

export interface HumanAcceptedAsset {
  kind: "human_accepted_asset";
  id: string;
  acceptedBy: string; // human identifier
  acceptedAt: string; // ISO 8601
  candidate: AssetCandidate;
}
