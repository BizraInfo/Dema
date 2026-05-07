# `_absorbed/` — historical inputs

Files in this directory are **historical**, not canonical. They were
inputs that informed Dema's bootstrap and v0.2 absorption work, and
they sat at the repo root for a while because that's where the
import landed. They are kept for provenance — so a reader curious
about "what did the early absorption look like?" can read the source
material — but they should not be cited as binding doctrine.

| File | Era | Note |
|---|---|---|
| `BIZRA_GENESIS_PROVENANCE_LEDGER_V0_1.md` | pre-bootstrap | Genesis provenance record from before the Dema repo split. |
| `DEMA_PRODUCT_CONSTITUTION_V0_1.md` | bootstrap | Pre-ADR product constitution. **Superseded** by `docs/DEMA_CONSTITUTION.md` and the binding ADRs in `docs/06-adr/`. |
| `DEMA_PRODUCT_REPO_BOOTSTRAP_V0_1.md` | bootstrap | Original repo bootstrap notes. |
| `DEMA_REPO_BOOTSTRAP_V0_2_SUMMARY.md` | v0.2 absorption | Summary of the v0.2 R1-doctrine import. **Superseded** by the actual landed code + ADRs + `docs/ENGINEERING_DISCIPLINE.md`. |
| `DEMA_SAFE_MONETIZATION_SKILL_V0_1.md` | bootstrap | Early "safe monetization" skill spec. The current safe-offer surface is `dema monetize` (one line in `apps/cli/src/index.js`). |
| `dema_product_repo_bootstrap_v0_1.zip` | bootstrap | Zip archive of the original bootstrap inputs. Kept for archeology, not for re-execution. |

## Authority hierarchy (which doc wins on a conflict)

When something in this directory disagrees with something else in
the repo, the binding order is (per `~/CLAUDE.md` user-scope canon
+ memory `reference_bizra_constitutional_anchors.md`):

1. Quran / Hadith
2. البذرة (`bizra.pdf`) / الرسالة (`themassage.pdf`)
3. `BIZRA_Third_Fact_v0_1_FINAL.pdf` (the public manifest)
4. `docs/02-architecture/` doctrine + `docs/06-adr/` ADRs
5. Repo invariants in root `CLAUDE.md`
6. Specs (`docs/PRIORITY_ANCHOR.md`, `docs/RECEIPTS.md`,
   `docs/INSTALLER_ARCHITECTURE.md`)
7. Code on disk
8. **`docs/_absorbed/` (this directory) — last in the chain.**

If a reader finds a conflict, the higher rung wins. These files are
preserved, not enforced.
