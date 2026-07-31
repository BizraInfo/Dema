// OPERATOR-SURFACE-I18N-1A — first-contact Arabic/English string packs.
//
// Covers dema welcome, dema onboard stage titles, and dema doctor labels.
// Arabic strings ship as DECLARED_NEEDS_NATIVE_REVIEW until the operator
// (native speaker) verifies them. No machine-translation claim is made.
// Pure: no fs, no network, no model.

import { buildLanguagePack } from "./language-pack.js";

export const OPERATOR_SURFACE_I18N_SCHEMA =
  "bizra.dema.operator_surface_i18n.v0.1";

export const ARABIC_STRINGS_TRUTH_LABEL = "DECLARED_NEEDS_NATIVE_REVIEW";

const EN = Object.freeze({
  welcome: Object.freeze({
    title: "Welcome to Dema.",
    subtitle: "Dema — Sovereign AI Node Companion",
    banner_line1: "Local-first. Consent-bound. Receipt-aware.",
    banner_line2: "BIZRA is the ecosystem. Dema is the product face.",
    what_dema_does: "What Dema does:",
    orientation_heading: "First-run orientation:",
    orientation_1: "Your node is local-first.",
    orientation_2: "Your actions are consent-bound.",
    orientation_3: "Run setup when you are ready to create local state.",
    user_state_heading: "Current user state:",
    phase: "phase",
    node_role: "node role",
    allowed: "allowed",
    blocked: "blocked",
    inspiration_heading: "Standing on shoulders, not copying:",
    guided_heading: "Guided first run:",
    boundary_heading: "Boundary:",
    boundary_body:
      "This guide is preview-only. It does not mutate files, start runtime, start a daemon, execute missions, mint receipts, connect Node1/Node2, start a multi-node pilot, perform Step 7 minting, post externally, or federate.",
    next_heading: "Next:",
    chat_hint: "For the interactive shell: dema chat",
  }),
  onboard: Object.freeze({
    header: "Dema — guided setup path",
    meta: "stages · preview only · nothing is created or sent",
    stage: "stage",
    why: "why",
    choices: "choices",
    boundary_heading: "Boundary:",
    boundary_1:
      "Preview only. No mission is created, no runtime starts, no receipt is minted,",
    boundary_2:
      "and nothing leaves this machine. Each stage acts only on your typed consent.",
    next_heading: "Next:",
    next_welcome: "dema welcome    — read the first-run orientation",
    next_status: "dema status     — see what is true, safe, and blocked",
  }),
  doctor: Object.freeze({
    activation_gate: "Activation gate",
    daemon: "Daemon",
    ready: "Ready",
    console_ready: "Console ready",
    gateway_probe: "Gateway probe",
    fix_blocked:
      "activation gate is BLOCKED: no Node0 runtime is reporting a gate. Only a governed runtime can move it — bridge one with DEMA_NODE0_ADAPTER=gateway-http plus DEMA_GATEWAY_URL, or DEMA_NODE0_STATUS_COMMAND (see docs/QUICKSTART.md). For preview-only use, BLOCKED is the correct resting state.",
    explain_hint: "Type `dema explain doctor` for what each predicate means.",
    // DOCTOR-PREVIEW-RESTING-STATE notes. These accompany the `expected` (⏸)
    // rows, which are false-but-correct on an unbridged install. They shipped
    // hardcoded in English while the labels beside them were already localized,
    // so an Arabic operator read Arabic labels with English explanations.
    note_preview_gate:
      "expected with no runtime bridged — bridge one with DEMA_NODE0_ADAPTER=gateway-http plus DEMA_GATEWAY_URL, or DEMA_NODE0_STATUS_COMMAND, to move it",
    note_ready_unbridged: "reported by the Node0 runtime — none is bridged",
    note_console_no_gateway: "no gateway configured",
    preview_footer_nothing_broken:
      "Nothing is broken. This is the expected state before a runtime is bridged.",
    preview_footer_exit_code:
      "`dema doctor` still exits non-zero because this node is not operational.",
    preview_footer_preview_flag:
      "To validate the preview environment itself: `dema doctor --preview` (exits 0).",
    fix_label: "Fix",
    note_label: "Note",
    summary_awaiting: "awaiting a bridged runtime",
  }),
  stage_titles: Object.freeze({
    language: "What language should I speak with you?",
    technical_level: "How should I explain things to you?",
    node_role:
      "You are being prepared as Node{ordinal}. Do you understand what that means?",
    purpose: "What do you want your node to help you with?",
    resources: "What resources may this node use on this machine?",
    consent_constitution: "Do you accept the local consent constitution?",
    first_mission: "What is the first bounded mission you want to preview?",
  }),
});

const AR = Object.freeze({
  truth_label: ARABIC_STRINGS_TRUTH_LABEL,
  welcome: Object.freeze({
    title: "أهلاً بك في ديما.",
    subtitle: "ديما — رفيق عقدة الذكاء السيادي",
    banner_line1: "محلي أولاً. مقيّد بالموافقة. مدرك للإيصالات.",
    banner_line2: "BIZRA هو النظام البيئي. ديما هي واجهة المنتج.",
    what_dema_does: "ماذا تفعل ديما:",
    orientation_heading: "توجيه التشغيل الأول:",
    orientation_1: "عقدتك محلية أولاً.",
    orientation_2: "أفعالك مقيّدة بموافقة صريحة.",
    orientation_3: "شغّل الإعداد عندما تكون جاهزاً لإنشاء الحالة المحلية.",
    user_state_heading: "حالة المستخدم الحالية:",
    phase: "المرحلة",
    node_role: "دور العقدة",
    allowed: "مسموح",
    blocked: "محظور",
    inspiration_heading: "نقف على أكتاف الآخرين، لا ننسخ:",
    guided_heading: "التشغيل الأول الموجَّه:",
    boundary_heading: "الحدود:",
    boundary_body:
      "هذا الدليل للمعاينة فقط. لا يعدّل ملفات، ولا يبدأ وقت تشغيل، ولا يبدأ خادماً خلفياً، ولا ينفّذ مهاماً، ولا يسكّ إيصالات، ولا يصل Node1/Node2، ولا يبدأ تجريباً متعدد العقد، ولا يقوم بسكّ الخطوة 7، ولا ينشر خارجياً، ولا يوحّد الشبكة.",
    next_heading: "التالي:",
    chat_hint: "للقشرة التفاعلية: dema chat",
  }),
  onboard: Object.freeze({
    header: "ديما — مسار الإعداد الموجَّه",
    meta: "مراحل · معاينة فقط · لا يُنشأ شيء ولا يُرسل",
    stage: "المرحلة",
    why: "لماذا",
    choices: "الخيارات",
    boundary_heading: "الحدود:",
    boundary_1:
      "معاينة فقط. لا تُنشأ مهمة، ولا يبدأ وقت تشغيل، ولا يُسكّ إيصال،",
    boundary_2:
      "ولا يغادر شيء هذا الجهاز. كل مرحلة تعمل فقط بموافقتك المكتوبة حرفياً.",
    next_heading: "التالي:",
    next_welcome: "dema welcome    — اقرأ توجيه التشغيل الأول",
    next_status: "dema status     — انظر ما هو حقيقي وآمن ومحظور",
  }),
  doctor: Object.freeze({
    activation_gate: "بوابة التفعيل",
    daemon: "الخادم الخلفي",
    ready: "الجاهزية",
    console_ready: "جاهزية الواجهة",
    gateway_probe: "فحص البوابة",
    fix_blocked:
      "بوابة التفعيل محظورة (BLOCKED): لا يوجد وقت تشغيل Node0 يبلّغ عن بوابة. فقط وقت تشغيل محكوم يمكنه تحريكها — اربط عبر DEMA_NODE0_ADAPTER=gateway-http مع DEMA_GATEWAY_URL، أو DEMA_NODE0_STATUS_COMMAND (انظر docs/QUICKSTART.md). للاستخدام بالمعاينة فقط، BLOCKED هي الحالة الصحيحة.",
    explain_hint: "اكتب `dema explain doctor` لمعرفة معنى كل شرط.",
    note_preview_gate:
      "متوقّعة ما دام لا يوجد وقت تشغيل مربوط — اربط واحداً عبر DEMA_NODE0_ADAPTER=gateway-http مع DEMA_GATEWAY_URL، أو DEMA_NODE0_STATUS_COMMAND، لتحريكها",
    note_ready_unbridged:
      "يبلّغ عنها وقت تشغيل Node0 — ولا يوجد وقت تشغيل مربوط",
    note_console_no_gateway: "لا توجد بوابة مُعدّة",
    preview_footer_nothing_broken:
      "لا يوجد خلل. هذه هي الحالة المتوقّعة قبل ربط وقت التشغيل.",
    preview_footer_exit_code:
      "الأمر `dema doctor` يخرج بقيمة غير صفرية لأن هذه العقدة ليست في وضع التشغيل.",
    preview_footer_preview_flag:
      "للتحقق من بيئة المعاينة نفسها: `dema doctor --preview` (يخرج بصفر).",
    fix_label: "إصلاح",
    note_label: "ملاحظة",
    summary_awaiting: "بانتظار ربط وقت التشغيل",
  }),
  stage_titles: Object.freeze({
    language: "بأي لغة تريدني أن أخاطبك؟",
    technical_level: "كيف تريدني أن أشرح لك الأمور؟",
    node_role:
      "أنت تُجهَّز كعقدة Node{ordinal}. هل تفهم ماذا يعني ذلك؟",
    purpose: "بماذا تريد أن تساعدك عقدتك؟",
    resources: "ما الموارد التي قد تستخدمها هذه العقدة على هذا الجهاز؟",
    consent_constitution: "هل تقبل دستور الموافقة المحلي؟",
    first_mission: "ما أول مهمة محدودة تريد معاينتها؟",
  }),
});

/**
 * Resolve the operator-facing string pack for a language code.
 * @param {string|null|undefined} languageCode ISO-639-1 or null
 */
export function resolveOperatorSurfaceI18n(languageCode = "en") {
  const code =
    typeof languageCode === "string" && languageCode.trim()
      ? languageCode.trim().toLowerCase()
      : "en";
  const pack = buildLanguagePack({
    language_code: code === "ar" ? "ar" : "en",
  });
  const strings = code === "ar" ? AR : EN;
  return Object.freeze({
    schema: OPERATOR_SURFACE_I18N_SCHEMA,
    language_code: code === "ar" ? "ar" : "en",
    script_direction: pack.script_direction,
    truth_label:
      code === "ar" ? ARABIC_STRINGS_TRUTH_LABEL : "DECLARED",
    strings,
  });
}

/** Apply Arabic stage titles when language is ar; otherwise leave English. */
export function localizeOnboardingStages(stages, languageCode) {
  if (languageCode !== "ar" || !Array.isArray(stages)) return stages;
  const titles = AR.stage_titles;
  return stages.map((stage) => {
    const localized = titles[stage.id];
    if (!localized) return stage;
    // Preserve {ordinal} placeholder if present in both.
    let title = localized;
    if (
      typeof stage.title === "string" &&
      stage.title.includes("{ordinal}") &&
      localized.includes("{ordinal}")
    ) {
      title = localized;
    } else if (
      typeof stage.title === "string" &&
      /Node\d+/.test(stage.title) &&
      localized.includes("{ordinal}")
    ) {
      const m = stage.title.match(/Node(\d+|\{ordinal\})/);
      title = localized.replace("{ordinal}", m ? m[1] : "N");
    }
    return { ...stage, title };
  });
}
