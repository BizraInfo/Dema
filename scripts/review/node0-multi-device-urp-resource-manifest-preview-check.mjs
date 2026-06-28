#!/usr/bin/env node
// NODE0-MULTI-DEVICE-URP-RESOURCE-MANIFEST-PREVIEW-1A — read-only preview verifier.

import { pathToFileURL } from "node:url";

import {
  runNode0MultiDeviceUrpResourceManifestPreviewGate,
  NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA,
  NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_TRUTH_LABEL,
} from "../../packages/core/src/node0-multi-device-urp-resource-manifest-preview.js";

const JSON_MODE = process.argv.includes("--json");

export function runNode0MultiDeviceUrpResourceManifestPreviewGateCheck() {
  return runNode0MultiDeviceUrpResourceManifestPreviewGate();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = runNode0MultiDeviceUrpResourceManifestPreviewGateCheck();

  if (JSON_MODE) {
    const { report: _omit, ...json } = result;
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("DEMA · Node0 multi-device URP resource manifest preview");
    console.log(`  schema: ${NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA}`);
    console.log(`  truth: ${NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_TRUTH_LABEL}`);
    console.log(`  devices: ${result.device_count}`);
    console.log(`  resources: ${result.resource_count}`);
    console.log(`  result: ${result.ok ? "PASS" : "FAIL"}`);
    if (!result.ok) {
      for (const code of result.verified.blocked_by) {
        console.log(`    ${code}`);
      }
    }
  }

  if (!result.ok) process.exit(1);
}
