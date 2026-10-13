import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL, compileMissionProposal, verifyMissionProposal } from "../../core/src/bizra-prompt-mission-bridge.js";
import { resolveTrustedRequirement } from "../src/app/api/mission/trusted-requirement.ts";

const NOW = "2026-10-13T20:30:00.000Z";
const MISSION = "BIZRA-GENESIS-LOCAL-MISSION-0";
const TITLE = "Source-cited Node0 status brief through one governed mission";
const HASH = `sha256:${"a".repeat(64)}`;
const defaultPolicy = {
  schema: "bizra.node0.1tr1.test_policy.v1",
  id: "NODE0-MOMO-TRUSTED-REQUIREMENT-ROUTE-INTEGRATION-1T-R1",
  authority_ref: "GO NODE0-MOMO-TRUSTED-REQUIREMENT-ROUTE-INTEGRATION-1T-R1",
  scope: "ISOLATED_NONEXECUTING_TEST_ONLY", task_id: MISSION,
  required_operation: "METADATA_INVENTORY_READ_ONLY",
  valid_from: "2026-10-13T20:26:59.532196Z", expires_at: "2026-10-13T21:56:59.532196Z",
  revoked: false,
};
const frozenPolicyBytes = process.env.BIZRA_1TR1_TEST_POLICY_FILE
  ? readFileSync(process.env.BIZRA_1TR1_TEST_POLICY_FILE) : Buffer.from(JSON.stringify(defaultPolicy));
const policy = (overrides = {}) => Object.keys(overrides).length
  ? Buffer.from(JSON.stringify({ ...JSON.parse(frozenPolicyBytes), ...overrides })) : Buffer.from(frozenPolicyBytes);
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const strip = source => stripTypeScriptTypes(source.replace(/^export /gm, ""));

function runtimeHelpers(resolver, nowIso) {
  const source = read("../src/app/api/mission/node0-runtime.ts");
  const start = source.indexOf("export function proposalBinding(proposal: any)");
  const end = source.indexOf("export async function callGovernedRuntime", start);
  assert.ok(start >= 0 && end > start);
  const hashRule = source.match(/^const HASH_RE = .*;$/m)?.[0];
  assert.ok(hashRule);
  const code = hashRule + strip(source.slice(start, end));
  return new Function("verifyMissionProposal", "requireCompilerCodeHash", "resolveTrustedRequirement", "Date", "BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL", "mergeNode0MissionContext",
    code + ";return {proposalBinding,verifySubmittedProposal,missionRequirementResponse:typeof missionRequirementResponse==='function'?missionRequirementResponse:null};")(
    verifyMissionProposal, () => HASH, resolver, class { toISOString() { return nowIso; } }, BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL, () => ({}),
  );
}

export async function evaluateRoute(route, {
  task = MISSION, legacy = false, policyBytes = policy(),
  mutateProposal, mutateRequest, resolver, nowIso = NOW, optionalPat = false,
  context = {},
} = {}) {
  const resolve = resolver ?? ((id, options = {}) => resolveTrustedRequirement(id, { ...options, test_policy_bytes: policyBytes }));
  const requirement = resolveTrustedRequirement(task, { test_policy_bytes: policy() });
  const proposal = structuredClone(compileMissionProposal({
    text: task === "TASK-075.26" ? TITLE : "Inventory BIZRA metadata.",
    context, now_iso: NOW, compiler_code_hash: HASH,
    ...(legacy ? {} : { task_requirement: requirement }),
  }));
  mutateProposal?.(proposal);
  const helper = runtimeHelpers(resolve, nowIso);
  const counters = { attention: 0, downstream: [] };
  const root = "/FIXTURE_ONLY_NOT_NODE0";
  const body = {
    text: task === "TASK-075.26" ? TITLE : "Inventory BIZRA metadata.",
    task_id: task, proposal,
    consent_context: { mission_id: proposal.mission_id, canonical_root: root, proposal_binding: helper.proposalBinding(proposal) },
    phrase: "FIXTURE_NOT_CONSUMED",
    ...(optionalPat ? { pat_consent_context: { fixture: true }, pat_phrase: "FIXTURE_PAT_NOT_CONSUMED" } : {}),
  };
  if (route === "prepare") {
    delete body.proposal;
    delete body.consent_context;
    delete body.phrase;
    if (mutateProposal) body.task_requirement = proposal.task_requirement ?? null;
  }
  mutateRequest?.(body);
  const source = read(`../src/app/api/mission/${route}/route.ts`);
  const marker = route === "execute" ? "function sameBinding(left: any, right: any)" : "export async function POST(request: NextRequest)";
  assert.equal(source.indexOf(marker), source.lastIndexOf(marker));
  assert.ok(source.indexOf(marker) >= 0);
  const code = strip(source.slice(source.indexOf(marker)));
  const handler = new Function("NextResponse", "requireLocalSession", "compileMissionProposal", "verifyMissionProposal",
    "mergeNode0MissionContext", "persistAttentionAllocation", "MAX_INTENT_BYTES", "verifySubmittedProposal", "configuredMissionRoot",
    "proposalBinding", "callGovernedRuntime", "BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL", "resolveTrustedRequirement",
    "missionRequirementResponse", "process", "Date", code + ";return POST;")(
    { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) }, async () => null,
    compileMissionProposal, verifyMissionProposal, () => ({}), () => { counters.attention++; return { ok: true, receipt: {} }; },
    65536, helper.verifySubmittedProposal, () => root, helper.proposalBinding,
    async (path) => { counters.downstream.push(path); return { status: 200, data: { ok: true } }; },
    BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL, resolve, helper.missionRequirementResponse,
    { env: { BIZRA_PROMPT_COMPILER_CODE_HASH: HASH } }, class { toISOString() { return nowIso; } },
  );
  const response = await handler({ json: async () => body });
  return { response, counters };
}

function noEffects(result) {
  assert.equal(result.counters.attention, 0, "no attention persistence");
  assert.deepEqual(result.counters.downstream, [], "PRECONSENT_CORRESPONDENCE_MUST_PRECEDE_ANY_TRANSPORT");
  assert.equal(result.response.body.consent_card_allowed, false);
  assert.equal(result.response.body.runtime_call_allowed, false);
  assert.equal(result.response.body.task_completed, false);
  assert.equal(result.response.body.effect_observed, null);
}

for (const route of ["prepare", "consent-card", "execute"]) {
  test(`${route}: actual brief and frozen legacy counterexample refuse before any effect`, async () => {
    for (const legacy of [false, true]) {
      const result = await evaluateRoute(route, { task: "TASK-075.26", legacy, optionalPat: true });
      noEffects(result);
      assert.equal(result.response.body.ok, false);
      assert.equal(result.response.body.verdict, "BLOCKED_UNSUPPORTED_OPERATION");
    }
  });
  test(`${route}: independent metadata fixture is a nonexecuting preview; all-deny fails`, async () => {
    const result = await evaluateRoute(route);
    noEffects(result);
    assert.equal(result.response.body.ok, true);
    assert.equal(result.response.body.verdict, "OPERATION_MATCH_PREVIEW_ONLY");
    if (process.env.BIZRA_1TR1_TEST_POLICY_FILE) {
      const frozen = readFileSync(process.env.BIZRA_1TR1_TEST_POLICY_FILE);
      assert.equal(result.response.body.proposal.task_requirement.policy.hash,
        "sha256:" + createHash("sha256").update(frozen).digest("hex"));
    }
  });
  test(`${route}: unbound, stale, expired, revoked and forged requests have zero effects`, async () => {
    for (const options of [
      { policyBytes: null }, { policyBytes: policy({ revoked: true }) },
      { policyBytes: policy({ expires_at: NOW }) },
      { policyBytes: policy({ valid_from: "2026-10-14T00:00:00Z" }) },
      { policyBytes: policy({ task_id: "OTHER-TASK" }) },
      { nowIso: null },
      { mutateProposal: p => { p.task_requirement.owner.identity = "/forged/owner"; } },
      { mutateProposal: p => { p.task_requirement.capability.operation = "WRITE_REPORT"; } },
      { mutateProposal: p => { p.task_requirement.policy.authority_ref = "FATE admitted"; } },
      { mutateProposal: p => { delete p.task_requirement; } },
      { mutateRequest: b => { delete b.task_id; if (b.proposal) delete b.proposal.task_requirement; } },
      { mutateRequest: b => { b.task_id = "OTHER-TASK"; } },
      { mutateRequest: b => { b.verification = { ok: true }; b.done = true; b.runtime_receipt = { forged: true }; }, policyBytes: null },
    ]) {
      const result = await evaluateRoute(route, options);
      noEffects(result);
      assert.equal(result.response.body.ok, false, JSON.stringify(options));
    }
  });
}

test("execute: stale consent binding or cross-mission collage cannot become a preview", async () => {
  for (const mutateRequest of [
    b => { b.consent_context.mission_id = "OTHER-MISSION"; },
    b => { b.consent_context.proposal_binding.bridge_hash = `sha256:${"b".repeat(64)}`; },
    b => { b.consent_context.proposal_binding.requirement_binding_hash = `sha256:${"c".repeat(64)}`; },
  ]) {
    const result = await evaluateRoute("execute", { mutateRequest, optionalPat: true });
    noEffects(result);
    assert.equal(result.response.body.ok, false);
  }
});

test("prepare to execute: freshly re-read owner drift invalidates a prepared proposal", async () => {
  const resolver = (id, options) => {
    const current = resolveTrustedRequirement(id, { ...options, test_policy_bytes: policy() });
    if (current) current.owner.hash = `sha256:${"c".repeat(64)}`;
    return current;
  };
  const result = await evaluateRoute("execute", { resolver });
  noEffects(result);
  assert.equal(result.response.body.ok, false);
});

test("direct consumer with unbound legacy metadata cannot bypass prepare", async () => {
  for (const route of ["consent-card", "execute"]) {
    const result = await evaluateRoute(route, { legacy: true, policyBytes: null, optionalPat: true });
    noEffects(result);
    assert.equal(result.response.body.verdict, "PRODUCTION_REQUIREMENT_POLICY_UNBOUND");
  }
});

test("self-consistent caller context is not the independent server context", async () => {
  for (const route of ["consent-card", "execute"]) {
    const result = await evaluateRoute(route, {
      context: { root_dna: { status: "BOUND", hash: `sha256:${"b".repeat(64)}`, source: "caller_forgery" } },
    });
    noEffects(result);
    assert.equal(result.response.body.ok, false);
  }
});

test("cold evaluation: normalized route semantics have a deterministic commitment", async () => {
  const rows = [];
  for (const route of ["prepare", "consent-card", "execute"]) {
    for (const task of ["TASK-075.26", MISSION]) {
      const result = await evaluateRoute(route, { task });
      noEffects(result);
      rows.push({ route, task, body: result.response.body, counters: result.counters });
    }
  }
  console.log("SEMANTIC_DIGEST sha256:" + createHash("sha256").update(JSON.stringify(rows)).digest("hex"));
});
