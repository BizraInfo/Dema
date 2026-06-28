// NODE0-TASK-DECOMPOSITION-ENGINE-1A (TADE)
// Authoritative Intent Packet Compiler for Linguistic-Ontological Atomization.
//
// PREVIEW_ONLY · NOT ML · NOT runtime. This is a pure, deterministic kernel:
// no fs, no network, no clock, no randomness, no model invocation. It compiles a
// human/LLM input string into ontology-bound intent atoms and decides, per atom,
// whether the atom is route-eligible.
//
// Architectural stance (authoritative-server pattern): human/LLM input is an
// UNTRUSTED client intent packet. The kernel is the server. An atom becomes
// SERVER_VALIDATED_PREVIEW_ONLY only when EVERY field is POSITIVELY resolved
// against the registry — action, object/ontology, capability, and risk. The
// absence of a block is NOT validation. An atom that passes the linguistic floor
// (a recognizable verb) but has no positive registry binding is
// BLOCKED_UNCLASSIFIED and fails closed.
//
// This kernel performs no governed action. It produces a preview verdict only;
// route_eligible means "may proceed to the consent/proof stage", never "executed".

import { createHash } from "node:crypto";

export const NODE0_TADE_SCHEMA =
  "bizra.dema.node0_task_decomposition_engine.v0.1";
export const NODE0_TADE_TRUTH_LABEL = "NODE0_TADE_PREVIEW_ONLY";
export const NODE0_TADE_STAGE = "TASK_DECOMPOSITION_PREVIEW";

export const ATOM_AUTHORITY_STATUSES = Object.freeze([
  "SERVER_VALIDATED_PREVIEW_ONLY",
  "REJECTED_BY_TADE_GATE",
]);

// The only block reasons. Each corresponds to a POSITIVE resolution that did not
// occur — never to "a marker tripped".
export const ATOM_BLOCK_REASONS = Object.freeze([
  "action_unclassified",
  "ontology_unresolved",
  "capability_unresolved",
  "risk_unclassified",
]);

// Default registry / truth tables. Deterministic and injectable so callers (and
// tests) can substitute a narrower or wider registry. Frozen to keep the kernel
// pure: the registry is data, not behaviour.
export const DEFAULT_INTENT_REGISTRY = Object.freeze({
  // verb token → canonical action id
  actions: Object.freeze({
    verify: "VERIFY",
    check: "VERIFY",
    validate: "VERIFY",
    read: "READ",
    list: "READ",
    show: "READ",
    view: "READ",
    inspect: "READ",
    create: "CREATE",
    make: "CREATE",
    draft: "CREATE",
    sign: "SIGN",
    merge: "MERGE",
  }),
  // known ontology entities (objects the kernel can bind). Substring-matched
  // case-insensitively against a clause.
  ontology: Object.freeze([
    "origin/main",
    "main",
    "trunk",
    "branch",
    "working tree",
    "repo state",
    "repository state",
    "receipt",
    "receipts",
    "mission",
  ]),
  // action id → capability required to perform it
  capabilities: Object.freeze({
    VERIFY: "READ_LOCAL_STATE",
    READ: "READ_LOCAL_STATE",
    CREATE: "WRITE_LOCAL_STATE",
    SIGN: "AUTHORSHIP_SIGN",
    MERGE: "GIT_INTEGRATION",
  }),
  // action id → risk class
  risks: Object.freeze({
    VERIFY: "LOW",
    READ: "LOW",
    CREATE: "MEDIUM",
    SIGN: "HIGH",
    MERGE: "HIGH",
  }),
});

// ── deterministic content addressing (mirrors sibling kernels) ──────────────
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const parts = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const serialized = stableStringify(value[key]);
        return serialized === undefined
          ? []
          : [`${JSON.stringify(key)}:${serialized}`];
      });
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentHash(payload) {
  return `sha256:${createHash("sha256").update(stableStringify(payload), "utf8").digest("hex")}`;
}

// ── clause segmentation ─────────────────────────────────────────────────────
// Split the input into intent clauses on sentence/clause delimiters. Deterministic.
function segmentClauses(input) {
  if (typeof input !== "string") return [];
  return input
    .split(/[.;\n]|(?:\s+and\s+)/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

function tokenize(clause) {
  return clause
    .toLowerCase()
    .split(/[^a-z0-9/_-]+/i)
    .filter(Boolean);
}

function resolveAction(clause, registry) {
  for (const token of tokenize(clause)) {
    if (Object.prototype.hasOwnProperty.call(registry.actions, token)) {
      return registry.actions[token];
    }
  }
  return null; // unresolved → action_unclassified
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveOntology(clause, registry) {
  const haystack = clause.toLowerCase();
  // longest-match-first so "origin/main" wins over "main"
  const sorted = [...registry.ontology].sort((a, b) => b.length - a.length);
  for (const entity of sorted) {
    // Token-bounded match (NOT naive substring): the entity must be flanked by
    // non-alphanumerics or string ends, so "main" never binds inside "domain".
    const pattern = new RegExp(
      `(?:^|[^a-z0-9])${escapeRegExp(entity.toLowerCase())}(?:[^a-z0-9]|$)`,
    );
    if (pattern.test(haystack)) return entity;
  }
  return null; // unresolved → ontology_unresolved
}

// ── the authority gate ──────────────────────────────────────────────────────
// An atom is SERVER_VALIDATED only when every required field is positively
// resolved. blocked_by is built from POSITIVE checks, so the default is rejected.
function compileAtom(clause, index, registry) {
  const action = resolveAction(clause, registry);
  const object = resolveOntology(clause, registry);
  const capabilityRequired =
    action && Object.prototype.hasOwnProperty.call(registry.capabilities, action)
      ? registry.capabilities[action]
      : null;
  const resolvedRisk =
    action && Object.prototype.hasOwnProperty.call(registry.risks, action)
      ? registry.risks[action]
      : null;

  const blocked_by = [];
  if (action === null) blocked_by.push("action_unclassified");
  if (object === null) blocked_by.push("ontology_unresolved");
  if (capabilityRequired === null) blocked_by.push("capability_unresolved");
  if (resolvedRisk === null) blocked_by.push("risk_unclassified");

  const validated = blocked_by.length === 0;

  return Object.freeze({
    atom_id: `ATOM-${String(index + 1).padStart(4, "0")}`,
    source_span: Object.freeze({ text: clause, index }),
    intent_packet: Object.freeze({
      action: action ?? "UNKNOWN",
      object: object ?? null,
      capability_required: capabilityRequired,
    }),
    risk_class: validated ? resolvedRisk : "BLOCKED_UNCLASSIFIED",
    authority_status: validated
      ? "SERVER_VALIDATED_PREVIEW_ONLY"
      : "REJECTED_BY_TADE_GATE",
    // route_eligible derives ONLY from positive validation — never default-true.
    route_eligible: validated,
    // Fail-closed: a preview never auto-consents. Consent is always required
    // before any validated atom could route downstream.
    consent_required: true,
    blocked_by: Object.freeze(blocked_by),
  });
}

/**
 * Compile a human/LLM input string into an authoritative intent packet of
 * fail-closed atoms. Pure and deterministic.
 *
 * @param {{ input: string, registry?: object }} args
 * @returns {object} frozen intent packet (content-addressed)
 */
export function compileIntentPacket({ input, registry = DEFAULT_INTENT_REGISTRY } = {}) {
  const safeRegistry = {
    actions: registry?.actions ?? {},
    ontology: Array.isArray(registry?.ontology) ? registry.ontology : [],
    capabilities: registry?.capabilities ?? {},
    risks: registry?.risks ?? {},
  };

  const clauses = segmentClauses(input);
  const compiled_atoms = clauses.map((clause, index) =>
    compileAtom(clause, index, safeRegistry),
  );

  const validated_count = compiled_atoms.filter((a) => a.route_eligible).length;
  const blocked_count = compiled_atoms.length - validated_count;
  const route_eligible =
    compiled_atoms.length > 0 && compiled_atoms.every((a) => a.route_eligible);

  const aggregateBlocks = [
    ...new Set(compiled_atoms.flatMap((a) => a.blocked_by)),
  ].sort();

  const body = {
    schema: NODE0_TADE_SCHEMA,
    truth_label: NODE0_TADE_TRUTH_LABEL,
    stage: NODE0_TADE_STAGE,
    packet_type: "MISSION_INTENT_PREVIEW",
    source: "human_input",
    authority: "untrusted_until_compiled",
    input_span: { text: typeof input === "string" ? input : "", length: clauses.length },
    compiled_atoms,
    atom_count: compiled_atoms.length,
    validated_count,
    blocked_count,
    route_eligible,
    blocked_by: aggregateBlocks,
    boundary: buildBoundary(),
  };

  return Object.freeze({ ...body, content_hash: contentHash(body) });
}

// Canonical 16-key all-false preview boundary — this kernel performs no effect.
function buildBoundary() {
  return Object.freeze({
    filesystem_write_performed: false,
    network_used: false,
    runtime_execution_performed: false,
    model_loaded: false,
    model_invocation_performed: false,
    prompt_executed: false,
    external_call_performed: false,
    raw_corpus_scan_performed: false,
    raw_data_included: false,
    tool_executed: false,
    chain_advance_performed: false,
    receipt_mint_performed: false,
    federation_invoked: false,
    node_connection_performed: false,
    public_network_used: false,
    consent_collected: false,
  });
}

/**
 * Re-derive the packet from its own input span and confirm the provided packet
 * matches. Body-bound, not subset: a forged atom (e.g. a rejected atom laundered
 * into SERVER_VALIDATED) is caught because re-derivation from the input yields
 * the true verdict, independent of any forged hash.
 *
 * @param {object} packet
 * @param {{ registry?: object }} [opts]
 * @returns {{ ok: boolean, reason?: string, expected_hash?: string }}
 */
export function verifyIntentPacket(packet, { registry = DEFAULT_INTENT_REGISTRY } = {}) {
  if (!packet || typeof packet !== "object") {
    return { ok: false, reason: "packet_not_object" };
  }
  if (!packet.input_span || typeof packet.input_span.text !== "string") {
    return { ok: false, reason: "missing_input_span" };
  }
  const recomputed = compileIntentPacket({ input: packet.input_span.text, registry });

  if (recomputed.content_hash !== packet.content_hash) {
    return {
      ok: false,
      reason: "content_hash_mismatch",
      expected_hash: recomputed.content_hash,
    };
  }
  // Body-bound: the security-relevant verdict must match the re-derivation, not
  // merely the hash (defends against a forged-body-with-recomputed-hash).
  if (
    stableStringify(recomputed.compiled_atoms) !==
      stableStringify(packet.compiled_atoms) ||
    recomputed.route_eligible !== packet.route_eligible
  ) {
    return { ok: false, reason: "atom_verdict_mismatch" };
  }
  return { ok: true, expected_hash: recomputed.content_hash };
}
