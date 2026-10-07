# BIZRA Enterprise Delivery Blueprint v0.1

**Status:** `PROPOSED_DESIGN_SPECIFICATION` · `authority_delta:0` · `mode: synthesis`
**Ancestors:** canon landing `567fb49..ffcfe2d` (CI-green on origin/main) · DEMA four-wiring-point slice law · G8 fail-closed gate practice · PERF-MEASURE-1A measurement discipline
**Scope:** generic enterprise SaaS platform delivery system; assumptions stated inline and adjustable without invalidating the structure.
**Truth discipline:** design prose ≠ empirical fact. Nothing here proves a running system exists, that any team was staffed, or that any number below has been measured on real infrastructure. Every target is a *goal*, labeled as such. No execution, daemon, network, key, token, wallet, or federation is created or claimed by this document.

---

## 0. Assumptions

| Assumption | Value | Change impact |
|---|---|---|
| Product shape | B2B SaaS, multi-tenant | HIPAA module toggled by compliance flag |
| Growth target | 50k → 500k MAU over 24mo | messaging tier (NATS→Kafka) revisited at 100k msg/s |
| Cloud | AWS primary, one secondary region | DR numbers in §3.4 assume warm standby |
| Team | 12 FTE | phase durations scale roughly with 1/team-size |
| Compliance | SOC2 Type II + GDPR mandatory; HIPAA optional | §1.4 matrix prunes if flag off |

---

## 1. Technical Architecture

### 1.1 Component map and data flow

```text
[Web SPA]──┐                                  ┌──[AuthN/Z: OIDC IdP]
[Mobile]───┼──[CDN/WAF]──[API Gateway]═══╗    ├──[Policy Engine OPA]
[Partner]──┘        │          (REST+gRPC) ║────┤
                    ▼                      ║    └──[Rate Limiter]
             [BFF / Edge Services]         ║
                    │                      ║
      ┌─────────────┼──────────────┐       ║
      ▼             ▼              ▼       ║
 [Core Domain  [Workflow/Async   [Reporting ║
  Services]     Jobs via Queue]  Read Models]║
      │             │              │       ║
      ▼             ▼              ▼       ║
 [PostgreSQL ◄──[Event Bus]──►[Redis]     ║      ╔═[Service Mesh mTLS]
  primary+replicas](JetStream) cache      ║══════╝
                                          [Worker Fleet]──►[Object Store][Search]
```

Interaction laws:

1. Synchronous gRPC reserved for low-latency reads; every state change flows through the event bus.
2. Transactional outbox at producers; at-least-once delivery; idempotent consumers keyed on event ID.
3. No service reads another service's database — ever. Integration is contracts, not shared state.

### 1.2 Technology stack evaluation

| Layer | Selection | Justification against alternatives |
|---|---|---|
| Frontend | React 19 + TypeScript strict + Vite | talent pool depth; Vite dev/build ≈5× Webpack; RSC adoptable later without rewrite |
| Client state | TanStack Query + Zustand | server-cache discipline without Redux ceremony |
| Edge/BFF | Node.js 22 + Fastify | ≈3× Express p99 throughput; shared TS types with frontend |
| Core domains | Go | goroutine fan-out for high-throughput paths; single static binary deploys |
| Primary DB | PostgreSQL 16 (Aurora) | ACID + JSONB escape hatch + logical replication for near-zero-downtime migration |
| Cache | Redis 7 cluster mode | sub-ms reads, native TTL, atomic rate-limit primitives |
| Messaging | NATS JetStream | ~10× lighter ops than Kafka at target scale; dedup window gives adequate exactly-once semantics |
| Search | OpenSearch | managed, mature pagination/PIT |
| AuthN | OIDC (Keycloak self-host / Auth0 managed) | enterprise SSO/SAML/MFA out of the box; never roll custom crypto |

### 1.3 Scalability architecture

- Stateless services only (JWT claims + Redis-backed session); HPA on p95 latency AND queue depth.
- Read replicas serve reporting path; primary reserved for transactional writes.
- L7 balancing with least-outstanding-requests; mesh retries capped at 20% load budget.
- N+1 guardrail enforced in CI: query-count assertion per endpoint ≤5.
- Cursor pagination everywhere; OFFSET forbidden beyond page 1.
- Cache stampede protection via single-flight request coalescing.

### 1.4 Security framework

| Control | Design |
|---|---|
| Authentication | OIDC; MFA forced for privileged roles; 15m access tokens; rotating refresh with reuse detection |
| Authorization | RBAC baseline + ABAC policy layer (OPA/Cedar), deny-by-default, evaluated server-side only |
| Encryption | TLS 1.3 transit; AES-256-GCM rest via KMS per-env data keys; field-level encryption for PII columns |
| Threat modeling | STRIDE per service at design review; abuse cases enter backlog as first-class stories |
| SOC2 mapping | immutable audit log (write-once storage, 7y retention); access reviews quarterly |
| GDPR mapping | DSAR automation; EU residency pinning; erasure via crypto-shredding + tombstone hash proof |
| HIPAA (flagged) | BAAs required; PHI-tagged fields blocked from logs by scrubber middleware |
| Supply chain | SLSA-3 target: cosign-signed images, SBOM per artifact, provenance verified at admission |

### 1.5 Integration patterns

- Third-party SaaS behind anti-corruption layers; vendor DTOs never cross the ACL boundary.
- Legacy systems via strangler fig: facade routes progressively; dual-write phase guarded by reconciliation jobs with mismatch alerts before cutover.
- Webhooks accepted only with HMAC signature + timestamp window; outbound calls wrapped in circuit breakers (fail-open reads, fail-closed writes).

### 1.6 Database design

- 3NF transactional core; denormalization confined to rebuildable CQRS read models.
- Composite indexes ordered by selectivity; covering indexes on hot paths; `EXPLAIN ANALYZE` diff required in schema PRs.
- Retention: PII 24mo rolling; audit events 7y immutable; soft-delete grace 30d then purge with tombstone hash.
- Monthly range partitions on event tables; retention executes as `DROP PARTITION` (O(1)) not `DELETE`.

---

## 2. Development Methodology

### 2.1 Cadence

Two-week sprints; capacity planned at 70% (30% interrupt buffer scheduled, not stolen). Weekly refinement; stories exit INVEST-checked with Gherkin acceptance criteria. Retro actions carry owners and deadlines on the same board as features.

### 2.2 Team composition (12 FTE)

| Role | Count | Non-negotiable bar |
|---|---|---|
| Solution Architect | 1 | distributed-systems production scars; owns ADR sign-off |
| Backend (Go/Node) | 4 | SQL fluency mandatory; ≥1 Go specialist |
| Frontend | 2 | TS strict; WCAG 2.2 AA |
| QA/SDET | 2 | builds test frameworks, not manual scripts |
| DevOps/SRE | 2 | Terraform+K8s at certification depth; designs own on-call |
| Product Owner | 1 | writes acceptance criteria unaided; empowered to refuse scope |

### 2.3 Code quality standards

Lint+typecheck blocking; cyclomatic complexity ≤10/function; ADR required for any decision costing >1 day to reverse (Context→Options→Decision→Consequences); JSDoc on exported API surfaces only. Review gates: 2 approvals on security/database paths, 1 elsewhere; PR ≤400 LOC; 24h review SLA.

### 2.4 Version control strategy

Trunk-based; short-lived feature branches (≤3 days, squash-merge); protected always-releasable `main`; release branches receive cherry-picks only; hotfixes cut from prod tags and backported. Feature flags carry creation-time expiry dates; breach auto-files deletion ticket (flags are tracked debt).

### 2.5 Knowledge transfer

Runbook-as-code (every alert links its runbook path); quarterly module pairing rotations; quarterly architecture-tour refresh; bus-factor alarm when any module has <2 knowledgeable people — becomes a sprint theme automatically.

---

## 3. DevOps & Infrastructure

### 3.1 Pipeline architecture

```text
commit → lint/typecheck → unit (≥85% changed lines)
      → SAST+SCA (fail critical/high)
      → container build (multi-stage distroless) + SBOM + sign
      → integration (testcontainers: pg/redis/nats real)
      → contract tests (Pact broker verification gate)
      → DEV auto-deploy → E2E smoke (20 golden journeys)
      → STAGING auto-deploy → k6 budget gate (p95<300ms @2× peak)
      → PROD canary 5% → automated analysis vs baseline
      → 25% → 100%        rollback <120s; auto on SLO burn
```

Promotion by digest: the staged image ships bit-for-bit; rebuilding for an environment is forbidden.

### 3.2 Testing strategy

| Tier | Target | Gate |
|---|---|---|
| Unit | ≥85% changed-line coverage; mutation score ≥60% on money paths | blocking |
| Integration | real dependency containers | blocking |
| Contract | provider cannot break verified consumer | blocking |
| E2E | 20 golden journeys, Chromium+WebKit | release branches |
| Performance | k6 load/stress/soak trio | pre-release blocking |
| Security | ZAP nightly; annual pentest + on arch change | SLA-tracked |

### 3.3 Infrastructure as Code

Terraform (network/data, OPA plan policies) + Kubernetes + Helm value overlays (environments never fork). Drift-detection cron files tickets. Secrets via External Secrets Operator from AWS Secrets Manager; zero secrets in git; secret scanning enforced in CI.

### 3.4 Deployment and disaster recovery

Canary default; blue-green reserved for risky migrations. Expand-only DB migrations (additive now, contract next release); no down-migration reliance. Targets (goals, unproven until rehearsed): RPO ≤5min via WAL streaming; RTO ≤60min warm standby; restore-from-backup tested monthly; timed game-day rehearsal quarterly.

### 3.5 Observability

OpenTelemetry traces+metrics unified; Prometheus/Grafana; SLOs phrased in user terms (99.9% availability, p95 <300ms); error-budget policy freezes features on exhaustion; structured JSON logs PII-scrubbed at emit; paging restricted to SLO burn-rate alerts — all else dashboard-tier.

---

## 4. Quality Assurance Framework

Gherkin scenarios are executable and graduate into E2E specs (PO sign-off = green run). Performance baselines re-recorded each release; >10% regression fails build. Vulnerability SLAs: critical 24h, high 7d, medium 30d; weekly dependency audit. Audit trail: every privileged action logged immutably with actor, reason, before/after hash. Docs: OpenAPI generated from code (drift fails build); runbooks per alert; user guides versioned with releases; docs-lint CI job.

---

## 5. Project Execution Plan

### 5.1 Executive summary

Deliver a compliant horizontally-scalable SaaS platform in 6 phases (~26 weeks, 12 FTE). Strategic objectives: first revenue week 14; compliance posture native from Phase 0; reliability governed by error budgets. Investment envelope: 78 team-months plus growing infra spend. Key success factors: expand-only migrations, contract-tested integrations, digest-promoted artifacts.

### 5.2 Phases, milestones, sign-off

| Phase | Weeks | Milestone / acceptance criteria | Sign-off |
|---|---|---|---|
| 0 Foundation | 1–3 | repo, IaC skeleton, pipeline green end-to-end on hello-world service, threat model v1 | Architect + Sec |
| 1 Walking Skeleton | 4–7 | one vertical slice through every layer; E2E green inside CD | Eng leads |
| 2 Core Domains | 8–13 | authn/z live; billing domain complete; contract suites published | PO + QA |
| 3 MVP Hardening | 14–18 | load @2× target passed; canary machinery proven by forced-failure drill; DR rehearsal #1 timed | SRE + Exec |
| 4 Compliance & Beta | 19–23 | SOC2 evidence automated; beta cohort onboarded; pentest findings remediated | CISO + Beta lead |
| 5 GA Launch | 24–26 | SLOs met 30 consecutive days; runbooks audited; support playbook live | Exec committee |

Critical path: 0→1→billing→perf gate→SOC2 evidence→GA. One centrally-held buffer sprint, released by architect decision only; slippage >1 week triggers scope renegotiation, never silent quality reduction.

### 5.3 Risk register (top 5)

| Risk | P | I | Mitigation | Contingency | Owner |
|---|---|---|---|---|---|
| Legacy integration unknowns | H | H | week-1 spike; ACL isolation | manual bridge runbook | Architect |
| SOC2 slip | M | H | evidence automation from Phase 0 | announce SOC2-in-progress | CISO |
| Key-person loss (Go core) | M | H | pairing rotation; bus-factor alarm | contract specialist retainer | Eng mgr |
| Migration incident | L | H | expand-only; shadow reads | replica-promotion rollback | SRE |
| Scope creep | H | M | flag expiry; PO veto | central buffer consumption | PO |

### 5.4 Success metrics framework

DORA: lead time <2d, daily deploys, change-fail <10%, MTTR <30m. Quality: escaped defects <0.5/KLOC, mutation ≥60%, flaky-test quarantine expires 48h. Performance: p95 <300ms @2× peak; 99.9%; error budget never exhausted twice consecutively. Business: TTV week 14; beta NPS >40; ≥4/5 stakeholder rating per phase gate.

---

## Boundary statement

This document is a design specification. It creates no runtime, provisions nothing, measures nothing, and grants no authority. Any implementation derived from it must earn its claims through the same evidence discipline as everything else in this repository: measured slices, review gates, receipts, and honest ceilings.
