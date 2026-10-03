import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { compileMissionProposal } from "../packages/core/src/bizra-prompt-mission-bridge.js";
import {
  BIZRA_ESTATE_CAPABILITY_ID,
  DEFAULT_ESTATE_LIMITS,
  buildEstateCapability,
  buildEstateFounderReport,
  buildEstateObservation,
  classifyConsequentialLanguage,
  capabilityIsEquivalent,
  isBizraEstateIntent,
  resolveFounderEstateRoots,
} from "../packages/core/src/founder-estate-workflow.js";

const compiler_code_hash = `sha256:${"a".repeat(64)}`;
const context = { root_dna: { status: "UNKNOWN" }, node_story: { status: "UNKNOWN" }, current_state: { status: "UNKNOWN" } };
const now_iso = "2026-09-15T00:00:00.000Z";

test("FOUNDER-ESTATE-NEGATION: prohibitions do not become requested effects", () => {
  const proposal = compileMissionProposal({
    text: "Map my BIZRA assets read-only. Do not move, rename or delete anything.",
    context,
    now_iso,
    compiler_code_hash,
  });
  assert.equal(proposal.decision, "PROPOSE_ONLY");
  assert.equal(proposal.capability.id, BIZRA_ESTATE_CAPABILITY_ID);
  assert.deepEqual(proposal.requested_actions, []);
  assert.deepEqual(proposal.prohibited_actions.map((item) => item.action), ["file_move", "file_rename", "delete"]);
  assert.equal(proposal.authority.consent_required, false);
  assert.equal(proposal.authority.authority_delta, 0);
});

test("FOUNDER-ESTATE-ACTIONS: positive and ambiguous effects remain fail-closed", () => {
  const positive = compileMissionProposal({ text: "Delete these BIZRA files.", context, now_iso, compiler_code_hash });
  assert.equal(positive.decision, "WAIT_FOR_HUMAN");
  assert.equal(positive.requested_actions[0].action, "delete");
  assert.equal(positive.authority.consent_required, true);

  const mixed = classifyConsequentialLanguage("Do not delete anything unless you think it is safe.");
  assert.equal(mixed.requested_actions.length, 0);
  assert.equal(mixed.ambiguous_actions[0].action, "delete");
  const move = classifyConsequentialLanguage("Move these files.");
  assert.equal(move.requested_actions[0].action, "file_move");
  for (const text of ["Push this repository.", "Deploy this application."]) {
    const gated = compileMissionProposal({ text, context, now_iso, compiler_code_hash });
    assert.equal(gated.decision, "WAIT_FOR_HUMAN");
    assert.equal(gated.authority.consent_required, true);
  }
});

test("FOUNDER-ESTATE-OBSERVE: bounded metadata observation reuses scanner boundaries", async () => {
  const root = mkdtempSync(join(tmpdir(), "dema-estate-"));
  const outside = mkdtempSync(join(tmpdir(), "dema-estate-outside-"));
  try {
    mkdirSync(join(root, "research"));
    writeFileSync(join(root, "research", "notes.md"), "content must not be read\n");
    writeFileSync(join(root, ".env"), "DEMA_LOCAL_AUTH_SECRET=redacted\n");
    writeFileSync(join(root, "id_ed25519"), "private\n");
    writeFileSync(join(outside, "outside.md"), "outside\n");
    symlinkSync(join(outside, "outside.md"), join(root, "escape-link"));
    const before = statSync(root).mtimeMs;
    const capability = buildEstateCapability({ roots: [root], limits: { max_depth: 2, max_entries: 20 } });
    const observation = await buildEstateObservation({ capability, now: new Date(now_iso) });
    const report = buildEstateFounderReport({ observation, missionId: "MISSION-aaaaaaaaaaaaaaaa", sourceText: "Map my BIZRA assets read-only." });
    assert.equal(observation.boundary.file_content_read, false);
    assert.equal(observation.boundary.network_used, false);
    assert.equal(observation.boundary.symlink_followed, false);
    assert.equal(observation.boundary.delete_or_move_performed, false);
    assert.equal(observation.totals.symlinks_count, 1);
    assert.ok(observation.root_results[0].denied.some((entry) => entry.reason === "secret_or_key_pattern"));
    assert.equal(JSON.stringify(observation).includes("content must not be read"), false);
    assert.equal(JSON.stringify(observation).includes("PRIVATE KEY"), false);
    assert.equal(report.proof.claim_ceiling, "BOUNDED_METADATA_OBSERVATION");
    assert.equal(report.what_i_could_not_see.truncated, false);
    assert.equal(statSync(root).mtimeMs, before);
    assert.equal(readFileSync(join(root, "research", "notes.md"), "utf8"), "content must not be read\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("FOUNDER-ESTATE-INTENT: supported family is narrow and deterministic", () => {
  assert.equal(isBizraEstateIntent("Show me what BIZRA repositories and assets I have."), true);
  assert.equal(isBizraEstateIntent("Map my BIZRA estate read-only."), true);
  assert.equal(isBizraEstateIntent("Delete everything in BIZRA."), false);
  assert.equal(isBizraEstateIntent("Tell me a joke."), false);
});

test("FOUNDER-ESTATE-LIMITS: truncation lowers the proof ceiling", async () => {
  assert.equal(DEFAULT_ESTATE_LIMITS.max_entries, 500);
  const root = mkdtempSync(join(tmpdir(), "dema-estate-limit-"));
  try {
    for (let i = 0; i < 8; i += 1) writeFileSync(join(root, `asset-${i}.md`), "x\n");
    const observation = await buildEstateObservation({
      capability: buildEstateCapability({ roots: [root], limits: { max_depth: 1, max_entries: 3 } }),
      now: new Date(now_iso),
    });
    const report = buildEstateFounderReport({ observation, missionId: "MISSION-bbbbbbbbbbbbbbbb", sourceText: "Map my BIZRA assets read-only." });
    assert.equal(observation.totals.truncated, true);
    assert.equal(report.proof.claim_ceiling, "BOUNDED_PARTIAL_METADATA_OBSERVATION");
    assert.match(report.what_i_could_not_see.note, /partial/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("FOUNDER-ESTATE-BOUNDARY: roots, capabilities and unknown effects fail closed", async () => {
  assert.deepEqual(resolveFounderEstateRoots({ BIZRA_ESTATE_ROOTS: "/tmp/bizra-a:/tmp/bizra-b" }), ["/tmp/bizra-a", "/tmp/bizra-b"]);
  assert.throws(() => resolveFounderEstateRoots({ BIZRA_ESTATE_ROOTS: "/" }), /estate_root_too_broad/);
  assert.throws(() => buildEstateCapability({ roots: ["relative-root"] }), /estate_root_must_be_absolute/);
  const unknown = classifyConsequentialLanguage("No external side effect.");
  assert.equal(unknown.prohibited_actions[0].action, "unknown_consequential_action");
  await assert.rejects(buildEstateObservation({ capability: { id: "wrong" } }), /estate_capability_invalid/);
  assert.equal(capabilityIsEquivalent(buildEstateCapability({ roots: ["/tmp/a"] }), buildEstateCapability({ roots: ["/tmp/a"] })), true);
  assert.equal(capabilityIsEquivalent(buildEstateCapability({ roots: ["/tmp/a"] }), buildEstateCapability({ roots: ["/tmp/b"] })), false);
});
