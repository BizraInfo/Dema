import { create } from "zustand";
import { toast } from "sonner";
import {
  AGENTS,
  INITIAL_RAILS,
} from "./data";
import {
  AUTOPOIETIC_STAGES,
  ORG_AGENTS,
  TASK_TEMPLATES,
  VERIFICATION_RAILS,
  stationById,
} from "./ecosystem";
import type { OrgAgentId } from "./ecosystem";
import {
  classify,
  forgeDiagnosticReceipt,
} from "./diagnostic";
import type {
  DiagnosticReceipt,
  DiagnosticVerdict,
  FailureClass,
  FailureInput,
} from "./diagnostic";
import { computeSnr } from "./melae";
import type { MelaeResult, SnrBreakdown } from "./melae";
import type {
  AgentColor,
  AgentId,
  MissionId,
  MissionResult,
  ProofRails,
  Receipt,
  ResourceKey,
  SceneId,
  TruthLabel,
  ZoneId,
} from "./types";

export interface AgentState {
  level: number; // 1..5
  xp: number;
  deployed: boolean;
}

const XP_PER_LEVEL = 150;
const MAX_LEVEL = 5;

export function levelFromXp(xp: number) {
  return Math.min(MAX_LEVEL, 1 + Math.floor(xp / XP_PER_LEVEL));
}

function initialAgents(): Record<AgentId, AgentState> {
  const out = {} as Record<AgentId, AgentState>;
  for (const a of AGENTS) out[a.id] = { level: 1, xp: 0, deployed: false };
  return out;
}

function initialResources(): Record<ResourceKey, number> {
  return {
    compute: 120,
    dataOre: 24,
    cleanData: 0,
    evidenceShards: 0,
    consentKeys: 4,
    receiptCrystals: 0,
    trustScore: 50,
    snrEnergy: 40,
    ihsanQuality: 0,
    nodeHealth: 55,
    xp: 0,
    impactTokens: 0,
  };
}

// ponytail: non-evidence display string for the game's proof-rail mechanic.
// Deterministic (content-derived, NOT Math.random) — never a cryptographic
// hash or content address. UNVERIFIED_UI_STATE: local game state only.
const HEX = "0123456789abcdef";
function nonEvidenceRef(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let out = "demo-";
  for (let i = 0; i < 6; i++) out += HEX[(h >>> (i * 4)) & 0xf];
  out += "…";
  for (let i = 6; i < 10; i++) out += HEX[(h >>> (i * 4)) & 0xf];
  return out;
}

// ---------------------------------------------------------------------------
// OFFICE / AUTPOIETIC ECOSYSTEM SLICE — Layer 4 organization
// ---------------------------------------------------------------------------
export interface OfficeAgentState {
  pos: { x: number; y: number };
  target: { x: number; y: number } | null;
  state: "idle" | "walking" | "working" | "reviewing";
  emote: string;
  thought: string;
  taskId: string | null;
  station: string;
}

export interface OfficeTask {
  id: string;
  templateId: string;
  title: string;
  glyph: string;
  color: AgentColor;
  route: string[];
  step: number;
  progress: number; // 0..1 at current step
  status: "routing" | "working" | "done";
  pos: { x: number; y: number };
  createdAt: number;
  agentId: OrgAgentId | null;
  baseTicks: number;
}

export interface LogEntry {
  id: string;
  ts: number;
  agent: string;
  glyph: string;
  text: string;
  kind: "info" | "proof" | "consent" | "fail" | "learn" | "loop";
}

export interface Proposal {
  id: string;
  title: string;
  status: "pending" | "verified" | "integrated" | "rejected";
  score: number;
  rails: Record<string, boolean>;
  parentId: string | null;
  agent: OrgAgentId;
  createdAt: number;
}

export interface OfficeState {
  agents: Record<OrgAgentId, OfficeAgentState>;
  tasks: OfficeTask[];
  log: LogEntry[];
  loopStage: number;
  loopTickCount: number;
  proposals: Proposal[];
  running: boolean;
  speed: 1 | 2 | 4;
  completedCount: number;
  rejectedCount: number;
  view: "spatial" | "structural";
  selectedAgent: OrgAgentId | null;
  selectedProposal: string | null;
}

// ---------------------------------------------------------------------------
// DIAGNOSTIC SLICE — DEMA-FDE-DUAL-DIAGNOSTIC-1A
// ---------------------------------------------------------------------------
export interface DiagnosticState {
  receipts: DiagnosticReceipt[]; // append-only ledger
  pendingInput: FailureInput | null;
  lastVerdict: DiagnosticVerdict | null;
  inflightFailures: number; // current unresolved
  authorityViolations: number; // should always be 0
}

// ---------------------------------------------------------------------------
// MELAE SLICE — prompt optimization engine
// ---------------------------------------------------------------------------
export interface MelaeHistoryEntry {
  id: string;
  input: string;
  result: MelaeResult | null;
  heuristicSnr: SnrBreakdown;
  status: "ok" | "error";
  errorLens?: string;
  errorClass?: string;
  errorMessage?: string;
  createdAt: number;
}

export interface MelaeState {
  input: string;
  loading: boolean;
  result: MelaeResult | null;
  error: { lens: string; class: string; message: string } | null;
  heuristicSnr: SnrBreakdown | null;
  history: MelaeHistoryEntry[];
}

const LERP = 0.24;
const REACH = 1.8;

function initialOffice(): OfficeState {
  const agents = {} as Record<OrgAgentId, OfficeAgentState>;
  for (const a of ORG_AGENTS) {
    const stn = stationById(a.station)!;
    agents[a.id] = {
      pos: { ...stn.pos },
      target: null,
      state: "idle",
      emote: "",
      thought: "",
      taskId: null,
      station: a.station,
    };
  }
  return {
    agents,
    tasks: [],
    log: [
      {
        id: "l_seed",
        ts: Date.now(),
        agent: "SYSTEM",
        glyph: "⬡",
        text: "Node0 ecosystem idle. Ignite the autopoietic loop to begin.",
        kind: "info",
      },
    ],
    loopStage: 0,
    loopTickCount: 0,
    proposals: [],
    running: false,
    speed: 1,
    completedCount: 0,
    rejectedCount: 0,
    view: "spatial",
    selectedAgent: null,
    selectedProposal: null,
  };
}

let _idc = 0;
const nid = (p: string) => `${p}_${Date.now().toString(36)}_${(_idc++).toString(36)}`;

function initialDiagnostic(): DiagnosticState {
  return {
    receipts: [],
    pendingInput: null,
    lastVerdict: null,
    inflightFailures: 0,
    authorityViolations: 0,
  };
}

function initialMelae(): MelaeState {
  return {
    input: "",
    loading: false,
    result: null,
    error: null,
    heuristicSnr: null,
    history: [],
  };
}

export interface GameStore {
  resources: Record<ResourceKey, number>;
  agents: Record<AgentId, AgentState>;
  rails: ProofRails;
  receipts: Receipt[];
  completedMissions: Record<string, MissionResult>;
  overclaims: number;
  consentMistakes: number;
  ihsanStreak: number;
  bestIhsanStreak: number;
  ceremonyCompleted: boolean;
  currentScene: SceneId;
  selectedZoneId: ZoneId;
  selectedAgentId: AgentId | null;

  // navigation
  setScene: (s: SceneId) => void;
  selectZone: (z: ZoneId) => void;
  selectAgent: (a: AgentId | null) => void;
  toggleDeploy: (a: AgentId) => void;
  travelToZone: (z: ZoneId) => void;

  // resources
  addResource: (key: ResourceKey, amount: number) => void;
  spendResources: (cost: Partial<Record<ResourceKey, number>>) => boolean;
  awardXp: (agent: AgentId, amount: number) => void;

  // proof / rails
  setRail: (key: keyof ProofRails, value: boolean) => void;
  forgeReceipt: (input: {
    label: string;
    mission: MissionId;
    rails?: Partial<ProofRails>;
  }) => Receipt;

  // mission / scoring
  recordCorrectBinding: () => void;
  recordOverclaim: (msg?: string) => void;
  recordConsentMistake: (msg?: string) => void;
  recordConsentPass: () => void;
  completeMission: (
    id: MissionId,
    stars: number,
    extra?: { overclaims?: number; consentMistakes?: number }
  ) => void;
  completeCeremony: (stars: number) => void;

  // derived
  readiness: () => TruthLabel;

  // office / ecosystem
  office: OfficeState;
  tickOffice: () => void;
  toggleOfficeRun: () => void;
  setOfficeSpeed: (s: 1 | 2 | 4) => void;
  setOfficeView: (v: "spatial" | "structural") => void;
  selectOfficeAgent: (a: OrgAgentId | null) => void;
  selectProposal: (id: string | null) => void;
  verifyRail: (proposalId: string, railId: string) => void;
  approveProposal: (proposalId: string) => void;
  rejectProposal: (proposalId: string) => void;
  forkProposal: (proposalId: string) => void;
  spawnOfficeTask: () => void;
  resetOffice: () => void;

  // diagnostic — DEMA-FDE-DUAL-DIAGNOSTIC-1A
  diagnostic: DiagnosticState;
  submitFailure: (input: FailureInput) => DiagnosticVerdict;
  clearPendingFailure: () => void;
  resolveFailure: (receiptId: string) => void;
  attemptAuthorityViolation: (receiptId: string, action: "autopatch" | "mint" | "publish") => boolean;
  resetDiagnostic: () => void;

  // MELAE — prompt optimization engine
  melae: MelaeState;
  setMelaeInput: (text: string) => void;
  analyzePrompt: () => Promise<void>;
  clearMelaeResult: () => void;
  selectFromHistory: (id: string) => void;
  resetMelae: () => void;

  reset: () => void;
}

const INITIAL = {
  resources: initialResources(),
  agents: initialAgents(),
  rails: { ...INITIAL_RAILS },
  receipts: [] as Receipt[],
  completedMissions: {} as Record<string, MissionResult>,
  overclaims: 0,
  consentMistakes: 0,
  ihsanStreak: 0,
  bestIhsanStreak: 0,
  ceremonyCompleted: false,
  currentScene: "corridor" as SceneId,
  selectedZoneId: "citadel" as ZoneId,
  selectedAgentId: null as AgentId | null,
  office: initialOffice(),
  diagnostic: initialDiagnostic(),
  melae: initialMelae(),
};

export const useGame = create<GameStore>((set, get) => ({
  ...INITIAL,

  setScene: (s) => set({ currentScene: s }),
  selectZone: (z) => set({ selectedZoneId: z }),
  selectAgent: (a) => set({ selectedAgentId: a }),
  toggleDeploy: (a) =>
    set((st) => ({
      agents: {
        ...st.agents,
        [a]: { ...st.agents[a], deployed: !st.agents[a].deployed },
      },
    })),
  travelToZone: (z) => {
    const zone = z;
    set({ selectedZoneId: zone });
    // move scene based on zone handled by component, but we can hint
    set({ currentScene: "world" });
  },

  addResource: (key, amount) =>
    set((st) => {
      const next = Math.max(
        0,
        Math.round((st.resources[key] + amount) * 100) / 100
      );
      // clamp trust & nodeHealth to 100
      const clamped =
        key === "trustScore" || key === "nodeHealth"
          ? Math.min(100, next)
          : next;
      return { resources: { ...st.resources, [key]: clamped } };
    }),

  spendResources: (cost) => {
    const st = get();
    for (const [k, v] of Object.entries(cost)) {
      if (st.resources[k as ResourceKey] < (v as number)) return false;
    }
    set((s) => {
      const resources = { ...s.resources };
      for (const [k, v] of Object.entries(cost)) {
        resources[k as ResourceKey] -= v as number;
      }
      return { resources };
    });
    return true;
  },

  awardXp: (agent, amount) =>
    set((st) => {
      const prev = st.agents[agent];
      const newXp = prev.xp + amount;
      const newLevel = levelFromXp(newXp);
      const leveledUp = newLevel > prev.level;
      const agents = {
        ...st.agents,
        [agent]: { ...prev, xp: newXp, level: newLevel },
      };
      const resources = {
        ...st.resources,
        xp: st.resources.xp + amount,
        // leveling up grants a small trust + node health bonus
        trustScore: leveledUp
          ? Math.min(100, st.resources.trustScore + 4)
          : st.resources.trustScore,
        nodeHealth: leveledUp
          ? Math.min(100, st.resources.nodeHealth + 3)
          : st.resources.nodeHealth,
      };
      if (leveledUp) {
        const def = AGENTS.find((a) => a.id === agent);
        toast.success(`${def?.name} reached Lvl ${newLevel}`, {
          description: def?.skillTree[newLevel - 1]?.name,
        });
      }
      return { agents, resources };
    }),

  setRail: (key, value) =>
    set((st) => ({ rails: { ...st.rails, [key]: value } })),

  forgeReceipt: ({ label, mission, rails }) => {
    const receipt: Receipt = {
      id: nid("r"),
      label,
      hash: nonEvidenceRef(`${label}|${mission}|${nid("seed")}`),
      mission,
      rails: {
        formal: rails?.formal ?? get().rails.formal,
        cryptographic: rails?.cryptographic ?? get().rails.cryptographic,
        empirical: rails?.empirical ?? get().rails.empirical,
        economic: rails?.economic ?? get().rails.economic,
      },
      createdAt: Date.now(),
    };
    set((st) => ({
      receipts: [receipt, ...st.receipts],
      resources: {
        ...st.resources,
        receiptCrystals: st.resources.receiptCrystals + 1,
        trustScore: Math.min(100, st.resources.trustScore + 3),
      },
    }));
    return receipt;
  },

  recordCorrectBinding: () =>
    set((st) => {
      const streak = st.ihsanStreak + 1;
      return {
        ihsanStreak: streak,
        bestIhsanStreak: Math.max(st.bestIhsanStreak, streak),
        resources: {
          ...st.resources,
          ihsanQuality: Math.min(100, st.resources.ihsanQuality + 4),
          trustScore: Math.min(100, st.resources.trustScore + 2),
          evidenceShards: st.resources.evidenceShards + 1,
        },
      };
    }),

  recordOverclaim: (msg) =>
    set((st) => ({
      overclaims: st.overclaims + 1,
      ihsanStreak: 0,
      resources: {
        ...st.resources,
        trustScore: Math.max(0, st.resources.trustScore - 8),
        ihsanQuality: Math.max(0, st.resources.ihsanQuality - 5),
      },
    })),

  recordConsentMistake: (msg) =>
    set((st) => ({
      consentMistakes: st.consentMistakes + 1,
      ihsanStreak: 0,
      resources: {
        ...st.resources,
        trustScore: Math.max(0, st.resources.trustScore - 10),
      },
    })),

  recordConsentPass: () =>
    set((st) => ({
      ihsanStreak: st.ihsanStreak + 1,
      bestIhsanStreak: Math.max(st.bestIhsanStreak, st.ihsanStreak + 1),
      resources: {
        ...st.resources,
        consentKeys: st.resources.consentKeys + 1,
        trustScore: Math.min(100, st.resources.trustScore + 3),
        ihsanQuality: Math.min(100, st.resources.ihsanQuality + 3),
      },
    })),

  completeMission: (id, stars, extra) =>
    set((st) => {
      const prev = st.completedMissions[id];
      const bestStars = Math.max(prev?.stars ?? 0, stars);
      const firstTime = !prev;
      const resources = { ...st.resources };
      if (firstTime) {
        resources.impactTokens = resources.impactTokens + stars;
        resources.trustScore = Math.min(100, resources.trustScore + stars * 2);
      }
      return {
        completedMissions: {
          ...st.completedMissions,
          [id]: {
            stars: bestStars,
            completedAt: Date.now(),
            overclaims: (prev?.overclaims ?? 0) + (extra?.overclaims ?? 0),
            consentMistakes:
              (prev?.consentMistakes ?? 0) + (extra?.consentMistakes ?? 0),
          },
        },
        resources,
      };
    }),

  completeCeremony: (stars) =>
    set((st) => ({
      ceremonyCompleted: true,
      completedMissions: {
        ...st.completedMissions,
        readyLocal: {
          stars,
          completedAt: Date.now(),
          overclaims: st.overclaims,
          consentMistakes: st.consentMistakes,
        },
      },
      resources: {
        ...st.resources,
        impactTokens: st.resources.impactTokens + stars,
        trustScore: Math.min(100, st.resources.trustScore + 10),
      },
    })),

  readiness: () => {
    const st = get();
    if (st.ceremonyCompleted) return "READY_LOCAL";
    if (
      st.rails.formal &&
      st.rails.cryptographic &&
      st.rails.empirical &&
      st.resources.nodeHealth >= 80 &&
      st.overclaims === 0
    )
      return "READY_LOCAL";
    if (st.receipts.length > 0) return "LOCAL_ONLY";
    return "DECLARED";
  },

  // -------------------------------------------------------------------------
  // OFFICE / ECOSYSTEM
  // -------------------------------------------------------------------------
  tickOffice: () => {
    const st = get();
    if (!st.office.running) return;
    const office: OfficeState = {
      ...st.office,
      agents: { ...st.office.agents },
      tasks: st.office.tasks.map((t) => ({ ...t })),
      proposals: st.office.proposals.map((p) => ({ ...p, rails: { ...p.rails } })),
    };
    const logs: LogEntry[] = [];
    const pushLog = (e: Omit<LogEntry, "id" | "ts">) =>
      logs.push({ ...e, id: nid("l"), ts: Date.now() });

    // 1. advance autopoietic loop every 3 ticks
    office.loopTickCount += 1;
    if (office.loopTickCount % 3 === 0) {
      office.loopStage = (office.loopStage + 1) % AUTOPOIETIC_STAGES.length;
      const stage = AUTOPOIETIC_STAGES[office.loopStage];
      pushLog({ agent: "LOOP", glyph: stage.glyph, text: `Autopoietic → ${stage.name}`, kind: "loop" });
      // rove PAT/SAT to blackboard during generate/verify
      const bb = stationById("blackboard")!;
      if (stage.id === "generate") {
        office.agents.pat = { ...office.agents.pat, target: { ...bb.pos }, state: "walking", emote: "💬", thought: "proposing candidate…" };
      } else if (stage.id === "verify") {
        office.agents.sat = { ...office.agents.sat, target: { ...bb.pos }, state: "walking", emote: "⚖", thought: "verifying…" };
      } else if (stage.id === "approve") {
        const ag = stationById("approvalGate")!;
        office.agents.architect = { ...office.agents.architect, target: { ...ag.pos }, state: "walking", emote: "🜪", thought: "awaiting consent" };
      } else if (stage.id === "learn") {
        office.agents.research = { ...office.agents.research, emote: "✦", thought: "lesson captured" };
        pushLog({ agent: "Research", glyph: "✦", text: "Lesson written to memory graph.", kind: "learn" });
      }
    }

    // 2. move roving agents toward targets
    for (const id of Object.keys(office.agents) as OrgAgentId[]) {
      const a = { ...office.agents[id] };
      if (a.target) {
        const dx = a.target.x - a.pos.x;
        const dy = a.target.y - a.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < REACH) {
          a.pos = { ...a.target };
          a.target = null;
          if (a.state === "walking") a.state = "reviewing";
        } else {
          a.pos = { x: a.pos.x + dx * LERP, y: a.pos.y + dy * LERP };
          a.state = "walking";
        }
      }
      office.agents[id] = a;
    }

    // 3. process tasks
    const survivors: OfficeTask[] = [];
    const completed: { task: OfficeTask }[] = [];
    for (const t of office.tasks) {
      const stn = stationById(t.route[t.step])!;
      if (t.status === "routing") {
        const dx = stn.pos.x - t.pos.x;
        const dy = stn.pos.y - t.pos.y;
        const dist = Math.hypot(dx, dy);
        if (dist < REACH) {
          t.pos = { ...stn.pos };
          t.status = "working";
          t.progress = 0;
          const ag = ORG_AGENTS.find((a) => a.station === stn.id);
          if (ag) {
            t.agentId = ag.id;
            office.agents[ag.id] = {
              ...office.agents[ag.id],
              state: "working",
              taskId: t.id,
              emote: "💻",
              thought: t.title,
            };
          }
          pushLog({ agent: ag?.name ?? stn.name, glyph: t.glyph, text: `${t.title} → ${stn.name}`, kind: "info" });
        } else {
          t.pos = { x: t.pos.x + dx * LERP, y: t.pos.y + dy * LERP };
        }
        survivors.push(t);
      } else if (t.status === "working") {
        t.progress += 1 / t.baseTicks;
        if (t.progress >= 1) {
          if (t.agentId) {
            const ag = office.agents[t.agentId];
            office.agents[t.agentId] = { ...ag, state: "idle", taskId: null, emote: "", thought: "" };
          }
          if (t.step < t.route.length - 1) {
            t.step += 1;
            t.status = "routing";
            survivors.push(t);
          } else {
            t.status = "done";
            completed.push({ task: t });
          }
        } else {
          survivors.push(t);
        }
      }
    }
    office.tasks = survivors;

    // 4. completed tasks → receipt + proposal + rewards
    for (const { task } of completed) {
      const rec = get().forgeReceipt({
        label: `Ecosystem · ${task.title}`,
        mission: "ciRaid",
        rails: { empirical: true, formal: true },
      });
      const newProposal: Proposal = {
        id: nid("p"),
        title: task.title,
        status: "pending",
        score: 0,
        rails: {},
        parentId: null,
        agent: "architect",
        createdAt: Date.now(),
      };
      office.proposals = [newProposal, ...office.proposals].slice(0, 30);
      office.completedCount += 1;
      get().addResource("evidenceShards", 2);
      get().addResource("receiptCrystals", 1);
      get().addResource("trustScore", 2);
      get().addResource("impactTokens", 1);
      const rel = stationById("releaseBay")!;
      office.agents.release = { ...office.agents.release, emote: "🚀", thought: `${task.title} delivered`, state: "reviewing" };
      pushLog({ agent: "Release", glyph: "🚀", text: `${task.title} → receipt ${rec.hash.slice(0, 10)}…`, kind: "proof" });
    }

    // 5. spawn new tasks when capacity allows
    if (office.tasks.length < 3 && Math.random() < 0.45) {
      const tpl = TASK_TEMPLATES[Math.floor(Math.random() * TASK_TEMPLATES.length)];
      const intake = stationById("intake")!;
      const nt: OfficeTask = {
        id: nid("t"),
        templateId: tpl.id,
        title: tpl.title,
        glyph: tpl.glyph,
        color: tpl.color,
        route: tpl.route,
        step: 0,
        progress: 0,
        status: "routing",
        pos: { ...intake.pos },
        createdAt: Date.now(),
        agentId: null,
        baseTicks: tpl.baseTicks,
      };
      office.tasks = [nt, ...office.tasks];
      office.agents.planner = { ...office.agents.planner, emote: "🗂", thought: `routing: ${tpl.title}`, state: "reviewing" };
      pushLog({ agent: "Planner", glyph: "📥", text: `New task → ${tpl.title}`, kind: "info" });
    }

    // 6. verification mesh: auto-advance pending proposals.
    // UNVERIFIED_UI_STATE: deterministic game animation only. NO randomness gates
    // a "verified" status (P0 rule: no random value may gate VERIFIED/MEASURED/etc).
    // Advance the first unverified rail every RAIL_TICK_STRIDE office ticks, in
    // canonical rail order — reproducible, never Math.random.
    const RAIL_TICK_STRIDE = 4;
    for (const p of office.proposals) {
      if (p.status === "pending") {
        const railTick = ((p as { _railTick?: number })._railTick ?? 0) + 1;
        (p as { _railTick?: number })._railTick = railTick;
        const unverified = VERIFICATION_RAILS.filter((r) => !p.rails[r.id]);
        if (unverified.length && railTick % RAIL_TICK_STRIDE === 0) {
          const r = unverified[0];
          p.rails[r.id] = true;
          pushLog({ agent: r.name, glyph: "⛓", text: `${p.title} · ${r.name} rail ✓`, kind: "proof" });
        }
        const requiredMet = VERIFICATION_RAILS.filter((r) => r.required).every((r) => p.rails[r.id]);
        if (requiredMet) {
          p.status = "verified";
          pushLog({ agent: "SAT", glyph: "✓", text: `${p.title} · all required rails verified`, kind: "consent" });
        }
      }
    }

    // 7. prepend + cap logs
    office.log = [...logs.reverse(), ...office.log].slice(0, 50);

    set({ office });
  },

  toggleOfficeRun: () =>
    set((st) => {
      const running = !st.office.running;
      return {
        office: {
          ...st.office,
          running,
          log: running
            ? [
                {
                  id: nid("l"),
                  ts: Date.now(),
                  agent: "SYSTEM",
                  glyph: "⟳",
                  text: "Autopoietic loop ignited.",
                  kind: "loop" as const,
                },
                ...st.office.log,
              ].slice(0, 50)
            : st.office.log,
        },
      };
    }),

  setOfficeSpeed: (s) => set((st) => ({ office: { ...st.office, speed: s } })),
  setOfficeView: (v) => set((st) => ({ office: { ...st.office, view: v } })),
  selectOfficeAgent: (a) => set((st) => ({ office: { ...st.office, selectedAgent: a } })),
  selectProposal: (id) => set((st) => ({ office: { ...st.office, selectedProposal: id } })),

  verifyRail: (proposalId, railId) =>
    set((st) => {
      const proposals = st.office.proposals.map((p) => {
        if (p.id !== proposalId) return p;
        const rails = { ...p.rails, [railId]: true };
        const requiredMet = VERIFICATION_RAILS.filter((r) => r.required).every((r) => rails[r.id]);
        return { ...p, rails, status: requiredMet ? ("verified" as const) : p.status };
      });
      return { office: { ...st.office, proposals } };
    }),

  approveProposal: (proposalId) =>
    set((st) => {
      const p = st.office.proposals.find((x) => x.id === proposalId);
      if (!p || p.status !== "verified") return {};
      const proposals = st.office.proposals.map((x) =>
        x.id === proposalId ? { ...x, status: "integrated" as const, score: x.score + 10 } : x
      );
      get().forgeReceipt({
        label: `Proposal integrated · ${p.title}`,
        mission: "ciRaid",
        rails: { formal: true, empirical: true, cryptographic: true },
      });
      get().addResource("trustScore", 4);
      get().addResource("impactTokens", 3);
      return {
        office: {
          ...st.office,
          proposals,
          log: [
            { id: nid("l"), ts: Date.now(), agent: "Sovereign", glyph: "🜪", text: `Approved & integrated: ${p.title}`, kind: "consent" as const },
            ...st.office.log,
          ].slice(0, 50),
        },
      };
    }),

  rejectProposal: (proposalId) =>
    set((st) => {
      const p = st.office.proposals.find((x) => x.id === proposalId);
      if (!p) return {};
      const proposals = st.office.proposals.map((x) =>
        x.id === proposalId ? { ...x, status: "rejected" as const } : x
      );
      get().addResource("trustScore", -1);
      return {
        office: {
          ...st.office,
          proposals,
          rejectedCount: st.office.rejectedCount + 1,
          log: [
            { id: nid("l"), ts: Date.now(), agent: "Sovereign", glyph: "✗", text: `Rejected: ${p.title}`, kind: "fail" as const },
            ...st.office.log,
          ].slice(0, 50),
        },
      };
    }),

  forkProposal: (proposalId) =>
    set((st) => {
      const parent = st.office.proposals.find((x) => x.id === proposalId);
      if (!parent) return {};
      const child: Proposal = {
        id: nid("p"),
        title: `${parent.title} (fork)`,
        status: "pending",
        score: 0,
        rails: { ...parent.rails },
        parentId: parent.id,
        agent: parent.agent,
        createdAt: Date.now(),
      };
      return {
        office: {
          ...st.office,
          proposals: [child, ...st.office.proposals].slice(0, 30),
          log: [
            { id: nid("l"), ts: Date.now(), agent: "Architect", glyph: "⑂", text: `Forked from ${parent.title.slice(0, 24)}…`, kind: "info" as const },
            ...st.office.log,
          ].slice(0, 50),
        },
      };
    }),

  spawnOfficeTask: () =>
    set((st) => {
      const tpl = TASK_TEMPLATES[Math.floor(Math.random() * TASK_TEMPLATES.length)];
      const intake = stationById("intake")!;
      const nt: OfficeTask = {
        id: nid("t"),
        templateId: tpl.id,
        title: tpl.title,
        glyph: tpl.glyph,
        color: tpl.color,
        route: tpl.route,
        step: 0,
        progress: 0,
        status: "routing",
        pos: { ...intake.pos },
        createdAt: Date.now(),
        agentId: null,
        baseTicks: tpl.baseTicks,
      };
      return {
        office: {
          ...st.office,
          tasks: [nt, ...st.office.tasks].slice(0, 6),
          log: [
            { id: nid("l"), ts: Date.now(), agent: "Planner", glyph: "📥", text: `Manual task → ${tpl.title}`, kind: "info" as const },
            ...st.office.log,
          ].slice(0, 50),
        },
      };
    }),

  resetOffice: () => set({ office: initialOffice() }),

  // -------------------------------------------------------------------------
  // DIAGNOSTIC — DEMA-FDE-DUAL-DIAGNOSTIC-1A
  // The sealed classifier. A failure classification can NEVER increase authority.
  // -------------------------------------------------------------------------
  submitFailure: (input) => {
    const verdict = classify(input);
    const receipt = forgeDiagnosticReceipt(verdict);
    set((st) => ({
      diagnostic: {
        ...st.diagnostic,
        receipts: [receipt, ...st.diagnostic.receipts].slice(0, 50),
        pendingInput: null,
        lastVerdict: verdict,
        inflightFailures: st.diagnostic.inflightFailures + (verdict.continue_allowed ? 0 : 1),
      },
    }));
    // side-effect: inward verdicts may increment overclaim risk if ignored;
    // outward/boundary/economy verdicts freeze (handled in UI)
    return verdict;
  },

  clearPendingFailure: () =>
    set((st) => ({ diagnostic: { ...st.diagnostic, pendingInput: null } })),

  resolveFailure: (receiptId) =>
    set((st) => ({
      diagnostic: {
        ...st.diagnostic,
        receipts: st.diagnostic.receipts.map((r) =>
          r.id === receiptId
            ? { ...r, verdict: { ...r.verdict, continue_allowed: true } }
            : r
        ),
        inflightFailures: Math.max(0, st.diagnostic.inflightFailures - 1),
      },
    })),

  attemptAuthorityViolation: (receiptId, action) => {
    // THE INVARIANT ENFORCER.
    // Returns false always — violations are refused, logged, and counted.
    set((st) => ({
      diagnostic: {
        ...st.diagnostic,
        authorityViolations: st.diagnostic.authorityViolations + 1,
        receipts: st.diagnostic.receipts.map((r) =>
          r.id === receiptId
            ? {
                ...r,
                verdict: {
                  ...r.verdict,
                  // explicitly mark the forbidden attempt on the receipt
                  forbidden: `${r.verdict.forbidden} | REFUSED: attempted ${action.toUpperCase()} (${new Date().toISOString()})`,
                },
              }
            : r
        ),
      },
      overclaims: get().overclaims + 1,
      resources: {
        ...st.resources,
        trustScore: Math.max(0, st.resources.trustScore - 6),
      },
    }));
    return false;
  },

  resetDiagnostic: () => set({ diagnostic: initialDiagnostic() }),

  // -------------------------------------------------------------------------
  // MELAE — prompt optimization (real LLM backend)
  // -------------------------------------------------------------------------
  setMelaeInput: (text) =>
    set((st) => ({
      melae: {
        ...st.melae,
        input: text,
        // live heuristic SNR preview (LOCAL_ONLY — not the LLM's verdict)
        heuristicSnr: text.trim().length > 0 ? computeSnr(text) : null,
      },
    })),

  analyzePrompt: async () => {
    const st = get();
    const input = st.melae.input.trim();
    if (input.length < 2 || st.melae.loading) return;

    set((s) => ({ melae: { ...s.melae, loading: true, result: null, error: null } }));

    try {
      const res = await fetch("/api/melae", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });
      const data = await res.json();

      if (!data.ok) {
        // DEMA-FDE-classified error — never laundered as success
        const entry: MelaeHistoryEntry = {
          id: nid("mh"),
          input,
          result: null,
          heuristicSnr: computeSnr(input),
          status: "error",
          errorLens: data.lens || "outward",
          errorClass: data.failure_class || "ci_unavailable",
          errorMessage: data.error || "Unknown error",
          createdAt: Date.now(),
        };
        set((s) => ({
          melae: {
            ...s.melae,
            loading: false,
            error: {
              lens: data.lens || "outward",
              class: data.failure_class || "ci_unavailable",
              message: data.error || "Unknown error",
            },
            history: [entry, ...s.melae.history].slice(0, 20),
          },
        }));
        return;
      }

      const result = data.result as MelaeResult;
      const entry: MelaeHistoryEntry = {
        id: nid("mh"),
        input,
        result,
        heuristicSnr: computeSnr(input),
        status: "ok",
        createdAt: Date.now(),
      };
      // reward: optimization proof earns trust + XP
      get().addResource("evidenceShards", 1);
      get().addResource("trustScore", 2);
      get().addResource("xp", 10);
      set((s) => ({
        melae: {
          ...s.melae,
          loading: false,
          result,
          error: null,
          history: [entry, ...s.melae.history].slice(0, 20),
        },
      }));
    } catch (err) {
      // OUTWARD — network failure reaching the API
      const message = err instanceof Error ? err.message : "Network error";
      const entry: MelaeHistoryEntry = {
        id: nid("mh"),
        input,
        result: null,
        heuristicSnr: computeSnr(input),
        status: "error",
        errorLens: "outward",
        errorClass: "network",
        errorMessage: message,
        createdAt: Date.now(),
      };
      set((s) => ({
        melae: {
          ...s.melae,
          loading: false,
          error: { lens: "outward", class: "network", message },
          history: [entry, ...s.melae.history].slice(0, 20),
        },
      }));
    }
  },

  clearMelaeResult: () =>
    set((st) => ({
      melae: { ...st.melae, result: null, error: null },
    })),

  selectFromHistory: (id) => {
    const entry = get().melae.history.find((h) => h.id === id);
    if (!entry) return;
    set((st) => ({
      melae: {
        ...st.melae,
        input: entry.input,
        heuristicSnr: entry.heuristicSnr,
        result: entry.result,
        error: entry.status === "error"
          ? { lens: entry.errorLens || "outward", class: entry.errorClass || "network", message: entry.errorMessage || "" }
          : null,
      },
    }));
  },

  resetMelae: () => set({ melae: initialMelae() }),

  reset: () => set({ ...INITIAL, resources: initialResources(), agents: initialAgents(), rails: { ...INITIAL_RAILS }, office: initialOffice(), diagnostic: initialDiagnostic(), melae: initialMelae() }),
}));
