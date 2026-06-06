// Hierarchical help system for the Dema CLI.
// renderHelpFlat accepts the HELP string from index.js so this module never
// imports from the CLI layer (no circular dependency).

export const HELP_TOPICS = Object.freeze({
  orientation: Object.freeze({
    title: "Orientation",
    summary: "Get started: welcome, setup, onboard, explain",
    commands: Object.freeze([
      Object.freeze({
        command: "welcome",
        short_description: "Show the first-run orientation",
      }),
      Object.freeze({
        command: "setup",
        short_description: "Create local Dema folders/profile skeleton",
      }),
      Object.freeze({
        command: "onboard",
        short_description:
          "Guided zero-technical onboarding path; preview-only",
      }),
      Object.freeze({
        command: "explain",
        short_description: "Plain-language definition of a BIZRA/Dema concept",
      }),
      Object.freeze({
        command: "chat",
        short_description: "Interactive shell (same surface as the bare CLI)",
      }),
    ]),
    see_also: Object.freeze(["readiness", "preview"]),
  }),
  readiness: Object.freeze({
    title: "Readiness",
    summary: "See what's true, what's safe, what's blocked",
    commands: Object.freeze([
      Object.freeze({
        command: "status",
        short_description: "Show human-readable Node0 status",
      }),
      Object.freeze({
        command: "status:json",
        short_description: "Show machine-readable status",
      }),
      Object.freeze({
        command: "today",
        short_description: "Record a local continuity tick + memory summary",
      }),
      Object.freeze({
        command: "doctor",
        short_description: "Validate readiness and consent gate",
      }),
      Object.freeze({
        command: "memory",
        short_description: "List local memory entries",
      }),
      Object.freeze({
        command: "memory show",
        short_description: "Show one memory entry by name",
      }),
    ]),
    see_also: Object.freeze(["orientation", "preview"]),
  }),
  preview: Object.freeze({
    title: "Preview",
    summary: "Plan without acting: mission, consent, ambient, diagnostics",
    commands: Object.freeze([
      Object.freeze({
        command: "ambient",
        short_description:
          "Show Ambient Sovereign Execution boundary (preview-only)",
      }),
      Object.freeze({
        command: "ambient:json",
        short_description: "Show the ambient boundary as schema-tagged JSON",
      }),
      Object.freeze({
        command: "diagnostics plan",
        short_description:
          "Preview self-diagnostics harness; does not run checks",
      }),
      Object.freeze({
        command: "consent plan",
        short_description:
          "Preview a micro-consent scope; does not approve or execute",
      }),
      Object.freeze({
        command: "mission draft",
        short_description: "Preview Intent -> MissionDraft -> ConsentPlan",
      }),
      Object.freeze({
        command: "mission propose",
        short_description:
          "Preview ARTIFACT-011 readiness; does not execute runtime",
      }),
    ]),
    see_also: Object.freeze(["readiness", "evidence"]),
  }),
  evidence: Object.freeze({
    title: "Evidence",
    summary: "Local proof: receipts, models, memory, evidence-event",
    commands: Object.freeze([
      Object.freeze({
        command: "receipts",
        short_description: "List local receipts",
      }),
      Object.freeze({
        command: "models",
        short_description:
          "Show local model inventory (read-only; no inference)",
      }),
      Object.freeze({
        command: "models scan",
        short_description: "Schema-tagged local model inventory scan",
      }),
      Object.freeze({
        command: "evidence receipt preview",
        short_description: "Preview receipt-shaped evidence; does not mint",
      }),
      Object.freeze({
        command: "ihsan floor preview",
        short_description:
          "Preview externally supplied Ihsan floor check; does not certify",
      }),
      Object.freeze({
        command: "evidence-event",
        short_description: "EvidenceChain event preview; chain_advance=false",
      }),
      Object.freeze({
        command: "genesis composition blueprint",
        short_description:
          "Preview NODE0-OSTREE-1A management, DevOps, CI/CD, and QA blueprint",
      }),
      Object.freeze({
        command: "master-craftsmanship audit",
        short_description:
          "External audit of an artifact against the 10 master-craftsmanship invariants; verdict COMPLIANT (10/10) | PARTIAL | NON-COMPLIANT",
      }),
    ]),
    see_also: Object.freeze(["readiness", "spine"]),
  }),
  spine: Object.freeze({
    title: "Spine",
    summary:
      "Canonical surfaces: state, profiles, consent-card, mission-loop, ...",
    commands: Object.freeze([
      Object.freeze({
        command: "state",
        short_description:
          "Node0 state preview; mission_centered + runtime/federation/mint=false",
      }),
      Object.freeze({
        command: "profiles",
        short_description:
          "Profile foundation (User/PAT/SAT/Mission/ContextCapsule)",
      }),
      Object.freeze({
        command: "consent-card",
        short_description:
          "Consent card preview; allowed/blocked effects + decision options",
      }),
      Object.freeze({
        command: "mission-loop",
        short_description:
          "Full lifecycle preview; preview_lifecycle_status pinned HOLD",
      }),
      Object.freeze({
        command: "node-registry",
        short_description: "Node ordinal registry preview",
      }),
      Object.freeze({
        command: "onboarding-lifecycle",
        short_description: "Onboarding lifecycle preview (v0.1) · 7-stage flow",
      }),
      Object.freeze({
        command: "skill-growth-governor",
        short_description:
          "Skill Growth Governor preview (v0.1) · 5 promotion gates",
      }),
      Object.freeze({
        command: "project-status",
        short_description:
          "Project Status preview (v0.1 · PMBOK 7th-edition-aligned)",
      }),
      Object.freeze({
        command: "llm-router",
        short_description: "Local LLM router preview; routing_allowed=false",
      }),
      Object.freeze({
        command: "process-mining",
        short_description:
          "Operator-pattern mirror; surfaces ring_advancement_status",
      }),
      Object.freeze({
        command: "key-maker-check",
        short_description:
          "Self-audits reasoning shape against the 5 Key Maker invariants",
      }),
      Object.freeze({
        command: "llm-invoke",
        short_description: "C1 · local LLM adapter · preview-only by default",
      }),
      Object.freeze({
        command: "craftsmanship-witness",
        short_description: "Master-craftsmanship creation preview",
      }),
      Object.freeze({
        command: "behavior modulation preview",
        short_description:
          "Preview visible guidance modulation; does not apply changes",
      }),
      Object.freeze({
        command: "design emulate-loop",
        short_description:
          "Preview PAT/SAT loop design assumptions; does not run agents",
      }),
    ]),
    see_also: Object.freeze(["evidence", "tasks"]),
  }),
  tasks: Object.freeze({
    title: "Tasks",
    summary: "Run registered work: task, sovereign, monetize",
    commands: Object.freeze([
      Object.freeze({
        command: "task",
        short_description: "List registered tasks",
      }),
      Object.freeze({
        command: "sovereign",
        short_description:
          "Render local Sovereign Mission Interface (view-only)",
      }),
      Object.freeze({
        command: "monetize",
        short_description: "Show proof-safe first offer boundary",
      }),
      Object.freeze({
        command: "report safety",
        short_description: "Preview the safety report; does not certify",
      }),
      Object.freeze({
        command: "network blueprint",
        short_description:
          "Preview Node1/Node2 and phase-gated readiness; no federation",
      }),
      Object.freeze({
        command: "network fixture preview",
        short_description: "Preview offline 5-slot fixture; no sockets or mint",
      }),
      Object.freeze({
        command: "network refusal preview",
        short_description:
          "Preview partition/rejoin refusal matrix; no sockets or mint",
      }),
      Object.freeze({
        command: "amana contracts preview",
        short_description:
          "Preview Amana contract primitives; imports no external code",
      }),
      Object.freeze({
        command: "mcp blueprint",
        short_description:
          "Preview MCP integration contract; does not call MCP tools",
      }),
      Object.freeze({
        command: "roadmap preview",
        short_description:
          "Preview optimization roadmap; does not execute or enforce gates",
      }),
    ]),
    see_also: Object.freeze(["orientation", "spine"]),
  }),
});

export const COMMAND_DETAIL = Object.freeze({
  status: Object.freeze({
    syntax: "dema status",
    description:
      "Show human-readable Node0 status: identity (node, human), readiness\n(ready, console_ready, activation_gate, daemon_status), runtime signals\n(mission, runtime_pulse, model_connected), and current findings.",
    boundary:
      "read-only. No mutation. No network call (except optional\ngateway probe). Honors DEMA_NODE0_ADAPTER env var.",
    related: Object.freeze(["status:json", "doctor"]),
  }),
  doctor: Object.freeze({
    syntax: "dema doctor",
    description:
      "Validate local readiness and the consent gate. Checks profile,\nreceipts directory, and activation prerequisites.",
    boundary: "read-only. No mutation. No network call.",
    related: Object.freeze(["status", "today"]),
  }),
  today: Object.freeze({
    syntax: "dema today",
    description:
      "Record a local continuity tick and print a memory summary.\nWrites one receipt to ~/.dema/receipts/.",
    boundary: "writes one local tick receipt. No network. No mint.",
    related: Object.freeze(["memory", "receipts"]),
  }),
  memory: Object.freeze({
    syntax: "dema memory\ndema memory show NAME",
    description:
      "List local memory entries (profile + ~/.dema/memory/*).\nWith `show NAME`, print the named entry in full.",
    boundary: "read-only. No mutation. Local filesystem only.",
    related: Object.freeze(["today", "receipts"]),
  }),
  receipts: Object.freeze({
    syntax: "dema receipts\ndema receipts ID",
    description:
      "List local receipts or show one by ID, artifact ID, exact path,\nor unique filename.",
    boundary: "read-only. Local filesystem only.",
    related: Object.freeze(["evidence-event", "today"]),
  }),
  genesis: Object.freeze({
    syntax: "dema genesis composition blueprint [--json]",
    description:
      "Preview the NODE0-OSTREE-1A delivery blueprint around the signed\nNode0 composition manifest: management Body of Knowledge, DevOps posture,\nCI/CD gate ladder, performance model, and QA thresholds.",
    boundary:
      "read-only preview. No libostree. No daemon. No federation. No\ndeploy surface. No receipt mint. No CI workflow mutation.",
    related: Object.freeze(["project-status", "proof", "roadmap"]),
  }),
  explain: Object.freeze({
    syntax: "dema explain [<concept>]\ndema explain --json [<concept>]",
    description:
      "Plain-language definition of a BIZRA/Dema concept (28 known).\nWith no argument, lists all available concepts.",
    boundary: "read-only. No network. No mutation.",
    related: Object.freeze(["welcome", "onboard"]),
  }),
  chat: Object.freeze({
    syntax: "dema chat",
    description:
      "Open the interactive shell (same surface as bare `dema` on a TTY).\nAccepts subcommands, natural-language queries, and `exit` to quit.",
    boundary: "no mutation without explicit consent. Local-only by default.",
    related: Object.freeze(["welcome", "status"]),
  }),
  setup: Object.freeze({
    syntax: "dema setup\ndema setup --json",
    description:
      "Create local Dema folders and profile skeleton under DEMA_HOME.\nWizard on TTY; JSON output on non-TTY or with --json.",
    boundary: "writes local directory structure and profile.json. No network.",
    related: Object.freeze(["onboard", "welcome"]),
  }),
  onboard: Object.freeze({
    syntax: "dema onboard [--json]",
    description:
      "Guided zero-technical onboarding path. Shows the 7-stage flow\n(language→tech-level→node-role→purpose→resources→consent-constitution→\nfirst-mission). Preview-only.",
    boundary: "read-only preview. No mutation. No network.",
    related: Object.freeze(["setup", "welcome", "explain"]),
  }),
});

const TOPIC_SLUGS = Object.keys(HELP_TOPICS);

export function renderHelpRoot() {
  const lines = [
    "Dema — Sovereign AI Node Companion · v0.1.0-alpha.0",
    "Local-first. Consent-bound. Receipt-aware.",
    "",
    "Available topics:",
  ];
  for (const [slug, topic] of Object.entries(HELP_TOPICS)) {
    const pad = slug.padEnd(14);
    lines.push(`  ${pad} ${topic.summary}`);
  }
  lines.push(
    "",
    "Type `dema help <topic>` for commands in that topic.",
    "Type `dema help <command>` for command-specific detail.",
    "Type `dema help --all` for the full flat list.",
  );
  return lines.join("\n");
}

export function renderHelpTopic(topicSlug) {
  if (!topicSlug || typeof topicSlug !== "string") return null;
  const topic = HELP_TOPICS[topicSlug];
  if (!topic) return null;

  const lines = [`${topic.title} — ${topic.summary}`, ""];
  for (const entry of topic.commands) {
    lines.push(`  dema ${entry.command}`);
    lines.push(`                     ${entry.short_description}`);
  }
  if (topic.see_also && topic.see_also.length > 0) {
    lines.push("", "See also:");
    for (const slug of topic.see_also) {
      const related = HELP_TOPICS[slug];
      if (related) {
        lines.push(`  dema help ${slug.padEnd(16)} ${related.summary}`);
      }
    }
  }
  return lines.join("\n");
}

export function renderHelpCommand(commandName) {
  if (!commandName || typeof commandName !== "string") return null;
  const detail = COMMAND_DETAIL[commandName];
  if (!detail) return null;

  const lines = [
    `dema ${commandName}`,
    "",
    detail.description,
    "",
    `Boundary: ${detail.boundary}`,
  ];
  if (detail.related && detail.related.length > 0) {
    lines.push("", "Related:");
    for (const cmd of detail.related) {
      lines.push(`  dema ${cmd}`);
    }
  }
  return lines.join("\n");
}

// helpString is the HELP constant from apps/cli/src/index.js.
// Callers pass it in to avoid a circular import.
export function renderHelpFlat(helpString) {
  return helpString;
}

export function renderHelpUnknown(name) {
  return [
    `I don't have a topic or command named \`${name}\`.`,
    "",
    `Available topics: ${TOPIC_SLUGS.join(", ")}.`,
    "Or type `dema help --all` for the full flat list.",
  ].join("\n");
}
