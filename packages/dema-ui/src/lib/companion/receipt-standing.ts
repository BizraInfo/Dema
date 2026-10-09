// Display projection over the canonical receipt ledger.
// One verified ledger entry counts as one standing point. This is not an XP
// grant: flywheel mint stays refused until its own SAT and consent gates.

export const RECEIPT_STANDING_SCHEMA = "bizra.dema.receipt_standing_projection.v0.1";
export const RECEIPT_STANDING_RULE_ID = "canonical_ledger_entry_count.v0.1";
export const CANONICAL_LEDGER_SOURCE = "receipts/canonical-ledger.ndjson";

const RECEIPT_ID_RE = /^[0-9a-f]{64}$/;

export interface StandingReceiptRef {
  receipt_id: string;
  source: typeof CANONICAL_LEDGER_SOURCE;
}

export interface ReceiptStandingProjection {
  schema: typeof RECEIPT_STANDING_SCHEMA;
  rule_id: typeof RECEIPT_STANDING_RULE_ID;
  truth_label: "VERIFIED" | "VERIFIED_EMPTY" | "UNKNOWN";
  xp: number | null;
  standing: number | null;
  xp_granted: false;
  receipts: readonly StandingReceiptRef[];
  reason: string | null;
  boundary: {
    read_only: true;
    network_used: false;
    xp_granted: false;
    file_write_performed: false;
  };
}

const BOUNDARY = Object.freeze({
  read_only: true,
  network_used: false,
  xp_granted: false,
  file_write_performed: false,
});

function unknown(reason: string): ReceiptStandingProjection {
  return Object.freeze({
    schema: RECEIPT_STANDING_SCHEMA,
    rule_id: RECEIPT_STANDING_RULE_ID,
    truth_label: "UNKNOWN",
    xp: null,
    standing: null,
    xp_granted: false,
    receipts: Object.freeze([]),
    reason,
    boundary: BOUNDARY,
  });
}

export function projectCanonicalStanding(verification: {
  readable: boolean;
  verified: boolean;
  entries?: Array<{ receipt_id?: unknown }> | null;
  reason?: string | null;
}): ReceiptStandingProjection {
  if (!verification || verification.readable !== true) {
    return unknown(verification?.reason || "ledger_unreadable");
  }
  if (verification.verified !== true) {
    return unknown(verification.reason || "ledger_unverified");
  }
  const entries = Array.isArray(verification.entries) ? verification.entries : [];
  const receipts: StandingReceiptRef[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const id = entries[i]?.receipt_id;
    if (typeof id !== "string" || !RECEIPT_ID_RE.test(id)) {
      return unknown("receipt_id_missing_or_malformed");
    }
    receipts.push(Object.freeze({ receipt_id: id, source: CANONICAL_LEDGER_SOURCE }));
  }
  const count = receipts.length;
  return Object.freeze({
    schema: RECEIPT_STANDING_SCHEMA,
    rule_id: RECEIPT_STANDING_RULE_ID,
    truth_label: count === 0 ? "VERIFIED_EMPTY" : "VERIFIED",
    xp: count,
    standing: count,
    xp_granted: false,
    receipts: Object.freeze(receipts),
    reason: null,
    boundary: BOUNDARY,
  });
}

/** Practice marks stay off the earned counters. */
export function applyPracticeAward<T extends { xp: number; level: number; practiceXp?: number }>(
  agents: Record<string, T>,
  agent: string,
  amount: number,
): Record<string, T> {
  const prev = agents[agent];
  if (!prev || !Number.isFinite(amount) || amount <= 0) return agents;
  return {
    ...agents,
    [agent]: {
      ...prev,
      xp: prev.xp,
      level: prev.level,
      practiceXp: (prev.practiceXp ?? 0) + amount,
    },
  };
}
