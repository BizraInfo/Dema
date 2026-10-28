// NODE0-WISDOM-LEDGER-1A — pure-kernel tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  redactSecrets,
  walkConversationMapping,
  extractWisdomAtoms,
  supersedeAtoms,
  buildWisdomLedger,
  verifyWisdomLedger,
} from "../packages/core/src/wisdom-ledger.js";

const msg = (role, text, t) => ({ author: { role }, create_time: t, content: { content_type: "text", parts: [text] } });
const conv = {
  conversation_id: "c1",
  current_node: "a2",
  mapping: {
    root: { id: "root", parent: null, children: ["u1"], message: null },
    u1: { parent: "root", children: ["a1", "a1b"], message: msg("user", "Design the receipt gate.", 1790000000) },
    a1: { parent: "u1", children: ["u2"], message: msg("assistant", "Rule: the gate MUST fail-closed. See packages/core/src/exists.js and NODE0-REAL-1A.", 1790000100) },
    a1b: { parent: "u1", children: [], message: msg("assistant", "Rejected draft with key sk-abcdefghijklmnop1234567890", 1790000090) },
    u2: { parent: "a1", children: ["a2"], message: msg("user", "Also build packages/core/src/missing.js for NODE0-GHOST-1A please.", 1790000200) },
    a2: { parent: "u2", children: [], message: msg("assistant", "We decided to use FATE consent for the missing module.", 1790000300) },
  },
};
const inv = { paths: ["packages/core/src/exists.js"], slices: ["NODE0-REAL-1A"] };

test("redactSecrets scrubs keys, tokens and assignments deterministically", () => {
  const out = redactSecrets("k=sk-abcdefghijklmnop1234 Bearer abcdefghijklmnop123 password: hunter22x ghp_" + "a".repeat(24));
  assert.ok(!/sk-abc|hunter22x|ghp_a/.test(out));
  assert.equal(redactSecrets(out), out);
});

test("walk: canonical chain plus rejected sibling branch", () => {
  const w = walkConversationMapping(conv.mapping, conv.current_node);
  assert.deepEqual(w.chain, ["root", "u1", "a1", "u2", "a2"]);
  assert.deepEqual(w.branch_pushbacks, [{ parent_id: "u1", kept_child: "a1", rejected_children: ["a1b"] }]);
});

test("atoms: anchored vs unbuilt vs rule vs decision vs pushback, all redacted", () => {
  const atoms = extractWisdomAtoms(conv, inv);
  const kinds = Object.fromEntries(atoms.map((a) => [a.atom_kind, a]));
  assert.equal(kinds.ARTIFACT_ANCHOR.disk_status, "ANCHORED_ON_DISK");
  assert.equal(kinds.ARTIFACT_ANCHOR.claim_label, "DERIVED");
  assert.equal(kinds.LOST_GOLDEN_GEM.disk_status, "UNBUILT_GEM_CANDIDATE");
  assert.equal(kinds.LOST_GOLDEN_GEM.claim_label, "UNKNOWN");
  assert.ok(kinds.ARCHITECTURE_DECISION);
  assert.equal(kinds.BRANCH_PUSHBACK.pushback_kind, "REGENERATION");
  assert.match(kinds.BRANCH_PUSHBACK.counterpart_snippet, /fail-closed/);
  assert.ok(!JSON.stringify(atoms).includes("sk-abcdefghijklmnop"));
  assert.ok(!JSON.stringify(atoms).includes("sk-abcdefghijklmnop"));
  assert.deepEqual(extractWisdomAtoms(conv, inv), atoms);
});

test("supersession flags older same-key atoms; ledger verifies and detects forgery", () => {
  const a = extractWisdomAtoms(conv, { paths: ["packages/core/src/exists.js", "packages/core/src/missing.js"], slices: [] });
  const old = { ...a[0], created_at: "2020-01-01T00:00:00.000Z", atom_sha256: "x".repeat(64) };
  const s = supersedeAtoms([old, ...a.filter((x) => x.referenced_paths.length)]);
  assert.ok(s.some((x) => x.superseded_by));
  const ledger = buildWisdomLedger({ source: "t", atoms: extractWisdomAtoms(conv, inv) });
  assert.deepEqual(verifyWisdomLedger(ledger), { ok: true, reasons: [] });
  assert.ok(verifyWisdomLedger({ ...ledger, atom_count: 99 }).reasons.includes("ledger_hash_mismatch"));
  const verified = { ...ledger, atoms: [{ ...ledger.atoms[0], claim_label: "VERIFIED" }, ...ledger.atoms.slice(1)] };
  assert.ok(verifyWisdomLedger(verified).reasons.includes("chat_claim_cannot_be_verified"));
  const flipped = { ...ledger, boundary: { ...ledger.boundary, model_invocation_performed: true } };
  assert.ok(verifyWisdomLedger(flipped).reasons.includes("boundary_not_false:model_invocation_performed"));
});

test("tool-log lines and build-output paths are not mined as wisdom", () => {
  const noisy = {
    conversation_id: "c2",
    current_node: "n1",
    mapping: {
      n1: { parent: null, children: [], message: msg("assistant", "• Ran sha256sum packages/dema-ui/.next/server/app/page.js NODE0-NOISE-1A\n└ packages/dema-ui/node_modules/x/index.js\nReal line: packages/core/src/exists.js is the gate.", 1790000000) },
    },
  };
  const atoms = extractWisdomAtoms(noisy, inv);
  assert.equal(atoms.length, 1);
  assert.deepEqual(atoms[0].referenced_paths, ["packages/core/src/exists.js"]);
});

test("pushback pairs: user prompt edits are not pushback; operator corrections pair with the rejected draft", () => {
  const c = {
    conversation_id: "c3",
    current_node: "u3",
    mapping: {
      root: { parent: null, children: ["uA", "uB"], message: null },
      uA: { parent: "root", children: [], message: msg("user", "first wording of the prompt", 1790000000) },
      uB: { parent: "root", children: ["a1"], message: msg("user", "second wording of the prompt", 1790000010) },
      a1: { parent: "uB", children: ["u3"], message: msg("assistant", "Done: all green, shipping the fake pass.", 1790000020) },
      u3: { parent: "a1", children: [], message: msg("user", "No, wrong. You must not fake green; fix it.", 1790000030) },
    },
  };
  const pb = extractWisdomAtoms(c, inv).filter((a) => a.atom_kind === "BRANCH_PUSHBACK");
  assert.equal(pb.length, 1);
  assert.equal(pb[0].pushback_kind, "OPERATOR_CORRECTION");
  assert.match(pb[0].counterpart_snippet, /fake pass/);
  const ledger = buildWisdomLedger({ source: "t", atoms: pb });
  assert.equal(verifyWisdomLedger(ledger).ok, true);
});
