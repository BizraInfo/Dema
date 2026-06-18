// UX-3 · Council seat → PAT role routing (preview-only).
//
// Maps the five Dema Realm council seats (UX-1D) to ADK PAT role templates.
// Answers: "If I address this council seat in chat, which PAT role would route?"
//
// NO PAT runtime. NO model calls. NO network. NO file write.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const COUNCIL_SEAT_PAT_ROUTING_SCHEMA =
  "bizra.dema.council_seat_pat_routing_preview.v0.1";

export const COUNCIL_SEAT_NAMES = Object.freeze([
  "Guardian",
  "Reasoner",
  "Builder",
  "Critic",
  "Archivist",
]);

const SEAT_TOKEN_TO_NAME = Object.freeze({
  guardian: "Guardian",
  reasoner: "Reasoner",
  builder: "Builder",
  critic: "Critic",
  archivist: "Archivist",
});

/** @type {Readonly<Record<string, Readonly<object>>>} */
export const COUNCIL_SEAT_PAT_ROUTES = Object.freeze({
  Guardian: Object.freeze({
    council_role: "Boundary / consent / risk",
    pat_role: "Auditor",
    pat_agent_id: "pat-auditor",
    routing_mode: "preview_only",
    adk_scope: "PRIVATE_PAT",
    rationale:
      "Guardian boundary discipline aligns with PAT Auditor verify-and-refuse posture.",
  }),
  Reasoner: Object.freeze({
    council_role: "SAPE / graph thinking",
    pat_role: "Architect",
    pat_agent_id: "pat-architect",
    routing_mode: "preview_only",
    adk_scope: "PRIVATE_PAT",
    rationale:
      "Reasoner decomposition maps to PAT Architect draft-and-structure work.",
  }),
  Builder: Object.freeze({
    council_role: "Implementation / tests / commits",
    pat_role: "Engineer",
    pat_agent_id: "pat-engineer",
    routing_mode: "preview_only",
    adk_scope: "PRIVATE_PAT",
    rationale:
      "Builder implementation slice maps to PAT Engineer draft-and-test effects.",
  }),
  Critic: Object.freeze({
    council_role: "Self-review / red-team",
    pat_role: "Mirror",
    pat_agent_id: "pat-mirror",
    routing_mode: "preview_only",
    adk_scope: "PRIVATE_PAT",
    rationale:
      "Critic reflective review maps to PAT Mirror read-and-summarize posture.",
  }),
  Archivist: Object.freeze({
    council_role: "Receipts / memory / truth",
    pat_role: "Scribe",
    pat_agent_id: "pat-scribe",
    routing_mode: "preview_only",
    adk_scope: "PRIVATE_PAT",
    rationale:
      "Archivist receipt discipline maps to PAT Scribe draft-and-record posture.",
  }),
});

export const COUNCIL_SEAT_CHAT_TRIGGERS = Object.freeze([
  "talk to the",
  "talk to",
  "speak with the",
  "speak with",
  "ask the",
  "ask",
  "route to",
  "route",
  "council seat",
  "council:",
  "seat:",
]);

export const COUNCIL_PAT_DISPATCH_CONSENT_PREFIX =
  "GO: dispatch PAT from council seat ";

/**
 * @param {string} seat
 * @returns {string|null}
 */
export function councilPatDispatchConsentPhrase(seat) {
  const resolved = normalizeCouncilSeatToken(seat);
  if (!resolved) return null;
  return `${COUNCIL_PAT_DISPATCH_CONSENT_PREFIX}${resolved}`;
}

/**
 * @param {string} line
 * @returns {{ seat: string, consent_phrase: string }|null}
 */
export function parseCouncilPatDispatchConsentLine(line) {
  const trimmed = typeof line === "string" ? line.trim() : "";
  if (!trimmed.startsWith(COUNCIL_PAT_DISPATCH_CONSENT_PREFIX)) return null;
  const seatRaw = trimmed.slice(COUNCIL_PAT_DISPATCH_CONSENT_PREFIX.length).trim();
  const resolved = normalizeCouncilSeatToken(seatRaw);
  if (!resolved) return null;
  const required = councilPatDispatchConsentPhrase(resolved);
  if (trimmed !== required) return null;
  return { seat: resolved, consent_phrase: trimmed };
}

/**
 * @param {string} normalized
 * @returns {{ seat: string, consent_phrase: string }|null}
 */
export function detectCouncilPatDispatchInInput(normalized) {
  const consentParsed = parseCouncilPatDispatchConsentLine(normalized);
  if (consentParsed) return consentParsed;

  const raw = typeof normalized === "string" ? normalized.trim() : "";
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (!lower.includes("dispatch")) return null;
  if (!lower.includes("pat") && !lower.includes("council")) return null;
  const seat = detectCouncilSeatInInput(raw);
  if (!seat) return null;
  return { seat, consent_phrase: "" };
}

/**
 * @param {string} token
 * @returns {string|null}
 */
export function normalizeCouncilSeatToken(token) {
  if (typeof token !== "string" || !token.trim()) return null;
  return SEAT_TOKEN_TO_NAME[token.trim().toLowerCase()] ?? null;
}

/**
 * Detect a council seat reference in free-form chat input.
 *
 * @param {string} normalized - trimmed single-line input (lowercase ok)
 * @returns {string|null} canonical seat name
 */
export function detectCouncilSeatInInput(normalized) {
  const raw = typeof normalized === "string" ? normalized.trim() : "";
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const tokens = lower.split(/\s+/).filter(Boolean);

  if (tokens.length === 1) {
    return normalizeCouncilSeatToken(tokens[0]);
  }

  const hasTrigger = COUNCIL_SEAT_CHAT_TRIGGERS.some((phrase) =>
    lower.includes(phrase),
  );
  if (!hasTrigger && !lower.includes("council")) {
    return null;
  }

  for (const token of tokens) {
    const seat = normalizeCouncilSeatToken(token);
    if (seat) return seat;
  }

  return null;
}

/**
 * @param {object} [opts]
 * @param {string} [opts.seat]
 * @param {Date} [opts.now]
 */
export function buildCouncilSeatPatRoutingPreview({ seat = null, now = new Date() } = {}) {
  const boundary = buildPreviewBoundary();
  const resolved =
    typeof seat === "string" ? normalizeCouncilSeatToken(seat) : null;

  if (!resolved) {
    return Object.freeze({
      schema: COUNCIL_SEAT_PAT_ROUTING_SCHEMA,
      truth_label: "NODE0_LOCAL_SEED",
      mode: "preview_only",
      routing_status: seat ? "seat_unresolved" : "table_only",
      seat_requested: typeof seat === "string" ? seat : null,
      selected_seat: null,
      routes: COUNCIL_SEAT_PAT_ROUTES,
      route_count: COUNCIL_SEAT_NAMES.length,
      disclaimer:
        "Council seat → PAT routing is preview-only. No PAT runtime is invoked from chat.",
      rendered_at_iso: now.toISOString(),
      boundary,
    });
  }

  const route = COUNCIL_SEAT_PAT_ROUTES[resolved];

  return Object.freeze({
    schema: COUNCIL_SEAT_PAT_ROUTING_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    routing_status: "routed_preview_only",
    seat_requested: seat,
    selected_seat: resolved,
    council_role: route.council_role,
    pat_role: route.pat_role,
    pat_agent_id: route.pat_agent_id,
    routing_mode: route.routing_mode,
    adk_scope: route.adk_scope,
    rationale: route.rationale,
    routes: COUNCIL_SEAT_PAT_ROUTES,
    route_count: COUNCIL_SEAT_NAMES.length,
    disclaimer:
      "Council seat → PAT routing is preview-only. No PAT runtime is invoked from chat.",
    rendered_at_iso: now.toISOString(),
    boundary,
  });
}

export function formatCouncilSeatPatRoutingResponse(preview) {
  if (preview.routing_status === "routed_preview_only") {
    return [
      "> Council seat → PAT routing (preview only)",
      "",
      `  Seat:      ${preview.selected_seat} · ${preview.council_role}`,
      `  PAT role:  ${preview.pat_role} (${preview.pat_agent_id})`,
      `  Scope:     ${preview.adk_scope} · ${preview.routing_mode}`,
      "",
      `  ${preview.rationale}`,
      "",
      "  This does not invoke a PAT runtime.",
      "  Inspect full table:  dema realm council-route --json",
      "  Dispatch preview:  dema realm council-dispatch --seat " +
        preview.selected_seat,
      "  Council profiles:  dema realm council",
    ].join("\n");
  }

  const lines = [
    "> Council seat → PAT routing table (preview only)",
    "",
    `  ${preview.route_count} seats mapped to PAT roles:`,
  ];
  for (const name of COUNCIL_SEAT_NAMES) {
    const r = COUNCIL_SEAT_PAT_ROUTES[name];
    lines.push(`    ${name.padEnd(10)} → ${r.pat_role} (${r.pat_agent_id})`);
  }
  lines.push(
    "",
    "  Address a seat in chat, e.g.:  talk to the guardian",
    "  Or:  dema realm council-route --seat Guardian --json",
  );
  return lines.join("\n");
}
