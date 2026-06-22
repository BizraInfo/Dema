// LANGUAGE-PACK-1A — pure language-resolution kernel tests.
// Resolves a usable language pack (display label + script direction) from a
// profile's ISO-639-1 codes. Preview-only, pure: no network, model, or file
// read. Speculative fields (tone_profile, linguistic_package_id) are DEFERRED
// — they have no consumer yet, so they live in what_this_does_not_prove, not
// the schema.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  buildLanguagePack,
  DEMA_LANGUAGE_PACK_SCHEMA,
} from "../packages/core/src/language-pack.js";

const MODULE_PATH = fileURLToPath(
  new URL("../packages/core/src/language-pack.js", import.meta.url),
);

function assertDeepFrozen(value, label = "value") {
  assert.equal(Object.isFrozen(value), true, `${label} must be frozen`);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object") {
      assertDeepFrozen(child, `${label}.${key}`);
    }
  }
}

test("ar resolves to the Arabic label and rtl script direction", () => {
  const pack = buildLanguagePack({ language_code: "ar" });
  assert.equal(pack.status, "set");
  assert.equal(pack.primary.code, "ar");
  assert.equal(pack.primary.label, "العربية (Arabic)");
  assert.equal(pack.primary.script_direction, "rtl");
  assert.equal(pack.script_direction, "rtl");
});

test("en resolves to English and ltr", () => {
  const pack = buildLanguagePack({ language_code: "en" });
  assert.equal(pack.primary.label, "English");
  assert.equal(pack.primary.script_direction, "ltr");
  assert.equal(pack.script_direction, "ltr");
});

test("ur (Urdu) is rtl — the non-obvious case", () => {
  const pack = buildLanguagePack({ language_code: "ur" });
  assert.equal(pack.primary.script_direction, "rtl");
  assert.equal(pack.script_direction, "rtl");
});

test("a known-rtl code with no label entry (fa) is still rtl, labeled by code", () => {
  const pack = buildLanguagePack({ language_code: "fa" });
  assert.equal(pack.primary.script_direction, "rtl");
  assert.equal(pack.primary.label, "fa");
});

test("secondary language is resolved into the secondary array", () => {
  const pack = buildLanguagePack({
    language_code: "ar",
    secondary_language_code: "en",
  });
  assert.equal(pack.secondary.length, 1);
  assert.equal(pack.secondary[0].code, "en");
  assert.equal(pack.secondary[0].script_direction, "ltr");
});

test("absent language → status unset, primary null, ltr default, empty secondary", () => {
  const pack = buildLanguagePack({ language_code: null });
  assert.equal(pack.status, "unset");
  assert.equal(pack.primary, null);
  assert.deepEqual(pack.secondary, []);
  assert.equal(pack.script_direction, "ltr");
});

test("'other' resolves with a generic label and ltr (no script claim)", () => {
  const pack = buildLanguagePack({ language_code: "other" });
  assert.equal(pack.status, "set");
  assert.equal(pack.primary.code, "other");
  assert.equal(pack.primary.script_direction, "ltr");
});

test("a malformed code (not iso-639-1, not 'other') does not resolve", () => {
  const pack = buildLanguagePack({ language_code: "english" });
  assert.equal(pack.status, "unset");
  assert.equal(pack.primary, null);
});

test("boundary asserts no network, model invocation, or file content read", () => {
  const pack = buildLanguagePack({ language_code: "ar" });
  assert.equal(pack.boundary.network_used, false);
  assert.equal(pack.boundary.model_invoked, false);
  assert.equal(pack.boundary.file_content_read, false);
});

test("schema + truth_label are the exact canonical strings; deep-frozen", () => {
  const pack = buildLanguagePack({ language_code: "ar" });
  assert.equal(pack.schema, "bizra.dema.language_pack.v0.1");
  assert.equal(pack.schema, DEMA_LANGUAGE_PACK_SCHEMA);
  assert.equal(pack.truth_label, "DEMA_LANGUAGE_PACK_LOCAL_ONLY");
  assert.equal(pack.mode, "preview_only");
  assertDeepFrozen(pack, "pack");
});

test("deferred fields (tone_profile, linguistic_package_id) are honestly disclaimed, not shipped", () => {
  const pack = buildLanguagePack({ language_code: "ar" });
  assert.equal("tone_profile" in pack, false);
  assert.equal("linguistic_package_id" in pack, false);
  const disclaimer = pack.what_this_does_not_prove.join(" ");
  assert.match(disclaimer, /tone/i);
  assert.match(disclaimer, /linguistic|package/i);
  assert.match(disclaimer, /translat|model/i);
});

test("module imports no fs, fs/promises, net, child process, os, or http APIs", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(
    source,
    /from\s+["']node:(fs|fs\/promises|net|http|https|child_process|os)["']/,
  );
});
