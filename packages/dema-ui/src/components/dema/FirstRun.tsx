"use client";

// Dema First-Time Onboarding — implements DEMA_FIRST_TIME_ONBOARDING_PROTOCOL v0.1
// Bond → Introduction → Foundation → Discovery → First Mission
//
// Truth discipline: this flow is a UI preview. Foundation scaffolds and the
// capability scan are SIMULATION_ONLY — nothing is written outside localStorage,
// nothing is scanned, no model is contacted. Consent is exact-string, fail-closed.

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_PHASES,
  INTELLIGENCE_MODES,
  CONSENT_DISCOVER,
  CONSENT_SKIP_DISCOVER,
  DEMA_INTRO,
  type Lang,
} from "@/lib/lifecycle";
import { Check, ChevronRight, Lock, ShieldAlert } from "lucide-react";

const STORAGE_KEY = "dema.firstRun.v0_1";

export interface FirstRunRecord {
  completed: boolean;
  name?: string;
  saveName?: boolean;
  motherLang?: string;
  workingLang?: string;
  mode?: number;
  discovery?: "consented_simulated" | "skipped";
  completedAt?: number;
}

export function readFirstRun(): FirstRunRecord | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FirstRunRecord) : null;
  } catch {
    return null;
  }
}

function writeFirstRun(rec: FirstRunRecord) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  } catch {
    // storage unavailable — onboarding will simply show again next visit
  }
}

type Step = 0 | 1 | 2 | 3 | 4;

const LANG_CHOICES = ["العربية", "English", "Français", "اردو", "Türkçe"];

export function FirstRun({
  lang,
  setLang,
  onComplete,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [motherLang, setMotherLang] = useState<string | null>(null);
  const [workingLang, setWorkingLang] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saveName, setSaveName] = useState<boolean | null>(null);
  const [mode, setMode] = useState<number>(0);
  const [consentText, setConsentText] = useState("");
  const [consentError, setConsentError] = useState(false);
  const [discovery, setDiscovery] = useState<
    "consented_simulated" | "skipped" | null
  >(null);

  const isAr = lang === "ar";
  const t = (b: { en: string; ar: string }) => (isAr ? b.ar : b.en);

  const bondReady = motherLang !== null && name.trim().length > 0 && saveName !== null;

  const scaffolds = useMemo(
    () => [
      { file: "~/.dema/profile.json", state: isAr ? "أُنشئ فارغًا" : "created empty" },
      ...Array.from({ length: 7 }, (_, i) => ({
        file: `~/.dema/pat/pat-${i + 1}.profile.json`,
        state: "PROFILE_CREATED · MODEL_NOT_ASSIGNED",
      })),
      { file: "~/.dema/receipts/ledger.jsonl", state: isAr ? "سجل فارغ" : "empty ledger" },
    ],
    [isAr]
  );

  const finish = () => {
    writeFirstRun({
      completed: true,
      name: saveName ? name.trim() : undefined,
      saveName: saveName ?? false,
      motherLang: motherLang ?? undefined,
      workingLang: workingLang ?? undefined,
      mode,
      discovery: discovery ?? "skipped",
      completedAt: Date.now(),
    });
    onComplete();
  };

  const tryConsent = () => {
    const v = consentText.trim();
    if (v === CONSENT_DISCOVER) {
      setDiscovery("consented_simulated");
      setConsentError(false);
    } else if (v === CONSENT_SKIP_DISCOVER) {
      setDiscovery("skipped");
      setMode(0);
      setConsentError(false);
    } else {
      // exact-string or fail closed
      setConsentError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div
        className="scroll-thin relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-border glass-strong p-6 sm:p-8"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* progress + lang switch */}
        <div className={cn("mb-6 flex items-center justify-between gap-3", isAr && "flex-row-reverse")}>
          <div className="flex items-center gap-1.5">
            {ONBOARDING_PHASES.map((p, i) => (
              <span
                key={p.id}
                title={t(p.name)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i < step
                    ? "w-6 bg-verified"
                    : i === step
                      ? "w-8 bg-gold"
                      : "w-4 bg-border"
                )}
              />
            ))}
          </div>
          <button
            onClick={() => setLang(isAr ? "en" : "ar")}
            className="rounded-md border border-border/70 bg-card/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
          >
            {isAr ? "English" : "العربية"}
          </button>
        </div>

        {/* STEP 0 — Bond */}
        {step === 0 && (
          <div>
            <h1 className={cn("text-2xl text-gold-light", isAr ? "font-arabic" : "font-serif")}>
              {isAr ? "الرابطة أولًا" : "The bond comes first"}
            </h1>
            <p className={cn("mt-1.5 text-sm text-muted-foreground", isAr && "font-arabic")}>
              {isAr
                ? "ديما لا تبدأ بطلب المهام. تبدأ بتكوين علاقة محترمة."
                : "Dema does not begin by asking for tasks. She begins by forming a respectful bond."}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className={cn("text-xs font-medium text-foreground", isAr && "font-arabic")}>
                  {isAr ? "ما لغتك الأم؟" : "What is your mother language?"}
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {LANG_CHOICES.map((l) => (
                    <button
                      key={l}
                      onClick={() => setMotherLang(l)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs transition-colors",
                        motherLang === l
                          ? "border-gold/60 bg-gold/15 text-gold-light"
                          : "border-border/70 bg-card/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={cn("text-xs font-medium text-foreground", isAr && "font-arabic")}>
                  {isAr ? "ولغة العمل التقني؟" : "And your working language for technical execution?"}
                </label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {LANG_CHOICES.map((l) => (
                    <button
                      key={l}
                      onClick={() => setWorkingLang(l)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs transition-colors",
                        workingLang === l
                          ? "border-teal/60 bg-teal/15 text-teal"
                          : "border-border/70 bg-card/40 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={cn("text-xs font-medium text-foreground", isAr && "font-arabic")}>
                  {isAr ? "بأي اسم تحب أن تُنادى؟ (أو اسم عقدتك الخاص)" : "What name shall I call you? (or a private node name)"}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isAr ? "الاسم…" : "Name…"}
                  className="mt-1.5 w-full rounded-md border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-gold/50"
                />
                <p className={cn("mt-1 text-[11px] text-muted-foreground", isAr && "font-arabic")}>
                  {isAr
                    ? "يمكن تغييره في أي وقت. ليس هوية عامة، ولا يُشارك دون إذنك."
                    : "Changeable anytime. Not a public identity — never shared without your consent."}
                </p>
              </div>

              <div>
                <label className={cn("text-xs font-medium text-foreground", isAr && "font-arabic")}>
                  {isAr ? "هل يُحفظ الاسم محليًا؟" : "May the name be saved locally?"}
                </label>
                <div className="mt-1.5 flex gap-1.5">
                  <button
                    onClick={() => setSaveName(true)}
                    className={cn(
                      "rounded-md border px-3 py-1 text-xs",
                      saveName === true
                        ? "border-verified/60 bg-verified/15 text-verified"
                        : "border-border/70 bg-card/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isAr ? "نعم — محليًا فقط" : "Yes — locally only"}
                  </button>
                  <button
                    onClick={() => setSaveName(false)}
                    className={cn(
                      "rounded-md border px-3 py-1 text-xs",
                      saveName === false
                        ? "border-consent/60 bg-consent/15 text-consent"
                        : "border-border/70 bg-card/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isAr ? "لا — لهذه الجلسة فقط" : "No — this session only"}
                  </button>
                </div>
              </div>
            </div>

            <button
              disabled={!bondReady}
              onClick={() => setStep(1)}
              className={cn(
                "mt-6 flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                bondReady
                  ? "border-gold/60 bg-gold/15 text-gold-light hover:bg-gold/25"
                  : "cursor-not-allowed border-border/60 bg-card/30 text-muted-foreground/60"
              )}
            >
              {isAr ? "متابعة" : "Continue"}
              <ChevronRight size={14} className={cn(isAr && "rotate-180")} />
            </button>
          </div>
        )}

        {/* STEP 1 — Dema introduction */}
        {step === 1 && (
          <div>
            <h1 className={cn("text-2xl text-gold-light", isAr ? "font-arabic" : "font-serif")}>
              {isAr ? "ديما تعرّف بنفسها" : "Dema introduces herself"}
            </h1>
            <blockquote
              className={cn(
                "mt-4 rounded-xl border border-gold/25 bg-gold/5 p-4 text-sm leading-relaxed text-foreground",
                isAr ? "font-arabic" : "font-serif"
              )}
            >
              {t(DEMA_INTRO)}
            </blockquote>
            <blockquote
              className={cn(
                "mt-2 rounded-xl border border-border/50 bg-card/30 p-4 text-[13px] leading-relaxed text-muted-foreground",
                isAr ? "font-serif" : "font-arabic"
              )}
              dir={isAr ? "ltr" : "rtl"}
            >
              {isAr ? DEMA_INTRO.en : DEMA_INTRO.ar}
            </blockquote>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setStep(0)}
                className="rounded-lg border border-border/70 bg-card/40 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {isAr ? "رجوع" : "Back"}
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 rounded-lg border border-gold/60 bg-gold/15 px-4 py-2 text-sm font-medium text-gold-light hover:bg-gold/25"
              >
                {isAr ? "متابعة" : "Continue"}
                <ChevronRight size={14} className={cn(isAr && "rotate-180")} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Foundation */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-2">
              <h1 className={cn("text-2xl text-gold-light", isAr ? "font-arabic" : "font-serif")}>
                {isAr ? "الأساس" : "Foundation"}
              </h1>
              <span className="rounded border border-consent/40 bg-consent/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-consent">
                SIMULATION_ONLY
              </span>
            </div>
            <p className={cn("mt-1.5 text-sm text-muted-foreground", isAr && "font-arabic")}>
              {isAr
                ? "هذه الهياكل التي ستُنشأ على عقدتك. في هذه المعاينة لا يُكتب أي ملف — عرض صادق للتصميم فقط."
                : "These are the scaffolds your node creates. In this preview no file is written — an honest display of the design only."}
            </p>
            <ul className="mt-4 space-y-1.5">
              {scaffolds.map((s) => (
                <li
                  key={s.file}
                  className="flex items-center gap-2 rounded-md border border-border/50 bg-background/40 px-3 py-2"
                  dir="ltr"
                >
                  <Check size={13} className="shrink-0 text-verified" />
                  <span className="truncate font-mono text-xs text-foreground">{s.file}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                    {s.state}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border border-border/70 bg-card/40 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {isAr ? "رجوع" : "Back"}
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 rounded-lg border border-gold/60 bg-gold/15 px-4 py-2 text-sm font-medium text-gold-light hover:bg-gold/25"
              >
                {isAr ? "متابعة" : "Continue"}
                <ChevronRight size={14} className={cn(isAr && "rotate-180")} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Discovery */}
        {step === 3 && (
          <div>
            <h1 className={cn("text-2xl text-gold-light", isAr ? "font-arabic" : "font-serif")}>
              {isAr ? "استكشاف قدرات النماذج" : "Model capability discovery"}
            </h1>
            <p className={cn("mt-1.5 text-sm text-muted-foreground", isAr && "font-arabic")}>
              {isAr
                ? "العقدة والمهمة والإذن والإيصالات موجودة قبل النموذج. النموذج محرك قابل للاستبدال، لا المركز."
                : "The node, mission, consent, and receipts all exist before the model. The LLM is a replaceable engine, not the center."}
            </p>

            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {INTELLIGENCE_MODES.map((m) => (
                <button
                  key={m.mode}
                  onClick={() => setMode(m.mode)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    isAr && "text-right",
                    mode === m.mode
                      ? "border-teal/60 bg-teal/10"
                      : "border-border/60 bg-card/40 hover:bg-card/70"
                  )}
                  dir={isAr ? "rtl" : "ltr"}
                >
                  <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                    <span className="font-mono text-[10px] text-muted-foreground">M{m.mode}</span>
                    <span className={cn("text-xs font-semibold text-foreground", isAr && "font-arabic")}>
                      {t(m.name)}
                    </span>
                    {m.recommended && (
                      <span className="rounded border border-verified/40 bg-verified/10 px-1 py-px font-mono text-[9px] text-verified">
                        {isAr ? "موصى به" : "DEFAULT"}
                      </span>
                    )}
                  </div>
                  <p className={cn("mt-1 text-[11px] leading-snug text-muted-foreground", isAr && "font-arabic")}>
                    {t(m.desc)}
                  </p>
                </button>
              ))}
            </div>

            {discovery === null ? (
              <div className="mt-4 rounded-xl border border-consent/30 bg-consent/5 p-4">
                <div className={cn("flex items-center gap-2", isAr && "flex-row-reverse")}>
                  <Lock size={13} className="text-consent" />
                  <span className={cn("text-xs font-medium text-foreground", isAr && "font-arabic")}>
                    {isAr
                      ? "لمعاينة فحص القدرات (محاكاة)، اكتب عبارة الإذن حرفيًا:"
                      : "To preview the capability scan (simulated), type the consent phrase exactly:"}
                  </span>
                </div>
                <p className="mt-2 select-all rounded bg-background/60 px-2 py-1.5 font-mono text-[11px] text-consent" dir="ltr">
                  {CONSENT_DISCOVER}
                </p>
                <p className="mt-1 select-all rounded bg-background/40 px-2 py-1 font-mono text-[10px] text-muted-foreground" dir="ltr">
                  {CONSENT_SKIP_DISCOVER}
                </p>
                <input
                  value={consentText}
                  onChange={(e) => {
                    setConsentText(e.target.value);
                    setConsentError(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && tryConsent()}
                  placeholder={isAr ? "اكتب العبارة هنا…" : "Type the phrase here…"}
                  dir="ltr"
                  className={cn(
                    "mt-2 w-full rounded-md border bg-background/60 px-3 py-2 font-mono text-xs text-foreground outline-none",
                    consentError ? "border-fail/70 anim-zann" : "border-border/70 focus:border-consent/50"
                  )}
                />
                {consentError && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-fail">
                    <ShieldAlert size={12} />
                    {isAr
                      ? "غير مطابق حرفيًا — الغموض يعني الرفض (fail-closed)."
                      : "Not an exact match — ambiguity fails closed."}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={tryConsent}
                    className="rounded-lg border border-consent/60 bg-consent/15 px-3 py-1.5 text-xs font-medium text-consent hover:bg-consent/25"
                  >
                    {isAr ? "تأكيد" : "Submit"}
                  </button>
                  <button
                    onClick={() => {
                      setDiscovery("skipped");
                      setMode(0);
                    }}
                    className="rounded-lg border border-border/70 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isAr ? "تخطٍّ — بلا استكشاف" : "Skip — no discovery"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-verified/30 bg-verified/5 p-4">
                <p className="text-xs text-foreground">
                  {discovery === "consented_simulated"
                    ? isAr
                      ? "إذن مطابق. في التشغيل الحقيقي: فحص محلي فقط — لا تنزيل، لا شبكة، لا كشف مفاتيح. هنا: محاكاة فقط."
                      : "Exact consent accepted. In the real runtime: local checks only — no downloads, no network, no key exposure. Here: simulation only."
                    : isAr
                      ? "تم التخطي. الوضع صفر — العقدة نافعة بلا أي نموذج."
                      : "Skipped. Mode 0 — the node is useful with no model at all."}
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="rounded-lg border border-border/70 bg-card/40 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {isAr ? "رجوع" : "Back"}
              </button>
              <button
                disabled={discovery === null}
                onClick={() => setStep(4)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium",
                  discovery !== null
                    ? "border-gold/60 bg-gold/15 text-gold-light hover:bg-gold/25"
                    : "cursor-not-allowed border-border/60 bg-card/30 text-muted-foreground/60"
                )}
              >
                {isAr ? "متابعة" : "Continue"}
                <ChevronRight size={14} className={cn(isAr && "rotate-180")} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — First mission */}
        {step === 4 && (
          <div>
            <h1 className={cn("text-2xl text-gold-light", isAr ? "font-arabic" : "font-serif")}>
              {isAr ? `أهلًا${name ? " يا " + name.trim() : ""}.` : `Welcome${name ? ", " + name.trim() : ""}.`}
            </h1>
            <p className={cn("mt-1.5 text-sm leading-relaxed text-muted-foreground", isAr && "font-arabic")}>
              {isAr
                ? "الأساس قائم. أمامك ممر المهمات: بذرة ← افتراض ← معنى ← إذن ← إثبات ← نمو. احمل بذرتك الأولى عبره."
                : "The foundation stands. Ahead is the Mission Corridor: Seed → Assumption → Meaning → Consent → Proof → Growth. Carry your first seed through it."}
            </p>
            <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-3 font-mono text-[11px] text-muted-foreground" dir="ltr">
              mode: M{mode} · discovery: {discovery ?? "skipped"} · name:{" "}
              {saveName ? "saved locally" : "session only"}
            </div>
            <button
              onClick={finish}
              className="mt-6 w-full rounded-xl border border-gold/60 bg-gold/15 px-4 py-3 text-sm font-semibold text-gold-light transition-colors hover:bg-gold/25"
            >
              {isAr ? "ادخل الممر ⬅" : "Enter the Corridor →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
