// MOBILE-COMPANION-REGISTER-1A — declare Z Fold 6 companion for Node0 (preview only).
//
// Per BIZRA_TOPOLOGY_CANON.md device companionship: companion shares primary
// node_ordinal with distinct node_uid (device_label in the uid hash). Mobile is
// consent-viewer + manual-echo only — never a runtime actuator (ADR/mobile QR v0).

import { buildPreviewBoundary } from "./preview-boundary.js";
import { buildUserProfile } from "./profiles.js";

export const MOBILE_COMPANION_REGISTER_PREVIEW_SCHEMA =
  "bizra.dema.mobile_companion_register_preview.v0.1";
export const MOBILE_COMPANION_REGISTER_TRUTH_LABEL =
  "MOBILE_COMPANION_REGISTER_PREVIEW_ONLY";

export const EXPECTED_COMPANION_REGISTER_CONSENT =
  "GO register companion device Z Fold 6 for Node0";

export const DEFAULT_COMPANION_DEVICE_LABEL = "Z Fold 6";
export const DEFAULT_PRIMARY_NODE_LABEL = "Node0";
export const DEFAULT_PRIMARY_NODE_ORDINAL = 0;

const BLOCKED_EFFECTS = Object.freeze([
  "phone_runtime_actuator",
  "mobile_network_endpoint",
  "hidden_daemon",
  "federation_handshake",
  "dema_home_profile_write",
  "node_registry_mutation",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function buildMobileCompanionRegisterPreview({
  offered_consent = null,
  device_label = DEFAULT_COMPANION_DEVICE_LABEL,
  primary_node_label = DEFAULT_PRIMARY_NODE_LABEL,
  primary_node_ordinal = DEFAULT_PRIMARY_NODE_ORDINAL,
  operator = "MoMo",
} = {}) {
  const consent_verified = offered_consent === EXPECTED_COMPANION_REGISTER_CONSENT;
  const registration_allowed =
    consent_verified &&
    device_label === DEFAULT_COMPANION_DEVICE_LABEL &&
    primary_node_label === DEFAULT_PRIMARY_NODE_LABEL &&
    primary_node_ordinal === DEFAULT_PRIMARY_NODE_ORDINAL;

  const primary_profile = buildUserProfile({
    operator,
    node: primary_node_label,
    node_ordinal: primary_node_ordinal,
    device_label: "MSI laptop",
    companion_of: null,
  });

  const companion_profile = buildUserProfile({
    operator,
    node: primary_node_label,
    node_ordinal: primary_node_ordinal,
    device_label,
    companion_of: primary_profile.identity.node_uid,
  });

  const companion_declaration = Object.freeze({
    device_label,
    node_ordinal: primary_node_ordinal,
    node_label: primary_node_label,
    status: "accepted_companion",
    companion_of: primary_node_label,
    companion_of_uid: primary_profile.identity.node_uid,
    node_uid_preview: companion_profile.identity.node_uid,
    canon_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md#node-ordinal-law",
  });

  return deepFreeze({
    schema: MOBILE_COMPANION_REGISTER_PREVIEW_SCHEMA,
    truth_label: MOBILE_COMPANION_REGISTER_TRUTH_LABEL,
    mode: "preview_only",
    receipt_shape_ready: true,
    consent_verified,
    registration_allowed,
    expected_consent_phrase: EXPECTED_COMPANION_REGISTER_CONSENT,
    companion_declaration,
    registry_projection: Object.freeze({
      companion_device_count_after: registration_allowed ? 1 : 0,
      connected_node_count_unchanged: 1,
      same_ordinal_per_canon: true,
      node_registry_v01e_active_list_compatible: false,
      integration_note:
        "node-registry-preview v0.1e refuses duplicate ordinals in active[]; same-ordinal companion uses profiles.js uid path until registry v0.1g",
    }),
    mobile_posture: Object.freeze({
      channel: "manual_echo_only",
      spec: "docs/02-architecture/dema-mobile-qr-consent-v0.md",
      phone_actuator: false,
      phone_secret_store: false,
    }),
    blocked_effects: BLOCKED_EFFECTS,
    boundary: buildPreviewBoundary(),
    what_this_proves:
      "Operator can declare the canonical Z Fold 6 companion for Node0 under exact-string consent with canon-aligned uid preview",
    what_this_does_not_prove:
      "No $DEMA_HOME write, no live registry mutation, no phone pairing socket, no mobile actuator",
  });
}

export function renderMobileCompanionRegisterPreview(preview) {
  const lines = [
    "DEMA · Mobile companion register (PREVIEW_ONLY)",
    `  truth: ${preview.truth_label}`,
    `  consent verified: ${preview.consent_verified}`,
    `  registration allowed: ${preview.registration_allowed}`,
    `  expected phrase: ${preview.expected_consent_phrase}`,
    `  device: ${preview.companion_declaration.device_label}`,
    `  node_uid preview: ${preview.companion_declaration.node_uid_preview}`,
    `  ${preview.what_this_does_not_prove}`,
  ];
  return lines.join("\n");
}
