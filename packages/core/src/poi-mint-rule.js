import {
  LIVE_TOKEN_MINT_TRUTH_LABEL,
  POI_MINT_PREVIEW_TRUTH_LABEL,
  previewPoiMintDecision,
} from "./dual-token-poi-economy.js";

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

export const POI_MINT_RULE_SCHEMA = "bizra.dema.poi_mint_rule.v0.1";
export const POI_MINT_RULE_TRUTH_LABEL = "POI_MINT_RULE_PREVIEW_ONLY";

export function evaluatePoiMintRule({
  impactReceipt,
  requestedLiveMint = false,
  generatedAtIso = "",
} = {}) {
  const preview = previewPoiMintDecision({
    impactReceipt,
    requestedLiveMint,
    generatedAtIso,
  });

  return freezeDeep({
    schema: POI_MINT_RULE_SCHEMA,
    truth_label: POI_MINT_RULE_TRUTH_LABEL,
    preview_truth_label: POI_MINT_PREVIEW_TRUTH_LABEL,
    live_mint_truth_label: LIVE_TOKEN_MINT_TRUTH_LABEL,
    allowed_if_live: preview.mint_allowed_if_live,
    live_mint: false,
    bzc_mint_preview: preview.bzc_mint_preview,
    bzi_mint_preview: preview.bzi_mint_preview,
    blocked_reason: preview.blocked_reason,
    blocked_reasons: preview.blocked_reasons,
    receipt_hash: preview.receipt_hash,
    no_wallet: true,
    no_sale: true,
    boundary: preview.boundary,
  });
}
