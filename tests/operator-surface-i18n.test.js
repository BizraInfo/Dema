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
