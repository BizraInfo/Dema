"use client";

import { cn } from "@/lib/utils";
import { COLOR_CLASS, TRUTH_LABELS } from "@/lib/game/data";
import type { TruthLabel } from "@/lib/game/types";
import { Star } from "lucide-react";

export function TruthLabelBadge({
  label,
  size = "sm",
  className,
}: {
  label: TruthLabel;
  size?: "sm" | "xs";
  className?: string;
}) {
  const meta = TRUTH_LABELS.find((t) => t.key === label);
  const c = COLOR_CLASS[meta?.color ?? "unknown"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-mono uppercase tracking-wider",
        c.bg,
        c.border,
        c.text,
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", c.dot)} />
      {meta?.label ?? label}
    </span>
  );
}

export function StarRating({
  value,
  max = 5,
  size = 14,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={size}
          className={cn(
            "transition-colors",
            i < value
              ? "fill-consent text-consent drop-shadow-[0_0_4px_oklch(0.82_0.15_85/0.6)]"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

export function Panel({
  title,
  glyph,
  accent = "proof",
  truth,
  right,
  className,
  bodyClassName,
  children,
}: {
  title?: string;
  glyph?: string;
  accent?: keyof typeof COLOR_CLASS;
  /** Maturity of the capability this panel displays. SceneHeader already took a
   *  `truth` prop; Panel did not, so panel-level surfaces shipped unlabeled.
   *  Enforced by scripts/review/ui-truth-label-check.mjs. */
  truth?: TruthLabel;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const c = COLOR_CLASS[accent];
  return (
    <div
      className={cn(
        "glass relative flex flex-col rounded-xl border border-border overflow-hidden",
        className
      )}
    >
      {title && (
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            {glyph && (
              <span className={cn("text-base leading-none", c.text)}>{glyph}</span>
            )}
            <h3 className="truncate font-mono text-xs uppercase tracking-[0.18em] text-foreground/80">
              {title}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {truth && <TruthLabelBadge label={truth} size="xs" />}
            {right}
          </div>
        </div>
      )}
      <div className={cn("flex-1 min-h-0", bodyClassName)}>{children}</div>
    </div>
  );
}

export function StatBar({
  value,
  max = 100,
  color = "proof",
  className,
  showGlow,
}: {
  value: number;
  max?: number;
  color?: keyof typeof COLOR_CLASS;
  className?: string;
  showGlow?: boolean;
}) {
  const c = COLOR_CLASS[color];
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10",
        className
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", c.dot)}
        style={{ width: `${pct}%` }}
      />
      {showGlow && pct > 0 && (
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full blur-[3px]", c.dot)}
          style={{ width: `${pct}%`, opacity: 0.6 }}
        />
      )}
    </div>
  );
}

export function GlyphBadge({
  glyph,
  color = "proof",
  size = "md",
  className,
}: {
  glyph: string;
  color?: keyof typeof COLOR_CLASS;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const c = COLOR_CLASS[color];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg border font-mono",
        c.bg,
        c.border,
        c.text,
        size === "sm" && "size-7 text-sm",
        size === "md" && "size-9 text-base",
        size === "lg" && "size-12 text-xl",
        className
      )}
    >
      {glyph}
    </span>
  );
}

export function SceneHeader({
  title,
  subtitle,
  glyph,
  accent = "proof",
  truth,
  right,
}: {
  title: string;
  subtitle?: string;
  glyph: string;
  accent?: keyof typeof COLOR_CLASS;
  truth?: TruthLabel;
  right?: React.ReactNode;
}) {
  const c = COLOR_CLASS[accent];
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <GlyphBadge glyph={glyph} color={accent} size="lg" />
        <div className="min-w-0">
          <h2 className="font-mono text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground max-w-prose">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {truth && <TruthLabelBadge label={truth} />}
        {right}
      </div>
    </div>
  );
}
