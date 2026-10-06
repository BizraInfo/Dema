#!/usr/bin/env node
/**
 * DEMA-REVIEW-GATE-SEMANTIC-BINDING-1A
 *
 * Compose mandatory review/security gates from changed content.
 * Branch/mission class may ADD gates; it must not remove content-required gates.
 *
 * G(PR) = G_base ∪ G_content(diff) ∪ G_mission/class
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { resolveClassForBranch, currentBranch } from "./pr-class.mjs";

/** Files/prefixes that can change gate semantics. */
export const GOVERNANCE_GATE_MATCHERS = Object.freeze([
  {
    id: ".gitleaks.toml",
    overlay: "secret_policy",
    test: (f) => f === ".gitleaks.toml",
    rationale: "Defines secret-scan allowlists/rules; mutates scan semantics",
  },
  {
    id: ".github/workflows/gitleaks.yml",
    overlay: "secret_policy",
    test: (f) => f === ".github/workflows/gitleaks.yml",
    rationale: "Pins gitleaks version, install digest, and invocation",
  },
  {
    id: ".github/workflows/bizra-review.yml",
    overlay: "review_gate",
    test: (f) => f === ".github/workflows/bizra-review.yml",
    rationale: "Selects review class and runs proof-quality chain",
  },
  {
    id: ".github/workflows/check.yml",
    overlay: "workflow_required_checks",
    test: (f) => f === ".github/workflows/check.yml",
    rationale: "Qualification matrix / Node authority binding",
  },
  {
    id: ".github/workflows/**",
    overlay: "workflow_required_checks",
    test: (f) =>
      f.startsWith(".github/workflows/") &&
      f !== ".github/workflows/gitleaks.yml" &&
      f !== ".github/workflows/bizra-review.yml" &&
      f !== ".github/workflows/check.yml",
    rationale: "Other workflows can add or remove required checks",
  },
  {
    id: "scripts/review/**",
    overlay: "review_gate",
    test: (f) => f.startsWith("scripts/review/"),
    rationale: "Review classifiers and gate implementations",
  },
  {
    id: "tests/review-gate.test.js",
    overlay: "review_gate",
    test: (f) => f === "tests/review-gate.test.js",
    rationale: "Locks review-gate semantics",
  },
  {
    id: "tests/gitleaks-dual-eval.test.js",
    overlay: "review_gate",
    test: (f) => f === "tests/gitleaks-dual-eval.test.js",
    rationale: "Locks dual-eval / Gate Mutator ≠ Final Gate Verifier semantics",
  },
]);

const BASE_GATES = Object.freeze([
  "pr-class",
  "proof-scope",
  "no-overclaim",
  "receipt-integrity",
]);

const OVERLAY_GATES = Object.freeze({
  secret_policy: Object.freeze([
    "gitleaks-dual-eval",
    "independent_acceptance_required",
  ]),
  review_gate: Object.freeze([
    "content_bound_review_gate",
    "independent_acceptance_required",
  ]),
  workflow_required_checks: Object.freeze([
    "workflow_required_checks_review",
  ]),
});

/**
 * @param {string[]} files
 * @returns {{ overlays: string[], reasons: { overlay: string, file: string, matcher_id: string, rationale: string }[] }}
 */
export function classifyContentOverlays(files) {
  const overlaySet = new Set();
  const reasons = [];
  for (const file of files) {
    for (const matcher of GOVERNANCE_GATE_MATCHERS) {
      if (matcher.test(file)) {
        overlaySet.add(matcher.overlay);
        reasons.push({
          overlay: matcher.overlay,
          file,
          matcher_id: matcher.id,
          rationale: matcher.rationale,
        });
      }
    }
  }
  return {
    overlays: [...overlaySet].sort(),
    reasons,
  };
}

/**
 * @param {{ branchClass: string, files: string[], branch?: string }} input
 */
export function composeRequiredGates({ branchClass, files, branch }) {
  const { overlays, reasons } = classifyContentOverlays(files);
  const mandatory = new Set(BASE_GATES);
  for (const overlay of overlays) {
    for (const gate of OVERLAY_GATES[overlay] || []) {
      mandatory.add(gate);
    }
  }
  const enforcement =
    overlays.length > 0
      ? "content_bound_composition"
      : branchClass === "policy/broad-scope" ||
          branchClass === "policy/merged-to-main"
        ? "advisory_reviewer_discipline"
        : "class_file_allowlist";

  return {
    schema: "bizra.dema.review.content_required_gates.v0.1",
    ok: true,
    branch: branch ?? null,
    review_class: branchClass,
    overlays,
    overlay_reasons: reasons,
    mandatory: [...mandatory].sort(),
    enforcement,
    invariant:
      "branch_may_add_gates_content_may_not_be_suppressed_by_branch_name",
  };
}

/**
 * Same diff under two branch names must yield the same content-mandatory gates
 * (overlays + overlay-derived mandatory entries), ignoring branch-only extras.
 */
export function contentMandatorySubset(composition) {
  return {
    overlays: composition.overlays,
    mandatory: composition.mandatory.filter(
      (g) =>
        g === "gitleaks-dual-eval" ||
        g === "independent_acceptance_required" ||
        g === "content_bound_review_gate" ||
        g === "workflow_required_checks_review" ||
        BASE_GATES.includes(g),
    ),
  };
}

export function assertSameContentMandatoryGates(files, branchClassA, branchClassB) {
  const a = contentMandatorySubset(
    composeRequiredGates({ branchClass: branchClassA, files }),
  );
  const b = contentMandatorySubset(
    composeRequiredGates({ branchClass: branchClassB, files }),
  );
  const same =
    JSON.stringify(a.overlays) === JSON.stringify(b.overlays) &&
    JSON.stringify(a.mandatory) === JSON.stringify(b.mandatory);
  return { same, a, b };
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function baseRef() {
  return (
    process.env.BIZRA_REVIEW_BASE ||
    (process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : "origin/main")
  );
}

export function changedFiles() {
  return execFileSync("git", ["diff", "--name-only", `${baseRef()}...HEAD`], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const branch =
    argValue("--branch") ||
    process.env.GITHUB_HEAD_REF ||
    currentBranch();
  const reviewClass =
    argValue("--class") ||
    process.env.BIZRA_REVIEW_CLASS ||
    resolveClassForBranch(branch);

  let files;
  const filesArg = argValue("--files");
  if (filesArg) {
    files = filesArg.split(",").filter(Boolean);
  } else {
    try {
      files = changedFiles();
    } catch {
      console.log(
        JSON.stringify(
          {
            schema: "bizra.dema.review.content_required_gates.v0.1",
            ok: true,
            skipped: true,
            class: reviewClass,
            reason: `base ref ${baseRef()} unavailable (shallow checkout / no merge base); enforced in the full-history BIZRA review job`,
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }
  }

  const report = composeRequiredGates({
    branchClass: reviewClass,
    files,
    branch,
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}
