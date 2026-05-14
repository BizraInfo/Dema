# Dema Delivery Blueprint

This blueprint defines the current elite delivery posture for Dema without introducing deployment, secrets, cloud resources, or hidden runtime behavior.

## Management Body of Knowledge alignment

Every release candidate must make these management domains explicit:

| Domain | Dema release evidence |
| --- | --- |
| Integration management | `npm run check` composes tests, CLI smoke, proof replay, and release-readiness audit. |
| Scope management | BIZRA Review Gate classifies proof PRs and limits allowed file scope. |
| Schedule management | Releases remain milestone-based; no time claim is embedded in code. |
| Cost management | Zero runtime dependencies and no implicit cloud spend. |
| Quality management | Node 20/22 tests, CodeQL, Socket, BIZRA Review Gate, proof replay. |
| Resource management | Installer posture is audited; no daemon or external provider is started. |
| Communications management | Proof pins and PR governance notes document decisions. |
| Risk management | `scripts/release-readiness.mjs` reports fail/review/improvement risks. |
| Procurement management | Third-party AI reviewers are advisory, not constitutional gates. |
| Stakeholder management | User-facing claims stay bounded, local-first, and non-hype. |

## CI/CD posture

Current CI is continuous integration, not deployment:

- `.github/workflows/check.yml` runs Node 20.x and 22.x.
- `.github/workflows/codeql.yml` runs CodeQL security analysis.
- `.github/workflows/bizra-review.yml` runs first-party proof-quality checks.
- No continuous delivery target is configured.
- No release workflow, package publish, cloud deploy, domain, TLS, or secret-manager integration is active.

## First-party quality gates

Required Dema-owned evidence:

```bash
npm test
npm run check
node scripts/node0-self-check.mjs --verify
node scripts/review/pr-class.mjs --class proof/u1
node scripts/review/proof-scope.mjs --class proof/u1
node scripts/review/no-overclaim.mjs --class proof/u1
node scripts/review/receipt-integrity.mjs --class proof/u1
node scripts/release-readiness.mjs
```

`scripts/release-readiness.mjs` is a read-only audit. It fails only first-party invariants that Dema can enforce immediately, and reports other release-hardening work as advisory risks.

## Performance and quality assurance

Current measurable posture:

- Zero runtime dependencies.
- No build step.
- No runtime daemon.
- CLI smoke coverage through `npm run check`.
- Proof replay through Node0 self-check verification.
- Security analysis through CodeQL and dependency posture through Socket.

Known hardening backlog:

- Pin GitHub Actions to immutable commit SHAs.
- Add coverage thresholds when dependency policy allows measurement tooling.
- Promote installer dry-run/check validation into release-candidate checklist.
- Add rollback notes once a real release/deployment target exists.

## Boundary

This blueprint does not authorize:

- Deployment
- Release
- Tagging
- Cloud resources
- Secrets
- Public network/federation claims
- Token or cash-value claims
- SAT PERMIT claims
- Hidden daemons or supervisors

Third-party tools may advise. BIZRA-owned gates decide.
