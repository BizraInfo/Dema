// DELIVERY-OPERATING-SYSTEM-1A · CLI surface for the delivery control plane.
//
// `dema delivery policy [--json]`  — render the machine-readable gate manifest.
// `dema delivery status [--json]`  — annotate the policy with which gate
//                                    commands are wired in package.json.
//
// The kernel stays pure; this command does the package.json read and passes
// the scripts object in as data. No subprocess, no gate execution.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  buildDeliveryOperatingSystem,
  annotateDeliveryStatus,
} from "../../../../packages/core/src/delivery-operating-system.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

async function readScripts() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const repoRoot = resolve(here, "..", "..", "..", "..");
    const raw = await readFile(resolve(repoRoot, "package.json"), "utf8");
    return JSON.parse(raw).scripts ?? {};
  } catch {
    return {};
  }
}

function renderPolicyHuman(policy) {
  const lines = [
    "Dema Delivery Operating System (policy_only · LOCAL_ONLY)",
    `  schema: ${policy.schema}`,
    `  gates: ${policy.delivery_gates.length} · blockers: ${policy.release_blockers.length} · warning-only: ${policy.warning_only.length}`,
    "",
    "Gates by Proof-of-Truth rail:",
  ];
  for (const rail of Object.keys(policy.gate_groups)) {
    const group = policy.gate_groups[rail];
    const ids = group.gates.length
      ? group.gates.join(", ")
      : "(none — DESIGNED_NOT_LIVE)";
    lines.push(`  [${rail}] ${ids}`);
  }
  lines.push("", "Next safe actions:");
  for (const action of policy.next_safe_actions) lines.push(`  - ${action}`);
  lines.push("", "current_status is UNKNOWN until measured results are supplied.");
  return lines.join("\n");
}

function wiredTag(gate) {
  if (gate.ci_enforced) return "ci";
  return gate.script_wired ? "wired" : "MISSING";
}

function renderStatusHuman(policy, status) {
  const byId = Object.fromEntries(status.gates.map((g) => [g.id, g]));
  const lines = [
    "Dema Delivery Status (policy_only · current_status UNKNOWN unless measured)",
    `  release_ready: ${status.release_ready}`,
  ];
  if (status.failing_blockers.length) {
    lines.push(`  failing_blockers: ${status.failing_blockers.join(", ")}`);
  }
  lines.push("", "Release blockers:");
  for (const id of policy.release_blockers) {
    const g = byId[id];
    lines.push(`  - ${id} [${wiredTag(g)}] status=${g.current_status} · ${g.command}`);
  }
  lines.push("", "Warning-only:");
  for (const id of policy.warning_only) {
    const g = byId[id];
    lines.push(`  - ${id} [${wiredTag(g)}] status=${g.current_status} · ${g.command}`);
  }
  return lines.join("\n");
}

export async function cmd_delivery(ctx) {
  const { argv } = ctx;
  const sub = argv[1] ?? "";
  const wantJson = wantsJson(argv);

  if (sub === "policy") {
    const policy = buildDeliveryOperatingSystem();
    console.log(
      wantJson ? JSON.stringify(policy, null, 2) : renderPolicyHuman(policy),
    );
    process.exit(0);
  }

  if (sub === "status") {
    const scripts = await readScripts();
    const policy = buildDeliveryOperatingSystem();
    const status = annotateDeliveryStatus(policy, { scripts });
    console.log(
      wantJson
        ? JSON.stringify(status, null, 2)
        : renderStatusHuman(policy, status),
    );
    process.exit(0);
  }

  console.error(
    "Usage: dema delivery policy [--json] | dema delivery status [--json]",
  );
  process.exitCode = 1;
  process.exit(1);
}
