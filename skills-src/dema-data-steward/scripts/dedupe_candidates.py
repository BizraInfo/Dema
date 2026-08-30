#!/usr/bin/env python3
import argparse
import json
from collections import defaultdict
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(description='Classify exact duplicate groups and hash-required candidates from a DEMA inventory.')
    ap.add_argument('inventory_jsonl')
    ap.add_argument('--output', required=True)
    args = ap.parse_args()

    by_hash = defaultdict(list)
    by_size = defaultdict(list)
    total_files = 0
    with open(args.inventory_jsonl, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            rec = json.loads(line)
            if rec.get('type') != 'file':
                continue
            total_files += 1
            size = int(rec.get('bytes', 0) or 0)
            if size <= 0:
                continue
            if rec.get('sha256'):
                by_hash[(rec['sha256'], size)].append(rec['path'])
            else:
                by_size[size].append(rec['path'])

    exact = []
    for (digest, size), paths in sorted(by_hash.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        if len(paths) > 1:
            exact.append({'status': 'EXACT_HASH_MATCH', 'sha256': digest, 'bytes': size, 'paths': sorted(paths)})

    needs_hash = []
    for size, paths in sorted(by_size.items()):
        if len(paths) > 1:
            needs_hash.append({'status': 'HASH_REQUIRED', 'bytes': size, 'paths': sorted(paths)})

    out = {
        'schema': 'bizra.dema.dedupe_plan.v0.1',
        'input': str(Path(args.inventory_jsonl).resolve()),
        'file_count': total_files,
        'exact_duplicate_groups': exact,
        'hash_required_groups': needs_hash,
        'law': 'same_size_is_candidate_only; exact_duplicate_requires_full_content_sha256_equality',
        'delete_authority': False,
        'authority_delta': 0,
    }
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(out, f, sort_keys=True, indent=2)
        f.write('\n')
    print(json.dumps({'exact_groups': len(exact), 'hash_required_groups': len(needs_hash), 'authority_delta': 0}, sort_keys=True))

if __name__ == '__main__':
    main()
