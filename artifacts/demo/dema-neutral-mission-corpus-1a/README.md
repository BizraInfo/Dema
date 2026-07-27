# DEMA-NEUTRAL-MISSION-CORPUS-1A

**Truth label:** `SYNTHETIC_PUBLIC_SAFE`
**Purpose:** the smallest controlled world in which a stranger can see what Dema does.

30 files describing a fictional small team (Kestrel Logistics) failing to launch a
fictional product (MERIDIAN, a warehouse check-in app). Every person, company,
number, and document is invented for this demonstration.

## The mission question

> "We inherited this project folder. Tell us what was actually decided, what remains
> unfinished, what contradicts what, and the safest next action."

## Layout

```
build-corpus.mjs     deterministic generator — re-run reproduces byte-identical files
corpus/              the 30 files Dema reads
MANIFEST.sha256      per-file sha256, sorted
CHALLENGE_KEY.md     what is planted and where — NOT part of the corpus
```

`CHALLENGE_KEY.md` deliberately lives **outside** `corpus/`. Pointing Dema at this
directory instead of `corpus/` would hand it the answers and invalidate the run.

## Reproducibility

```bash
node build-corpus.mjs
sha256sum -c MANIFEST.sha256   # run from corpus/
```

The generator embeds no timestamps, no randomness, and no host paths. Rebuilding
produces an identical `MANIFEST.sha256`.

## Boundaries

```text
network_used: false
private_founder_data_used: false
bizra_internal_documents_used: false
external_copyright_dependency: false
personal_information: none
```

No BIZRA document, no founder corpus material, and no third-party copyrighted text
is present. The corpus is original content written for this demonstration and is
free to redistribute with the repository.

## What this corpus does not prove

It does not prove Dema handles real customer data, large corpora, or unfamiliar
formats. It is a designed world with known answers — that is what makes it usable
as a demonstration, and what stops it from being evidence about general capability.
