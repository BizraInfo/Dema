#!/usr/bin/env node
// AUTHORITATIVE-POINTER-PARITY-1A — review gate.
//
// THE CONTRACT THIS MEASURES. "Which record is authoritative" is the most
// load-bearing contract in this estate, and it is answered in four independent
// places that do not carry the same guarantees:
//
//   season HEAD         head_hash · receipt_hash · state_hash · sequence fence
//   active-key pointer  pointer_hash · transition_id · exclusive identity lease
//   genesis root-trust  body_sha256 · out-of-band witness commitment
//   ACTIVE_MISSION      — measured: none —
//
// The fourth is the one the SessionStart hook reads FIRST and instructs every
// agent to prefer over every other source ("DRIFT ... the pointer wins"). So the
// estate's most authoritative pointer is its least protected one, and until this
// gate existed nothing compared the four against each other. That is drift at
// its cause, invisible until something downstream contradicts itself.
//
// WHY PASS DOES NOT MEAN "ALL SATISFIED". Directly following the closure gate's
// law — "PASS means the ledger is sound and honest, NOT that Node0 is closed" —
// this gate passes when the parity ledger is COMPLETE and RE-DERIVABLE. It does
// not pass judgement on whether the operator should adopt a stronger pointer.
// A gate that hard-failed on a long-standing, operator-owned condition would be
// switched off inside a week, and a switched-off gate protects nothing.
//
// WHAT IT WILL NOT DO. It never writes, never repairs, never signs, and never
// touches the ACTIVE_MISSION pointer. That file lives outside this tree and is
// the operator's; adopting an integrity contract for it is a sovereign act, not
// a gate's side effect. This gate only makes the condition legible.
//
// Reads source text and, if present, one JSON instance. No socket, no model.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const POINTER_CONTRACT_CLAUSES = Object.freeze([
  "content_identity", // a hash over what the pointer asserts
  "ordering",         // sequence / transition id / establishment time
  "named_owner",      // the ONE module permitted to publish it
  "freshness",        // an age a reader can evaluate rather than assume
]);

/**
 * The registry. `source` engines declare their contract in code, so the gate
 * asserts the code still declares it — that is what catches drift at the cause
 * rather than at the consequence. The `instance` engine has no writer in this
 * repository, so it is judged on the artefact itself.
 */
export const POINTER_ENGINES = Object.freeze([
  Object.freeze({
    id: "season_head",
    kind: "source",
    path: "packages/core/src/node0-minimum-season-save-resume.js",
    owner: "packages/receipts/src/season-state-store.js",
    clause_markers: Object.freeze([
      Object.freeze({ clause: "content_identity", markers: Object.freeze(["head_hash", "receipt_hash", "state_hash"]) }),
      Object.freeze({ clause: "ordering", markers: Object.freeze(["state_sequence"]) }),
      Object.freeze({ clause: "named_owner", markers: Object.freeze(["season-state-store.js"]) }),
      Object.freeze({ clause: "freshness", markers: Object.freeze(["saved_at"]) }),
    ]),
  }),
  Object.freeze({
    id: "active_key_pointer",
    kind: "source",
    path: "packages/receipts/src/authorship-key-store.js",
    owner: "packages/receipts/src/authorship-key-store.js",
    clause_markers: Object.freeze([
      Object.freeze({ clause: "content_identity", markers: Object.freeze(["pointer_hash"]) }),
      Object.freeze({ clause: "ordering", markers: Object.freeze(["transition_id"]) }),
      Object.freeze({ clause: "named_owner", markers: Object.freeze(["acquireIdentityLease"]) }),
      Object.freeze({ clause: "freshness", markers: Object.freeze(["activated_at"]) }),
    ]),
  }),
  Object.freeze({
    id: "genesis_root_trust",
    kind: "source",
    path: "packages/genesis/src/node-root-trust.js",
    owner: "packages/genesis/src/node-root-trust.js",
    clause_markers: Object.freeze([
      Object.freeze({ clause: "content_identity", markers: Object.freeze(["body_sha256"]) }),
      Object.freeze({ clause: "ordering", markers: Object.freeze(["established_at"]) }),
      // A DATA STRING, never the capability symbol. GRC-08 is a containment
      // proof that the provisioning function is unreachable from the mission
      // runtime, and it detects references — so naming that symbol here would
      // make this gate itself a caller. The watcher must not become the thing
      // it watches. The owned relpath identifies the module just as well.
      Object.freeze({ clause: "named_owner", markers: Object.freeze(["genesis/root-trust-v1.json"]) }),
      Object.freeze({ clause: "freshness", markers: Object.freeze(["established_at"]) }),
    ]),
  }),
  Object.freeze({
    id: "active_mission_pointer",
    kind: "instance",
    // Outside this repository on purpose: it has no writer here. Absent → UNKNOWN.
    path: "/data/bizra/ACTIVE_MISSION.json",
    owner: null,
    clause_fields: Object.freeze([
      Object.freeze({ clause: "content_identity", fields: Object.freeze(["state_hash", "head_hash", "receipt_hash", "signature", "integrity", "hash"]) }),
      Object.freeze({ clause: "ordering", fields: Object.freeze(["state_sequence", "sequence", "transition_id"]) }),
      Object.freeze({ clause: "freshness", fields: Object.freeze(["updated_at_utc", "updated_at"]) }),
    ]),
  }),
]);

const has = (hay, needle) => typeof hay === "string" && hay.includes(needle);

/** Default per-clause verdict. Injectable so a negative control can replace it. */
function defaultClauseVerdict(engine, clause, evidence) {
  if (!evidence || evidence.present !== true) return "UNKNOWN";

  if (engine.kind === "source") {
    const spec = engine.clause_markers.find((m) => m.clause === clause);
    if (!spec) return "UNKNOWN";
    if (typeof evidence.source !== "string" || evidence.source.length === 0) return "UNKNOWN";
    return spec.markers.every((m) => has(evidence.source, m)) ? "SATISFIED" : "VIOLATED";
  }

  // instance
  const inst = evidence.instance;
  if (!inst || typeof inst !== "object") return "UNKNOWN";
  const spec = engine.clause_fields.find((m) => m.clause === clause);
  // A clause the artefact was never expected to carry is UNKNOWN, not VIOLATED —
  // `named_owner` cannot be judged from an artefact with no writer in this tree.
  if (!spec) return "UNKNOWN";
  return spec.fields.some((f) => Object.hasOwn(inst, f)) ? "SATISFIED" : "VIOLATED";
}

/**
 * Per-clause verdicts for one engine. Never one badge for the whole engine:
 * subject state and observation confidence are different questions, and an
 * engine can carry a real content hash while carrying no ordering at all.
 */
export function evaluatePointerEngine(engine, evidence, { clauseVerdict } = {}) {
  const verdict = typeof clauseVerdict === "function"
    ? (c) => clauseVerdict(engine, c, evidence)
    : (c) => defaultClauseVerdict(engine, c, evidence);

  const clauses = POINTER_CONTRACT_CLAUSES.map((clause) =>
    Object.freeze({ clause, status: verdict(clause) }));

  return Object.freeze({
    engine_id: engine.id,
    kind: engine.kind,
    path: engine.path,
    owner: engine.owner,
    clauses: Object.freeze(clauses),
    // Asserted on every row so the report cannot later be read as a repair log.
    repaired: false,
    mutated: false,
  });
}

const countBy = (engines, status) =>
  engines.reduce((n, e) => n + e.clauses.filter((c) => c.status === status).length, 0);

export function buildPointerParityReport(evidenceById, opts = {}) {
  const engines = POINTER_ENGINES.map((e) =>
    evaluatePointerEngine(e, evidenceById?.[e.id], opts));
  return Object.freeze({
    schema: "bizra.dema.authoritative_pointer_parity.v0.1",
    truth_label: "MEASURED",
    engines: Object.freeze(engines),
    satisfied: countBy(engines, "SATISFIED"),
    violated: countBy(engines, "VIOLATED"),
    unknown: countBy(engines, "UNKNOWN"),
    total_clauses: engines.length * POINTER_CONTRACT_CLAUSES.length,
    boundary: Object.freeze({
      write_performed: false, repair_performed: false,
      network_used: false, model_invoked: false,
    }),
  });
}

/**
 * Re-derive the report's counts from its own rows.
 *
 * The gate must not be the only witness to its own summary: an edited count that
 * hid a violation would otherwise read exactly like a clean ledger.
 */
export function verifyPointerParityReport(report) {
  const blocked = [];
  if (!report || !Array.isArray(report.engines)) return Object.freeze({ ok: false, blocked_by: ["report_malformed"] });
  if (report.engines.length !== POINTER_ENGINES.length) blocked.push("engine_count_mismatch");
  for (const status of ["satisfied", "violated", "unknown"]) {
    const recomputed = countBy(report.engines, status.toUpperCase());
    if (report[status] !== recomputed) blocked.push(`${status}_count_mismatch`);
  }
  const cells = report.engines.reduce((n, e) => n + e.clauses.length, 0);
  if (report.total_clauses !== cells) blocked.push("total_clauses_mismatch");
  if (report.engines.some((e) => e.repaired || e.mutated)) blocked.push("repair_claimed_by_read_only_gate");
  return Object.freeze({ ok: blocked.length === 0, blocked_by: Object.freeze(blocked) });
}

/** Read-only evidence. Absent file → `present:false` → UNKNOWN, never a pass. */
export function gatherPointerEvidence(engines = POINTER_ENGINES) {
  const out = {};
  for (const e of engines) {
    const abs = e.kind === "source" ? join(REPO_ROOT, e.path) : e.path;
    if (!existsSync(abs)) { out[e.id] = { present: false, source: "", instance: null }; continue; }
    try {
      const raw = readFileSync(abs, "utf8");
      out[e.id] = e.kind === "source"
        ? { present: true, source: raw, instance: null }
        : { present: true, source: "", instance: JSON.parse(raw) };
    } catch {
      out[e.id] = { present: false, source: "", instance: null };
    }
  }
  return out;
}

const MARK = { SATISFIED: " + ", VIOLATED: " !! ", UNKNOWN: "  ? " };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildPointerParityReport(gatherPointerEvidence());
  const check = verifyPointerParityReport(report);

  console.log("DEMA - AUTHORITATIVE-POINTER-PARITY-1A");
  console.log(`  schema: ${report.schema}`);
  console.log(`  engines: ${report.engines.length} · clauses: ${report.total_clauses}`);
  console.log(`  ledger: ${report.satisfied} satisfied · ${report.violated} violated · ${report.unknown} unknown`);
  for (const e of report.engines) {
    console.log(`  ${e.engine_id}  (${e.kind})`);
    for (const c of e.clauses) console.log(`   ${MARK[c.status]}${c.clause}`);
  }
  console.log(`  result: ${check.ok ? "PASS" : "FAIL"}`);
  console.log("  note: PASS means the parity ledger is complete and re-derivable,");
  console.log("        NOT that every pointer satisfies the contract.");
  console.log("  note: this gate reports only. It never writes, repairs or signs,");
  console.log("        and never touches the ACTIVE_MISSION pointer.");
  for (const code of check.blocked_by) console.log(`    ${code}`);
  if (!check.ok) process.exit(1);
}
