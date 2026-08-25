# BIZRA Harness Blueprint v0.1

The **BIZRA Harness** is the replaceable runtime control shell that turns a durable Mission into bounded cognition and candidate actions. It shapes capability; it owns no sovereignty.

## Flow
Human/current mission
-> Mission Loader
-> Effective Configuration Resolver (MR)
-> Context Compiler + SNR Router
-> Instruction/Prompt Compiler
-> PAT / Agent Loop
-> typed candidate action
-> FATE pre-act gate
-> Wrapper/Capability Bus
-> Sandbox / effect adapter
-> Independent Observer
-> SAT / verifier
-> Receipt Sealer
-> Mission State / Recovery Manager
-> Verified Experience Exporter

## Required modules
Mission Loader; Effective Config Resolver; Context Compiler; Model Router; PAT Loop; FATE Bridge; Capability Bus; Observer; SAT Gateway; Receipt Sealer; Recovery Manager; Verified Experience Exporter; Telemetry.

## State split
Ephemeral: KV, temporary context/retries, private scratch.
Durable non-authoritative: operational event stream, diagnostics, candidate summaries.
Authoritative: mission/authority/receipt state only after required verification.

## Effective-config evidence
Record harness revision/digest, model/provider/revision/qualification, prompt hashes, context refs, memory refs, wrapper digests, sampler values+sources, compaction, routing/fallback, sandbox identity, retry policy, mission and authority ceiling.
