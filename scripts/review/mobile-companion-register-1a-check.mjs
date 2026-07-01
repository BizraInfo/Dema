#!/usr/bin/env node
// MOBILE-COMPANION-REGISTER-1A review gate — hermetic consent + declaration preview.

import { pathToFileURL } from "node:url";

import {
  buildMobileCompanionRegisterPreview,
  EXPECTED_COMPANION_REGISTER_CONSENT,
  MOBILE_COMPANION_REGISTER_PREVIEW_SCHEMA,
  MOBILE_COMPANION_REGISTER_TRUTH_LABEL,
} from "../../packages/core/src/mobile-companion-register-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runMobileCompanionRegister1aCheck() {
  const denied = buildMobileCompanionRegisterPreview({
    offered_consent: "GO register companion device",
  });
  if (denied.registration_allowed) {
    return Object.freeze({
      gate: "MOBILE-COMPANION-REGISTER-1A",
      ok: false,
      reason: "fail_open_without_exact_consent",
    });
  }

  const allowed = buildMobileCompanionRegisterPreview({
    offered_consent: EXPECTED_COMPANION_REGISTER_CONSENT,
  });
  if (!allowed.registration_allowed) {
    return Object.freeze({
      gate: "MOBILE-COMPANION-REGISTER-1A",
      ok: false,
      reason: "exact_consent_did_not_allow_registration",
    });
  }
  if (allowed.companion_declaration.node_uid_preview === null) {
    return Object.freeze({
      gate: "MOBILE-COMPANION-REGISTER-1A",
      ok: false,
      reason: "missing_node_uid_preview",
    });
  }
  if (allowed.mobile_posture.phone_actuator !== false) {
    return Object.freeze({
      gate: "MOBILE-COMPANION-REGISTER-1A",
      ok: false,
      reason: "phone_actuator_must_stay_false",
    });
  }

  return Object.freeze({
    gate: "MOBILE-COMPANION-REGISTER-1A",
    ok: true,
    schema: MOBILE_COMPANION_REGISTER_PREVIEW_SCHEMA,
    truth_label: MOBILE_COMPANION_REGISTER_TRUTH_LABEL,
    node_uid_preview: allowed.companion_declaration.node_uid_preview,
    boundary: "No runtime · no network · no $DEMA_HOME write · no phone actuator",
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runMobileCompanionRegister1aCheck();
  if (JSON_MODE) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("DEMA · Mobile companion register preview gate");
    console.log(`  schema: ${MOBILE_COMPANION_REGISTER_PREVIEW_SCHEMA}`);
    console.log(`  truth: ${MOBILE_COMPANION_REGISTER_TRUTH_LABEL}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) console.log(`  reason: ${result.reason}`);
  }
  if (!result.ok) process.exit(1);
}
