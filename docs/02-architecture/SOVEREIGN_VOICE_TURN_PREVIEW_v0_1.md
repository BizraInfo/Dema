# SOVEREIGN-VOICE-TURN-PREVIEW-1A

Status: MEASURED_REPO
Schema: `bizra.dema.sovereign_voice_turn_preview.v0.1`

This is not live voice.

This is a preview-only voice-turn receipt. It binds caller-supplied transcript text, a Materialization Pulse E2E result, and a deterministic spoken-response plan.

Core law:

```text
The mouth may speak only what the Pulse has bounded.
Voice is expression, not authority.
```

## Chain

```text
caller-supplied transcript text
  -> NODE0-MATERIALIZATION-PULSE-E2E-PREVIEW result
  -> deterministic spoken-response plan
  -> voice-turn receipt
```

If the Pulse seals, the response may describe the sealed preview status. If the Pulse aborts, the response must be refusal or blocked-status language.

## Boundary

- No microphone.
- No STT.
- No TTS.
- No audio generation.
- No audio playback.
- No model invocation.
- No network.
- No real-world action.
- No mint.
- No wallet.
- No federation.
- `authority_delta: 0`.

The CLI adapter `dema voice turn <file>` reads one transcript text file read-only, runs the merged Pulse E2E preview over that text, and prints a response plan. The pure kernel imports only `node:crypto`.
