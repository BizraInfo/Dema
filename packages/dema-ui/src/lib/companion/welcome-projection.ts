// Read-only welcome card. Values come from a verified season continuation.
// Missing season state stays EMPTY or UNKNOWN. Nothing here is invented.

export const WELCOME_PROJECTION_SCHEMA = "bizra.dema.welcome_back_projection.v0.1";

export type WelcomeTruth = "VERIFIED" | "EMPTY" | "UNKNOWN";

export interface WelcomeItem {
  field: "mission_phase" | "completed_steps" | "next_safe_action" | "pending_consent";
  value: unknown;
  receipt_hash: string | null;
  truth: WelcomeTruth;
}

export interface WelcomeProjection {
  schema: typeof WELCOME_PROJECTION_SCHEMA;
  outcome: "VERIFIED" | "EMPTY" | "CONTRADICTION" | "UNKNOWN";
  reason: string | null;
  preferred_name: string | null;
  name_source: "profile.json" | "absent";
  name_receipt_hash: null;
  language_code: string | null;
  language_source: string;
  season_binding: "BLOCKED";
  season_binding_reason: string;
  season_id: string | null;
  season_ids: readonly string[];
  receipt_hash: string | null;
  state_hash: string | null;
  saved_at: string | null;
  items: WelcomeItem[];
  boundary: {
    read_only: true;
    network_used: false;
    consent_granted: false;
    file_write_performed: false;
  };
}

const SEASON_BINDING_REASON =
  "Season semantic fields have no name or language slot. The bond is stored in profile.json only.";

const BOUNDARY = Object.freeze({
  read_only: true,
  network_used: false,
  consent_granted: false,
  file_write_performed: false,
});

const FIELDS = ["mission_phase", "completed_steps", "next_safe_action", "pending_consent"] as const;

function shell(extra: Partial<WelcomeProjection> & Pick<WelcomeProjection, "outcome" | "reason" | "items">): WelcomeProjection {
  return Object.freeze({
    schema: WELCOME_PROJECTION_SCHEMA,
    preferred_name: null,
    name_source: "absent",
    name_receipt_hash: null,
    language_code: null,
    language_source: "absent",
    season_binding: "BLOCKED",
    season_binding_reason: SEASON_BINDING_REASON,
    season_id: null,
    season_ids: Object.freeze([]),
    receipt_hash: null,
    state_hash: null,
    saved_at: null,
    boundary: BOUNDARY,
    ...extra,
  });
}

function withProfile(projection: WelcomeProjection, profile: {
  preferred_name?: string | null;
  language_code?: string | null;
  language_source?: string | null;
} | null | undefined): WelcomeProjection {
  const name = typeof profile?.preferred_name === "string" && profile.preferred_name.length > 0
    ? profile.preferred_name
    : null;
  return Object.freeze({
    ...projection,
    preferred_name: name,
    name_source: name ? "profile.json" : "absent",
    name_receipt_hash: null,
    language_code: profile?.language_code ?? null,
    language_source: profile?.language_source ?? (profile?.language_code ? "profile.json" : "absent"),
  });
}

function unknownItems(): WelcomeItem[] {
  return FIELDS.map((field) => Object.freeze({
    field,
    value: null,
    receipt_hash: null,
    truth: "UNKNOWN" as const,
  }));
}

export function projectWelcome({
  listed,
  resume,
  profile = null,
}: {
  listed?: { ok?: boolean; season_ids?: readonly string[]; reason?: string | null } | null;
  resume?: {
    ok?: boolean;
    outcome?: string;
    reason?: string | null;
    receipt_hash?: string | null;
    saved_at?: string | null;
    continuation?: Record<string, unknown> | null;
  } | null;
  profile?: {
    preferred_name?: string | null;
    language_code?: string | null;
    language_source?: string | null;
  } | null;
} = {}): WelcomeProjection {
  if (!listed || listed.ok !== true || !Array.isArray(listed.season_ids)) {
    return withProfile(shell({
      outcome: "UNKNOWN",
      reason: listed?.reason ?? "season_listing_failed",
      items: unknownItems(),
    }), profile);
  }
  if (listed.season_ids.length === 0) {
    return withProfile(shell({
      outcome: "EMPTY",
      reason: "canonical_continuation_absent",
      items: unknownItems(),
    }), profile);
  }
  if (listed.season_ids.length > 1) {
    return withProfile(shell({
      outcome: "CONTRADICTION",
      reason: "season_ambiguous",
      season_ids: Object.freeze([...listed.season_ids]),
      items: unknownItems(),
    }), profile);
  }
  if (!resume || resume.ok !== true || resume.outcome !== "OK" || !resume.continuation) {
    return withProfile(shell({
      outcome: "UNKNOWN",
      reason: resume?.reason ?? resume?.outcome ?? "resume_unavailable",
      season_id: listed.season_ids[0] ?? null,
      season_ids: Object.freeze([listed.season_ids[0]]),
      items: unknownItems(),
    }), profile);
  }

  const continuation = resume.continuation;
  const receipt = typeof resume.receipt_hash === "string" ? resume.receipt_hash : null;
  const items = FIELDS.map((field) => {
    const value = continuation[field] ?? null;
    const empty = value === null || (Array.isArray(value) && value.length === 0);
    return Object.freeze({
      field,
      value,
      receipt_hash: receipt,
      truth: receipt ? (empty ? "EMPTY" : "VERIFIED") : "UNKNOWN",
    });
  });
  return withProfile(shell({
    outcome: receipt ? "VERIFIED" : "UNKNOWN",
    reason: receipt ? null : "season_receipt_missing",
    season_id: typeof continuation.season_id === "string" ? continuation.season_id : listed.season_ids[0],
    season_ids: Object.freeze([listed.season_ids[0]]),
    receipt_hash: receipt,
    state_hash: typeof continuation.state_hash === "string" ? continuation.state_hash : null,
    saved_at: typeof resume.saved_at === "string" ? resume.saved_at : null,
    items,
  }), profile);
}
