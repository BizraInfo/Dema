import test from "node:test";
import assert from "node:assert/strict";

import {
  verifyFrontDoorHtml,
  buildFrontDoorContractPayload,
  demaFirstLightFrontDoorPreviewBoundary,
  FRONT_DOOR_REQUIRED_MARKERS,
  DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_SCHEMA,
  DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_TRUTH_LABEL,
} from "../packages/core/src/dema-first-light-front-door-preview.js";
import { runDemaFirstLightFrontDoorPreviewCheck } from "../scripts/review/dema-first-light-front-door-preview-check.mjs";

const MARKERS = FRONT_DOOR_REQUIRED_MARKERS.join(" · ");
const AGENT_GATE = " const b = agent?'disabled title=\"requires local dema agent\"':''; ";
const LOCAL_FETCH = " await fetch('http://127.0.0.1:11434/api/tags') ";
const NO_ARABIC_BASE = `${MARKERS}${AGENT_GATE}${LOCAL_FETCH}`;
const GOOD = `${NO_ARABIC_BASE} مرحبا بابك `;

test("the shipped front-door HTML conforms to the contract", () => {
  const r = runDemaFirstLightFrontDoorPreviewCheck();
  assert.equal(r.ok, true, r.blocked_by.join(", "));
  assert.equal(r.schema, DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_SCHEMA);
  assert.equal(r.truth_label, DEMA_FIRST_LIGHT_FRONT_DOOR_PREVIEW_TRUTH_LABEL);
  assert.equal(r.boundary.execution_allowed, false);
  assert.equal(r.boundary.token_minted, false);
});

test("a well-formed fixture passes; the localhost probe is allowed", () => {
  const r = verifyFrontDoorHtml(GOOD);
  assert.equal(r.ok, true, r.blocked_by.join(", "));
});

test("html_missing when empty", () => {
  const r = verifyFrontDoorHtml("");
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("html_missing"));
});

test("fails on any missing disclaimer/marker", () => {
  for (const m of ["PREVIEW ONLY", "NO MINT", "NO FEDERATION", "SIMULATED", "Node Bond Preview"]) {
    const r = verifyFrontDoorHtml(GOOD.replace(m, "REDACTED"));
    assert.equal(r.ok, false, `expected fail when ${m} removed`);
    assert.ok(r.blocked_by.includes(`missing_marker:${m}`), `expected missing_marker:${m}`);
  }
});

test("fails closed on an external asset request", () => {
  const r = verifyFrontDoorHtml(`${GOOD}<img src="https://cdn.evil.com/x.png">`);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("forbidden:external_src_request"));
});

test("fails closed on a CDN / google-fonts host", () => {
  const r = verifyFrontDoorHtml(`${GOOD}<link rel=preconnect href=fonts.googleapis.com>`);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("forbidden:cdn_or_font_host"));
});

test("fails closed on a fetch to a non-localhost host", () => {
  const r = verifyFrontDoorHtml(`${GOOD} fetch('https://api.evil.com/track') `);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("forbidden:fetch_non_localhost"));
});

test("fails closed on a URP labeled ACTIVE", () => {
  const r = verifyFrontDoorHtml(`${GOOD} ['URP share','ACTIVE'] `);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("forbidden:urp_labeled_active"));
});

test("fails closed on a live mint or live federation claim", () => {
  assert.ok(verifyFrontDoorHtml(`${GOOD} receipt minted `).blocked_by.includes("forbidden:mint_claim"));
  assert.ok(verifyFrontDoorHtml(`${GOOD} federation is live `).blocked_by.includes("forbidden:federation_live_claim"));
});

test("negations (NO MINT / NO FEDERATION / DESIGNED — NOT LIVE) do NOT false-positive", () => {
  const r = verifyFrontDoorHtml(GOOD);
  assert.ok(!r.blocked_by.some((c) => c.startsWith("forbidden:")), r.blocked_by.join(", "));
});

test("fails closed when Arabic entry is absent", () => {
  const r = verifyFrontDoorHtml(NO_ARABIC_BASE);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("missing_arabic_entry"));
});

test("fails closed when apps/data toggles are not agent-gated", () => {
  const r = verifyFrontDoorHtml(GOOD.replace(AGENT_GATE, " "));
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("apps_data_toggles_not_agent_gated"));
});

test("contract payload is content-addressed with an all-false boundary", () => {
  const p = buildFrontDoorContractPayload();
  assert.match(p.content_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(p.authority_delta, 0);
  assert.equal(p.permitted_network_target, "127.0.0.1");
  const b = demaFirstLightFrontDoorPreviewBoundary();
  assert.ok(Object.values(b).every((v) => v === false));
});
