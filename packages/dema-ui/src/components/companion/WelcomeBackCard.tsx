"use client";

import type { WelcomeItem, WelcomeProjection } from "@/lib/companion/welcome-projection";
import { useCompanionJson } from "@/lib/companion/use-companion";

const GOLD = "#C9A962";
const TEAL = "#2DD4BF";
const MUTED = "#9FB3C8";

function receiptHref(hash: string) {
  return `/api/companion/season-receipt?hash=${encodeURIComponent(hash)}`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "UNKNOWN";
  if (Array.isArray(value)) {
    if (value.length === 0) return "none recorded";
    return value.map((item) => {
      if (item && typeof item === "object" && "phrase" in item) {
        const row = item as { phrase?: string; scope?: string };
        return `${row.phrase ?? "UNKNOWN"} (${row.scope ?? "UNKNOWN"})`;
      }
      return String(item);
    }).join(" · ");
  }
  return String(value);
}

function ItemRow({ item }: { item: WelcomeItem }) {
  const text = formatValue(item.value);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "9.5rem 1fr", gap: "0.75rem", padding: "0.45rem 0", borderTop: "1px solid #C9A96222" }}>
      <div style={{ color: GOLD, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase" }}>{item.field.replaceAll("_", " ")}</div>
      <div>
        <div style={{ color: "#E8EDF4", lineHeight: 1.5 }}>{text}</div>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          <span style={{ color: MUTED }}>{item.truth}</span>
          {item.receipt_hash ? (
            <a href={receiptHref(item.receipt_hash)} style={{ color: TEAL, marginLeft: 8 }}>
              receipt {item.receipt_hash.slice(0, 18)}…
            </a>
          ) : (
            <span style={{ color: "#D99191", marginLeft: 8 }}>receipt UNKNOWN</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function WelcomeBackCard() {
  const { data, status } = useCompanionJson<WelcomeProjection>("/api/companion/welcome");
  const name = data?.preferred_name;
  const heading = name ? `Welcome back, ${name}.` : "Welcome back.";

  return (
    <section style={{ marginTop: "1.5rem", border: "1px solid #C9A96255", padding: "1rem 1.1rem" }} aria-label="Welcome back">
      <div style={{ color: GOLD, letterSpacing: "0.16em", fontSize: 11, textTransform: "uppercase" }}>Season continuity</div>
      <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, margin: "0.45rem 0 0.2rem" }}>{status === "loading" ? "Reading season state…" : heading}</h2>
      {status === "error" && (
        <p style={{ color: "#D99191", margin: "0.4rem 0 0" }}>UNKNOWN. The season read did not return.</p>
      )}
      {status === "ok" && data && (
        <>
          <p style={{ color: MUTED, margin: "0.2rem 0 0.6rem", fontSize: 13, lineHeight: 1.5 }}>
            {data.outcome === "EMPTY" && "No season HEAD is stored. Phase, steps, and consent stay UNKNOWN."}
            {data.outcome === "CONTRADICTION" && `More than one season is stored (${data.reason}). No phase was chosen.`}
            {data.outcome === "UNKNOWN" && `Season state is UNKNOWN${data.reason ? `: ${data.reason}` : ""}.`}
            {data.outcome === "VERIFIED" && "This card repeats the verified season continuation. It grants no consent."}
          </p>
          <p style={{ color: MUTED, fontSize: 12, margin: "0 0 0.4rem" }}>
            Name source: {data.name_source}. Name receipt: UNKNOWN.
            {data.language_code ? ` Language: ${data.language_code} (${data.language_source}).` : " Language: UNKNOWN."}
            {" "}{data.season_binding_reason}
          </p>
          {data.items.map((item) => <ItemRow key={item.field} item={item} />)}
        </>
      )}
    </section>
  );
}
