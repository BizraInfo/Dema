# Design Decisions

**DD-01 — Postgres over SQLite.**
We chose Postgres because benchmarks showed roughly 4x write throughput at depot
load. (Benchmark not attached; run by the previous contractor.)

**DD-02 — Offline-first sync.**
Depot links drop. Local-first with a merge on reconnect.

**DD-03 — No photo capture.**
Storage on the handhelds is 8 GB and mostly full.

**DD-04 — Single shared supervisor account per depot.**
Faster for shift changes. Security flagged this later; see the security review.

**DD-05 — Vendor SDK for barcode scanning.**
Industry standard, and the evaluation rated it highest.
