# First Light — Witness Evaluation Pack v0.1

**Status:** `STAGED` — bound to send SHA `8d35a51df472102d64386bb8dfeef4070ae1ac0f` on `origin/main`.
**Audience:** you — a skeptical technical evaluator. This pack assumes you distrust AI demos by
default. Good.
**Time to verdict:** ~10 minutes. **Requirements:** Node.js ≥ 20, git, ~50 MB disk. **No install
step, no network after clone, no accounts, no telemetry, nothing phones home.**

---

## What we claim — exactly, and nothing more

One bounded AI-agent action on real files, with a cryptographic paper trail: a 10-file fixture
folder is reorganized (move-only), every byte accounted for, the undo executed and hash-verified
back to the exact before-state, the action re-applied, and the whole run sealed and replayable by a
fresh process. Measured values at the pinned commit:

```
status                      SEALED
source_loss                 0
content_hash_changes        0
undo_success_pct            100
restored_hash               == before_manifest_hash   (exact restoration)
anchor                      enforced, stored OUTSIDE the leased scope
authority_delta             0
```

## Quick start

```bash
git clone https://github.com/BizraInfo/Dema.git && cd Dema
git checkout 8d35a51df472102d64386bb8dfeef4070ae1ac0f
git rev-parse HEAD    # must print 8d35a51df472102d64386bb8dfeef4070ae1ac0f

node --test tests/first-light-mission.test.js          # expect: 8 tests, 8 pass
node scripts/proof/first-light-mission.mjs /tmp/fl-run-1   # any empty dir you choose
```

There is **no install step**. The root package declares zero dependencies and zero
devDependencies, has no lockfile and no workspaces — nothing to fetch, nothing to trust. Verify it
yourself in one line:

```bash
node -e 'const p=require("./package.json");console.log(Object.keys(p.dependencies||{}).length,Object.keys(p.devDependencies||{}).length)'   # → 0 0
```

The harness writes **only** inside the work dir you name (plus its anchor dir). Move-only — it
cannot delete or overwrite content, and the run itself proves the undo.

## The witness contract — what to compare

Two values are **content-bound**: identical on your machine, our machine, any directory. These are
the numbers that make or break the claim:

```
before_manifest_hash  403db0b4b5d97b53e9a3836c49749f86d2965bcd7d81f3d989782c779cfd2202
after_manifest_hash   89eb646f08b7f56c9ac173a9e83d0b4999429372ea14cfc871e3936ba3f0265b
```

One value is deliberately **not** part of the cross-machine contract: `seal_head` binds the absolute
scope and anchor paths, so it is stable for a fixed directory but *legitimately different* on your
machine. That is by design — the seal attests where the anchor actually lived. You verify it locally
instead: the output's `replay` block must show `seal_head_matches: true` and
`world_state_matches: true` (a fresh reader recomputing everything). Test FL-07 in the suite pins
this split in both directions — run it, don't take our word.

## On the 13 advisories GitHub shows

You will see *"13 vulnerabilities (7 high, 6 moderate)"* on the repository page. We name it rather
than let you find it.

**Exactly one manifest in this repository declares any dependency:**
`packages/dema-ui/package.json` — a web UI with 60 packages (51 runtime, 9 dev: Prisma, Radix) and
a 9,299-line lockfile. Every other manifest declares zero: root, `apps/cli`, and the test fixture.
There are no Python, Go, Ruby, Docker, or Cargo manifests at all. The five GitHub Actions workflows
use only first-party actions, each pinned to a full commit SHA.

`packages/dema-ui` is **not on the First Light path**. Reproducing this proof installs nothing and
touches none of that tree — the one-line check above prints `0 0` for the package you actually run,
and you can confirm the rest yourself:

```bash
node -e '
const fs=require("fs"),path=require("path");
const skip=new Set(["node_modules",".next",".claude",".git"]);
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){
  if(skip.has(e.name))continue;
  const p=path.join(d,e.name);
  if(e.isDirectory())walk(p);
  else if(e.name==="package.json"){const j=JSON.parse(fs.readFileSync(p,"utf8"));
    console.log(Object.keys(j.dependencies||{}).length+Object.keys(j.devDependencies||{}).length,p);}
}})(".");
'
```

Expected output — one non-zero line:

```
0  apps/cli/package.json
0  package.json
60 packages/dema-ui/package.json
0  tests/fixtures/node0-mumu-assets/proj/package.json
```

We have not independently enumerated which manifest each of the 13 alerts is filed against — the
Dependabot alert API is not readable from our verification environment. What is verified is the
dependency surface above. If you can see the alert list and find one filed against anything other
than `packages/dema-ui`, that is a documentation error on our side and we want the report.

## What this does NOT prove

One folder. Ten files. Move-only. It does not prove: system-level autonomy or "Node0 closure" · any
live federation, token, or reward mechanism (none exist; economics are gated behind verification
that has not happened) · durability of the anchor store · semantic quality of the organization ·
behavior at scale. The full boundary ledger is `docs/CURRENT_LIMITS.md` — the honesty map is part of
the product.

## Full suite (optional, ~25 s)

```bash
npm test
```

At `2272cdd` — one commit before the send SHA, on our reference machine (Bizra-Node0):
**8,397 tests · 427 suites · 8,397 pass · 0 fail · 0 skipped · 0 todo · 0 cancelled**, G8 gate
exit 0.

At the send SHA `8d35a51` the suite was re-run after a documentation-only commit: **0 failures,
0 not-ok lines, G8 exit 0**. The exact counts were not captured in that run's output, so we bind
the six figures to `2272cdd` and the zero-failure result to `8d35a51` rather than assert numbers
nobody recorded.

We publish this **bound to a SHA and a machine** — never as "the suite is green." One clean run on
one box is not a property of the software. An earlier sealed measurement recorded 6 failures and
3 skips; every one was environmental (a sandbox uid with no passwd entry, `EROFS` under a read-only
`HOME`) and they cleared on a machine with working git and a writable `HOME`. That record is kept
**unedited** at `docs/gtm/AI_ACT_FIRST_LIGHT_EVIDENCE_FREEZE.md` §3; the newer measurement is §3.1.
Both are kept because the delta reconciles: `tests +9` from one slice, `pass +18` — those 9 plus the
6 failures and 3 skips that cleared. No test was deleted or disabled.

If your environment is constrained you may still hit those two classes; they are documented in
`scripts/ci/classify-known-harness-failures.mjs` and seeing them is expected, not a defect. **A
failure outside them is signal** — send us the TAP line. A valid counterexample outranks our claims;
that rule is written into the repo's gates.

## If something breaks

Different manifest hash → you found a real problem; send the JSON output, we treat it as P0 and say
so publicly. Different `seal_head` → expected across machines (see contract above). Node < 20 →
upgrade; the `engines` field enforces it. Anything unclear → reply to the send email; a 30-minute
screen-share sit-along is on offer, your schedule.

## Why you, and what we're asking

Not a signature, not praise, not a retweet. One of: a line saying the hashes matched, the JSON
receipt of your run, or the counterexample that breaks it. Whichever you send becomes part of the
public record — including the third one.

*Every claim in this pack is bound to `8d35a51df472102d64386bb8dfeef4070ae1ac0f`; the pack is
invalid for any other commit.*
