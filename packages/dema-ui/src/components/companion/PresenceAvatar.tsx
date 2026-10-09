"use client";

import { useCompanionJson } from "@/lib/companion/use-companion";

type PresenceBody = {
  state?: string;
  reason?: string;
  justified_by?: string | null;
  kernel_empty_withheld?: boolean;
};

const TONE: Record<string, { ring: string; mark: string; motion: string }> = {
  UNKNOWN: { ring: "border-dashed border-[#9FB3C8]", mark: "?", motion: "" },
  IDLE: { ring: "border-[#9FB3C8]", mark: "·", motion: "" },
  ACTIVE: { ring: "border-[#2DD4BF]", mark: "●", motion: "animate-pulse" },
  NEEDS_HUMAN: { ring: "border-[#C9A962]", mark: "!", motion: "" },
  VERIFYING: { ring: "border-[#2DD4BF]", mark: "…", motion: "animate-pulse" },
  REFUSED: { ring: "border-[#D99191]", mark: "×", motion: "" },
  VERIFIED_DONE: { ring: "border-[#2DD4BF]", mark: "✓", motion: "" },
  RECOVERY: { ring: "border-[#C9A962]", mark: "↺", motion: "" },
};

export function PresenceAvatar({ compact = false }: { compact?: boolean }) {
  const { data, status } = useCompanionJson<PresenceBody>("/api/companion/presence");
  const state = status === "ok" && data?.state ? data.state : "UNKNOWN";
  const tone = TONE[state] ?? TONE.UNKNOWN;
  const reason = status === "error"
    ? "presence_unavailable"
    : status === "loading"
      ? "reading"
      : data?.reason ?? "no_receipt_bound_presence_events";
  const label = `Dema presence ${state}. ${reason}`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-presence-state={state}
      data-justified-by={data?.justified_by ?? ""}
      className={`grid shrink-0 place-items-center rounded-lg border bg-card/40 font-mono text-foreground ${tone.ring} ${tone.motion} ${compact ? "size-8 text-sm" : "size-9 text-base"}`}
    >
      {tone.mark}
    </span>
  );
}
