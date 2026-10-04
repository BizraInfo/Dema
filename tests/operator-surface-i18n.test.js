import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveOperatorSurfaceI18n,
  localizeOnboardingStages,
  ARABIC_STRINGS_TRUTH_LABEL,
} from "../packages/core/src/operator-surface-i18n.js";
import {
  buildOnboardingPreview,
  formatOnboardingPreview,
} from "../packages/core/src/onboarding.js";
import {
  evaluatePredicates,
  formatDoctorDashboard,
} from "../packages/core/src/doctor-dashboard.js";

test("Arabic pack is DECLARED_NEEDS_NATIVE_REVIEW and rtl", () => {
  const pack = resolveOperatorSurfaceI18n("ar");
  assert.equal(pack.language_code, "ar");
  assert.equal(pack.script_direction, "rtl");
  assert.equal(pack.truth_label, ARABIC_STRINGS_TRUTH_LABEL);
  assert.match(pack.strings.welcome.title, /ديما|أهلا/);
});

test("welcome guide renders Arabic allowed/blocked labels under ar", () => {
  const guide = buildOnboardingPreview({ language_code: "ar" });
  const text = formatOnboardingPreview(guide);
  assert.match(text, /مسموح/);
  assert.match(text, /محظور/);
  assert.match(text, /DECLARED_NEEDS_NATIVE_REVIEW/);
  assert.match(text, /\u200F/); // RTL mark consumed
});

test("onboard stage titles localize under ar", () => {
  const stages = [
    { id: "language", order: 0, title: "What language should I speak with you?" },
    { id: "purpose", order: 3, title: "What do you want your node to help you with?" },
  ];
  const localized = localizeOnboardingStages(stages, "ar");
  assert.match(localized[0].title, /لغة|لغة/);
  assert.notEqual(localized[0].title, stages[0].title);
});

test("localizeOnboardingStages is a no-op outside ar and for non-arrays", () => {
  const stages = [{ id: "language", order: 0, title: "What language?" }];
  assert.equal(localizeOnboardingStages(stages, "en"), stages);
  assert.equal(localizeOnboardingStages(null, "ar"), null);
  assert.equal(localizeOnboardingStages(undefined, "ar"), undefined);
});

test("localizeOnboardingStages leaves unknown stage ids untouched", () => {
  const stage = { id: "not_a_stage", order: 9, title: "Untranslated" };
  const [out] = localizeOnboardingStages([stage], "ar");
  assert.equal(out, stage);
  assert.equal(out.title, "Untranslated");
});

test("localizeOnboardingStages keeps the {ordinal} placeholder when both packs carry it", () => {
  const [out] = localizeOnboardingStages(
    [
      {
        id: "node_role",
        order: 2,
        title: "You are being prepared as Node{ordinal}. Do you understand what that means?",
      },
    ],
    "ar",
  );
  assert.match(out.title, /\{ordinal\}/);
  assert.match(out.title, /عقدة/);
});

test("localizeOnboardingStages substitutes a concrete ordinal from the English title", () => {
  const [out] = localizeOnboardingStages(
    [{ id: "node_role", order: 2, title: "You are being prepared as Node0." }],
    "ar",
  );
  assert.doesNotMatch(out.title, /\{ordinal\}/);
  assert.match(out.title, /Node0/);
});

test("doctor predicates use Arabic labels under ar", () => {
  const predicates = evaluatePredicates(
    {
      activationGate: "BLOCKED",
      daemonStatus: "unknown",
      ready: false,
      consoleReady: false,
      gateway: { reachable: false },
    },
    { language_code: "ar" },
  );
  assert.equal(predicates[0].label, "بوابة التفعيل");
  assert.match(predicates[0].fix, /BLOCKED|محظورة/);
  const dash = formatDoctorDashboard(predicates, {
    color: false,
    language_code: "ar",
  });
  assert.match(dash, /DECLARED_NEEDS_NATIVE_REVIEW/);
  assert.match(dash, /بوابة التفعيل/);
});
