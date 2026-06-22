// LANGUAGE-PACK-1A — PURE language-resolution kernel.
//
// Resolves a usable language pack — display label + script direction — from a
// profile's ISO-639-1 codes. It is the emotional handshake: Dema must know HOW
// to address the operator (right-to-left for Arabic/Urdu, the operator's own
// language) before it speaks. Preview-only and pure: it reads nothing from
// disk, invokes no model, performs no translation. The metadata table lives
// here (not imported from homebase-language-picker.js) so this kernel does NOT
// transitively pull operator-profile.js's filesystem surface — keeping it clean
// under scripts/review/kernel-purity-check.mjs.
//
// Deferred (speculative, no live consumer): tone_profile and
// linguistic_package_id from the LANGUAGE-PACK spec are NOT in this schema —
// shipping unused fields is felt progress, not real. They are disclaimed in
// what_this_does_not_prove and will land when a consumer exists.

import { buildPreviewBoundary } from "./preview-boundary.js";

export const DEMA_LANGUAGE_PACK_SCHEMA = "bizra.dema.language_pack.v0.1";

const TRUTH_LABEL = "DEMA_LANGUAGE_PACK_LOCAL_ONLY";

// Mirrors homebase-language-picker.js LANGUAGE_OPTIONS labels, adding script
// direction. Frozen so it cannot be mutated by a caller.
const LANGUAGE_META = Object.freeze({
  ar: Object.freeze({ label: "العربية (Arabic)", script_direction: "rtl" }),
  en: Object.freeze({ label: "English", script_direction: "ltr" }),
  fr: Object.freeze({ label: "Français (French)", script_direction: "ltr" }),
  es: Object.freeze({ label: "Español (Spanish)", script_direction: "ltr" }),
  ur: Object.freeze({ label: "اردو (Urdu)", script_direction: "rtl" }),
  hi: Object.freeze({ label: "हिन्दी (Hindi)", script_direction: "ltr" }),
});

// ISO-639-1 codes written right-to-left — covers rtl languages that have no
// label entry yet, so script direction is correct even before the label is.
const RTL_CODES = Object.freeze(
  new Set(["ar", "fa", "he", "ur", "ps", "sd", "ug", "yi", "dv", "ckb", "ku"]),
);

const WHAT_THIS_PROVES = Object.freeze([
  "A usable language pack (display label + script direction) is resolved locally from the profile's ISO-639-1 codes, with no side effects.",
]);

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "A tone_profile or persona was applied (deferred — no live consumer yet).",
  "A linguistic_package_id was loaded (deferred — speculative until a consumer exists).",
  "Any translation or language model was invoked.",
  "The display label was natively reviewed for cultural fluency.",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

// A resolvable language token: an ISO-639-1 code (two lowercase letters) or the
// sentinel "other". A full language name or garbage does not resolve.
function isResolvableCode(code) {
  return (
    typeof code === "string" && (/^[a-z]{2}$/.test(code) || code === "other")
  );
}

function resolveOne(code) {
  if (!isResolvableCode(code)) return null;
  if (code === "other") {
    return { code: "other", label: "Other", script_direction: "ltr" };
  }
  const meta = LANGUAGE_META[code];
  return {
    code,
    label: meta ? meta.label : code,
    script_direction: meta
      ? meta.script_direction
      : RTL_CODES.has(code)
        ? "rtl"
        : "ltr",
  };
}

function buildBoundary() {
  return deepFreeze({
    ...buildPreviewBoundary(),
    model_invoked: false,
    file_content_read: false,
  });
}

export function buildLanguagePack({
  language_code = null,
  secondary_language_code = null,
} = {}) {
  const primary = resolveOne(language_code);
  const secondaryOne = resolveOne(secondary_language_code);
  const secondary = secondaryOne ? [secondaryOne] : [];

  return deepFreeze({
    schema: DEMA_LANGUAGE_PACK_SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: "preview_only",
    status: primary ? "set" : "unset",
    primary,
    secondary,
    script_direction: primary ? primary.script_direction : "ltr",
    boundary: buildBoundary(),
    what_this_proves: WHAT_THIS_PROVES,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
  });
}
