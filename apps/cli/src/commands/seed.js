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
    "Dema · seed loop (EXAMPLE — illustrative, not a live verdict)",
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
  return `Dema seed loop (example) · ${env.posture} · ${env.stages.length} stages · ${env.next_safe_step}`;
}

export function cmd_seed(ctx) {
  const { argv } = ctx;
  const env = exampleLoop();
  if (wantsJson(argv)) {
    console.log(JSON.stringify(env, null, 2));
  } else if (argv.includes("--summary")) {
    console.log(formatSeedSummary(env));
  } else {
    console.log(formatSeed(env));
  }
  process.exit(process.exitCode ?? 0);
}
