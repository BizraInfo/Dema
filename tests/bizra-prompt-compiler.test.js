import test from "node:test";
import assert from "node:assert/strict";

import {
  compilePrompt,
  OPERATOR_TABLE,
  PHASE_ORDER,
  BIZRA_PROMPT_COMPILER_SCHEMA,
} from "../packages/core/src/bizra-prompt-compiler.js";

const HASH = (o) => {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(JSON.stringify(o))) {
    h ^= b; h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16).padStart(8, "0")}`;
};

const CANONICAL_TRIGGER = `
Run the full authorized terrain. Conduct process mining over the history,
apply SAPE deep probe and HHMM latent-state discovery, compare branches with
graph of thoughts, filter through SNR, run the signal-gated diffusion
amplifier, classify failures with DEMA-FDE dual diagnostic, pass every finding
through the Ihsan gate, then select the minimum provable spearpoint and
implement it red-first with receipts.
`;

test("BPC-01 schema + deterministic compile of the canonical trigger", () => {
  const a = compilePrompt({ text: CANONICAL_TRIGGER, hash: HASH });
  const b = compilePrompt({ text: CANONICAL_TRIGGER, hash: HASH });
  assert.equal(a.schema, BIZRA_PROMPT_COMPILER_SCHEMA);
  assert.equal(a.content_hash, b.content_hash, "compile must be deterministic");
  // every named operator family detected exactly once
  for (const term of ["process mining", "sape", "hhmm", "diffusion", "snr",
    "dema-fde", "ihsan", "spearpoint", "graph of thoughts",
    "signal-gated", "red-first", "receipts"]) {
    assert.ok(
      a.operators.some((o) => o.term.includes(term)),
      `missing operator: ${term}`,
    );
  }
});

test("BPC-02 precedence law: perceive → compress → ONE spearpoint", () => {
  const a = compilePrompt({ text: CANONICAL_TRIGGER, hash: HASH });
  assert.equal(a.precedence_chain[0], "evidence_boundary");
  assert.equal(a.precedence_chain.at(-1), "one_spearpoint");
  assert.ok(a.precedence_chain.includes("compression"));
  // comprehensive perception and minimum spearpoint must NOT be peers:
  assert.ok(a.warnings.some((w) => w.code === "OBJECTIVES_RELATED_BY_PRECEDENCE"));
});

test("BPC-03 NO SILENT DROP: unrecognized dense tokens surface as UNCOMPILED_TOKENS", () => {
  const a = compilePrompt({
    text: "engage primordial activation protocol and singularity pulse then hypergraph RAG the estate",
    hash: HASH,
  });
  assert.deepEqual(a.uncompiled_tokens.sort(),
    ["primordial activation protocol", "singularity pulse"]);
  assert.ok(a.operators.some((o) => o.term === "hypergraph rag"),
    "hypergraph RAG is a bound operator, not an uncompiled token");
  // reporting law: warn loudly, compile the rest, never claim them executed
  assert.equal(a.ok, true);
  assert.ok(a.warnings.some((w) => w.code === "UNCOMPILED_TOKENS_REPORTED"));
  assert.ok(a.output_sections.includes("uncompiled_token_report"));
});

test("BPC-04 roles are typed: gates never appear as reasoning methods", () => {
  const ihsan = OPERATOR_TABLE.find((o) => o.term === "ihsan");
  const sape = OPERATOR_TABLE.find((o) => o.term === "sape");
  assert.equal(ihsan.role, "verification_gate");
  assert.equal(sape.role, "reasoning_method");
  for (const o of OPERATOR_TABLE) {
    assert.ok(["objective", "reasoning_method", "verification_gate", "deliverable"].includes(o.role));
    assert.ok(PHASE_ORDER.includes(o.phase));
  }
});

test("BPC-05 empty input refuses honestly", () => {
  const a = compilePrompt({ text: "   ", hash: HASH });
  assert.equal(a.ok, false);
  assert.ok(a.blocked_by.includes("empty_trigger"));
});
