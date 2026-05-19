const FILE_PATTERN = /(?:^|[\s"'`])(~?[A-Za-z0-9_./-]+\.(?:py|js|ts|tsx|jsx|md|json|ya?ml|toml|rs|go|sh))/gi;
const WRITE_VERBS = /\b(fix|edit|update|change|write|refactor|patch|modify)\b/i;
const AUDIT_VERBS = /\b(audit|review|inspect|scan|analyze|summarize)\b/i;
const SPEND_VERBS = /\b(spend|pay|buy|purchase|subscribe|charge|credits?|budget|tokens?)\b/i;
const GUI_HINTS = /\b(gui|desktop|screen|click|press|button|browser|mouse|keyboard|browser automation)\b/i;
const MOBILE_AGENT_HINTS = /\b(mobile agent|across hosts?|remote hosts?|move across|copy across|node1|node2|federat(?:e|ion))\b/i;
const COMMAND_HINTS = /\b(run|execute|launch)\b.*\b(script|command|verification|verify|test|checks?)\b/i;

const ACTUATOR_CLASS_ORDER = Object.freeze([
  "bash",
  "filesystem_mutation",
  "external_call",
  "gui",
  "mobile_agent",
  "spend"
]);

const COMMAND_RULES = [
  {
    pattern: /\bpytest\b/i,
    resource_id: "command:pytest",
    purpose: "verify mission result with bounded test command",
    reason: "pytest mentioned in intent"
  },
  {
    pattern: /\bnpm\s+test\b/i,
    resource_id: "command:npm-test",
    purpose: "verify mission result with npm test",
    reason: "npm test mentioned in intent"
  },
  {
    pattern: COMMAND_HINTS,
    resource_id: "command:generic",
    purpose: "run requested command-like local action",
    reason: "command-like execution phrasing",
    confidence: 0.64
  }
];

const SERVICE_RULES = [
  {
    pattern: /\bslack\b/i,
    resource_id: "service:slack",
    purpose: "deliver mission summary to Slack after review",
    reason: "Slack mentioned in intent",
    confidence: 0.7
  },
  {
    pattern: /\b(notify|message|email)\b.*\b(team|person|people|channel)\b/i,
    resource_id: "service:team-notification",
    purpose: "deliver a message outside the local preview",
    reason: "team notification phrasing",
    confidence: 0.62
  },
  {
    pattern: /\b(external brief|share|publish|upload|post|webhook|api access)\b/i,
    resource_id: "service:external",
    purpose: "perform an external service or network handoff",
    reason: "external delivery or API phrasing",
    confidence: 0.62
  }
];

function permission(resourceId, action, purpose, reason, confidence = 0.78) {
  return {
    resource_id: resourceId,
    action,
    purpose,
    reason,
    confidence,
    requires_human_consent: ["write", "execute", "call", "spend"].includes(action)
  };
}

function addPermission(permissions, next) {
  const key = `${next.resource_id}:${next.action}`;
  if (!permissions.some((existing) => `${existing.resource_id}:${existing.action}` === key)) {
    permissions.push(next);
  }
}

export function isAuditIntent(intent) {
  return AUDIT_VERBS.test(intent);
}

function isWriteIntent(intent) {
  return WRITE_VERBS.test(intent);
}

function extractFiles(intent) {
  return [...intent.matchAll(FILE_PATTERN)].map((match) => match[1]);
}

function isUnsafeFileReference(file) {
  if (file.startsWith("/") || file.startsWith("~")) return true;
  return file.split("/").some((segment) => segment === "..");
}

function extractFileReferences(intent) {
  const references = extractFiles(intent);
  return {
    safe: references.filter((file) => !isUnsafeFileReference(file)),
    unsafe: references.filter(isUnsafeFileReference)
  };
}

export function detectCategory(intent, files) {
  if (isWriteIntent(intent) && files.length > 0) return "software_change";
  if (isAuditIntent(intent)) return "audit";
  return "general";
}

function addFilePermissions(permissions, intent, files) {
  for (const file of files) {
    addPermission(permissions, permission(
      `file:${file}`,
      "read",
      "inspect referenced file for mission context",
      "file path mentioned in intent"
    ));
    if (isWriteIntent(intent)) {
      addPermission(permissions, permission(
        `file:${file}`,
        "write",
        "apply requested change only to referenced file",
        "write verb plus explicit file path"
      ));
    }
  }
}

function addRulePermissions(permissions, intent, rules, action, confidence = 0.84) {
  for (const rule of rules.filter((candidate) => candidate.pattern.test(intent))) {
    addPermission(permissions, permission(
      rule.resource_id,
      action,
      rule.purpose,
      rule.reason,
      rule.confidence ?? confidence
    ));
  }
}

export function buildPermissions(intent, files = extractFileReferences(intent).safe) {
  const permissions = [];
  addFilePermissions(permissions, intent, files);
  if (/\bDownloads\b/i.test(intent)) {
    addPermission(permissions, permission(
      "path:Downloads",
      "read",
      "inspect Downloads contents for requested audit",
      "Downloads path mentioned in intent"
    ));
  }
  addRulePermissions(permissions, intent, COMMAND_RULES, "execute");
  addRulePermissions(permissions, intent, SERVICE_RULES, "call");
  return permissions;
}

function orderActuatorClasses(classes) {
  const seen = new Set(classes);
  return ACTUATOR_CLASS_ORDER.filter((name) => seen.has(name));
}

export function classifyActuatorClasses(intent, permissions = []) {
  const classes = [];
  for (const p of permissions) {
    if (p.action === "execute") classes.push("bash");
    if (p.action === "write") classes.push("filesystem_mutation");
    if (p.action === "call") classes.push("external_call");
    if (p.action === "spend") classes.push("spend");
  }
  if (GUI_HINTS.test(intent)) classes.push("gui");
  if (MOBILE_AGENT_HINTS.test(intent)) classes.push("mobile_agent");
  if (SPEND_VERBS.test(intent)) classes.push("spend");
  return orderActuatorClasses(classes);
}

export function buildPolicyPreview({
  category,
  audit_intent = false,
  unsafe_file_references = [],
  actuator_classes = []
}) {
  const decisions = [];
  if (unsafe_file_references.length > 0) {
    decisions.push({
      verdict: "deny",
      code: "unsafe_file_reference",
      reason: "absolute, home-relative, or parent traversal paths are excluded from consent permissions"
    });
  }
  if (actuator_classes.includes("bash")) {
    decisions.push({
      verdict: "requires_governed_runtime_handoff",
      code: "bash_like_actuator",
      reason: "command execution needs governed EffectCap runtime"
    });
  }
  if (actuator_classes.includes("filesystem_mutation")) {
    decisions.push({
      verdict: "requires_exact_consent",
      code: "filesystem_mutation_requires_exact_consent",
      reason: "file mutation needs an exact consent scope before any governed handoff"
    });
  }
  if (actuator_classes.includes("external_call")) {
    decisions.push({
      verdict: "requires_human_review",
      code: (category === "audit" || audit_intent)
        ? "audit_external_delivery"
        : "external_call_requires_review",
      reason: (category === "audit" || audit_intent)
        ? "audit outputs should stay local unless explicitly approved"
        : "external calls need human review and exact service scope"
    });
  }
  if (actuator_classes.includes("gui")) {
    decisions.push({
      verdict: "requires_governed_runtime_handoff",
      code: "gui_actuator_requires_runtime_handoff",
      reason: "GUI or input automation is an actuator and remains outside Dema preview execution"
    });
  }
  if (actuator_classes.includes("mobile_agent")) {
    decisions.push({
      verdict: "deny",
      code: "mobile_agent_blocked_until_node_handoff_gates",
      reason: "mobile-agent movement stays blocked until Node handoff and proof gates exist"
    });
  }
  if (actuator_classes.includes("spend")) {
    decisions.push({
      verdict: "deny",
      code: "economic_channel_closed",
      reason: "economic effects are closed until verified impact governance"
    });
  }
  if (decisions.length === 0 && actuator_classes.length === 0) {
    decisions.push({
      verdict: "preview_only",
      code: "no_effecting_actuator_detected",
      reason: "no effecting actuator class was detected; narrow intent before any future approval"
    });
  }
  return {
    mode: "PREVIEW_ONLY",
    approval_recorded: false,
    runtime_handoff_required: decisions.some((decision) => (
      decision.verdict === "requires_governed_runtime_handoff"
    )),
    decisions
  };
}

function detectRiskLevel(permissions, actuator_classes) {
  if (permissions.some((p) => ["write", "execute", "call", "spend"].includes(p.action))) {
    return "high";
  }
  if (actuator_classes.length > 0) return "high";
  return "review";
}

export function extractIntentShape(intent) {
  const fileReferences = extractFileReferences(intent);
  const files = fileReferences.safe;
  const permissions = buildPermissions(intent, files);
  const category = detectCategory(intent, files);
  const actuator_classes = classifyActuatorClasses(intent, permissions);
  return {
    files,
    unsafe_file_references: fileReferences.unsafe,
    permissions,
    actuator_classes,
    policy_preview: buildPolicyPreview({
      category,
      audit_intent: isAuditIntent(intent),
      unsafe_file_references: fileReferences.unsafe,
      actuator_classes
    }),
    category,
    risk_level: detectRiskLevel(permissions, actuator_classes)
  };
}

export function buildAnalogicalNotes(intent, permissions, unsafeFileReferences = []) {
  return [
    {
      when: unsafeFileReferences.length > 0,
      code: "unsafe_file_reference",
      severity: "high",
      note: "Path traversal, absolute paths, and home-relative file references are excluded from consent permissions."
    },
    {
      when: isAuditIntent(intent) && permissions.some((p) => p.action === "call"),
      code: "audit_with_external_call",
      severity: "review",
      note: "Audit-shaped missions are normally local/read-heavy; external calls require explicit human review."
    },
    {
      when: permissions.some((p) => p.action === "execute"),
      code: "bash_like_actuator",
      severity: "high",
      note: "Command execution is a Bash-like actuator and must remain behind governed EffectCap runtime."
    },
    {
      when: permissions.length === 0,
      code: "no_capabilities_detected",
      severity: "review",
      note: "No known capability mapping detected; narrow the mission intent before approval."
    }
  ]
    .filter((candidate) => candidate.when)
    .map(({ when, ...note }) => note);
}
