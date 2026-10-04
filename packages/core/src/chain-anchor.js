// CHAIN-ANCHOR-1A — external anchor for hash-chained receipt logs.
//
// WHY THIS EXISTS
//
// A self-contained hash chain cannot detect its own deletion. `verifyChain`
// in l1-micro-loop.js derives the expected head FROM the chain file, so an
// erased chain verifies as `{valid: true, entries: 0}` — a clean-looking
// answer about a history that no longer exists. Measured 2026-07-31.
// That is a false GREEN, and no-false-GREEN is repo law.
//
// The missing element is an expectation held OUTSIDE the thing it judges.
// This kernel is that expectation: a monotonic record of (entries, head)
// kept in a store the acting party cannot reach, plus the comparison law
// that turns "looks fine" into ERASED / TRUNCATED / FORKED / EXTENDED / OK.
//
// DESIGN LAWS
//
//   1. Pure. No fs, no clock, no randomness — the caller owns persistence
//      and time. A judge that performs IO can be starved by IO.
//   2. Monotonic. entries may only grow and each head must extend the last.
//      Any other movement is a defect class, never "probably fine".
//   3. Fail closed. Missing anchor, malformed anchor, missing observation:
//      all verdicts are refusals, never OK.
//   4. Self-protecting. The anchor log is itself hash-linked, so editing an
//      anchor record is detectable — otherwise the judge is as forgeable as
//      the thing it judges.
//   5. Placement is a precondition, not a suggestion: `assertAnchorOutside`
//      must hold, or the act being audited can rename its own judge away.
//
// SCOPE — comparison and record shape only. Persistence, scheduling and
// wiring into a loop are the caller's, and none of it exists yet.

export const CHAIN_ANCHOR_SCHEMA = "bizra.dema.chain_anchor.v0.1";
export const CHAIN_ANCHOR_TRUTH_LABEL = "CHAIN_ANCHOR_COMPARATOR_ONLY";

export const VERDICTS = Object.freeze([
  "OK",         // observation matches the anchor exactly
  "EXTENDED",   // chain grew and still extends the anchored head — expected
  "ERASED",     // anchored entries existed; observation has fewer or none
  "TRUNCATED",  // same as ERASED but some history survives
  "FORKED",     // same length, different head — history was replaced
  "NO_ANCHOR",  // nothing anchored — cannot judge, must not pass
  "MALFORMED",  // anchor or observation is not a usable shape
]);

const PASSING = Object.freeze(["OK", "EXTENDED"]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function isHead(v) {
  return typeof v === "string" && /^[0-9a-f]{16,}$/.test(v);
}

function isCount(v) {
  return Number.isInteger(v) && v >= 0;
}

function result(verdict, detail, extra = {}) {
  return deepFreeze({
    schema: CHAIN_ANCHOR_SCHEMA,
    truth_label: CHAIN_ANCHOR_TRUTH_LABEL,
    verdict,
    intact: PASSING.includes(verdict),
    detail,
    ...extra,
    what_this_proves:
      "Whether an observed chain still extends the last independently anchored state",
    what_this_does_not_prove:
      "That the anchor store itself is durable, that any act was correct, or that a loop closed",
  });
}

/**
 * Build the anchor record for a freshly observed chain state.
 * Hash-links to the previous anchor so anchor edits are detectable.
 *
 * @param {object} p
 * @param {string} p.chain_id      stable id for the chain being anchored
 * @param {number} p.entries       observed entry count
 * @param {string} p.head          observed chain head
 * @param {object|null} p.previous prior anchor record, or null for the first
 * @param {function} p.hash        (string) => hex digest — injected, kept pure
 * @param {string} [p.at]          caller-supplied timestamp (never Date.now())
 */
export function buildAnchorRecord({ chain_id, entries, head, previous = null, hash, at = null }) {
  if (typeof hash !== "function") throw new TypeError("hash function required");
  if (!chain_id || !isCount(entries) || !isHead(head)) {
    throw new TypeError("chain_id, integer entries and hex head are required");
  }
  const prev_anchor = previous?.anchor_hash ?? "anchor-genesis";
  const body = {
    schema: CHAIN_ANCHOR_SCHEMA,
    chain_id,
    entries,
    head,
    prev_anchor,
    at,
  };
  return deepFreeze({
    ...body,
    anchor_hash: hash(JSON.stringify(body) + prev_anchor),
  });
}

/**
 * The comparison law. Returns a frozen verdict; never throws on bad input.
 *
 * @param {object|null} anchor      last anchor record (null => NO_ANCHOR)
 * @param {object|null} observed    { entries, head } read from the live chain
 * @param {object} [opts]
 * @param {string[]} [opts.head_history] known heads of the observed chain, in
 *   order, when available. Supplying it upgrades EXTENDED from "plausible"
 *   to "proven": without it, growth past the anchor cannot be distinguished
 *   from replacement, and this kernel says so instead of guessing.
 */
export function verifyAgainstAnchor(anchor, observed, opts = {}) {
  if (anchor === null || anchor === undefined) {
    return result("NO_ANCHOR", "no anchor record — chain state cannot be judged");
  }
  if (typeof anchor !== "object" || !isCount(anchor.entries) || !isHead(anchor.head)) {
    return result("MALFORMED", "anchor record is not a usable shape");
  }
  if (observed === null || observed === undefined || typeof observed !== "object") {
    return result("MALFORMED", "no observation supplied");
  }
  const { entries, head } = observed;
  if (!isCount(entries)) {
    return result("MALFORMED", "observed entries is not a count");
  }

  if (entries < anchor.entries) {
    const verdict = entries === 0 ? "ERASED" : "TRUNCATED";
    return result(
      verdict,
      `anchored ${anchor.entries} entries, observed ${entries}`,
      { anchored_entries: anchor.entries, observed_entries: entries },
    );
  }

  if (entries === anchor.entries) {
    if (head === anchor.head) return result("OK", "chain matches anchor exactly");
    return result("FORKED", "same length, different head — history was replaced", {
      anchored_head: anchor.head,
      observed_head: typeof head === "string" ? head : null,
    });
  }

  // entries > anchor.entries — growth. Only provable with head history.
  const history = Array.isArray(opts.head_history) ? opts.head_history : null;
  if (!history) {
    return result(
      "MALFORMED",
      "chain grew past the anchor but no head_history was supplied — " +
        "growth cannot be distinguished from replacement; supply head_history",
      { anchored_entries: anchor.entries, observed_entries: entries },
    );
  }
  if (history[anchor.entries - 1] !== anchor.head) {
    return result("FORKED", "grown chain does not contain the anchored head at its position", {
      anchored_head: anchor.head,
      head_at_anchor_position: history[anchor.entries - 1] ?? null,
    });
  }
  return result("EXTENDED", `chain grew ${anchor.entries} -> ${entries}, anchored head intact`, {
    anchored_entries: anchor.entries,
    observed_entries: entries,
  });
}

/**
 * Verify the anchor log itself — an unlinked anchor store is not a judge.
 * @param {object[]} records anchor records in order
 * @param {function} hash    same injected hash used to build them
 */
export function verifyAnchorLog(records, hash) {
  if (!Array.isArray(records)) return result("MALFORMED", "anchor log is not an array");
  let prev = "anchor-genesis";
  for (let i = 0; i < records.length; i++) {
    const { anchor_hash, ...body } = records[i] ?? {};
    if (body.prev_anchor !== prev) {
      return result("FORKED", `anchor ${i}: prev_anchor mismatch`, { broken_at: i });
    }
    if (hash(JSON.stringify(body) + prev) !== anchor_hash) {
      return result("FORKED", `anchor ${i}: record was edited`, { broken_at: i });
    }
    prev = anchor_hash;
  }
  return result("OK", `anchor log intact (${records.length} records)`, {
    records: records.length,
    head: prev,
  });
}

/**
 * Placement precondition (design law 5). The anchor store must not live
 * inside the scope the audited act can write, or the act can rename its own
 * judge away — the E2 defect, one level up.
 *
 * @param {string} anchorDirReal  realpath-resolved anchor directory
 * @param {string} scopeRootReal  realpath-resolved leased scope root
 * @param {string} sep            path separator, injected to stay pure
 */
export function assertAnchorOutside(anchorDirReal, scopeRootReal, sep = "/") {
  if (typeof anchorDirReal !== "string" || typeof scopeRootReal !== "string") {
    return result("MALFORMED", "anchor and scope paths must be resolved strings");
  }
  const a = anchorDirReal.endsWith(sep) ? anchorDirReal : anchorDirReal + sep;
  const s = scopeRootReal.endsWith(sep) ? scopeRootReal : scopeRootReal + sep;
  if (a.startsWith(s)) {
    return result("MALFORMED", "anchor store is inside the leased scope — the act could erase its own judge", {
      anchor_dir: anchorDirReal,
      scope_root: scopeRootReal,
    });
  }
  return result("OK", "anchor store is outside the leased scope");
}
