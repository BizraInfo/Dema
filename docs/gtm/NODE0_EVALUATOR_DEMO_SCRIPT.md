# Node0 evaluator demo script (G0 Witness)

Truth: `PRE_TOKEN_LOCAL_PROOF` · preview-only. No federation, token, or URP claim.

## Path (fresh clone)

```bash
git clone https://github.com/BizraInfo/Dema
cd Dema
node bin/dema welcome
node bin/dema setup
node bin/dema status
node bin/dema doctor
node bin/dema demo node0-value-loop
```

Optional alias: `alias dema='node bin/dema'`

## What the stranger should see

1. **Welcome** — local-first / consent-bound / allowed vs blocked.
2. **Setup / status / doctor** — readiness without a daemon.
3. **Demo story** — situation → what Node0 did → what changed, with counters bound to the kernel.
4. **UI** — open Dema UI `/demo` (same story via `/api/demo/node0-value-loop`).

## Receipt / proof close

```bash
node bin/dema demo node0-value-loop --json
node bin/dema demo node0-value-loop convergence --json
```

Do not claim live mission execution, federation, or economic surfaces.
