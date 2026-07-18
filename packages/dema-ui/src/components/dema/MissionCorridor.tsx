"use client";

// The Mission Corridor — daily-loop spine of the Dema UX lifecycle.
// Seed → Assumption → Meaning → Consent → Proof → Growth
// Every station opens an existing, working stage. PREVIEW_ONLY by design.

import { useGame } from "@/lib/game/store";
import { COLOR_CLASS } from "@/lib/game/data";
import { cn } from "@/lib/utils";
import { TruthLabelBadge } from "@/components/game/primitives";
import {
  CORRIDOR_STATIONS,
  ACTIVATION_RAIL,
  CORRIDOR_DOES_NOT_PROVE,
} from "@/lib/lifecycle";
import { useLang } from "@/hooks/use-lang";
import { ArrowRight, ShieldCheck } from "lucide-react";

function railStatusClass(status: string) {
  switch (status) {
    case "SHIPPED":
      return "border-verified/40 bg-verified/10 text-verified";
    case "PREVIEW_ONLY":
      return "border-consent/40 bg-consent/10 text-consent";
    case "OUTSIDE_THIS_APP":
      return "border-fail/40 bg-fail/10 text-fail";
    default:
      return "border-border bg-card/40 text-muted-foreground";
  }
}

export function MissionCorridor() {
  const [lang] = useLang();
  const setScene = useGame((s) => s.setScene);
  const receipts = useGame((s) => s.receipts);

  const t = (b: { en: string; ar: string }) => (lang === "ar" ? b.ar : b.en);
  const isAr = lang === "ar";

  return (
    <div className="scroll-thin h-full overflow-y-auto rounded-xl border border-border/70 glass p-4 sm:p-6">
      {/* header */}
      <div
        className={cn(
          "mb-6 flex flex-wrap items-end justify-between gap-3",
          isAr && "flex-row-reverse"
        )}
        dir={isAr ? "rtl" : "ltr"}
      >
        <div>
          <h1
            className={cn(
              "text-2xl sm:text-3xl text-gold-light",
              isAr ? "font-arabic" : "font-serif"
            )}
          >
            {isAr ? "ممر المهمات" : "The Mission Corridor"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {isAr
              ? "بذرة ← افتراض ← معنى ← إذن ← إثبات ← نمو. لا ادعاء فوق دليله."
              : "Seed → Assumption → Meaning → Consent → Proof → Growth. No claim above its evidence."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TruthLabelBadge label="PREVIEW_ONLY" />
          <TruthLabelBadge label="LOCAL_ONLY" />
        </div>
      </div>

      {/* stations */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CORRIDOR_STATIONS.map((st, i) => {
          const c = COLOR_CLASS[st.color];
          return (
            <button
              key={st.id}
              onClick={() => setScene(st.scene)}
              className={cn(
                "group relative flex flex-col rounded-xl border bg-card/50 p-4 text-left transition-all hover:bg-card/80",
                c.border,
                isAr && "text-right"
              )}
              dir={isAr ? "rtl" : "ltr"}
            >
              <div
                className={cn(
                  "flex items-center gap-2.5",
                  isAr && "flex-row-reverse"
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg border font-mono text-lg",
                    c.border,
                    c.bg,
                    c.text
                  )}
                >
                  {st.glyph}
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className={cn("text-sm font-semibold", c.text)}>
                      {t(st.name)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] text-muted-foreground",
                      isAr && "font-arabic"
                    )}
                  >
                    {isAr ? st.name.en : st.name.ar}
                  </span>
                </div>
                <ArrowRight
                  size={14}
                  className={cn(
                    "ml-auto shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground",
                    isAr && "ml-0 mr-auto rotate-180 group-hover:-translate-x-0.5"
                  )}
                />
              </div>
              <p
                className={cn(
                  "mt-2.5 text-xs leading-relaxed text-muted-foreground",
                  isAr && "font-arabic"
                )}
              >
                {t(st.desc)}
              </p>
            </button>
          );
        })}
      </div>

      {/* activation rail */}
      <div className="mt-8">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck size={14} className="text-teal" />
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {isAr ? "سكة تفعيل Node0 — مرآة فقط" : "Node0 activation rail — mirror only"}
          </h2>
        </div>
        <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
          {ACTIVATION_RAIL.map((step, i) => (
            <div
              key={step.id}
              className="flex min-w-[168px] shrink-0 flex-col gap-1.5 rounded-lg border border-border/60 bg-card/40 p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {i + 1}/6
                </span>
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                    railStatusClass(step.status)
                  )}
                >
                  {step.status}
                </span>
              </div>
              <span className="text-xs font-semibold text-foreground">
                {t(step.name)}
              </span>
              <span className="font-mono text-[10px] leading-snug text-muted-foreground">
                {step.surface}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground/80">
          {isAr
            ? "SHIPPED تعني أن الواجهة موجودة على القرص في مستودع Dema — لا أن الدرجة صحيحة وقت التشغيل. التفعيل يحدث خارج هذا التطبيق."
            : "SHIPPED means the surface exists on disk in the Dema repo — not that the rung is runtime-correct. Activation happens outside this app."}
        </p>
      </div>

      {/* receipts */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {isAr ? "آخر الإيصالات" : "Latest receipts"}
          </h2>
          {receipts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "لا إيصالات بعد. أكمل مهمة عبر الممر لسكّ أول إيصال."
                : "No receipts yet. Carry a mission through the corridor to forge your first one."}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {receipts.slice(0, 5).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-verified" />
                  <span className="truncate text-xs text-foreground">{r.label}</span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                    {r.hash.slice(0, 10)}…
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* does not prove */}
        <div className="rounded-xl border border-fail/25 bg-fail/5 p-4">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-fail/90">
            {isAr ? "ما لا يثبته هذا الممر" : "What this corridor does not prove"}
          </h2>
          <ul className="space-y-1">
            {CORRIDOR_DOES_NOT_PROVE.map((line) => (
              <li key={line} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1 size-1 shrink-0 rounded-full bg-fail/60" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
