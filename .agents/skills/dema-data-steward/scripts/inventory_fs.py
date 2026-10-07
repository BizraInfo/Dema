#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import stat
from pathlib import Path
from datetime import datetime, timezone


def sha256_file(path, chunk=1024 * 1024):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            b = f.read(chunk)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def walk(root: Path, hash_content: bool, max_files: int | None):
    root = root.resolve()
    stack = [root]
    seen_files = 0
    entries = []
    errors = []
    while stack:
        current = stack.pop()
        try:
            items = sorted(os.scandir(current), key=lambda e: e.name)
        except Exception as e:
            errors.append({'path': str(current.relative_to(root)) if current != root else '.', 'error': f'{type(e).__name__}:{e}'})
            continue
        dirs = []
        for entry in items:
            p = Path(entry.path)
            rel = str(p.relative_to(root))
            try:
                st = entry.stat(follow_symlinks=False)
                mode = stat.S_IMODE(st.st_mode)
                if entry.is_symlink():
                    rec = {
                        'path': rel, 'type': 'symlink', 'bytes': 0,
                        'mtime_ns': st.st_mtime_ns, 'mode': oct(mode),
                        'inode': st.st_ino, 'device': st.st_dev,
                        'symlink_target': os.readlink(entry.path),
                    }
                elif entry.is_dir(follow_symlinks=False):
                    rec = {
                        'path': rel, 'type': 'dir', 'bytes': 0,
                        'mtime_ns': st.st_mtime_ns, 'mode': oct(mode),
                        'inode': st.st_ino, 'device': st.st_dev,
                    }
                    dirs.append(p)
                elif entry.is_file(follow_symlinks=False):
                    rec = {
                        'path': rel, 'type': 'file', 'bytes': st.st_size,
                        'mtime_ns': st.st_mtime_ns, 'mode': oct(mode),
                        'inode': st.st_ino, 'device': st.st_dev,
                    }
                    if hash_content:
                        try:
                            rec['sha256'] = sha256_file(entry.path)
                        except Exception as e:
                            rec['hash_error'] = f'{type(e).__name__}:{e}'
                    seen_files += 1
                else:
                    rec = {
                        'path': rel, 'type': 'other', 'bytes': 0,
                        'mtime_ns': st.st_mtime_ns, 'mode': oct(mode),
                        'inode': st.st_ino, 'device': st.st_dev,
                    }
                entries.append(rec)
            except Exception as e:
                errors.append({'path': rel, 'error': f'{type(e).__name__}:{e}'})
            if max_files and seen_files >= max_files:
                break
        if max_files and seen_files >= max_files:
            break
        for d in reversed(dirs):
            stack.append(d)
    entries.sort(key=lambda x: x['path'])
    return entries, errors


def main():
    ap = argparse.ArgumentParser(description='Deterministic metadata-first filesystem inventory for DEMA.')
    ap.add_argument('root')
    ap.add_argument('--outdir', required=True)
    ap.add_argument('--hash-content', action='store_true', help='Read file contents and compute SHA-256. Requires explicit content-read authority.')
    ap.add_argument('--max-files', type=int, default=None)
    args = ap.parse_args()

    root = Path(args.root)
    if not root.exists() or not root.is_dir():
        raise SystemExit(f'root_not_directory:{root}')
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    entries, errors = walk(root, args.hash_content, args.max_files)
    inv_path = outdir / 'inventory.jsonl'
    with inv_path.open('w', encoding='utf-8', newline='\n') as f:
        for rec in entries:
            f.write(json.dumps(rec, sort_keys=True, separators=(',', ':')) + '\n')

    counts = {}
    total_bytes = 0
    hashed = 0
    for rec in entries:
        counts[rec['type']] = counts.get(rec['type'], 0) + 1
        total_bytes += int(rec.get('bytes', 0) or 0)
        if rec.get('sha256'):
            hashed += 1

    inv_hash = sha256_file(inv_path)
    summary = {
        'schema': 'bizra.dema.fs_inventory.v0.1',
        'root': str(root.resolve()),
        'generated_utc': datetime.now(timezone.utc).isoformat(),
        'content_read_performed': bool(args.hash_content),
        'follow_symlinks': False,
        'max_files': args.max_files,
        'entry_count': len(entries),
        'counts': counts,
        'file_bytes': total_bytes,
        'hashed_file_count': hashed,
        'error_count': len(errors),
        'errors': errors,
        'inventory_sha256': inv_hash,
        'authority_delta': 0,
    }
    with (outdir / 'summary.json').open('w', encoding='utf-8') as f:
        json.dump(summary, f, sort_keys=True, indent=2)
        f.write('\n')
    print(json.dumps(summary, sort_keys=True))

if __name__ == '__main__':
    main()
