// DEMA-FOUNDER-RELIEF-BRIEFING-DIFF-0H — report UNIQUE value, not polling
// frequency. Given the current shift and the prior state, it surfaces only what
// CHANGED: results whose observation hash moved, findings/candidates that are new,
// candidates that resolved, and tasks that newly retired. So GOOD-MORNING-MUMU
// reads "here is new work" instead of "I re-ran the same 8 checks again." PURE.

export const BRIEFING_DIFF_SCHEMA = "bizra.dema.briefing_diff.v0.1";

const asArr = (x) => (Array.isArray(x) ? x : []);
const hashMap = (results) => {
  const m = Object.create(null);
  for (const r of asArr(results)) if (r && typeof r.op === "string") m[r.op] = r.observation_sha256 ?? null;
  return m;
};
const setOf = (xs) => new Set(asArr(xs).map(String));

/**
 * diff the current shift against the previous snapshot.
 * current/previous: { results:[{op,observation_sha256}], candidates:[id], retired:[id] }
 */
export function diffBriefing({ current = {}, previous = {} } = {}) {
  const prev = hashMap(previous.results);
  const prevKnown = new Set(Object.keys(prev));
  const newFindings = [];       // ops observed for the first time
  const changed = [];           // ops whose observation hash moved
  let unchanged = 0;            // same op + same hash = pure polling, NOT reported
  for (const r of asArr(current.results)) {
    if (!r || typeof r.op !== "string") continue;
    if (!prevKnown.has(r.op)) newFindings.push(r.op);
    else if (prev[r.op] !== (r.observation_sha256 ?? null)) changed.push(r.op);
    else unchanged += 1;
  }
  const prevCand = setOf(previous.candidates), curCand = setOf(current.candidates);
  const new_candidates = [...curCand].filter((c) => !prevCand.has(c));
  const resolved_candidates = [...prevCand].filter((c) => !curCand.has(c));
  const prevRetired = setOf(previous.retired);
  const newly_retired = [...setOf(current.retired)].filter((t) => !prevRetired.has(t));

  const has_new_value = newFindings.length + changed.length + new_candidates.length + resolved_candidates.length + newly_retired.length > 0;
  return Object.freeze({
    schema: BRIEFING_DIFF_SCHEMA,
    new_findings: Object.freeze(newFindings),
    changed_results: Object.freeze(changed),
    new_candidates: Object.freeze(new_candidates),
    resolved_candidates: Object.freeze(resolved_candidates),
    newly_retired: Object.freeze(newly_retired),
    unchanged_count: unchanged,
    has_new_value,
    authority_delta: 0,
  });
}

/** Render only the delta — nothing new says so plainly. */
export function formatBriefingDiff(d = {}) {
  if (!d.has_new_value) return `NEW SINCE LAST BRIEFING: nothing new (${d.unchanged_count ?? 0} checks re-ran, unchanged)`;
  const lines = ["NEW SINCE LAST BRIEFING:"];
  const add = (label, xs) => { if (asArr(xs).length) lines.push(`  ${label}: ${xs.join(", ")}`); };
  add("new findings", d.new_findings);
  add("changed results", d.changed_results);
  add("new candidate repairs", d.new_candidates);
  add("resolved candidates", d.resolved_candidates);
  add("newly retired", d.newly_retired);
  lines.push(`  (${d.unchanged_count ?? 0} unchanged checks not shown)`);
  return lines.join("\n");
}
