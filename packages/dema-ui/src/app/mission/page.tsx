"use client";

import { useState } from "react";

type Result = {
  ok: boolean;
  blocked_by?: string[];
  proposal?: {
    decision: string;
    mission_id: string;
    source_intent_hash: string;
    claim_ceiling: string;
    what_i_understood: { objective: string; recognized_operators: { term: string }[] };
    what_i_know: string[];
    what_i_am_inferencing: string[];
    what_i_still_need: string[];
    proposed_next_step: string;
    requested_actions: { action: string; token: string }[];
    authority: { authority: string; consent_required: boolean; authority_delta: number };
    context_snapshot: { node_story: { status: string }; current_state: { status: string } };
    bridge_hash: string;
  };
};

const GOLD = "#C9A962";
const TEAL = "#2DD4BF";
const MUTED = "#9FB3C8";

export default function MissionPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function compile() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/mission/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setResult(await response.json());
    } catch (error) {
      setResult({ ok: false, blocked_by: [String(error)] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #050B14 0%, #0A1628 100%)", color: "#E8EDF4", padding: "clamp(1.5rem, 5vw, 4rem)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <header style={{ borderBottom: "1px solid #C9A96233", paddingBottom: "1.5rem" }}>
          <div style={{ letterSpacing: "0.3em", fontSize: 11, color: GOLD, textTransform: "uppercase" }}>DEMA · Momo · local proposal</div>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(2rem, 6vw, 3.6rem)", margin: "0.6rem 0" }}>What matters now?</h1>
          <p style={{ color: MUTED, lineHeight: 1.7, maxWidth: 680, margin: 0 }}>
            Speak naturally. DEMA will show what it understood before any planning, consent, or effect.
          </p>
        </header>

        <section style={{ paddingTop: "2rem" }}>
          <label htmlFor="mission-intent" style={{ display: "block", color: GOLD, fontSize: 13, marginBottom: 8 }}>Your intention</label>
          <textarea
            id="mission-intent"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Tell DEMA what you want help with…"
            rows={7}
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "1rem", background: "#050B14", border: "1px solid #C9A96255", color: "#E8EDF4", font: "inherit", lineHeight: 1.6 }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: "1rem", flexWrap: "wrap" }}>
            <button onClick={compile} disabled={busy || !text.trim()} style={{ background: GOLD, color: "#050B14", border: 0, padding: "0.8rem 1.4rem", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy || !text.trim() ? 0.55 : 1 }}>
              {busy ? "Understanding…" : "Show what I understood"}
            </button>
            <a href="/" style={{ color: MUTED, textDecoration: "none", fontSize: 14 }}>First encounter</a>
          </div>
          <p style={{ color: "#64798F", fontSize: 13, lineHeight: 1.6 }}>
            Personal story and current state remain UNKNOWN until you choose to provide them. Compilation makes no model call and starts no effect.
          </p>
        </section>

        {result && (
          <section style={{ marginTop: "2rem", border: `1px solid ${result.ok ? TEAL : "#D99191"}55`, padding: "1.3rem", lineHeight: 1.65 }}>
            {!result.ok ? (
              <>
                <h2 style={{ color: "#D99191", fontWeight: 500, marginTop: 0 }}>Held safely</h2>
                <p style={{ color: MUTED }}>This proposal was not admitted.</p>
                <pre style={{ whiteSpace: "pre-wrap", color: "#D99191", fontSize: 12 }}>{(result.blocked_by ?? []).join("\n")}</pre>
              </>
            ) : result.proposal ? (
              <>
                <div style={{ color: TEAL, letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }}>{result.proposal.decision}</div>
                <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, margin: "0.4rem 0 1.2rem" }}>What I understood</h2>
                <p>{result.proposal.what_i_understood.objective}</p>
                <Info title="What I know" items={result.proposal.what_i_know} />
                <Info title="What I am inferring" items={result.proposal.what_i_am_inferencing} />
                <Info title="What I still need" items={result.proposal.what_i_still_need} />
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.4rem 1rem", fontSize: 13, color: MUTED }}>
                  <dt>Authority</dt><dd style={{ margin: 0, color: "#E8EDF4" }}>{result.proposal.authority.authority}</dd>
                  <dt>Consent</dt><dd style={{ margin: 0, color: "#E8EDF4" }}>{result.proposal.authority.consent_required ? "required for the requested action" : "not inferred"}</dd>
                  <dt>Authority delta</dt><dd style={{ margin: 0, color: "#E8EDF4" }}>{result.proposal.authority.authority_delta}</dd>
                  <dt>Claim ceiling</dt><dd style={{ margin: 0, color: "#E8EDF4" }}>{result.proposal.claim_ceiling}</dd>
                  <dt>Mission</dt><dd style={{ margin: 0, color: "#E8EDF4", wordBreak: "break-all" }}>{result.proposal.mission_id}</dd>
                </dl>
                <p style={{ color: GOLD, marginBottom: 0 }}>{result.proposal.proposed_next_step}</p>
              </>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}

function Info({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ margin: "1.2rem 0" }}>
      <h3 style={{ color: GOLD, fontSize: 14, fontWeight: 600, marginBottom: "0.3rem" }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#B8CADB" }}>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
