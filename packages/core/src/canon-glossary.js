// Inline canon teacher: 28 grounded vocabulary entries for BIZRA/Dema concepts.
// Source anchors: docs/canon/BIZRA_TOPOLOGY_CANON.md,
//   docs/public/third-fact-v0.1.md, docs/LIGHTHOUSE.md,
//   docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md.
// truth_label values: DECLARED (canon file), MEASURED (tested/verified), ASSUMED (derived).
//
// perspectives field (optional, additive): {simple, technical, arabic, game}
// Present on 8 seed concepts only. Absent on remaining 20 — callers fall back to short/long.
// arabic entries carry truth_label "DECLARED_NEEDS_NATIVE_REVIEW" where MSA authorship
// was applied without native-speaker verification.

const SCHEMA = "bizra.dema.canon_glossary_entry.v0.1";

// DECLARED_NEEDS_NATIVE_REVIEW is allowed only as a per-perspective metadata value,
// not as an entry-level truth_label. Allowed labels validated in canon-glossary.test.js.

const RAW_ENTRIES = [
  {
    concept: "ihsan",
    title: "Ihsan",
    short: "Excellence as the minimum bar, not the aspiration.",
    long: "The discipline of doing what you do as if you can see what is good, knowing it is being witnessed. In BIZRA it sets the floor for every agent output, refusal, and receipt: produce nothing that falls below what a fully present craftsperson would produce.",
    truth_label: "DECLARED",
    see_also: ["adl", "daughter-test", "refusal-as-product"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
  {
    concept: "adl",
    title: "Adl",
    short:
      "Fairness and bounded inequality — no participant extracts at the expense of another.",
    long: "Adl (عدل) is the constitutional principle that governs economic design in BIZRA. It forbids riba-based extraction, caps inequality (Gini ≤ 0.35 per the founding docs), and is paired with Ihsan: the floor (excellence) and the ceiling (fairness) together bound every system design decision.",
    truth_label: "DECLARED",
    see_also: ["ihsan", "riba-zero", "founding-documents"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
  {
    concept: "riba-zero",
    title: "Riba-Zero",
    short: "No usury — no unearned extraction from time-decay of value.",
    long: "Riba (ربا) is interest or usury: value extracted purely because time has passed, not because work was done. BIZRA's constitutional spine declares riba-zero as a hard invariant. Any financial primitive, token design, or fee structure that charges interest on idle capital violates this invariant and is refused by the system.",
    truth_label: "DECLARED",
    see_also: ["adl", "founding-documents", "zann-zero"],
    doc_anchor: "docs/public/third-fact-v0.1.md",
  },
  {
    concept: "zann-zero",
    title: "Zann-Zero",
    short: "No speculation passed off as certainty.",
    long: "Zann (ظن) is conjecture or ungrounded opinion presented as fact. BIZRA enforces zann-zero across all agent outputs, documentation, and receipts. Every factual claim must be tagged with its truth label (DECLARED, MEASURED, or ASSUMED). Collapsing these categories — treating an assumption as a proven fact — is a zann violation and is treated as a doctrine failure.",
    truth_label: "DECLARED",
    see_also: ["truth-label", "ihsan", "founding-documents"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
  {
    concept: "pat",
    title: "PAT · Personal Agentic Team",
    short:
      "The user-side 7-agent team that lives on your own device and serves only you.",
    long: "PAT-7 is minted locally on the human's device at first activation. Its seven agents are: P1 Planner, P2 Researcher, P3 Coder, P4 Evaluator, P5 Ethicist (frozen: ethics from axioms, not data), P6 Publisher, P7 DEMA/Nexus (the face — the human only ever talks to DEMA). PAT is user-loyal. It never connects to the network directly: all network interaction flows PAT → Membrane → SAT.",
    truth_label: "DECLARED",
    see_also: ["sat", "dema", "bizra"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
    perspectives: {
      simple:
        "The user-side 7-agent team that lives on your own device and serves only you.",
      technical:
        "PAT-7 is a locally-minted team of seven agents with fixed role assignments: P1 Planner, P2 Researcher, P3 Coder, P4 Evaluator, P5 Ethicist (axiom-frozen — behavior is not learned from data), P6 Publisher, P7 DEMA/Nexus. PAT is user-loyal: its sole constitutional obligation is to the human who activated it. All PAT↔network traffic routes through the constitutional membrane; PAT never connects to the URP directly. No two humans share a PAT instance. Source: BIZRA_TOPOLOGY_CANON.md §'What is local per human'.",
      arabic:
        "فريق الوكلاء الشخصي (PAT) هو فريق مكوّن من سبعة وكلاء يُنشأ محلياً على جهاز المستخدم عند التفعيل الأول. الوكلاء السبعة هم: المخطط (P1)، والباحث (P2)، والمبرمج (P3)، والمقيّم (P4)، وخبير الأخلاق (P5 · مجمَّد: الأخلاق من المبادئ لا من البيانات)، والناشر (P6)، ودِمَا/النواة (P7 · الواجهة البشرية الوحيدة). الفريق مخلص للمستخدم حصراً، ولا يتصل بالشبكة مباشرةً.",
      game: "Think of PAT-7 as your personal guild — seven specialist heroes who live on your hardware and answer only to you. Your Planner sets the quest, your Researcher scouts intel, your Coder crafts the artifact, your Ethicist can veto any move that breaks guild law, and DEMA is the face you always speak to. The whole party never leaves your castle without going through the kingdom's constitutional gate first.",
    },
  },
  {
    concept: "sat",
    title: "SAT · System Agentic Team",
    short:
      "The shared verifier-side 5-agent team that lives in the URP, not on your device.",
    long: "Each human who joins BIZRA contributes 5 SAT agents to the shared Universal Resource Pool (URP). SAT-5 agents are: S1 Validator (receipt integrity), S2 Oracle (frozen truth axioms), S3 Mediator (fair dispute resolution), S4 Archivist (House of Wisdom), S5 Sentinel (threat detection). SAT follows constitutional law only — no human designs their behavior. SAT is system-loyal, not user-loyal.",
    truth_label: "DECLARED",
    see_also: ["pat", "urp", "boundary"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
    perspectives: {
      simple:
        "The shared verifier-side 5-agent team that lives in the URP, not on your device.",
      technical:
        "Every new human node contributes exactly 5 SAT agents into the singular shared URP. Roles are constitutional and immutable: S1 Validator (BLAKE3 receipt integrity + Ed25519 signature verification), S2 Oracle (frozen axiom store — no learning, no drift), S3 Mediator (constitutional dispute resolution with Adl invariant), S4 Archivist (House of Wisdom ingestion), S5 Sentinel (threat monitoring). SAT is system-loyal: its obligations run to the constitutional spine, not to any individual human. No human can configure or override SAT behavior. Source: BIZRA_TOPOLOGY_CANON.md §'What is shared for the entire ecosystem'.",
      arabic:
        "فريق الوكلاء النظامي (SAT) يتألف من خمسة وكلاء يساهم بهم كل إنسان في المجمع المشترك (URP). أدوارهم ثابتة دستورياً: المتحقق (S1)، والأوراكل المجمَّد (S2)، والوسيط العادل (S3)، والمؤرشف (S4)، والحارس (S5). الفريق مخلص للنظام الدستوري وحده، لا لأي فرد.",
      game: "SAT-5 are the realm's neutral referees — five NPCs who live in the shared server, not in anyone's faction. They verify every receipt like a blockchain node, store truth like an immutable oracle, mediate disputes with Adl fairness, archive to the House of Wisdom, and watch for threats. No player can bribe or configure them — they follow constitutional law only.",
    },
  },
  {
    concept: "urp",
    title: "URP · Universal Resource Pool",
    short:
      "The one shared living organism for the entire BIZRA ecosystem — not per-user, not a server.",
    long: "The URP is singular. It is not middleware, not a server that nodes are clients of, and not per-user. It wakes up when Node0 activates: SAT-5 agents are minted into it, and it grows by 5 SAT agents for every new human who joins. The URP contains: the Constitutional Spine, House of Wisdom, Proof Engine, SEED Treasury, Compute Pool, Storage Pool, Bandwidth Pool, Shared Reflex Registry, and Receipt Log.",
    truth_label: "DECLARED",
    see_also: ["sat", "bizra", "node0"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
    perspectives: {
      simple:
        "The one shared living organism for the entire BIZRA ecosystem — not per-user, not a server.",
      technical:
        "The URP is architecturally singular: one instance for the entire BIZRA ecosystem, dormant before Node0 activation. On Node0 activation it wakes with 5 SAT agents and grows by exactly 5 SAT agents per new human node. Internal compartments: Constitutional Spine, House of Wisdom, Proof Engine, SEED Treasury, Compute Pool, Storage Pool, Bandwidth Pool, Shared Reflex Registry, Receipt Log. The URP is not a server nodes are clients of — the membrane model inverts that: PAT pushes proposals through the membrane into a constitutionally-governed shared space. Source: BIZRA_TOPOLOGY_CANON.md §'What is shared for the entire ecosystem'.",
      arabic:
        "مجمع الموارد الشامل (URP) — بِرْكَةُ المَوَارِدِ الكُونِيَّة — هو كيان مشترك واحد للنظام بأكمله. يبقى خاملاً حتى يُفعِّل العقدة صفر (Node0). عند التفعيل ينبثق بخمسة وكلاء نظاميين، ويُضاف خمسة وكلاء لكل إنسان جديد ينضم. يحتوي على: العمود الدستوري، وبيت الحكمة، ومحرك الإثبات، وخزينة البذرة، ومجمعات الحوسبة والتخزين والنطاق الترددي.",
      game: "The URP is the shared realm server — not owned by any guild, not a vendor you subscribe to. It starts dormant (zero players, zero power) and wakes when the first node activates. Every new player who joins contributes 5 SAT agents to it, like depositing five guild-bound citizens into a constitutional city-state. The more nodes join, the more the realm grows — but the laws never change.",
    },
  },
  {
    concept: "fate",
    title: "FATE · Evaluation and Consent Gate",
    short:
      "The constitutional membrane component that gates agent actions against the consent record.",
    long: "FATE is one of the 7 BIZRA pillars. It sits between intent (PAT) and execution (SAT/network), evaluating every proposed action against the operator's consent scope. FATE is fail-closed: an incomplete or absent consent record blocks, not degrades gracefully. It implements ADR-005 exact-string consent for operator-facing actions.",
    truth_label: "DECLARED",
    see_also: ["pat", "sat", "boundary"],
    doc_anchor: "docs/public/third-fact-v0.1.md",
    perspectives: {
      simple:
        "The constitutional membrane component that gates agent actions against the consent record.",
      technical:
        "FATE is the seventh of the 7 BIZRA pillars and the membrane's active enforcement layer. It receives intent proposals from PAT-7 and evaluates them against the operator's granular consent record before any execution reaches SAT or the network. Evaluation is fail-closed: an absent, incomplete, or mismatched consent record results in a blocking refusal — FATE never degrades gracefully. It enforces ADR-005 exact-string consent: the typed phrase must match verbatim. Each FATE decision (permit or refuse) mints a receipt via the constitutional membrane. Source: docs/public/third-fact-v0.1.md + ADR-005.",
      arabic:
        "بوابة التقييم والموافقة (FATE) هي المكوّن النشط للغشاء الدستوري. تقع بين النية (PAT) والتنفيذ (SAT)، وتُقيّم كل إجراء مقترح مقابل سجل الموافقة التفصيلية للمشغّل. مبدؤها: الإغلاق عند الشك — أي سجل غائب أو غير مكتمل يُوقف الإجراء. لا تُهادن ولا تتساهل.",
      game: "FATE is the portcullis of the constitutional castle. Every action your PAT party wants to take must pass through FATE's gatehouse first. The gatekeeper checks the exact consent scroll — even one wrong word on the passphrase means the gate stays down. There's no 'close enough' in FATE's rulebook, and every verdict (open or closed) is logged as a receipt.",
    },
  },
  {
    concept: "dema",
    title: "DEMA · P7 · The Face",
    short:
      "The human-facing agent — P7 of PAT-7. The only surface the operator directly touches.",
    long: "DEMA is P7 (the Nexus/face) in the PAT-7 team. It is the only agent the human interacts with: all other PAT agents, SAT agents, and the URP are invisible to the operator. DEMA routes intent, surfaces previews, mints receipts, and refuses actions that violate the boundary. At the repo level, Dema is the CLI and local toolkit — the face of the system before federation is active.",
    truth_label: "DECLARED",
    see_also: ["pat", "boundary", "receipt"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
    perspectives: {
      simple:
        "The human-facing agent — P7 of PAT-7. The only surface the operator directly touches.",
      technical:
        "DEMA is P7/Nexus in the PAT-7 team, the sole interaction surface for the operator. Architectural responsibilities: route operator intent to the appropriate inner agents (P1–P6), surface previews before any consequential action, gate consent collection via FATE, mint receipts for every crossing of the constitutional membrane, and refuse boundary-violating requests with a logged refusal receipt. At the Dema repo level (before federation), DEMA is the local CLI: NODE0_LOCAL_SEED mode, no SAT federation, no URP connection. Source: BIZRA_TOPOLOGY_CANON.md §'The one sentence' + §'What is local per human'.",
      arabic:
        "دِمَا (DEMA) هي الوكيل رقم 7 (P7/النواة) في فريق PAT-7، وهو الواجهة الإنسانية الوحيدة للمشغّل. تتولى توجيه النية، وعرض المعاينات، وجمع الموافقة، وسكّ الإيصالات. الاسم مأخوذ من اسم ابنة المؤسس — حاملة روح المشروع وهويته الإنسانية.",
      game: "DEMA is your guild's guildmaster NPC — the single character you ever speak to. Behind DEMA is a full party of specialist agents handling quests, research, code, ethics, and publishing, but you never address them directly. DEMA translates your intent into party orders, shows you a preview before anything real happens, and holds the consent scroll that governs every action.",
    },
  },
  {
    concept: "bizra",
    title: "BIZRA · The 7-Pillar Ecosystem",
    short:
      "The constitutional ecosystem of sovereign local intelligence — PAT · SAT · DEMA · FATE · URP · RECEIPTS · POI.",
    long: "BIZRA (البذرة, the seed) is the full ecosystem. Its seven pillars are: PAT (Personal Agentic Team), SAT (System Agentic Team), DEMA (the face), FATE (consent gate), URP (Universal Resource Pool), RECEIPTS (the evidence chain), and POI (Proof of Impact). The Third Fact manifesto anchors the architecture at Bitcoin blocks 948027–948029. BIZRA is fractal: every node carries the full system DNA (seed-pattern invariant).",
    truth_label: "DECLARED",
    see_also: ["pat", "sat", "third-fact"],
    doc_anchor: "docs/public/third-fact-v0.1.md",
    perspectives: {
      simple:
        "The constitutional ecosystem of sovereign local intelligence — PAT · SAT · DEMA · FATE · URP · RECEIPTS · POI.",
      technical:
        "BIZRA is the 7-pillar constitutional ecosystem designed to close the Third Fact fracture: data comes from the many, infrastructure owned by the few. Seven pillars: PAT (user-loyal local team), SAT (system-loyal shared verifiers), DEMA (the human face, P7), FATE (consent gate), URP (singular shared resource pool), RECEIPTS (BLAKE3-chained provenance), POI (Proof of Impact). Architectural invariants: riba-zero, zann-zero, Gini ≤ 0.35, Ihsan ≥ 0.95, exact-string consent (ADR-005). Seed-pattern invariant: every node carries full system DNA. Anchored to Bitcoin blocks 948027–948029. Source: docs/public/third-fact-v0.1.md + BIZRA_TOPOLOGY_CANON.md.",
      arabic:
        "بِزْرَة (BIZRA) هي منظومة دستورية للذكاء المحلي السيادي، مبنية على سبعة ركائز: فريق الوكلاء الشخصي (PAT)، وفريق الوكلاء النظامي (SAT)، ودِمَا (الواجهة)، وبوابة الموافقة (FATE)، ومجمع الموارد الشامل (URP)، والإيصالات (سلسلة الأدلة)، وإثبات الأثر (POI). الاسم مشتق من 'البذرة' — إذ كل عقدة تحمل الحمض النووي الكامل للنظام.",
      game: "BIZRA is the full game world: seven core systems that every player node inherits. PAT is your local party, SAT is the realm's neutral referee guild, DEMA is the face you talk to, FATE is the gatehouse, URP is the shared server economy, RECEIPTS are the immutable quest log, and POI is the impact scoreboard. The world is fractal: every node carries the complete rule-set, like every cell carrying the full genome.",
    },
  },
  {
    concept: "third-fact",
    title: "Third Fact",
    short:
      "The founding manifesto: data comes from the many, infrastructure is owned by the few — BIZRA closes that gap.",
    long: "The Third Fact (docs/public/third-fact-v0.1.md) states: the first fact is that intelligence needs computation; the second fact is that intelligence needs data. The third fact is the fracture — data comes from the many while infrastructure is owned by the few. BIZRA is the design thesis that closes this fracture: sovereign local intelligence, receipt-backed provenance, and constitutional economics. Anchored to Bitcoin blocks 948027, 948028, 948029.",
    truth_label: "DECLARED",
    see_also: ["al-risala", "al-budhra", "bitcoin-anchor"],
    doc_anchor: "docs/public/third-fact-v0.1.md",
  },
  {
    concept: "al-risala",
    title: "الرسالة · The Message",
    short:
      "One of the three founding documents — the mission letter from the first architect.",
    long: "الرسالة (al-Risāla, The Message) is the founding letter authored by Node0 (Mohamed Beshr). Together with البذرة and the Third Fact, it forms the DNA of BIZRA's constitutional spine. All three documents are Bitcoin-anchored at blocks 948027, 948028, 948029 and are the first corpus entries a Lighthouse operator must read before participating.",
    truth_label: "DECLARED",
    see_also: ["al-budhra", "third-fact", "bitcoin-anchor"],
    doc_anchor: "docs/public/third-fact-v0.1.md",
  },
  {
    concept: "al-budhra",
    title: "البذرة · The Seed",
    short:
      "One of the three founding documents — the seed-pattern constitutional blueprint.",
    long: "البذرة (al-Budhra, The Seed) is the second founding document. It carries the economic design (50% project-profit founder oath, 2.5% universal Zakat, zero riba), the 7-pillar architecture, and the seed-pattern invariant: every node carries the full system DNA. Anchored at Bitcoin blocks 948027–948029 alongside الرسالة and the Third Fact.",
    truth_label: "DECLARED",
    see_also: ["al-risala", "third-fact", "founding-documents"],
    doc_anchor: "docs/public/third-fact-v0.1.md",
  },
  {
    concept: "node0",
    title: "Node0",
    short:
      "The origin — the founder's primary device, the first activated PAT-7 in the system.",
    long: "Node0 is the first node. There is exactly one Node0. Per the Node Ordinal Law in BIZRA_TOPOLOGY_CANON.md: Node0 is the origin, and its ordinal is identity-bearing. The Dema CLI running locally on Node0 is called NODE0_LOCAL_SEED mode. Node0 runs without federation, without a live network, and without a public economic claim — it is the seed the whole system grows from.",
    truth_label: "DECLARED",
    see_also: ["node1", "boundary", "pat"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
    perspectives: {
      simple:
        "The origin — the founder's primary device, the first activated PAT-7 in the system.",
      technical:
        "Node0 is ordinal-zero: the unique first node, identity-bearing (ordinal is part of the node identity, not just metadata). Operating mode: NODE0_LOCAL_SEED — no federation, no live URP connection, no public economic claim. The Dema CLI repo is Node0's local seed implementation. Companion devices (e.g., a secondary phone) share Node0's ordinal — they are not Node1. The Node Ordinal Law (BIZRA_TOPOLOGY_CANON.md) fixes: ordinals are assigned in join order and are permanent; only one Node0 can ever exist; companion devices do not increment the ordinal counter. Source: BIZRA_TOPOLOGY_CANON.md §'Node ordinal law'.",
      arabic:
        "العقدة صفر (Node0) هي نقطة الأصل — الجهاز الأساسي للمؤسس والعقدة الأولى في النظام. ترتيبها (صفر) يُمثّل هويتها لا مجرد وصف. تعمل في وضع 'البذرة المحلية' (NODE0_LOCAL_SEED) دون اتحاد مع الشبكة، ودون ادعاء اقتصادي عام. كل النظام ينبثق منها — كما ينبثق الشجر من بذرته.",
      game: "Node0 is Player One — the origin character who woke the realm. There is exactly one Node0; you can have companion devices (like a phone that shares your login), but they don't become Node1. Node0 runs in solo mode: no server federation, no shared economy claims — just proving the mechanics work locally before the multiplayer gates open.",
    },
  },
  {
    concept: "node1",
    title: "Node1",
    short:
      "The first invited human — a different person, not the founder's second device.",
    long: "Node1 is the second human to complete BIZRA onboarding, receive a registry-assigned ordinal, and mint their own PAT-7 on their own hardware. The common mistake is to assume Node1 is the operator's second laptop — it is not. A companion device shares the same ordinal as its primary. Node1 onboarding depends on Lighthouse proving 'alive alone' on at least one other machine before federation is attempted.",
    truth_label: "DECLARED",
    see_also: ["node0", "lighthouse", "ring-1"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
  {
    concept: "lighthouse",
    title: "Lighthouse",
    short:
      "The private, invitation-only pilot lane for validating Dema before public federation.",
    long: "Lighthouse is BIZRA's proving step for 'alive alone' on a second machine with a different human. It is not open for public application. Operators must be personally known to the program owner, read all three founding documents, operate inside exact-string consent discipline, and hold a posture where the bounded act is the point — not speculation about upside. Lighthouse validates: install → setup → doctor → first L4 receipt.",
    truth_label: "DECLARED",
    see_also: ["node1", "ring-0", "ring-1"],
    doc_anchor: "docs/LIGHTHOUSE.md",
  },
  {
    concept: "ring-0",
    title: "Ring 0",
    short:
      "The founder — the innermost trust circle in the evidence-first GTM ladder.",
    long: "Ring 0 is the founder (Node0 operator). In evidence-first GTM, real paradigm shifts propagate through rings of increasing skepticism: Ring 0 (founder) → Ring 1 (technical lighthouse) → Ring 2 (domain lighthouse) → Ring 3 (design partner cohort) → Ring 4 (public record). The rule: evidence arrives before narrative. A ring is never claimed before it is earned. Skipping rings is forbidden.",
    truth_label: "DECLARED",
    see_also: ["ring-1", "lighthouse", "node0"],
    doc_anchor: "docs/LIGHTHOUSE.md",
  },
  {
    concept: "ring-1",
    title: "Ring 1",
    short:
      "Technical lighthouse operators — the first external witnesses, personally known to Ring 0.",
    long: "Ring 1 is the Lighthouse cohort: technically capable operators from the existing trust circle who can run, verify, and witness Dema locally on their own hardware. Ring 1 is earned when at least one external human has completed onboarding, produced a first receipt, and can replay the boundary proofs without hand-holding. Public outreach for Ring 1 operators is itself a federation claim and is forbidden.",
    truth_label: "DECLARED",
    see_also: ["ring-0", "lighthouse", "node1"],
    doc_anchor: "docs/LIGHTHOUSE.md",
  },
  {
    concept: "artifact-011",
    title: "ARTIFACT-011",
    short:
      "The ARTIFACT-011 readiness gate — the constitutional checkpoint before any runtime activation.",
    long: "ARTIFACT-011 is referenced in `dema mission propose` as the boundary that governs whether BIZRA Node0 is ready to run a bounded diagnostic activation. It is not a software artifact — it is a readiness declaration that the constitutional layer has been proven locally. The mission propose command previews this gate without executing it. Runtime activation requires typed explicit consent: 'GO: Node0 bounded diagnostic activation only'.",
    truth_label: "DECLARED",
    see_also: ["boundary", "receipt", "truth-label"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
  {
    concept: "adr-005",
    title: "ADR-005 · Explicit Consent Rule",
    short:
      "Operator actions require exact-string typed consent — no fuzzy match, no case-insensitive shortcut.",
    long: "ADR-005 (Accepted, 2026-04-17) establishes that all operator actions require: pre-action disclosure, granular per-action consent (not blanket), visible action log, stop-anytime, reversibility signal, sandbox default, and receipt generation. The key invariant for the Dema CLI: consent phrases must match verbatim. A consent phrase with a spelling variant, extra space, or case difference is rejected. This rule is load-bearing across PAT, SAT, FATE, and skill-growth-governor.",
    truth_label: "DECLARED",
    see_also: ["boundary", "receipt", "refusal-as-product"],
    doc_anchor:
      "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md",
  },
  {
    concept: "daughter-test",
    title: "Daughter Test",
    short:
      "Would you be willing to subject your own family to this output? If not, do not ship it.",
    long: "The Daughter Test is the operational application of Ihsan: before releasing any output, ask whether you would accept the same output if it came from a system your family depended on. If not, it does not clear the Ihsan floor. It is the primary human-dignity check in BIZRA and is binding on all brand IP and all public-facing artifacts.",
    truth_label: "DECLARED",
    see_also: ["ihsan", "adl", "refusal-as-product"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
  {
    concept: "receipt",
    title: "Receipt",
    short:
      "A BLAKE3-chained, tamper-evident record that every consequential action in Dema produces.",
    long: "A receipt is the atomic unit of BIZRA provenance. Every crossing of the constitutional membrane, every mint, every skill promotion, and every consent event produces a receipt chained to the previous one via BLAKE3 hash. Receipts have: a schema tag, an evidence hash, a chain position, a prev_hash link, and a truth label. A receipt cannot be minted, modified, or faked locally — it routes through the governed gateway handoff.",
    truth_label: "DECLARED",
    see_also: ["chain", "boundary", "truth-label"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
    perspectives: {
      simple:
        "A BLAKE3-chained, tamper-evident record that every consequential action in Dema produces.",
      technical:
        "A receipt is the atomic provenance unit in BIZRA. Schema fields: schema tag (e.g. bizra.dema.canon_glossary_entry.v0.1), evidence_hash (BLAKE3 of the event payload), chain_position (sequential integer), prev_hash (BLAKE3 of prior receipt — links the chain), truth_label (DECLARED/MEASURED/ASSUMED). The membrane's cryptographic provenance guarantee (property 3 in BIZRA_TOPOLOGY_CANON.md) requires every constitutional crossing to emit a receipt. Receipts are append-only; no local code path can modify or delete a minted receipt. Source: BIZRA_TOPOLOGY_CANON.md §'The membrane' property 3 + §'Receipt completeness'.",
      arabic:
        "الإيصال هو الوحدة الأساسية للإثبات في منظومة BIZRA. يُنتَج عن كل عبور للغشاء الدستوري — كل سكّ، وكل تعزيز مهارة، وكل حدث موافقة. يتضمن: وسم المخطط، وبصمة الأدلة (BLAKE3)، وموضعه في السلسلة، ورابط الإيصال السابق. السلسلة إلحاقية فقط — لا حذف، ولا تعديل، ولا تزوير.",
      game: "A receipt is a quest log entry that the game engine writes automatically and can never be erased. Finish a crafting action? Receipt. Cross the consent gate? Receipt. Each entry chains to the one before it via a cryptographic hash — tamper with any entry and the whole chain breaks like a broken link in plate armor. This is BIZRA's proof that you actually did what you claim you did.",
    },
  },
  {
    concept: "chain",
    title: "Chain · Receipt Chain",
    short:
      "The append-only, SHA-256-linked sequence of receipts that forms the local evidence log.",
    long: "The receipt chain is the local evidence log: an ordered sequence of receipts where each receipt's prev_hash field links to the SHA-256 hash of the prior receipt. The chain is append-only and tamper-evident. Any gap, hash mismatch, or out-of-order entry is a chain violation. The chain does not live on a blockchain — it is a local filesystem-scoped structure managed under ~/.dema/receipts/ and verified by the SAT-4 Receipt Chain Verifier.",
    truth_label: "DECLARED",
    see_also: ["receipt", "boundary", "sat"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
  {
    concept: "truth-label",
    title: "Truth Label",
    short:
      "A tag on every claim: DECLARED · MEASURED · ASSUMED · ASPIRATIONAL — no collapsing allowed.",
    long: "Every claim in a BIZRA artifact must carry a truth label that says exactly how certain it is. The canonical labels are: DECLARED (explicit in a canon document), MEASURED (empirically tested — tests pass, numbers measured), ASSUMED (derived with Ihsan, stated as assumption), ASPIRATIONAL/PLANNED (not yet real). The zann-zero invariant forbids collapsing these categories. A 'DECLARED' label on an unverified claim is itself a zann violation.",
    truth_label: "DECLARED",
    see_also: ["zann-zero", "ihsan", "receipt"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
  {
    concept: "refusal-as-product",
    title: "Refusal as Product",
    short:
      "A principled refusal is a delivery — the system showing its spine, not a failure.",
    long: "Refusal-as-product is the BIZRA operational doctrine that a well-reasoned refusal is as valuable as a completed action — often more. When DEMA refuses to promote a skill without evidence, refuses to mint without typed consent, or refuses to execute a boundary-crossing action, it is producing proof that the constitutional spine is load-bearing. The refusal taxonomy in skill-growth-governor.js lists 8 canonical refusal paths. Each refusal mints a receipt.",
    truth_label: "DECLARED",
    see_also: ["ihsan", "adr-005", "boundary"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
  {
    concept: "founding-documents",
    title: "Founding Documents",
    short:
      "The three Bitcoin-anchored constitutional texts: الرسالة · البذرة · Third Fact.",
    long: "The founding documents are the three texts that constitute BIZRA's constitutional DNA: الرسالة (The Message), البذرة (The Seed), and the Third Fact manifesto. All three are anchored to the Bitcoin blockchain at blocks 948027, 948028, and 948029 respectively. They form the priority anchor for all doctrine: Quran → Hadith → البذرة → الرسالة → Spine → Invariants → Specs → Code.",
    truth_label: "DECLARED",
    see_also: ["al-risala", "al-budhra", "bitcoin-anchor"],
    doc_anchor: "docs/public/third-fact-v0.1.md",
  },
  {
    concept: "bitcoin-anchor",
    title: "Bitcoin Anchor",
    short:
      "The founding documents are inscribed into the Bitcoin blockchain at blocks 948027–948029.",
    long: "Bitcoin anchoring uses the immutability of the Bitcoin blockchain to timestamp the existence and content of the founding documents. Blocks 948027 (البذرة), 948028 (Third Fact), and 948029 (الرسالة) carry the hash of each founding document. This makes the founding moment cryptographically verifiable and irreversible: no future actor can claim the documents were authored after the fact.",
    truth_label: "DECLARED",
    see_also: ["founding-documents", "receipt", "third-fact"],
    doc_anchor: "docs/public/third-fact-v0.1.md",
  },
  {
    concept: "boundary",
    title: "Boundary · Canonical 16-Key Boundary",
    short:
      "The 16 boolean flags that every Dema preview must pin to false — the constitutional membrane in code.",
    long: "The canonical boundary is a frozen object with 16 boolean keys, all false, that every Dema preview builder must attach to its output. The 16 keys are: filesystem_write_performed, network_used, runtime_execution_performed, model_loaded, model_invocation_performed, prompt_executed, external_call_performed, raw_corpus_scan_performed, raw_data_included, tool_executed, chain_advance_performed, receipt_mint_performed, federation_invoked, node_connection_performed, public_network_used, consent_collected. Any truthy value is a boundary violation.",
    truth_label: "DECLARED",
    see_also: ["receipt", "adr-005", "refusal-as-product"],
    doc_anchor: "docs/canon/BIZRA_TOPOLOGY_CANON.md",
  },
];

// Build a Map keyed by concept (already lowercase in RAW_ENTRIES).
// Each entry is frozen so callers cannot mutate canonical definitions.
const CANON_GLOSSARY = Object.freeze(
  new Map(
    RAW_ENTRIES.map((entry) => [
      entry.concept,
      Object.freeze({ schema: SCHEMA, ...entry }),
    ]),
  ),
);

// Levenshtein distance for close-match suggestions — no external dep.
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Look up a concept by name (case-insensitive, hyphen-normalised).
 * If concept is null/empty, returns listing mode object.
 * If concept is not found, returns { matched: false, suggestions: string[] }.
 *
 * @param {string|null|undefined} concept
 * @returns {object}
 */
function buildExplainPreview(concept) {
  // Listing mode
  if (
    concept === null ||
    concept === undefined ||
    String(concept).trim() === ""
  ) {
    return {
      mode: "listing",
      schema: SCHEMA,
      count: CANON_GLOSSARY.size,
      concepts: [...CANON_GLOSSARY.values()].map((e) => ({
        concept: e.concept,
        title: e.title,
        short: e.short,
      })),
    };
  }

  // Reject inputs that are clearly unsafe (prototype pollution etc.)
  const raw = String(concept).trim();
  if (raw.length > 200) {
    return { matched: false, suggestions: [] };
  }
  const key = raw.toLowerCase();

  // Exact match
  if (CANON_GLOSSARY.has(key)) {
    return CANON_GLOSSARY.get(key);
  }

  // Close match via Levenshtein
  const threshold = key.length < 6 ? 2 : 3;
  const suggestions = [];
  for (const k of CANON_GLOSSARY.keys()) {
    const dist = levenshtein(key, k);
    if (dist <= threshold) {
      suggestions.push({ concept: k, distance: dist });
    }
  }
  suggestions.sort((a, b) => a.distance - b.distance);

  return {
    matched: false,
    queried: raw,
    suggestions: suggestions.slice(0, 3).map((s) => s.concept),
  };
}

/**
 * Format a glossary entry (or listing/not-found result) as human-readable text.
 *
 * @param {object} entry - result from buildExplainPreview
 * @returns {string}
 */
function formatExplainPreview(entry) {
  if (!entry || typeof entry !== "object") {
    return "Error: invalid glossary entry.";
  }

  // Listing mode
  if (entry.mode === "listing") {
    const lines = [`Available concepts (${entry.count}):`];
    const items = entry.concepts.map((c) => c.title);
    // 4 per row
    for (let i = 0; i < items.length; i += 4) {
      lines.push(
        "  " +
          items
            .slice(i, i + 4)
            .map((t) => t.padEnd(20))
            .join("  ")
            .trimEnd(),
      );
    }
    lines.push("");
    lines.push("Type `dema explain <name>` for any of these.");
    return lines.join("\n");
  }

  // Not found
  if (entry.matched === false) {
    const lines = [
      `I don't have a definition for \`${entry.queried}\` yet.`,
      "",
    ];
    lines.push("You can browse what I do know:");
    lines.push(
      "  $ dema explain                   — list all explained concepts",
    );
    lines.push("  $ dema help                      — full command list");
    if (entry.suggestions && entry.suggestions.length > 0) {
      lines.push("");
      lines.push("Did you mean:");
      for (const s of entry.suggestions) {
        const e = CANON_GLOSSARY.get(s);
        if (e) lines.push(`  $ dema explain ${s.padEnd(20)} — ${e.short}`);
      }
    }
    return lines.join("\n");
  }

  // Full entry
  const lines = [];
  lines.push(entry.title);
  lines.push("  " + entry.short);
  lines.push("  " + entry.long);
  lines.push("");
  lines.push(
    `  Truth label: ${entry.truth_label} (${truthLabelNote(entry.truth_label)}).`,
  );
  if (entry.see_also && entry.see_also.length > 0) {
    lines.push("");
    lines.push("  See also:");
    for (const ref of entry.see_also) {
      const related = CANON_GLOSSARY.get(ref);
      const hint = related ? related.short : ref;
      lines.push(`    - dema explain ${ref.padEnd(20)} — ${hint}`);
    }
    if (entry.doc_anchor) {
      lines.push(`    - ${entry.doc_anchor}`);
    }
  }
  return lines.join("\n");
}

function truthLabelNote(label) {
  switch (label) {
    case "DECLARED":
      return "constitutional anchor from the founding documents";
    case "MEASURED":
      return "empirically verified — tests pass, numbers measured";
    case "ASSUMED":
      return "derived with Ihsan, stated explicitly as assumption";
    default:
      return "see truth-label discipline";
  }
}

/**
 * Retrieve one perspective text for a concept, or null if absent.
 * Returns null for invalid perspective names or unknown concepts.
 * Safe against prototype-pollution inputs.
 *
 * @param {string} concept - glossary key (case-insensitive)
 * @param {string} perspective - one of: simple, technical, arabic, game
 * @returns {string|null}
 */
function getPerspective(concept, perspective) {
  const VALID = new Set(["simple", "technical", "arabic", "game"]);
  if (typeof concept !== "string" || typeof perspective !== "string")
    return null;
  if (!VALID.has(perspective)) return null;

  const key = concept.trim().toLowerCase();
  const entry = CANON_GLOSSARY.get(key);
  if (!entry) return null;

  const persp = entry.perspectives;
  if (!persp) {
    // No perspectives block — fall back to simple using short.
    if (perspective === "simple") return entry.short;
    return null;
  }

  const text = persp[perspective];
  return typeof text === "string" && text.length > 0 ? text : null;
}

export {
  CANON_GLOSSARY,
  buildExplainPreview,
  formatExplainPreview,
  getPerspective,
};
