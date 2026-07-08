# BIZRA Legend Paper — Reference Audit v0.1 (corrected 2026-07-09)

Truth label: `PAPER_EVIDENCE_META_DOCS_ONLY`. Meta-analysis of the paper's References section
(paper sha256 `2d0953d0…469b01`). Extracted from the real PDF.

## Correction note (this supersedes the original v0.1 verdict)

The original v0.1 headline stated references **[1]–[14] are "fabricated / not-yet-real future arXiv
identifiers."** That verdict was reached **by assumption** — from the `A. Author` byline + future-dated
IDs — **without fetching the arXiv IDs.** A live web verification (2026-07-09) fetched every ID and found
the opposite: **all 16 resolve to real, existing papers** whose titles/abstracts match the claims. The
only fabricated field is uniformly the **author name** (`A. Author`) — a systematic placeholder/citation-tool
artifact, not invented scholarship. The original table's arXiv-ID column was also **row-shifted** (e.g. it
printed [3]=`2603.04257`; the PDF + live fetch show [3]=`2603.19328`).

Recording the correction, per claim discipline: a "fabricated" verdict is itself a claim, and it must bind
to a live fetch — not to a pattern-match. Fix = **replace author metadata**, not cut. (Verification predates
this model's Jan-2026 knowledge cutoff for most IDs — the authority is the live fetch, not memory. A human
should skim each PDF before finalizing, especially [2] and [6].)

## Headline finding (corrected)

**References [1]–[14], [16], [17] are REAL papers carrying a placeholder author field** — replace the
byline (and fix the flagged IDs/venues), do not cut. **References [15], [18]–[45] are real published works.**
No reference in the paper corresponds to a non-existent study.

`status`: `real_placeholder_author` (real paper; `A. Author` byline to replace) · `verified` (real,
complete) · `needs_verification` (plausible; confirm).

## Ledger — verified replacements (live-fetched)

| ref | real paper (author → title, venue/year) | arXiv | special handling |
|---|---|---|---|
| [1] | Qwen Team (Alibaba), "The Verification Horizon: No Silver Bullet for Coding Agent Rewards", 2026 | 2606.26300 | optional co-cite Stechly et al., ICLR 2025 (2402.08115) |
| [2] | K. Thaman, "Reward Hacking Benchmark: Measuring Exploits in LLM Agents with Tool Use", 2026 | 2605.02964 | ⚠ solo, unreviewed — co-cite Skalse et al., NeurIPS 2022 (2209.13085) |
| [3] | Sah, Srivastava, Sah, Jordan, "The Verifier Tax…", ACM CAIS 2026 | 2603.19328 | paper §8.3 title lifted from here |
| [4] | Dorovatas et al. (24), "Position: Modular Memory is the Key to Continual Learning Agents", **ICML 2026 (spotlight)** | 2603.01761 | ⚠ venue fix: ICML, NOT NeurIPS |
| [5] | Sun et al., "Scaling Long-Horizon LLM Agent via Context-Folding", 2025 | 2510.11967 | — |
| [6] | Zhang et al., "MemRL: Self-Evolving Agents via Runtime RL on Episodic Memory", 2026 | **2601.03192** | ⚠ ID COLLISION: printed 2603.04257 belongs to a different paper ("Memex(RL)"); correct to 2601.03192 |
| [7] | Ning, Fang, Tan, Liu, "Agent-Omit: Adaptive Context Omission for Efficient LLM Agents", 2026 | 2602.04284 | — |
| [8] | Li et al. (16), "Bridging the Agent-World Gap: Text World Models for LLM-based Agents", 2026 | 2606.09032 | ⚠ ORPHAN — never cited with `[8]` in body; wire in or cut |
| [9] | Meng, Feng, Shumailov, Fernandes, "ceLLMate: Sandboxing Browser AI Agents", 2025 | 2512.12594 | — |
| [10] | Ying et al., "AgentVisor: Defending LLM Agents Against Prompt Injection via Semantic Virtualization", 2026 | 2604.24118 | — |
| [11] | Weng et al., "ARGUS: Defending LLM Agents Against Context-Aware Prompt Injection", 2026 | 2605.03378 | — |
| [12] | Zhang et al. (11), "AgentSentry: Mitigating Indirect Prompt Injection… Temporal Causal Diagnostics and Context Purification", 2026 | 2602.22724 | — |
| [13] | Anbiaee et al. (CIC-UNB + Mastercard), "Security Threat Modeling for Emerging AI-Agent Protocols: MCP, A2A, Agora, ANP", 2026 | 2602.11327 | — |
| [14] | Zhang et al. (8), "Agent Security Bench (ASB)…", **ICLR 2025** | 2410.02644 | strongest-standing (peer-reviewed) |
| [16] | Hou, Zhao, Wang, Wang, "Model Context Protocol (MCP): Landscape, Security Threats, and Future Research Directions", 2025 | 2503.23278 | ⚠ ORPHAN — cite Anthropic MCP announcement (Nov 2024) as primary + this as co-cite |
| [17] | Habler, Huang, Narajala, Kulkarni, "Building A Secure Agentic AI Application Leveraging A2A Protocol", 2025 | 2504.16902 | ⚠ ORPHAN — cite Google A2A announcement (Apr 2025) + Linux Foundation spec as primary |

Real, untouched: [15] Telescript (J. White, 1995) · [18]–[24] debt/energy/surveillance stats · [25] Bender et al. (FAccT 2021) · [26] Constitutional AI (2212.08073) · [27] Merkle · [28] Crosby–Wallach · [29] Tamassia · [30] GMR (SIAM 1989) · [31] PLONK (ePrint 2019/953) · [32] Bitcoin · [33] PPCoin · [34]–[37] verifiable-computing/accountability · [38]–[41] Islamic finance ([40],[41] confirm) · [42]–[45] UNESCO/OECD/Barocas–Selbst/Model Cards.

## Tally (corrected)

- **REAL, replace author metadata: 16** ([1]–[14], [16], [17]) — 0 fabricated studies.
- **Special handling: 4** — [6] ID-collision · [4] venue (ICML) · [8]/[16]/[17] orphan (wire-in-or-cut) · [2] weak preprint (co-cite).
- **verified real (complete): 29** ([15], [18]–[45]).

## Rule

No `A. Author` byline may survive to a public draft. But the studies are **real** — the fix is metadata
repair (byline + the 4 flagged IDs/venues), not removal. A paper on verification integrity must not carry
placeholder bylines; equally, it must not carry the unbound verdict "these citations are fabricated" — which
this correction retracts.
