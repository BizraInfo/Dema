// Dema UX lifecycle — canonical model (pure data, no side effects)
//
// Sources (design-source contracts, not runtime claims):
// - DEMA_FIRST_TIME_ONBOARDING_PROTOCOL_v0_1.md  (DECLARED_SPEC / DESIGNED_NOT_LIVE)
// - .claude/rules/02-node0-activation.md          (observe → verify → benchmark → route → dry-run → activate)
// - Dema Node0 Cockpit v2 — Meaning-Guided Loop   (daily loop)
//
// Truth discipline: everything this module describes is UI structure.
// Nothing here proves runtime behavior. No claim above its evidence.

import type { SceneId } from "@/lib/game/types";

export type Lang = "en" | "ar";

export interface Bilingual {
  en: string;
  ar: string;
}

// ---------------------------------------------------------------------------
// Onboarding loop (first run): Bond → Introduction → Foundation → Discovery → First Mission
// ---------------------------------------------------------------------------

export type OnboardingPhaseId =
  | "bond"
  | "introduction"
  | "foundation"
  | "discovery"
  | "firstMission";

export interface OnboardingPhase {
  id: OnboardingPhaseId;
  name: Bilingual;
  purpose: Bilingual;
}

export const ONBOARDING_PHASES: OnboardingPhase[] = [
  {
    id: "bond",
    name: { en: "Bond", ar: "الرابطة" },
    purpose: {
      en: "Languages, name, and how your name is kept — locally, changeable, never shared without consent.",
      ar: "اللغات والاسم وكيفية حفظه — محليًا، قابل للتغيير، ولا يُشارك دون إذن.",
    },
  },
  {
    id: "introduction",
    name: { en: "Dema introduces herself", ar: "ديما تعرّف بنفسها" },
    purpose: {
      en: "Who Dema is, what she will and will not do.",
      ar: "من هي ديما، وما الذي تفعله وما لا تفعله.",
    },
  },
  {
    id: "foundation",
    name: { en: "Foundation", ar: "الأساس" },
    purpose: {
      en: "Visible local scaffolds: profile, PAT-7 profiles, receipts ledger — created empty, shown honestly.",
      ar: "هياكل محلية مرئية: الملف، ملفات PAT-7، سجل الإيصالات — تُنشأ فارغة وتُعرض بصدق.",
    },
  },
  {
    id: "discovery",
    name: { en: "Model capability discovery", ar: "استكشاف قدرات النماذج" },
    purpose: {
      en: "By exact consent only. Bootstrap Mode 0 is the default — the node exists before any model.",
      ar: "بالإذن الحرفي فقط. الوضع صفر هو الافتراضي — العقدة موجودة قبل أي نموذج.",
    },
  },
  {
    id: "firstMission",
    name: { en: "First mission", ar: "المهمة الأولى" },
    purpose: {
      en: "One seed carried through the corridor to a proof-backed step.",
      ar: "بذرة واحدة تُحمل عبر الممر إلى خطوة مدعومة بالإثبات.",
    },
  },
];

// ---------------------------------------------------------------------------
// Daily loop (Mission Corridor): Seed → Assumption → Meaning → Consent → Proof → Growth
// ---------------------------------------------------------------------------

export type StationId =
  | "seed"
  | "assumption"
  | "meaning"
  | "consent"
  | "proof"
  | "growth";

export interface CorridorStation {
  id: StationId;
  glyph: string;
  name: Bilingual;
  desc: Bilingual;
  scene: SceneId; // existing stage this station opens
  color: "proof" | "consent" | "verified" | "knowledge" | "snr" | "unknown";
}

export const CORRIDOR_STATIONS: CorridorStation[] = [
  {
    id: "seed",
    glyph: "◌",
    name: { en: "Seed", ar: "البذرة" },
    desc: {
      en: "Name the intention. A mission begins as a seed, not a command.",
      ar: "سَمِّ النية. تبدأ المهمة بذرةً لا أمرًا.",
    },
    scene: "world",
    color: "snr",
  },
  {
    id: "assumption",
    glyph: "؟",
    name: { en: "Assumption", ar: "الافتراض" },
    desc: {
      en: "Declare what is assumed vs known. Assume only with Ihsān.",
      ar: "أعلن ما هو مفترض وما هو معلوم. لا افتراض إلا بإحسان.",
    },
    scene: "claimBinding",
    color: "knowledge",
  },
  {
    id: "meaning",
    glyph: "✦",
    name: { en: "Meaning", ar: "المعنى" },
    desc: {
      en: "Weigh the meanings before the mechanics. Choose consciously.",
      ar: "زِن المعاني قبل الآليات. اختر بوعي.",
    },
    scene: "blackboard",
    color: "proof",
  },
  {
    id: "consent",
    glyph: "⬡",
    name: { en: "Consent", ar: "الإذن" },
    desc: {
      en: "Exact-string consent. Ambiguity fails closed.",
      ar: "إذن حرفي. الغموض يعني الرفض.",
    },
    scene: "consentGate",
    color: "consent",
  },
  {
    id: "proof",
    glyph: "⛭",
    name: { en: "Proof", ar: "الإثبات" },
    desc: {
      en: "Bind the claim to evidence. Forge the receipt.",
      ar: "اربط الادعاء بالدليل. اسبك الإيصال.",
    },
    scene: "proofForge",
    color: "verified",
  },
  {
    id: "growth",
    glyph: "𐂷",
    name: { en: "Growth", ar: "النمو" },
    desc: {
      en: "The receipt feeds the node. The node feeds the next seed.",
      ar: "الإيصال يغذي العقدة، والعقدة تغذي البذرة التالية.",
    },
    scene: "ecosystem",
    color: "snr",
  },
];

// ---------------------------------------------------------------------------
// Node0 activation rail: observe → verify → benchmark → route → dry-run → activate
// UI mirror only. SHIPPED means the surface exists on disk in the Dema repo —
// not that the rung is runtime-correct. Activation itself lives OUTSIDE this app.
// ---------------------------------------------------------------------------

export type RailStatus =
  | "SHIPPED"
  | "PREVIEW_ONLY"
  | "DESIGNED_NOT_LIVE"
  | "OUTSIDE_THIS_APP";

export interface ActivationStep {
  id: string;
  name: Bilingual;
  surface: string; // where this lives in the governed runtime
  status: RailStatus;
}

export const ACTIVATION_RAIL: ActivationStep[] = [
  {
    id: "observe",
    name: { en: "Observe", ar: "الرصد" },
    surface: "dema node0 activation observe",
    status: "SHIPPED",
  },
  {
    id: "verify",
    name: { en: "Verify", ar: "التحقق" },
    surface: "receipts · proof-room · onboarding seal",
    status: "SHIPPED",
  },
  {
    id: "benchmark",
    name: { en: "Benchmark", ar: "القياس" },
    surface: "dema models discover · eval baseline · eval compare",
    status: "SHIPPED",
  },
  {
    id: "route",
    name: { en: "Route", ar: "التوجيه" },
    surface: "dema eval route",
    status: "PREVIEW_ONLY",
  },
  {
    id: "dryRun",
    name: { en: "Dry-run", ar: "التشغيل الجاف" },
    surface: "council / mission previews · boundary all-false",
    status: "PREVIEW_ONLY",
  },
  {
    id: "activate",
    name: { en: "Activate", ar: "التفعيل" },
    surface: "BIZRA-DATA-LAKE + explicit GO — never from this UI",
    status: "OUTSIDE_THIS_APP",
  },
];

// ---------------------------------------------------------------------------
// Intelligence modes (Model Capability Discovery, onboarding v0.1.1)
// ---------------------------------------------------------------------------

export interface IntelligenceMode {
  mode: 0 | 1 | 2 | 3 | 4;
  name: Bilingual;
  desc: Bilingual;
  recommended?: boolean;
}

export const INTELLIGENCE_MODES: IntelligenceMode[] = [
  {
    mode: 0,
    name: { en: "Bootstrap — no model", ar: "الإقلاع — بلا نموذج" },
    desc: {
      en: "Deterministic shell + rules + consent + receipts. The node is useful before any model exists.",
      ar: "صدفة حتمية + قواعد + إذن + إيصالات. العقدة نافعة قبل وجود أي نموذج.",
    },
    recommended: true,
  },
  {
    mode: 1,
    name: { en: "Local small model", ar: "نموذج محلي صغير" },
    desc: {
      en: "Basic summarize / classify / suggest meanings.",
      ar: "تلخيص وتصنيف واقتراح معانٍ بشكل أساسي.",
    },
  },
  {
    mode: 2,
    name: { en: "Local capable model", ar: "نموذج محلي قادر" },
    desc: {
      en: "Stronger PAT-style reasoning, fully local.",
      ar: "استدلال أقوى بنمط PAT، محلي بالكامل.",
    },
  },
  {
    mode: 3,
    name: { en: "Remote by explicit consent", ar: "بعيد بإذن صريح" },
    desc: {
      en: "Approved provider, per-mission, never silent.",
      ar: "مزوّد معتمد، لكل مهمة، وليس في صمت أبدًا.",
    },
  },
  {
    mode: 4,
    name: { en: "Hybrid", ar: "هجين" },
    desc: {
      en: "Simple work local; complex work to an approved engine.",
      ar: "العمل البسيط محليًا؛ والمعقد إلى محرك معتمد.",
    },
  },
];

// Exact-string consent phrases (fate discipline: exact match or fail closed)
export const CONSENT_DISCOVER = "GO: DISCOVER LOCAL MODEL CAPABILITY ONLY";
export const CONSENT_SKIP_DISCOVER = "SKIP: DO NOT DISCOVER MODELS";

// Dema's canonical self-introduction
export const DEMA_INTRO: Bilingual = {
  en: "I am Dema. I am the face of your BIZRA node. I do not replace you. I do not decide for you. I help you see meanings, choose consciously, act with consent, and preserve proof. Behind me is your private PAT-7 council. You speak with me; I consult them for you.",
  ar: "أنا ديما. أنا وجه عقدة بيذرة الخاصة بك. لا أحل محلك، ولا أقرر عنك. أساعدك أن ترى المعاني، وتختار بوعي، وتتصرف بإذن، وتحفظ الإثبات. خلفي مجلس PAT-7 الخاص بك. أنت تكلمني، وأنا أستشيرهم لأجلك.",
};

// What the corridor does NOT prove (rendered honestly in the UI)
export const CORRIDOR_DOES_NOT_PROVE: string[] = [
  "Live federation, token economy, or PoI rewards",
  "Autonomous PAT/SAT runtime",
  "Model correctness or benchmark rank",
  "Anything beyond this local, consent-gated preview",
];
