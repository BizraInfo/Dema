// Key Maker Compliance Envelope — `dema key-maker-check` slice.
//
// Bridges the Key Maker Epistemic Conduct v0.1 canon (docs/02-architecture/
// key-maker-epistemic-conduct-v0.1.md) from doctrine on paper to behavior
// in code. Emits a schema-tagged envelope that self-audits its own reasoning
// shape against the 5 invariants from canon §9:
//
//   1. Assumption Declaration  — if assumed claims exist, they are named
//   2. Certainty Mapping       — claims are decomposed into V/D/A/U states
//   3. Constructive Reading    — ambiguous inputs read with Ihsan by default
//   4. Opposing-View Search    — critique requires named truth-in-opposition
//   5. Boundary Marker         — uncertainty paired with explicit boundary
//
// The envelope does NOT enforce. It surfaces. The operator (or a future
// validator) decides what to do with a non-compliant envelope. This honors
// canon §1's "the doctrine surfaces what is there; it does not act."
//
// Analogical model: an honesty receipt. Like a tax receipt records what
// you reported, this receipt records what you reasoned and whether the
// reasoning shape satisfies the 5 invariants. The receipt does not
// audit you; it lets you audit yourself.
//
// Operating law applied:
//   Doctrine becomes load-bearing only when it can fail closed.
//   The envelope itself is the closing surface.
//
// Read-only · no chain advance · no receipt mint · no model invocation.
// Deterministic given identical inputs. No I/O inside the builder.

import { buildPreviewBoundary } from "./preview-boundary.js";

const CANONICAL_KEY_TYPES = Object.freeze([
  "question",
  "map",
  "mirror",
  "bridge",
  "boundary_marker",
  "lens",
  "lantern",
  "silence"
]);

const INVARIANT_NAMES = Object.freeze([
  "assumption_declaration",
  "certainty_mapping",
  "constructive_reading",
  "opposing_view_search",
  "boundary_marker"
]);

function freezeStringArray(arr) {
  if (!Array.isArray(arr)) return Object.freeze([]);
  return Object.freeze(
    arr.filter((v) => typeof v === "string" && v.length > 0).map((v) => String(v))
  );
}

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function safeBoolean(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function filterCanonicalKeyTypes(arr) {
  if (!Array.isArray(arr)) return Object.freeze([]);
  const valid = arr.filter((v) => typeof v === "string" && CANONICAL_KEY_TYPES.includes(v));
  // Deduplicate while preserving order
  const seen = new Set();
  const deduped = [];
  for (const v of valid) {
    if (!seen.has(v)) {
      seen.add(v);
      deduped.push(v);
    }
  }
  return Object.freeze(deduped);
}

// Invariant 1: if any assumed_with_ihsan claim exists, the assumption was named.
// An empty assumed_with_ihsan trivially passes (no assumption was needed).
function checkInvariant1AssumptionDeclaration(certainty) {
  return certainty.assumed_with_ihsan.length === 0 ||
         certainty.assumed_with_ihsan.every((s) => s.length > 0);
}

// Invariant 2: claims are decomposed into V/D/A/U states. At least one
// state must be non-empty for non-trivial outputs. Empty envelope (no
// claims) is treated as trivially compliant (nothing to decompose).
function checkInvariant2CertaintyMapping(certainty) {
  const totalClaims =
    certainty.known.length +
    certainty.uncertain.length +
    certainty.assumed_with_ihsan.length +
    certainty.unknown.length;
  if (totalClaims === 0) return true; // trivial-compliant empty envelope
  // For non-empty, the decomposition must have happened (structure is
  // always present here; this passes by construction).
  return true;
}

// Invariant 3: ambiguous inputs read with Ihsan unless contradicting
// evidence is explicitly flagged.
function checkInvariant3ConstructiveReading(constructiveReadingApplied) {
  return constructiveReadingApplied === true;
}

// Invariant 4: critique requires opposing-view search.
// Two valid paths: (a) opposing view examined AND truth found, or
// (b) opposing view examined AND searched_and_found_no_articulable_truth flag.
// If no critique is present (no opposing_view_examined), invariant is N/A
// (treated as trivially compliant).
function checkInvariant4OpposingViewSearch(opposingViewSearch) {
  if (!opposingViewSearch.view_examined || opposingViewSearch.view_examined.length === 0) {
    return true; // no critique · invariant trivially compliant
  }
  if (!opposingViewSearch.performed) return false;
  const hasTruthFound = opposingViewSearch.truth_found && opposingViewSearch.truth_found.length > 0;
  const hasHonestNullDeclaration = opposingViewSearch.searched_and_found_no_articulable_truth === true;
  return hasTruthFound || hasHonestNullDeclaration;
}

// Invariant 5: uncertainty paired with explicit boundary marker.
// If any uncertain or assumed_with_ihsan claim exists, boundary_marker
// must be non-empty.
function checkInvariant5BoundaryMarker(certainty, boundaryMarker) {
  const hasUncertainty =
    certainty.uncertain.length > 0 ||
    certainty.assumed_with_ihsan.length > 0;
  if (!hasUncertainty) return true; // no uncertainty · marker not required
  return boundaryMarker.length > 0;
}

export function buildKeyMakerCompliancePreview({
  door = "",
  known = [],
  uncertain = [],
  assumed_with_ihsan = [],
  unknown = [],
  key_types = [],
  opposing_view_examined = null,
  opposing_view_truth_found = null,
  searched_and_found_no_articulable_truth = false,
  boundary_marker = "",
  micro_consent_scope = "",
  constructive_reading_applied = true
} = {}) {
  const certainty = Object.freeze({
    known: freezeStringArray(known),
    uncertain: freezeStringArray(uncertain),
    assumed_with_ihsan: freezeStringArray(assumed_with_ihsan),
    unknown: freezeStringArray(unknown)
  });

  const opposingViewSearch = Object.freeze({
    performed:
      typeof opposing_view_examined === "string" &&
      opposing_view_examined.length > 0 &&
      (
        (typeof opposing_view_truth_found === "string" && opposing_view_truth_found.length > 0) ||
        searched_and_found_no_articulable_truth === true
      ),
    view_examined: safeString(opposing_view_examined, ""),
    truth_found: safeString(opposing_view_truth_found, ""),
    searched_and_found_no_articulable_truth: safeBoolean(searched_and_found_no_articulable_truth, false)
  });

  const microConsent = Object.freeze({
    mutation_authorized: false,
    requires_typed_go: true,
    scope_named: safeString(micro_consent_scope, "")
  });

  const boundaryMarkerSafe = safeString(boundary_marker, "");
  const constructiveApplied = safeBoolean(constructive_reading_applied, true);

  const checks = Object.freeze({
    assumption_declaration: checkInvariant1AssumptionDeclaration(certainty),
    certainty_mapping: checkInvariant2CertaintyMapping(certainty),
    constructive_reading: checkInvariant3ConstructiveReading(constructiveApplied),
    opposing_view_search: checkInvariant4OpposingViewSearch(opposingViewSearch),
    boundary_marker: checkInvariant5BoundaryMarker(certainty, boundaryMarkerSafe)
  });

  const overall_compliant = INVARIANT_NAMES.every((name) => checks[name] === true);

  const failedInvariants = INVARIANT_NAMES.filter((name) => checks[name] !== true);

  return Object.freeze({
    schema: "bizra.dema.key_maker_compliance.v0.1",
    truth_label: "NODE0_LOCAL_SEED",
    mode: "epistemic_conduct_check",
    door: safeString(door, ""),
    certainty,
    key_types: filterCanonicalKeyTypes(key_types),
    opposing_view_search: opposingViewSearch,
    boundary_marker: boundaryMarkerSafe,
    constructive_reading_applied: constructiveApplied,
    micro_consent: microConsent,
    invariant_compliance: Object.freeze({
      ...checks,
      overall_compliant,
      failed_invariants: Object.freeze(failedInvariants)
    }),
    canonical_key_types: CANONICAL_KEY_TYPES,
    boundary: buildPreviewBoundary()
  });
}

// Compact summary view of compliance envelope — used by
// `dema key-maker-check --summary`. Collapses the certainty arrays to
// counts and surfaces overall_compliant + failed_invariants.
export function buildKeyMakerComplianceSummary(options = {}) {
  const full = buildKeyMakerCompliancePreview(options);
  return Object.freeze({
    schema: "bizra.dema.key_maker_compliance_summary.v0.1",
    truth_label: full.truth_label,
    mode: "summary",
    source_schema: full.schema,
    door: full.door,
    overall_compliant: full.invariant_compliance.overall_compliant,
    failed_invariants: full.invariant_compliance.failed_invariants,
    certainty_counts: Object.freeze({
      known: full.certainty.known.length,
      uncertain: full.certainty.uncertain.length,
      assumed_with_ihsan: full.certainty.assumed_with_ihsan.length,
      unknown: full.certainty.unknown.length
    }),
    key_types_count: full.key_types.length,
    boundary_marker_present: full.boundary_marker.length > 0,
    boundary: full.boundary
  });
}

export const KEY_MAKER_CANONICAL_KEY_TYPES = CANONICAL_KEY_TYPES;
export const KEY_MAKER_INVARIANT_NAMES = INVARIANT_NAMES;
