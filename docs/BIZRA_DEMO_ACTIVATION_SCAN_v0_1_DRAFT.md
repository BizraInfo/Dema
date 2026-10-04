# Dema Demo Activation Scan — 2026-07-28 05:45 GST

> `DECLARED_DRAFT`. Method: live execution of the Dema CLI in a review sandbox against
> the current working tree. Every `V` below was produced by running the command, not by
> reading code. Boundary: no operator `DEMA_HOME` written.
>
> **Re-verified 2026-07-28 on the operator machine** at `chore/backlog-init-agent-instructions`
> @ `9289574`. Every §2 probe re-ran green. Four claims were corrected in that pass and are
> marked `[corrected]` below — the §1 headline and the §3 script survived unchanged.

## 1. Headline

**The demo runs today. Nothing needs to be built.** The full consent → effect → receipt →
undo → proof loop executed end-to-end in this scan, on a zero-dependency CLI.

## 2. Live-verified surfaces (`V` — executed just now)

| Probe | Result |
| --- | --- |
| CLI boots with **no `node_modules`** | `V` — `node bin/dema --help` runs clean. Zero runtime deps. No install, no network, no wifi needed in the room. |
| CLI surface size | `V` `[corrected]` — **81 distinct top-level verbs / 163 distinct invocation lines** in `--help`. The earlier "104 commands" figure matched neither measure; say "80+ commands". |
| Consent refusal | `V` — `steward plan` without phrase → `ok:false`, `blocked_by:["consent_phrase_mismatch"]` |
| Consent acceptance | `V` `[corrected]` — exact phrase → `ok:true` + a `content_hash`. **Do not put this hash on a slide.** It is content-addressed over the job *including the absolute `sandbox_root`*, so it differs per machine and per path (`a1091d34…` in the first scan, `d9d94c10…` on re-verification). Point at the field, not the value. |
| Real reversible effect | `V` — `steward run` renamed `draft.txt` → `approved.txt` |
| Backup before mutation | `V` — `.node0-backups/draft.txt.<hash>.bak` written |
| Signed-shape receipt | `V` — `.node0-receipts.ndjson`: before/after hashes, measured post-state, backup hash |
| **Round-trip proof** | `V` — `steward verify`: `round_trip_ok:true`, `all_undone_proven:true`, `genesis_hash == final_hash` (`sha256:1aef6352…`). **This is the slide-safe hash** — taken over file *bytes*, not paths. Reproduced byte-identical across **three independent sandbox roots**; `content_hash` differed at all three. Path-sensitivity of `content_hash` and path-independence of `genesis_hash` were both confirmed by direct A/B (same bytes, different root), and repeat runs at one root are bit-identical — so the difference is the path, not a clock or nonce. |
| Boundary all-false | `V` — every result carries `network_used:false`, `token_minted:false`, `federation_live:false`, `model_invocation_performed:false` |
| Truth labels in output | `V` — `DEMA_REVERSIBLE_FILE_STEWARD_MEASURED_REPO` printed by the tool itself |

## 3. Ready-made demo commands (no new code)

```bash
# 0. sandbox — paste as-is. Heredoc is UNQUOTED so $HOME resolves. Nothing to substitute.
mkdir -p ~/demo/sandbox && printf 'draft\n' > ~/demo/sandbox/draft.txt
cat > ~/demo/job.json <<EOF
{"sandbox_root":"$HOME/demo/sandbox","atoms":[{"from":"draft.txt","to":"approved.txt"}]}
EOF
cat ~/demo/job.json   # confirm sandbox_root is a real absolute path before step 1

# 1. REFUSAL — the gate says no
dema steward plan --job ~/demo/job.json

# 2. CONSENT — exact phrase, plan eligible, content-hashed
dema steward plan --job ~/demo/job.json \
  --consent "GO: dema reversible file steward preview"

# 3. ROUND-TRIP PROOF — execute all, undo all, genesis hash restored
dema steward verify --job ~/demo/job.json \
  --consent "GO: execute reversible file steward job with backup and undo receipts"

# 4. THE RECEIPT — show the evidence on screen
cat ~/demo/sandbox/.node0-receipts.ndjson
ls -a ~/demo/sandbox/.node0-backups/
```

> **Why step 0 changed** `[corrected]`: the earlier `<<'EOF'` + `<ABSOLUTE PATH>` placeholder
> had to be hand-substituted. Pasted unsubstituted, **steps 1 and 2 still print exactly the
> expected refusal and consent output** — the break does not surface until step 3, the money
> shot, which then reads `round_trip_ok:false`, `reason:"sandbox_root_unreadable"`. Verified
> by pasting the old block verbatim into a throwaway `HOME`. The kernel **fails closed** — it
> never fakes a pass — but discovering that live is the wrong moment. The block above is now
> substitution-free and was executed verbatim end-to-end.
>
> The fail-closed behaviour is itself demo material: *"if the sandbox is wrong it refuses and
> tells you why — it does not print a green check."*

Supporting surfaces (all present, verify syntax before use): `dema receipts`,
`dema witness` / `witness verify`, `dema proof passport` / `verify --deep`,
`dema status`, `dema stand`, `dema doctor`, `dema demo node0-value-loop`.

## 4. What is NOT ready (say it before they ask)

| Gap | Status | Consequence for the room |
| --- | --- | --- |
| Real signer rotation (task-029 parent) | `In Progress` `[corrected]` — fixture slice sealed at `863b2ed`, but that commit is **not an ancestor of the demo `HEAD`**. It lives on `feat/authorship-rotation-transaction-1b` (separate worktree). | **Never claim a signature proves authorship to a third party.** Say: integrity is proven; authenticity binding is a slice **on a branch** — not "in this build". The tree you are demoing does not contain it. |
| `dema status` shows `Activation gate: BLOCKED`, "Node0 adapter not connected" | `V` — reproduced **on the operator machine**, not only in the review sandbox | **Cut `dema status` from the script.** Demo the steward loop instead. |
| Operator `DEMA_HOME` state (`~/.dema`) | `V` `[corrected]` — no longer `U`. `~/.dema` **exists** on the operator machine (29 dirs, incl. `keys/`); `DEMA_HOME` env is unset. With it present, `status` still prints `BLOCKED`. | The open question is closed — no rehearsal needed to decide. `status` is **out**. Its state does not affect the steward loop, which is sandbox-scoped. |
| PAT/SAT autonomy, URP, PoI, federation, Block0 | `DESIGNED_NOT_LIVE` / `PREVIEW_ONLY` | Named proudly as not live. |

## 5. Pre-meeting checklist (≤ 20 minutes)

1. Create the sandbox + `job.json` with an **absolute** `sandbox_root`.
2. Run steps 1–4 above once, on your laptop, exactly as scripted. Fix only syntax.
3. ~~Decide `dema status` in/out.~~ **Decided: out.** It prints `BLOCKED` on your machine.
4. Turn wifi **off** during rehearsal — prove to yourself it needs nothing.
5. Print six one-pagers + Third Fact PDF. Charge laptop.
6. If any hash is on a slide, make it `genesis_hash` — never `content_hash` (see §2).

## 6. What this scan does not prove

That the signer is rotated, or that any non-`MEASURED` surface works. On the operator's
real `DEMA_HOME` it proves the opposite of health: `status` reads `BLOCKED`, adapter not
connected. It proves one thing, by execution: **the consent → effect → receipt → undo →
proof loop is live on this machine today** — sandbox-scoped, and independent of the
blocked activation gate.
