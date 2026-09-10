"use client";

import { useState } from "react";

type Result = {
  ok: boolean;
  blocked_by?: string[];
  proposal?: any;
  [key: string]: any;
};

const GOLD = "#C9A962";
const TEAL = "#2DD4BF";
const MUTED = "#9FB3C8";

export default function MissionPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [cardResult, setCardResult] = useState<any>(null);
  const [phrase, setPhrase] = useState("");
  const [patPhrase, setPatPhrase] = useState("");
  const [execution, setExecution] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function compile() {
    setBusy(true);
    setResult(null);
    setCardResult(null);
    setExecution(null);
    setPhrase("");
    setPatPhrase("");
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

  async function deriveConsentCard() {
    if (!result?.proposal) return;
    setBusy(true);
    setCardResult(null);
    setExecution(null);
    setPatPhrase("");
    try {
      const response = await fetch("/api/mission/consent-card", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposal: result.proposal }),
      });
      setCardResult(await response.json());
    } catch (error) {
      setCardResult({ ok: false, blocked_by: [String(error)] });
    } finally {
      setBusy(false);
    }
  }

  async function authorizeMission() {
    if (!result?.proposal || !cardResult?.governed?.consent_context) return;
    setBusy(true);
    setExecution(null);
    try {
      const payload: Record<string, unknown> = {
        proposal: result.proposal,
        consent_context: cardResult.governed.consent_context,
        phrase,
      };
      if (cardResult.pat?.ok && patPhrase.trim()) {
        payload.pat_consent_context = cardResult.pat.consent_context;
        payload.pat_phrase = patPhrase;
      }
      const response = await fetch("/api/mission/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setExecution(await response.json());
    } catch (error) {
      setExecution({ ok: false, blocked_by: [String(error)] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #050B14 0%, #0A1628 100%)", color: "#E8EDF4", padding: "clamp(1.5rem, 5vw, 4rem)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <header style={{ borderBottom: "1px solid #C9A96233", paddingBottom: "1.5rem" }}>
          <div style={{ letterSpacing: "0.3em", fontSize: 11, color: GOLD, textTransform: "uppercase" }}>DEMA · local proposal</div>
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
                {result.proposal.attention && (
                  <div style={{ borderLeft: `2px solid ${TEAL}`, paddingLeft: "1rem", margin: "1.2rem 0", color: MUTED }}>
                    <div style={{ color: TEAL, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>What matters now</div>
                    <p style={{ margin: "0.35rem 0" }}>
                      {result.proposal.attention.frontier_decision === "WAIT_FOR_HUMAN"
                        ? "A human decision is required before any consequential step."
                        : "This is the current bounded frontier for your mission."}
                    </p>
                    <p style={{ margin: 0, fontSize: 13 }}>Priority selects attention only; it does not authorize an effect.</p>
                  </div>
                )}
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
                {result.proposal.decision === "PROPOSE_ONLY" && (
                  <div style={{ marginTop: "1.5rem", borderTop: "1px solid #C9A96233", paddingTop: "1.2rem" }}>
                    <button onClick={deriveConsentCard} disabled={busy} style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}88`, padding: "0.7rem 1rem", fontWeight: 600, cursor: busy ? "wait" : "pointer" }}>
                      {busy ? "Preparing…" : "Prepare exact local consent"}
                    </button>
                    <p style={{ color: MUTED, fontSize: 13 }}>This prepares a bounded metadata-only observation. It does not authorize anything until you enter the exact phrase shown by the governed runtime.</p>
                  </div>
                )}
              </>
            ) : null}
          </section>
        )}

        {cardResult && (
          <section style={{ marginTop: "1rem", border: `1px solid ${cardResult.ok ? GOLD : "#D99191"}55`, padding: "1.3rem", lineHeight: 1.65 }}>
            {!cardResult.ok ? (
              <>
                <h2 style={{ color: "#D99191", fontWeight: 500, marginTop: 0 }}>Consent card held</h2>
                <pre style={{ whiteSpace: "pre-wrap", color: "#D99191", fontSize: 12 }}>{(cardResult.blocked_by ?? cardResult.governed?.blocked_by ?? []).join("\n")}</pre>
              </>
            ) : (
              <>
                <div style={{ color: GOLD, letterSpacing: "0.18em", fontSize: 11, textTransform: "uppercase" }}>EXACT CONSENT · LOCAL ONLY</div>
                <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400, margin: "0.4rem 0 1.2rem" }}>Review before the bounded observation</h2>
                <p style={{ color: MUTED }}>Operation: {cardResult.governed.card.permitted_operation}</p>
                <p style={{ color: MUTED, wordBreak: "break-all", fontSize: 13 }}>Contract: {cardResult.governed.contract_hash}</p>
                <p style={{ color: GOLD, fontWeight: 700, wordBreak: "break-word" }}>{cardResult.governed.consent_context.required_phrase}</p>
                {cardResult.pat?.ok ? (
                  <div style={{ margin: "1.2rem 0", padding: "1rem", border: "1px solid #2DD4BF55" }}>
                    <div style={{ color: TEAL, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>PAT · SUGGESTION ONLY</div>
                    <p style={{ color: MUTED, margin: "0.35rem 0" }}>This is a separate local model-consent card. It may propose; it cannot authorize or execute the mission.</p>
                    <p style={{ color: GOLD, fontWeight: 700, wordBreak: "break-word" }}>{cardResult.pat.consent_context.required_phrase}</p>
                    <label htmlFor="pat-consent" style={{ display: "block", color: GOLD, fontSize: 13, marginBottom: 8 }}>Exact PAT consent</label>
                    <input id="pat-consent" value={patPhrase} onChange={(event) => setPatPhrase(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "0.8rem", background: "#050B14", border: "1px solid #2DD4BF55", color: "#E8EDF4", font: "inherit" }} />
                  </div>
                ) : (
                  <p style={{ color: "#D99191", fontSize: 13 }}>PAT suggestion is held: {(cardResult.pat?.blocked_by ?? ["pat_card_unavailable"]).join("\n")}</p>
                )}
                <label htmlFor="mission-consent" style={{ display: "block", color: GOLD, fontSize: 13, marginBottom: 8 }}>Enter the exact phrase</label>
                <input id="mission-consent" value={phrase} onChange={(event) => setPhrase(event.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "0.8rem", background: "#050B14", border: "1px solid #C9A96255", color: "#E8EDF4", font: "inherit" }} />
                <button onClick={authorizeMission} disabled={busy || !phrase} style={{ marginTop: "1rem", background: GOLD, color: "#050B14", border: 0, padding: "0.8rem 1.2rem", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy || !phrase ? 0.55 : 1 }}>
                  {busy ? "Verifying…" : "Authorize bounded observation"}
                </button>
              </>
            )}
          </section>
        )}

        {execution && (
          <section style={{ marginTop: "1rem", border: `1px solid ${execution.ok ? TEAL : "#D99191"}55`, padding: "1.3rem", lineHeight: 1.65 }}>
            <h2 style={{ color: execution.ok ? TEAL : "#D99191", fontWeight: 500, marginTop: 0 }}>{execution.ok ? "Mission recorded" : "Mission held"}</h2>
            <p style={{ color: MUTED }}>{execution.ok ? "The governed runtime returned its receipt and verification result." : "No effect was admitted by the governed runtime."}</p>
            <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", color: "#B8CADB", fontSize: 12 }}>{JSON.stringify(execution.governed ?? execution, null, 2)}</pre>
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
