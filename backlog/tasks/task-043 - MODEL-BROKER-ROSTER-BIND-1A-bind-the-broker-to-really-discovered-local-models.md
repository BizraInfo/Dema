---
id: TASK-043
title: 'MODEL-BROKER-ROSTER-BIND-1A: bind the broker to really-discovered local models'
status: To Do
assignee: []
created_date: '2026-07-28 09:20'
labels:
  - cli
  - models
  - beta
dependencies: []
references:
  - packages/models/src/model-registry-config-preview.js
  - packages/core/src/llm-adapter.js
priority: high
type: feature
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MEASURED 2026-07-28. With Ollama live and 14 real models present (OLLAMA_MODELS=/data/ollama/models, 96GB), the two surfaces disagree:

  dema models discover      -> ollama reachable=true, 14 models listed by real id
  dema model-broker route   -> selected_model_id: null
                               reason: "no_acceptable_candidate"
                               rejected: operator-dema-face-placeholder,
                                         operator-pat-worker-placeholder,
                                         operator-sat-validator-placeholder,
                                         operator-router-placeholder,
                                         operator-classifier-placeholder,
                                         operator-consent-detector-placeholder
                               each: reason "status_source_pending"

This is NOT a defect — it is declared-unfinished, and honestly so. packages/models/src/model-registry-config-preview.js placeholderEntry() mints one placeholder per role with status "source_pending" and max_concurrency 0, and its own comment states the operator must supply a real config "via a future v0.2 file-loading slice with explicit consent" for routing to succeed. The honest default is working as designed; the v0.2 slice was never built.

Consequence for the beta: the routing/broker path cannot select a model, so anything downstream of `model-broker route` is unreachable even on a fully-provisioned machine. The direct adapter path (`dema llm-invoke`) DOES work end-to-end as of 452d047 — so the node can speak, just not through the broker.

The building blocks already exist in that module: validateRegistryEntry(), buildRegistryFromConfig(configInput) and mergeRegistries(sampleRegistry, operatorRegistry). What is missing is (a) where the operator roster file lives, (b) its schema, (c) the consent phrase that authorises loading it, and (d) whether a discovered-but-undeclared model may ever be auto-admitted (recommendation: NO — declaration must stay explicit, matching allow_unknown=false in the current route receipt).

Design decision needed before implementation — treat as a brainstorm, not a quick fix. Roles to fill: dema_face, pat_worker, sat_validator, router, classifier, consent_detector. Real candidates on this machine include whiterabbitneo-v3:7b-q4_K_M (operator-benchmarked 6/6), deepseek-r1:7b, gemma4:26b-bizra-16k, qwen3-coder-next:q4_K_M, nomic-embed-text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An operator roster declaration path exists with a documented location and schema, loaded only under an exact-string consent phrase
- [ ] #2 With a declared roster, model-broker route selects a real model id and emits a route receipt naming it
- [ ] #3 With NO declared roster, behaviour is unchanged — placeholders, no_acceptable_candidate, no silent auto-admission of discovered models
- [ ] #4 Red-first tests cover: declared roster routes, undeclared stays refused, and a discovered-but-undeclared model is never auto-selected
<!-- AC:END -->
