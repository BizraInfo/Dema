# 06 · Tool & Technology Matrix

**Status:** validated-live where marked ✅ · targets marked ◇

## Currently operational

| Tool | Version | License | Role | Validation |
|---|---|---|---|---|
| Node.js | v22.22.2 | MIT-variant | law kernels/CLI/CI | ✅ probe 2026-08-26 |
| npm | 10.9.7 | Artistic-2.0 | zero-dep test runner (`node --test`) | ✅ |
| Rust toolchain (rustc/cargo) | 1.94.1 | Apache/MIT | boundary workspace | ✅ |
| GitHub Actions | n/a (5 workflows) | hosted | check·review-gate·CodeQL·gitleaks·rail-aggregation | ✅ all-green sweeps |
| Backlog.md CLI | active | OSS | task governance, CLI-only mutation | ✅ |
| git | ≥2.40 | GPLv2 | hash-addressed lineage both repos | ✅ |
| `gh` CLI | current | MIT | run watch/enumeration | ✅ |
| sha256 / canonical-json-v1 | in-repo kernels | proprietary-canonical | single byte contract | ✅ vectors tested |

## Workspace crates & dependencies (realm-shell)

| Crate | Deps (vetted) | License field |
|---|---|---|
| dema-presence-service | tokio 1 · serde_json 1 · sha2 0.10 · hex 0.4 | UNLICENSED (internal) |
| omarchy-shell-wrapper | dema-presence-service | UNLICENSED |
| host-conformance | serde 1 · serde_json 1 · dema-presence-service | UNLICENSED |
| qualification | sha2 · serde · serde_json · hex + workspace peers | UNLICENSED |

## Forward stack (targets — procurement/licensing at Phase P4)

PostgreSQL 16 (Aurora) · Redis 7 (ElastiCache) · NATS JetStream 2.x ·
OpenSearch 2.x · React 19 + Vite 6 + TS strict · Fastify 5 · Go 1.23 ·
Terraform ≥1.9 + OPA · Kubernetes/EKS + Helm 3 · OpenTelemetry SDK 1.x ·
Prometheus/Grafana · k6 · Playwright 1.4x · Trivy/syft/cosign ·
ZAP baseline · Auth0 or Keycloak (self-host) · AWS Secrets Manager +
External Secrets Operator.

All forward items carry license review before first commit that imports
them (zero-surprise dependency law).
