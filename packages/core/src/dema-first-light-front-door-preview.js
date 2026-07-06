// DEMA-FIRST-LIGHT-GUI-FRONT-DOOR-PREVIEW-1A — the front-door CONTRACT + an HTML conformance verifier.
//
// The kernel is the source of truth; `apps/front-door/index.html` RENDERS this contract. There is no
// GUI shadow truth: the review gate verifies the shipped HTML against the contract below. The front
// door is a static, self-contained preview — PREVIEW_ONLY, boundary all-false. It makes zero external
// requests (the only permitted fetch is an opt-in, button-triggered probe of 127.0.0.1), mints nothing,
// federates nothing, activates no URP, runs no daemon, and performs no app/file scan.

import { createHash } from "node:crypto";

export const DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_SCHEMA = "bizra.dema.first_light_front_door_preview.v0.1";
export const DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_TRUTH_LABEL = "DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_ONLY";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// All-false boundary — a preview surface has no execution authority.
export function demaFirstLightFrontDoorPreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// The declared contract the HTML must satisfy. Every required marker must be present; every forbidden
// pattern must be absent. The one permitted network target is 127.0.0.1 (opt-in localhost probe).
export const FRONT_DOOR_REQUIRED_MARKERS = Object.freeze([
  "PREVIEW ONLY", // global preview banner
  "NO MINT",
  "NO FEDERATION",
  "127.0.0.1", // opt-in localhost probe
  "NOT LIVE", // DESIGNED — NOT LIVE labels (URP etc.)
  "MEASURED", // evidence chips
  "SIMULATED", // sample data labeled
  "Audit this door", // self-audit modal
  "Node Bond Preview", // renamed bond (not "Bonded Contract")
  "Bond fingerprint preview", // renamed receipt (not "Bond receipt")
  "requires the local dema agent", // apps/data need a local agent, not this page
]);

// Affirmative overclaims a preview front door must never make. Negations ("NO MINT",
// "DESIGNED — NOT LIVE", "nothing is transmitted") deliberately do not match these.
export const FRONT_DOOR_FORBIDDEN_PATTERNS = Object.freeze([
  [/src\s*=\s*["']https?:\/\//i, "external_src_request"],
  [/href\s*=\s*["']https?:\/\/[^"']*\.(?:css|js|woff2?|ttf)/i, "external_asset_link"],
  [/@import\s+(?:url\()?["']?https?:/i, "css_import_external"],
  [/googleapis|gstatic|cdnjs|unpkg|jsdelivr|fonts\.google/i, "cdn_or_font_host"],
  [/<script[^>]+src\s*=\s*["']https?:/i, "external_script"],
  [/\b(?:google-analytics|gtag|mixpanel|segment|sentry|beacon\()/i, "analytics_or_beacon"],
  [/fetch\(\s*["']https?:\/\/(?!127\.0\.0\.1)/i, "fetch_non_localhost"],
  [/\bURP\b[^'"\n]{0,40}['"]\s*,\s*['"]\s*ACTIVE/i, "urp_labeled_active"],
  [/receipt\s+minted|token\s+minted|minting\s+(?:is\s+)?live|mint\s+enabled/i, "mint_claim"],
  [/federation\s+(?:is\s+)?live|live\s+federation/i, "federation_live_claim"],
]);

const ARABIC_RANGE = /[؀-ۿ]/;

// Pure conformance check over an HTML string — no fs, injectable for tests.
export function verifyFrontDoorHtml(html) {
  const blocked_by = [];
  if (typeof html !== "string" || html.length === 0) {
    return Object.freeze({
      ok: false,
      schema: DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_SCHEMA,
      truth_label: DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_TRUTH_LABEL,
      boundary: demaFirstLightFrontDoorPreviewBoundary(),
      blocked_by: Object.freeze(["html_missing"]),
    });
  }
  for (const marker of FRONT_DOOR_REQUIRED_MARKERS) {
    if (!html.includes(marker)) blocked_by.push(`missing_marker:${marker}`);
  }
  for (const [re, label] of FRONT_DOOR_FORBIDDEN_PATTERNS) {
    if (re.test(html)) blocked_by.push(`forbidden:${label}`);
  }
  if (!ARABIC_RANGE.test(html)) blocked_by.push("missing_arabic_entry");
  // apps/data consent toggles must be agent-gated (disabled unless a local agent exists).
  if (!/agent\s*\?\s*'disabled/.test(html)) blocked_by.push("apps_data_toggles_not_agent_gated");

  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_SCHEMA,
    truth_label: DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_TRUTH_LABEL,
    docs_and_static_only: true,
    boundary: demaFirstLightFrontDoorPreviewBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}

// Content-addressed declaration of the contract (what the HTML must render).
export function buildFrontDoorContractPayload() {
  const body = {
    schema: DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_SCHEMA,
    truth_label: DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_TRUTH_LABEL,
    required_markers: [...FRONT_DOOR_REQUIRED_MARKERS],
    forbidden: FRONT_DOOR_FORBIDDEN_PATTERNS.map(([, label]) => label),
    designed_not_live_surfaces: ["urp_share", "apps_scan", "data_scan", "daemon_runtime", "receipt_mint"],
    permitted_network_target: "127.0.0.1",
    authority_delta: 0,
    boundary: demaFirstLightFrontDoorPreviewBoundary(),
  };
  const content_hash = `sha256:${sha256(JSON.stringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}
