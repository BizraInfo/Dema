// Face projection over dema-presence and the realm presence reducer.
// An avatar state is shown only when a receipt hash justifies it.
// An empty event list is withheld: the kernel's IDLE has justified_by null.

import { derivePresenceState, PRESENCE_EVENT_KINDS } from "../../../../core/src/dema-presence.js";
import { deriveRenderRequest } from "../../../../core/src/drs-presence-reducer.js";

export const PRESENCE_PROJECTION_SCHEMA = "bizra.dema.presence_face_projection.v0.1";

const RECEIPT_HASH_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const KINDS = new Set<string>(Object.values(PRESENCE_EVENT_KINDS));

export interface PresenceEvent {
  kind: string;
  receipt_hash: string;
  seq: number;
  emitted_at: string;
}

export interface PresenceProjection {
  schema: typeof PRESENCE_PROJECTION_SCHEMA;
  state: string;
  reason: string;
  justified_by: string | null;
  kernel_empty_state: string | null;
  kernel_empty_withheld: boolean;
  drs_semantic_state: string;
  drs_evidence_refs: readonly string[];
  events_consumed: number;
  refused: readonly Record<string, unknown>[];
  boundary: {
    read_only: true;
    network_used: false;
    file_write_performed: false;
  };
}

function eventProblems(event: Partial<PresenceEvent> | null | undefined): string[] {
  const problems: string[] = [];
  if (!event || typeof event.kind !== "string" || !KINDS.has(event.kind)) problems.push("kind");
  if (typeof event?.receipt_hash !== "string" || !RECEIPT_HASH_RE.test(event.receipt_hash)) problems.push("receipt_hash");
  if (!Number.isInteger(event?.seq) || (event?.seq ?? -1) < 0) problems.push("seq");
  if (typeof event?.emitted_at !== "string" || !ISO_8601_RE.test(event.emitted_at)) problems.push("emitted_at");
  return problems;
}

export function projectPresence({
  events = [],
  observations = [],
}: {
  events?: Array<Partial<PresenceEvent>>;
  observations?: Array<Record<string, unknown>>;
} = {}): PresenceProjection {
  const admissible: PresenceEvent[] = [];
  const refused: Array<Record<string, unknown>> = [];
  for (const observation of observations) {
    refused.push(Object.freeze({
      ...observation,
      admissible: false,
      reason: typeof observation.reason === "string" ? observation.reason : "no_receipt",
    }));
  }
  events.forEach((event, index) => {
    const problems = eventProblems(event);
    if (problems.length > 0) {
      refused.push(Object.freeze({ index, admissible: false, reason: problems.join(",") }));
      return;
    }
    admissible.push(event as PresenceEvent);
  });

  const emptyKernel = derivePresenceState([]);
  const derivation = admissible.length > 0 ? derivePresenceState(admissible) : null;
  const drs = deriveRenderRequest({ transcript: [] });
  const justified = typeof derivation?.justified_by === "string" && derivation.justified_by.length > 0;
  const state = justified ? derivation.state : "UNKNOWN";
  return Object.freeze({
    schema: PRESENCE_PROJECTION_SCHEMA,
    state,
    reason: justified
      ? derivation.reason
      : admissible.length === 0
        ? "no_receipt_bound_presence_events"
        : derivation?.reason ?? "presence_unjustified",
    justified_by: justified ? derivation.justified_by : null,
    kernel_empty_state: admissible.length === 0 ? emptyKernel.state : null,
    kernel_empty_withheld: admissible.length === 0 && emptyKernel.justified_by == null,
    drs_semantic_state: drs.render_request?.semantic_state ?? "UNKNOWN",
    drs_evidence_refs: Object.freeze([...(drs.render_request?.evidence_refs ?? [])]),
    events_consumed: admissible.length,
    refused: Object.freeze(refused),
    boundary: Object.freeze({
      read_only: true,
      network_used: false,
      file_write_performed: false,
    }),
  });
}
