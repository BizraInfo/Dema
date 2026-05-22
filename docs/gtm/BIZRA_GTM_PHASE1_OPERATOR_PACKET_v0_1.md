# BIZRA / Dema GTM Phase 1 Operator Packet v0.1

Status: Working operator packet
Date: 2026-05-22 GST
Scope: Phase 1 only - Ring-1 N=1 private reviewer activation
Change class: Documentation only; no outreach; no send; no runtime execution; no receipt mint; no URP initialization; no POI implementation

## 1. Purpose

This packet turns the Phase-1 GTM plan into an operator-safe checklist for the
single next external-witness action:

```text
Send the sealed Lighthouse Pack v1.0 to one real Ring-1 reviewer.
```

It does not replace the 90-day GTM plan. It only removes ambiguity around the
next private send, the evidence to record, and the gates that remain blocked
after the send.

## 2. Source authority

Read these before acting:

- [BIZRA_90_Day_GTM_v0_1.md](BIZRA_90_Day_GTM_v0_1.md) - strategic 90-day plan and gate sequence.
- [../LIGHTHOUSE.md](../LIGHTHOUSE.md) - private pilot operator contract.
- [../CLAIM_REGISTER_v0_1.md](../CLAIM_REGISTER_v0_1.md) - public-claim and forbidden-language gate.
- [../06-adr/ADR-009-poi-proof-of-impact-design.md](../06-adr/ADR-009-poi-proof-of-impact-design.md) - POI activation gates.
- [../BIZRA_THIRD_PARTY_EVALUATION_PACK_v0_1.md](../BIZRA_THIRD_PARTY_EVALUATION_PACK_v0_1.md) - reviewer-facing truth-bucket frame.

## 3. Current evidence

| Item | Evidence | Status |
|---|---|---|
| Dema audit HEAD | `004e887` | Current-state audit baseline (PR #93) |
| Test gate | `npm test` -> `2443/2443` | Verified by current GTM readiness gate |
| Proof room gate | `npm run proof:room` | Composed outsider-replay bundle (read-only; optional write under micro-consent) |
| Proof-forge chain | `.proof-forge/EVIDENCE_INDEX.json` -> `chain_length: 73` | Verified in v0.1.2 GTM audit |
| ADR-009 | `docs/06-adr/ADR-009-poi-proof-of-impact-design.md` | Accepted |
| ADR-014 | `docs/06-adr/ADR-014-three-runtime-architecture-canonization.md` | Accepted |
| ADR-013 | ADR file still says `Proposed` | Implementation verified; status-sync still open |
| Lighthouse Pack v1.0 | `~/Documents/bizra/lighthouse-pack-v1.0/` | Durable local copy |
| Pack manifest | `sha256sum -c MANIFEST.sha256` from pack directory | All 9 files verified in v0.1.2 audit |
| Issue #56 | GitHub issue state | Closed |
| Issues #57 and #58 | GitHub issue state | Open |

## 4. This packet does not authorize

- Sending the pack to anyone.
- Posting publicly about Lighthouse.
- Creating or minting a receipt.
- Starting runtime, daemon, federation, Node1, or Node2.
- Initializing URP.
- Implementing POI.
- Publishing reviewer identity or feedback.

Each of those remains blocked until its own exact-string consent gate and
evidence path are satisfied.

## 5. Current next operator decision

The next open GTM action is:

```text
GO send pack to <name>
```

Use the real recipient name or the operator's private alias in `<name>`. The
phrase authorizes only one private send to one named Ring-1 candidate through a
private channel. It does not authorize a public post, a batch send, or a follow-up
campaign.

If this exact phrase is not typed, no send has been authorized.

## 6. Pre-send checklist

Before typing the send phrase, the operator checks:

- One reviewer only; no parallel invitation batch.
- Reviewer is personally known or inside a trusted private path.
- Reviewer fits the profile in [../LIGHTHOUSE.md](../LIGHTHOUSE.md).
- The operator wants correction, not endorsement.
- The operator can answer technical questions within 24 hours for the next 3-7 days.
- The durable pack path exists: `~/Documents/bizra/lighthouse-pack-v1.0/`.
- Pack integrity verifies:

```bash
cd ~/Documents/bizra/lighthouse-pack-v1.0
sha256sum -c MANIFEST.sha256
```

- Local Dema env is clean:

```bash
cd ~/Downloads/Dema
npm run env-hygiene:strict
```

- Invitation copy is still bounded by the Lighthouse contract:

```bash
sed -n '1,220p' ~/Documents/bizra/lighthouse-pack-v1.0/08_INVITATION_DRAFT.md
```

## 7. Private send receipt shape

Reviewer identity is private by default. Record the real send receipt under
operator-local state, not in the public repo:

```text
~/.dema/lighthouse/ring-1/send-receipts/YYYY-MM-DD-ring1-001.md
```

Recommended fields:

```yaml
schema: bizra.dema.gtm.lighthouse_send_receipt.v0.1
truth_label: OPERATOR_RECORDED_PRIVATE_SEND
reviewer_alias: ring1-001
pack_version: v1.0
pack_path: ~/Documents/bizra/lighthouse-pack-v1.0/
manifest_command: sha256sum -c MANIFEST.sha256
manifest_result: all_files_ok
send_channel: private_email_or_private_message_or_usb
sent_at_local: recorded_by_operator
consent_phrase_typed: GO send pack to <name>
public_claim_made: false
batch_send: false
runtime_started: false
receipt_minted: false
```

The real reviewer name may live in the operator's private address book or private
notes. If a public repo artifact is later needed, use only `ring1-001` unless the
reviewer explicitly consents to being named.

`npm run gtm:readiness` now performs a read-only metadata scan of this directory
under `DEMA_HOME` or `~/.dema`. It counts `.md` send receipts but does not send,
mint, publish, or read feedback content.

## 8. Feedback record shape

The filled reviewer form remains private first:

```text
~/.dema/lighthouse/ring-1/feedback/ring1-001-2026-Q2.md
```

Public repo feedback is optional and anonymized:

```text
docs/lighthouse/feedback/RING1-001-2026-Q2.md
```

Only create the public version if the reviewer consents to repo inclusion or if
the content is redacted enough to protect identity, private context, and channel
metadata.

`npm run gtm:readiness` also counts `.md` feedback documents in the private
feedback directory. It reports counts only; feedback content remains private to
the operator unless a later exact gate authorizes review or anonymized repo
inclusion.

## 9. Gate closure rules

POI Gate 1 closes only when all of these exist:

- A private send receipt for one Ring-1 reviewer.
- A filled feedback form from that reviewer.
- At least one finding classified as hold, fixable gap, or structural blocker.
- A written decision by Mumu on whether Phase 1 advances, repeats, or halts.

POI Gate 4 remains closed until the operator types:

```text
GO author POI v0.1 test plan (no impl)
```

That phrase authorizes a test-plan artifact only. It does not authorize POI
implementation, POI envelope writing, URP initialization, economic assignment, or
any mint.

This phrase is independent of the Ring-1 send. It may be issued before or after
reviewer feedback, but the resulting artifact remains a test plan only. POI
implementation still requires Gate 1 feedback closure plus the separate
`GO impl POI v0.1` halt gate.

## 10. Refusal conditions

Refuse or pause the send if any condition below holds:

- The candidate is not private or personally trusted.
- The invitation would create a public marketing artifact.
- The pack manifest fails.
- The operator cannot support the reviewer during the review window.
- The candidate expects token, reward, funding, employment, or public-status upside.
- The send would involve multiple candidates at once.
- The operator wants endorsement more than correction.

Refusal is not a GTM failure. It preserves the proof path.

## 11. Next exact phrases

Independent Phase-1 phrase:

```text
GO author POI v0.1 test plan (no impl)
```

That phrase is not implied by sending the pack.

These remain blocked until Ring-1 feedback evidence exists:

```text
GO author amendment ADR from <finding>
GO mint phase-1-close
GO phase-2 kick-off authorized
```

None of these phrases is implied by sending the pack. Each is its own halt gate.

---

End of Phase 1 operator packet.
