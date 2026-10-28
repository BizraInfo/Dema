// NODE0-WISDOM-LEDGER-1A — pure wisdom-atom extraction kernel.
//
// PREVIEW_ONLY · NOT ML · NOT runtime. Deterministic regex/structure mining of a
// caller-supplied, already-parsed conversation. Zero I/O, no clock, no model.
// Atoms are bounded, secret-redacted snippets with provenance. Chat claims stay
// UNKNOWN unless they anchor to a path/slice supplied in repoInventory
// (then DERIVED, never VERIFIED).

import { sha256, stableStringify } from "../../consent/src/consent-common.js";

export const WISDOM_ATOM_SCHEMA = "bizra.dema.wisdom_atom.v0.1";
export const WISDOM_LEDGER_SCHEMA = "bizra.dema.wisdom_ledger.v0.1";
export const ATOM_KINDS = Object.freeze([
  "INVARIANT_RULE",
  "ARCHITECTURE_DECISION",
  "BRANCH_PUSHBACK",
  "ARTIFACT_ANCHOR",
  "LOST_GOLDEN_GEM",
]);

const MAX_SNIPPET = 300;
const MAX_ATOMS_PER_KIND = 60;
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\b(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*["']?[^\s"',;]{6,}/gi,
];

export function redactSecrets(text) {
  let out = String(text ?? "");
  for (const re of SECRET_PATTERNS) out = out.replace(re, "[REDACTED_SECRET]");
  return out;
}

const PATH_RE = /\b(?:packages|apps|scripts|docs|tests|crates|src)\/[\w./-]*\w\.(?:js|mjs|cjs|ts|rs|py|md|json|sh|toml|yaml|yml)\b/g;
const SLICE_RE = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d+[A-Z]\b/g;
const NOISE_LINE_RE = /^\s*(?:[•└├│]|\?\?|\$ |Ran |[0-9a-f]{40,})|sha256sum|\bnode_modules\b|\.next\//;
const NOISE_PATH_RE = /node_modules|\.next\/|\/dist\/|^tmp\//;
const CORRECTION_RE = /^\s*(?:no\b|nope|wrong|wait\b|stop\b|don'?t\b|do not\b|instead\b|incorrect|that'?s not|not (?:what|fake|like)\b|لا\b|خطأ|انتظر|توقف)|\b(?:you (?:missed|forgot|ignored)|must not|not fake|fail-closed)\b/i;
const RULE_RE = /\b(?:MUST(?: NOT)?|NEVER|DO NOT)\b|fail-closed|default-deny|no fake green|exact-string consent|\bIhsan\b/i;
const DECISION_RE = /\bADR[- ]?\d+\b|\bdecision:|\bwe (?:will|decided|chose)\b|\b(?:FATE|PAT-?7|SAT-?5|URP)\b/i;

const isoFromEpoch = (s) =>
  typeof s === "number" && Number.isFinite(s) && s > 0 ? new Date(Math.round(s * 1000)).toISOString() : null;

function messageText(message) {
  const parts = message?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.filter((p) => typeof p === "string").join("\n");
}

// Active canonical chain (current_node → root) plus rejected sibling branches.
export function walkConversationMapping(mapping, currentNode) {
  const m = mapping && typeof mapping === "object" ? mapping : {};
  const chain = [];
  const seen = new Set();
  let id = currentNode && m[currentNode] ? currentNode : null;
  while (id && m[id] && !seen.has(id)) {
    seen.add(id);
    chain.push(id);
    id = m[id].parent;
  }
  chain.reverse();
  const active = new Set(chain);
  const branch_pushbacks = [];
  for (const nodeId of chain) {
    const node = m[nodeId];
    const kids = Array.isArray(node.children) ? node.children : [];
    if (kids.length < 2) continue;
    const kept = kids.find((k) => active.has(k)) ?? null;
    const rejected = kids.filter((k) => k !== kept && m[k]);
    if (rejected.length) branch_pushbacks.push({ parent_id: nodeId, kept_child: kept, rejected_children: rejected });
  }
  return { chain, branch_pushbacks };
}

function snippetOf(text) {
  return redactSecrets(text).replace(/\s+/g, " ").trim().slice(0, MAX_SNIPPET);
}

function finalize(a) {
  const body = { schema: WISDOM_ATOM_SCHEMA, ...a };
  return { ...body, atom_sha256: sha256(stableStringify(body)) };
}

function diskStatus(paths, slices, inv) {
  if (!paths.length && !slices.length) return null;
  const P = new Set(inv?.paths ?? []);
  const S = new Set(inv?.slices ?? []);
  const missing = paths.some((p) => !P.has(p)) || slices.some((s) => !S.has(s));
  return missing ? "UNBUILT_GEM_CANDIDATE" : "ANCHORED_ON_DISK";
}

export function extractWisdomAtoms(conversation, repoInventory = {}) {
  const mapping = conversation?.mapping ?? {};
  const { chain, branch_pushbacks } = walkConversationMapping(mapping, conversation?.current_node);
  const cid = conversation?.conversation_id ?? null;
  const atoms = [];
  const counts = {};
  const seen = new Set();
  const push = (a) => {
    const key = `${a.atom_kind}:${a.snippet}`;
    if (seen.has(key) || (counts[a.atom_kind] ?? 0) >= MAX_ATOMS_PER_KIND) return;
    seen.add(key);
    counts[a.atom_kind] = (counts[a.atom_kind] ?? 0) + 1;
    atoms.push(finalize(a));
  };

  for (const mid of chain) {
    const msg = mapping[mid]?.message;
    const role = msg?.author?.role;
    if (!msg || (role !== "user" && role !== "assistant")) continue;
    const created_at = isoFromEpoch(msg.create_time);
    for (const line of messageText(msg).split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length < 12 || NOISE_LINE_RE.test(trimmed)) continue;
      const paths = [...new Set(trimmed.match(PATH_RE) ?? [])].filter((p) => !NOISE_PATH_RE.test(p));
      const slices = [...new Set(trimmed.match(SLICE_RE) ?? [])];
      const base = { conversation_id: cid, message_id: mid, role, created_at, snippet: snippetOf(trimmed) };
      const ds = diskStatus(paths, slices, repoInventory);
      if (ds) {
        const anchored = ds === "ANCHORED_ON_DISK";
        push({
          ...base,
          atom_kind: anchored ? "ARTIFACT_ANCHOR" : "LOST_GOLDEN_GEM",
          referenced_paths: paths,
          referenced_slices: slices,
          disk_status: ds,
          claim_label: anchored ? "DERIVED" : "UNKNOWN",
        });
      } else if (RULE_RE.test(trimmed)) {
        push({ ...base, atom_kind: "INVARIANT_RULE", referenced_paths: [], referenced_slices: [], disk_status: "NOT_CHECKED", claim_label: "UNKNOWN" });
      } else if (DECISION_RE.test(trimmed)) {
        push({ ...base, atom_kind: "ARCHITECTURE_DECISION", referenced_paths: [], referenced_slices: [], disk_status: "NOT_CHECKED", claim_label: "UNKNOWN" });
      }
    }
  }

  // (a) Assistant regenerations: a rejected assistant sibling paired with the accepted one.
  for (const bp of branch_pushbacks) {
    const keptMsg = bp.kept_child ? mapping[bp.kept_child]?.message : null;
    if (keptMsg?.author?.role !== "assistant") continue;
    for (const rid of bp.rejected_children) {
      const rm = mapping[rid]?.message;
      if (rm?.author?.role !== "assistant") continue;
      const rejected = snippetOf(messageText(rm));
      const accepted = snippetOf(messageText(keptMsg));
      if (!rejected || rejected === accepted) continue;
      push({
        conversation_id: cid,
        message_id: rid,
        role: "assistant",
        created_at: isoFromEpoch(rm.create_time ?? keptMsg.create_time),
        atom_kind: "BRANCH_PUSHBACK",
        pushback_kind: "REGENERATION",
        snippet: rejected,
        counterpart_snippet: accepted,
        kept_message_id: bp.kept_child,
        referenced_paths: [],
        referenced_slices: [],
        disk_status: "NOT_CHECKED",
        claim_label: "UNKNOWN",
      });
    }
  }

  // (b) Explicit operator corrections: a canonical user turn that rejects the assistant turn before it.
  for (let i = 1; i < chain.length; i += 1) {
    const prev = mapping[chain[i - 1]]?.message;
    const cur = mapping[chain[i]]?.message;
    if (prev?.author?.role !== "assistant" || cur?.author?.role !== "user") continue;
    const text = messageText(cur).trim();
    if (text.length < 8 || text.length > 1200 || !CORRECTION_RE.test(text)) continue;
    const draft = snippetOf(messageText(prev));
    if (!draft) continue;
    push({
      conversation_id: cid,
      message_id: chain[i],
      role: "user",
      created_at: isoFromEpoch(cur.create_time),
      atom_kind: "BRANCH_PUSHBACK",
      pushback_kind: "OPERATOR_CORRECTION",
      snippet: snippetOf(text),
      counterpart_snippet: draft,
      kept_message_id: null,
      referenced_paths: [],
      referenced_slices: [],
      disk_status: "NOT_CHECKED",
      claim_label: "UNKNOWN",
    });
  }
  return atoms;
}

// Chronological order; an older atom sharing a path/slice key with a newer one
// is flagged superseded (never silently merged or dropped).
export function supersedeAtoms(atoms) {
  const sorted = [...atoms].sort(
    (a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) || a.atom_sha256.localeCompare(b.atom_sha256),
  );
  const latest = new Map();
  for (const a of sorted) {
    const k = a.referenced_slices?.[0] ?? a.referenced_paths?.[0];
    if (k) latest.set(k, a.atom_sha256);
  }
  return sorted.map((a) => {
    const k = a.referenced_slices?.[0] ?? a.referenced_paths?.[0];
    const newest = k ? latest.get(k) : null;
    return newest && newest !== a.atom_sha256 ? { ...a, superseded_by: newest } : a;
  });
}

export function buildWisdomLedger({ source, atoms }) {
  const ordered = supersedeAtoms(atoms);
  const by_kind = Object.fromEntries(ATOM_KINDS.map((k) => [k, ordered.filter((a) => a.atom_kind === k).length]));
  const body = {
    schema: WISDOM_LEDGER_SCHEMA,
    truth_label: "WISDOM_LEDGER_LOCAL_PREVIEW",
    source: source ?? null,
    atom_count: ordered.length,
    by_kind,
    atoms: ordered,
    boundary: {
      content_read_performed: true,
      raw_text_persisted: false,
      model_invocation_performed: false,
      external_provider_called: false,
      mutation_performed: false,
    },
  };
  return Object.freeze({ ...body, ledger_sha256: sha256(stableStringify(body)) });
}

export function verifyWisdomLedger(ledger) {
  const reasons = [];
  if (!ledger || ledger.schema !== WISDOM_LEDGER_SCHEMA) return { ok: false, reasons: ["schema_mismatch"] };
  const b = ledger.boundary ?? {};
  for (const k of ["model_invocation_performed", "external_provider_called", "mutation_performed", "raw_text_persisted"]) {
    if (b[k] !== false) reasons.push(`boundary_not_false:${k}`);
  }
  for (const a of ledger.atoms ?? []) {
    const { atom_sha256, superseded_by, ...rest } = a;
    if (atom_sha256 !== sha256(stableStringify(rest))) reasons.push(`atom_hash_mismatch:${String(atom_sha256).slice(0, 8)}`);
    if (a.snippet?.length > MAX_SNIPPET || a.counterpart_snippet?.length > MAX_SNIPPET) reasons.push("snippet_too_long");
    if (/\bsk-[A-Za-z0-9_-]{16,}|\bghp_[A-Za-z0-9]{20,}/.test(a.counterpart_snippet ?? "")) reasons.push("unredacted_secret");
    if (/\bsk-[A-Za-z0-9_-]{16,}|\bghp_[A-Za-z0-9]{20,}/.test(a.snippet ?? "")) reasons.push("unredacted_secret");
    if (a.claim_label === "VERIFIED") reasons.push("chat_claim_cannot_be_verified");
  }
  const { ledger_sha256, ...body } = ledger;
  if (ledger_sha256 !== sha256(stableStringify(body))) reasons.push("ledger_hash_mismatch");
  return { ok: reasons.length === 0, reasons };
}
