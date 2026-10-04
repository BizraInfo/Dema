# BIZRA Provenance Pack v0.1 — Proof of Origin

**Prepared:** 2026-08-01 · **Status:** `STAGED` for publication on bizra.info
**Purpose:** bind BIZRA's origin story to cryptographic evidence, so it never has to be taken on faith.

---

## The claim

BIZRA did not begin as a reaction to the 2024–2026 AI-agent wave. It began in 2023 as a written
covenant — before the code, before the architecture, before the founder had any technical
background. The documents below are the originals. Their hashes are published so any copy can be
verified forever; per the project's own privacy law (Article 10), the deeply personal document is
published as **hash and date only** — its contents remain sovereign.

## Two tiers — do not merge them

The canon seals **three** roots. Two further documents are published as supporting evidence but are
**not** sealed roots. The distinction is the honest one and it is machine-checkable:
`docs/root-canon/root-canon.manifest.json` is marked `IMMUTABLE`, and its `authority` block records
that *no one* — not the founder, not a network vote, not an agent, not a validator — may modify a
root; a modified root forks the canon instead.

### Tier 1 — the three sealed roots (ship inside the repo)

| Manifest id | Document | PDF metadata date | SHA-256 |
|---|---|---|---|
| `ROOT_2_THE_SEED` | **البذرة — The Seed** (`bizra.pdf`, 26 pp, Arabic) — the founding covenant: Ihsan as the master trait, consent before reading, the seed that "seeks the light from darkness" | 2023-06-26 | `f95bc6f76acdc9339e005411a17810c50624784f18b55811d8339fcef6601538` |
| `ROOT_1_THE_MESSAGE` | **الرسالة — The Message** (`themassage.pdf`, 12 pp, Arabic) — private covenant; published as hash + date only | 2024-02-28 | `e05b73b933df31964b96255dca673300b01caea3bce8bd283e7f6440a876d3ce` |
| `ROOT_3_THE_THIRD_FACT` | **The Third Fact v0.1** (18 pp, bilingual) — the public manifesto: "Humanity is not fuel. Humanity is the infrastructure." | 2026 | `1deacd63f42315d7ae5ac426eb33149fae5d37e99c67b3949421b2c5c80cd02d` |

The manifest also carries a `sha3_512` for each root. Verifying both digests is strictly stronger
than SHA-256 alone; the command below does that automatically.

### Tier 2 — supporting documents (published separately, not sealed roots)

| Document | PDF metadata date | SHA-256 | Status |
|---|---|---|---|
| **Narrations** (`narrations.pdf`, 1 p, English) — the founding story: "three seekers … it's all about the choice" | 2023-08-14 | `ada1342ae891b143a13f52ba3e81b6a4ab9200d512455fc29523719b7e5b1560` | supporting evidence; not in the root manifest |
| **Ideology Master Document v0.1** (49 pp) | 2026-08-01 | `c4c5703e35375fb4d2bd13a79ae03ca5050e80956664ce8fd42968945b7bfc32` | **draft candidate** — ratification pending under its own revision protocol; not canon, not a root |

*Dates are PDF-file metadata (export dates) — the strongest machine-verifiable timestamps available.
The canon's own "Ramadan 2023" attribution refers to authorship; where the two differ, we publish the
verifiable one.*

## Verify this pack

**Tier 1 — from a clone, verified against the sealed manifest (not against this page).** The manifest
is the authority; a table in a marketing document is not. This checks every root's SHA-256 *and*
SHA-3-512 and fails loudly on any mismatch:

```bash
git clone https://github.com/BizraInfo/<repo>.git && cd <repo>
node -e '
const c=require("crypto"),f=require("fs");
const m=require("./docs/root-canon/root-canon.manifest.json");
let bad=0;
for (const r of m.roots) {
  const b=f.readFileSync(r.path);
  const s256=c.createHash("sha256").update(b).digest("hex");
  const s512=c.createHash("sha3-512").update(b).digest("hex");
  const ok = s256===r.sha256 && s512===r.sha3_512;
  if(!ok) bad++;
  console.log(ok?"OK  ":"FAIL", r.id, r.path);
}
console.log(bad?`${bad} MISMATCH — this is a P0, please report it`:"All roots verified.");
process.exit(bad?1:0);
'
```

Expected final line: `All roots verified.`

**Tier 2 — the two supporting PDFs are not in the repo.** Download them from bizra.info, then hash
them where you saved them:

```bash
sha256sum narrations.pdf BIZRA_Ideology_Master_Document_v0.1_Draft-1.pdf
# compare against the Tier 2 table above
```

If you cloned the repo and ran `sha256sum` on these two expecting them to be present, they will not
be — that is correct, not a fault. Only sealed roots ship in the tree.

## What three years produced

From those documents to today, one person, working alone with no funding, team, or prior technical
education: ~15,000 hours of R&D · 158 public repositories · 6,000+ complete development
conversations with frontier models spanning every phase since 2023 · a running local proof (First
Light) whose every claim is bound to a pinned commit and reproducible by strangers.

*Founder-attested figures, with their derivation stated: the conversation count is a floor of 3,652
distinct conversations measured on disk, plus an attested ≥40% never exported, which yields ≥6,087.
The repositories and the First Light proof are independently checkable today; the hours and the
unexported remainder are attestations, not measurements.*

## The economics, stated once

The 2023 Seed describes a token. The token is **sequenced, not scrapped**: nothing mints — for
anyone, including the founder — until impact is independently verified under published rules. This
is why, in three years, **zero tokens were minted**. The founder has no pre-mine; the founder has a
backlog awaiting the same audit everyone else will face. Founder first. Node0 first. Receipt first.

## The continuity, checkable

The 2023 covenant's commitments run as code in 2026: "you will find no honeyed promises" → automated
no-overclaim gates that fail the build on an unlabeled claim · the reader-consent gate written in
prose in 2023 → exact-phrase consent enforced at the FATE boundary · Ihsan "without which you lose
the way" → the repo's operating standard, mechanically checked. The ideology was not preserved in a
frame on the wall. It compiled.

---

*What this pack does not claim: that origin proves correctness (it doesn't — the harness does that);
that the Ideology draft is ratified or is a root; that any economic mechanism is live. Origin is
evidence of intent and duration. Proof of behavior lives at the pinned commit.*
