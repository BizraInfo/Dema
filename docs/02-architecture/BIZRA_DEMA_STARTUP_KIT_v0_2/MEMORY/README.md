# DEMA Durable Memory Slots v0.1

These files are durable restart aids. They are not self-authenticating authority.

Every load-bearing entry should carry:

- `truth_status`;
- `source_refs`;
- `verified_at`;
- `verification_path`;
- `contradictions` / `open_questions`.

At boot, current Git/runtime/disk/receipt evidence may supersede these records. Mark stale memory; never bend reality to fit it.
