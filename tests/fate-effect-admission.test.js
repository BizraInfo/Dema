import test from "node:test";
import assert from "node:assert/strict";
import * as nodeFs from "node:fs";
import { mkdtempSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  FATE_EFFECT_ADMISSION_REQUEST_SCHEMA,
  FATE_EFFECT_POLICY,
  FATE_EFFECT_POLICY_DIGEST,
  evaluateEffectAdmission,
  validateEffectAdmissionForExecution,
} from "../packages/fate/src/fate.js";
import {
  NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE,
  NODE0_FATE_STAGED_EFFECT_GO_PHRASE,
  runNode0FateStagedEffect,
  startFateStagedEffect,
} from "../packages/core/src/node0-fate-staged-effect.js";

const HASH = (n) => `sha256:${String(n).repeat(64)}`;
const FORBIDDEN = [...FATE_EFFECT_POLICY.forbidden_effects];

function proposal(overrides = {}) {
  const situation = HASH("1");
  const action = HASH("2");
  const targets = ["/candidate/ui-drop-in", "/candidate/bin-dema"];
  return {
    schema: FATE_EFFECT_ADMISSION_REQUEST_SCHEMA,
    situation_commitment: situation,
    action_commitment: action,
    human_grant: {
      grant_ref: "TEST_ONLY:current-turn-deploy",
      grant_class: "CURRENT_TURN_GRANT",
      scope_match: true,
      protected_acts: ["DEPLOY"],
      action_commitment: action,
      situation_commitment: situation,
      target_scope: targets,
      status: "CURRENT",
      test_only: true,
      authority_delta: 0,
    },
    effect_class: "LOCAL_CONSEQUENTIAL",
    protected_acts: ["DEPLOY"],
    targets,
    network_scope: { mode: "LOOPBACK_ONLY", external: false },
    forbidden_effects: FORBIDDEN,
    policy: { version: FATE_EFFECT_POLICY.version, digest: FATE_EFFECT_POLICY_DIGEST },
    authority_delta: 0,
    ...overrides,
  };
}

test("FATE admits a fully bound test-only DEPLOY proposal deterministically", () => {
  const input = proposal();
  const a = evaluateEffectAdmission(input);
  const b = evaluateEffectAdmission(input);
  assert.equal(a.status, "ADMITTED");
  assert.equal(a.test_only, true);
  assert.equal(a.verdict_ref, b.verdict_ref);
  assert.equal(a.authority_delta, 0);
  assert.equal(a.blocked_by.length, 0);
});

test("FATE refuses the complete fail-closed matrix", () => {
  const cases = [
    ["no human grant", { human_grant: undefined }],
    ["wrong grant class", { human_grant: { ...proposal().human_grant, grant_class: "STANDING_LEASE" } }],
    ["missing grant ref", { human_grant: { ...proposal().human_grant, grant_ref: "" } }],
    ["scope mismatch", { human_grant: { ...proposal().human_grant, scope_match: false } }],
    ["grant lacks DEPLOY", { human_grant: { ...proposal().human_grant, protected_acts: [] } }],
    ["action mismatch", { human_grant: { ...proposal().human_grant, action_commitment: HASH("3") } }],
    ["situation mismatch", { human_grant: { ...proposal().human_grant, situation_commitment: HASH("4") } }],
    ["missing action", { action_commitment: undefined }],
    ["missing situation", { situation_commitment: undefined }],
    ["protected act mismatch", { protected_acts: ["PUBLISH"] }],
    ["additional protected act", { protected_acts: ["DEPLOY", "PUBLISH"] }],
    ["target outside scope", { targets: ["/outside"] }],
    ["gateway target", { targets: ["/candidate/gateway-drop-in"] }],
    ["network widening", { network_scope: { mode: "PUBLIC", external: true } }],
    ["non-loopback host", { network_scope: { mode: "LOOPBACK_ONLY", external: false, host: "0.0.0.0" } }],
    ["forbidden effect", { effects: ["gateway_mutation"] }],
    ["incomplete forbidden declarations", { forbidden_effects: [] }],
    ["authority widening", { authority_delta: 1 }],
    ["unknown policy", { policy: { version: "9", digest: HASH("9") } }],
    ["malformed input", null],
    ["stale grant", { human_grant: { ...proposal().human_grant, status: "EXPIRED" } }],
  ];
  for (const [name, override] of cases) {
    const result = evaluateEffectAdmission(override === null ? null : proposal(override));
    assert.equal(result.status, "REFUSED", name);
    assert.ok(result.blocked_by.length > 0, name);
  }
});

test("FATE refuses forbidden target classes even when the grant scope includes them", () => {
  for (const target of ["/home/mumo/.dema/runtime", "/candidate/bridge/drop-in", "/candidate/keys/signing-key"]) {
    const result = evaluateEffectAdmission(proposal({
      targets: [target],
      human_grant: { ...proposal().human_grant, target_scope: [target] },
    }));
    assert.equal(result.status, "REFUSED", target);
    assert.ok(result.blocked_by.includes("forbidden_target_scope"), target);
  }
});

test("FATE admits exact bounded Homebase promotion targets without confusing them with DEMA_HOME", () => {
  const targets = [
    "/home/bizra-operating-system/.config/systemd/user/dema-homebase.service.d/30-node0-genesis-final-sprint.conf",
    "/home/bizra-operating-system/.local/bin/dema",
  ];
  const input = proposal({
    targets,
    human_grant: { ...proposal().human_grant, target_scope: targets },
  });
  const admission = evaluateEffectAdmission(input);
  const execution = validateEffectAdmissionForExecution({ admission, proposal: input });
  assert.equal(admission.status, "ADMITTED");
  assert.equal(admission.test_only, true);
  assert.equal(execution.ok, false);
  assert.ok(execution.blocked_by.includes("test_fixture_not_runtime_authorization"));
});

test("FATE keeps reserved DEMA_HOME path tokens forbidden while allowing near-name collisions", () => {
  for (const target of ["/srv/dema-home/runtime", "/srv/dema_home/runtime", "/srv/dema-homebase.service.d/runtime"]) {
    const result = evaluateEffectAdmission(proposal({
      targets: [target],
      human_grant: { ...proposal().human_grant, target_scope: [target] },
    }));
    if (target.includes("homebase")) {
      assert.equal(result.status, "ADMITTED", target);
    } else {
      assert.equal(result.status, "REFUSED", target);
      assert.ok(result.blocked_by.includes("forbidden_target_scope"), target);
    }
  }
});

test("expiry is refused when an evaluated grant is already expired", () => {
  const input = proposal({ human_grant: { ...proposal().human_grant, expires_at: "2026-01-01T00:00:00.000Z", evaluated_at: "2026-02-01T00:00:00.000Z" } });
  const result = evaluateEffectAdmission(input);
  assert.equal(result.status, "REFUSED");
  assert.ok(result.blocked_by.includes("human_grant_expired_or_unbound"));
});

test("test-only ADMITTED verdict cannot authorize execution", () => {
  const input = proposal();
  const admission = evaluateEffectAdmission(input);
  const execution = validateEffectAdmissionForExecution({ admission, proposal: input });
  assert.equal(admission.status, "ADMITTED");
  assert.equal(execution.ok, false);
  assert.ok(execution.blocked_by.includes("test_fixture_not_runtime_authorization"));
});

test("pre-effect kernel refuses a test-only FATE verdict before mutation", () => {
  const root = mkdtempSync(join(tmpdir(), "fate-route-"));
  try {
    writeFileSync(join(root, "before.txt"), "bytes\n");
    const input = proposal({
      situation_commitment: HASH("1"),
      action_commitment: HASH("2"),
      targets: ["/candidate/ui-drop-in", "/candidate/bin-dema"],
    });
    const result = startFateStagedEffect({
      fs: nodeFs,
      scopeDir: root,
      operatorPhrase: NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE,
      fileName: "before.txt",
      newName: "after.txt",
      effectAdmission: input,
    });
    assert.equal(result.ok, false);
    assert.equal(result.phase, "HALTED_FATE");
    assert.ok(result.blocked_by.includes("test_fixture_not_runtime_authorization"));
    assert.equal(existsSync(join(root, "after.txt")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the public composition wrapper forwards FATE admission before mutation", () => {
  const root = mkdtempSync(join(tmpdir(), "fate-route-wrapper-"));
  try {
    writeFileSync(join(root, "before.txt"), "bytes\n");
    const result = runNode0FateStagedEffect({
      consent: NODE0_FATE_STAGED_EFFECT_GO_PHRASE,
      input: {
        fs: nodeFs,
        scopeDir: root,
        operatorPhrase: NODE0_FATE_STAGED_EFFECT_REQUIRED_PHRASE,
        fileName: "before.txt",
        newName: "after.txt",
        effectAdmission: proposal(),
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.phase, "HALTED_FATE");
    assert.equal(existsSync(join(root, "after.txt")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
