# BIZRA Legend Paper — Reference Audit v0.1

Truth label: `PAPER_EVIDENCE_META_DOCS_ONLY`. Meta-analysis of the paper's References section
(paper sha256 `2d0953d0…469b01`). Extracted from the real PDF.

## Headline finding

**References [1]–[14] are placeholders** — all authored "A. Author" with fabricated / not-yet-real
future arXiv identifiers (`2606.*`, `2603.*`, `2605.*`, `2510.*`, `2504.*`, `2410.*`). These MUST be
replaced with real citations or removed before any public release. **References [15]–[45] are, on
inspection, real published works** (Telescript, Merkle, Bitcoin, Constitutional AI, PLONK, Islamic
finance texts, OECD/UNESCO, etc.).

`status`: `verified` (real, well-known work) · `placeholder` (fabricated "A. Author"/future arXiv) ·
`needs_verification` (plausible but unconfirmed here).

| ref | citation (as printed) | status | note / replacement action |
|---|---|---|---|
| [1] | A. Author, "The verification horizon…", arXiv:2606.26300, 2026 | **placeholder** | replace — this is the load-bearing "verification is easier than generation" cite; find the real source |
| [2] | A. Author et al., "Reward hacking benchmark for tool-using RL agents", arXiv:2605.02964, 2026 | **placeholder** | replace |
| [3] | A. Author, "The verifier tax…", arXiv:2603.04257, 2026 | **placeholder** | replace |
| [4] | A. Author, "Position: Modular memory…", NeurIPS Position Papers 2026, arXiv:2603.19328 | **placeholder** | replace |
| [5] | A. Author, "Scaling long-horizon LLM agents via context-folding", arXiv:2503.23278, 2025 | **placeholder** | replace |
| [6] | A. Author, "MemRL…", arXiv:2510.11967, 2025 | **placeholder** | replace |
| [7] | A. Author, "Agent-Omit…", arXiv:2603.04284, 2026 | **placeholder** | replace |
| [8] | A. Author, "Bridging the agent-world gap…", arXiv:2606.09032, 2026 | **placeholder** | replace |
| [9] | A. Author, "ceLLMate: Sandboxing browser-using agents", arXiv:2512.12594, 2025 | **placeholder** | replace |
| [10] | A. Author, "AgentVisor…", arXiv:2605.03378, 2026 | **placeholder** | replace |
| [11] | A. Author, "ARGUS…", arXiv:2504.03149, 2026 | **placeholder** | replace |
| [12] | A. Author, "AgentSentry…", arXiv:2602.22724, 2026 | **placeholder** | replace |
| [13] | A. Author, "Threat modeling for AI-agent protocols: MCP, A2A, Agora, ANP", arXiv:2602.11327, 2026 | **placeholder** | replace |
| [14] | A. Author, "Agent security bench…", arXiv:2410.02644, 2024 | **placeholder** | replace |
| [15] | J. White, *Mobile Agents and the Programming Language Telescript*, General Magic, 1995 | verified | real (Telescript) |
| [16] | A. Author, "The model context protocol…", arXiv:2503.16902, 2025 | needs_verification | MCP exists (Anthropic); confirm citation |
| [17] | A. Author, "Agent2Agent (A2A) protocol", arXiv:2504.16902, 2025 | needs_verification | A2A exists; confirm citation |
| [18] | UNCTAD, "Global public debt hits record $102 trillion in 2024", 2024 | verified | real |
| [19] | Institute of International Finance, "Global debt monitor" | verified | real |
| [20] | IEA, "Energy and AI", 2025 | verified | real |
| [21] | IEA, "Data centre electricity use surged in 2025" | verified | real |
| [22] | OECD, "Global debt report 2025" | verified | real |
| [23] | S. Zuboff, *The Age of Surveillance Capitalism*, 2019 | verified | real |
| [24] | K. Crawford, *Atlas of AI*, Yale, 2021 | verified | real |
| [25] | Bender, Gebru, McMillan-Major, Shmitchell, "On the dangers of stochastic parrots", FAccT 2021 | verified | real |
| [26] | "Constitutional AI: Harmlessness from AI feedback", Anthropic, arXiv:2212.08073 | verified | real |
| [27] | R. C. Merkle, "A digital signature based on a conventional encryption function", CRYPTO 1988 | verified | real |
| [28] | Crosby & Wallach, "Efficient data structures for tamper-evident logging", USENIX Security 2009 | verified | real |
| [29] | R. Tamassia, "Authenticated data structures", ESA 2003 | verified | real |
| [30] | Goldwasser, Micali, Rackoff, "The knowledge complexity of interactive proof systems", SIAM J. Comput. 1989 | verified | real |
| [31] | Gabizon, Williamson, Ciobotaru, "PLONK", ePrint 2019/953 | verified | real |
| [32] | S. Nakamoto, "Bitcoin", 2008 | verified | real |
| [33] | King & Nadal, "PPCoin", 2012 | verified | real |
| [34] | De Filippi, Mannan, Reijers, "Blockchain as a confidence machine", Philos. Technol. 2012 | verified | real |
| [35] | Haeberlen, Kouznetsov, Druschel, "PeerReview", SOSP 2007 | verified | real |
| [36] | Gennaro, Gentry, Parno, "Non-interactive verifiable computing", CRYPTO 2010 | verified | real |
| [37] | Parno et al., "Pinocchio", IEEE S&P 2013 | verified | real |
| [38] | M. El-Gamal, *Islamic Finance: Law, Economics, and Practice*, Cambridge 2006 | verified | real |
| [39] | M. Ayub, *Understanding Islamic Finance*, Wiley 2007 | verified | real |
| [40] | Rahman et al., "Blockchain and Islamic finance: a systematic literature review", J. Islamic Finance 2020 | needs_verification | plausible; confirm |
| [41] | S. S. Ali, "Smart contracts and gharar…", J. Islam. Bus. Manag. 2018 | needs_verification | plausible; confirm |
| [42] | UNESCO, "Recommendation on the ethics of AI", 2023 | verified | real |
| [43] | OECD, "Recommendation of the Council on AI", OECD/LEGAL/0449, 2024 | verified | real |
| [44] | Barocas & Selbst, "Big data's disparate impact", California Law Review 2016 | verified | real |
| [45] | Mitchell et al., "Model cards for model reporting", FAccT 2019 | verified | real |

## Tally

- **placeholder: 14** ([1]–[14]) — all "A. Author", fabricated future arXiv IDs. **Blocking for public release.**
- **needs_verification: 4** ([16], [17], [40], [41]).
- **verified: 27** ([15], [18]–[39 real subset], [42]–[45]).

## Rule

No placeholder reference may survive to a public draft. Until [1]–[14] are replaced with real sources
(or the claims they support are downgraded to `DESIGN_ONLY`/`DIRECTION_ONLY`), the paper is
**not release-ready**.
