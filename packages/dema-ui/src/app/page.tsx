"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * DEMA-FIRST-ENCOUNTER-1A · P4 — the front door.
 *
 * ROOT-2 gates its own reader before it gates anything else:
 * «الآن لحظة الاختيار توافق على القواعد أم لا» — the choice is presented before the
 * content, not after. This screen does to a folder what the root does to its reader.
 *
 * This component renders verdicts. It never mints one: every ADMITTED / REFUSED
 * decision below comes from packages/core/src/first-encounter-admission.js, which
 * the repo's `npm test` proves independently of this UI.
 */

type MetaRecord = {
  relative_path: string;
  extension: string;
  size: number;
  modified_time: string;
  file_hash: string;
};

type Scope = {
  root_label: string;
  root_real_path: string;
  file_count: number;
  total_bytes: number;
  manifest_hash: string | null;
};

type Contract = {
  mission_question: string;
  truth_label: string;
  scope: Scope;
  permission: {
    effect: string;
    write_permitted: boolean;
    delete_permitted: boolean;
    network_permitted: boolean;
    scope_is_exact: boolean;
    transfers_to_other_scopes: boolean;
  };
  required_phrase: string;
  reject_option: { available: boolean; effect_of_rejection: string };
};

type Inventory = {
  file_count: number;
  total_bytes: number;
  extensions: Record<string, number>;
  files: MetaRecord[];
};

type Verdict = {
  state: "ADMITTED" | "REFUSED";
  content_admitted: boolean;
  phase: string;
  reason_codes: string[];
  requirement: string;
  granted_scope: Scope | null;
};

const GOLD = "#C9A962";
const TEAL = "#2DD4BF";
const NAVY = "#0A1628";
const BLACK = "#050B14";

const bytes = (n: number) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);

export default function FirstEncounter() {
  const [phase, setPhase] = useState<"PRESENCE" | "METADATA" | "VERDICT">("PRESENCE");
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [skipped, setSkipped] = useState<{ relative_path: string; reason: string }[]>([]);
  const [phrase, setPhrase] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "DEMA — mission";
  }, []);

  const discover = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/first-encounter/inventory");
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "inventory failed");
      setInventory(json.inventory);
      setContract(json.contract);
      setSkipped(json.skipped ?? []);
      setPhase("METADATA");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }, []);

  const submit = useCallback(async (given: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/first-encounter/admit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phrase: given }),
      });
      const json = await res.json();
      if (!json.verdict) throw new Error(json.error ?? "admission failed");
      setVerdict(json.verdict);
      setPhase("VERDICT");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${BLACK} 0%, ${NAVY} 100%)`,
        color: "#E8EDF4",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        padding: "clamp(1.5rem, 5vw, 4rem)",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ borderBottom: `1px solid ${GOLD}33`, paddingBottom: "1.5rem" }}>
          <div style={{ letterSpacing: "0.35em", fontSize: 12, color: GOLD, textTransform: "uppercase" }}>
            Node0 · local · network off
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "clamp(2.5rem, 7vw, 4rem)",
              margin: "0.5rem 0 0.75rem",
              letterSpacing: "0.02em",
            }}
          >
            DEMA
          </h1>
          {/* ROOT-3 p7, verbatim. Constitutional, not marketing copy. */}
          <p style={{ margin: 0, color: "#9FB3C8", fontSize: 15 }}>
            The visible bridge — trusted companion between heart, mind, and action.
          </p>
        </header>

        {phase === "PRESENCE" && (
          <section style={{ paddingTop: "3rem" }}>
            <h2
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                fontWeight: 400,
                lineHeight: 1.35,
                maxWidth: 760,
              }}
            >
              What are we trying to accomplish?
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: "2rem 0", color: "#9FB3C8", lineHeight: 2 }}>
              <li>Your mission is present.</li>
              <li>Your knowledge remains yours.</li>
              <li>Nothing has been read or changed without your authority.</li>
            </ul>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: "2.5rem" }}>
              <button
                onClick={discover}
                disabled={busy}
                style={{
                  background: GOLD,
                  color: BLACK,
                  border: "none",
                  padding: "0.9rem 1.6rem",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: busy ? "wait" : "pointer",
                }}
              >
                {busy ? "Reading names only…" : "Select a folder"}
              </button>
              <a
                href="/realm"
                style={{
                  border: `1px solid ${GOLD}55`,
                  color: "#9FB3C8",
                  padding: "0.9rem 1.6rem",
                  fontSize: 15,
                  textDecoration: "none",
                }}
              >
                Realm view
              </a>
            </div>
            <p style={{ marginTop: "2rem", fontSize: 13, color: "#64798F" }}>
              Demonstration scope is pinned to a synthetic project folder. No network. No account.
            </p>
          </section>
        )}

        {phase === "METADATA" && inventory && contract && (
          <section style={{ paddingTop: "2.5rem" }}>
            <div style={{ letterSpacing: "0.3em", fontSize: 11, color: TEAL, textTransform: "uppercase" }}>
              Phase 1 of 2 · metadata discovery
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, fontSize: "1.9rem" }}>
              I found {inventory.file_count} files.
            </h2>

            <p style={{ color: "#9FB3C8", maxWidth: 720, lineHeight: 1.7 }}>
              Before reading their contents, I can show names, types, sizes, modification dates and a
              content hash of each file.
            </p>

            {/* The precise claim. "Content has not been read" would be an overclaim:
                a digest requires streaming the bytes. What is true is that none was kept. */}
            <div
              style={{
                border: `1px solid ${TEAL}44`,
                background: `${TEAL}0D`,
                padding: "1rem 1.2rem",
                margin: "1.5rem 0",
                fontSize: 13.5,
                lineHeight: 1.7,
                color: "#B8CADB",
              }}
            >
              <strong style={{ color: TEAL }}>No file content has entered this mission.</strong> Each
              file was streamed in fixed-size chunks to compute its SHA-256, and the chunks were
              discarded — no text, preview, excerpt or embedding was retained, returned or displayed.
              The boundary <em>refuses</em> any record carrying content rather than stripping it.
            </div>

            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", margin: "1.5rem 0", fontSize: 14 }}>
              <span style={{ color: "#64798F" }}>
                Total <strong style={{ color: "#E8EDF4" }}>{bytes(inventory.total_bytes)}</strong>
              </span>
              {Object.entries(inventory.extensions).map(([ext, n]) => (
                <span key={ext} style={{ color: "#64798F" }}>
                  {ext} <strong style={{ color: "#E8EDF4" }}>{n}</strong>
                </span>
              ))}
              {skipped.length > 0 && <span style={{ color: GOLD }}>skipped {skipped.length}</span>}
            </div>

            <div style={{ maxHeight: 320, overflowY: "auto", overflowX: "auto", border: `1px solid ${GOLD}22` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead style={{ position: "sticky", top: 0, background: NAVY }}>
                  <tr style={{ color: GOLD, textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>relative_path</th>
                    <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>ext</th>
                    <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>size</th>
                    <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>modified</th>
                    <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>sha-256</th>
                  </tr>
                </thead>
                <tbody style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                  {inventory.files.map((f) => (
                    <tr key={f.relative_path} style={{ borderTop: `1px solid ${GOLD}14` }}>
                      <td style={{ padding: "0.5rem 0.8rem", color: "#D6E0EC" }}>{f.relative_path}</td>
                      <td style={{ padding: "0.5rem 0.8rem", color: "#64798F" }}>{f.extension}</td>
                      <td style={{ padding: "0.5rem 0.8rem", color: "#64798F" }}>{f.size}</td>
                      <td style={{ padding: "0.5rem 0.8rem", color: "#64798F" }}>{f.modified_time.slice(0, 10)}</td>
                      <td style={{ padding: "0.5rem 0.8rem", color: "#3E5468" }}>{f.file_hash.slice(0, 12)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── the gate ── */}
            <div style={{ border: `1px solid ${GOLD}55`, marginTop: "2.5rem", padding: "1.5rem" }}>
              <div style={{ letterSpacing: "0.3em", fontSize: 11, color: GOLD, textTransform: "uppercase" }}>
                Phase 2 of 2 · authority requested
              </div>
              <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, marginBottom: "1rem" }}>
                Review and authorize?
              </h3>

              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "0.5rem 1.5rem",
                  fontSize: 13.5,
                  margin: 0,
                }}
              >
                <dt style={{ color: "#64798F" }}>Mission</dt>
                <dd style={{ margin: 0, color: "#D6E0EC" }}>{contract.mission_question}</dd>
                <dt style={{ color: "#64798F" }}>Exact scope</dt>
                <dd
                  style={{
                    margin: 0,
                    color: "#D6E0EC",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    wordBreak: "break-all",
                  }}
                >
                  {contract.scope.root_real_path}
                </dd>
                <dt style={{ color: "#64798F" }}>Files</dt>
                <dd style={{ margin: 0, color: "#D6E0EC" }}>
                  exactly {contract.scope.file_count} · {bytes(contract.scope.total_bytes)}
                </dd>
                <dt style={{ color: "#64798F" }}>Permission</dt>
                <dd style={{ margin: 0, color: "#D6E0EC" }}>
                  {contract.permission.effect} — no write, no delete, no network, scope does not transfer
                </dd>
                {contract.scope.manifest_hash && (
                  <>
                    <dt style={{ color: "#64798F" }}>Manifest</dt>
                    <dd
                      style={{
                        margin: 0,
                        color: "#3E5468",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                      }}
                    >
                      {contract.scope.manifest_hash.slice(0, 24)}…
                    </dd>
                  </>
                )}
              </dl>

              <p style={{ color: "#9FB3C8", fontSize: 13.5, marginTop: "1.5rem" }}>
                Type the phrase exactly to grant it. There is no fuzzy consent.
              </p>
              <code
                style={{
                  display: "block",
                  background: BLACK,
                  color: GOLD,
                  padding: "0.7rem 1rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  border: `1px solid ${GOLD}33`,
                  wordBreak: "break-all",
                }}
              >
                {contract.required_phrase}
              </code>

              <input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="type the exact phrase"
                aria-label="exact consent phrase"
                style={{
                  width: "100%",
                  marginTop: "0.8rem",
                  padding: "0.8rem 1rem",
                  background: "transparent",
                  border: `1px solid ${GOLD}44`,
                  color: "#E8EDF4",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                }}
              />

              <div style={{ display: "flex", gap: 12, marginTop: "1.2rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => submit(phrase)}
                  disabled={busy}
                  style={{
                    background: GOLD,
                    color: BLACK,
                    border: "none",
                    padding: "0.8rem 1.5rem",
                    fontWeight: 600,
                    cursor: busy ? "wait" : "pointer",
                  }}
                >
                  Grant authority
                </button>
                <button
                  onClick={() => submit("")}
                  disabled={busy}
                  style={{
                    background: "transparent",
                    color: "#9FB3C8",
                    border: `1px solid ${GOLD}44`,
                    padding: "0.8rem 1.5rem",
                    cursor: "pointer",
                  }}
                >
                  Decline
                </button>
              </div>
              {/* ROOT-1: «إنه اختيارك أن تكمل وليس اختياري» */}
              <p style={{ color: "#64798F", fontSize: 12.5, marginTop: "1rem" }}>
                Declining stops the mission and reads nothing. It is your choice to continue, not mine.
              </p>
            </div>
          </section>
        )}

        {phase === "VERDICT" && verdict && (
          <section style={{ paddingTop: "2.5rem" }}>
            <div
              style={{
                letterSpacing: "0.3em",
                fontSize: 11,
                textTransform: "uppercase",
                color: verdict.content_admitted ? TEAL : GOLD,
              }}
            >
              {verdict.state}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 400, fontSize: "1.9rem" }}>
              {verdict.content_admitted
                ? "Authority granted for exactly this scope."
                : "No content was read."}
            </h2>

            <pre
              style={{
                background: BLACK,
                border: `1px solid ${GOLD}33`,
                padding: "1.2rem",
                overflowX: "auto",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12.5,
                color: "#B8CADB",
              }}
            >
              {JSON.stringify(
                {
                  state: verdict.state,
                  content_admitted: verdict.content_admitted,
                  phase: verdict.phase,
                  reason_codes: verdict.reason_codes,
                  requirement: verdict.requirement,
                  granted_scope: verdict.granted_scope,
                },
                null,
                2,
              )}
            </pre>

            <div
              style={{
                border: `1px solid ${GOLD}33`,
                padding: "1rem 1.2rem",
                fontSize: 13.5,
                color: "#9FB3C8",
                lineHeight: 1.7,
              }}
            >
              This rung ends here by design. Reading the admitted files, surfacing the contradictions,
              refusing an unsafe request and issuing a receipt are the next rung — deliberately not
              built yet, so nothing on this screen is scripted.
            </div>

            <button
              onClick={() => {
                setPhase("PRESENCE");
                setPhrase("");
                setVerdict(null);
              }}
              style={{
                marginTop: "1.5rem",
                background: "transparent",
                color: "#9FB3C8",
                border: `1px solid ${GOLD}44`,
                padding: "0.8rem 1.5rem",
                cursor: "pointer",
              }}
            >
              Start over
            </button>
          </section>
        )}

        {error && (
          <p style={{ color: "#F87171", marginTop: "2rem", fontFamily: "monospace", fontSize: 13 }}>{error}</p>
        )}

        <footer
          style={{
            marginTop: "4rem",
            paddingTop: "1.5rem",
            borderTop: `1px solid ${GOLD}22`,
            color: "#3E5468",
            fontSize: 11.5,
            letterSpacing: "0.05em",
          }}
        >
          LOCAL_CONTENT_ADDRESSED · unsigned until signer rotation · no federation · no token · no live
          SAT · network off
        </footer>
      </div>
    </main>
  );
}
