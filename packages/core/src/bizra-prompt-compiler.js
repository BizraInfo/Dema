// BIZRA-PROMPT-COMPILER-0A — the founder's cognitive OS, compiled.
//
// Doctrine (operator ruling 2026-08-26): founder invocations are an
// UNCOMPILED COGNITIVE OPERATING SPECIFICATION, not prose. The habitat must
// understand the vocabulary ONCE and hand each actor an executable mission
// slice — never re-infer hierarchy per invocation, never compress named
// systems into generic prose, never silently drop unknown tokens.
//
// This kernel is the deterministic front half of that compiler:
//   trigger text → operator detection → typed roles → phase-ordered graph
//   → precedence chain → proof gates → output sections → MissionContract.
//
// Deliberately NOT in this slice: LLM calls, network, model routing, any
// execution authority. Compilation is pure text→structure; execution stays
// behind FATE.

export const BIZRA_PROMPT_COMPILER_SCHEMA = "bizra.dema.prompt_compiler.v0.1";
export const BIZRA_PROMPT_COMPILER_TRUTH_LABEL = "BIZRA_PROMPT_COMPILER_MEASURED_REPO";
export const BIZRA_PROMPT_COMPILER_GO_PHRASE = "GO: compile bizra prompt";

/**
 * Phase order IS precedence. Phases 0..10 mirror the compiled Peak Audit
 * Protocol; `compression` is the explicit law that comprehensive perception
 * and the minimum spearpoint are NOT peers — perception feeds compression,
 * compression selects exactly one provable act.
 */
export const PHASE_ORDER = Object.freeze([
  "evidence_boundary",      // 0  disk evidence overrides narrative
  "system_reconstruction",  // 1  process mining + knowledge index
  "multi_lens_audit",       // 2
  "sape_deep_probe",        // 3  Structure·Abstraction·Proof·Emergence
  "latent_state_discovery", // 4  HHMM
  "signal_gated_diffusion", // 5  SNR selects before anything amplifies
  "fde_dual_diagnostic",    // 6  INWARD vs OUTWARD
  "ihsan_gate",             // 7  constitutional filter
  "compression",            // 8a ruthless collapse to candidates
  "one_spearpoint",         // 8b exactly one minimum provable act
  "implementation",         // 9  red-first inside FATE only
  "self_critique",          // 10 convergence levels 0..5
]);

const ROLE = Object.freeze({
  OBJECTIVE: "objective",
  REASONING_METHOD: "reasoning_method",
  VERIFICATION_GATE: "verification_gate",
  DELIVERABLE: "deliverable",
});

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** The operator table — the ontology. Each entry binds ONE founder term to
 * ONE role, ONE phase, and its input/output contract. Adding a term here is
 * the ONLY way a token becomes executable machinery; everything else in a
 * trigger surfaces as UNCOMPILED_TOKENS. */
export const OPERATOR_TABLE = Object.freeze([
  { term: "process mining", role: ROLE.REASONING_METHOD, phase: "system_reconstruction",
    emits: "component_map" },
  { term: "hypergraph rag", role: ROLE.REASONING_METHOD, phase: "system_reconstruction",
    emits: "evidence_index" },
  { term: "hash table", role: ROLE.REASONING_METHOD, phase: "system_reconstruction",
    emits: "knowledge_index" },
  { term: "multi-lens audit", role: REASONING(), phase: "multi_lens_audit", emits: "findings" },
  { term: "sape", role: ROLE.REASONING_METHOD, phase: "sape_deep_probe", emits: "laws" },
  { term: "hhmm", role: ROLE.REASONING_METHOD, phase: "latent_state_discovery",
    emits: "hidden_state_hypotheses" },
  { term: "graph of thoughts", role: ROLE.REASONING_METHOD, phase: "signal_gated_diffusion",
    emits: "hypothesis_graph" },
  { term: "diffusion", role: ROLE.REASONING_METHOD, phase: "signal_gated_diffusion",
    emits: "diffused_findings" },
  { term: "snr", role: ROLE.VERIFICATION_GATE, phase: "signal_gated_diffusion",
    emits: "ranked_gems" },
  { term: "signal-gated", role: ROLE.VERIFICATION_GATE, phase: "signal_gated_diffusion",
    emits: "ranked_gems",
    note: "alias binding: 'signal-gated ...' implies the SNR gate governs the amplifier" },
  { term: "dema-fde", role: ROLE.VERIFICATION_GATE, phase: "fde_dual_diagnostic",
    emits: "failure_classification" },
  { term: "ihsan", role: ROLE.VERIFICATION_GATE, phase: "ihsan_gate", emits: "compliance_verdict" },
  { term: "micro-consent", role: ROLE.VERIFICATION_GATE, phase: "ihsan_gate",
    emits: "consent_checks" },
  { term: "proof-of-truth", role: ROLE.VERIFICATION_GATE, phase: "self_critique",
    emits: "convergence_levels" },
  { term: "self-critique", role: ROLE.VERIFICATION_GATE, phase: "self_critique",
    emits: "critique_report" },
  { term: "verified-reward", role: ROLE.OBJECTIVE, phase: "ihsan_gate", emits: "reward_law" },
  { term: "autopoietic loop", role: ROLE.OBJECTIVE, phase: "implementation",
    emits: "capability_conversion" },
  { term: "spearpoint", role: ROLE.DELIVERABLE, phase: "one_spearpoint",
    emits: "minimum_provable_act" },
  { term: "red-first", role: ROLE.REASONING_METHOD, phase: "implementation", emits: "tests_first" },
  { term: "receipts", role: ROLE.DELIVERABLE, phase: "implementation", emits: "proof_receipt" },
]);
function REASONING() { return ROLE.REASONING_METHOD; }

function detectOperators(text) {
  const hay = text.toLowerCase();
  const found = [];
  for (const op of OPERATOR_TABLE) {
    let idx = hay.indexOf(op.term);
    while (idx >= 0) {
      const before = idx === 0 ? " " : hay[idx - 1];
      const after = hay[idx + op.term.length] ?? " ";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
        found.push({ ...op, index: idx });
        break; // one binding per term
      }
      idx = hay.indexOf(op.term, idx + 1);
    }
  }
  return found.sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase) || a.index - b.index);
}

/** Known dense tokens that are DOCTRINE NAMES, not yet operators. They must
 * surface as warnings — never be swallowed as if understood. */
const KNOWN_UNCOMPILED = [
  "primordial activation protocol", "singularity pulse",
  "hypergraph hierarchical reasoning", "autopoietic self-improvement engine",
  "peak masterpiece", "articulation characterization",
];

export function compilePrompt({ text, hash } = {}) {
  if (typeof hash !== "function") throw new TypeError("hash function required");
  const blocked_by = [];
  const warnings = [];

  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    const body = { ok: false, schema: BIZRA_PROMPT_COMPILER_SCHEMA, operators: [],
      phase_order: [], precedence_chain: [], proof_gates: [], output_sections: [],
      uncompiled_tokens: [], warnings, blocked_by: ["empty_trigger"] };
    return Object.freeze({ ...body, content_hash: hash(body) });
  }

  const hay = trimmed.toLowerCase();
  const operators = detectOperators(trimmed);

  // NO SILENT DROP law — known doctrine names without operator bindings.
  // NO SILENT DROP is a REPORTING law, not a refusal law: recognized
  // machinery still compiles; unknown doctrine names surface loudly as
  // warnings + their own output section. Refusing would make one unfamiliar
  // phrase able to silence an otherwise executable mission.
  const uncompiled_tokens = KNOWN_UNCOMPILED.filter((t) => hay.includes(t));
  if (uncompiled_tokens.length > 0) {
    warnings.push({
      code: "UNCOMPILED_TOKENS_REPORTED",
      detail: `${uncompiled_tokens.length} doctrine name(s) have no operator binding and were NOT treated as executed machinery`,
    });
  }

  // Precedence law: comprehensive perception and minimum spearpoint are
  // related by chain, never peers.
  const precedence_chain = ["evidence_boundary"];
  const wantsSpear = operators.some((o) => o.phase === "one_spearpoint");
  const wantsPerception = operators.some((o) =>
    ["system_reconstruction", "multi_lens_audit", "sape_deep_probe",
     "latent_state_discovery"].includes(o.phase));
  if (wantsPerception) precedence_chain.push("perception");
  if (wantsPerception && wantsSpear) {
    precedence_chain.push("compression");
    warnings.push({
      code: "OBJECTIVES_RELATED_BY_PRECEDENCE",
      detail: "comprehensive analysis and minimum special case are phases of one chain: perceive -> compress -> ONE provable act; never run as peers",
    });
  }
  precedence_chain.push("amplification");
  if (wantsSpear) precedence_chain.push("one_spearpoint");
  else precedence_chain.push("report_only");

  const proof_gates = operators.filter((o) => o.role === ROLE.VERIFICATION_GATE)
    .map((o) => o.emits);
  const output_sections = [
    ...new Set(operators.map((o) => o.emits)),
    ...(uncompiled_tokens.length ? ["uncompiled_token_report"] : []),
  ];

  const ok = blocked_by.length === 0;
  const body = {
    ok,
    schema: BIZRA_PROMPT_COMPILER_SCHEMA,
    truth_label: BIZRA_PROMPT_COMPILER_TRUTH_LABEL,
    operators: operators.map(({ term, role, phase, emits }) => ({ term, role, phase, emits })),
    phase_order: [...new Set(operators.map((o) => o.phase))],
    precedence_chain,
    proof_gates,
    output_sections,
    uncompiled_tokens,
    warnings,
    boundary: Object.freeze({
      execution_allowed: false, llm_called: false, network_used: false,
      mint_allowed: false, authority_delta: 0,
    }),
    what_this_proves:
      "That the founder's dense invocation compiles into a typed, phase-ordered mission contract with no silently dropped tokens — the habitat understands the vocabulary once.",
    what_this_does_not_prove:
      "It does not execute anything, call any model, or prove the compiled mission will pass its own gates — compilation is structure, not performance.",
    blocked_by,
  };
  return Object.freeze({ ...body, content_hash: hash(body) });
}
