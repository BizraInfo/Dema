/*
 * HeroSeed — the landing thesis.
 *
 * Replaces a hero that opened with "BIZRA vΩ.2.0 — APEX KERNEL · OMNI-SYNTHESIS",
 * which told a stranger nothing. Measured 2026-07-28 in an end-to-end new-user
 * walkthrough: the first screen used insider vocabulary throughout.
 *
 * The mark is the subject's own founding object. البذرة means "the seed", and the
 * seed-pattern invariant says every node carries the whole system's DNA. Its root
 * descends as a chain of discrete links — germination and isnad (unbroken chains
 * of transmission) in the same gesture. Provenance, drawn.
 *
 * Arabic is set first and larger. It is not a translation of the English here;
 * it is the primary voice. ARABIC STATUS: DECLARED_NEEDS_NATIVE_REVIEW — authored
 * without native verification, pending the operator's review.
 *
 * No web fonts: this package builds offline, so type is system-stack only. A
 * proper Naskh face would materially improve the Arabic and is the first upgrade
 * to make once the build can fetch fonts.
 */

export function HeroSeed() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-line-ar"
      className="seed-hero"
    >
      <style>{`
        .seed-hero {
          --ink: #0A0F14;
          --seed: #C89B3C;
          --living: #4E7C59;
          --bone: #E8E3D9;
          --slate: #7C8797;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2.5rem;
          min-height: 100svh;
          padding: 4rem 1.25rem 5rem;
          background:
            radial-gradient(120% 80% at 50% 0%, #101821 0%, var(--ink) 62%);
          overflow: hidden;
          text-align: center;
        }
        .seed-hero__mark { display: block; width: 84px; height: auto; }
        @media (min-width: 640px) { .seed-hero__mark { width: 104px; } }

        /* Chain links draw downward in sequence: transmission, link by link. */
        .seed-hero__link {
          opacity: 0;
          animation: seedLink .5s ease-out forwards;
        }
        .seed-hero__link:nth-of-type(1) { animation-delay: .15s; }
        .seed-hero__link:nth-of-type(2) { animation-delay: .32s; }
        .seed-hero__link:nth-of-type(3) { animation-delay: .49s; }
        .seed-hero__link:nth-of-type(4) { animation-delay: .66s; }
        .seed-hero__link:nth-of-type(5) { animation-delay: .83s; }
        @keyframes seedLink {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .seed-hero__sprout {
          stroke-dasharray: 42;
          stroke-dashoffset: 42;
          animation: seedSprout 1.1s cubic-bezier(.22,.61,.36,1) 1s forwards;
        }
        @keyframes seedSprout { to { stroke-dashoffset: 0; } }
        .seed-hero__kernel {
          transform-origin: 50% 50%;
          animation: seedBreathe 5.5s ease-in-out 2s infinite;
        }
        @keyframes seedBreathe {
          0%, 100% { opacity: .92; }
          50%      { opacity: 1; }
        }

        .seed-hero__ar {
          margin: 0;
          direction: rtl;
          font-family: "Geeza Pro", "Noto Naskh Arabic", "Segoe UI", Tahoma,
                       "Times New Roman", serif;
          font-size: clamp(1.9rem, 6.2vw, 3.6rem);
          line-height: 1.55;
          font-weight: 600;
          color: var(--bone);
          max-width: 22ch;
          text-wrap: balance;
        }
        .seed-hero__en {
          margin: 0;
          font-family: Georgia, "Iowan Old Style", "Palatino Linotype", serif;
          font-size: clamp(.95rem, 2.2vw, 1.2rem);
          line-height: 1.6;
          font-style: italic;
          color: var(--slate);
          max-width: 34ch;
        }
        .seed-hero__rule {
          width: 1px; height: 2.25rem;
          background: linear-gradient(180deg, transparent, var(--seed), transparent);
          opacity: .55;
        }
        .seed-hero__what {
          margin: 0;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
          font-size: clamp(1rem, 2.4vw, 1.3rem);
          line-height: 1.7;
          color: var(--bone);
          max-width: 40ch;
        }
        .seed-hero__what-ar {
          margin: 0;
          direction: rtl;
          font-family: "Geeza Pro", "Noto Naskh Arabic", "Segoe UI", Tahoma, serif;
          font-size: clamp(1rem, 2.4vw, 1.25rem);
          line-height: 1.9;
          color: var(--bone);
          max-width: 36ch;
        }
        .seed-hero__actions {
          display: flex; flex-wrap: wrap; gap: .75rem;
          align-items: center; justify-content: center;
        }
        .seed-hero__cta, .seed-hero__ghost {
          display: inline-flex; align-items: center;
          padding: .7rem 1.35rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: .82rem; letter-spacing: .04em;
          text-decoration: none; border-radius: 2px;
          transition: background-color .18s ease, color .18s ease, border-color .18s ease;
        }
        .seed-hero__cta {
          background: var(--seed); color: #14100A; font-weight: 600;
        }
        .seed-hero__cta:hover { background: #DCAE49; }
        .seed-hero__ghost {
          border: 1px solid #26313D; color: var(--slate);
        }
        .seed-hero__ghost:hover { border-color: var(--living); color: var(--bone); }
        .seed-hero__cta:focus-visible, .seed-hero__ghost:focus-visible {
          outline: 2px solid var(--living); outline-offset: 3px;
        }
        .seed-hero__stage {
          margin: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: .68rem; letter-spacing: .18em; text-transform: uppercase;
          color: #55606D;
        }

        @media (prefers-reduced-motion: reduce) {
          .seed-hero__link, .seed-hero__sprout, .seed-hero__kernel {
            animation: none;
            opacity: 1;
            stroke-dashoffset: 0;
          }
        }
      `}</style>

      {/* The seed, and its root as a chain of transmission. */}
      <svg
        className="seed-hero__mark"
        viewBox="0 0 80 148"
        fill="none"
        role="img"
        aria-label="A seed above a descending chain — the seed pattern and its chain of provenance"
      >
        {/* sprout */}
        <path
          className="seed-hero__sprout"
          d="M40 46 C40 30, 40 22, 40 12 M40 24 C30 22, 25 16, 24 8"
          stroke="#4E7C59"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* the kernel */}
        <ellipse
          className="seed-hero__kernel"
          cx="40" cy="56" rx="15" ry="19"
          fill="#C89B3C"
        />
        <ellipse cx="40" cy="56" rx="15" ry="19" stroke="#E2BE6A" strokeWidth="1.1" />
        {/* root: five links, each drawn in turn */}
        {[84, 96, 108, 120, 132].map((y) => (
          <rect
            key={y}
            className="seed-hero__link"
            x="34" y={y} width="12" height="9" rx="4.5"
            stroke="#C89B3C"
            strokeWidth="1.7"
            fill="none"
          />
        ))}
      </svg>

      <h1 id="hero-line-ar" className="seed-hero__ar">
        كلما ازددتُ علمًا، ازددتُ علمًا بجهلي
      </h1>
      <p className="seed-hero__en">
        The more I learn, the more I know my own ignorance.
      </p>

      <div className="seed-hero__rule" aria-hidden="true" />

      <p className="seed-hero__what">
        An AI node that runs on your own machine, acts only on a phrase you type
        yourself, and ships tests proving what it cannot do.
      </p>
      <p className="seed-hero__what-ar">
        عقدة ذكاء اصطناعي تعمل على جهازك، لا تتحرك إلا بعبارة تكتبها بنفسك،
        وتَشحن اختبارات تُثبت ما لا تستطيع فعله.
      </p>

      <div className="seed-hero__actions">
        <a className="seed-hero__cta" href="#installer">
          Install your node · ثبّت عقدتك
        </a>
        <a className="seed-hero__ghost" href="#measured">
          See what it cannot do
        </a>
      </div>

      <p className="seed-hero__stage">
        Closed beta · one node live · federation not live
      </p>
    </section>
  );
}
