# BIZRA.ai Public Claim Containment 1A

## Status

- Review date: `2026-07-24`
- Live-surface observation: `MEASURED`
- Candidate-remediation distribution qualifier: `LOCAL_ONLY`
- Candidate-remediation deployment state: `UNKNOWN` — no deployment was performed or inferred
- Public signing state: `UNKNOWN` — signer rotation is pending
- Governed receipt: not issued

`LOCAL_ONLY` is an operational distribution qualifier used by
[`CURRENT_LIMITS.md`](../CURRENT_LIMITS.md). It is not an eighth public-claim
label. Every public claim remains bound to exactly one of the canonical seven:
`VERIFIED`, `MEASURED`, `DERIVED`, `SCENARIO`, `DESIGNED_NOT_LIVE`, `UNKNOWN`,
or `FORBIDDEN`.

## Purpose

This audit contains the current `bizra.ai` public-claim defect without
pretending that a local correction is already public. It records:

1. what the live deployment displayed during the dated observation,
2. which source routes and files can produce public claims,
3. why the observed claims are unsupported or unbound,
4. what the local candidate changes,
5. and which proof gates remain before any corrected deployment may be called
   live.

This is a governance and documentation artifact. It does not activate a
runtime, rotate a key, issue a receipt, push a branch, or deploy a site.

## Capture boundary

The live root was inspected with a browser-rendered DOM at
`2026-07-24T11:21:22Z`. The response was HTTP `200`, served by Vercel, and the
response headers identified the matched path as `/`. A same-session HTTP route
probe returned `200` for:

```text
/
/atlas
/book
/dema
/docs
/films/index.html
/genesis
/info
/install/index.html
/lab
/login
/manifest
/research
/showcase
/terminal
/wallet
```

An unauthenticated API probe at `2026-07-24T11:28:52Z` through
`2026-07-24T11:28:54Z` also observed:

| Live route | HTTP status | Public response concern |
| --- | --- | --- |
| `/api/health` | `200` | Claimed `healthy` and exposed uptime, version, build ID, environment, and Redis state without a canonical claim label. |
| `/api/beta/status` | `200` | Exposed invite configuration, persistence state, operational gaps, and a noncanonical `PREVIEW_DIAGNOSTIC_ONLY` label. |
| `/api/ethics` | `200` | Published baseline Ihsan/SNR values and `COMPLIANT` without a public evidence binding. |
| `/api/scaffold/evidence` | `500` | Confirmed the claim-bearing endpoint was publicly reachable even though its evidence load failed. |
| `/api/scaffold/health` | `200` | Exposed host hardware, uptime, agent status, and model status. |
| `/api/scaffold/metrics` | `200` | Exposed an absolute deployment path, a source hash, and the same unbound metric family rendered by the root page. |

The machine-readable follow-up capture at `2026-07-24T11:49:58Z` issued
credential-free `GET` requests to `62` fixed public-surface candidates. It
recorded `37` HTTP `200`, `23` HTTP `401`, one HTTP `404`, and one HTTP `500`.
Expected-private API bodies were retained as status, byte length, and SHA-256
only. Raw bodies were not retained. Six legacy public-text responses exceeded
the redacted-text cap and are explicitly marked truncated, so this report is
inventory evidence, not a complete exact-text transcript.

The report is stored in the local site candidate as
`docs/launch/evidence/public-claim-live-capture-2026-07-24.json`, with file
SHA-256
`83660c1e64951aaea8aaf32f7fa63482071a13130ea988fb2b082db0b1f6ec6b`.
Its `deploymentSourceBinding` is `UNVERIFIED`; it does not identify the live
deployment's git commit.

The capture commands are reproducible:

```bash
google-chrome --headless=new --no-sandbox --disable-gpu \
  --virtual-time-budget=5000 --dump-dom https://bizra.ai

curl -sSIL https://bizra.ai
curl -sS -o /dev/null -w '%{http_code}' "https://bizra.ai/<route>"
```

The observation proves what those URLs returned at that time only. It does not
identify the deployed git commit. Vercel's response did not expose a source
SHA, so deployment-to-source provenance remains `UNKNOWN`.

## Route, source, and evidence inventory

### Source baseline inspected

The inspected source candidate was `BizraInfo/award-winner-design` at
`568ab0b41c32f812b8ce4d20e7f4ffdf1ebffd6e`. That SHA matched the repository's
local `origin/main` during this audit. It is a source-review anchor, not proof
that Vercel deployed that SHA.

Source page routes present at that anchor:

```text
/
/atlas
/book
/dema
/docs
/genesis
/info
/invites/[token]
/lab
/login
/manifest
/research
/settings/team
/showcase
/showcase/maestro
/showcase/pipeline
/terminal
/wallet
```

Static HTML claim surfaces present at that anchor:

```text
/architecture-atlas.html
/films/BIZRA Federation Atlas.dc.html
/films/BIZRA Mission Thesis.dc.html
/films/BIZRA The Third Fact.dc.html
/films/index.html
/install/index.html
/sovereign-emergence.html
```

Principal source locations for the observed root claims:

- `components/sovereign/trust-site.tsx`
- `components/sovereign/live-network-stats.tsx`
- `public/data/metrics.json`

The source review also found public or claim-bearing API surfaces under:

- `app/api/health/route.ts`
- `app/api/beta/status/route.ts`
- `app/api/ethics/route.ts`
- `app/api/scaffold/evidence/route.ts`
- `app/api/scaffold/health/route.ts`
- `app/api/scaffold/metrics/route.ts`
- `app/api/genesis/route.ts`
- `app/api/node/activate/route.ts`
- `app/api/auth/login/route.ts`

At the inspected source baseline, the authentication route and adjacent login
and canary surfaces contained hard-coded demonstration credentials. This audit
does not reproduce them. The local candidate removes those known values and
holds login and refresh closed with HTTP `503`. That is containment only:
session invalidation, external identity-provider repair, secret rotation, and
restored authentication have not been proven.

Additional high-risk source routes include:

- `app/info/page.tsx` — unbound code, crate, agent, gate, and test counts
- `app/lab/page.tsx` — metrics presented as verified without a bound artifact
- `app/docs/page.tsx` — pinned test counts and token-economy wording
- `app/wallet/page.tsx` — live-ledger, balance, mint, and governance language
- `app/research/page.tsx` — token-economics positioning
- `public/films/**` — federation and URP visual narratives

Public APIs are not page-copy evidence. Any API output reused as a public claim
requires its own schema, evidence path, canonical label, and Claim Review Gate.
Unauthenticated API output is itself a public surface, so page containment
alone cannot close this incident.

## Claim disposition

Quoting a defective phrase here is an audit act, not republication approval.

| Observed live text or presentation | Required disposition | Evidence defect | Containment decision |
| --- | --- | --- | --- |
| “Live Receipt Chain” | `UNKNOWN` | No public chain head, verifier command, trusted signer binding, or deployment-specific artifact was linked. | Remove from public copy until a trusted, independently verifiable evidence path exists. |
| “Live Network Data” beside `1` live node, `12,680` tests, `654` commits, `24` Rust crates, `84,795` vectors, `18` Z3 proofs, `70%` coverage, `0.007ms` membrane tax, `0` vulnerabilities, and `12` agents per node | `UNKNOWN`; each number would require `MEASURED` evidence before publication | No command, environment, timestamped artifact, source SHA, or deployment binding accompanied the figures. | Remove the panel. Pinned counts may return only with recorded conditions and a reachable artifact. |
| “Machine-enforced. No exceptions.” | `UNKNOWN` | The absolute wording was not bound to a named mechanism or exhaustive enforcement proof. | Remove or replace with a mechanism-specific `VERIFIED` claim and evidence link. |
| “Every layer has code. Every layer has tests.” | `UNKNOWN` | No layer-to-repository inventory or exact-SHA test evidence was linked. | Remove until every named layer has a reachable source and test path. |
| “BIZRA turns every human into a sovereign node … shared intelligence, capability, and value.” | `DESIGNED_NOT_LIVE` at most for shared-runtime and economic implications | Shared URP, federation, and economic settlement are not live under the Dema canon. | Replace with bounded local-product language or explicitly say “designed, not live.” |
| `12 agents (Ed25519)`, “Keys LOCAL,” and identity-adjacent live wording | `UNKNOWN` | Signer rotation is pending; this audit has no currently trusted public signing-identity evidence. | Remove identity assurance and issue no new signed public claim. |
| `SEED + Zakat + Gini`, `22 SEED`, wallet/mint language, or a live economic layer | `FORBIDDEN` when presented as current public capability | No live, legally reviewed, technically validated economic layer is evidenced. | Remove or route-contain. Design discussion may use `DESIGNED_NOT_LIVE` only. |
| URP, peer federation, or network visuals presented as current behavior | `FORBIDDEN` when presented as live; otherwise `DESIGNED_NOT_LIVE` or `SCENARIO` with assumptions | No validated multi-node or shared-runtime proof is linked. | Route-contain legacy pages and films until each is individually reviewed and labeled. |
| “0 vulnerabilities” | `UNKNOWN` | No dated scanner scope, dependency/source boundary, tool versions, or artifact was linked. | Remove. Do not translate a limited scan into an absolute security claim. |
| Public `/api/health` process and deployment details | `UNKNOWN`; a narrowly scoped health observation may be `MEASURED` | The response mixed a transient process observation with build, environment, persistence, and deployment implications. | Minimize to status, measurement time, exact scope, and one canonical label; keep verbose details authenticated. |
| Public `/api/beta/status` configuration and persistence narrative | `UNKNOWN` | `PREVIEW_DIAGNOSTIC_ONLY` is not one of the seven canonical labels, and the response mixed access state with operational configuration claims. | Minimize or assign one canonical label per claim with an evidence path. |
| Public Ihsan, SNR, compliance, hardware, agent, model, and scaffold metrics | `UNKNOWN`; economic or live-runtime implications may be `FORBIDDEN` | No public evidence path bound the responses, and one endpoint disclosed an absolute deployment path. | Require authentication or remove; never reuse the output as public proof. |

Every row above fails at least one step of the
[Claim Review Gate](../CLAIM_REGISTER_v0_1.md#20-claim-review-gate). The live
deployment therefore remains a release-blocking claim defect until corrected
and re-crawled.

## Local candidate remediation

A local candidate exists in `BizraInfo/award-winner-design` on branch
`fix/public-claim-binding-1a`, based on
`568ab0b41c32f812b8ce4d20e7f4ffdf1ebffd6e`.

The candidate:

- replaces `/` with a dated evidence-boundary page,
- links the Dema Claim Register and Current Limits at Dema commit
  `079fee557d7c230f2e6c076cc7a776418a393235`,
- omits pinned public metrics,
- [DECLARED] labels federation, shared URP, token economics, and Proof-of-Impact rewards
  `DESIGNED_NOT_LIVE`,
- labels the pending signer state `UNKNOWN`,
- redirects every unreviewed non-API public route to the reviewed root with a
  containment marker,
- replaces all `17` non-root App Router page implementations with minimal
  server-side containment wrappers so legacy claims are not compiled into
  publicly fetchable route chunks,
- keeps the reviewed root and a narrow image-asset allowlist available,
- removes the legacy global error fallback from the reviewed layout so its
  “kernel” and “self-correction” wording cannot bypass the boundary,
- applies beta admission before public mutation routing,
- requires authentication for the observed ethics and scaffold endpoints,
- requires authentication for genesis and node-activation mutations even when
  beta access mode is public,
- minimizes the unauthenticated health response to a timestamped,
  `web_process_health_only` measurement,
- minimizes beta-status and successful beta-admission responses to one
  request-scoped access schema,
- removes the known source-embedded demonstration credentials, holds login and
  refresh closed, and requires canary credentials through environment input,
- inventories all `41` exported HTTP method/source pairs, never executes a
  non-`GET` method during capture, and probes every fixed non-secret `GET`
  route without ambient credentials,
- retains expected-private probe bodies as status, byte length, and body hash
  only,
- fails the production build if known legacy claim phrases or demonstration
  credential markers appear under `.next/static` or `.next/server/app`,
- and keeps authentication restoration explicitly unresolved.

Candidate source and test surfaces:

- `lib/public-claims/boundary.ts`
- `app/page.tsx`
- `app/public-boundary.module.css`
- `app/api/health/route.ts`
- `app/api/beta/status/route.ts`
- `app/api/beta/verify-invite/route.ts`
- `app/api/auth/login/route.ts`
- `middleware.ts`
- `lib/beta/public-status.ts`
- `lib/public-claims/containment.ts`
- `lib/public-claims/surfaces.ts`
- `scripts/check-public-build-assets.mjs`
- `scripts/capture-public-claims.mjs`
- `scripts/verify-canary-rollback-drill.sh`
- `tests/unit/public/public-claim-boundary.test.tsx`
- `tests/unit/public/public-health-boundary.test.ts`
- `tests/unit/public/public-beta-status-boundary.test.ts`
- `tests/unit/public/public-build-containment.test.ts`
- `tests/unit/public/auth-integrity-hold.test.ts`
- `tests/unit/public/public-surface-inventory.test.ts`
- `tests/unit/security/middleware.test.ts`

The candidate's existence is `VERIFIED` by those local source paths. Its
distribution qualifier is `LOCAL_ONLY`. Its public deployment state remains
`UNKNOWN`: no push, merge, Vercel deployment, DNS change, or post-deploy crawl
is represented by this document.

The pinned Dema evidence commit predates this July containment audit. Before
deployment, those links must move to the exact Dema commit that contains this
audit and its Claim Register / Current Limits updates. A mutable `main` link or
the older pin cannot prove the July correction.

## Receipt and signer boundary

[DECLARED] No Claim Receipt or other cryptographic receipt is created by this slice.
Signer rotation is pending, so issuing a new identity-bound artifact would
increase ambiguity instead of reducing it. The audit is bound by source paths,
capture conditions, and git history only.

After key rotation, a future receipt may be drafted and handed to the governed
runtime only after:

1. the old signer is rejected,
2. the new signer is independently accepted,
3. the exact corrected deployment SHA is known,
4. the post-deploy crawl is green,
5. and the operator supplies the exact required consent.

Dema reads receipts; it does not mint governed-runtime receipts.

## Closure gates

The containment incident is not closed until all of the following are true:

- the local candidate passes its focused tests, full site test suite, type
  checks, build, and diff check;
- the public evidence links pin the exact Dema commit containing this audit;
- a human reviews every route and static HTML surface in this inventory;
- every unauthenticated API response, metadata route, and alternate error
  surface is either claim-reviewed or contained;
- an exact source commit is approved for deployment;
- deployment receives separate explicit operator authorization;
- production provenance binds the deployed artifact to that exact commit;
- a credential-free post-deploy crawl of pages, static text, metadata, and
  public APIs returns no unsupported, stale, revoked-signer, privacy-leaking,
  noncanonical-label, or unlabeled claim;
- the Claim Register and Current Limits links resolve from production;
- and any future signed claim receipt uses the rotated trusted signer.

Until those gates pass, the truthful state is:

```text
LIVE CLAIM DEFECT: OBSERVED
LOCAL CONTAINMENT CANDIDATE: PRESENT
CORRECTED DEPLOYMENT: NOT CLAIMED
NEW CRYPTOGRAPHIC RECEIPT: NOT ISSUED
```
