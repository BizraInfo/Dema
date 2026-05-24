# GTM Readiness Matrix · 25-Doc Minimum Pack

> **Purpose:** Single source-of-truth for which BIZRA / Dema documentation is ready, partial, or missing before go-to-market. The 25-doc list is the **minimum-viable** GTM pack (vision, architecture, engineering, security, AI governance, operator, GTM, proof) — derived from NIST SSDF + OWASP ASVS + ISO 42001-style management thinking, then trimmed to the smallest set that lets a reviewer prove what BIZRA is, why it matters, how it works, and why it can be trusted.
>
> **Scope:** This matrix tracks GTM-grade docs only. The full BIZRA doc system (in `docs/`) is larger; this matrix is the **control file** for the 25 docs that must exist + be current before any external GTM action (investor pitch, customer pilot, Ring-1 expansion, press contact, regulatory engagement).
>
> **Source spec:** Gold-standard 25-doc minimum proposed 2026-05-24 (see commit msg / session log) · anchored on NIST SP 800-218 SSDF v1.1 + OWASP ASVS + SPDX/SBOM + ISO/IEC 42001 framing.

---

## Truth labels

| Label | Definition |
|---|---|
| **COMPLETE** | Doc exists in repo (or operator-side per ADR-022 doctrine for some surfaces) · current within last 30 days · covers the topic comprehensively · safe to send externally |
| **PARTIAL** | Some content exists under a different file name or in a related doc · NOT renamed/consolidated to the canonical filename yet · would need consolidation + freshness pass before external use |
| **DRAFT** | File exists but is a stub or skeleton · needs substantial fill-in before GTM |
| **MISSING** | No file in repo matches the topic · must be authored fresh |
| **OPERATOR-SIDE** | Lives outside the Dema repo per ADR-022 doctrine (substrate stays out) · referenced by path |

## Last verified

2026-05-24 ~15:25 GST against main `7315cf1` (post-INDEX.md + RELEASE_PROCESS.md authorship).

---

## Matrix

| # | Document | Status | Audience | Required for GTM? | Owner | Last reviewed | Evidence link | Risk if missing | Definition of Done |
|---:|---|---|---|:---:|---|---|---|---|---|
| 1 | `00_START_HERE.md` | PARTIAL | All | YES | Mumu (operator) | — | `README.md` (10.9 KB · generic README, not a controlled START_HERE) | Reviewer can't find where to begin · investor confusion · loses trust in 1st minute | Single page · routes reviewer to public / NDA / technical / investor sub-packs · published at repo root or `docs/00-start-here/` |
| 2 | `CURRENT_LIMITS.md` | COMPLETE | All | YES | Mumu | 2026-05-24 (in repo) | `docs/CURRENT_LIMITS.md` (11.3 KB) | Public claims drift from truth · audit fail | Every claim labeled MEASURED / DESIGNED_NOT_LIVE / SIMULATION_ONLY · refreshed monthly |
| 3 | `BIZRA_ONE_PAGER.md` | MISSING | Investor / customer | YES | Mumu | — | — | No 60-second pitch · loses warm leads | Single page · what it is · why now · who for · proof line · one CTA |
| 4 | `PRODUCT_BRIEF.md` | PARTIAL | Investor / customer | YES | Mumu | — | `docs/BIZRA_2026_FIRST_LOOK_PRODUCTION_BRIEF_v0_1.md` (candidate · needs consolidation) | Pitch falls back to demo · no read-along | Node0 + Dema today, in 2 pages, no future-tense claims |
| 5 | `SYSTEM_ARCHITECTURE.md` | COMPLETE | Engineer / technical reviewer | YES | Mumu | 2026-05-24 (today's edit added MC-A row) | `docs/ARCHITECTURE.md` (40.5 KB) | Engineer can't reconstruct mental model | Full Node0 / Dema / PAT / SAT / FATE / URP map · refreshed per major arch change |
| 6 | `NODE0_ARCHITECTURE.md` | MISSING | Engineer | YES | Mumu | — | — | First-sovereign-node design is implicit, not documented | Exact design of the first sovereign node · readable standalone |
| 7 | `DEMA_ARCHITECTURE.md` | PARTIAL | Engineer | YES | Mumu | 2026-05-24 (covered in ARCHITECTURE.md) | Same as #5 (no separate file) | Dema-specific design buried in system doc | Dema as face / cockpit / consent layer / bridge · separate file for focus |
| 8 | `PAT_SAT_BOUNDARY.md` | MISSING | Engineer / reviewer | YES | Mumu | — | — | The PAT-vs-SAT distinction is core to BIZRA but undocumented externally | PAT serves user, SAT protects system · with concrete examples per surface |
| 9 | `ROADMAP.md` | COMPLETE | All | YES | Mumu | 2026-05-24 (recent) | `docs/ROADMAP.md` (22.4 KB) | No public visibility into trajectory · investor sees no forward shape | Parked-vs-active items · each with status, why-parked, unblock-GO |
| 10 | `ADR_INDEX.md` | COMPLETE | Engineer | YES | Mumu | 2026-05-24 (authored this session) | `docs/06-adr/INDEX.md` (18 active ADRs · 17 Accepted · 1 Parking lot · audits/ subfolder linked) | — | Index file at `docs/06-adr/INDEX.md` listing every ADR with title, status, accepted date, one-line decision summary |
| 11 | `SECURITY.md` | DRAFT | Engineer / security reviewer | YES | Mumu | — | `SECURITY.md` (548 B · stub) | Vulnerability reports have no clear path · failed responsible-disclosure posture | Reporting address · response SLA · GPG key or equivalent · scope · safe-harbor language |
| 12 | `THREAT_MODEL.md` | MISSING | Security reviewer | YES | Mumu | — | — | No STRIDE / no asset map · auditor's first question goes unanswered | STRIDE or equivalent · per-surface · mitigations linked to code |
| 13 | `SECURE_SDLC_MAPPING.md` | MISSING | Security reviewer / enterprise buyer | YES | Mumu | — | — | NIST SSDF compliance posture unverifiable | Per-SSDF-practice mapping to BIZRA artifact (PR template, CI step, ADR) |
| 14 | `TESTING.md` | COMPLETE | Engineer | YES | Mumu | 2026-05-24 (today's edit added memory-query test row) | `docs/TESTING.md` (136 KB) | — | Per-test-file row · invariants · how to run · coverage report referenced |
| 15 | `CI_CD_PIPELINE.md` | MISSING | Engineer / security reviewer | YES | Mumu | — | (live state observable via `.github/workflows/` · 4 SHA-pinned Node-24 workflows) | CI posture documented only in workflow files · investor can't ask "is your CI rigorous?" and get a written answer | Documents: BIZRA Review Gate, check, CodeQL, gitleaks · pinning policy · workflow-changes-authorized gate · release-readiness score |
| 16 | `RELEASE_PROCESS.md` | COMPLETE | Engineer | YES | Mumu | 2026-05-24 (authored this session) | `docs/RELEASE_PROCESS.md` (8 sections · versioning + 3-layer gate chain + RDR convention + rollback ladder + ADR-007 reference + workflow pinning policy + halt-gates) | — | Versioning · readiness gates · rollback · ADR-007 chain-mutation policy reference |
| 17 | `AI_GOVERNANCE.md` | MISSING | AI ethics reviewer / regulator / investor | YES | Mumu | — | — | No mapping to ISO 42001 thinking · vulnerable to "what AI policy?" question | Decision boundaries · model card pointers · evals · per-surface policy |
| 18 | `CONSENT_AND_MICRO_CONSENT_POLICY.md` | MISSING | All | YES | Mumu | — | (canon implicit in code · `~/.dema/lint/consent_grants.ndjson` operator-side schema lives) | Consent ladder C0-C5 not externalized · core BIZRA differentiator invisible to outsiders | C0-C5 ladder · per-action mapping · μ-C1 enforcer link · exact-string consent canon explained |
| 19 | `DATA_PRIVACY_AND_MEMORY_POLICY.md` | MISSING | Privacy reviewer / regulator / investor | YES | Mumu | — | — | GDPR / CCPA / general data posture undefined externally | Memory access · retention · deletion · public-safe defaults · MC-A boundary doctrine |
| 20 | `QUICKSTART.md` | PARTIAL | New developer / Ring-1 user | YES | Mumu | — | README.md has install lines but no labeled Quickstart | New users abandon at install · Ring-1 expansion stalls | 1-page · `node bin/dema status` works in <2 min · expected output shown |
| 21 | `NODE0_OPERATOR_GUIDE.md` | MISSING | Ring-1 user | YES | Mumu | — | — | First operator (Samy/equivalent) needs founder over their shoulder | Run · doctor · setup · receipts · troubleshoot · safe boundaries |
| 22 | `DEMO_SCRIPT.md` | MISSING | Founder for demo · GTM team | YES | Mumu | — | — | Demos inconsistent · "what should I show?" question every time | 3-min and 10-min scripts · exact commands · expected output · failure-mode handling |
| 23 | `INVESTOR_MEMO.md` | MISSING | Investor | YES | Mumu | — | — | Pitch deck without written memo = no async circulation · no leverage | Thesis · market · moat · what's MEASURED · what's PARKED · ask |
| 24 | `RISK_REGISTER.md` | PARTIAL | Investor / engineer / governance | YES | Mumu | — | `docs/CLAIM_REGISTER_v0_1.md` (candidate · related discipline) | Risks live in head not on paper · auditor first question unanswered | Strategic + technical risks · probability · impact · mitigation · owner |
| 25 | `LIGHTHOUSE_PACK.md` | OPERATOR-SIDE | Ring-1 reviewer | YES | Mumu | 2026-05-19 (per memory · relocated) | `~/Documents/bizra/lighthouse-pack-v1.0/` (operator-side · 9 files · per memory `project_lighthouse_pack_v1_0_relocated`) | Ring-1 review can't proceed cleanly without packaged surface | 9-file curated package · evidence + envelope + onboarding · send-ready |

---

## Tally

| Status | Count | % |
|---|---:|---:|
| COMPLETE | 6 | 24% |
| PARTIAL | 3 | 12% |
| DRAFT | 1 | 4% |
| MISSING | 14 | 56% |
| OPERATOR-SIDE | 1 | 4% |
| **TOTAL** | **25** | **100%** |

## Honesty boundary

The "PARTIAL" entries (#1, #4, #7, #20, #24) all mean: *related content exists somewhere, but the canonical-named GTM doc does not yet exist*. Promoting from PARTIAL → COMPLETE requires either:
- (a) Renaming + consolidating the existing content into the canonical file, OR
- (b) Authoring a fresh focused doc that supersedes the partial coverage.

The 14 MISSING entries require fresh authorship. None of them have evidence in repo today.

Coverage today is **24% strictly complete · 30% if PARTIAL counts as half** — still far from the gold-standard 25/25 the GTM bar requires, but advancing two slices in one session (Tier-2 #10 ADR Index + Tier-2 #16 RELEASE_PROCESS).

## Priority order (suggested for fill-in sequence)

**Tier 1 — Trust spine (blocks any external action):**
- #11 SECURITY.md (DRAFT → COMPLETE) — fix the 548-byte stub first; reporting address is table-stakes
- #1 00_START_HERE.md — single entry point reviewers find before anything else
- #20 QUICKSTART.md — first thing developers try; current README is too long
- #23 INVESTOR_MEMO.md — pitch deck without memo can't circulate async

**Tier 2 — Architecture / engineering credibility:**
- #6 NODE0_ARCHITECTURE.md
- #8 PAT_SAT_BOUNDARY.md
- ~~#10 ADR_INDEX.md~~ — closed 2026-05-24 (`docs/06-adr/INDEX.md` · 18 ADRs indexed)
- #15 CI_CD_PIPELINE.md
- ~~#16 RELEASE_PROCESS.md~~ — closed 2026-05-24 (`docs/RELEASE_PROCESS.md` · 8-section process doc)

**Tier 3 — Security + AI governance:**
- #12 THREAT_MODEL.md
- #13 SECURE_SDLC_MAPPING.md
- #17 AI_GOVERNANCE.md
- #18 CONSENT_AND_MICRO_CONSENT_POLICY.md
- #19 DATA_PRIVACY_AND_MEMORY_POLICY.md

**Tier 4 — GTM execution:**
- #3 BIZRA_ONE_PAGER.md
- #22 DEMO_SCRIPT.md
- #21 NODE0_OPERATOR_GUIDE.md
- #24 RISK_REGISTER.md (PARTIAL → COMPLETE)
- #25 LIGHTHOUSE_PACK.md (decide: leave operator-side or replicate a repo-resident summary)

## Process notes

- Each cell in this matrix is verified against disk on `Last verified` date. Re-run the audit on schedule change or major doc landing:
  ```bash
  bash -c 'for d in docs/CURRENT_LIMITS.md docs/ARCHITECTURE.md ...; do [ -f "$d" ] && echo "✓ $d" || echo "✗ $d"; done'
  ```
- Owner column defaults to "Mumu (operator)" while pre-Ring-1. Add named owners as the team grows.
- The doc folder reorg into `docs/{00-start-here, 01-product, 02-architecture, ...}` proposed in the gold-standard spec is **deferred** — the current docs/ tree has partial prefix scheme (`00-product-thesis`, `02-architecture`, `06-adr`, `08-quality`) but is not yet uniform. Reorg is its own slice; do not couple to per-doc fill-in.

## External anchors

This matrix's framing borrows from:

- **NIST SP 800-218 SSDF v1.1** — secure software development framework · informs #11-#13, #15-#16
- **OWASP ASVS** — application security verification standard · informs #12, #13
- **SPDX / SBOM** — software bill of materials standard · future `SBOM.md` or `sbom.spdx.json`
- **ISO/IEC 42001** — AI management system standard · informs #17-#19

BIZRA does **not** claim certification against any of these — the matrix maps internal practice toward these standards for vocabulary and reviewer-readability, not as a compliance claim.

## Update schedule

Re-audit this matrix:
- After any of the 25 docs lands (PARTIAL/MISSING → COMPLETE)
- After any major repo merge that changes the evidence-link cell
- Quarterly cold review
- Pre-GTM action (investor meeting, customer pitch, Ring-1 expansion, press contact)

## Related canon

- `docs/ROADMAP.md` — parked work map (doc #9)
- `docs/CURRENT_LIMITS.md` — truth boundary (doc #2)
- `docs/06-adr/` — architecture decisions
- `docs/AUDIT_2026_05_24_v0_1.md` — most recent measured-grade audit
- `~/Documents/bizra/lighthouse-pack-v1.0/` — operator-side Ring-1 package (doc #25)
