import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const SERVICE_ECONOMY_LEDGER_SCHEMA =
  "bizra.dema.service_economy_ledger_preview.v0.1";
export const SERVICE_ECONOMY_LEDGER_TRUTH_LABEL =
  "SERVICE_ECONOMY_LEDGER_PREVIEW_ONLY";

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function prefixedSha256(value) {
  return `sha256:${sha256(stableStringify(value))}`;
}

function validAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

export function buildServiceEconomyLedgerEntry({
  service_type,
  payer,
  provider,
  bzc_spend_preview,
  source_receipt_hash,
  result_accepted = false,
  generatedAtIso = "",
} = {}) {
  const blockers = [];
  if (typeof service_type !== "string" || service_type.length === 0) {
    blockers.push("service_type_required");
  }
  if (typeof payer !== "string" || payer.length === 0) {
    blockers.push("payer_required");
  }
  if (typeof provider !== "string" || provider.length === 0) {
    blockers.push("provider_required");
  }
  if (!validAmount(bzc_spend_preview)) {
    blockers.push("bzc_spend_preview_invalid");
  }
  if (
    typeof source_receipt_hash !== "string" ||
    !/^sha256:[a-f0-9]{64}$/.test(source_receipt_hash)
  ) {
    blockers.push("source_receipt_hash_required");
  }

  const body = freezeDeep({
    schema: SERVICE_ECONOMY_LEDGER_SCHEMA,
    truth_label: SERVICE_ECONOMY_LEDGER_TRUTH_LABEL,
    generated_at_iso: generatedAtIso,
    service_type: service_type ?? null,
    payer: payer ?? null,
    provider: provider ?? null,
    token_symbol: "BZR-C",
    bzc_spend_preview: validAmount(bzc_spend_preview)
      ? Number(bzc_spend_preview)
      : 0,
    result_accepted: result_accepted === true,
    service_receipt_required: true,
    reward_settlement_performed: false,
    live_transfer: false,
    no_wallet: true,
    no_sale: true,
    source_receipt_hash: source_receipt_hash ?? null,
    valid: blockers.length === 0,
    blocked_reason: blockers[0] ?? null,
    blocked_reasons: blockers,
    what_this_proves: [
      "A service-economy spend candidate can be represented as a local preview receipt.",
      "BZR-C service use stays separate from live transfer, wallet, sale, and settlement claims.",
    ],
    what_this_does_not_prove: [
      "No BZR-C was transferred, reserved, burned, sold, or settled.",
      "No AaaS or RaaS marketplace is live.",
    ],
    boundary: buildPreviewBoundary(),
  });

  return freezeDeep({
    ...body,
    ledger_entry_hash: prefixedSha256(body),
  });
}

export function verifyServiceEconomyLedgerEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return freezeDeep({
      valid: false,
      reason: "entry_missing_or_malformed",
      recomputed_ledger_entry_hash: null,
    });
  }

  const { ledger_entry_hash, ...body } = entry;
  const recomputed = prefixedSha256(body);
  const valid =
    entry.schema === SERVICE_ECONOMY_LEDGER_SCHEMA &&
    entry.truth_label === SERVICE_ECONOMY_LEDGER_TRUTH_LABEL &&
    entry.live_transfer === false &&
    entry.no_wallet === true &&
    entry.no_sale === true &&
    ledger_entry_hash === recomputed;

  return freezeDeep({
    valid,
    reason: valid ? null : "entry_hash_or_boundary_mismatch",
    recomputed_ledger_entry_hash: recomputed,
  });
}
