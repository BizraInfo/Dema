import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMobileCompanionRegisterPreview,
  EXPECTED_COMPANION_REGISTER_CONSENT,
  MOBILE_COMPANION_REGISTER_PREVIEW_SCHEMA,
  renderMobileCompanionRegisterPreview,
} from "../packages/core/src/mobile-companion-register-preview.js";
import { runMobileCompanionRegister1aCheck } from "../scripts/review/mobile-companion-register-1a-check.mjs";

test("MCR-01: exact consent allows Z Fold 6 companion declaration", () => {
  const out = buildMobileCompanionRegisterPreview({
    offered_consent: EXPECTED_COMPANION_REGISTER_CONSENT,
  });
  assert.equal(out.schema, MOBILE_COMPANION_REGISTER_PREVIEW_SCHEMA);
  assert.equal(out.registration_allowed, true);
  assert.equal(out.companion_declaration.device_label, "Z Fold 6");
  assert.equal(out.companion_declaration.node_ordinal, 0);
  assert.match(out.companion_declaration.node_uid_preview, /^bizra_node_0_/);
});

test("MCR-02: wrong consent fails closed", () => {
  const out = buildMobileCompanionRegisterPreview({
    offered_consent: "GO register companion device",
  });
  assert.equal(out.consent_verified, false);
  assert.equal(out.registration_allowed, false);
});

test("MCR-03: registry projection stays honest about v0.1e duplicate-ordinal gate", () => {
  const out = buildMobileCompanionRegisterPreview({
    offered_consent: EXPECTED_COMPANION_REGISTER_CONSENT,
  });
  assert.equal(out.registry_projection.same_ordinal_per_canon, true);
  assert.equal(out.registry_projection.node_registry_v01e_active_list_compatible, false);
  assert.equal(out.registry_projection.connected_node_count_unchanged, 1);
});

test("MCR-04: mobile posture blocks phone actuator", () => {
  const out = buildMobileCompanionRegisterPreview({
    offered_consent: EXPECTED_COMPANION_REGISTER_CONSENT,
  });
  assert.equal(out.mobile_posture.phone_actuator, false);
  assert.equal(out.mobile_posture.phone_secret_store, false);
  assert.ok(out.blocked_effects.includes("phone_runtime_actuator"));
});

test("MCR-05: render includes preview-only disclaimer", () => {
  const text = renderMobileCompanionRegisterPreview(
    buildMobileCompanionRegisterPreview({
      offered_consent: EXPECTED_COMPANION_REGISTER_CONSENT,
    }),
  );
  assert.ok(text.includes("PREVIEW_ONLY"));
  assert.ok(text.includes("No $DEMA_HOME write"));
});

test("MCR-06: review gate passes on hermetic fixture", () => {
  const result = runMobileCompanionRegister1aCheck();
  assert.equal(result.ok, true);
  assert.equal(result.gate, "MOBILE-COMPANION-REGISTER-1A");
});
