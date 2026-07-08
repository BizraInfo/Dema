# SOVEREIGN-VOICE-TURN-PREVIEW-1A Receipt

Schema: `bizra.dema.sovereign_voice_turn_preview.v0.1`
Truth label: `SOVEREIGN_VOICE_TURN_PREVIEW_MEASURED_REPO`

## Proven

- Transcript text can be bound to a Pulse E2E result.
- A sealed Pulse can produce a bounded spoken-response plan.
- An aborted Pulse can produce a refusal/status spoken-response plan.
- Audio/STT/TTS laundering is rejected.
- Microphone/model/network laundering is rejected.
- Authority/action/mint/wallet/federation laundering is rejected.
- Boundary flips are rejected.

## Not Proven

- No live speech recognition.
- No live speech synthesis.
- No audio generated.
- No audio played.
- No model invoked.
- No real-world action executed.
- No live URP, token, wallet, or federation.

## Smoke

```bash
node --test tests/sovereign-voice-turn-preview.test.js
node --test tests/sovereign-voice-turn-preview-cli.test.js
node scripts/review/sovereign-voice-turn-preview-check.mjs
node scripts/review/sovereign-voice-turn-preview-check.mjs --json
```
