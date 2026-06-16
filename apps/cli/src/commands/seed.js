// `dema seed` command handler — surfaces the seed-loop gate.
//
// Composes a curated EXAMPLE loop (real sub-verdicts from the assumption-state
// and proof-convergence kernels) through buildSeedLoopPreview, and shows the
// loop posture (ADVANCE/HOLD/REFUSED) over the canonical stages. Illustrative,
// NOT a live verdict (a later slice wires real signals). Default human view;
// --summary compact; --json the frozen envelope. Pure — writes nothing.

import { buildSeedLoopPreview } from "../../../../packages/core/src/seed-loop-preview.js";
import { buildAssumptionStatePreview } from "../../../../packages/core/src/assumption-state-preview.js";
import { buildProofConvergencePreview } from "../../../../packages/core/src/proof-convergence-preview.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";
import { buildSeedLoopFromRegister } from "../../../../packages/core/src/seed-loop-from-register.js";
import { validateClaimRegister } from "../../../../scripts/claims/claim-register-check.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REGISTER_URL = new URL(
  "../../../../docs/claims/node0-claim-register.v0.1.json",
  import.meta.url,
);

// Impure: read + validate the repo's claim register, then compose the loop
// (pure) over it. Fail-closed — an invalid/unreadable register exits 1, never
// silently falls back to the example.
function liveLoopOrExit() {
  let register;
  try {
    register = JSON.parse(readFileSync(fileURLToPath(REGISTER_URL), "utf8"));
  } catch (error) {
    console.error(
      `dema seed --live: cannot read claim register: ${error.message}`,
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  const verdict = validateClaimRegister(register);
  if (!verdict.ok) {
    console.error(
      `dema seed --live: claim register invalid: ${JSON.stringify(verdict.violations ?? verdict)}`,
    );
    process.exitCode = 1;
    process.exit(process.exitCode ?? 0);
  }
  return buildSeedLoopFromRegister({ register });
}

function sourceLabel(env) {
  return env.source === "claim-register"
    ? "LIVE · claim register"
    : "EXAMPLE — illustrative, not a live verdict";
}

function exampleLoop() {
  const assumption_state = buildAssumptionStatePreview({
    claims: [
      {
        id: "example:onboarding-enforced",
        claim_state: "V",
        evidence_refs: [
          "docs/02-architecture/dema-first-time-onboarding-protocol-v0.1.md",
        ],
      },
      {
        id: "example:bootstrap-model-less",
        claim_state: "D",
        derived_from: ["example:onboarding-enforced"],
      },
    ],
  });
  const convergence = buildProofConvergencePreview({
    claims: [
      {
        id: "example:onboarding",
        statement: "First-time onboarding protocol is enforced.",
        rails: { formal: "spec_plus_test", empirical: "passing_tests" },
      },
    ],
  });
  return buildSeedLoopPreview({
    seed: { intent: "publish the local node-health digest" },
    assumption_state,
    convergence,
  });
}

function formatSeed(env) {
  return [
    `Dema · seed loop (${sourceLabel(env)})`,
    `  seed: "${env.seed.intent}"`,
    `  loop: ${env.stages.join(" → ")}`,
    `  assumption: ${env.assumption.posture} (admissible=${env.assumption.admissible})`,
    `  convergence: CONVERGED ${env.convergence.converged} · PARTIAL ${env.convergence.partial} · DECLARED ${env.convergence.declared}`,
    "",
    `  posture: ${env.posture}`,
    `  next safe step: ${env.next_safe_step}`,
  ].join("\n");
}

function formatSeedSummary(env) {
  const src = env.source === "claim-register" ? "live" : "example";
  return `Dema seed loop (${src}) · ${env.posture} · ${env.stages.length} stages · ${env.next_safe_step}`;
}

export function cmd_seed(ctx) {
  const { argv } = ctx;
  const env = argv.includes("--live") ? liveLoopOrExit() : exampleLoop();
  if (wantsJson(argv)) {
    console.log(JSON.stringify(env, null, 2));
  } else if (argv.includes("--summary")) {
    console.log(formatSeedSummary(env));
  } else {
    console.log(formatSeed(env));
  }
  process.exit(process.exitCode ?? 0);
}
