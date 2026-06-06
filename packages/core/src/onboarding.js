import { buildUserProfile } from "./profiles.js";

const SCHEMA = "bizra.dema.onboarding.preview.v0.1";

const USER_STATE = {
  phase: "first_run",
  node_role: "momo_node0",
  allowed_actions: ["read", "preview", "verify"],
  blocked_actions: [
    "runtime_start",
    "mission",
    "federation",
    "node_handshake",
    "step7_mint",
    "receipt_mint",
    "external_posting",
  ],
};

// v0.1a node-identity primitives — surfaced on the onboarding preview so the
// future TUI + language-aware onboarding stages can read identity from one
// schema-tagged place. Built fresh on each call so mutations on the returned
// guide don't leak into next call (matches existing mutation-isolation
// contract used for inspiration[] and steps[]).
function buildNodeIdentity() {
  const profile = buildUserProfile();
  return {
    node_ordinal: profile.identity.node_ordinal,
    node_label: profile.identity.node,
    node_uid: profile.identity.node_uid,
    language: profile.identity.language,
    device_label: profile.identity.device_label,
    companion_of: profile.identity.companion_of,
  };
}

const NEXT_STEPS = [
  "verify local gates",
  "review consent ladder",
  "run read-only safety report",
  "prepare MoMo self-use checklist",
];

const BOUNDARIES = {
  no_runtime: true,
  no_network: true,
  no_receipt_mint: true,
  no_external_posting: true,
  no_mission_execution: true,
  no_step7_mint: true,
  no_federation: true,
  no_node_handshake: true,
};

const inspiration = [
  {
    source: "OpenClaw",
    pattern: "doctor and repair clarity",
    absorbed_as:
      "make blocked states obvious and route repair through explicit commands",
  },
  {
    source: "Hermes Agent",
    pattern: "profile-aware memory continuity",
    absorbed_as:
      "keep local memory visible without hiding state or spreading config",
  },
  {
    source: "Pi.dev",
    pattern: "approachable guided flow",
    absorbed_as: "give a simple path a nontechnical operator can follow",
  },
];

const steps = [
  {
    id: "setup",
    title: "Create the local home",
    command: "dema setup",
    user_value:
      "Creates ~/.dema so Dema has a safe local place to remember state.",
    boundary:
      "Does not overwrite profile/config, start a daemon, or execute a mission.",
  },
  {
    id: "status",
    title: "Read the node state",
    command: "dema status",
    user_value: "Shows what is ready, blocked, unknown, and safe to do next.",
    boundary: "Does not repair, connect, or mutate anything.",
  },
  {
    id: "diagnostics",
    title: "Preview a health plan",
    command: "dema diagnostics plan",
    user_value:
      "Shows the checks Dema would run in a governed diagnostic mission.",
    boundary: "Does not run tests or shell commands.",
  },
  {
    id: "consent",
    title: "Preview micro-consent",
    command: 'dema consent plan "Check my local node health"',
    user_value: "Turns plain intent into a narrow permission draft.",
    boundary: "Does not approve consent or mint capability.",
  },
  {
    id: "mission",
    title: "Draft the mission preview",
    command: 'dema mission draft "Check my local node health"',
    user_value:
      "Converts intent into a mission draft with the matching consent preview.",
    boundary: "Does not execute, submit, or authorize the mission.",
  },
  {
    id: "safety",
    title: "Read the safety posture",
    command: "dema report safety",
    user_value:
      "Explains proof gaps, safe defaults, and the current local boundary.",
    boundary: "Does not certify production readiness.",
  },
  {
    id: "receipts",
    title: "Inspect local proof records",
    command: "dema receipts",
    user_value:
      "Lists local receipt handoffs that prove what happened elsewhere.",
    boundary: "Does not create receipts.",
  },
];

function cloneItems(items) {
  return items.map((item) => ({ ...item }));
}

function cloneObject(value) {
  return JSON.parse(JSON.stringify(value));
}

export function buildOnboardingPreview() {
  return {
    schema: SCHEMA,
    mode: "preview_only",
    user_state: cloneObject(USER_STATE),
    node_identity: buildNodeIdentity(),
    next_steps: [...NEXT_STEPS],
    boundaries: cloneObject(BOUNDARIES),
    product: {
      name: "Dema",
      role: "local product face for BIZRA Node0",
      promise:
        "show what is true, what is safe, what is blocked, and what needs consent",
    },
    inspiration: cloneItems(inspiration),
    doctrine: {
      stance: "stand_on_shoulders_do_not_copy",
      note: "Reference projects inform patterns only; no code, naming, UI, or transport is copied.",
    },
    steps: cloneItems(steps),
    boundary: {
      consent_required_to_view: false,
      files_mutated: false,
      setup_performed: false,
      runtime_started: false,
      daemon_started: false,
      mission_executed: false,
      receipt_minted: false,
      network_connection_attempted: false,
      federation_initiated: false,
      node1_or_node2_connected: false,
    },
    next: {
      first_command: "dema setup",
      guided_command: "dema onboard",
      interactive_command: "dema chat",
    },
  };
}

export const buildOnboardingGuide = buildOnboardingPreview;

function renderStep(index, step) {
  return [
    `${index}. ${step.title}`,
    `   command : ${step.command}`,
    `   value   : ${step.user_value}`,
    `   guard   : ${step.boundary}`,
  ].join("\n");
}

export function formatOnboardingPreview(guide) {
  const lines = [
    "Welcome to Dema.",
    "Dema — Sovereign AI Node Companion",
    "",
    "+------------------------------------------------------------+",
    "| Local-first. Consent-bound. Receipt-aware.                 |",
    "| BIZRA is the ecosystem. Dema is the product face.          |",
    "+------------------------------------------------------------+",
    "",
    "What Dema does:",
    `  ${guide.product.promise}.`,
    "",
    "First-run orientation:",
    "  Your node is local-first.",
    "  Your actions are consent-bound.",
    "  Run setup when you are ready to create local state.",
    "",
    "Current user state:",
    `  phase: ${guide.user_state.phase}`,
    `  node role: ${guide.user_state.node_role}`,
    `  allowed: ${guide.user_state.allowed_actions.join(", ")}`,
    `  blocked: ${guide.user_state.blocked_actions.join(", ")}`,
    "",
    "Standing on shoulders, not copying:",
    ...guide.inspiration.map(
      (item) => `  - ${item.source}: ${item.pattern} -> ${item.absorbed_as}.`,
    ),
    "",
    "Guided first run:",
    ...guide.steps.flatMap((step, index) => [renderStep(index + 1, step), ""]),
    "Boundary:",
    "  This guide is preview-only. It does not mutate files, start runtime,",
    "  start a daemon, execute missions, mint receipts, connect Node1/Node2,",
    "  start a multi-node pilot, perform Step 7 minting, post externally,",
    "  or federate.",
    "",
    "Next:",
    ...guide.next_steps.map((step, index) => `  ${index + 1}. ${step}`),
    "",
    "For the interactive shell: dema chat",
  ];

  return lines.join("\n");
}

export const formatOnboardingGuide = formatOnboardingPreview;
