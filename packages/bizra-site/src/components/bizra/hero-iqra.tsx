/*
 * HeroIqra — the landing thesis.
 *
 * اقرأ. The first word revealed. Not "believe", not "obey", not "worship" —
 * read. Knowledge before assertion, verification before claim. That command is
 * this system's entire epistemic discipline, and it predates the system by
 * fourteen centuries.
 *
 * Typography is the argument here, so it is served properly rather than left to
 * a system fallback:
 *   - اقرأ is set in Noto Kufi. Kufic is the script of the earliest Qur'anic
 *     manuscripts — architectural, geometric, the hand of the century the first
 *     word was written down in.
 *   - Running Arabic is set in Amiri, the Naskh revival modelled on the Bulaq
 *     Press types of Cairo — the closest living type to classical Arabic book
 *     typography.
 * Both are shipped from /public/fonts and load with no network call, preserving
 * the offline build.
 *
 * The scholars named below are historical fact with their own attributions, not
 * BIZRA claims. Each is a person who read, measured, and refused to assert past
 * their evidence — which is the lineage this project places itself in, humbly.
 *
 * ARABIC STATUS: DECLARED_NEEDS_NATIVE_REVIEW — the operator is a native speaker
 * and is the authority on every Arabic string here.
 */

const SCHOLARS = [
  {
    ar: "ابن الهيثم",
    en: "Ibn al-Haytham",
    years: "965–1040",
    ar_note: "أسّس المنهج التجريبي: لا تُصدَّق دعوى إلا بالاختبار.",
    en_note: "Founded the experimental method — a claim is not accepted until it is tested.",
  },
  {
    ar: "الخوارزمي",
    en: "Al-Khwārizmī",
    years: "780–850",
    ar_note: "وضع الجبر وأعطى الخوارزمية اسمها.",
    en_note: "Gave algebra its method, and the algorithm its name.",
  },
  {
    ar: "البيروني",
    en: "Al-Bīrūnī",
    years: "973–1048",
    ar_note: "قاس محيط الأرض، وسجّل حدود قياسه.",
    en_note: "Measured the Earth's circumference, and recorded the limits of his own measurement.",
  },
  {
    ar: "ابن سينا",
    en: "Ibn Sīnā",
    years: "980–1037",
    ar_note: "قانون الطب: مرجع أوروبا ستة قرون.",
    en_note: "The Canon of Medicine — Europe's reference for six centuries.",
  },
];

export function HeroIqra() {
  return (
    <section id="hero" aria-labelledby="iqra" className="iqra">
      <style>{`
        @font-face {
          font-family: "AmiriLocal";
          src: url("/fonts/Amiri-400.woff2") format("woff2");
          font-weight: 400; font-style: normal; font-display: swap;
        }
        @font-face {
          font-family: "KufiLocal";
          src: url("/fonts/NotoKufiArabic-Bold.ttf") format("truetype");
          font-weight: 700; font-style: normal; font-display: swap;
        }

        .iqra {
          --ink:    #0A0F14;
          --gold:   #C89B3C;
          --living: #4E7C59;
          --bone:   #E8E3D9;
          --slate:  #7C8797;
          position: relative;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 2rem;
          min-height: 100svh;
          padding: 4.5rem 1.25rem 4rem;
          background: radial-gradient(125% 85% at 50% 8%, #111a23 0%, var(--ink) 64%);
          text-align: center; overflow: hidden;
        }

        /* The word. Everything else on this page is quieter than this. */
        .iqra__word {
          margin: 0;
          font-family: "KufiLocal", "Noto Kufi Arabic", serif;
          font-size: clamp(5.5rem, 22vw, 15rem);
          line-height: .95;
          font-weight: 700;
          color: var(--bone);
          direction: rtl;
          letter-spacing: .02em;
          text-shadow: 0 0 60px rgba(200,155,60,.13);
          animation: iqraRise 1.5s cubic-bezier(.16,.8,.3,1) both;
        }
        @keyframes iqraRise {
          from { opacity: 0; transform: translateY(14px); letter-spacing: .16em; }
          to   { opacity: 1; transform: translateY(0);    letter-spacing: .02em; }
        }

        .iqra__gloss {
          margin: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: .7rem; letter-spacing: .34em; text-transform: uppercase;
          color: var(--gold);
          animation: iqraFade 1s ease-out .55s both;
        }
        .iqra__source {
          margin: 0; max-width: 46ch;
          font-family: "AmiriLocal", "Noto Naskh Arabic", serif;
          font-size: clamp(1rem, 2.5vw, 1.3rem);
          line-height: 2; color: var(--slate); direction: rtl;
          animation: iqraFade 1s ease-out .8s both;
        }
        @keyframes iqraFade { from { opacity: 0; } to { opacity: 1; } }

        .iqra__rule {
          width: 1px; height: 2rem;
          background: linear-gradient(180deg, transparent, var(--gold), transparent);
          opacity: .5;
        }

        .iqra__what {
          margin: 0; max-width: 42ch;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          font-size: clamp(1rem, 2.3vw, 1.22rem);
          line-height: 1.7; color: var(--bone);
        }
        .iqra__what-ar {
          margin: 0; max-width: 40ch; direction: rtl;
          font-family: "AmiriLocal", "Noto Naskh Arabic", serif;
          font-size: clamp(1.05rem, 2.4vw, 1.3rem);
          line-height: 2.1; color: var(--bone);
        }

        .iqra__lineage {
          display: grid; gap: .9rem;
          grid-template-columns: 1fr;
          width: 100%; max-width: 62rem;
          margin-top: .75rem;
          text-align: start;
        }
        @media (min-width: 720px) {
          .iqra__lineage { grid-template-columns: repeat(4, 1fr); }
        }
        .iqra__scholar {
          padding: .85rem .95rem;
          border-block-start: 1px solid #223040;
        }
        .iqra__scholar-ar {
          display: block; direction: rtl;
          font-family: "AmiriLocal", "Noto Naskh Arabic", serif;
          font-size: 1.15rem; color: var(--bone); line-height: 1.6;
        }
        .iqra__scholar-en {
          display: block;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: .78rem; color: var(--gold); letter-spacing: .02em;
          margin-block-start: .1rem;
        }
        .iqra__scholar-note {
          display: block;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: .74rem; line-height: 1.55; color: var(--slate);
          margin-block-start: .4rem;
        }

        .iqra__actions { display: flex; flex-wrap: wrap; gap: .7rem; justify-content: center; }
        .iqra__cta, .iqra__ghost {
          display: inline-flex; align-items: center;
          padding: .72rem 1.35rem; border-radius: 2px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: .8rem; letter-spacing: .04em; text-decoration: none;
          transition: background-color .18s ease, border-color .18s ease, color .18s ease;
        }
        .iqra__cta { background: var(--gold); color: #14100A; font-weight: 600; }
        .iqra__cta:hover { background: #DCAE49; }
        .iqra__ghost { border: 1px solid #26313D; color: var(--slate); }
        .iqra__ghost:hover { border-color: var(--living); color: var(--bone); }
        .iqra__cta:focus-visible, .iqra__ghost:focus-visible {
          outline: 2px solid var(--living); outline-offset: 3px;
        }
        .iqra__stage {
          margin: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: .66rem; letter-spacing: .17em; text-transform: uppercase;
          color: #55606D;
        }

        @media (prefers-reduced-motion: reduce) {
          .iqra__word, .iqra__gloss, .iqra__source { animation: none; }
        }
      `}</style>

      <h1 id="iqra" className="iqra__word" lang="ar">اقرأ</h1>
      <p className="iqra__gloss">Iqra · Read</p>
      <p className="iqra__source" lang="ar">
        أوّل كلمة نزلت. لم تكن «آمِن» ولا «أطِع» — بل «اقرأ».
        المعرفة قبل الدعوى، والتحقّق قبل اليقين.
      </p>

      <div className="iqra__rule" aria-hidden="true" />

      <p className="iqra__what">
        An AI node that runs on your own machine, acts only on a phrase you type
        yourself, and ships tests proving what it cannot do.
      </p>
      <p className="iqra__what-ar" lang="ar">
        عقدة ذكاء اصطناعي تعمل على جهازك، لا تتحرك إلا بعبارة تكتبها بنفسك،
        وتَشحن اختبارات تُثبت ما لا تستطيع فعله.
      </p>

      <div className="iqra__actions">
        <a className="iqra__cta" href="#installer">Install your node · ثبّت عقدتك</a>
        <a className="iqra__ghost" href="#measured">See what it cannot do</a>
      </div>

      <p className="iqra__stage">Closed beta · one node live · federation not live</p>

      <div className="iqra__lineage">
        {SCHOLARS.map((s) => (
          <div key={s.en} className="iqra__scholar">
            <span className="iqra__scholar-ar" lang="ar">{s.ar}</span>
            <span className="iqra__scholar-en">{s.en} · {s.years}</span>
            <span className="iqra__scholar-note">{s.en_note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
