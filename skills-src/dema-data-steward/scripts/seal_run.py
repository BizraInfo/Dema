#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser(description='Seal a stewardship output directory with a hash manifest.')
    ap.add_argument('directory')
    ap.add_argument('--output', default='RUN_RECEIPT.json')
    ap.add_argument('--run-id', required=True)
    args = ap.parse_args()

    root = Path(args.directory).resolve()
    out_path = root / args.output
    files = []
    for p in sorted(root.rglob('*')):
        if not p.is_file() or p.resolve() == out_path.resolve():
            continue
        rel = str(p.relative_to(root))
        files.append({'path': rel, 'bytes': p.stat().st_size, 'sha256': sha256_file(p)})
    body = {
        'schema': 'bizra.dema.data_steward_receipt.v0.1',
        'run_id': args.run_id,
        'generated_utc': datetime.now(timezone.utc).isoformat(),
        'root': str(root),
        'files': files,
        'mutation_performed': False,
        'authority_delta': 0,
    }
    canonical = json.dumps(body, sort_keys=True, separators=(',', ':')).encode()
    receipt = dict(body)
    receipt['receipt_sha256'] = hashlib.sha256(canonical).hexdigest()
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(receipt, f, sort_keys=True, indent=2)
        f.write('\n')
    print(json.dumps({'receipt': str(out_path), 'receipt_sha256': receipt['receipt_sha256'], 'files': len(files)}, sort_keys=True))

if __name__ == '__main__':
    main()
