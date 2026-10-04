#!/usr/bin/env python3
"""PKE — Personal Knowledge Engine v0.1

A private, local, zero-dependency knowledge base.
Ingest your notes and documents into SQLite FTS5; search them in milliseconds.

State lives in ~/.pke/pke.db (override with PKE_HOME).
No network. No daemon. No cloud. Python stdlib only.

Usage:
  pke.py ingest PATH [PATH ...] [--ext md,txt,...] [--code] [--all-text]
  pke.py search "query terms" [-n 10] [--any] [--path-filter SUBSTR]
  pke.py stats
  pke.py recent [-n 10]
"""

import argparse
import hashlib
import os
import sqlite3
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------- constants

DEFAULT_EXTS = {".md", ".markdown", ".txt", ".rst", ".adoc", ".org"}
CODE_EXTS = {".py", ".js", ".mjs", ".ts", ".jsx", ".tsx", ".rs", ".go",
             ".java", ".c", ".h", ".cpp", ".sh", ".rb", ".sql", ".toml",
             ".yaml", ".yml", ".json", ".css", ".html"}
EXCLUDE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv",
                "dist", "build", ".next", "target", ".cache", ".idea",
                ".vscode", "coverage"}
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB safety cap


def db_path() -> Path:
    home = Path(os.environ.get("PKE_HOME", Path.home() / ".pke"))
    home.mkdir(parents=True, exist_ok=True)
    return home / "pke.db"


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(db_path())
    con.execute("PRAGMA journal_mode=WAL")
    # Verify FTS5 is available before doing anything else.
    try:
        con.execute("CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_probe USING fts5(x)")
        con.execute("DROP TABLE IF EXISTS _fts5_probe")
    except sqlite3.OperationalError:
        sys.exit("error: this Python's SQLite lacks FTS5. "
                 "Install a Python built against a modern SQLite (>=3.9).")
    con.executescript("""
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            title TEXT,
            hash TEXT NOT NULL,
            mtime REAL,
            size INTEGER,
            words INTEGER,
            ingested_at REAL
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
            content,
            tokenize='porter unicode61'
        );
    """)
    return con


# ---------------------------------------------------------------- ingest

def looks_binary(raw: bytes) -> bool:
    return b"\x00" in raw[:8192]


def extract_title(text: str, fallback: str) -> str:
    for line in text.splitlines()[:30]:
        line = line.strip()
        if line.startswith("#"):
            return line.lstrip("#").strip()[:200] or fallback
    return fallback


def iter_files(roots, exts):
    for root in roots:
        root = Path(root).expanduser().resolve()
        if root.is_file():
            yield root
            continue
        if not root.is_dir():
            print(f"  skip (not found): {root}", file=sys.stderr)
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames
                           if d not in EXCLUDE_DIRS and not d.startswith(".")]
            for name in filenames:
                p = Path(dirpath) / name
                if exts is None or p.suffix.lower() in exts:
                    yield p


def cmd_ingest(args):
    if args.all_text:
        exts = None
    else:
        exts = set(DEFAULT_EXTS)
        if args.code:
            exts |= CODE_EXTS
        if args.ext:
            exts |= {"." + e.strip().lstrip(".").lower()
                     for e in args.ext.split(",") if e.strip()}

    con = connect()
    t0 = time.time()
    added = updated = unchanged = skipped = 0

    for p in iter_files(args.paths, exts):
        try:
            st = p.stat()
            if st.st_size > MAX_FILE_BYTES or st.st_size == 0:
                skipped += 1
                continue
            raw = p.read_bytes()
            if looks_binary(raw):
                skipped += 1
                continue
            text = raw.decode("utf-8", errors="replace")
        except OSError:
            skipped += 1
            continue

        digest = hashlib.sha256(raw).hexdigest()
        path_str = str(p)
        row = con.execute("SELECT id, hash FROM files WHERE path = ?",
                          (path_str,)).fetchone()
        if row and row[1] == digest:
            unchanged += 1
            continue

        title = extract_title(text, p.name)
        words = len(text.split())
        if row:
            fid = row[0]
            con.execute("DELETE FROM docs WHERE rowid = ?", (fid,))
            con.execute("""UPDATE files SET title=?, hash=?, mtime=?, size=?,
                           words=?, ingested_at=? WHERE id=?""",
                        (title, digest, st.st_mtime, st.st_size, words,
                         time.time(), fid))
            updated += 1
        else:
            cur = con.execute("""INSERT INTO files
                (path, title, hash, mtime, size, words, ingested_at)
                VALUES (?,?,?,?,?,?,?)""",
                (path_str, title, digest, st.st_mtime, st.st_size, words,
                 time.time()))
            fid = cur.lastrowid
            added += 1
        con.execute("INSERT INTO docs(rowid, content) VALUES (?, ?)",
                    (fid, text))

    con.commit()
    dt = time.time() - t0
    total = con.execute("SELECT COUNT(*) FROM files").fetchone()[0]
    print(f"ingest: +{added} added, ~{updated} updated, "
          f"={unchanged} unchanged, !{skipped} skipped "
          f"in {dt:.2f}s  (corpus: {total} files)")


# ---------------------------------------------------------------- search

def fts_query(terms: str, any_mode: bool) -> str:
    toks = [t for t in terms.split() if t]
    quoted = ['"' + t.replace('"', '""') + '"' for t in toks]
    return (" OR " if any_mode else " ").join(quoted)


def cmd_search(args):
    con = connect()
    q = fts_query(args.query, args.any)
    if not q:
        sys.exit("error: empty query")
    t0 = time.time()
    sql = """
        SELECT f.path, f.title,
               snippet(docs, 0, '>>', '<<', ' … ', 18) AS snip,
               bm25(docs) AS score
        FROM docs JOIN files f ON f.id = docs.rowid
        WHERE docs MATCH ?
    """
    params = [q]
    if args.path_filter:
        sql += " AND f.path LIKE ? "
        params.append(f"%{args.path_filter}%")
    sql += " ORDER BY score LIMIT ?"
    params.append(args.n)
    try:
        rows = con.execute(sql, params).fetchall()
    except sqlite3.OperationalError as e:
        sys.exit(f"error: bad query ({e})")
    dt = (time.time() - t0) * 1000

    if not rows:
        print(f"no results ({dt:.0f} ms)")
        return
    for i, (path, title, snip, score) in enumerate(rows, 1):
        snip = " ".join(snip.split())
        print(f"{i:2}. [{-score:6.2f}] {title}")
        print(f"    {path}")
        print(f"    {snip}")
    print(f"\n{len(rows)} result(s) in {dt:.0f} ms")


# ---------------------------------------------------------------- stats

def cmd_stats(_args):
    con = connect()
    files, words, size = con.execute(
        "SELECT COUNT(*), COALESCE(SUM(words),0), COALESCE(SUM(size),0) "
        "FROM files").fetchone()
    last = con.execute("SELECT MAX(ingested_at) FROM files").fetchone()[0]
    last_s = time.strftime("%Y-%m-%d %H:%M", time.localtime(last)) if last else "never"
    print(f"db:     {db_path()}")
    print(f"files:  {files}")
    print(f"words:  {words:,}")
    print(f"size:   {size/1024/1024:.1f} MB")
    print(f"last:   {last_s}")


def cmd_recent(args):
    con = connect()
    rows = con.execute(
        "SELECT title, path, ingested_at FROM files "
        "ORDER BY ingested_at DESC LIMIT ?", (args.n,)).fetchall()
    for title, path, ts in rows:
        when = time.strftime("%Y-%m-%d %H:%M", time.localtime(ts))
        print(f"{when}  {title}\n          {path}")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(prog="pke",
                                 description="Personal Knowledge Engine v0.1")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("ingest", help="ingest files/folders into the index")
    p.add_argument("paths", nargs="+")
    p.add_argument("--ext", help="extra extensions, comma-separated")
    p.add_argument("--code", action="store_true", help="include code files")
    p.add_argument("--all-text", action="store_true",
                   help="ingest every non-binary file")
    p.set_defaults(fn=cmd_ingest)

    p = sub.add_parser("search", help="ranked full-text search")
    p.add_argument("query")
    p.add_argument("-n", type=int, default=10)
    p.add_argument("--any", action="store_true",
                   help="match ANY term (default: all terms)")
    p.add_argument("--path-filter", help="only paths containing this substring")
    p.set_defaults(fn=cmd_search)

    p = sub.add_parser("stats", help="corpus statistics")
    p.set_defaults(fn=cmd_stats)

    p = sub.add_parser("recent", help="recently ingested files")
    p.add_argument("-n", type=int, default=10)
    p.set_defaults(fn=cmd_recent)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
