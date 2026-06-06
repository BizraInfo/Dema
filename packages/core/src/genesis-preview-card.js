// Genesis Preview Card — ADR-011 Phase 3
//
// Pure deterministic builder. No I/O. No process.env. No Date. No Math.random().
// Timestamp is injected by the caller. Deep-frozen output.
//
// Laws enforced structurally:
//   Law #11 → Genesis Preview Card emits BEFORE any mint; mode === "preview_only" always;
//             all 16 boundary keys false; blocked_until_typed_GO cannot be cleared.
//
// The card is NOT a receipt. It is stored under ~/.dema/state/, never ~/.dema/receipts/.
// The mint_destination listed inside is the FUTURE path; phase-3 does not write there.

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const GENESIS_PREVIEW_CARD_SCHEMA =
  "bizra.dema.genesis_preview_card.v0.1";

// Deterministic placeholder used when no timestamp is injected (test environments).
const DETERMINISTIC_TIMESTAMP_PLACEHOLDER = "1970-01-01T00:00:00.000Z";

const VALID_MODEL_READINESS = new Set([
  "MODEL_UNKNOWN",
  "MODEL_LESS_DECLARED",
  "MODEL_INVENTORY_PENDING_CONSENT",
  "MODEL_INVENTORY_DECLARED",
  "MODEL_AVAILABLE",
]);

// Consent phrase templates keyed by ISO 639-1 code.
// truth_label per ADR-011 authoring guidance:
//   DECLARED                     — authored with high confidence
//   DECLARED_NEEDS_NATIVE_REVIEW — structure sound; cultural-fluency review downstream
export const CONSENT_PHRASE_TEMPLATES = Object.freeze({
  en: Object.freeze({
    truth_label: "DECLARED",
    template:
      "GO: mint node-onboarding-genesis receipt for card {receipt_id_preview}",
  }),
  ar: Object.freeze({
    truth_label: "DECLARED_NEEDS_NATIVE_REVIEW",
    template: "تنفيذ: سك إيصال بداية الانضمام للبطاقة {receipt_id_preview}",
  }),
  fr: Object.freeze({
    truth_label: "DECLARED",
    template:
      "GO: créer le reçu d'inscription pour la carte {receipt_id_preview}",
  }),
  es: Object.freeze({
    truth_label: "DECLARED",
    template:
      "GO: crear el recibo de incorporación para la tarjeta {receipt_id_preview}",
  }),
});

function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "object" && val !== null && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

function sanitizeLanguageCode(code) {
  if (typeof code !== "string") return null;
  if (/^[a-z]{2}$/.test(code)) return code;
  return null;
}

function sanitizeName(val) {
  if (typeof val !== "string" || val.length === 0) return null;
  // Cap at 500 chars to guard against payload stuffing
  return val.slice(0, 500);
}

function renderConsentPhrase(template, receiptIdPreview) {
  return template.replace("{receipt_id_preview}", receiptIdPreview);
}

function computeReceiptIdPreview(canonicalPayload) {
  // Canonical payload MUST NOT include the card_storage block.
  // sha256 of the deterministic JSON serialization (sorted keys).
  const serialized = JSON.stringify(canonicalPayload);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

function buildCanonicalHashPayload(normalizedCandidate) {
  // Deterministic field ordering. card_storage and rendered_at are excluded by design.
  // timestamp is NOT included: the hash must bind to candidate identity, not render time,
  // so that a candidate can quote receipt_id_preview from any render of the same state.
  return {
    schema: GENESIS_PREVIEW_CARD_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    card_type: "onboarding_completion_genesis",
    candidate: normalizedCandidate,
    would_mint_receipt_type: "node_onboarding_genesis.v0.1",
  };
}

export function buildGenesisPreviewCard(input = {}) {
  // Defensive copy — never trust prototype or caller mutation
  const raw = Object.assign({}, input);
  const candidateRaw = Object.assign({}, raw.candidate ?? {});

  const nodeOrdinal =
    typeof candidateRaw.node_ordinal === "number" &&
    Number.isInteger(candidateRaw.node_ordinal) &&
    candidateRaw.node_ordinal >= 0
      ? candidateRaw.node_ordinal
      : 0;

  const preferredName = sanitizeName(candidateRaw.preferred_name);
  const primaryLanguage = sanitizeLanguageCode(candidateRaw.primary_language);
  const secondaryLanguage = sanitizeLanguageCode(
    candidateRaw.secondary_language,
  );
  const deviceLabel = sanitizeName(candidateRaw.device_label);

  const modelReadiness =
    typeof candidateRaw.model_readiness === "string" &&
    VALID_MODEL_READINESS.has(candidateRaw.model_readiness)
      ? candidateRaw.model_readiness
      : "MODEL_UNKNOWN";

  const technicalLevel =
    typeof candidateRaw.technical_level === "number" &&
    Number.isInteger(candidateRaw.technical_level) &&
    candidateRaw.technical_level >= 0 &&
    candidateRaw.technical_level <= 3
      ? candidateRaw.technical_level
      : null;

  const normalizedCandidate = {
    node_ordinal: nodeOrdinal,
    preferred_name: preferredName ?? "operator",
    primary_language: primaryLanguage,
    secondary_language: secondaryLanguage,
    device_label: deviceLabel,
    model_readiness: modelReadiness,
    technical_level: technicalLevel,
  };

  const timestamp =
    typeof raw.timestamp === "string" && raw.timestamp.length > 0
      ? raw.timestamp
      : DETERMINISTIC_TIMESTAMP_PLACEHOLDER;

  // Compute receipt_id_preview from canonical payload (card_storage and rendered_at excluded)
  const hashPayload = buildCanonicalHashPayload(normalizedCandidate);
  const receiptIdPreview = computeReceiptIdPreview(hashPayload);

  // Render consent phrases
  const primaryLang = primaryLanguage ?? "en";
  const primaryTemplate =
    CONSENT_PHRASE_TEMPLATES[primaryLang] ?? CONSENT_PHRASE_TEMPLATES.en;
  const consentPhraseRequired = renderConsentPhrase(
    primaryTemplate.template,
    receiptIdPreview,
  );

  let consentPhraseSecondary = null;
  if (secondaryLanguage !== null) {
    const secondaryTemplate =
      CONSENT_PHRASE_TEMPLATES[secondaryLanguage] ??
      CONSENT_PHRASE_TEMPLATES.en;
    consentPhraseSecondary = renderConsentPhrase(
      secondaryTemplate.template,
      receiptIdPreview,
    );
  }

  // card_storage path
  const cardStoragePathHint =
    typeof raw.card_storage_path_hint === "string"
      ? raw.card_storage_path_hint
      : null;

  const cardStoragePath =
    cardStoragePathHint ?? `~/.dema/state/genesis-preview-${timestamp}.json`;

  const card = {
    schema: GENESIS_PREVIEW_CARD_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED", // structurally constant — Law #11
    mode: "preview_only", // structurally constant — Law #11
    card_type: "onboarding_completion_genesis",
    rendered_at: timestamp, // render metadata — excluded from hash payload
    candidate: normalizedCandidate,
    would_mint_if_consented: {
      receipt_type: "node_onboarding_genesis.v0.1",
      receipt_id_preview: receiptIdPreview,
      consent_phrase_required: consentPhraseRequired,
      consent_phrase_secondary: consentPhraseSecondary,
      mint_destination: `~/.dema/receipts/node-onboarding-genesis-${receiptIdPreview}.json`,
    },
    // Structural list — cannot be cleared by caller input (Law #11)
    blocked_until_typed_GO: Object.freeze([
      "actual_receipt_mint",
      "chain_advance_performed",
      "federation_handshake",
      "external_publication",
      "node_ordinal_increment",
    ]),
    card_storage: {
      path: cardStoragePath,
      store_scope: "local_preview_only",
      expires_after: "session_end_or_24h",
      purpose:
        "auditable record that the candidate SAW this exact preview before any mint",
    },
    boundary: buildPreviewBoundary(), // canonical 16-key · ALL false · Law #11
  };

  return deepFreeze(card);
}

// Pure validator — checks whether typedPhrase contains the expected hash literally.
// Hash comparison is case-sensitive: SHA-256 hex is lowercase; the canonical phrase
// embeds it as lowercase hex. Accepting case-insensitive variants would expand the
// attack surface and contradict ADR-005 exact-string consent.
export function refuseMintWithoutQuotedHash({
  typedPhrase,
  expectedReceiptIdPreview,
}) {
  if (typeof typedPhrase !== "string" || typedPhrase.trim().length === 0) {
    return Object.freeze({
      accepted: false,
      reason: "phrase is empty or not a string",
      expected_hash: expectedReceiptIdPreview ?? null,
      found_hash_in_phrase: null,
    });
  }

  // Look for any 64-char lowercase hex string in the phrase (diagnostic only)
  const foundHashMatch = typedPhrase.match(/[0-9a-f]{64}/);
  const foundHash = foundHashMatch ? foundHashMatch[0] : null;

  if (
    typeof expectedReceiptIdPreview !== "string" ||
    expectedReceiptIdPreview.length !== 64
  ) {
    return Object.freeze({
      accepted: false,
      reason: "expectedReceiptIdPreview is not a valid sha256 hex string",
      expected_hash: expectedReceiptIdPreview ?? null,
      found_hash_in_phrase: foundHash,
    });
  }

  if (!typedPhrase.includes(expectedReceiptIdPreview)) {
    return Object.freeze({
      accepted: false,
      reason: "phrase does not quote receipt_id_preview hash",
      expected_hash: expectedReceiptIdPreview,
      found_hash_in_phrase: foundHash,
    });
  }

  return Object.freeze({
    accepted: true,
    reason: null,
    expected_hash: expectedReceiptIdPreview,
    found_hash_in_phrase: expectedReceiptIdPreview,
  });
}
