// BIZRA Node0: Sovereign Proofworld — core types

export type TruthLabel =
  | "VERIFIED"
  | "DECLARED"
  | "DESIGNED_NOT_LIVE"
  | "UNKNOWN"
  | "LOCAL_ONLY"
  | "READY_LOCAL"
  | "PUBLIC_SAFE"
  | "READY_REMOTE"
  | "PREVIEW_ONLY";

export type ResourceKey =
  | "compute"
  | "dataOre"
  | "cleanData"
  | "evidenceShards"
  | "consentKeys"
  | "receiptCrystals"
  | "trustScore"
  | "snrEnergy"
  | "ihsanQuality"
  | "nodeHealth"
  | "xp"
  | "impactTokens";

export type AgentId =
  | "nodeGuardian"
  | "truthBinder"
  | "fateSentinel"
  | "proofsmith"
  | "ciRanger"
  | "memoryCartographer"
  | "dataAlchemist"
  | "modelTamer"
  | "patWhisperer"
  | "satJudge"
  | "resourceSteward"
  | "genesisArchitect"
  // dema-alpha: the 13th display identity (outside the 7 PAT + 5 SAT fleet).
  // Canonical role facts live in fleet-canon.ts (DEMA_ALPHA); this union slot
  // lets the presentation AgentDef carry it without an unsafe cast.
  | "dema-alpha";

export type SceneId =
  | "corridor"
  | "world"
  | "claimBinding"
  | "consentGate"
  | "proofForge"
  | "ciRaid"
  | "dataRefine"
  | "nodeHealth"
  | "memoryMap"
  | "blackboard"
  | "genesis"
  | "ceremony"
  | "codex"
  | "nodeStatus"
  | "ecosystem"
  | "diagnostics"
  | "melae";

export type MissionId =
  | "bindClaim"
  | "repairChain"
  | "cleanForest"
  | "consentTrial"
  | "blackboardTrial"
  | "ciRaid"
  | "genesisScope"
  | "nodeRestore"
  | "proofForgeMission"
  | "readyLocal";

export type AgentColor =
  | "proof"
  | "consent"
  | "verified"
  | "knowledge"
  | "fail"
  | "unknown"
  | "snr";

export interface AgentDef {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  powers: string[];
  resource: string;
  weakness: string;
  boundary?: string;
  color: AgentColor;
  glyph: string; // single rune-like char
  zone: ZoneId;
  skillTree: { name: string; level: number; desc: string }[];
  // BIZRA canon role binding (12 role contracts: 7 PAT + 5 SAT)
  roleId?: string;
  team?: "PAT" | "SAT" | null;
  serves?: "user" | "system";
  family?: string;
  truthLabel?: TruthLabel;
}

export type ZoneId =
  | "citadel"
  | "compute"
  | "dataForest"
  | "proofForge"
  | "consentGate"
  | "patSanctuary"
  | "satTribunal"
  | "genesisVault"
  | "urpMarket"
  | "federationHorizon";

export interface ZoneDef {
  id: ZoneId;
  name: string;
  short: string;
  description: string;
  truthLabel: TruthLabel;
  glyph: string;
  color: AgentDef["color"];
  locked?: boolean;
  lockReason?: string;
  scene?: SceneId;
  agent: AgentId;
  pos: { x: number; y: number };
}

export interface ClaimCard {
  id: string;
  text: string;
  evidence: string;
  correct: TruthLabel;
  decoy?: TruthLabel;
}

export type ConsentDecision = "ALLOW" | "EXACT_CONSENT" | "FAIL_CLOSED";

export interface ConsentScenario {
  id: string;
  action: string;
  detail: string;
  correct: ConsentDecision;
  explanation: string;
}

export type GateState = "idle" | "running" | "passed" | "failed";

export interface CiGateStep {
  id: string;
  name: string;
  desc: string;
  weight: number;
}

export interface Receipt {
  id: string;
  label: string;
  hash: string;
  mission: MissionId;
  rails: { formal: boolean; cryptographic: boolean; empirical: boolean; economic: boolean };
  createdAt: number;
}

export interface MissionResult {
  stars: number;
  completedAt: number;
  overclaims: number;
  consentMistakes: number;
}

export interface ProofRails {
  formal: boolean;
  cryptographic: boolean;
  empirical: boolean;
  economic: boolean;
}
