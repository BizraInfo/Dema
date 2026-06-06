import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  buildLlmCapacityInsightPreview,
  formatLlmCapacityInsightPreview,
  LLM_CAPACITY_HARD_STOP_GATES,
  LLM_CAPACITY_SAPE_AXES,
} from "../packages/core/src/llm-capacity-insight-preview.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

const modulePath = fileURLToPath(
  new URL(
    "../packages/core/src/llm-capacity-insight-preview.js",
    import.meta.url,
  ),
);

function assertExhaustiveFalseBoundary(boundary) {
  for (const key of PREVIEW_BOUNDARY_CANONICAL_KEYS) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
}

function highSape() {
  return Object.fromEntries(LLM_CAPACITY_SAPE_AXES.map((axis) => [axis, 0.95]));
}

test("capacity insight preview emits DERIVED PREVIEW_ONLY schema and no certification", () => {
  const preview = buildLlmCapacityInsightPreview();

  assert.equal(preview.schema, "bizra.dema.llm_capacity_insight_preview.v0.1");
  assert.equal(preview.truth_label, "DERIVED");
  assert.notEqual(preview.truth_label, "MEASURED");
  assert.equal(preview.mode, "PREVIEW_ONLY");
  assert.equal(preview.certifies, false);
  assert.equal(preview.evidence_status, "missing");
  assertExhaustiveFalseBoundary(preview.boundary);
});

test("missing or invalid evidence abstains instead of inventing a step", () => {
  const missing = buildLlmCapacityInsightPreview();
  const invalid = buildLlmCapacityInsightPreview({
    candidates: [{ id: "" }, null, "bad"],
  });

  assert.equal(missing.peak_micro_step.id, "collect-minimal-evidence-bundle");
  assert.equal(missing.peak_micro_step.execution_allowed, false);
  assert.equal(invalid.evidence_status, "invalid");
  assert.equal(invalid.peak_micro_step.execution_allowed, false);
});

test("hard-stop implementation candidates are disqualified below safe authorization requests", () => {
  const preview = buildLlmCapacityInsightPreview({
    candidates: [
      {
        id: "start-hidden-daemon",
        title: "Start a hidden daemon to amplify reasoning",
        action_kind: "runtime",
        hard_stop_gate: "runtime_daemon",
        actionable_architectural_signal: 1,
        speculative_implementation_noise: 0,
        sape: highSape(),
        proof: { formal: true, empirical: true },
      },
      {
        id: "ci-hard-stop-authorization",
        title: "Resolve modified CI workflow by exact authorization or restore",
        action_kind: "authorization_request",
        hard_stop_gate: "ci_workflow",
        actionable_architectural_signal: 0.92,
        speculative_implementation_noise: 0.02,
        sape: highSape(),
        proof: { formal: true, cryptographic: true, empirical: true },
      },
    ],
  });

  assert.equal(preview.evidence_status, "present");
  assert.equal(preview.ranked_candidates[0].id, "ci-hard-stop-authorization");
  assert.equal(preview.ranked_candidates.at(-1).id, "start-hidden-daemon");
  assert.equal(
    preview.ranked_candidates.at(-1).hard_stop_crossing_disqualified,
    true,
  );
  assert.equal(preview.peak_micro_step.action_kind, "authorization_request");
  assert.equal(preview.peak_micro_step.execution_allowed, false);
});

test("safe verification candidate can become the peak micro-step", () => {
  const preview = buildLlmCapacityInsightPreview({
    candidates: [
      {
        id: "speculative-swarm",
        title: "Invent a new swarm runtime",
        action_kind: "implementation",
        actionable_architectural_signal: 0.3,
        speculative_implementation_noise: 1,
        sape: { signal_preservation: 0.2 },
      },
      {
        id: "targeted-proof-verifier",
        title: "Run targeted receipt verifier after restoring canonical bytes",
        action_kind: "verification",
        hard_stop_gate: "none",
        actionable_architectural_signal: 0.9,
        speculative_implementation_noise: 0.05,
        sape: highSape(),
        proof: { formal: true, cryptographic: true, empirical: true },
      },
    ],
  });

  assert.equal(preview.peak_micro_step.id, "targeted-proof-verifier");
  assert.equal(preview.peak_micro_step.execution_allowed, true);
});

test("candidate ranking is deterministic with stable tie-break by input order", () => {
  const candidates = [
    {
      id: "first",
      title: "First tied candidate",
      actionable_architectural_signal: 0.5,
      speculative_implementation_noise: 0.1,
      sape: { signal_preservation: 0.5 },
    },
    {
      id: "second",
      title: "Second tied candidate",
      actionable_architectural_signal: 0.5,
      speculative_implementation_noise: 0.1,
      sape: { signal_preservation: 0.5 },
    },
  ];

  const first = buildLlmCapacityInsightPreview({ candidates });
  const second = buildLlmCapacityInsightPreview({ candidates });

  assert.deepEqual(first, second);
  assert.equal(first.ranked_candidates[0].id, "first");
});

test("unknown gates and actions are coerced to safe preview defaults", () => {
  const preview = buildLlmCapacityInsightPreview({
    candidates: [
      {
        id: "unknowns",
        title: "Unknown fields",
        action_kind: "self_modify",
        hard_stop_gate: "magic_gate",
        actionable_architectural_signal: 2,
        speculative_implementation_noise: -1,
        sape: { signal_preservation: 9 },
      },
    ],
  });

  const candidate = preview.ranked_candidates[0];
  assert.equal(candidate.action_kind, "preview");
  assert.equal(candidate.hard_stop_gate, "none");
  assert.equal(candidate.actionable_architectural_signal, 1);
  assert.equal(candidate.speculative_implementation_noise, 0);
  assert.equal(candidate.sape.signal_preservation, 1);
});

test("format renders proof-safe preview language", () => {
  const output = formatLlmCapacityInsightPreview(
    buildLlmCapacityInsightPreview({
      candidates: [
        {
          id: "x",
          title: "Review evidence",
          actionable_architectural_signal: 0.5,
        },
      ],
    }),
  );

  assert.match(output, /DEMA LLM Capacity Insight Preview/);
  assert.match(output, /Truth: DERIVED/);
  assert.match(output, /preview-only/);
});

test("source has no runtime, network, filesystem, or child-process effects", async () => {
  const source = await readFile(modulePath, "utf8");

  assert.doesNotMatch(
    source,
    /from "node:(fs|net|http|https|tls|dgram|child_process)"/,
  );
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(
    source,
    /\b(writeFile|appendFile|mkdir|rename|unlink|createWriteStream|spawn|execFile)\b/,
  );
});

test("hard-stop vocabulary includes CI workflow and runtime gates", () => {
  assert.ok(LLM_CAPACITY_HARD_STOP_GATES.includes("ci_workflow"));
  assert.ok(LLM_CAPACITY_HARD_STOP_GATES.includes("runtime_daemon"));
});
