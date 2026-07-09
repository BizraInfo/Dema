// one-pulse.jsx — "One Pulse": the 8-phase Node0 mission loop as a followed-camera film.
// Reads the timeline engine globals set by animations.jsx (loaded first via x-import `from`).
// Law: motion is the subject here, but it still testifies — one motion per truth-event,
// green only seals, amber = designed_not_live, ember only refuses. Every phase names what
// it does NOT do. The receipt is the only thing that becomes real.

const GOLD = '#C9A962', PARCH = '#EDE6D3', AMBER = '#D4B875', GREEN = '#5CE0A0',
      EMBER = '#E0785C', VIOLET = '#B7A9F2', INK = '#F3EEDF', MUT = 'rgba(243,238,223,0.5)',
      NAVY_PANEL = '#071120', VOID = '#02060C';
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const CINZEL = "'Cinzel', serif";
const PLAY = "'Playfair Display', serif";

// ── phase schedule (seconds) ──────────────────────────────────────────────
const COLD_END = 4.2;
const STARTS = [4.2, 6.6, 9.6, 12.0, 15.0, 17.4, 20.6, 23.2];
const ENDS   = [6.6, 9.6, 12.0, 15.0, 17.4, 20.6, 23.2, 26.4];
const CLOSE_START = 26.4, TOTAL = 32;
const CX = [480, 900, 1320, 1740, 2160, 2580, 3000, 3420]; // world x of each station center
const HUMAN_X = 120, BAND_Y = 452, SEAL_T = 18.5;

// token / camera keyframes (monotonic time)
const TK_T = [0, 6.6, 7.3, 9.6, 10.3, 12.0, 12.7, 15.0, 15.7, 17.4, 18.1, 20.6, 21.3, 23.2, 23.9, 26.4, 27.8, 32];
const TK_V = [480, 480, 900, 900, 1320, 1320, 1740, 1740, 2160, 2160, 2580, 2580, 3000, 3000, 3420, 3420, HUMAN_X, HUMAN_X];

const PHASES = [
  { n: '01', name: 'PERCEIVE',        owner: 'DEMA · P7',      tone: GOLD,   active: 'PERCEIVING', done: 'PERCEIVED',
    say: 'An intent is heard. The niyyah enters — and nothing moves yet.',
    not: 'reads no file it was not handed · begins no work' },
  { n: '02', name: 'CONSENT',         owner: 'FATE membrane',  tone: GOLD,   active: 'CHECKING',   done: 'CONSENTED', membrane: true,
    say: 'μ ∈ Cₜ ? — byte-exact, or the pulse holds.',
    not: 'a narrative of consent is refused · relayed consent fails closed' },
  { n: '03', name: 'RESOURCE_SELECT', owner: 'PAT-7',          tone: PARCH,  active: 'SELECTING',  done: 'SELECTED',
    say: 'The smallest sufficient means are chosen — no more.',
    not: 'no network reached · no model invoked by default' },
  { n: '04', name: 'ACTION_PREVIEW',  owner: 'kernel',         tone: AMBER,  active: 'PREVIEWING', done: 'PREVIEWED', designed: true,
    say: 'What WOULD happen is rendered — not performed.',
    not: 'no effect leaves the sandbox · no live mutation' },
  { n: '05', name: 'VERIFY',          owner: 'SAT-5',          tone: PARCH,  active: 'VERIFYING',  done: 'VERIFIED',
    say: 'Graded fail-closed. A missing check is a failed check.',
    not: 'the verifier never grades its own homework' },
  { n: '06', name: 'RECEIPT',         owner: 'EvidenceChain',  tone: GREEN,  active: 'SEALING',    done: 'SEALED ✓', seal: true,
    say: 'Sealed — Ed25519 signed, hash-chained. This is the thing that becomes real.',
    not: 'nothing is minted on top of it · no reward is claimed' },
  { n: '07', name: 'WORLD_STATE',     owner: 'URP',            tone: AMBER,  active: 'PREVIEWING', done: 'PREVIEW', designed: true,
    say: 'The world would move here — in preview only.',
    not: 'no live commit · no federation · no URP write' },
  { n: '08', name: 'DEMA_REPORT',     owner: 'DEMA → Human',   tone: GOLD,   active: 'REPORTING',  done: 'REPORTED',
    say: 'Returned to the one human. The loop closes where it began.',
    not: 'claims only what the receipt proves — never more' },
];

const BOUNDARY = ['no_network', 'no_model', 'no_mint', 'no_daemon', 'no_federation'];

function phaseAt(t) {
  if (t < STARTS[0]) return -1;
  for (let i = 0; i < 8; i++) if (t >= STARTS[i] && t < ENDS[i]) return i;
  return 8;
}
function fadeWin(t, s, e, inD, outD) {
  if (t < s || t > e) return 0;
  if (t < s + inD) return (t - s) / inD;
  if (t > e - outD) return Math.max(0, (e - t) / outD);
  return 1;
}

// ── seed-of-life ground lattice (structural, faint) ────────────────────────
function SeedLattice() {
  return (
    <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        <pattern id="op-sol" width="132" height="114" patternUnits="userSpaceOnUse">
          <g fill="none" stroke={GOLD} strokeWidth="0.8">
            <circle cx="0" cy="0" r="38" /><circle cx="66" cy="0" r="38" /><circle cx="132" cy="0" r="38" />
            <circle cx="33" cy="57" r="38" /><circle cx="99" cy="57" r="38" />
            <circle cx="0" cy="114" r="38" /><circle cx="66" cy="114" r="38" /><circle cx="132" cy="114" r="38" />
          </g>
        </pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#op-sol)" />
    </svg>
  );
}

// ── one phase station (lives in world coordinates) ─────────────────────────
function Station({ i }) {
  const t = window.useTime();
  const p = PHASES[i];
  const state = t < STARTS[i] ? 'pending' : (t < ENDS[i] ? 'active' : 'done');
  const lit = state !== 'pending';
  const cx = CX[i];
  const w = 352, h = 232, left = cx - w / 2, top = BAND_Y - h / 2;

  const border = state === 'active' ? p.tone : (state === 'done' ? 'rgba(201,169,98,0.4)' : 'rgba(237,230,211,0.16)');
  const glow = state === 'active' ? `0 0 34px ${p.tone}44` : 'none';
  const dash = p.designed ? '6 5' : 'none';
  const chip = state === 'pending' ? '—' : (state === 'active' ? p.active : p.done);
  const chipC = state === 'done' ? (p.seal ? GREEN : 'rgba(201,169,98,0.7)') : (state === 'active' ? p.tone : MUT);

  // node glyph: diamond that lights when active/done
  const glyphBorder = lit ? p.tone : 'rgba(237,230,211,0.25)';
  const glyphBg = state === 'active' ? `${p.tone}18` : 'transparent';

  return (
    <div style={{ position: 'absolute', left, top, width: w, height: h, opacity: lit ? 1 : 0.4, transition: 'opacity .4s' }}>
      {/* hatched dot-shadow */}
      <div style={{ position: 'absolute', inset: 0, transform: 'translate(9px,9px)', backgroundImage: 'radial-gradient(rgba(201,169,98,0.28) 1px, transparent 1.3px)', backgroundSize: '5px 5px', opacity: lit ? 1 : 0.3 }} />
      <div style={{ position: 'absolute', inset: 0, border: `1px ${p.designed ? 'dashed' : 'solid'} ${border}`, borderStyle: p.designed ? 'dashed' : 'solid', background: NAVY_PANEL, boxShadow: glow, transition: 'border-color .4s, box-shadow .4s' }}>
        {/* label breaks the top border */}
        <div style={{ position: 'absolute', top: -9, left: 16, background: NAVY_PANEL, padding: '0 9px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: lit ? PARCH : MUT }}>
          {p.owner}
        </div>
        <div style={{ padding: '26px 22px 20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 13, color: p.tone, letterSpacing: '0.1em', flexShrink: 0 }}>{p.n}</span>
            <span style={{ fontFamily: CINZEL, fontWeight: 700, fontSize: 21, letterSpacing: '0.02em', color: state === 'pending' ? MUT : INK, whiteSpace: 'nowrap' }}>{p.name}</span>
          </div>
          {/* node diamond glyph */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 62, height: 62, border: `1px solid ${glyphBorder}`, background: glyphBg, transform: 'rotate(45deg)', boxShadow: state === 'active' ? `0 0 22px ${p.tone}55` : 'none', transition: 'all .4s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ transform: 'rotate(-45deg)', fontFamily: CINZEL, fontSize: 22, color: lit ? p.tone : MUT }}>{p.membrane ? '⊟' : (p.seal ? '✓' : (p.designed ? '◇' : '◆'))}</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: chipC }}>{chip}</span>
            {p.designed ? <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.1em', color: AMBER }}>DESIGNED_NOT_LIVE</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── the travelling token ───────────────────────────────────────────────────
function Token() {
  const t = window.useTime();
  const { interpolate, Easing } = window;
  const x = interpolate(TK_T, TK_V, Easing.easeInOutCubic)(t);
  const sealed = t >= SEAL_T;
  const col = sealed ? GREEN : GOLD;
  const returning = t >= CLOSE_START;
  // seal ring pulse around 17.6–19.2
  const ringP = fadeWin(t, 17.6, 19.4, 0.15, 0.6);
  const ringR = 22 + ringP * 40;

  return (
    <div style={{ position: 'absolute', left: x, top: BAND_Y, transform: 'translate(-50%,-50%)' }}>
      {ringP > 0 ? <div style={{ position: 'absolute', left: '50%', top: '50%', width: ringR * 2, height: ringR * 2, marginLeft: -ringR, marginTop: -ringR, borderRadius: '50%', border: `2px solid ${GREEN}`, opacity: (1 - ringP) * 0.9 }} /> : null}
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: col, boxShadow: `0 0 26px ${col}, 0 0 10px ${col}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontWeight: 700, fontSize: 13, color: VOID }}>
        {sealed ? '✓' : (returning ? '↩' : 'ن')}
      </div>
      <div style={{ position: 'absolute', left: '50%', top: 34, transform: 'translateX(-50%)', fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.14em', color: col, whiteSpace: 'nowrap' }}>
        {sealed ? 'RECEIPT' : 'INTENT'}
      </div>
    </div>
  );
}

// ── the world layer: camera-followed track + stations + human + token ──────
function World() {
  const t = window.useTime();
  const { interpolate, Easing } = window;
  const tokenX = interpolate(TK_T, TK_V, Easing.easeInOutCubic)(t);
  const camX = tokenX - 960;
  const worldFade = t >= CLOSE_START ? Math.max(0.22, 1 - (t - CLOSE_START) / 1.2) : 1;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 3720, height: 1080, transform: `translateX(${-camX}px)`, opacity: worldFade, transition: 'opacity .3s' }}>
        {/* base track */}
        <div style={{ position: 'absolute', left: HUMAN_X, top: BAND_Y - 1, width: CX[7] - HUMAN_X, height: 2, background: 'rgba(237,230,211,0.14)' }} />
        {/* travelled (gold) portion up to token */}
        <div style={{ position: 'absolute', left: HUMAN_X, top: BAND_Y - 1, width: Math.max(0, Math.min(tokenX, CX[7]) - HUMAN_X), height: 2, background: `linear-gradient(90deg, ${GOLD}44, ${GOLD})` }} />
        {/* human origin node */}
        <div style={{ position: 'absolute', left: HUMAN_X - 62, top: BAND_Y - 44, width: 124, height: 88, border: `1px solid ${GOLD}`, background: 'rgba(201,169,98,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: CINZEL, fontWeight: 700, fontSize: 15, letterSpacing: '0.1em', color: PARCH }}>HUMAN</span>
          <span style={{ fontFamily: MONO, fontSize: 8.5, color: MUT, marginTop: 4 }}>the sovereign</span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: t >= CLOSE_START ? GREEN : 'rgba(201,169,98,0.7)', marginTop: 4 }}>{t >= CLOSE_START ? 'LOOP CLOSED ✓' : 'sets intent'}</span>
        </div>
        {PHASES.map((_, i) => <Station key={i} i={i} />)}
        <Token />
      </div>
    </div>
  );
}

// ── top HUD (screen space, always readable) ────────────────────────────────
function TopHUD() {
  const t = window.useTime();
  const idx = phaseAt(t);
  const counter = idx < 0 ? 'STANDBY' : (idx >= 8 ? 'LOOP · CLOSED' : `PHASE ${idx + 1} / 8`);
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 34px', borderBottom: '1px solid rgba(201,169,98,0.16)', background: 'linear-gradient(to bottom, rgba(5,11,20,0.85), transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <svg width="20" height="20" viewBox="0 0 200 200" style={{ overflow: 'visible' }}><g fill="none" stroke={GOLD} strokeWidth="6"><circle cx="100" cy="100" r="30" /><circle cx="100" cy="70" r="30" /><circle cx="126" cy="85" r="30" /><circle cx="126" cy="115" r="30" /><circle cx="100" cy="130" r="30" /><circle cx="74" cy="115" r="30" /><circle cx="74" cy="85" r="30" /></g></svg>
        <span style={{ fontFamily: CINZEL, fontWeight: 700, fontSize: 14, letterSpacing: '0.2em', color: '#EDD9A3' }}>NODE0</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.14em', color: 'rgba(201,169,98,0.75)' }}>the living pulse</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.22em', color: PARCH }}>{counter}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {BOUNDARY.map((b) => <span key={b} style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.06em', color: 'rgba(92,224,160,0.7)' }}>✓ {b}</span>)}
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', color: AMBER, border: `1px solid ${AMBER}66`, borderRadius: 4, padding: '4px 8px' }}>PREVIEW_ONLY</span>
      </div>
    </div>
  );
}

// ── lower third testimony (screen space, cross-fades per phase) ────────────
function LowerThird() {
  const t = window.useTime();
  const idx = phaseAt(t);
  if (idx < 0 || idx >= 8) return null;
  const p = PHASES[idx];
  const op = fadeWin(t, STARTS[idx], ENDS[idx], 0.4, 0.3);
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 92, transform: 'translateX(-50%)', width: 'min(880px,80%)', textAlign: 'center', opacity: op, transition: 'opacity .12s' }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.28em', color: p.tone }}>{p.n} · {p.name}</div>
      <div style={{ fontFamily: PLAY, fontStyle: 'italic', fontSize: 27, lineHeight: 1.35, color: INK, marginTop: 12 }}>{p.say}</div>
      <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.04em', color: EMBER, marginTop: 12 }}>⊘ {p.not}</div>
    </div>
  );
}

// ── phase spine (screen space, 8 ticks) ─────────────────────────────────────
function Spine() {
  const t = window.useTime();
  const idx = phaseAt(t);
  return (
    <div style={{ position: 'absolute', bottom: 54, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10, alignItems: 'center' }}>
      {PHASES.map((p, i) => {
        const st = idx < 0 ? 'pending' : (i < idx || idx >= 8 ? 'done' : (i === idx ? 'active' : 'pending'));
        const c = st === 'active' ? p.tone : (st === 'done' ? 'rgba(201,169,98,0.55)' : 'rgba(237,230,211,0.2)');
        return <div key={i} style={{ width: st === 'active' ? 30 : 16, height: 3, background: c, transition: 'all .3s', boxShadow: st === 'active' ? `0 0 10px ${p.tone}` : 'none' }} />;
      })}
    </div>
  );
}

// ── cold open ───────────────────────────────────────────────────────────────
function ColdOpen() {
  const { Sprite, useTime } = window;
  return (
    <Sprite start={0} end={COLD_END + 0.5}>
      {() => {
        const t = useTime();
        const op = fadeWin(t, 0, COLD_END + 0.5, 0.5, 0.5);
        return (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: op, background: 'radial-gradient(60% 50% at 50% 42%, rgba(11,26,46,0.6), transparent 70%)' }}>
            <div style={{ position: 'relative', width: 150, height: 150 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1px dashed ${GOLD}66`, transform: `rotate(${t * 26}deg)` }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="86" height="86" viewBox="0 0 200 200" style={{ overflow: 'visible', filter: 'drop-shadow(0 0 16px rgba(201,169,98,0.5))' }}><g fill="none" stroke="#D8B96E" strokeWidth="5"><circle cx="100" cy="100" r="30" /><circle cx="100" cy="70" r="30" /><circle cx="126" cy="85" r="30" /><circle cx="126" cy="115" r="30" /><circle cx="100" cy="130" r="30" /><circle cx="74" cy="115" r="30" /><circle cx="74" cy="85" r="30" /></g></svg>
              </div>
            </div>
            <div style={{ fontFamily: CINZEL, fontWeight: 700, fontSize: 68, letterSpacing: '0.22em', marginTop: 28, background: 'linear-gradient(118deg,#8C6F35,#C9A962 40%,#F9F1D8 66%,#C9A962)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ONE PULSE</div>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.32em', color: 'rgba(237,217,163,0.8)', marginTop: 10 }}>NODE0 · FIRST REAL LOCAL MISSION · PREVIEW</div>
            <div style={{ fontFamily: PLAY, fontStyle: 'italic', fontSize: 18, color: MUT, marginTop: 18, maxWidth: '44ch', textAlign: 'center', lineHeight: 1.5 }}>One intent enters. Eight phases later, only a sealed receipt has become real — and nothing ran that was not proven.</div>
          </div>
        );
      }}
    </Sprite>
  );
}

// ── closeout ─────────────────────────────────────────────────────────────────
function Closeout() {
  const { Sprite, useTime } = window;
  return (
    <Sprite start={CLOSE_START} end={TOTAL}>
      {() => {
        const t = useTime();
        const op = fadeWin(t, CLOSE_START, TOTAL, 0.6, 0.01);
        const flags = [
          ['receipt_minted', 'true', GREEN], ['replay', 'passes', GREEN],
          ['mint_allowed', 'false', EMBER], ['world_state', 'preview only', AMBER],
          ['daemon_started', 'false', EMBER], ['network_used', 'false', EMBER],
          ['model_invoked', 'false', EMBER], ['authority_delta', '0', GREEN],
        ];
        return (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: op }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.3em', color: GREEN }}>THE PULSE COMPLETES</div>
            <div style={{ fontFamily: PLAY, fontStyle: 'italic', fontSize: 34, color: INK, marginTop: 12, textAlign: 'center', maxWidth: '30ch', lineHeight: 1.3 }}>Nothing ran that was not sealed.</div>
            <div style={{ position: 'relative', marginTop: 30, border: `1px solid ${GREEN}66`, background: NAVY_PANEL, padding: '20px 26px', minWidth: 520 }}>
              <div style={{ position: 'absolute', top: -9, left: 16, background: NAVY_PANEL, padding: '0 9px', fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: GREEN }}>completion receipt · sha256</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: '#EDD9A3', wordBreak: 'break-all' }}>⟡ a1a672b9c4d6…b94119bd</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 26px', marginTop: 16 }}>
                {flags.map(([k, v, c]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: MONO, fontSize: 11 }}>
                    <span style={{ color: MUT }}>{k}</span><span style={{ color: c }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', color: MUT, marginTop: 22 }}>one human · one node · one bond — the loop closes where it began</div>
          </div>
        );
      }}
    </Sprite>
  );
}

// ── the film ─────────────────────────────────────────────────────────────────
function OnePulse() {
  const { Stage } = window;
  return (
    <Stage width={1920} height={1080} duration={TOTAL} background={VOID} fps={30}>
      <SeedLattice />
      <World />
      <TopHUD />
      <Spine />
      <LowerThird />
      <ColdOpen />
      <Closeout />
    </Stage>
  );
}

window.OnePulse = OnePulse;
