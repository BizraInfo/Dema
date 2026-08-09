// DEMA-CONVENE-PERSONAL-COUNCIL-1A — the alpha edge.
//
// The human states one intent. Dema convenes her seven, each returns the charge
// its role is answerable for, and Dema composes them into one attributed plan.
//
// NOT ML. NOT a model call. NOT a scheduler. NOTHING is dispatched here.
//
// WHAT THIS IS HONESTLY. A DETERMINISTIC DECOMPOSITION, not a deliberation.
// Every PAT contract on disk is `DESIGNED_NOT_LIVE` with `adapter_ref: null`,
// so no model is bound to any seat, and the boundary forbids implicit model
// invocation. What is proven here is that an intent entering at Dema reaches
// all seven seats and returns attributed, bounded and content-addressed. What
// is NOT proven is that anybody reasoned: the charges are derived from each
// role's standing responsibility, not produced by that role thinking.
//
// AND THAT IS THE POINT, NOT THE SHORTFALL. This builds the HABIT, not the
// ACTOR. The constitution, the isnad, the bounds, the attribution and the
// digest are what persist; the model that eventually answers a charge is
// swappable and must be. A council whose correctness depended on which model
// sat in a seat would have to be re-proven every time the seat changed — the
// thesis this estate has held all along is that the system's verdict is
// model-agnostic. So `reasoning_performed: false` is not a caveat to be
// engineered away; it is the honest reading of a habit that already works
// before any actor arrives. Binding an adapter fills these charges. It changes
// nothing about the routing, the bounds, or who answers for what.
//
// AUTHORITY IS CHECKED, NOT ASSUMED. Convening asks the authority graph whether
// `dema → pat` is admissible before it composes anything, and refuses if it is
// not. That makes the graph load-bearing rather than decorative: revoke the
// edge and this surface goes dark.
//
// THE ALPHA DOES NOT REACH PAST HER TEAM. Dema charges the seven and no one
// else. Subagents hang off a PAT, never off Dema, and SAT is not hers to
// convene at all — it lives in URP and answers to the constitution.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { buildPreviewBoundary } from "./preview-boundary.js";
import { evaluateAuthorityEdge, EDGE_KINDS } from "./node0-authority-graph.js";

export const DEMA_CONVENE_PERSONAL_COUNCIL_SCHEMA =
  "bizra.dema.convene_personal_council.v0.1";
export const DEMA_CONVENE_PERSONAL_COUNCIL_TRUTH_LABEL = "DESIGNED_NOT_LIVE";

/// What each seat is answerable for. Keyed by the shipped role_id so a roster
/// rename surfaces as an unknown seat rather than a silently dropped charge.
const SEAT_CHARGES = Object.freeze({
  "pat-1-archivist": "Locate what this node already holds on the intent, and say plainly what it does not hold.",
  "pat-2-extractor": "Pull the specific facts the intent turns on, each bound to where it came from.",
  "pat-3-cartographer": "Map how those facts connect, and mark the gaps the map cannot cross.",
  "pat-4-scout": "Find what is missing or newly changed that the map does not yet cover.",
  "pat-5-applicability-engineer": "Judge which findings actually apply to THIS intent, and reject the merely interesting.",
  "pat-6-reproduction-engineer": "State how each applicable finding would be reproduced or falsified.",
  "pat-7-scribe": "Record the charge, the outcome, and what remains unproven.",
});

/// Order is fixed and derived from the roster, so the same intent convenes the
/// same council in the same sequence — the plan is comparable across runs.
function patRoles(roleContracts) {
  return roleContracts
    .filter((r) => r?.team === "PAT")
    .slice()
    .sort((a, b) => String(a.role_id).localeCompare(String(b.role_id)));
}

function refusal(reason, detail) {
  return Object.freeze({
    schema: DEMA_CONVENE_PERSONAL_COUNCIL_SCHEMA,
    truth_label: DEMA_CONVENE_PERSONAL_COUNCIL_TRUTH_LABEL,
    convened: false,
    reason,
    detail: detail ?? null,
    charges: Object.freeze([]),
    boundary: buildPreviewBoundary(),
  });
}

/**
 * Pure. Convenes the personal agent team over one intent.
 *
 * @param {object} input
 * @param {string} input.intent            the human's words, unmodified
 * @param {Array<object>} input.roleContracts  the shipped roster
 */
export function convenePersonalCouncil({ intent, roleContracts = [] } = {}) {
  if (typeof intent !== "string" || intent.trim() === "") {
    return refusal("intent_required");
  }

  // The graph decides, not this file. An inadmissible edge is a refusal even
  // though every other input is valid.
  const edge = evaluateAuthorityEdge({
    from: "dema",
    to: "pat",
    kind: EDGE_KINDS.COMMAND,
  });
  if (!edge.allowed) return refusal("authority_edge_refused", edge.reason);

  const roles = patRoles(roleContracts);
  if (roles.length === 0) return refusal("no_personal_team_on_roster");

  const charges = [];
  for (const role of roles) {
    const charge = SEAT_CHARGES[role.role_id];
    if (!charge) return refusal("unknown_seat", role.role_id);
    // A seat that could widen authority by being charged is not chargeable.
    if (role?.authority?.spawn_widens_authority !== false) {
      return refusal("seat_would_widen_authority", role.role_id);
    }
    charges.push(
      Object.freeze({
        role_id: role.role_id,
        charge,
        // Carried from the contract, never invented here, so a tightened
        // contract tightens the charge without editing this file.
        bounded_by: Object.freeze({
          mint_allowed: role.authority.mint_allowed,
          egress_allowed: role.authority.egress_allowed,
          corpus_write_allowed: role.authority.corpus_write_allowed,
        }),
        may_spawn_subagents: role.spawn_limit > 0,
        // No adapter bound means no model can answer this charge yet. Stated
        // per seat so a partially-bound council cannot read as fully live.
        reasoning_available: Boolean(role.adapter_ref),
      }),
    );
  }

  const body = {
    schema: DEMA_CONVENE_PERSONAL_COUNCIL_SCHEMA,
    intent,
    charges,
  };

  return Object.freeze({
    ...body,
    truth_label: DEMA_CONVENE_PERSONAL_COUNCIL_TRUTH_LABEL,
    convened: true,
    reason: null,
    seat_count: charges.length,
    // False while every adapter_ref is null: the council was convened, but
    // nobody reasoned. This is the field that must flip before any output of
    // this surface may be described as the team's thinking.
    reasoning_performed: charges.some((c) => c.reasoning_available),
    charges: Object.freeze(charges),
    content_hash: sha256CanonicalJsonV1(body),
    boundary: buildPreviewBoundary(),
    what_this_proves:
      "One intent entering at Dema reaches every seat of the personal team and returns attributed, bounded and content-addressed.",
    what_this_does_not_prove:
      "Does not prove any seat reasoned, that a model was consulted, or that any task was executed; no adapter is bound and no model is invoked.",
  });
}

/// Re-derives the digest from the convened body, so an edited plan cannot pass
/// as the one the council was actually charged with.
export function verifyConvenedCouncil(envelope) {
  if (!envelope?.convened) {
    return Object.freeze({ ok: false, reason: "not_convened" });
  }
  const expected = sha256CanonicalJsonV1({
    schema: envelope.schema,
    intent: envelope.intent,
    charges: envelope.charges,
  });
  return expected === envelope.content_hash
    ? Object.freeze({ ok: true })
    : Object.freeze({ ok: false, reason: "content_hash_mismatch" });
}
