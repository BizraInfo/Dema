# PKE — Personal Knowledge Engine v0.1

The first tool built **for Mumu**, not for the mission. Local, private, instant.

Three years of thinking becomes queryable: notes, docs, transcripts, research —
one command away, on your own machine, touching no network.

## Quick start

```bash
# Ingest your corpora (repeat any time — idempotent)
python3 pke.py ingest ~/Downloads/Dema/docs ~/Documents/notes

# Ask your own brain
python3 pke.py search "key rotation ceremony"
python3 pke.py search "consent" --path-filter adr -n 5
python3 pke.py stats
python3 pke.py recent
```

Optional alias for daily use:

```bash
echo 'alias pke="python3 ~/Downloads/Dema/pke/pke.py"' >> ~/.bashrc
```

## Design

- **Zero dependencies.** Python stdlib + SQLite FTS5 (porter-stemmed, BM25-ranked).
- **Zero network, zero daemon.** Runs only when you invoke it. Consistent with
  the Dema boundary: no hidden runtime, all state local.
- **State:** `~/.pke/pke.db` (override with `PKE_HOME`).
- **Idempotent ingest:** content-hashed; unchanged files are skipped, edited
  files are re-indexed, so re-running costs nothing.
- **Defaults:** prose files (`.md .txt .rst .adoc .org`); add `--code` for
  source files, `--all-text` for every non-binary file, `--ext` for custom.

## Measured (2026-07-31, this machine class)

| Claim | Evidence |
|---|---|
| Ingest 522 files / 645,591 words | 0.19 s |
| Idempotent re-ingest (0 changed) | 0.06 s, `=522 unchanged` |
| Ranked search over full corpus | 2–4 ms |

## What this does NOT do (v0.1)

- No semantic/embedding search — keyword + stemming only (BM25).
- No PDF, DOCX, OCR, or image extraction.
- No file watching — ingest is manual (re-run to refresh).
- No sync, no encryption at rest beyond filesystem permissions.
- Not part of the Dema runtime, receipts, or proof chain — a personal tool
  that lives beside the repo, untracked.

## v0.2 candidates (only when v0.1 has earned daily use)

- Local-model embeddings for semantic search (this is where the 32 cores wake up).
- PDF/DOCX extraction.
- `pke watch` incremental daemon — opt-in, visible, killable.
