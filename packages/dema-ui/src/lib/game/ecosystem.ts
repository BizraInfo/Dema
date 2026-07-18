// BIZRA Node0 — Autopoietic Ecosystem data (Layer 4: Multi-Agent Organization)
// Standing on the shoulders of AgentOffice (spatial office) + Hermes (inspectable loop) + LangGraph/Langfuse (structural lens)

import type { AgentColor } from "./types";

// ---------------------------------------------------------------------------
// 11 ORGANIZATIONAL AGENTS (Layer 4) — the office workers you SEE move
//
// NOTE: This is a NON-FLEET, office-simulation-only roster (spatial minigame
// job functions). It is NOT the 12-role BIZRA agent fleet and does not
// compete with it as an authoritative source — the canonical 7 PAT + 5 SAT
// + DEMA_ALPHA fleet lives in ./fleet-canon.ts. Only "pat" and "sat" below
// are loose visual stand-ins for the whole PAT/SAT teams, not individual
// fleet roles.
// ---------------------------------------------------------------------------
export type OrgAgentId =
  | "pat"
  | "sat"
  | "architect"
  | "planner"
  | "security"
  | "qa"
  | "performance"
  | "documentation"
  | "research"
  | "release"
  | "observability";

export interface OrgAgentDef {
  id: OrgAgentId;
  name: string;
  role: string;
  glyph: string;
  color: AgentColor;
  soul: string; // SOUL.md one-liner personality
  station: string; // home workstation id
  powers: string[];
}

export const ORG_AGENTS: OrgAgentDef[] = [
  {
    id: "planner",
    name: "Planner",
    role: "Decomposes intent into a routed task plan.",
    glyph: "🗂",
    color: "proof",
    soul: "Calm, methodical. Never starts work without a written plan.",
    station: "plannerDesk",
    powers: ["Intent Decomposition", "Route Planning", "Task Handoff"],
  },
  {
    id: "architect",
    name: "Architect",
    role: "Designs structural changes & evaluates architecture rails.",
    glyph: "📐",
    color: "consent",
    soul: "Thinks in systems. Sees coupling before it bites.",
    station: "forge",
    powers: ["Structural Design", "Coupling Audit", "Architecture Verdict"],
  },
  {
    id: "pat",
    name: "PAT",
    role: "Private Agent Team — proposes, drafts, self-critiques.",
    glyph: "🌙",
    color: "knowledge",
    soul: "Creative but humble. Never certifies itself.",
    station: "blackboard",
    powers: ["Propose", "Draft", "Self-Critique"],
  },
  {
    id: "sat",
    name: "SAT",
    role: "Sovereign Audit Tribunal — verifies, rejects, gates.",
    glyph: "🏛",
    color: "verified",
    soul: "Strict but fair. Never secretly executes user work.",
    station: "blackboard",
    powers: ["Verify", "Reject", "Permit Preview"],
  },
  {
    id: "security",
    name: "Security",
    role: "Scans surface, secrets & dependency risk.",
    glyph: "🛡",
    color: "fail",
    soul: "Paranoid by default. Trusts nothing until scanned.",
    station: "securityLab",
    powers: ["Surface Scan", "Secret Detection", "Dependency Audit"],
  },
  {
    id: "qa",
    name: "QA",
    role: "Runs tests, regression & integration checks.",
    glyph: "🧪",
    color: "verified",
    soul: "Loves a red test. Hates a flaky one.",
    station: "qaBay",
    powers: ["Test Swarm", "Regression Sweep", "Integration Check"],
  },
  {
    id: "performance",
    name: "Performance",
    role: "Measures latency, memory & build time.",
    glyph: "⚡",
    color: "snr",
    soul: "Fast is a feature. Slow is a bug.",
    station: "perfBench",
    powers: ["Latency Probe", "Memory Profile", "Build Timer"],
  },
  {
    id: "documentation",
    name: "Documentation",
    role: "Writes & refreshes docs, ADRs, freshness checks.",
    glyph: "📚",
    color: "knowledge",
    soul: "If it isn't documented, it didn't happen.",
    station: "docsDesk",
    powers: ["Doc Coverage", "ADR Authoring", "Freshness Audit"],
  },
  {
    id: "research",
    name: "Research",
    role: "Explores alternatives, benchmarks, captures lessons.",
    glyph: "🔭",
    color: "knowledge",
    soul: "Curious. Asks 'what else could this be?'",
    station: "researchLib",
    powers: ["Alternative Search", "Benchmark", "Lesson Capture"],
  },
  {
    id: "release",
    name: "Release",
    role: "Gates delivery, emits release verdict & deploys.",
    glyph: "🚀",
    color: "consent",
    soul: "Cautious at the gate. No green, no go.",
    station: "releaseBay",
    powers: ["Release Verdict", "Deploy (preview)", "Rollback"],
  },
  {
    id: "observability",
    name: "Observability",
    role: "Watches production telemetry & feeds the loop.",
    glyph: "📡",
    color: "snr",
    soul: "Always watching. Feeds the loop.",
    station: "observatory",
    powers: ["Telemetry", "Anomaly Detect", "Loop Feedback"],
  },
];

export const orgAgentById = (id: string) =>
  ORG_AGENTS.find((a) => a.id === id);

// ---------------------------------------------------------------------------
// 12 WORKSTATIONS — the themed zones of the office floor (percentage coords)
// ---------------------------------------------------------------------------
export interface Workstation {
  id: string;
  name: string;
  glyph: string;
  color: AgentColor;
  pos: { x: number; y: number };
  desc: string;
}

export const WORKSTATIONS: Workstation[] = [
  { id: "intake", name: "Intake", glyph: "📥", color: "unknown", pos: { x: 12, y: 16 }, desc: "Where intents enter the loop." },
  { id: "plannerDesk", name: "Planner Desk", glyph: "🗂", color: "proof", pos: { x: 42, y: 12 }, desc: "Intent → routed task plan." },
  { id: "blackboard", name: "Blackboard", glyph: "🖤", color: "knowledge", pos: { x: 50, y: 40 }, desc: "PAT/SAT consensus surface." },
  { id: "securityLab", name: "Security Lab", glyph: "🛡", color: "fail", pos: { x: 10, y: 44 }, desc: "Surface, secrets & dependency scans." },
  { id: "qaBay", name: "QA Bay", glyph: "🧪", color: "verified", pos: { x: 18, y: 78 }, desc: "Test swarm, regression, integration." },
  { id: "perfBench", name: "Perf Bench", glyph: "⚡", color: "snr", pos: { x: 44, y: 82 }, desc: "Latency, memory, build timing." },
  { id: "docsDesk", name: "Docs Desk", glyph: "📚", color: "knowledge", pos: { x: 80, y: 26 }, desc: "Documentation & ADR authoring." },
  { id: "researchLib", name: "Research Library", glyph: "🔭", color: "knowledge", pos: { x: 86, y: 10 }, desc: "Alternatives, benchmarks, lessons." },
  { id: "forge", name: "Proof Forge", glyph: "⚒", color: "proof", pos: { x: 88, y: 50 }, desc: "Hash chains, receipts, manifests." },
  { id: "releaseBay", name: "Release Bay", glyph: "🚀", color: "consent", pos: { x: 80, y: 80 }, desc: "Release verdict & preview deploy." },
  { id: "observatory", name: "Observatory", glyph: "📡", color: "snr", pos: { x: 93, y: 66 }, desc: "Telemetry & loop feedback." },
  { id: "approvalGate", name: "Approval Gate", glyph: "🜪", color: "consent", pos: { x: 56, y: 62 }, desc: "Human approval. Sovereign authority." },
];

export const stationById = (id: string) =>
  WORKSTATIONS.find((w) => w.id === id);

// ---------------------------------------------------------------------------
// AUTOPOIETIC LOOP — Layer 2 (10 stages, cyclic)
// ---------------------------------------------------------------------------
export interface AutopoieticStage {
  id: string;
  name: string;
  glyph: string;
  color: AgentColor;
  desc: string;
  station: string; // which workstation hosts this stage
}

export const AUTOPOIETIC_STAGES: AutopoieticStage[] = [
  { id: "observe", name: "Observe", glyph: "👁", color: "snr", desc: "Telemetry & intent enter the loop.", station: "observatory" },
  { id: "detect", name: "Detect", glyph: "📡", color: "snr", desc: "Anomaly / opportunity detected.", station: "observatory" },
  { id: "explain", name: "Explain", glyph: "💭", color: "knowledge", desc: "Research frames the finding.", station: "researchLib" },
  { id: "generate", name: "Generate Candidate", glyph: "🌙", color: "knowledge", desc: "PAT proposes a candidate.", station: "blackboard" },
  { id: "verify", name: "Verify", glyph: "⛓", color: "proof", desc: "SAT + rails verify the candidate.", station: "blackboard" },
  { id: "evaluate", name: "Evaluate", glyph: "⚖", color: "consent", desc: "Score & blast-radius assessed.", station: "approvalGate" },
  { id: "approve", name: "Human Approval", glyph: "🜪", color: "consent", desc: "Sovereign consent gate.", station: "approvalGate" },
  { id: "integrate", name: "Integrate", glyph: "🏗", color: "verified", desc: "Merged into the node graph.", station: "forge" },
  { id: "measure", name: "Measure", glyph: "📊", color: "snr", desc: "Outcome metrics captured.", station: "perfBench" },
  { id: "learn", name: "Learn", glyph: "✦", color: "consent", desc: "Lesson → memory graph. Loop repeats.", station: "researchLib" },
];

// ---------------------------------------------------------------------------
// VERIFICATION MESH — Layer 5 (10 rails)
// ---------------------------------------------------------------------------
export interface VerificationRail {
  id: string;
  name: string;
  color: AgentColor;
  agent: OrgAgentId;
  desc: string;
  required: boolean; // required for a proposal to integrate
}

export const VERIFICATION_RAILS: VerificationRail[] = [
  { id: "formal", name: "Formal", color: "proof", agent: "architect", desc: "Type & spec checks pass.", required: true },
  { id: "empirical", name: "Empirical", color: "verified", agent: "qa", desc: "Tests & telemetry confirm behavior.", required: true },
  { id: "security", name: "Security", color: "fail", agent: "security", desc: "No unsafe surface or secrets.", required: true },
  { id: "performance", name: "Performance", color: "snr", agent: "performance", desc: "Within latency/memory budget.", required: false },
  { id: "architecture", name: "Architecture", color: "consent", agent: "architect", desc: "Coupling/cohesion acceptable.", required: true },
  { id: "economic", name: "Economic", color: "consent", agent: "release", desc: "Impact accounting (PREVIEW).", required: false },
  { id: "documentation", name: "Documentation", color: "knowledge", agent: "documentation", desc: "Docs & ADR fresh.", required: false },
  { id: "regression", name: "Regression", color: "verified", agent: "qa", desc: "No regressions introduced.", required: true },
  { id: "integration", name: "Integration", color: "verified", agent: "release", desc: "Integrates with the node graph.", required: true },
  { id: "humanReview", name: "Human Review", color: "consent", agent: "sat", desc: "Sovereign human sign-off.", required: true },
];

// ---------------------------------------------------------------------------
// OFFICE TASK TEMPLATES — what flows through the office
// Each task has a route of workstation ids; the agent at each station works it.
// ---------------------------------------------------------------------------
export interface TaskTemplate {
  id: string;
  title: string;
  glyph: string;
  color: AgentColor;
  route: string[]; // workstation ids to visit in order
  desc: string;
  baseTicks: number; // ticks per station step
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "refactor-proof",
    title: "Refactor proof forge module",
    glyph: "⚒",
    color: "proof",
    route: ["intake", "plannerDesk", "securityLab", "qaBay", "forge", "releaseBay"],
    desc: "Improve hash-chain resilience; re-verify all rails.",
    baseTicks: 3,
  },
  {
    id: "add-regression",
    title: "Add regression test for consent ladder",
    glyph: "🧪",
    color: "verified",
    route: ["intake", "plannerDesk", "qaBay", "forge", "observatory"],
    desc: "Cover the L0–L5 ladder; capture empirical proof.",
    baseTicks: 3,
  },
  {
    id: "optimize-snr",
    title: "Optimize retrieval SNR",
    glyph: "📶",
    color: "snr",
    route: ["intake", "researchLib", "perfBench", "blackboard", "forge"],
    desc: "Raise signal-to-noise of the retrieval path.",
    baseTicks: 4,
  },
  {
    id: "document-doctrine",
    title: "Document the BIND doctrine",
    glyph: "📚",
    color: "knowledge",
    route: ["intake", "docsDesk", "researchLib", "forge"],
    desc: "Refresh ADR for the BIND; audit freshness.",
    baseTicks: 3,
  },
  {
    id: "security-audit",
    title: "Security audit of daemon surface",
    glyph: "🛡",
    color: "fail",
    route: ["intake", "securityLab", "qaBay", "blackboard", "releaseBay"],
    desc: "Scan daemon surface for unsafe egress.",
    baseTicks: 4,
  },
  {
    id: "memory-refactor",
    title: "Compress memory graph context",
    glyph: "🧭",
    color: "knowledge",
    route: ["intake", "researchLib", "perfBench", "forge", "observatory"],
    desc: "Lossless context compression for retrieval.",
    baseTicks: 3,
  },
];

// ---------------------------------------------------------------------------
// SOVEREIGN BOOT — onboarding ceremony steps
// ---------------------------------------------------------------------------
export interface OathStep {
  id: string;
  title: string;
  glyph: string;
  body: string;
  action: string; // button label
}

export const OATH_STEPS: OathStep[] = [
  {
    id: "spawn",
    title: "Spawn the Node",
    glyph: "⬡",
    body: "Your device becomes a Human Sovereign Node. Nothing leaves this machine without your consent. This is Layer 0 — immutable.",
    action: "Initialize Node0",
  },
  {
    id: "meet",
    title: "The Agents Materialize",
    glyph: "✦",
    body: "Eleven organizational agents assemble in the office — Planner, Architect, PAT, SAT, Security, QA, Performance, Documentation, Research, Release, Observability. Each has a SOUL and a boundary. They work for you; never the reverse.",
    action: "Welcome the agents",
  },
  {
    id: "loop",
    title: "The Autopoietic Loop Ignites",
    glyph: "⟳",
    body: "Observe → Detect → Explain → Generate → Verify → Evaluate → Approve → Integrate → Measure → Learn. The loop turns forever, but every meaningful change stops at Human Approval. You are the final authority.",
    action: "Ignite the loop",
  },
  {
    id: "oath",
    title: "The Sovereign Oath",
    glyph: "🜪",
    body: "Power without proof is overclaim. Autonomy without consent is violation. Knowledge without evidence is noise. A sovereign node earns trust by closing one verified gate at a time. Do you consent to govern this node?",
    action: "I consent — take the oath",
  },
  {
    id: "mission",
    title: "First Mission Granted",
    glyph: "◈",
    body: "The ecosystem is live. Open the Living Office to watch your agents work. Travel the world map to bind claims, pass consent gates, and forge proof. Seal READY_LOCAL when all rails hold.",
    action: "Enter the Ecosystem →",
  },
];
