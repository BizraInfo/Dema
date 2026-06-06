# H7.6 — SPROUT proof pin (operator-local)

**Dubai (GST, UTC+4):** Wednesday, 6 May 2026 — proof captured in this session.

**Captured:** 2026-05-06 (session); **machine:** `Linux Bizra-Node0` · **Dema root:** `/home/bizra-operating-system/Downloads/Dema` · **DEMA_HOME:** `~/.dema` (expanded below).

---

## Publication claim (true only)

With **`bizra-cognition-gateway`** reachable at **`http://127.0.0.1:7421`**, Dema’s **`gateway-http`** adapter returns **`bizra.dema.node0_status.v0.2`** with **`source: "gateway-http-composed"`**, **`truth_label: "MEASURED_PARTIAL"`**, **`ready: false`** (per adapter contract), **`consoleReady: true`**, **`rustBus.ready: true`**, and **`chain.length: 8`** with **`chain.head`** matching the gateway. **`dema receipts`** lists **`artifact-011.json`**; **`dema receipts ARTIFACT-011`** echoes that file with **`truth_label: "GATEWAY_ISSUED_HANDOFF"`**. The file **`/home/bizra-operating-system/.dema/receipts/artifact-011.json`** hashes to **`00000b6471ebe464285bf4f34c26dc2c42e0b3f5274df3fa94653854f4817424`** (SHA-256). With **no** `DEMA_NODE0_ADAPTER` / `DEMA_GATEWAY_URL`, Dema stays on the **default shellout stub**: **`activationGate: "BLOCKED"`**, **`consoleReady: false`** — the **safe default**.

**Not claimed here:** that Dema executed issuance (handoff file states issuance via **`POST /missions`**, not Dema runtime). **H7.5 verification path:** **`dema receipts`** + **`dema receipts ARTIFACT-011`**, not **`dema mission propose`**.

### Publication (voice — external-safe)

BIZRA Node0 produced its first governed gateway receipt.  
Dema can list and show it through the local handoff.  
No token, model, federation, or AGI claim.

**Binding (ZANN):** Issuance and chain advance occurred at **`bizra-cognition-gateway`** (`POST /missions` per handoff); Dema’s role here is **read/list** via **`~/.dema/receipts/artifact-011.json`** and **`gateway-http`** status — not runtime execution inside this repo.

---

## 1 — Gateway-enabled `status:json` (capture)

**Command:**

```bash
DEMA_NODE0_ADAPTER=gateway-http DEMA_GATEWAY_URL=http://127.0.0.1:7421 \
  node apps/cli/src/index.js status:json
```

**Capture (verbatim):**

```json
{
  "schema": "bizra.dema.node0_status.v0.2",
  "source": "gateway-http-composed",
  "truth_label": "MEASURED_PARTIAL",
  "node": "Node0",
  "human": null,
  "ready": false,
  "consoleReady": true,
  "activationGate": "EXPLICIT_GO_REQUIRED",
  "daemonStatus": "n/a-via-gateway",
  "missionExecuted": true,
  "runtimePulse": { "fired": false },
  "findings": [],
  "model": {
    "connected": false,
    "loadedModelIds": [],
    "tokenPresent": false,
    "_truth": "NOT_EXPOSED_BY_GATEWAY"
  },
  "rustBus": { "ready": true },
  "proof": {
    "latestChainHash": "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483",
    "nextArtifact": "ARTIFACT-011"
  },
  "nextAdmissibleAction": "bounded_diagnostic_activation",
  "gateway": {
    "reachable": true,
    "base_url": "http://127.0.0.1:7421",
    "domain": "bizra-cognition-gateway-v1",
    "health": "ok"
  },
  "chain": {
    "head": "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483",
    "length": 8,
    "latestTimestamp": 1778018491968479500
  },
  "poi": { "totalEntries": 0, "totalImpact": 0, "avgImpact": 0 },
  "resources": { "count": 0 },
  "unknown": [
    "lm_studio_status_not_exposed_by_gateway",
    "pyO3_bridge_status_not_exposed_by_gateway",
    "preferred_name_not_exposed_by_gateway",
    "rust_bus_health_inferred_from_gateway_uptime"
  ]
}
```

---

## 1a — Gateway-enabled human `status` (capture)

**Command:**

```bash
DEMA_NODE0_ADAPTER=gateway-http DEMA_GATEWAY_URL=http://127.0.0.1:7421 \
  node apps/cli/src/index.js status
```

**Capture (verbatim):**

```text
DEMA — Sovereign AI Node Companion

Node: Node0
Human: unknown
Ready: false
Console ready: true
Activation gate: EXPLICIT_GO_REQUIRED
Daemon: n/a-via-gateway
Mission executed: true
Runtime pulse fired: false
Model connected: false
Loaded models: none
Model token visible: false
Rust Bus: READY
Next artifact: ARTIFACT-011
Next action: bounded_diagnostic_activation

Findings: none

Boundary: no action without explicit consent.
```

---

## 2 — `dema receipts` (capture)

**Command:** `node apps/cli/src/index.js receipts`

**Capture:**

```json
[
  {
    "path": "/home/bizra-operating-system/.dema/receipts/artifact-011.json",
    "receipt_id": "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
    "artifact_id": "ARTIFACT-011",
    "action": "bounded_diagnostic_activation",
    "truth_label": "GATEWAY_ISSUED_HANDOFF",
    "created_at": "2026-05-06T12:00:00.000Z"
  }
]
```

---

## 3 — `dema receipts ARTIFACT-011` (capture)

**Command:** `node apps/cli/src/index.js receipts ARTIFACT-011`

**Capture (matches on-disk `artifact-011.json` at pin time):**

```json
{
  "schema": "bizra.dema.gateway_receipt_handoff.v0.1",
  "receipt_id": "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
  "artifact_id": "ARTIFACT-011",
  "action": "bounded_diagnostic_activation",
  "truth_label": "GATEWAY_ISSUED_HANDOFF",
  "created_at": "2026-05-06T12:00:00.000Z",
  "handoff_note": "Gateway sealed first mission; Dema-local mirror for listReceipts/readReceipt. Issuance occurred via POST /missions (not Dema runtime).",
  "gateway": {
    "base_url": "http://127.0.0.1:7421",
    "mission_id": "04273dc2427284446a5aa7ec6727d33c085bbe6396659602dad9ba05ffb9fe86",
    "receipt_id": "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
    "chain_head": "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483",
    "chain_length": 8,
    "admissibility_verdict": "Permit",
    "final_stage": "Replayability"
  },
  "proof_anchors": {
    "evidence_hash_niyyah_sha256": "659d822ba4cbaa61dac2d61008da0ed06f5c824a6208dc02f9b2b7fb2d5f8b27",
    "preview_json_sha256": "d7cc50207ea88004eafbc54e01225de46fcf8d4701114b78b3c36bbcfaaf9f0d",
    "ideal_state_hash_sha256": "24938181d3b2d4e85ca9abb924557857552e6493a6343b87a1e989abc10a6efe"
  },
  "preserved_post_request_body": {
    "intent": "ARTIFACT-011 — Dema-Led Node0 Hello World Receipt (Path A: receipt-only bounded diagnostic; no LLM; no model claim; no token claim; no federation claim; niyyah bound via evidenceHash).",
    "operatorSessionId": "72b86cb677d1e55d955e9eff16251f0b47301179c2041afb2d102314ee1569d4",
    "currentState": {
      "hash": "d7cc50207ea88004eafbc54e01225de46fcf8d4701114b78b3c36bbcfaaf9f0d",
      "summary": "Pre-issuance: Dema-led Hello World preview sealed (SHA-256 of preview JSON). Chain length 0.",
      "metric": 0
    },
    "idealState": {
      "hash": "24938181d3b2d4e85ca9abb924557857552e6493a6343b87a1e989abc10a6efe",
      "summary": "Post-issuance: first receipt sealed; chain head non-genesis; ARTIFACT-011 witness present.",
      "metric": 1
    },
    "evidenceHash": "659d822ba4cbaa61dac2d61008da0ed06f5c824a6208dc02f9b2b7fb2d5f8b27",
    "qualityScore": 0.98,
    "derivesFromCanonical": true,
    "faceOnly": false
  },
  "preserved_post_response_body": {
    "missionId": "04273dc2427284446a5aa7ec6727d33c085bbe6396659602dad9ba05ffb9fe86",
    "admissibility": {
      "verdict": "Permit",
      "gateVerdicts": [
        {
          "scorerId": "ZANN_ZERO",
          "invariant": "ZANN_ZERO",
          "verdict": "Permit",
          "reason": "Claim carries evidence binding",
          "score": 1
        },
        {
          "scorerId": "CLAIM_MUST_BIND",
          "invariant": "CLAIM_MUST_BIND",
          "verdict": "Permit",
          "reason": "Claim bound to evidence artifact",
          "score": 1
        },
        {
          "scorerId": "RIBA_ZERO",
          "invariant": "RIBA_ZERO",
          "verdict": "Permit",
          "reason": "No economic pattern present",
          "score": 1
        },
        {
          "scorerId": "NO_SHADOW_STATE",
          "invariant": "NO_SHADOW_STATE",
          "verdict": "Permit",
          "reason": "State mutation derives from canonical runtime",
          "score": 1
        },
        {
          "scorerId": "IHSAN_FLOOR",
          "invariant": "IHSAN_FLOOR",
          "verdict": "Permit",
          "reason": "Ihsan score 0.9800 ≥ floor 0.9500",
          "score": 0.98
        }
      ]
    },
    "receiptId": "1ae13ab609c3b88eebaeb177abac386e893ecc978ef39599ec5f537a6a1e964b",
    "finalStage": "Replayability",
    "chainHead": "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483"
  },
  "preserved_get_chain_after_post": {
    "head": "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483",
    "length": 8,
    "latestTimestamp": 1778018491968479587
  },
  "consent_phrase_record": "GO: Node0 bounded diagnostic activation only"
}
```

---

## 3a — Gateway `GET /chain` (capture)

**Command:** `curl -sS http://127.0.0.1:7421/chain`

**Capture (verbatim):**

```json
{
  "head": "9391e6fe08cb1671daa99eb28f3d574b06ea6c9c88736111436ccec89ad78483",
  "length": 8,
  "latestTimestamp": 1778018491968479587
}
```

---

## 4 — Handoff file hash

**File:** `/home/bizra-operating-system/.dema/receipts/artifact-011.json`

**SHA-256:**

```text
00000b6471ebe464285bf4f34c26dc2c42e0b3f5274df3fa94653854f4817424
```

**Command:** `sha256sum /home/bizra-operating-system/.dema/receipts/artifact-011.json`

---

## 5 — Default Dema (safe path) — contrast capture

**Command:**

```bash
env -u DEMA_NODE0_ADAPTER -u DEMA_GATEWAY_URL \
  node apps/cli/src/index.js status:json
```

**Head of capture (first fields):** `schema` **`bizra.dema.status.v0.1`**, **`ready: false`**, **`consoleReady: false`**, **`activationGate: "BLOCKED"`**, finding **`Node0 adapter not connected`**.

---

## Replayer

```bash
cd /home/bizra-operating-system/Downloads/Dema
sha256sum ~/.dema/receipts/artifact-011.json
curl -sS http://127.0.0.1:7421/chain
DEMA_NODE0_ADAPTER=gateway-http DEMA_GATEWAY_URL=http://127.0.0.1:7421 node apps/cli/src/index.js status
DEMA_NODE0_ADAPTER=gateway-http DEMA_GATEWAY_URL=http://127.0.0.1:7421 node apps/cli/src/index.js status:json
node apps/cli/src/index.js receipts
node apps/cli/src/index.js receipts ARTIFACT-011
env -u DEMA_NODE0_ADAPTER -u DEMA_GATEWAY_URL node apps/cli/src/index.js status:json | head -20
npm run check
```

---

`[SYNAPSE_MEMORY] h7.6_sprout_pin: file SPROUT_PIN.md + sha256 artifact-011 bound | verify_path: receipts_cli_not_mission_propose`
