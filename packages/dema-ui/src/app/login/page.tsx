"use client";

import { FormEvent, useState } from "react";

export default function LocalLoginPage() {
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const next = new URLSearchParams(window.location.search).get("next") ?? "/realm";
    try {
      const response = await fetch("/api/auth/local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret, next }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(body.error ?? body.code ?? `Authentication refused (${response.status}).`);
        return;
      }
      setSecret("");
      window.location.assign(typeof body.next === "string" ? body.next : "/realm");
    } catch {
      setStatus("Local authentication could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg, #050B14 0%, #0A1628 100%)", color: "#E8EDF4", padding: "clamp(1.5rem, 5vw, 4rem)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: "12vh" }}>
        <p style={{ color: "#C9A962", letterSpacing: "0.25em", fontSize: 11 }}>DEMA · LOCAL BOUNDARY</p>
        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(2rem, 6vw, 3.2rem)" }}>Enter your local Node0</h1>
        <p style={{ color: "#9FB3C8", lineHeight: 1.7 }}>
          This door accepts only the locally configured operator secret. It does not create Node0 authority or execute a mission.
        </p>
        <form onSubmit={submit} style={{ marginTop: "2rem" }}>
          <label htmlFor="local-secret" style={{ display: "block", color: "#C9A962", fontSize: 13, marginBottom: 8 }}>Local session secret</label>
          <input id="local-secret" type="password" autoComplete="off" value={secret} onChange={(event) => setSecret(event.target.value)} required minLength={32} style={{ width: "100%", boxSizing: "border-box", padding: "0.9rem", background: "#050B14", border: "1px solid #C9A96266", color: "#E8EDF4", font: "inherit" }} />
          <button type="submit" disabled={busy || secret.length < 32} style={{ marginTop: "1rem", background: "#C9A962", color: "#050B14", border: 0, padding: "0.85rem 1.3rem", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy || secret.length < 32 ? 0.55 : 1 }}>
            {busy ? "Opening local session…" : "Open local session"}
          </button>
        </form>
        {status && <p role="alert" style={{ color: "#D99191", marginTop: "1.2rem" }}>{status}</p>}
        <p style={{ color: "#64798F", fontSize: 12, lineHeight: 1.6, marginTop: "2rem" }}>Secrets are not stored in browser storage or returned by the server. Sessions expire after 15 minutes.</p>
      </div>
    </main>
  );
}
