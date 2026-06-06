import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { analyzeEffectCapInvariantSource } from "../scripts/review/actuator-check.mjs";

const specDir = fileURLToPath(
  new URL(
    "../docs/superpowers/specs/2026-05-14-effectcap-invariant/",
    import.meta.url,
  ),
);
const specFiles = [
  "00_packaging_audit.md",
  "01_specification.md",
  "02_pseudocode.md",
  "03_negative_tests.md",
];

const registry = new Map([
  [
    "file:notes:read",
    {
      risk: "file",
      action: "read",
      validate: (params) =>
        typeof params?.path === "string" && !("payload" in params),
      run: () => ({ ok: true, effect: "read" }),
    },
  ],
  [
    "file:notes:write",
    {
      risk: "file",
      action: "write",
      validate: (params) =>
        typeof params?.path === "string" && typeof params?.payload === "string",
      run: () => ({ ok: true, effect: "write" }),
    },
  ],
  [
    "command:pytest:execute",
    {
      risk: "bash",
      action: "execute",
      validate: (params) => Array.isArray(params?.args),
      run: () => ({ ok: true, effect: "execute" }),
    },
  ],
]);

function deny(code) {
  return { allowed: false, code };
}

function performPreview(
  intent,
  consent,
  now = new Date("2026-05-14T00:00:00.000Z"),
) {
  if (
    typeof intent?.exec === "function" ||
    typeof intent?.params?.exec === "function"
  ) {
    return deny("caller_exec_closure_forbidden");
  }
  if (!consent) return deny("consent_missing");
  if (consent.status === "revoked") return deny("consent_revoked");
  if (new Date(consent.expires_at) <= now) return deny("consent_expired");
  if (consent.resource_id !== intent.resourceId)
    return deny("resource_mismatch");
  if (consent.action !== intent.action) return deny("action_mismatch");

  const entry = registry.get(`${intent.resourceId}:${intent.action}`);
  if (!entry) return deny("unknown_operation");
  if (entry.action !== intent.action) return deny("declared_action_diverged");
  if (!entry.validate(intent.params)) return deny("invalid_params");
  if (entry.risk === "bash" && consent.explicit_human_approval !== true) {
    return deny("explicit_human_approval_required");
  }

  return { allowed: true, outcome: entry.run(intent.params) };
}

test("EffectCap invariant spec files exist and stay under 500 lines", async () => {
  for (const file of specFiles) {
    const body = await readFile(new URL(file, `file://${specDir}/`), "utf8");
    assert.ok(body.includes("EffectCap") || file === "00_packaging_audit.md");
    assert.ok(
      body.split("\n").length < 500,
      `${file} should stay under 500 lines`,
    );
  }
});

test("EffectCap spec states the object-capability law", async () => {
  const body = await readFile(
    new URL("01_specification.md", `file://${specDir}/`),
    "utf8",
  );

  assert.match(body, /No raw actuator path/);
  assert.match(body, /No side effect without EffectCap/);
  assert.match(body, /No EffectCap without ConsentScope/);
  assert.match(body, /No caller-provided execution closure/);
  assert.match(body, /No impact claim without EvidenceChain/);
  assert.match(body, /No economic mint without verified ImpactEvent/);
});

test("EffectCap source analyzer rejects caller exec closures and executable policy code", () => {
  const findings = analyzeEffectCapInvariantSource(
    `
    effectingOperation(cap, "file:notes", "read", exec);
    perform(intent, () => runShell());
    eval(rule.condition);
    Function("mission", rule.condition);
  `,
    "fixture.js",
  );

  assert.deepEqual(
    findings.map((finding) => finding.label),
    [
      "effectcap.caller_exec_closure",
      "effectcap.caller_exec_closure",
      "policy.executable_rule_code",
      "policy.executable_rule_code",
    ],
  );
});

test("declared read intent cannot trigger write or execute effects", () => {
  assert.deepEqual(
    performPreview(
      {
        resourceId: "file:notes",
        action: "read",
        params: { path: "notes.md", payload: "write attempt" },
      },
      {
        status: "active",
        resource_id: "file:notes",
        action: "read",
        expires_at: "2026-05-15T00:00:00.000Z",
      },
    ),
    deny("invalid_params"),
  );
});

test("revoked consent blocks a previously valid mission", () => {
  const intent = {
    resourceId: "file:notes",
    action: "read",
    params: { path: "notes.md" },
  };
  const active = {
    status: "active",
    resource_id: "file:notes",
    action: "read",
    expires_at: "2026-05-15T00:00:00.000Z",
  };
  const revoked = { ...active, status: "revoked" };

  assert.equal(performPreview(intent, active).allowed, true);
  assert.deepEqual(performPreview(intent, revoked), deny("consent_revoked"));
});

test("unknown operations fail closed", () => {
  assert.deepEqual(
    performPreview(
      {
        resourceId: "service:unknown",
        action: "call",
        params: { url: "https://example.invalid" },
      },
      {
        status: "active",
        resource_id: "service:unknown",
        action: "call",
        expires_at: "2026-05-15T00:00:00.000Z",
      },
    ),
    deny("unknown_operation"),
  );
});

test("invalid params deny before sealed registry dispatch", () => {
  assert.deepEqual(
    performPreview(
      {
        resourceId: "file:notes",
        action: "write",
        params: { path: "notes.md" },
      },
      {
        status: "active",
        resource_id: "file:notes",
        action: "write",
        expires_at: "2026-05-15T00:00:00.000Z",
      },
    ),
    deny("invalid_params"),
  );
});

test("high-risk Bash requires explicit human approval", () => {
  const intent = {
    resourceId: "command:pytest",
    action: "execute",
    params: { args: ["tests/status.test.js"] },
  };
  const consent = {
    status: "active",
    resource_id: "command:pytest",
    action: "execute",
    expires_at: "2026-05-15T00:00:00.000Z",
  };

  assert.deepEqual(
    performPreview(intent, consent),
    deny("explicit_human_approval_required"),
  );
  assert.equal(
    performPreview(intent, { ...consent, explicit_human_approval: true })
      .allowed,
    true,
  );
});
