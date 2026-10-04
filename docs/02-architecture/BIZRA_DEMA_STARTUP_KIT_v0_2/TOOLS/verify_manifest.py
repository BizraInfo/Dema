#!/usr/bin/env python3
import hashlib, json, pathlib, sys
root = pathlib.Path(__file__).resolve().parents[1]
manifest_path = root / "MANIFEST.json"
if not manifest_path.exists():
    print("MANIFEST_MISSING")
    raise SystemExit(2)
data = json.loads(manifest_path.read_text(encoding="utf-8"))
errors = []
seen = set()
for item in data.get("files", []):
    rel = item.get("path")
    if not rel or rel in seen:
        errors.append(f"bad_or_duplicate_path:{rel}")
        continue
    seen.add(rel)
    p = root / rel
    if not p.is_file():
        errors.append(f"missing:{rel}")
        continue
    raw = p.read_bytes()
    got = hashlib.sha256(raw).hexdigest()
    if got != item.get("sha256"):
        errors.append(f"hash_mismatch:{rel}:{got}")
    if len(raw) != item.get("bytes"):
        errors.append(f"size_mismatch:{rel}:{len(raw)}")
actual = {
    str(p.relative_to(root))
    for p in root.rglob("*")
    if p.is_file() and p.name != "MANIFEST.json"
}
missing_from_manifest = sorted(actual - seen)
extra_in_manifest = sorted(seen - actual)
errors.extend(f"unmanifested:{x}" for x in missing_from_manifest)
errors.extend(f"manifest_path_absent:{x}" for x in extra_in_manifest)
if data.get("authority_delta") != 0:
    errors.append("authority_delta_not_zero")
if errors:
    print("MANIFEST_FAIL")
    for e in errors:
        print(e)
    raise SystemExit(1)
print(f"MANIFEST_PASS files={len(seen)} package={data.get('package')} status={data.get('status')}")
