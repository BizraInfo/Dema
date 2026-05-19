// Inline canon teacher: 28 grounded vocabulary entries for BIZRA/Dema concepts.
// Source anchors: docs/canon/BIZRA_TOPOLOGY_CANON.md,
//   docs/public/third-fact-v0.1.md, docs/LIGHTHOUSE.md,
//   docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md.
// truth_label values: DECLARED (canon file), MEASURED (tested/verified), ASSUMED (derived).

const SCHEMA = "bizra.dema.canon_glossary_entry.v0.1";

const RAW_ENTRIES = [
  {
    concept: "ihsan",
    title: "Ihsan",
    short: "Excellence as the minimum bar, not the aspiration.",
    long: "The discipline of doing what you do as if you can see what is good, knowing it is being witnessed. In BIZRA it sets the floor for every agent output, refusal, and receipt: produce nothing that falls below what a fully present craftsperson would produce.",
    truth_label: "DECLARED",
    see_also: ["adl", "daughter-test", "refusal-as-product"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "adl",
    title: "Adl",
    short: "Fairness and bounded inequality — no participant extracts at the expense of another.",
    long: "Adl (عدل) is the constitutional principle that governs economic design in BIZRA. It forbids riba-based extraction, caps inequality (Gini ≤ 0.35 per the founding docs), and is paired with Ihsan: the floor (excellence) and the ceiling (fairness) together bound every system design decision.",
    truth_label: "DECLARED",
    see_also: ["ihsan", "riba-zero", "founding-documents"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "riba-zero",
    title: "Riba-Zero",
    short: "No usury — no unearned extraction from time-decay of value.",
    long: "Riba (ربا) is interest or usury: value extracted purely because time has passed, not because work was done. BIZRA's constitutional spine declares riba-zero as a hard invariant. Any financial primitive, token design, or fee structure that charges interest on idle capital violates this invariant and is refused by the system.",
    truth_label: "DECLARED",
    see_also: ["adl", "founding-documents", "zann-zero"],
    doc_anchor: "docs/public/third-fact-v0.1.md"
  },
  {
    concept: "zann-zero",
    title: "Zann-Zero",
    short: "No speculation passed off as certainty.",
    long: "Zann (ظن) is conjecture or ungrounded opinion presented as fact. BIZRA enforces zann-zero across all agent outputs, documentation, and receipts. Every factual claim must be tagged with its truth label (DECLARED, MEASURED, or ASSUMED). Collapsing these categories — treating an assumption as a proven fact — is a zann violation and is treated as a doctrine failure.",
    truth_label: "DECLARED",
    see_also: ["truth-label", "ihsan", "founding-documents"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "pat",
    title: "PAT · Personal Agentic Team",
    short: "The user-side 7-agent team that lives on your own device and serves only you.",
    long: "PAT-7 is minted locally on the human's device at first activation. Its seven agents are: P1 Planner, P2 Researcher, P3 Coder, P4 Evaluator, P5 Ethicist (frozen: ethics from axioms, not data), P6 Publisher, P7 DEMA/Nexus (the face — the human only ever talks to DEMA). PAT is user-loyal. It never connects to the network directly: all network interaction flows PAT → Membrane → SAT.",
    truth_label: "DECLARED",
    see_also: ["sat", "dema", "bizra"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "sat",
    title: "SAT · System Agentic Team",
    short: "The shared verifier-side 5-agent team that lives in the URP, not on your device.",
    long: "Each human who joins BIZRA contributes 5 SAT agents to the shared Universal Resource Pool (URP). SAT-5 agents are: S1 Validator (receipt integrity), S2 Oracle (frozen truth axioms), S3 Mediator (fair dispute resolution), S4 Archivist (House of Wisdom), S5 Sentinel (threat detection). SAT follows constitutional law only — no human designs their behavior. SAT is system-loyal, not user-loyal.",
    truth_label: "DECLARED",
    see_also: ["pat", "urp", "boundary"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "urp",
    title: "URP · Universal Resource Pool",
    short: "The one shared living organism for the entire BIZRA ecosystem — not per-user, not a server.",
    long: "The URP is singular. It is not middleware, not a server that nodes are clients of, and not per-user. It wakes up when Node0 activates: SAT-5 agents are minted into it, and it grows by 5 SAT agents for every new human who joins. The URP contains: the Constitutional Spine, House of Wisdom, Proof Engine, SEED Treasury, Compute Pool, Storage Pool, Bandwidth Pool, Shared Reflex Registry, and Receipt Log.",
    truth_label: "DECLARED",
    see_also: ["sat", "bizra", "node0"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "fate",
    title: "FATE · Evaluation and Consent Gate",
    short: "The constitutional membrane component that gates agent actions against the consent record.",
    long: "FATE is one of the 7 BIZRA pillars. It sits between intent (PAT) and execution (SAT/network), evaluating every proposed action against the operator's consent scope. FATE is fail-closed: an incomplete or absent consent record blocks, not degrades gracefully. It implements ADR-005 exact-string consent for operator-facing actions.",
    truth_label: "DECLARED",
    see_also: ["pat", "sat", "boundary"],
    doc_anchor: "docs/public/third-fact-v0.1.md"
  },
  {
    concept: "dema",
    title: "DEMA · P7 · The Face",
    short: "The human-facing agent — P7 of PAT-7. The only surface the operator directly touches.",
    long: "DEMA is P7 (the Nexus/face) in the PAT-7 team. It is the only agent the human interacts with: all other PAT agents, SAT agents, and the URP are invisible to the operator. DEMA routes intent, surfaces previews, mints receipts, and refuses actions that violate the boundary. At the repo level, Dema is the CLI and local toolkit — the face of the system before federation is active.",
    truth_label: "DECLARED",
    see_also: ["pat", "boundary", "receipt"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "bizra",
    title: "BIZRA · The 7-Pillar Ecosystem",
    short: "The constitutional ecosystem of sovereign local intelligence — PAT · SAT · DEMA · FATE · URP · RECEIPTS · POI.",
    long: "BIZRA (البذرة, the seed) is the full ecosystem. Its seven pillars are: PAT (Personal Agentic Team), SAT (System Agentic Team), DEMA (the face), FATE (consent gate), URP (Universal Resource Pool), RECEIPTS (the evidence chain), and POI (Proof of Impact). The Third Fact manifesto anchors the architecture at Bitcoin blocks 948027–948029. BIZRA is fractal: every node carries the full system DNA (seed-pattern invariant).",
    truth_label: "DECLARED",
    see_also: ["pat", "sat", "third-fact"],
    doc_anchor: "docs/public/third-fact-v0.1.md"
  },
  {
    concept: "third-fact",
    title: "Third Fact",
    short: "The founding manifesto: data comes from the many, infrastructure is owned by the few — BIZRA closes that gap.",
    long: "The Third Fact (docs/public/third-fact-v0.1.md) states: the first fact is that intelligence needs computation; the second fact is that intelligence needs data. The third fact is the fracture — data comes from the many while infrastructure is owned by the few. BIZRA is the design thesis that closes this fracture: sovereign local intelligence, receipt-backed provenance, and constitutional economics. Anchored to Bitcoin blocks 948027, 948028, 948029.",
    truth_label: "DECLARED",
    see_also: ["al-risala", "al-budhra", "bitcoin-anchor"],
    doc_anchor: "docs/public/third-fact-v0.1.md"
  },
  {
    concept: "al-risala",
    title: "الرسالة · The Message",
    short: "One of the three founding documents — the mission letter from the first architect.",
    long: "الرسالة (al-Risāla, The Message) is the founding letter authored by Node0 (Mohamed Beshr). Together with البذرة and the Third Fact, it forms the DNA of BIZRA's constitutional spine. All three documents are Bitcoin-anchored at blocks 948027, 948028, 948029 and are the first corpus entries a Lighthouse operator must read before participating.",
    truth_label: "DECLARED",
    see_also: ["al-budhra", "third-fact", "bitcoin-anchor"],
    doc_anchor: "docs/public/third-fact-v0.1.md"
  },
  {
    concept: "al-budhra",
    title: "البذرة · The Seed",
    short: "One of the three founding documents — the seed-pattern constitutional blueprint.",
    long: "البذرة (al-Budhra, The Seed) is the second founding document. It carries the economic design (50% project-profit founder oath, 2.5% universal Zakat, zero riba), the 7-pillar architecture, and the seed-pattern invariant: every node carries the full system DNA. Anchored at Bitcoin blocks 948027–948029 alongside الرسالة and the Third Fact.",
    truth_label: "DECLARED",
    see_also: ["al-risala", "third-fact", "founding-documents"],
    doc_anchor: "docs/public/third-fact-v0.1.md"
  },
  {
    concept: "node0",
    title: "Node0",
    short: "The origin — the founder's primary device, the first activated PAT-7 in the system.",
    long: "Node0 is the first node. There is exactly one Node0. Per the Node Ordinal Law in BIZRA_TOPOLOGY_CANON.md: Node0 is the origin, and its ordinal is identity-bearing. The Dema CLI running locally on Node0 is called NODE0_LOCAL_SEED mode. Node0 runs without federation, without a live network, and without a public economic claim — it is the seed the whole system grows from.",
    truth_label: "DECLARED",
    see_also: ["node1", "boundary", "pat"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "node1",
    title: "Node1",
    short: "The first invited human — a different person, not the founder's second device.",
    long: "Node1 is the second human to complete BIZRA onboarding, receive a registry-assigned ordinal, and mint their own PAT-7 on their own hardware. The common mistake is to assume Node1 is the operator's second laptop — it is not. A companion device shares the same ordinal as its primary. Node1 onboarding depends on Lighthouse proving 'alive alone' on at least one other machine before federation is attempted.",
    truth_label: "DECLARED",
    see_also: ["node0", "lighthouse", "ring-1"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "lighthouse",
    title: "Lighthouse",
    short: "The private, invitation-only pilot lane for validating Dema before public federation.",
    long: "Lighthouse is BIZRA's proving step for 'alive alone' on a second machine with a different human. It is not open for public application. Operators must be personally known to the program owner, read all three founding documents, operate inside exact-string consent discipline, and hold a posture where the bounded act is the point — not speculation about upside. Lighthouse validates: install → setup → doctor → first L4 receipt.",
    truth_label: "DECLARED",
    see_also: ["node1", "ring-0", "ring-1"],
    doc_anchor: "docs/LIGHTHOUSE.md"
  },
  {
    concept: "ring-0",
    title: "Ring 0",
    short: "The founder — the innermost trust circle in the evidence-first GTM ladder.",
    long: "Ring 0 is the founder (Node0 operator). In evidence-first GTM, real paradigm shifts propagate through rings of increasing skepticism: Ring 0 (founder) → Ring 1 (technical lighthouse) → Ring 2 (domain lighthouse) → Ring 3 (design partner cohort) → Ring 4 (public record). The rule: evidence arrives before narrative. A ring is never claimed before it is earned. Skipping rings is forbidden.",
    truth_label: "DECLARED",
    see_also: ["ring-1", "lighthouse", "node0"],
    doc_anchor: "docs/LIGHTHOUSE.md"
  },
  {
    concept: "ring-1",
    title: "Ring 1",
    short: "Technical lighthouse operators — the first external witnesses, personally known to Ring 0.",
    long: "Ring 1 is the Lighthouse cohort: technically capable operators from the existing trust circle who can run, verify, and witness Dema locally on their own hardware. Ring 1 is earned when at least one external human has completed onboarding, produced a first receipt, and can replay the boundary proofs without hand-holding. Public outreach for Ring 1 operators is itself a federation claim and is forbidden.",
    truth_label: "DECLARED",
    see_also: ["ring-0", "lighthouse", "node1"],
    doc_anchor: "docs/LIGHTHOUSE.md"
  },
  {
    concept: "artifact-011",
    title: "ARTIFACT-011",
    short: "The ARTIFACT-011 readiness gate — the constitutional checkpoint before any runtime activation.",
    long: "ARTIFACT-011 is referenced in `dema mission propose` as the boundary that governs whether BIZRA Node0 is ready to run a bounded diagnostic activation. It is not a software artifact — it is a readiness declaration that the constitutional layer has been proven locally. The mission propose command previews this gate without executing it. Runtime activation requires typed explicit consent: 'GO: Node0 bounded diagnostic activation only'.",
    truth_label: "DECLARED",
    see_also: ["boundary", "receipt", "truth-label"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "adr-005",
    title: "ADR-005 · Explicit Consent Rule",
    short: "Operator actions require exact-string typed consent — no fuzzy match, no case-insensitive shortcut.",
    long: "ADR-005 (Accepted, 2026-04-17) establishes that all operator actions require: pre-action disclosure, granular per-action consent (not blanket), visible action log, stop-anytime, reversibility signal, sandbox default, and receipt generation. The key invariant for the Dema CLI: consent phrases must match verbatim. A consent phrase with a spelling variant, extra space, or case difference is rejected. This rule is load-bearing across PAT, SAT, FATE, and skill-growth-governor.",
    truth_label: "DECLARED",
    see_also: ["boundary", "receipt", "refusal-as-product"],
    doc_anchor: "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md"
  },
  {
    concept: "daughter-test",
    title: "Daughter Test",
    short: "Would you be willing to subject your own family to this output? If not, do not ship it.",
    long: "The Daughter Test is the operational application of Ihsan: before releasing any output, ask whether you would accept the same output if it came from a system your family depended on. If not, it does not clear the Ihsan floor. It is the primary human-dignity check in BIZRA and is binding on all brand IP and all public-facing artifacts.",
    truth_label: "DECLARED",
    see_also: ["ihsan", "adl", "refusal-as-product"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "receipt",
    title: "Receipt",
    short: "A BLAKE3-chained, tamper-evident record that every consequential action in Dema produces.",
    long: "A receipt is the atomic unit of BIZRA provenance. Every crossing of the constitutional membrane, every mint, every skill promotion, and every consent event produces a receipt chained to the previous one via BLAKE3 hash. Receipts have: a schema tag, an evidence hash, a chain position, a prev_hash link, and a truth label. A receipt cannot be minted, modified, or faked locally — it routes through the governed gateway handoff.",
    truth_label: "DECLARED",
    see_also: ["chain", "boundary", "truth-label"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "chain",
    title: "Chain · Receipt Chain",
    short: "The append-only, BLAKE3-linked sequence of receipts that forms the local evidence log.",
    long: "The receipt chain is the local evidence log: an ordered sequence of receipts where each receipt's prev_hash field links to the BLAKE3 hash of the prior receipt. The chain is append-only and tamper-evident. Any gap, hash mismatch, or out-of-order entry is a chain violation. The chain does not live on a blockchain — it is a local filesystem-scoped structure managed under ~/.dema/receipts/ and verified by the SAT-4 Receipt Chain Verifier.",
    truth_label: "DECLARED",
    see_also: ["receipt", "boundary", "sat"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "truth-label",
    title: "Truth Label",
    short: "A tag on every claim: DECLARED · MEASURED · ASSUMED · ASPIRATIONAL — no collapsing allowed.",
    long: "Every claim in a BIZRA artifact must carry a truth label that says exactly how certain it is. The canonical labels are: DECLARED (explicit in a canon document), MEASURED (empirically tested — tests pass, numbers measured), ASSUMED (derived with Ihsan, stated as assumption), ASPIRATIONAL/PLANNED (not yet real). The zann-zero invariant forbids collapsing these categories. A 'DECLARED' label on an unverified claim is itself a zann violation.",
    truth_label: "DECLARED",
    see_also: ["zann-zero", "ihsan", "receipt"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "refusal-as-product",
    title: "Refusal as Product",
    short: "A principled refusal is a delivery — the system showing its spine, not a failure.",
    long: "Refusal-as-product is the BIZRA operational doctrine that a well-reasoned refusal is as valuable as a completed action — often more. When DEMA refuses to promote a skill without evidence, refuses to mint without typed consent, or refuses to execute a boundary-crossing action, it is producing proof that the constitutional spine is load-bearing. The refusal taxonomy in skill-growth-governor.js lists 8 canonical refusal paths. Each refusal mints a receipt.",
    truth_label: "DECLARED",
    see_also: ["ihsan", "adr-005", "boundary"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  },
  {
    concept: "founding-documents",
    title: "Founding Documents",
    short: "The three Bitcoin-anchored constitutional texts: الرسالة · البذرة · Third Fact.",
    long: "The founding documents are the three texts that constitute BIZRA's constitutional DNA: الرسالة (The Message), البذرة (The Seed), and the Third Fact manifesto. All three are anchored to the Bitcoin blockchain at blocks 948027, 948028, and 948029 respectively. They form the priority anchor for all doctrine: Quran → Hadith → البذرة → الرسالة → Spine → Invariants → Specs → Code.",
    truth_label: "DECLARED",
    see_also: ["al-risala", "al-budhra", "bitcoin-anchor"],
    doc_anchor: "docs/public/third-fact-v0.1.md"
  },
  {
    concept: "bitcoin-anchor",
    title: "Bitcoin Anchor",
    short: "The founding documents are inscribed into the Bitcoin blockchain at blocks 948027–948029.",
    long: "Bitcoin anchoring uses the immutability of the Bitcoin blockchain to timestamp the existence and content of the founding documents. Blocks 948027 (البذرة), 948028 (Third Fact), and 948029 (الرسالة) carry the hash of each founding document. This makes the founding moment cryptographically verifiable and irreversible: no future actor can claim the documents were authored after the fact.",
    truth_label: "DECLARED",
    see_also: ["founding-documents", "receipt", "third-fact"],
    doc_anchor: "docs/public/third-fact-v0.1.md"
  },
  {
    concept: "boundary",
    title: "Boundary · Canonical 16-Key Boundary",
    short: "The 16 boolean flags that every Dema preview must pin to false — the constitutional membrane in code.",
    long: "The canonical boundary is a frozen object with 16 boolean keys, all false, that every Dema preview builder must attach to its output. The 16 keys are: filesystem_write_performed, network_used, runtime_execution_performed, model_loaded, model_invocation_performed, prompt_executed, external_call_performed, raw_corpus_scan_performed, raw_data_included, tool_executed, chain_advance_performed, receipt_mint_performed, federation_invoked, node_connection_performed, public_network_used, consent_collected. Any truthy value is a boundary violation.",
    truth_label: "DECLARED",
    see_also: ["receipt", "adr-005", "refusal-as-product"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md"
  }
];

// Build a Map keyed by concept (already lowercase in RAW_ENTRIES).
// Each entry is frozen so callers cannot mutate canonical definitions.
const CANON_GLOSSARY = Object.freeze(
  new Map(
    RAW_ENTRIES.map((entry) => [
      entry.concept,
      Object.freeze({ schema: SCHEMA, ...entry })
    ])
  )
);

// Levenshtein distance for close-match suggestions — no external dep.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Look up a concept by name (case-insensitive, hyphen-normalised).
 * If concept is null/empty, returns listing mode object.
 * If concept is not found, returns { matched: false, suggestions: string[] }.
 *
 * @param {string|null|undefined} concept
 * @returns {object}
 */
function buildExplainPreview(concept) {
  // Listing mode
  if (concept === null || concept === undefined || String(concept).trim() === "") {
    return {
      mode: "listing",
      schema: SCHEMA,
      count: CANON_GLOSSARY.size,
      concepts: [...CANON_GLOSSARY.values()].map((e) => ({
        concept: e.concept,
        title: e.title,
        short: e.short
      }))
    };
  }

  // Reject inputs that are clearly unsafe (prototype pollution etc.)
  const raw = String(concept).trim();
  if (raw.length > 200) {
    return { matched: false, suggestions: [] };
  }
  const key = raw.toLowerCase();

  // Exact match
  if (CANON_GLOSSARY.has(key)) {
    return CANON_GLOSSARY.get(key);
  }

  // Close match via Levenshtein
  const threshold = key.length < 6 ? 2 : 3;
  const suggestions = [];
  for (const k of CANON_GLOSSARY.keys()) {
    const dist = levenshtein(key, k);
    if (dist <= threshold) {
      suggestions.push({ concept: k, distance: dist });
    }
  }
  suggestions.sort((a, b) => a.distance - b.distance);

  return {
    matched: false,
    queried: raw,
    suggestions: suggestions.slice(0, 3).map((s) => s.concept)
  };
}

/**
 * Format a glossary entry (or listing/not-found result) as human-readable text.
 *
 * @param {object} entry - result from buildExplainPreview
 * @returns {string}
 */
function formatExplainPreview(entry) {
  if (!entry || typeof entry !== "object") {
    return "Error: invalid glossary entry.";
  }

  // Listing mode
  if (entry.mode === "listing") {
    const lines = [`Available concepts (${entry.count}):`];
    const items = entry.concepts.map((c) => c.title);
    // 4 per row
    for (let i = 0; i < items.length; i += 4) {
      lines.push("  " + items.slice(i, i + 4).map((t) => t.padEnd(20)).join("  ").trimEnd());
    }
    lines.push("");
    lines.push("Type `dema explain <name>` for any of these.");
    return lines.join("\n");
  }

  // Not found
  if (entry.matched === false) {
    const lines = [`I don't have a definition for \`${entry.queried}\` yet.`, ""];
    lines.push("You can browse what I do know:");
    lines.push("  $ dema explain                   — list all explained concepts");
    lines.push("  $ dema help                      — full command list");
    if (entry.suggestions && entry.suggestions.length > 0) {
      lines.push("");
      lines.push("Did you mean:");
      for (const s of entry.suggestions) {
        const e = CANON_GLOSSARY.get(s);
        if (e) lines.push(`  $ dema explain ${s.padEnd(20)} — ${e.short}`);
      }
    }
    return lines.join("\n");
  }

  // Full entry
  const lines = [];
  lines.push(entry.title);
  lines.push("  " + entry.short);
  lines.push("  " + entry.long);
  lines.push("");
  lines.push(`  Truth label: ${entry.truth_label} (${truthLabelNote(entry.truth_label)}).`);
  if (entry.see_also && entry.see_also.length > 0) {
    lines.push("");
    lines.push("  See also:");
    for (const ref of entry.see_also) {
      const related = CANON_GLOSSARY.get(ref);
      const hint = related ? related.short : ref;
      lines.push(`    - dema explain ${ref.padEnd(20)} — ${hint}`);
    }
    if (entry.doc_anchor) {
      lines.push(`    - ${entry.doc_anchor}`);
    }
  }
  return lines.join("\n");
}

function truthLabelNote(label) {
  switch (label) {
    case "DECLARED": return "constitutional anchor from the founding documents";
    case "MEASURED": return "empirically verified — tests pass, numbers measured";
    case "ASSUMED": return "derived with Ihsan, stated explicitly as assumption";
    default: return "see truth-label discipline";
  }
}

export { CANON_GLOSSARY, buildExplainPreview, formatExplainPreview };
