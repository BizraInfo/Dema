const FILE_PATTERN = /(?:^|[\s"'`])([A-Za-z0-9_./-]+\.(?:py|js|ts|tsx|jsx|md|json|ya?ml|toml|rs|go|sh))/gi;
const WRITE_VERBS = /\b(fix|edit|update|change|write|refactor|patch|modify)\b/i;
const AUDIT_VERBS = /\b(audit|review|inspect|scan|analyze|summarize)\b/i;

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
  }
];

const SERVICE_RULES = [
  {
    pattern: /\bslack\b/i,
    resource_id: "service:slack",
    purpose: "deliver mission summary to Slack after review",
    reason: "Slack mentioned in intent",
    confidence: 0.7
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

export function buildPermissions(intent, files = extractFiles(intent)) {
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

export function extractIntentShape(intent) {
  const files = extractFiles(intent);
  const permissions = buildPermissions(intent, files);
  return {
    files,
    permissions,
    category: detectCategory(intent, files),
    risk_level: permissions.some((p) => ["execute", "call"].includes(p.action)) ? "high" : "review"
  };
}

export function buildAnalogicalNotes(intent, permissions) {
  return [
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
