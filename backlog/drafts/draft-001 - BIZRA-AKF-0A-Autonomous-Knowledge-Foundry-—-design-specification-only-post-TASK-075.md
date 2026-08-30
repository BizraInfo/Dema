---
id: DRAFT-001
title: >-
  BIZRA-AKF-0A: Autonomous Knowledge Foundry — design specification only (post
  TASK-075)
status: Draft
assignee: []
created_date: '2026-08-27 18:23'
labels: []
dependencies:
  - TASK-075
references:
  - 'https://github.com/anomalyco/opencode'
documentation:
  - docs/receipts/DEMA_TRACE_DIAGNOSTIC_CONTRACT_1A.md
  - docs/02-architecture/SAT_ROLE_BOUNDARY.md
  - packages/core/src/peak-self-loop-preview.js
  - packages/core/src/self-loop-ooda.js
  - packages/core/src/rsi-proposal-preview.js
  - packages/core/src/self-awareness-report.js
priority: low
type: spike
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document a future design specification for BIZRA Autonomous Knowledge Foundry (AKF v1) — a source-grounded extraction pipeline: SourceRegistry (content-addressed) → normalize/parse → semantic segmentation → agentic extraction swarm (entity/relation/claim/event/temporal/ontology/resolver/contradiction/provenance) → verifier ensemble (reject/accept with repair loop) → canonical graph (graph+vector+lexical) → agentic retriever (graph traversal + semantic + neighborhood + provenance + temporal + contradiction) → RAG with answer+evidence. Reuses the source-registry primitive already shipped in TASK-075.18 (Genesis Root-Bound Estate Refinery 0A — 4 bounded schemas: asset/claim/receipt-shaped evidence/approved source-root) and the Foundry-0A pattern from TASK-008 (DEMA-ULTRA-MICRO-NICHE-FOUNDRY-0A). Two founding invariants distinguish this from a generic graph-RAG: (1) NO claim enters canonical knowledge because an LLM asserted it; it enters only when source produced evidence, agents transformed it, independent checks validated it, provenance survived, and state is replayable. (2) Completion condition is not 'graph_written==true'; it is source_grounded AND schema_valid AND provenance_complete AND entity_resolution_passed AND contradiction_status_known AND graph_integrity_passed AND retrieval_eval_passed AND answer_citation_eval_passed AND checkpoint_sealed. SCOPE: design specification only — no source registry kernel, no extraction swarm, no verifier, no graph index, no retriever. DOES NOT pre-empt TASK-075 (NODE0-DEMA-PRODUCTION-CLOSURE-1A); explicitly deferred until after production closure + sovereign custody ceremony. Pre-flight observation: the Z.ai reverse-engineering analysis (24 logged tasks, 20 git commits, 821-line worklog.md, .zscripts/build.sh standalone-recovery, next.config.ts ignoreBuildErrors+reactStrictMode=false, multi-agent decomposition with principal-engineer-auditor read-only, PerformanceTelemetry reflexive instrumentation) suggests workspace+subagent+worklog+checkpoint primitives transplant cleanly; the missing primitive in Z.ai is mechanical-not-narrative provenance, which is exactly what TASK-075.18 + dema receipts already provide. Pre-activation references: docs/receipts/DEMA_TRACE_DIAGNOSTIC_CONTRACT_1A.md, docs/02-architecture/SAT_ROLE_BOUNDARY.md, packages/core/src/peak-self-loop-preview.js, packages/core/src/self-loop-ooda.js, packages/core/src/rsi-proposal-preview.js, packages/core/src/self-awareness-report.js. NOT a model. NOT network. NOT runtime. NOT mint. NOT federation. authority_delta 0.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Specification file at docs/02-architecture/BIZRA_AUTONOMOUS_KNOWLEDGE_FOUNDRY_0A.md names the 6 pipeline layers, the 5 founding invariants, the 9-condition completion law, the source-registry primitive reuse from TASK-075.18, and the deferral rule gated by TASK-075 production closure
- [ ] #2 Specification explicitly enumerates Z.ai patterns adopted (workspace plane, worklog.md, subagent decomposition with creator/verifier split, browser+VLM verifier, PerformanceTelemetry-style reflexive instrumentation) AND Z.ai weaknesses avoided (typescript ignoreBuildErrors, reactStrictMode=false, prose-claiming-verification)
- [ ] #3 Specification defines a red-first static test at tests/bizra-autonomous-knowledge-foundry-0a-spec.test.js that fails the spec if it (a) names an LLM as the authority for canonical knowledge, (b) names 'graph_written==true' as a completion condition, (c) names any Z.ai weakness as accepted, (d) is not gated on TASK-075 closure + sovereign custody
- [ ] #4 Definition of Done explicitly excludes: implementation, source registry kernel, extraction swarm, verifier ensemble, graph index, retriever, model invocation, network, runtime activation, mint, PoI, federation, TASK-075 scope drift
<!-- AC:END -->
