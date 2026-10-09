"use client";

import { useCompanionJson } from "@/lib/companion/use-companion";
import { SceneHeader } from "./primitives";

type MemoryBody = {
  ok?: boolean;
  truth_label?: string;
  reason?: string | null;
  receipt_linkage?: string;
  receipt_reason?: string;
  entries?: Array<{
    name: string;
    suggested_category: string;
    classification_confidence: string;
    truth_label: string;
    receipt_hash: null;
  }>;
};

export function MemoryMapScene() {
  const { data, status } = useCompanionJson<MemoryBody>("/api/companion/memory");
  const entries = data?.entries ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-2">
      <SceneHeader
        title="Memory map"
        glyph="◌"
        accent="unknown"
        truth="UNKNOWN"
        subtitle="Names classified by the memory curator. No receipt is attached, so this is not standing and not a relationship claim."
      />
      {status === "loading" && <p className="text-sm text-muted-foreground">Reading memory index…</p>}
      {status === "error" && <p className="text-sm text-fail">UNKNOWN. The memory index did not return.</p>}
      {status === "ok" && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">No memory entries. Receipt linkage UNKNOWN.</p>
      )}
      {entries.map((entry) => (
        <article key={entry.name} className="rounded-lg border border-border/70 bg-card/40 p-3">
          <div className="font-mono text-sm text-foreground">{entry.name}</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Suggested category {entry.suggested_category} · confidence {entry.classification_confidence} · {entry.truth_label}
          </p>
          <p className="mt-1 text-xs text-fail">receipt UNKNOWN</p>
        </article>
      ))}
    </div>
  );
}
