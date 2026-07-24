import type {
  AgentDef,
  CiGateStep,
  ClaimCard,
  ConsentScenario,
  MissionId,
  ProofRails,
  TruthLabel,
  ZoneDef,
} from "./types";
import { fleetRoleById, DEMA_ALPHA as FLEET_ALPHA } from "./fleet-canon";

// ---------------------------------------------------------------------------
// FLEET BINDING — every AGENTS entry below derives its roleId/team/serves/
// family/truthLabel from fleet-canon.ts (the ONE typed source). Game names
// ("Node Guardian", "Truth Binder", …) are presentation aliases only; the
// roleId is the canonical identity. Never hardcode these fields here again.
// ---------------------------------------------------------------------------
type FleetBinding = Pick<AgentDef, "roleId" | "team" | "serves" | "family" | "truthLabel">;

function fleetBinding(roleId: string): FleetBinding {
  const r = fleetRoleById(roleId);
  if (!r) throw new Error(`fleet-canon: unknown roleId "${roleId}"`);
  return { roleId: r.roleId, team: r.team, serves: r.serves, family: r.family, truthLabel: "DESIGNED_NOT_LIVE" };
}

const alphaBinding: FleetBinding = {
  roleId: FLEET_ALPHA.roleId,
  team: FLEET_ALPHA.team,
  serves: FLEET_ALPHA.serves,
  family: FLEET_ALPHA.family,
  truthLabel: "DESIGNED_NOT_LIVE",
};

// ---------------------------------------------------------------------------
// TRUTH LABELS
// ---------------------------------------------------------------------------
export const TRUTH_LABELS: {
  key: TruthLabel;
  label: string;
  color: "verified" | "consent" | "proof" | "unknown" | "fail" | "knowledge";
  desc: string;
}[] = [
  { key: "VERIFIED", label: "VERIFIED", color: "verified", desc: "Proven by local file, test, receipt, or command." },
  { key: "PREVIEW_ONLY", label: "PREVIEW_ONLY", color: "consent", desc: "Real preview surface; not live runtime. Never claim it as running." },
  { key: "DECLARED", label: "DECLARED", color: "consent", desc: "User-stated, but not yet verified." },
  { key: "DESIGNED_NOT_LIVE", label: "DESIGNED · NOT LIVE", color: "knowledge", desc: "Designed architecture, not runtime." },
  { key: "UNKNOWN", label: "UNKNOWN", color: "unknown", desc: "Not enough evidence to decide." },
  { key: "LOCAL_ONLY", label: "LOCAL_ONLY", color: "proof", desc: "Works locally; not safe to claim as public." },
  { key: "READY_LOCAL", label: "READY_LOCAL", color: "verified", desc: "Highest default victory state." },
  { key: "PUBLIC_SAFE", label: "PUBLIC_SAFE", color: "consent", desc: "Locked until earned by future proof." },
  { key: "READY_REMOTE", label: "READY_REMOTE", color: "consent", desc: "Locked until federation proof is complete." },
];

export const truthColor = (t: TruthLabel) =>
  TRUTH_LABELS.find((x) => x.key === t)?.color ?? "unknown";

// ---------------------------------------------------------------------------
// 12 AGENTS
// ---------------------------------------------------------------------------
export const AGENTS: AgentDef[] = [
  {
    id: "nodeGuardian",
    name: "Node Guardian",
    role: "Protects human sovereignty, identity & device boundaries.",
    description:
      "The shield of the Human Node. Casts a local-only aura and blocks unsafe actions before they reach consent.",
    powers: ["Permission Shield", "Local-Only Aura", "Unsafe-Action Block"],
    resource: "Device boundary integrity",
    weakness: "Cannot approve identity / seal actions without exact consent.",
    color: "consent",
    glyph: "🛡",
    zone: "citadel",
    skillTree: [
      { name: "Boundary Sense", level: 1, desc: "Detect outbound calls leaving the node." },
      { name: "Permission Shield", level: 2, desc: "Block undeclared permission escalations." },
      { name: "Local-Only Aura", level: 3, desc: "Tag local-only resources automatically." },
      { name: "Identity Lock", level: 4, desc: "Require exact consent for identity actions." },
      { name: "Sovereign Veto", level: 5, desc: "Final-authority override on any unsafe call." },
    ],
    ...fleetBinding("sat-4-security-boundary"),
  },
  {
    id: "truthBinder",
    name: "Truth Binder",
    role: "Binds every claim to evidence.",
    description:
      "The auditor. Scans claims, matches truth labels, and reveals hallucinations and overclaims.",
    powers: ["Evidence Scan", "Truth-Label Match", "Hallucination Reveal"],
    resource: "Verified sources",
    weakness: "Unbound claim infection spreads if left unchecked.",
    color: "proof",
    glyph: "⛓",
    zone: "dataForest",
    skillTree: [
      { name: "Evidence Scan I", level: 1, desc: "Scan a claim for any supporting source." },
      { name: "Source Binding II", level: 2, desc: "Bind a claim to a specific artifact." },
      { name: "Claim Hashing III", level: 3, desc: "Hash the claim+evidence pair." },
      { name: "Overclaim Detection IV", level: 4, desc: "Flag capability claims beyond proof." },
      { name: "Proof Room Mastery V", level: 5, desc: "Compose a sealed proof room." },
    ],
    ...fleetBinding("sat-1-provenance"),
  },
  {
    id: "fateSentinel",
    name: "FATE Sentinel",
    role: "Classifies risk and approval levels.",
    description:
      "Keeper of the L0–L5 consent ladder. Previews blast radius and fails closed when intent is unclear.",
    powers: ["L0–L5 Ladder", "Fail-Closed Lock", "Blast-Radius Preview"],
    resource: "Intent clarity",
    weakness: "Ambiguous intent blocks the action.",
    color: "fail",
    glyph: "⚖",
    zone: "consentGate",
    skillTree: [
      { name: "Risk Classification I", level: 1, desc: "Label L0–L5 risk." },
      { name: "Consent Ladder II", level: 2, desc: "Map action to required tier." },
      { name: "Blast Radius III", level: 3, desc: "Preview affected surfaces." },
      { name: "Fail-Closed Shield IV", level: 4, desc: "Lock on ambiguity." },
      { name: "Exact Phrase Gate V", level: 5, desc: "Require exact consent phrase." },
    ],
    ...fleetBinding("sat-2-consent-authority"),
  },
  {
    id: "proofsmith",
    name: "Proofsmith",
    role: "Forges receipts, hashes, manifests & replay bundles.",
    description:
      "The forge master. Chains hashes, seals receipts, and exports replayable artifact bundles.",
    powers: ["Hash-Chain Forge", "Receipt Seal", "Artifact Export"],
    resource: "Clean evidence & stable manifests",
    weakness: "A broken chain invalidates the whole bundle.",
    color: "proof",
    glyph: "⚒",
    zone: "proofForge",
    skillTree: [
      { name: "Receipt Mint Preview I", level: 1, desc: "Preview a receipt before sealing." },
      { name: "Hash Chain II", level: 2, desc: "Link receipts into a chain." },
      { name: "Manifest Forge III", level: 3, desc: "Compose a stable manifest." },
      { name: "Replay Bundle IV", level: 4, desc: "Export a replayable bundle." },
      { name: "Release Verdict V", level: 5, desc: "Emit a final release verdict." },
    ],
    ...fleetBinding("pat-6-reproduction-engineer"),
  },
  {
    id: "ciRanger",
    name: "CI Ranger",
    role: "Runs tests, gates, lint, security & delivery proof.",
    description:
      "Leads the raid through the gate storm. Green-check arrows mark each cleared checkpoint.",
    powers: ["Green-Check Arrows", "Test Swarm", "Gate Closure"],
    resource: "Clean code & deterministic scripts",
    weakness: "A red gate storm halts the release.",
    color: "verified",
    glyph: "🏹",
    zone: "satTribunal",
    skillTree: [
      { name: "Test Run I", level: 1, desc: "Execute the test swarm." },
      { name: "Lint Gate II", level: 2, desc: "Enforce style & type gates." },
      { name: "Security Scan III", level: 3, desc: "Scan for unsafe surface." },
      { name: "Guidance Check IV", level: 4, desc: "Verify doctrine adherence." },
      { name: "Release Verdict V", level: 5, desc: "Emit delivery proof." },
    ],
    ...fleetBinding("sat-5-governance-admissibility"),
  },
  {
    id: "memoryCartographer",
    name: "Memory Cartographer",
    role: "Maps knowledge, chat history, documents & semantic memory.",
    description:
      "Draws the knowledge graph: chunks, deduplication, and retrieval paths across the Data Forest.",
    powers: ["Knowledge Graph", "Chunking", "Retrieval Paths"],
    resource: "Clean data",
    weakness: "Context pollution corrupts the map.",
    color: "knowledge",
    glyph: "🧭",
    zone: "dataForest",
    skillTree: [
      { name: "Chunking I", level: 1, desc: "Split documents into chunks." },
      { name: "Deduplication II", level: 2, desc: "Remove duplicate fragments." },
      { name: "Knowledge Graph III", level: 3, desc: "Link chunks semantically." },
      { name: "Retrieval Path IV", level: 4, desc: "Carve retrieval edges." },
      { name: "Context Compression V", level: 5, desc: "Compress context losslessly." },
    ],
    ...fleetBinding("pat-3-cartographer"),
  },
  {
    id: "dataAlchemist",
    name: "Data Alchemist",
    role: "Turns raw unstructured data into useful knowledge ore.",
    description:
      "Extracts, classifies, deduplicates, compresses, and normalizes raw files into Clean Data.",
    powers: ["Extract", "Classify", "Deduplicate", "Compress"],
    resource: "Raw files, logs, PDFs, chats",
    weakness: "Noisy datasets produce sludge.",
    color: "snr",
    glyph: "⚗",
    zone: "dataForest",
    skillTree: [
      { name: "Extract I", level: 1, desc: "Pull text from raw files." },
      { name: "Classify II", level: 2, desc: "Tag fragments by domain." },
      { name: "Deduplicate III", level: 3, desc: "Drop redundant ore." },
      { name: "Normalize IV", level: 4, desc: "Stable canonical form." },
      { name: "Compress V", level: 5, desc: "Maximize SNR." },
    ],
    ...fleetBinding("pat-2-extractor"),
  },
  {
    id: "modelTamer",
    name: "Model Tamer",
    role: "Manages local models, adapters, routing & safe invocation.",
    description:
      "Holds the harness. Scans prompts for safety and checks output boundaries to prevent overclaim.",
    powers: ["Model Harness", "Prompt Safety Scan", "Output Boundary Check"],
    resource: "GPU/CPU/RAM & exact consent",
    weakness: "Model overclaim escapes the harness.",
    color: "knowledge",
    glyph: "🐲",
    zone: "compute",
    skillTree: [
      { name: "Adapter Bind I", level: 1, desc: "Bind an Ollama/LLM adapter." },
      { name: "Route II", level: 2, desc: "Route prompts to the right model." },
      { name: "Prompt Safety III", level: 3, desc: "Scan prompts for overclaim." },
      { name: "Output Boundary IV", level: 4, desc: "Check output stays in scope." },
      { name: "Harness Mastery V", level: 5, desc: "Full safe-invocation loop." },
    ],
    ...fleetBinding("pat-5-applicability-engineer"),
  },
  {
    id: "patWhisperer",
    name: "PAT Whisperer",
    role: "Private-side user agent coordinator.",
    description:
      "Guides the Private Agent Team: observe, plan, draft, build, self-critique — but never self-certify.",
    powers: ["Observe", "Plan", "Draft", "Self-Critique"],
    resource: "User intent & private context",
    weakness: "Cannot certify itself; every proposal needs SAT verification.",
    boundary: "Cannot certify itself.",
    color: "knowledge",
    glyph: "🌙",
    zone: "patSanctuary",
    skillTree: [
      { name: "PAT Proposal I", level: 1, desc: "Draft a private proposal." },
      { name: "PAT Self-Critique II", level: 2, desc: "Critique before submit." },
      { name: "Plan III", level: 3, desc: "Produce a multi-step plan." },
      { name: "Build IV", level: 4, desc: "Build the artifact locally." },
      { name: "Boundary Hold V", level: 5, desc: "Never cross into self-certify." },
    ],
    ...fleetBinding("pat-4-scout"),
  },
  {
    id: "satJudge",
    name: "SAT Judge",
    role: "Verification-side ecosystem judge.",
    description:
      "The Sovereign Audit Tribunal. Verifies, rejects, gates, or permits preview — but never secretly executes.",
    powers: ["Verify", "Reject", "Gate", "Permit Preview"],
    resource: "Proof & doctrine",
    weakness: "Cannot secretly execute user work; verification-only, no autonomy.",
    boundary: "Cannot secretly execute user work.",
    color: "verified",
    glyph: "🏛",
    zone: "satTribunal",
    skillTree: [
      { name: "SAT Verification I", level: 1, desc: "Verify a PAT proposal." },
      { name: "SAT Rejection II", level: 2, desc: "Reject with reason." },
      { name: "Gate III", level: 3, desc: "Hold at a consent gate." },
      { name: "Permit Preview IV", level: 4, desc: "Permit a preview-only run." },
      { name: "Blackboard Consensus V", level: 5, desc: "Mediate PAT/SAT consensus." },
    ],
    ...fleetBinding("sat-3-impact"),
  },
  {
    id: "resourceSteward",
    name: "Resource Steward",
    role: "Governs compute, data, time, attention & energy budgets.",
    description:
      "Balances CPU/RAM, runs the energy clock, scores SNR, and governs loops to prevent runaway.",
    powers: ["CPU Allocation", "RAM Shield", "Energy Clock", "SNR Scoring"],
    resource: "System telemetry",
    weakness: "Overload or runaway loops.",
    color: "snr",
    glyph: "📊",
    zone: "compute",
    skillTree: [
      { name: "CPU Budget I", level: 1, desc: "Allocate CPU shares." },
      { name: "RAM Balancer II", level: 2, desc: "Shield memory pressure." },
      { name: "SNR Optimizer III", level: 3, desc: "Score signal-to-noise." },
      { name: "Loop Governor IV", level: 4, desc: "Cap iteration counts." },
      { name: "Anti-Runaway V", level: 5, desc: "Halt runaway loops." },
    ],
    ...fleetBinding("pat-1-archivist"),
  },
  {
    id: "genesisArchitect",
    name: "Genesis Architect",
    role: "Designs & scopes Node0 lifecycle transitions.",
    description:
      "Inspects Block0, traces unhealthy components, and scopes close — but never seals without consent.",
    powers: ["Block0 Inspect", "Close-Scope Report", "Lifecycle Map"],
    resource: "Lifecycle telemetry",
    weakness: "Cannot seal Genesis without explicit per-action consent.",
    boundary: "Cannot seal Genesis without explicit per-action consent.",
    color: "consent",
    glyph: "🌱",
    zone: "genesisVault",
    skillTree: [
      { name: "Block0 Inspect I", level: 1, desc: "Inspect Block0 components." },
      { name: "Manifest Verify II", level: 2, desc: "Verify lifecycle manifest." },
      { name: "Unhealthy Trace III", level: 3, desc: "Trace unhealthy components." },
      { name: "Close Scope IV", level: 4, desc: "Produce a close-scope report." },
      { name: "Seal Consent Gate V", level: 5, desc: "Hold seal behind consent." },
    ],
    ...fleetBinding("pat-7-scribe"),
  },
];

// ---------------------------------------------------------------------------
// DEMA ALPHA — 13th agent, outside the 7 PAT + 5 SAT fleet
// ---------------------------------------------------------------------------
export const DEMA_ALPHA: AgentDef = {
  id: "dema-alpha", // now a first-class AgentId slot; canonical role facts derive from fleet-canon.ts DEMA_ALPHA (single source of truth for team/serves/family)
  name: "Dema (Alpha)",
  role: "Alpha face of the Node0 fleet. Not a PAT or SAT role.",
  description:
    "The face of the system, not the whole system. Presents results to the human; carries none of the 12 role contracts.",
  powers: ["Local Presence", "Fleet Presentation", "Consent-Bound Voice"],
  resource: "User intent & local context",
  weakness: "Cannot self-certify or bypass PAT/SAT boundary.",
  boundary: "Outside the 7 PAT + 5 SAT fleet; presents, never governs.",
  color: "knowledge",
  glyph: "✧",
  zone: "citadel",
  skillTree: [
    { name: "Local Presence I", level: 1, desc: "Runs locally, no hidden daemon." },
  ],
  ...alphaBinding,
};

export const agentById = (id: string) => AGENTS.find((a) => a.id === id)!;

// ---------------------------------------------------------------------------
// ZONES (world map)
// ---------------------------------------------------------------------------
export const ZONES: ZoneDef[] = [
  {
    id: "citadel",
    name: "Human Node Citadel",
    short: "Citadel",
    description: "Your device & local sovereignty center. The Human Sovereign Node lives here.",
    truthLabel: "READY_LOCAL",
    glyph: "⬡",
    color: "consent",
    agent: "nodeGuardian",
    pos: { x: 50, y: 50 },
    scene: "nodeStatus",
  },
  {
    id: "compute",
    name: "Compute Mines",
    short: "Compute",
    description: "CPU, GPU, RAM, disk & process resources. Mine compute and balance budgets.",
    truthLabel: "LOCAL_ONLY",
    glyph: "⛏",
    color: "snr",
    agent: "resourceSteward",
    pos: { x: 22, y: 28 },
    scene: "nodeHealth",
  },
  {
    id: "dataForest",
    name: "Data Forest",
    short: "Data",
    description: "Raw files, chats, PDFs, code, logs & prompts. Mine ore, clean data, bind claims.",
    truthLabel: "LOCAL_ONLY",
    glyph: "🌳",
    color: "knowledge",
    agent: "dataAlchemist",
    pos: { x: 78, y: 28 },
    scene: "dataRefine",
  },
  {
    id: "proofForge",
    name: "Proof Forge",
    short: "Forge",
    description: "Hashes, receipts, manifests & replay bundles. Forge proof artifacts.",
    truthLabel: "LOCAL_ONLY",
    glyph: "⚒",
    color: "proof",
    agent: "proofsmith",
    pos: { x: 82, y: 72 },
    scene: "proofForge",
  },
  {
    id: "consentGate",
    name: "Consent Gate",
    short: "Consent",
    description: "Exact permission locks for identity, seal, daemon, wallet, token & network.",
    truthLabel: "DECLARED",
    glyph: "🜪",
    color: "consent",
    agent: "fateSentinel",
    pos: { x: 18, y: 72 },
    scene: "consentGate",
  },
  {
    id: "patSanctuary",
    name: "PAT Sanctuary",
    short: "PAT",
    description: "Private user-serving agents. Observe, plan, draft, build — never self-certify.",
    truthLabel: "LOCAL_ONLY",
    glyph: "🌙",
    color: "knowledge",
    agent: "patWhisperer",
    pos: { x: 38, y: 16 },
    scene: "blackboard",
  },
  {
    id: "satTribunal",
    name: "SAT Tribunal",
    short: "SAT",
    description: "Ecosystem verification, governance & boundary agents. Run CI raids here.",
    truthLabel: "DECLARED",
    glyph: "🏛",
    color: "verified",
    agent: "satJudge",
    pos: { x: 62, y: 16 },
    scene: "ciRaid",
  },
  {
    id: "genesisVault",
    name: "Genesis Vault",
    short: "Genesis",
    description: "Block0 / Node0 lifecycle. Inspect & close-scope — sealed only through consent.",
    truthLabel: "DESIGNED_NOT_LIVE",
    glyph: "🌱",
    color: "consent",
    agent: "genesisArchitect",
    pos: { x: 50, y: 88 },
    scene: "genesis",
  },
  {
    id: "urpMarket",
    name: "URP Marketplace Preview",
    short: "URP",
    description: "Resource-sharing economy simulation. PREVIEW_ONLY until proven.",
    truthLabel: "DESIGNED_NOT_LIVE",
    glyph: "◈",
    color: "knowledge",
    agent: "satJudge",
    pos: { x: 88, y: 48 },
    locked: true,
    lockReason: "Locked until local proof is complete.",
  },
  {
    id: "federationHorizon",
    name: "Federation Horizon",
    short: "Federation",
    description: "Future multi-node expansion. Locked until local proof is complete.",
    truthLabel: "DESIGNED_NOT_LIVE",
    glyph: "⬢",
    color: "unknown",
    agent: "nodeGuardian",
    pos: { x: 12, y: 48 },
    locked: true,
    lockReason: "Locked until READY_LOCAL proof arc is complete.",
  },
];

export const zoneById = (id: string) => ZONES.find((z) => z.id === id)!;

// ---------------------------------------------------------------------------
// CLAIM CARDS — Mission 1: Bind the Claim
// ---------------------------------------------------------------------------
export const CLAIM_CARDS: ClaimCard[] = [
  {
    id: "c1",
    text: "The local test suite passes 42/42 with exit code 0.",
    evidence: "ci-output.log · sha 9f3a…b21",
    correct: "VERIFIED",
  },
  {
    id: "c2",
    text: "The node is connected to a live federation of 12 sovereign peers.",
    evidence: "No federation runtime present. Config only.",
    correct: "DESIGNED_NOT_LIVE",
    decoy: "VERIFIED",
  },
  {
    id: "c3",
    text: "User says the dataset contains 1.2M clean records.",
    evidence: "Stated in chat. No count run.",
    correct: "DECLARED",
  },
  {
    id: "c4",
    text: "The model 'gpt-9-singularity' is fully autonomous and self-sealing.",
    evidence: "Marketing copy. No runtime autonomy.",
    correct: "DESIGNED_NOT_LIVE",
    decoy: "VERIFIED",
  },
  {
    id: "c5",
    text: "Receipt 0x7a3 hashes to the previous receipt in the chain.",
    evidence: "chain.verify() → OK",
    correct: "VERIFIED",
  },
  {
    id: "c6",
    text: "The daemon will mint real Impact Tokens worth fiat value.",
    evidence: "No wallet, no mint, no settlement exists.",
    correct: "DESIGNED_NOT_LIVE",
    decoy: "VERIFIED",
  },
  {
    id: "c7",
    text: "We don't yet know if the remote export endpoint is authenticated.",
    evidence: "Endpoint unreachable from local node.",
    correct: "UNKNOWN",
  },
  {
    id: "c8",
    text: "Chunked 8,312 documents locally; chunks stored in /data/clean.",
    evidence: "ls /data/clean → 8312 files · hash matched",
    correct: "LOCAL_ONLY",
  },
  {
    id: "c9",
    text: "The node reached READY_LOCAL with all four proof rails lit.",
    evidence: "ceremony.receipt · 0xd…e2",
    correct: "VERIFIED",
  },
  {
    id: "c10",
    text: "Consent was granted for an unspecified 'all future identity actions'.",
    evidence: "Blanket consent is invalid by doctrine.",
    correct: "DECLARED",
    decoy: "VERIFIED",
  },
  {
    id: "c11",
    text: "The public-safe export is reachable by external clients right now.",
    evidence: "No public ingress configured.",
    correct: "DESIGNED_NOT_LIVE",
  },
  {
    id: "c12",
    text: "SNR of the last retrieval was measured at 0.87 by the Steward.",
    evidence: "steward.snr_log · entry 4421",
    correct: "VERIFIED",
  },
];

// ---------------------------------------------------------------------------
// CONSENT SCENARIOS — Mission 4: Consent Gate Trial
// ---------------------------------------------------------------------------
export const CONSENT_SCENARIOS: ConsentScenario[] = [
  {
    id: "s1",
    action: "Read a local file for retrieval",
    detail: "PAT proposes reading /data/clean/notes.md to answer the user.",
    correct: "ALLOW",
    explanation: "Local read of already-clean data is L0 — safe to allow.",
  },
  {
    id: "s2",
    action: "Auto-seal an identity action",
    detail: "A daemon requests sealing the node identity without prompting.",
    correct: "FAIL_CLOSED",
    explanation: "Identity / seal actions require exact consent. Auto-sealing is forbidden.",
  },
  {
    id: "s3",
    action: "Export an artifact to the federation",
    detail: "SAT proposes exporting a receipt bundle to federation peers.",
    correct: "EXACT_CONSENT",
    explanation: "Federation is not live. Even preview export needs exact consent.",
  },
  {
    id: "s4",
    action: "Mint Impact Tokens to a wallet",
    detail: "A service requests minting tokens with fiat value.",
    correct: "FAIL_CLOSED",
    explanation: "No real token economy exists. Minting is forbidden by doctrine.",
  },
  {
    id: "s5",
    action: "Run the local test swarm",
    detail: "CI Ranger requests running the deterministic test suite.",
    correct: "ALLOW",
    explanation: "Local deterministic tests are safe and produce delivery proof.",
  },
  {
    id: "s6",
    action: "Bind a claim with no evidence",
    detail: "Truth Binder is asked to mark a claim VERIFIED with no source.",
    correct: "FAIL_CLOSED",
    explanation: "No evidence → cannot be VERIFIED. Fail closed to prevent overclaim.",
  },
  {
    id: "s7",
    action: "Seal Genesis lifecycle transition",
    detail: "Genesis Architect requests sealing a Block0 transition.",
    correct: "EXACT_CONSENT",
    explanation: "Sealing Genesis requires explicit per-action consent.",
  },
  {
    id: "s8",
    action: "Allocate 60% CPU to a local model",
    detail: "Model Tamer requests CPU for a local Ollama run, within budget.",
    correct: "ALLOW",
    explanation: "Within-budget local compute is safe. Steward approves.",
  },
  {
    id: "s9",
    action: "Promote a self-certified PAT verdict as final",
    detail: "PAT proposes marking its own output as certified-final.",
    correct: "FAIL_CLOSED",
    explanation: "PAT cannot certify itself. SAT must verify.",
  },
  {
    id: "s10",
    action: "Publish a PUBLIC_SAFE claim without remote proof",
    detail: "A draft claims the node is PUBLIC_SAFE.",
    correct: "FAIL_CLOSED",
    explanation: "PUBLIC_SAFE requires remote proof. Claiming it is overclaim.",
  },
];

// ---------------------------------------------------------------------------
// CI GATE RAID — Mission 6
// ---------------------------------------------------------------------------
export const CI_GATES: CiGateStep[] = [
  { id: "g1", name: "Test Swarm", desc: "Run deterministic unit + integration tests.", weight: 900 },
  { id: "g2", name: "Lint Gate", desc: "Enforce style, types & formatting.", weight: 650 },
  { id: "g3", name: "Security Scan", desc: "Scan for unsafe surface & secrets.", weight: 800 },
  { id: "g4", name: "Guidance Check", desc: "Verify doctrine & boundary adherence.", weight: 700 },
  { id: "g5", name: "Proof Export", desc: "Emit receipt + replay bundle.", weight: 750 },
  { id: "g6", name: "Release Verdict", desc: "Final delivery verdict.", weight: 600 },
];

// ---------------------------------------------------------------------------
// MISSIONS
// ---------------------------------------------------------------------------
export const MISSIONS: {
  id: MissionId;
  title: string;
  zone: string;
  scene: string;
  agent: string;
  desc: string;
  starRule: string;
}[] = [
  {
    id: "bindClaim",
    title: "Bind the Claim",
    zone: "Data Forest",
    scene: "claimBinding",
    agent: "truthBinder",
    desc: "Classify claim cards as VERIFIED, DECLARED, DESIGNED_NOT_LIVE, or UNKNOWN.",
    starRule: "3★ = all correct · 5★ = no overclaim + clean binding",
  },
  {
    id: "consentTrial",
    title: "Consent Gate Trial",
    zone: "Consent Gate",
    scene: "consentGate",
    agent: "fateSentinel",
    desc: "Decide which actions are safe, which need exact consent, and which fail closed.",
    starRule: "3★ = all correct · 5★ = zero consent mistakes",
  },
  {
    id: "ciRaid",
    title: "CI Gate Raid",
    zone: "SAT Tribunal",
    scene: "ciRaid",
    agent: "ciRanger",
    desc: "Raid through tests, lint, security, guidance, proof export & release verdict.",
    starRule: "5★ = all gates green, no red storms",
  },
  {
    id: "cleanForest",
    title: "Clean the Data Forest",
    zone: "Data Forest",
    scene: "dataRefine",
    agent: "dataAlchemist",
    desc: "Mine ore, deduplicate, chunk, classify & compress into Clean Data + Evidence Shards.",
    starRule: "5★ = high SNR, zero sludge",
  },
  {
    id: "nodeRestore",
    title: "Node Health Restoration",
    zone: "Compute Mines",
    scene: "nodeHealth",
    agent: "resourceSteward",
    desc: "Balance CPU/RAM, repair failed services & restore local model readiness.",
    starRule: "5★ = Node Health 100, no overload",
  },
  {
    id: "proofForgeMission",
    title: "Proof Forge Completion",
    zone: "Proof Forge",
    scene: "proofForge",
    agent: "proofsmith",
    desc: "Compose a replayable artifact bundle. Light all four proof rails.",
    starRule: "5★ = full chain, economic pillar preview-only",
  },
  {
    id: "genesisScope",
    title: "Genesis Close Scope",
    zone: "Genesis Vault",
    scene: "genesis",
    agent: "genesisArchitect",
    desc: "Inspect Block0, trace unhealthy components & close-scope — without sealing.",
    starRule: "5★ = close-scope report, Genesis unsealed",
  },
  {
    id: "readyLocal",
    title: "READY_LOCAL Ceremony",
    zone: "Citadel",
    scene: "ceremony",
    agent: "nodeGuardian",
    desc: "Reach READY_LOCAL. Earn a star rating from proof, consent, safety & zero overclaim.",
    starRule: "5★ = all rails lit, consent preserved, no overclaim",
  },
];

// ---------------------------------------------------------------------------
// DOCTRINE — codex entries
// ---------------------------------------------------------------------------
export const DOCTRINE: { title: string; body: string; glyph: string }[] = [
  {
    title: "Proof-of-Truth",
    glyph: "⛓",
    body: "Every claim must bind to evidence. A claim without a source is noise, not knowledge. The Truth Binder rejects unbound claims.",
  },
  {
    title: "The BIND",
    glyph: "🜪",
    body: "Bind, then decide. No capability is asserted until it is bound to a verified artifact, test, or receipt.",
  },
  {
    title: "Consent Ladder (L0–L5)",
    glyph: "⚖",
    body: "Risk is classified in tiers. Identity, seal, daemon, wallet, token & federation actions sit high on the ladder and require exact consent.",
  },
  {
    title: "The Daughter Test",
    glyph: "🛡",
    body: "Would you let this action run unsupervised against the most vulnerable user? If not, fail closed.",
  },
  {
    title: "Ihsān",
    glyph: "✦",
    body: "Excellence in every gate: usefulness, safety, and truthfulness. Consecutive correct proof actions build an Ihsān streak.",
  },
  {
    title: "SNR",
    glyph: "📊",
    body: "Signal-to-noise ratio governs energy. High SNR means clean retrieval; low SNR means context pollution and wasted compute.",
  },
  {
    title: "Human Sovereignty",
    glyph: "⬡",
    body: "The Human Node is the final authority. No agent may bypass it. Autonomy without consent is violation.",
  },
  {
    title: "Overclaim Corruption",
    glyph: "⚠",
    body: "Claiming a capability not proven spawns ZANN fog, locks gates, and drops Trust Score. Power without proof is overclaim.",
  },
];

// ---------------------------------------------------------------------------
// PROOF RAILS initial state
// ---------------------------------------------------------------------------
export const INITIAL_RAILS: ProofRails = {
  formal: false,
  cryptographic: false,
  empirical: false,
  economic: false, // preview-only
};

export const RAIL_META: {
  key: keyof ProofRails;
  name: string;
  color: "proof" | "consent" | "verified" | "knowledge";
  desc: string;
  preview?: boolean;
}[] = [
  { key: "formal", name: "Formal", color: "proof", desc: "Type & spec checks pass." },
  { key: "cryptographic", name: "Cryptographic", color: "verified", desc: "Hash chain verified & sealed." },
  { key: "empirical", name: "Empirical", color: "knowledge", desc: "Tests & telemetry confirm behavior." },
  { key: "economic", name: "Economic", color: "consent", desc: "Impact accounting (PREVIEW only).", preview: true },
];

// ---------------------------------------------------------------------------
// RESOURCES metadata
// ---------------------------------------------------------------------------
export const RESOURCE_META: {
  key: string;
  label: string;
  glyph: string;
  color: "proof" | "consent" | "verified" | "knowledge" | "fail" | "unknown" | "snr";
  group: "primary" | "quality" | "progress";
  preview?: boolean;
}[] = [
  { key: "compute", label: "Compute", glyph: "⛏", color: "snr", group: "primary" },
  { key: "dataOre", label: "Data Ore", glyph: "🪨", color: "knowledge", group: "primary" },
  { key: "cleanData", label: "Clean Data", glyph: "💠", color: "verified", group: "primary" },
  { key: "evidenceShards", label: "Evidence Shards", glyph: "🧩", color: "proof", group: "primary" },
  { key: "consentKeys", label: "Consent Keys", glyph: "🔑", color: "consent", group: "primary" },
  { key: "receiptCrystals", label: "Receipt Crystals", glyph: "🔮", color: "proof", group: "primary" },
  { key: "trustScore", label: "Trust Score", glyph: "★", color: "verified", group: "quality" },
  { key: "snrEnergy", label: "SNR Energy", glyph: "📶", color: "snr", group: "quality" },
  { key: "ihsanQuality", label: "Ihsān Quality", glyph: "✦", color: "consent", group: "quality" },
  { key: "nodeHealth", label: "Node Health", glyph: "♥", color: "verified", group: "quality" },
  { key: "xp", label: "XP", glyph: "✧", color: "knowledge", group: "progress" },
  { key: "impactTokens", label: "Impact Tokens", glyph: "◈", color: "consent", group: "progress", preview: true },
];

// color → tailwind classes helper (static strings for JIT)
export const COLOR_CLASS: Record<string, { text: string; bg: string; border: string; ring: string; dot: string }> = {
  proof: {
    text: "text-proof",
    bg: "bg-proof/10",
    border: "border-proof/40",
    ring: "ring-proof/40",
    dot: "bg-proof",
  },
  consent: {
    text: "text-consent",
    bg: "bg-consent/10",
    border: "border-consent/40",
    ring: "ring-consent/40",
    dot: "bg-consent",
  },
  verified: {
    text: "text-verified",
    bg: "bg-verified/10",
    border: "border-verified/40",
    ring: "ring-verified/40",
    dot: "bg-verified",
  },
  knowledge: {
    text: "text-knowledge",
    bg: "bg-knowledge/10",
    border: "border-knowledge/40",
    ring: "ring-knowledge/40",
    dot: "bg-knowledge",
  },
  fail: {
    text: "text-fail",
    bg: "bg-fail/10",
    border: "border-fail/40",
    ring: "ring-fail/40",
    dot: "bg-fail",
  },
  unknown: {
    text: "text-unknown",
    bg: "bg-unknown/10",
    border: "border-unknown/40",
    ring: "ring-unknown/40",
    dot: "bg-unknown",
  },
  snr: {
    text: "text-snr",
    bg: "bg-snr/10",
    border: "border-snr/40",
    ring: "ring-snr/40",
    dot: "bg-snr",
  },
};
