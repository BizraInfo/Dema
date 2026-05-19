// Genesis Preview Card — pure builder + Law #11 invariants + refusal validator tests
//
// ADR-011 phase-3 compliance. All tests are against the pure synchronous builder
// and the refuseMintWithoutQuotedHash validator.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  buildGenesisPreviewCard,
  refuseMintWithoutQuotedHash,
  GENESIS_PREVIEW_CARD_SCHEMA,
  CONSENT_PHRASE_TEMPLATES,
} from "../packages/core/src/genesis-preview-card.js";

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

// ─── Helper ─────────────────────────────────────────────────────────────────

function sampleInput() {
  return {
    candidate: {
      node_ordinal: 1,
      preferred_name: "Mumu",
      primary_language: "en",
      secondary_language: "ar",
      device_label: "MSI Titan",
      model_readiness: "MODEL_UNKNOWN",
      technical_level: 2,
    },
    timestamp: "2026-05-19T10:00:00.000Z",
  };
}

// ─── Builder shape tests ─────────────────────────────────────────────────────

test("buildGenesisPreviewCard() (no args) returns full schema with defaults", () => {
  const card = buildGenesisPreviewCard();
  assert.equal(card.schema, GENESIS_PREVIEW_CARD_SCHEMA);
  assert.equal(card.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(card.mode, "preview_only");
  assert.equal(card.card_type, "onboarding_completion_genesis");
  assert.ok(card.would_mint_if_consented);
  assert.ok(card.blocked_until_typed_GO);
  assert.ok(card.card_storage);
  assert.ok(card.boundary);
});

test("Schema field equals bizra.dema.genesis_preview_card.v0.1", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  assert.equal(card.schema, "bizra.dema.genesis_preview_card.v0.1");
});

test("mode === 'preview_only' always — injection of 'active' is ignored", () => {
  const card = buildGenesisPreviewCard({ mode: "active" });
  assert.equal(card.mode, "preview_only");
});

test("truth_label === 'NODE0_LOCAL_SEED' always", () => {
  const card = buildGenesisPreviewCard({ truth_label: "INJECTED" });
  assert.equal(card.truth_label, "NODE0_LOCAL_SEED");
});

test("All 16 canonical boundary keys present and all === false", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(
      card.boundary[key],
      false,
      `boundary.${key} must be false`
    );
  }
  assert.equal(
    Object.keys(card.boundary).length,
    PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
    "boundary must have exactly the canonical key count"
  );
});

test("Boundary keys cannot be flipped via input", () => {
  const card = buildGenesisPreviewCard({
    boundary: { receipt_mint_performed: true, chain_advance_performed: true },
  });
  assert.equal(card.boundary.receipt_mint_performed, false);
  assert.equal(card.boundary.chain_advance_performed, false);
});

// ─── Determinism tests ───────────────────────────────────────────────────────

test("Same input + same timestamp → byte-identical output (JSON.stringify equal)", () => {
  const input = sampleInput();
  const a = buildGenesisPreviewCard(input);
  const b = buildGenesisPreviewCard(input);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("Same input + same timestamp → same receipt_id_preview hash", () => {
  const input = sampleInput();
  const a = buildGenesisPreviewCard(input);
  const b = buildGenesisPreviewCard(input);
  assert.equal(
    a.would_mint_if_consented.receipt_id_preview,
    b.would_mint_if_consented.receipt_id_preview
  );
});

test("Different preferred_name → different receipt_id_preview (hash is sensitive to identity)", () => {
  const base = sampleInput();
  const cardA = buildGenesisPreviewCard({ ...base, candidate: { ...base.candidate, preferred_name: "Alice" } });
  const cardB = buildGenesisPreviewCard({ ...base, candidate: { ...base.candidate, preferred_name: "Bob" } });
  assert.notEqual(
    cardA.would_mint_if_consented.receipt_id_preview,
    cardB.would_mint_if_consented.receipt_id_preview
  );
});

test("Different node_ordinal → different receipt_id_preview", () => {
  const base = sampleInput();
  const cardA = buildGenesisPreviewCard({ ...base, candidate: { ...base.candidate, node_ordinal: 0 } });
  const cardB = buildGenesisPreviewCard({ ...base, candidate: { ...base.candidate, node_ordinal: 2 } });
  assert.notEqual(
    cardA.would_mint_if_consented.receipt_id_preview,
    cardB.would_mint_if_consented.receipt_id_preview
  );
});

test("card_storage block excluded from hash: same candidate+timestamp yields same hash regardless of card_storage_path_hint", () => {
  const base = sampleInput();
  const cardA = buildGenesisPreviewCard({ ...base, card_storage_path_hint: "/path/a/card.json" });
  const cardB = buildGenesisPreviewCard({ ...base, card_storage_path_hint: "/path/b/card.json" });
  assert.equal(
    cardA.would_mint_if_consented.receipt_id_preview,
    cardB.would_mint_if_consented.receipt_id_preview,
    "card_storage_path_hint must not affect the hash"
  );
});

// ─── Law #11 invariants ──────────────────────────────────────────────────────

test("blocked_until_typed_GO cannot be cleared via input", () => {
  const card = buildGenesisPreviewCard({ blocked_until_typed_GO: [] });
  assert.ok(Array.isArray(card.blocked_until_typed_GO));
  assert.ok(card.blocked_until_typed_GO.length > 0);
});

test("blocked_until_typed_GO always includes 'actual_receipt_mint'", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  assert.ok(card.blocked_until_typed_GO.includes("actual_receipt_mint"));
});

test("blocked_until_typed_GO includes all 5 required entries", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  const required = [
    "actual_receipt_mint",
    "chain_advance_performed",
    "federation_handshake",
    "external_publication",
    "node_ordinal_increment",
  ];
  for (const entry of required) {
    assert.ok(
      card.blocked_until_typed_GO.includes(entry),
      `blocked_until_typed_GO must include '${entry}'`
    );
  }
});

test("boundary.receipt_mint_performed === false always", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  assert.equal(card.boundary.receipt_mint_performed, false);
});

test("boundary.chain_advance_performed === false always", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  assert.equal(card.boundary.chain_advance_performed, false);
});

test("boundary.federation_invoked === false always", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  assert.equal(card.boundary.federation_invoked, false);
});

test("Output is deep-frozen (mutation rejected in strict mode)", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  assert.equal(Object.isFrozen(card), true);
  assert.equal(Object.isFrozen(card.candidate), true);
  assert.equal(Object.isFrozen(card.would_mint_if_consented), true);
  assert.equal(Object.isFrozen(card.boundary), true);
  assert.throws(() => {
    "use strict";
    card.mode = "active";
  });
  assert.throws(() => {
    "use strict";
    card.boundary.receipt_mint_performed = true;
  });
});

// ─── Consent phrase templates ────────────────────────────────────────────────

test("CONSENT_PHRASE_TEMPLATES contains en, ar, fr, es at minimum", () => {
  for (const lang of ["en", "ar", "fr", "es"]) {
    assert.ok(lang in CONSENT_PHRASE_TEMPLATES, `${lang} must be in CONSENT_PHRASE_TEMPLATES`);
    assert.ok(typeof CONSENT_PHRASE_TEMPLATES[lang].template === "string");
    assert.ok(typeof CONSENT_PHRASE_TEMPLATES[lang].truth_label === "string");
  }
});

test("English phrase is the canonical reference (starts with 'GO:')", () => {
  assert.ok(CONSENT_PHRASE_TEMPLATES.en.template.startsWith("GO:"));
  assert.equal(CONSENT_PHRASE_TEMPLATES.en.truth_label, "DECLARED");
});

test("Arabic phrase is marked DECLARED_NEEDS_NATIVE_REVIEW", () => {
  assert.equal(CONSENT_PHRASE_TEMPLATES.ar.truth_label, "DECLARED_NEEDS_NATIVE_REVIEW");
});

test("Each phrase template contains {receipt_id_preview} placeholder", () => {
  for (const [lang, entry] of Object.entries(CONSENT_PHRASE_TEMPLATES)) {
    assert.ok(
      entry.template.includes("{receipt_id_preview}"),
      `${lang} template must contain {receipt_id_preview} placeholder`
    );
  }
});

test("consent_phrase_required embeds the actual receipt_id_preview hash", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  const hash = card.would_mint_if_consented.receipt_id_preview;
  assert.ok(
    card.would_mint_if_consented.consent_phrase_required.includes(hash),
    "consent_phrase_required must embed the receipt_id_preview hash"
  );
});

test("consent_phrase_secondary is null when no secondary_language", () => {
  const card = buildGenesisPreviewCard({
    candidate: { primary_language: "en", secondary_language: null },
    timestamp: "2026-05-19T00:00:00.000Z",
  });
  assert.equal(card.would_mint_if_consented.consent_phrase_secondary, null);
});

test("consent_phrase_secondary is populated when secondary_language is set", () => {
  const card = buildGenesisPreviewCard(sampleInput()); // secondary = "ar"
  assert.notEqual(card.would_mint_if_consented.consent_phrase_secondary, null);
  const hash = card.would_mint_if_consented.receipt_id_preview;
  assert.ok(card.would_mint_if_consented.consent_phrase_secondary.includes(hash));
});

// ─── refuseMintWithoutQuotedHash validator ───────────────────────────────────

test("Phrase with correct hash → accepted: true", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  const hash = card.would_mint_if_consented.receipt_id_preview;
  const phrase = card.would_mint_if_consented.consent_phrase_required;
  const result = refuseMintWithoutQuotedHash({
    typedPhrase: phrase,
    expectedReceiptIdPreview: hash,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, null);
  assert.equal(result.expected_hash, hash);
});

test("Phrase missing hash → accepted: false, reason includes 'receipt_id_preview'", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  const hash = card.would_mint_if_consented.receipt_id_preview;
  const result = refuseMintWithoutQuotedHash({
    typedPhrase: "GO: mint node-onboarding-genesis receipt for card WRONG",
    expectedReceiptIdPreview: hash,
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reason.includes("receipt_id_preview"));
});

test("Phrase with wrong-length hash-like string → rejected", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  const hash = card.would_mint_if_consented.receipt_id_preview;
  const shortHash = hash.slice(0, 32); // only 32 hex chars
  const result = refuseMintWithoutQuotedHash({
    typedPhrase: `GO: mint node-onboarding-genesis receipt for card ${shortHash}`,
    expectedReceiptIdPreview: hash,
  });
  assert.equal(result.accepted, false);
});

test("Phrase quoting hash of DIFFERENT card → rejected", () => {
  const cardA = buildGenesisPreviewCard(sampleInput());
  const cardB = buildGenesisPreviewCard({
    ...sampleInput(),
    candidate: { ...sampleInput().candidate, preferred_name: "Other" },
  });
  const hashA = cardA.would_mint_if_consented.receipt_id_preview;
  const hashB = cardB.would_mint_if_consented.receipt_id_preview;
  const phraseB = cardB.would_mint_if_consented.consent_phrase_required;
  const result = refuseMintWithoutQuotedHash({
    typedPhrase: phraseB,
    expectedReceiptIdPreview: hashA,
  });
  assert.equal(result.accepted, false, "phrase for card B must not satisfy card A's hash");
  assert.notEqual(hashA, hashB);
});

test("Empty phrase → rejected gracefully", () => {
  const result = refuseMintWithoutQuotedHash({
    typedPhrase: "",
    expectedReceiptIdPreview: "a".repeat(64),
  });
  assert.equal(result.accepted, false);
  assert.equal(result.found_hash_in_phrase, null);
});

test("Phrase with hash buried inside larger text → accepted (hash-substring match)", () => {
  const card = buildGenesisPreviewCard(sampleInput());
  const hash = card.would_mint_if_consented.receipt_id_preview;
  const result = refuseMintWithoutQuotedHash({
    typedPhrase: `Some prefix text ${hash} some suffix text`,
    expectedReceiptIdPreview: hash,
  });
  assert.equal(result.accepted, true);
});

// ─── Adversarial ─────────────────────────────────────────────────────────────

test("ADVERSARIAL: prototype pollution via __proto__ input does not leak", () => {
  const polluted = {};
  Object.setPrototypeOf(polluted, { evil: "INJECTED" });
  polluted.candidate = { preferred_name: "Test" };
  const card = buildGenesisPreviewCard(polluted);
  assert.equal("evil" in card, false);
  assert.equal("evil" in card.candidate, false);
});

test("ADVERSARIAL: very long preferred_name (10kb) is capped at 500 chars", () => {
  const card = buildGenesisPreviewCard({
    candidate: { preferred_name: "x".repeat(10000) },
    timestamp: "2026-05-19T00:00:00.000Z",
  });
  assert.equal(card.candidate.preferred_name.length, 500);
});

test("ADVERSARIAL: unicode in preferred_name flows through correctly into hash", () => {
  const unicodeName = "مُحَمَّد بِسْمِ اللَّهِ";
  const card = buildGenesisPreviewCard({
    candidate: { preferred_name: unicodeName },
    timestamp: "2026-05-19T00:00:00.000Z",
  });
  assert.equal(card.candidate.preferred_name, unicodeName);
  // Hash must be non-empty and 64 hex chars
  assert.match(
    card.would_mint_if_consented.receipt_id_preview,
    /^[0-9a-f]{64}$/
  );
});
