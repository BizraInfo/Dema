// BOUNDARY-VOCAB-UNIFICATION-1A — machine-readable ADR registry for tests and
// review gates. Each entry is either CANONICAL or INTENTIONAL domain vocabulary.

import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "./boundary-schema.js";
import { SELF_AWARENESS_BOUNDARY_KEYS } from "./self-awareness-report.js";
import { RSI_PROPOSAL_BOUNDARY_KEYS } from "./rsi-proposal-preview.js";
import { SELF_LOOP_OODA_BOUNDARY_KEYS } from "./self-loop-ooda.js";
import {
  REGISTRY_BOUNDARY_KEYS,
  ROW_BOUNDARY_KEYS,
} from "./dema-capability-truth-registry.js";
import { FDE_BOUNDARY_KEYS } from "./dema-fde-dual-diagnostic.js";
import { STEP7_CONSENT_BOUNDARY_KEYS } from "./step7-consent-refusal-preview.js";
import { BEHAVIORAL_MODULATION_BOUNDARY_KEYS } from "./behavioral-modulation.js";
import { DIFFUSION_REASONER_BOUNDARY_KEYS } from "./diffusion-reasoner.js";
import { HASH_TABLE_BOUNDARY_KEYS } from "./hash-table-knowledge-index.js";
import { HHMM_BOUNDARY_KEYS } from "./hhmm-state-machine.js";
import { MODEL_EVAL_BASELINE_BOUNDARY_KEYS } from "./model-eval-baseline.js";
import { MODEL_ROUTING_PREVIEW_BOUNDARY_KEYS } from "./model-routing-preview.js";
import { NODE0_ACTIVATION_OBSERVE_BOUNDARY_KEYS } from "./node0-activation-observe.js";
import { HOUSE_BOUNDARY_KEYS } from "./house-of-wisdom-local-index-preview.js";
import { FIRST_RUN_BOUNDARY_KEYS } from "./first-run.js";
import { ONBOARDING_SEAL_BOUNDARY_KEYS } from "./onboarding-seal.js";

export const BOUNDARY_VOCAB_UNIFICATION_ADR_ID =
  "ADR-BOUNDARY-VOCAB-UNIFICATION-1A";

// Documented synonym pairs: same effect class, different name.
// Full rename deferred to BOUNDARY-SYNONYM-RECONCILE-1A.
export const BOUNDARY_EFFECT_SYNONYM_ALIASES = Object.freeze({
  file_write_performed: "filesystem_write_performed",
  network_call_performed: "network_used",
});

// Related keys that are NOT synonyms — documented to prevent false reconciliation.
export const BOUNDARY_EFFECT_DISTINCT_PAIRS = Object.freeze([
  Object.freeze({
    domain_key: "private_content_read",
    related_canonical: "content_read",
    rationale:
      "Observe/eval kernels assert private-content non-read; distinct from governed content_read effect.",
  }),
]);

export const BOUNDARY_VOCAB_ADR_ENTRIES = Object.freeze([
  Object.freeze({
    id: "preview-boundary-canonical",
    module_path: "packages/core/src/boundary-schema.js",
    export_name: "PREVIEW_BOUNDARY_CANONICAL_KEYS",
    keys: PREVIEW_BOUNDARY_CANONICAL_KEYS,
    classification: "CANONICAL",
    rationale:
      "Universal effect-class vocabulary for preview modules; frozen all-false default.",
  }),
  Object.freeze({
    id: "self-awareness-report",
    module_path: "packages/core/src/self-awareness-report.js",
    export_name: "SELF_AWARENESS_BOUNDARY_KEYS",
    keys: SELF_AWARENESS_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Self-knowledge kernel uses introspection and autonomy terms not in the universal list.",
  }),
  Object.freeze({
    id: "rsi-proposal-preview",
    module_path: "packages/core/src/rsi-proposal-preview.js",
    export_name: "RSI_PROPOSAL_BOUNDARY_KEYS",
    keys: RSI_PROPOSAL_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "RSI proposal preview tracks self-change and economic-activation boundaries.",
  }),
  Object.freeze({
    id: "self-loop-ooda",
    module_path: "packages/core/src/self-loop-ooda.js",
    export_name: "SELF_LOOP_OODA_BOUNDARY_KEYS",
    keys: SELF_LOOP_OODA_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "OODA self-loop review adds action_execution and daemon_started terms.",
  }),
  Object.freeze({
    id: "dema-capability-truth-registry",
    module_path: "packages/core/src/dema-capability-truth-registry.js",
    export_name: "REGISTRY_BOUNDARY_KEYS",
    keys: REGISTRY_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Capability truth registry uses registry-level capability boundary vocabulary.",
  }),
  Object.freeze({
    id: "dema-capability-truth-registry-row",
    module_path: "packages/core/src/dema-capability-truth-registry.js",
    export_name: "ROW_BOUNDARY_KEYS",
    keys: ROW_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Per-capability row boundary is a smaller execution-allowance vocabulary.",
  }),
  Object.freeze({
    id: "dema-fde-dual-diagnostic",
    module_path: "packages/core/src/dema-fde-dual-diagnostic.js",
    export_name: "FDE_BOUNDARY_KEYS",
    keys: FDE_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "FDE dual diagnostic tracks patch/commit/push/merge and autopatch boundaries.",
  }),
  Object.freeze({
    id: "step7-consent-refusal-preview",
    module_path: "packages/core/src/step7-consent-refusal-preview.js",
    export_name: "STEP7_CONSENT_BOUNDARY_KEYS",
    keys: STEP7_CONSENT_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Step7 consent ceremony uses authorization and mint ceremony terms.",
  }),
  Object.freeze({
    id: "behavioral-modulation",
    module_path: "packages/core/src/behavioral-modulation.js",
    export_name: "BEHAVIORAL_MODULATION_BOUNDARY_KEYS",
    keys: BEHAVIORAL_MODULATION_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Behavioral modulation preview tracks modulation and hidden-effect boundaries.",
  }),
  Object.freeze({
    id: "diffusion-reasoner",
    module_path: "packages/core/src/diffusion-reasoner.js",
    export_name: "DIFFUSION_REASONER_BOUNDARY_KEYS",
    keys: DIFFUSION_REASONER_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Diffusion reasoner kernel adds text_generation_performed for denoising metaphor.",
  }),
  Object.freeze({
    id: "hash-table-knowledge-index",
    module_path: "packages/core/src/hash-table-knowledge-index.js",
    export_name: "HASH_TABLE_BOUNDARY_KEYS",
    keys: HASH_TABLE_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Hash-table knowledge index kernel-family vocabulary for indexed knowledge.",
  }),
  Object.freeze({
    id: "hhmm-state-machine",
    module_path: "packages/core/src/hhmm-state-machine.js",
    export_name: "HHMM_BOUNDARY_KEYS",
    keys: HHMM_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "HHMM state-machine kernel lifecycle vocabulary without universal preview keys.",
  }),
  Object.freeze({
    id: "model-eval-baseline",
    module_path: "packages/core/src/model-eval-baseline.js",
    export_name: "MODEL_EVAL_BASELINE_BOUNDARY_KEYS",
    keys: MODEL_EVAL_BASELINE_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Model eval baseline uses local-measurement boundary keys (key_generated, etc.).",
  }),
  Object.freeze({
    id: "model-routing-preview",
    module_path: "packages/core/src/model-routing-preview.js",
    export_name: "MODEL_ROUTING_PREVIEW_BOUNDARY_KEYS",
    keys: MODEL_ROUTING_PREVIEW_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Model routing preview extends eval baseline with live_routing and model_invoked.",
  }),
  Object.freeze({
    id: "node0-activation-observe",
    module_path: "packages/core/src/node0-activation-observe.js",
    export_name: "NODE0_ACTIVATION_OBSERVE_BOUNDARY_KEYS",
    keys: NODE0_ACTIVATION_OBSERVE_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Node0 activation observe read-only snapshot uses Issue #243 observe vocabulary.",
  }),
  Object.freeze({
    id: "house-of-wisdom-local-index-preview",
    module_path: "packages/core/src/house-of-wisdom-local-index-preview.js",
    export_name: "HOUSE_BOUNDARY_KEYS",
    keys: HOUSE_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "House of Wisdom local index preview uses UKE/URP/house acceptance vocabulary.",
  }),
  Object.freeze({
    id: "first-run",
    module_path: "packages/core/src/first-run.js",
    export_name: "FIRST_RUN_BOUNDARY_KEYS",
    keys: FIRST_RUN_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "First-run plan uses simplified operator-facing boundary flags (read_only, mint, etc.).",
  }),
  Object.freeze({
    id: "onboarding-seal",
    module_path: "packages/core/src/onboarding-seal.js",
    export_name: "ONBOARDING_SEAL_BOUNDARY_KEYS",
    keys: ONBOARDING_SEAL_BOUNDARY_KEYS,
    classification: "INTENTIONAL",
    rationale:
      "Onboarding seal uses simplified seal contract boundary flags.",
  }),
]);

export function allAdrJustifiedBoundaryKeys() {
  const union = new Set(PREVIEW_BOUNDARY_CANONICAL_KEYS);
  for (const entry of BOUNDARY_VOCAB_ADR_ENTRIES) {
    if (entry.classification === "CANONICAL") continue;
    for (const key of entry.keys) union.add(key);
  }
  return Object.freeze([...union].sort());
}

export function verifyBoundarySynonymAnnotations() {
  const blocked_by = [];
  const canonicalSet = new Set(PREVIEW_BOUNDARY_CANONICAL_KEYS);
  const knownSynonyms = new Set(Object.keys(BOUNDARY_EFFECT_SYNONYM_ALIASES));

  for (const [synonym, canonical] of Object.entries(BOUNDARY_EFFECT_SYNONYM_ALIASES)) {
    if (!canonicalSet.has(canonical)) {
      blocked_by.push(`synonym_canonical_missing:${synonym}->${canonical}`);
    }
  }

  for (const entry of BOUNDARY_VOCAB_ADR_ENTRIES) {
    if (entry.classification === "CANONICAL") continue;
    for (const key of entry.keys) {
      if (knownSynonyms.has(key)) continue;
      if (key === "file_write_performed" || key === "network_call_performed") {
        blocked_by.push(`unannotated_synonym:${entry.id}:${key}`);
      }
    }
  }

  return Object.freeze(blocked_by);
}

export function findAdrEntryByModulePath(modulePath) {
  return BOUNDARY_VOCAB_ADR_ENTRIES.filter(
    (entry) => entry.module_path === modulePath,
  );
}
