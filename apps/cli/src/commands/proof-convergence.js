// `dema proof convergence` subcommand helper (routed from commands/proof.js).
//
// Surfaces the Proof-of-Truth Convergence kernel
// (packages/core/src/proof-convergence-preview.js) through the CLI. It grades a
// curated EXAMPLE claim set reflecting the real Dema proof posture — illustrative,
// NOT an auto-derived live verdict (a later slice wires real signals: claim
// register + harness + gates). Default = human table; --summary = compact;
// --json = the frozen envelope. Writes nothing; the kernel is pure.

import { buildProofConvergencePreview } from "../../../../packages/core/src/proof-convergence-preview.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

// Curated example claims — the ids are prefixed `example:` so no consumer
// mistakes them for a live measured verdict. Evidence tokens reflect the real
// posture (onboarding/bootstrap converged; token economy declared-only).
const EXAMPLE_CLAIMS = [
  {
    id: "example:onboarding-protocol",
    statement: "First-time onboarding protocol is enforced.",
    rails: {
      formal: "spec_plus_test",
      empirical: "passing_tests",
      cryptographic: "not_applicable",
      economic: "not_applicable",
    },
  },
  {
    id: "example:bootstrap-mode",
    statement: "Model-less ephemeral Bootstrap Mode exists.",
    rails: {
      formal: "declared_spec",
      empirical: "passing_tests",
      cryptographic: "not_applicable",
      economic: "not_applicable",
    },
  },
  {
    id: "example:local-authorship-receipt",
    statement: "Local Ed25519 authorship receipts.",
    rails: {
      formal: "declared_spec",
      empirical: "passing_tests",
      cryptographic: "local_signed",
      economic: "not_applicable",
    },
  },
  {
    id: "example:token-economy",
    statement: "Token economy / PoI rewards.",
    rails: {
      formal: "designed",
      empirical: "none",
      cryptographic: "none",
      economic: "designed_not_live",
    },
  },
];

function cell(rail) {
  return rail.applicable ? String(rail.level) : "·";
}

function formatConvergence(env) {
  const lines = [
    "Proof-of-Truth Convergence — EXAMPLE claims (illustrative; not a live repo verdict)",
    `  claims: ${env.summary.total} · CONVERGED ${env.summary.converged} · PARTIAL ${env.summary.partial} · DECLARED ${env.summary.declared}`,
    `  weakest: ${env.summary.weakest_claim ?? "—"}`,
    "",
  ];
  for (const c of env.claims) {
    const r = c.rails;
    lines.push(
      `  [${c.convergence.padEnd(9)}] floor ${c.floor_level} · F${cell(r.formal)} C${cell(r.cryptographic)} E${cell(r.empirical)} $${cell(r.economic)} · ${c.id}`,
    );
  }
  lines.push("");
  lines.push(
    "  rails: F=Formal C=Cryptographic E=Empirical $=Economic (level 0-5; · = not applicable)",
  );
  return lines.join("\n");
}

function formatConvergenceSummary(env) {
  return `Proof-of-Truth Convergence (example) · ${env.summary.total} claims · CONVERGED ${env.summary.converged} / PARTIAL ${env.summary.partial} / DECLARED ${env.summary.declared} · weakest ${env.summary.weakest_claim ?? "—"}`;
}

// Subcommand helper for `dema proof convergence` (space-subcommand per ADR-012).
// Not a top-level COMMAND_TABLE handler — routed from commands/proof.js.
export function runProofConvergence(ctx) {
  const { argv } = ctx;
  const env = buildProofConvergencePreview({ claims: EXAMPLE_CLAIMS });
  if (wantsJson(argv)) {
    console.log(JSON.stringify(env, null, 2));
  } else if (argv.includes("--summary")) {
    console.log(formatConvergenceSummary(env));
  } else {
    console.log(formatConvergence(env));
  }
  process.exit(process.exitCode ?? 0);
}
