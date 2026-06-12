# BIZRA Seed Realm TUI Spec v0.1

[DECLARED] Status: design canon and implementation contract, not a live runtime claim.

[DECLARED] Scope: translate the Seed Realm HTML prototype into an offline-first Dema terminal experience that can later be implemented inside the existing `dema realm` surface.

[DECLARED] Boundary: this document does not claim real filesystem scanning beyond existing local-asset inventory flows, does not claim live agents, does not claim live economy, does not claim federation, and does not claim any monetary reward.

---

## 1. One-sentence product law

Dema opens a private BIZRA realm where the operator's scattered local work becomes one consent-bound quest, every action is guarded by truth gates, and every completed step ends as replayable proof.

---

## 2. Source prototype readout

[DECLARED] The browser prototype proves the emotional direction: Minecraft-like realm building, MMO-like quests and party roles, Islamic-finance-inspired ethical economy panels, and BIZRA proof discipline.

[DECLARED] The prototype is not an implementation target as-is because it uses browser-only and network-dependent assets: Tailwind CDN, Google Fonts, Lucide CDN, SDK scripts, DOM state, canvas animation, and inline JavaScript.

[DECLARED] The Dema implementation target is a deterministic TUI/CLI render with no external CDN, no browser runtime, no network access, and no hidden mutation.

---

## 3. UX formula

```text
BUILD -> QUEST -> CONSENT -> PROVE -> GROW
```

[DECLARED] The user should experience BIZRA as a playable realm without becoming an addictive game loop. Every game mechanic must correspond to an ethical real-world function.

| Game metaphor | BIZRA function | Ethical constraint |
| --- | --- | --- |
| Realm | Local operator workspace | Local-first, private by default |
| Blocks | Files, docs, receipts, code artifacts | Metadata-only until consent |
| Quest | One bounded mission | Exact scope and next safe action |
| Party | PAT service roles | Agents serve the human, not ego |
| Guardians | SAT/FATE checks | Truth over desire |
| Crafting | Evidence + work -> proof artifact | No unverified value |
| Treasury | Value-readiness panel | No riba, no maysir, no gharar, no live economic claim |
| Zakat/Waqf | Purification and commons contribution | Preview-only until external validation |
| Growth tree | Verified learning path | No pay-to-win status |

---

## 4. Minimal solvable special case

The first implementation MUST be only five screens:

```text
Boot -> Realm -> Quest -> Consent -> Proof
```

Everything else is deferred.

Deferred screens:

```text
World Map
Party
Craft
Treasury
Zakat
Guilds
Raid
Growth Tree
Truth Overlay expansion
```

Reason: the first shippable loop must prove the Seed Realm pattern without expanding the risk surface.

---

## 5. Screen contracts

### 5.1 Boot

Purpose: establish covenant, local boundary, and emotional identity.

Required content:

```text
BIZRA Seed Realm
Dema: awake
Node: Genesis Node0
Mode: local sovereign
Private data: untouched
Economy: locked until proven
Proof: receipt-backed when available
```

Required boundary:

```yaml
file_content_read: false
network_used: false
mutation_performed: false
economic_action_performed: false
federation_used: false
```

### 5.2 Realm

Purpose: compress node state into one honest next step.

Required panels:

```text
Realm
Active Quest
Guardians
World Regions summary
Dema recommendation
```

Required recommendation law:

```text
Recommend exactly one next safe action.
```

### 5.3 Quest

Purpose: turn state into a bounded mission.

Quest fields:

```yaml
id: string
title: string
kind: main | side | maintenance
impact: low | medium | high | very_high
risk: low | medium | high
proof_path: absent | partial | clear
status: ready | blocked | active | done
blocked_reason: string | null
```

Forbidden fields in v0.1:

```yaml
live_token_reward: forbidden
cash_value: forbidden
external_network_claim: forbidden
production_claim: forbidden
```

### 5.4 Consent

Purpose: convert quest into exact operator permission.

Consent phrase pattern:

```text
GO: START SEED REALM QUEST <quest_id> <decision_hash>
```

Consent screen MUST show:

```text
I WILL
I WILL NOT
Decision hash
Exact phrase
No action until exact match
```

### 5.5 Proof

Purpose: end with proof, not dopamine.

Proof result fields:

```yaml
verdict: VERIFIED | TAMPERED | ABSENT | REFUSED | PREVIEW_ONLY
receipts: number
replay: PASS | FAIL | NOT_RUN
private_content_read: false
network_used: false
token_minted: false
federation_used: false
next_safe_action: string
```

---

## 6. Truth overlay contract

Truth Mode is mandatory.

Keyboard:

```text
T toggles Truth Mode.
```

Truth Mode must reveal:

```yaml
surface_status: DECLARED | MEASURED | VERIFIED | DESIGNED | PREVIEW_ONLY
what_is_real: string[]
what_is_not_real: string[]
claim_register_binding: string | null
next_verification_path: string
```

Minimum Truth Mode copy:

```text
This realm is a local Dema interface surface.
No live economy is active.
No federation is active.
No private content is read without explicit consent.
Claims must trace to the claim register.
```

---

## 7. Data binding plan

v0.1 should use existing Dema primitives where possible:

| TUI concept | Existing source candidate |
| --- | --- |
| Realm state | `gatherDemaRealmState()` |
| Quest board | `gatherDemaRealmBoard()` |
| World map | `gatherDemaRealmWorldMap()` |
| Council | `gatherDemaRealmCouncil()` |
| Status | `gatherDemaRealmStatus()` |
| Checkpoint | `gatherDemaRealmCheckpoint()` |
| Local asset scan | `writeLocalAssetInventory()` |
| Proof boundary | Node0/Mumu status and verify surfaces |
| Claim boundary | `docs/claims/node0-claim-register.v0.1.json` |

[DECLARED] The first Seed Realm TUI should aggregate existing read-only surfaces before adding new runtime behavior.

---

## 8. Implementation target

Preferred command:

```bash
dema realm seed [--json] [--no-color]
```

Alternative later alias:

```bash
dema enter
```

v0.1 files:

```text
packages/core/src/seed-realm-tui.js
tests/seed-realm-tui.test.js
```

Optional later files:

```text
packages/core/src/seed-realm-quests.js
packages/core/src/seed-realm-proof.js
packages/core/src/seed-realm-truth-mode.js
```

---

## 9. Render constraints

The TUI renderer MUST be:

```yaml
deterministic: true
offline_first: true
external_cdn: false
browser_required: false
network_used: false
ansi_optional: true
json_mode_supported: true
no_color_supported: true
screens_have_truth_label: true
```

The renderer MUST NOT:

```yaml
start_daemon: true
read_private_content: true
invoke_model: true
mint_token: true
connect_wallet: true
activate_federation: true
claim_production: true
```

---

## 10. Ihsan design rules

1. Meaning before mechanism.
2. Consent before action.
3. Proof before claim.
4. Claim register before public story.
5. Economy after verified value, not before.
6. Calm guidance over addictive stimulation.
7. SAT guards truth; PAT serves the operator; Dema explains the boundary.

---

## 11. Acceptance criteria

A Seed Realm TUI v0.1 PR passes only if:

```yaml
boot_screen_exists: true
realm_screen_exists: true
quest_screen_exists: true
consent_screen_exists: true
proof_screen_exists: true
json_mode_exists: true
no_color_mode_exists: true
truth_mode_declares_boundaries: true
no_network_dependency: true
no_browser_dependency: true
claim_register_boundaries_visible: true
all_live_economy_language_blocked: true
all_federation_language_blocked: true
real_operator_claim_not_made: true
```

Recommended tests:

```text
- renders Boot/Realm/Quest/Consent/Proof in deterministic order
- JSON output has schema `bizra.dema.seed_realm_tui.v0.1`
- no-color output contains no ANSI escape sequences
- economy fields are blocked/preview only
- federation fields are blocked/local only
- consent phrase mismatch produces no action state
- proof screen cannot show VERIFIED unless a proof input is provided
```

---

## 12. Spear point

The hidden product primitive is not a game UI.

It is a sovereign proof cockpit with a game-shaped mental model.

```text
No realm grows faster than its receipts.
No quest completes without consent.
No value appears before proof.
No public story outruns the claim register.
```
