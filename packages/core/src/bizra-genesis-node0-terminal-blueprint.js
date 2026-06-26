// BIZRA-GENESIS-NODE0-TERMINAL-BLUEPRINT-1A — deterministic monochrome ASCII map.
//
// Docs-only conceptual blueprint. NOT live runtime. NOT autonomous activation.
// NOT token mint. NOT URP settlement. Renders a 2D terminal view of the
// single-node closed-loop architecture for cold reviewers.

export const BIZRA_GENESIS_NODE0_TERMINAL_BLUEPRINT_SCHEMA =
  "bizra.dema.bizra_genesis_node0_terminal_blueprint.v0.1";
export const BIZRA_GENESIS_NODE0_TERMINAL_BLUEPRINT_TRUTH_LABEL =
  "BIZRA_GENESIS_NODE0_TERMINAL_BLUEPRINT_DOCS_ONLY";

export const BLUEPRINT_WIDTH = 118;

export const REQUIRED_LAYERS = Object.freeze([
  "1. USER / HOME BASE",
  "2. NODE0 CORE",
  "3. LOCAL ASSET AWARENESS",
  "4. FULL STACK EXECUTION LAYER",
  "5. KNOWLEDGE + LEARNING LOOP",
  "6. TOKEN + VALUE FLYWHEEL",
  "7. BIZRA URP / NETWORK LAYER",
  "8. OBSERVABILITY + GOVERNANCE",
]);

export const REQUIRED_TREE_PATHS = Object.freeze([
  "/home/node0/",
  "assets/",
  "hardware/",
  "data/",
  "impact/",
  "core/",
  "dema/",
  "sat/",
  "pat/",
  "memory/",
  "runtime/",
  "models/",
  "routing/",
  "eval/",
  "workflows/",
  "bizra/",
  "urp/",
  "tokens/",
  "poi/",
  "services/",
  "governance/",
  "audits/",
  "policy/",
  "observability/",
]);

export const CLOSED_LOOP = Object.freeze([
  "User / Home Base",
  "Node0 Core",
  "Execution Layer",
  "Learning Loop",
  "Token / Value Flywheel",
  "URP / Network Layer",
  "Back to User / Home Base",
]);

export const FORBIDDEN_OVERCLAIM_PHRASES = Object.freeze([
  "live token mint",
  "wallet action",
  "silent activation",
  "hidden daemon",
  "unconsented execution",
  "autonomous singularity",
  "live sat treasury",
]);

export function hasPositiveOverclaim(text, phrase) {
  const lower = text.toLowerCase();
  const p = phrase.toLowerCase();
  let idx = 0;
  while ((idx = lower.indexOf(p, idx)) !== -1) {
    const before = lower.slice(Math.max(0, idx - 4), idx);
    if (!before.endsWith("no ")) return true;
    idx += p.length;
  }
  return false;
}

function rule(char = "-", width = BLUEPRINT_WIDTH) {
  return char.repeat(width);
}

function center(text, width = BLUEPRINT_WIDTH) {
  const left = Math.max(0, Math.floor((width - text.length) / 2));
  return `${" ".repeat(left)}${text}`;
}

function box(title, lines, width = BLUEPRINT_WIDTH) {
  return [
    `+${rule("-", width)}+`,
    `| ${title.padEnd(width - 2)} |`,
    `+${rule("-", width)}+`,
    ...lines.map((line) => `| ${line.padEnd(width - 2)} |`),
    `+${rule("-", width)}+`,
  ].join("\n");
}

function flow(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join(" -> ");
}

export function renderBizraGenesisNode0TerminalBlueprint() {
  return [
    rule("="),
    center("BIZRA GENESIS BLOCK - NODE0 DEMA"),
    center("2D Terminal Blueprint | Single-Node Closed-Loop Ecosystem"),
    rule("="),

    box("1. USER / HOME BASE", [
      "Human User          -> Local Home Base -> Verified Assets -> Goals / Missions / Tasks",
      "Identity + Intent      Personal Space      Owned + Trusted    Plans + Actions",
      "Invariant: human intention is the origin of every action.",
    ]),

    box("2. NODE0 CORE", [
      "Dema Orchestrator <-> PAT Personal Agent Team <-> SAT System Agent Team",
      "Multi-Model Runtime <-> Think Tank / MoE Routing <-> Memory + Context Engine",
      "FATE / Consent Boundary sits between intent, execution, verification, and proof.",
      "Invariant: PAT serves the user. SAT protects the system. Dema coordinates both.",
    ]),

    box("3. LOCAL ASSET AWARENESS", [
      "Hardware Inventory       : devices, CPU, GPU, RAM, storage, network capacity",
      "Data Inventory           : local data, notes, documents, PDFs, datasets, schemas",
      "Research / Knowledge     : papers, references, patterns, chat history, knowledge graph",
      "Impact Actions Ledger    : impact logs, outcomes, attribution, public-good evidence",
      "Benchmark + Eval Baseline: datasets, metrics, baselines, golden sets",
      "Invariant: know what exists before using, sharing, rewarding, or submitting.",
    ]),

    box("4. FULL STACK EXECUTION LAYER", [
      "Mission Router -> Skill / Tool Bus -> Sub-Agents -> Hooks -> Workflows",
      "CI / CD -> Testing / Verification -> Security / Boundary Gate",
      "Invariant: every action must pass consent, safety, and proof boundaries.",
    ]),

    box("5. KNOWLEDGE + LEARNING LOOP", [
      "Data Lake -> Knowledge Graph -> Symbolic-Neural Bridge -> RSI + SNR Engine",
      "RL with Verified Reward -> Self-Critique -> Self-Correction -> Self-Optimization",
      "Invariant: improvement is measured, bounded, receipted, and never silent.",
      "Truth label: DESIGNED_NOT_LIVE for autonomous RL until runtime proof exists.",
    ]),

    box("6. TOKEN + VALUE FLYWHEEL", [
      "Dual Token System: PAT Token + SAT Token",
      "SAT Fee Channel     : system services / verification / governance rail",
      "PAT Reward Channel  : verified contribution reward path",
      "Proof of Impact     : credible work, contribution, receipt, verified value",
      "Resource Sharing    : compute, data, models, APIs, knowledge, impact actions",
      "Supply / Demand     : incentivize -> deliver -> measure -> improve",
      "Boundary: no token mint, no wallet action, no URP submission in this blueprint.",
    ]),

    box("7. BIZRA URP / NETWORK LAYER", [
      "URP Shared Resource Pool -> BlockTree / BlockGraph -> Genesis Block",
      "Verified Contribution -> Humanity Service",
      "Invariant: URP receives verified resources only after consent and proof.",
      "Founder covenant: 50% founder-earned verified value can be pledged back to URP commons.",
      "Truth label: URP shared runtime DESIGNED_NOT_LIVE in Dema repo today.",
    ]),

    box("8. OBSERVABILITY + GOVERNANCE", [
      "Logs -> Metrics -> Audit Trail -> Policy / Ihsan Boundary",
      "Reliability -> Security -> Compliance -> Fail-Closed Boundaries",
      "Invariant: no hidden daemon, no silent activation, no unconsented execution.",
      "Operator bridges (DEMA_NODE0_STATUS_COMMAND, gateway, LLM URLs): ADR-042.",
    ]),

    box("OSTREE / CODE-SPACE", [
      "/home/node0/",
      "|-- assets/",
      "|   |-- hardware/",
      "|   |-- data/",
      "|   `-- impact/",
      "|-- core/",
      "|   |-- dema/",
      "|   |-- sat/",
      "|   |-- pat/",
      "|   `-- memory/",
      "|-- runtime/",
      "|   |-- models/",
      "|   |-- routing/",
      "|   |-- eval/",
      "|   `-- workflows/",
      "|-- bizra/",
      "|   |-- urp/",
      "|   |-- tokens/",
      "|   |-- poi/",
      "|   `-- services/",
      "`-- governance/",
      "    |-- audits/",
      "    |-- policy/",
      "    `-- observability/",
    ]),

    box("CLOSED-LOOP FLOW", [
      flow(CLOSED_LOOP),
      "Loop rule: observe -> evaluate -> prove -> refine -> redeploy -> re-verify.",
    ]),

    rule("="),
    center("Single Node | Blueprint Concept | Monochrome Terminal View | PREVIEW_ONLY"),
    center("Mission-centered | User-centric | Proof-bound | Reward-aware"),
    rule("="),
  ].join("\n\n");
}

export function verifyBizraGenesisNode0TerminalBlueprint(output) {
  const blocked_by = [];
  if (typeof output !== "string" || !output.trim()) {
    blocked_by.push("output_empty");
    return Object.freeze({ ok: false, blocked_by });
  }

  for (const layer of REQUIRED_LAYERS) {
    if (!output.includes(layer)) blocked_by.push(`missing_layer:${layer}`);
  }
  for (const path of REQUIRED_TREE_PATHS) {
    if (!output.includes(path)) blocked_by.push(`missing_tree:${path}`);
  }
  for (const step of CLOSED_LOOP) {
    if (!output.includes(step)) blocked_by.push(`missing_loop:${step}`);
  }

  const lower = output.toLowerCase();
  for (const phrase of FORBIDDEN_OVERCLAIM_PHRASES) {
    if (hasPositiveOverclaim(lower, phrase)) {
      blocked_by.push(`overclaim:${phrase}`);
    }
  }

  const requiredBoundaries = [
    "no token mint",
    "no wallet action",
    "no hidden daemon",
  ];
  for (const phrase of requiredBoundaries) {
    if (!lower.includes(phrase)) blocked_by.push(`missing_boundary:${phrase}`);
  }

  const ansiEscapePattern = /\u001b\[[0-9;]*m/u;
  if (ansiEscapePattern.test(output)) blocked_by.push("ansi_not_allowed");
  if (output.includes("```mermaid") || output.includes("<svg") || output.includes("<img")) {
    blocked_by.push("non_terminal_markup");
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}
