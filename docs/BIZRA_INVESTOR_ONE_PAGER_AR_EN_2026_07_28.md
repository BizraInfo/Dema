# BIZRA — Investor One-Pager · ورقة المستثمر
**2026-07-28 · bilingual AR/EN · every claim below is verifiable on disk or in a public repo**

> **Arabic status:** `DECLARED_NEEDS_NATIVE_REVIEW` — MSA authored without native-speaker
> verification. Mumu reviews before any external use. English is the reference text.

---

## EN · What BIZRA is

BIZRA is a sovereign AI node that runs on the operator's own machine. Its distinguishing
property is not capability — it is **verifiable restraint**: the system ships automated
proofs of what it *cannot* do, and refuses to act without an exact typed consent phrase.

**The one line:** *We ship automated proofs of what our system cannot do.* `[MEASURED]`
(Verifiable: the containment suite in a public repo. We make no claim about being the
only such project — that would be a superlative we cannot falsify.)

## AR · ما هي بِزرة

بِزرة عقدة ذكاء اصطناعي سيادية تعمل على جهاز المُشغِّل نفسه. ما يميّزها ليس القدرة، بل
**الانضباط القابل للإثبات**: النظام يَشحن اختبارات آلية تُثبت ما **لا** يستطيع فعله،
ويرفض التنفيذ دون عبارة موافقة صريحة يكتبها الإنسان حرفيًا.

**السطر الواحد:** *نشحن براهين آلية على ما لا يستطيع نظامنا فعله.* `[MEASURED]`
(قابل للتحقق: حزمة الاحتواء في مستودع عام. ولا ندّعي أننا الوحيدون — فذلك ادعاء تفضيلي
لا نستطيع دحضه.)

---

## EN · What is measured today (MEASURED)

| Claim | Evidence — replayable by anyone |
| --- | --- |
| Consent is a typed phrase, never a click | ADR-005 · exact-string match, no fuzzy, no case-fold |
| Signed receipts work | `tests/node0-receipt-signing-ed25519.test.js` — 20/20 |
| Public claims are gated | containment suite in a public repo — 93/93 |
| The node runs a local model, consent-bound | `dema llm-invoke` — completed, `external_call_performed: false` |
| The codebase is tested | 8,134 tests · 140+ fail-closed gates |

## AR · ما هو مُقاس اليوم (`MEASURED`)

| الادعاء | الدليل — قابل للإعادة من أي شخص |
| --- | --- |
| الموافقة عبارة مكتوبة، لا ضغطة زر | ADR-005 · مطابقة حرفية تامة، بلا تقريب |
| إيصالات موقَّعة تعمل فعليًا | `tests/node0-receipt-signing-ed25519.test.js` — ٢٠/٢٠ |
| الادعاءات العامة محكومة ببوابات | حزمة الاحتواء في مستودع عام — ٩٣/٩٣ |
| العقدة تُشغِّل نموذجًا محليًا بموافقة | `dema llm-invoke` — تم، `external_call_performed: false` |
| قاعدة الشيفرة مُختبَرة | ٨٬١٣٤ اختبارًا · أكثر من ١٤٠ بوابة تفشل مُغلَقة |

---

## EN · What is NOT live (stated plainly)

Federation, the token economy, and Proof-of-Impact rewards are `DESIGNED_NOT_LIVE`.
One node is live today: the founder's. Node scale figures on any surface are **design
targets**, labeled as such. Identity key ceremony is deliberately not yet performed.

We label these because a claim that cannot be falsified is not an asset — it is a liability.

## AR · ما هو غير مُفعَّل (بصراحة)

الاتحاد الشبكي، واقتصاد الرموز، ومكافآت إثبات الأثر — جميعها `DESIGNED_NOT_LIVE`.
عقدة واحدة تعمل اليوم: عقدة المؤسِّس. أرقام الحجم الشبكي على أي واجهة هي **أهداف تصميمية**
موسومة بذلك. مراسم مفتاح الهوية لم تُنفَّذ بعد، عن قصد.

نُصرّح بذلك لأن ادعاءً لا يمكن دحضه ليس أصلًا — بل التزام.

---

## EN · Why now

Trust is the scarcest commodity in AI. Models escape sandboxes and reach public
infrastructure; investors read scores with no shown math. BIZRA's posture inverts this:
**ask what is not live, and we will show you the test that says so.**

The constitutional frame is not marketing. It compiles: no riba (no unearned extraction),
no zann (no speculation presented as certainty), ihsan (excellence as the floor), adl
(bounded inequality). Each is an invariant enforced by a gate, not a slogan in a deck.

## AR · لماذا الآن

الثقة أندر سلعة في الذكاء الاصطناعي اليوم. نماذج تُفلت من صناديقها العازلة وتصل إلى بنى
تحتية عامة؛ ومستثمرون يقرؤون درجات بلا حساب معروض. موقف بِزرة يقلب هذا:
**اسألنا عمّا ليس مُفعَّلًا، ونُريك الاختبار الذي يُثبت ذلك.**

الإطار الدستوري ليس تسويقًا، بل يُترجَم إلى شيفرة: لا ربا (لا اقتطاع بغير كسب)، لا ظن
(لا تقديم التخمين كيقين)، إحسان (التميّز كحدٍّ أدنى)، عدل (تفاوت مقيَّد). كلٌّ منها ثابت
تفرضه بوابة، لا شعار في عرض تقديمي.

---

## EN · Stage and ask

**Stage:** closed beta. Invited operators run their own local node. General availability
follows predefined proof and acceptance criteria — **the beta ends when the criteria are
satisfied, not when a calendar period lapses.**

**Ask:** [to be completed by the founder before any external use]

## AR · المرحلة والطلب

**المرحلة:** نسخة تجريبية مغلقة. مُشغِّلون مدعوّون يُشغّلون عقدتهم المحلية. الإتاحة العامة
تأتي بعد استيفاء معايير إثبات وقبول محددة مسبقًا — **تنتهي التجربة عند استيفاء المعايير،
لا عند انقضاء مدة زمنية.**

**الطلب:** [يُستكمل من المؤسِّس قبل أي استخدام خارجي]

---

## Hard questions · أسئلة صعبة

**"Is it live?" / «هل هو مُفعَّل؟»**
EN — One node is live: the founder's. Runtime is seed-stage, receipts are measured,
federation and token economics are `DESIGNED_NOT_LIVE` `[PLANNED]`. Every surface says so,
and tests enforce the labeling.
AR — عقدة واحدة تعمل: عقدة المؤسِّس. زمن التشغيل في طور البذرة، والإيصالات مُقاسة،
والاتحاد واقتصاد الرموز مُصمَّمان ومحجوبان ببوابات. كل واجهة تُصرّح بذلك، والاختبارات تفرض الوسم.

**"Why will anyone care?" / «لماذا يهتم أحد؟»**
EN — Because a skeptic can falsify our claims from the repository, and the unproven ones
are published as an open challenge board.
AR — لأن بإمكان المشكِّك دحض ادعاءاتنا من المستودع نفسه، والادعاءات غير المُثبَتة منشورة
كلوحة تحديات مفتوحة.

---

**Do not state as achieved:** the million-node figure, any formal-verification claim, any
throughput or finality number, or the wealth-distribution coefficient. Each is a design
target or simulation output, none has a located benchmark artifact, and each would fail
our own claim gates. Full list with evidence status: `docs/CURRENT_LIMITS.md`.

**لا تُذكر كإنجاز:** رقم المليون عقدة، أو أي ادعاء تحقُّق صوري، أو أي رقم إنتاجية أو
حسم، أو معامل توزيع الثروة. كلٌّ منها هدف تصميمي أو ناتج محاكاة، ولا يوجد لأيٍّ منها أثر
قياس موثَّق، وكلٌّ منها يُسقِط بواباتنا الخاصة. القائمة الكاملة مع حالة الأدلة في
`docs/CURRENT_LIMITS.md`.
