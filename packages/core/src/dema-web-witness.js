// DEMA-WEB-WITNESS-1A — browser use the Dema way.
//
// NOT autonomous browsing. NOT a crawler. NOT a scraper pipeline. This kernel
// turns ONE consented, credential-free GET observation into a content-addressed
// WITNESS: what page was fetched, what bytes came back (by hash), what was
// visibly there (bounded excerpt), and exactly which boundary was exercised.
// Two witnesses of the same page diff into an honest drift verdict.
//
// WHY THIS EXISTS. Users judge an AI node by what it can see and do. Dema's
// computer-use story already executes with proven undo (steward 1B/1C); its
// web story was absent. The estate answer is not a headless browser with
// invisible authority — it is an observation that carries its own proof.
//
// PURITY. No fetch, no fs, no clock, no env in this kernel. The gatherer
// (apps/cli/src/web-witness-gatherer.js) owns the single GET and injects the
// observation; consent is an exact string checked here, fail-closed.

import { createHash } from "node:crypto";

export const DEMA_WEB_WITNESS_SCHEMA = "bizra.dema.web_witness.v0.1";
export const DEMA_WEB_WITNESS_TRUTH_LABEL = "WEB_WITNESS_OBSERVED";
export const DEMA_WEB_WITNESS_GO_PHRASE =
  "GO: dema web witness one page read-only";

export const WEB_WITNESS_TEXT_EXCERPT_MAX_CHARS = 2000;
export const WEB_WITNESS_MAX_LINKS = 32;

const SHA256_HEX = /^[0-9a-f]{64}$/;

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}

function sha256Hex(text) {
  return createHash("sha256").update(text).digest("hex");
}

/// A URL is witnessable only when it is plain http(s) with no embedded
/// credentials. Anything else refuses — a witness must never be the vehicle
/// that smuggles a secret into a receipt or reaches a non-web scheme.
function witnessableUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (parsed.username || parsed.password) return false;
  return true;
}

const EXECUTED_BOUNDARY = Object.freeze({
  network_used: true,
  method_get_only: true,
  credentials_included: false,
  cookies_sent: false,
  scripts_executed: false,
  filesystem_write_performed: false,
  runtime_execution_performed: false,
  raw_body_retained: false,
});

function witnessBody(w) {
  const { witness_hash, ...body } = w;
  return body;
}

/**
 * Pure. Turns one gathered observation into a content-addressed witness.
 * Refuses without the exact consent phrase; refuses non-witnessable URLs.
 */
export function buildWebWitness({ consent, observation } = {}) {
  if (consent !== DEMA_WEB_WITNESS_GO_PHRASE) {
    return Object.freeze({ ok: false, reason: "consent_exact_string_mismatch" });
  }
  const o = observation ?? {};
  if (!witnessableUrl(o.request_url) || !witnessableUrl(o.final_url)) {
    return Object.freeze({ ok: false, reason: "url_not_witnessable" });
  }
  if (o.body_sha256 !== null && !SHA256_HEX.test(o.body_sha256 ?? "")) {
    return Object.freeze({ ok: false, reason: "body_hash_malformed" });
  }

  const rawExcerpt = typeof o.text_excerpt === "string" ? o.text_excerpt : null;
  const excerpt =
    rawExcerpt === null
      ? null
      : rawExcerpt.slice(0, WEB_WITNESS_TEXT_EXCERPT_MAX_CHARS);
  const rawLinks = Array.isArray(o.links) ? o.links.filter((l) => typeof l === "string") : [];
  const links = rawLinks.slice(0, WEB_WITNESS_MAX_LINKS);
  const linkTotal = Number.isInteger(o.link_count_total)
    ? o.link_count_total
    : rawLinks.length;

  const witness = {
    schema: DEMA_WEB_WITNESS_SCHEMA,
    truth_label: DEMA_WEB_WITNESS_TRUTH_LABEL,
    request_url: o.request_url,
    final_url: o.final_url,
    redirected: o.redirected === true,
    fetched_at_iso: typeof o.fetched_at_iso === "string" ? o.fetched_at_iso : null,
    status: Number.isInteger(o.status) ? o.status : null,
    content_type: typeof o.content_type === "string" ? o.content_type : null,
    body_sha256: o.body_sha256 ?? null,
    body_byte_length: Number.isInteger(o.body_byte_length)
      ? o.body_byte_length
      : null,
    body_overflow: o.body_overflow === true,
    title: typeof o.title === "string" ? o.title : null,
    text_excerpt: excerpt,
    text_excerpt_truncated:
      excerpt !== null && rawExcerpt.length > excerpt.length,
    text_excerpt_sha256: excerpt === null ? null : sha256Hex(excerpt),
    links: Object.freeze(links),
    link_count_total: linkTotal,
    what_this_proves:
      "One credential-free GET of this URL at this moment returned bytes with exactly this hash, status, and visible surface.",
    what_this_does_not_prove:
      "It does not prove the page's claims are true, that the server is who it appears to be, that the content persists, or anything about pages not fetched. Scripts were not executed, so dynamic content is unseen.",
    boundary: EXECUTED_BOUNDARY,
  };
  witness.witness_hash = sha256Hex(stableStringify(witnessBody(witness)));
  return Object.freeze({ ok: true, witness: deepFreeze(witness) });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

/// Re-derives the witness hash from the witness's own body and checks the
/// declared boundary — a hand-edited witness cannot pass as an observation.
export function verifyWebWitness(witness) {
  if (!witness || typeof witness !== "object") {
    return Object.freeze({ ok: false, reason: "witness_missing" });
  }
  if (witness.schema !== DEMA_WEB_WITNESS_SCHEMA) {
    return Object.freeze({ ok: false, reason: "schema_mismatch" });
  }
  const expected = sha256Hex(stableStringify(witnessBody({ ...witness })));
  if (witness.witness_hash !== expected) {
    return Object.freeze({ ok: false, reason: "witness_hash_mismatch" });
  }
  const b = witness.boundary ?? {};
  for (const [key, want] of Object.entries(EXECUTED_BOUNDARY)) {
    if (b[key] !== want) {
      return Object.freeze({ ok: false, reason: "boundary_shape_mismatch" });
    }
  }
  if (Object.keys(b).length !== Object.keys(EXECUTED_BOUNDARY).length) {
    return Object.freeze({ ok: false, reason: "boundary_shape_mismatch" });
  }
  if (
    witness.text_excerpt !== null &&
    witness.text_excerpt.length > WEB_WITNESS_TEXT_EXCERPT_MAX_CHARS
  ) {
    return Object.freeze({ ok: false, reason: "text_excerpt_over_bound" });
  }
  if (witness.links.length > WEB_WITNESS_MAX_LINKS) {
    return Object.freeze({ ok: false, reason: "links_over_bound" });
  }
  return Object.freeze({ ok: true });
}

/// Honest drift between two witnesses of (usually) the same page. Both inputs
/// must re-verify first — a diff over a forged witness would report fiction.
export function diffWebWitness(earlier, later) {
  if (!verifyWebWitness(earlier).ok) {
    return Object.freeze({ ok: false, reason: "earlier_witness_invalid" });
  }
  if (!verifyWebWitness(later).ok) {
    return Object.freeze({ ok: false, reason: "later_witness_invalid" });
  }
  return Object.freeze({
    ok: true,
    same_url: earlier.final_url === later.final_url,
    same_body: earlier.body_sha256 === later.body_sha256,
    status_changed: earlier.status !== later.status,
    earlier_fetched_at: earlier.fetched_at_iso,
    later_fetched_at: later.fetched_at_iso,
    earlier_body_sha256: earlier.body_sha256,
    later_body_sha256: later.body_sha256,
    byte_length_delta:
      Number.isInteger(earlier.body_byte_length) &&
      Number.isInteger(later.body_byte_length)
        ? later.body_byte_length - earlier.body_byte_length
        : null,
  });
}
