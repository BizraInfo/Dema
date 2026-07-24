# BIZRA.ai Public Claim Containment 1A

## Status

- Review date: `2026-07-24`
- Initial live-surface defect observation: `MEASURED`
- Corrected site source: `VERIFIED` — `BizraInfo/award-winner-design@6f7f545e6a1ac044cbb8d29a0a215e8a9f2885bf`
- Production deployment record: `VERIFIED` within the GitHub record's scope — deployment `5590104450`, environment label `Production – award-winner-design`, status `success`
- Custom-domain-to-deployment relationship: `DERIVED` — a live same-origin runtime asset embeds the matching Vercel deployment identifier; the provider alias API was not readable
- Credential-free production crawl: `MEASURED` — `62` inventoried surfaces at `2026-07-24T16:18:28.000Z`
- This Dema evidence update: `LOCAL_ONLY` until its review branch is pushed and approved
- Public signing state: `UNKNOWN` — signer rotation is pending
- Governed receipt: not issued

`LOCAL_ONLY` is an operational distribution qualifier used by
[`CURRENT_LIMITS.md`](../CURRENT_LIMITS.md). It is not an eighth public-claim
label. Every public claim remains bound to exactly one of the canonical seven:
`VERIFIED`, `MEASURED`, `DERIVED`, `SCENARIO`, `DESIGNED_NOT_LIVE`, `UNKNOWN`,
or `FORBIDDEN`.

## Purpose

This audit records the `bizra.ai` public-claim defect and the later production
containment without treating either event as evidence of Node0 runtime
capability. It records:

1. what the live deployment displayed during the dated observation,
2. which source routes and files can produce public claims,
3. why the observed claims are unsupported or unbound,
4. what the containment candidate changed,
5. which exact source commit the Vercel GitHub deployment integration recorded
   under environment label `Production – award-winner-design`,
6. what the credential-free post-deploy crawl measured,
7. and which signer and Dema-review gates remain open.

This is a governance and documentation artifact. It does not activate a
runtime, rotate a key, or issue a receipt. This evidence update did not perform
the already-recorded site merge or deployment.

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

The observation proves what those URLs returned at that time only. The response
did not expose a source SHA, so that initial capture could not identify the
deployment commit. The later GitHub deployment record supplies exact source
provenance for its own environment record, while the post-deploy capture
supplies current custom-domain evidence. Without a retained Vercel alias
record, the relationship between those two records is `DERIVED`; neither
record retroactively assigns a commit to the initial observation.

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

## Containment remediation and validation

A containment candidate was built in `BizraInfo/award-winner-design` on branch
`fix/public-claim-binding-1a`, based on
`568ab0b41c32f812b8ce4d20e7f4ffdf1ebffd6e`.

The candidate:

- replaces `/` with a dated evidence-boundary page,
- links the Dema Claim Register and Current Limits at Dema commit
  `26bb57359186a3ab533dd51e3623e0c84d5078e9`,
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
  `web_process_health_only` measurement bound to `BIZRA-PUBLIC-004`,
- minimizes beta-status and successful beta-admission responses to one
  request-scoped access schema bound to `BIZRA-PUBLIC-005`,
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

The candidate's existence is `VERIFIED` by those source paths. Site PR
[`#7`](https://github.com/BizraInfo/award-winner-design/pull/7) merged head
`ebb5cc42082a7348014fe50fd4b584ccbddbbdc7` as
`6f7f545e6a1ac044cbb8d29a0a215e8a9f2885bf` at
`2026-07-24T14:06:32Z`. The merge was performed by the non-bot `BizraInfo`
account. Merge provenance does not by itself prove production behavior; that
is measured separately below.

The exact site source candidate is local commit
`d27b7a890452c416c86a27ed163c05e9b6e2950f`. Evidence-only follow-up commit
`ebb5cc42082a7348014fe50fd4b584ccbddbbdc7` adds the loopback crawl without
changing the runtime source. [MEASURED] Against the production build of the
source commit, a credential-free crawl of all `62` inventoried surfaces
recorded:

- `4` HTTP `200`,
- `30` HTTP `307`,
- `27` HTTP `401`,
- `1` HTTP `503` while the local health dependency was unavailable,
- `0` truncated captures,
- `0` expected-private HTTP `200` responses,
- `0` containment status failures,
- and `0` known forbidden-phrase hits.

The local crawl is stored at
`docs/launch/evidence/public-claim-local-candidate-capture-2026-07-24.json` in
the site repository. Its SHA-256 is
`2e7fac523e585c7cc6b1f236ccc59d40eea311b92d94fb572fcf7f251d83a3f2`.
It declares source commit
`d27b7a890452c416c86a27ed163c05e9b6e2950f`, retains no raw bodies, and marks
deployment-source binding `UNVERIFIED`. This is local candidate evidence, not
a production post-deploy crawl.

[MEASURED] At `2026-07-24T16:07:33.000Z`, site review head
`ebb5cc42082a7348014fe50fd4b584ccbddbbdc7` was revalidated with Node
`v22.22.2`, pnpm `10.33.0`, Linux `7.0.0-28-generic` x86_64, an Intel Core
i9-14900HX, `128502` MiB total memory, and pnpm lockfile SHA-256
`0f72dd35e0881c17826a8b8a509b1c38c6fd1b4669e73bb6a71bd208708e96d2`.
The exact commands, exit codes, source SHAs, result counts, and generated test
and build artifact hashes are recorded in
[`evidence/bizra-ai-public-claim-site-validation-2026-07-24.json`](evidence/bizra-ai-public-claim-site-validation-2026-07-24.json),
SHA-256
`ad266e71a1cf821a5e322ac8c3300c64db628662ba53bf343cf5f57c9b641047`.
`pnpm test` passed `22` files / `200` tests; `pnpm typecheck`, `pnpm build`,
the generated-asset scan over `618` build files, changed-surface ESLint with
`--no-ignore --max-warnings 0`, and `git diff --check` passed. The
repository-wide `pnpm lint` remains baseline-red with `82` errors and `199`
warnings; every error is in unchanged `public/films/support.js`. This slice
does not claim that baseline debt is repaired.

The deployed boundary pins Dema commit
`26bb57359186a3ab533dd51e3623e0c84d5078e9`. GitHub's repository-contents API
resolved the Claim Register, Current Limits, and this incident record at that
exact commit, with git blob IDs and sizes recorded in the deployment-binding
artifact below. The current local Dema review update is not yet pushed and is
not represented as remotely published.

## Production deployment and post-deploy crawl

[VERIFIED] GitHub deployment record
[`5590104450`](https://api.github.com/repos/BizraInfo/award-winner-design/deployments/5590104450),
created by `vercel[bot]` at `2026-07-24T14:07:12Z`, binds its environment label
`Production – award-winner-design` to exact site commit
`6f7f545e6a1ac044cbb8d29a0a215e8a9f2885bf`. Its
[status record](https://api.github.com/repos/BizraInfo/award-winner-design/deployments/5590104450/statuses)
reports `success` and “Deployment has completed.” Its environment URL is a
Vercel deployment URL, not the `bizra.ai` alias.

[DERIVED] The `bizra.ai` root references same-origin Turbopack runtime asset
`/_next/static/chunks/turbopack-0v13~z8bo3pu7.js`. At
`2026-07-24T16:28:12.000Z`, that asset had SHA-256
`ca465e67a8c8d357d7a6052a505b05bd8f535f33bf58ae6e4aa2655c3dbc5c37`
and embedded Vercel deployment identifier
`dpl_C7hFkz6LZRSPK1XMHAXUYwJRJj2R`. The exact-commit GitHub status context
`Vercel – award-winner-design` targets the matching identifier
`C7hFkz6LZRSPK1XMHAXUYwJRJj2R`, and deployment `5590104450` records the same
commit and project. The provider alias API was not readable without additional
Vercel account authorization, so this mechanism-backed relationship remains
`DERIVED`, not `VERIFIED`.

[MEASURED] A credential-free `GET` crawl of `https://bizra.ai` at
`2026-07-24T16:18:28.000Z` covered all `62` inventoried, fixed, non-secret
surfaces and recorded:

- `5` HTTP `200`,
- `30` HTTP `307` containment redirects,
- `27` HTTP `401` expected-private responses,
- `0` truncated captures,
- `0` request errors,
- `0` expected-private HTTP `200` responses,
- `0` containment status failures,
- and `0` known forbidden-phrase hits.

The root returned boundary header `reviewed` and body SHA-256
`473052c4bbcf7bf6092bbd9c075abf70c12e6b517878fe32c5ba3521fcaf18dd`.
The crawl, including request path, source path, status, redirect location,
content type, byte count, body hash, and retained redacted public text, is
stored at
[`evidence/bizra-ai-public-claim-postdeploy-2026-07-24.json`](evidence/bizra-ai-public-claim-postdeploy-2026-07-24.json),
SHA-256
`cd232a76ffe27c26f0ed43276d7cc0f949a5c1ba1d0b492071b986fed82def50`.

[MEASURED] A separate raw-body scan at `2026-07-24T16:24:43.000Z` applied a
recorded link and exact-phrase policy to the same `62` fixed routes. It
recorded `0` request errors, `0` public receipt-link matches, `0` revoked-key
link matches, and `0` known forbidden-phrase hits. The extracted URL inventory,
stable response anchors, and canonical response-digest-set SHA-256 are stored
in
[`evidence/bizra-ai-public-link-scan-2026-07-24.json`](evidence/bizra-ai-public-link-scan-2026-07-24.json),
SHA-256
`9624f7433c72c2712803bfd00d9d61d37d1338d065df679da6e4dd167ecfec36`.

The raw crawler deliberately leaves `deploymentCommit` null and
`deploymentSourceBinding` `UNVERIFIED`; it does not infer deployment
provenance from an HTTP response. [DERIVED] The matching corrected boundary,
exact immutable evidence anchors, successful GitHub deployment record, live
response, immutable Dema evidence lookup, crawl summary, and link scan are
bound without upgrading the missing custom-domain alias proof in
[`evidence/bizra-ai-public-claim-deployment-binding-2026-07-24.json`](evidence/bizra-ai-public-claim-deployment-binding-2026-07-24.json),
SHA-256
`37b7e17ac729f04e6e628b64a9a4dcf1e225970438867a1a89607185efe79ebd`.

This proves the dated public containment boundary and narrow request-time API
observations only. The custom-domain relationship to the exact GitHub
deployment remains `DERIVED` until direct alias metadata is retained. None of
this proves Node0 activation, signer trust, federation, persistence,
full-system health, token state, economic state, or governed receipt issuance.

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

The production containment and crawl gates are now measured. The remaining
truth is:

```text
INITIAL LIVE CLAIM DEFECT: OBSERVED AND HISTORICALLY RECORDED
CORRECTED SITE DEPLOYMENT: VERIFIED BY GITHUB DEPLOYMENT RECORD
CUSTOM-DOMAIN EXACT-SOURCE RELATIONSHIP: DERIVED, DIRECT ALIAS PROOF PENDING
POST-DEPLOY PUBLIC CLAIM CRAWL: MEASURED GREEN AT 2026-07-24T16:18:28.000Z
DEMA EVIDENCE UPDATE: LOCAL_ONLY, PENDING PUSH AND REVIEW
PUBLIC SIGNER TRUST: UNKNOWN, TASK-029 OPEN
NEW CRYPTOGRAPHIC RECEIPT: NOT ISSUED
```
