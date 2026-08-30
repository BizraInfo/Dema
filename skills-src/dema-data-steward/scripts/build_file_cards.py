#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path


def card_id(source_system, root_id, rec):
    body = {
        'source_system': source_system,
        'root_id': root_id,
        'path': rec.get('path'),
        'type': rec.get('type'),
        'bytes': rec.get('bytes'),
        'mtime_ns': rec.get('mtime_ns'),
        'sha256': rec.get('sha256'),
    }
    raw = json.dumps(body, sort_keys=True, separators=(',', ':')).encode()
    return 'filecard:' + hashlib.sha256(raw).hexdigest()


def main():
    ap = argparse.ArgumentParser(description='Build metadata-only File Cards from a DEMA inventory.')
    ap.add_argument('inventory_jsonl')
    ap.add_argument('--output', required=True)
    ap.add_argument('--source-system', default='local_fs')
    ap.add_argument('--root-id', required=True)
    args = ap.parse_args()

    cards = []
    with open(args.inventory_jsonl, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            rec = json.loads(line)
            card = {
                'schema': 'bizra.dema.file_card.v0.1',
                'file_id': card_id(args.source_system, args.root_id, rec),
                'source_system': args.source_system,
                'source_id': rec.get('path'),
                'root_id': args.root_id,
                'relative_path': rec.get('path'),
                'object_type': rec.get('type'),
                'bytes': rec.get('bytes', 0),
                'mtime_ns': rec.get('mtime_ns'),
                'mode': rec.get('mode'),
                'sha256': rec.get('sha256'),
                'content_read': bool(rec.get('sha256')),
                'logical_zone': 'UNCLASSIFIED',
                'epistemic_status': 'MEASURED_METADATA',
                'promotion_status': 'SOURCE_BOUND',
                'authority_delta': 0,
            }
            if rec.get('symlink_target') is not None:
                card['symlink_target'] = rec['symlink_target']
            cards.append(card)
    cards.sort(key=lambda c: c['relative_path'])
    with open(args.output, 'w', encoding='utf-8', newline='\n') as f:
        for c in cards:
            f.write(json.dumps(c, sort_keys=True, separators=(',', ':')) + '\n')
    print(json.dumps({'cards': len(cards), 'authority_delta': 0}, sort_keys=True))

if __name__ == '__main__':
    main()
