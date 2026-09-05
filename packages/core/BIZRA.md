# Dema Core Context Delta

This subtree narrows the Dema repository contract for pure core kernels.

<!-- BIZRA_CONTEXT
{"schema":"bizra.context.contract.v2","scope":"subtree","context_id":"bizra://node0/dema/packages-core","parent_context_id":"bizra://node0/dema","authority":{"capabilities":{"runtime":{"default":"DENY","grantability":"NEVER"},"model_invocation":{"default":"DENY","grantability":"NEVER"},"external_write":{"default":"DENY","grantability":"NEVER"},"signing":{"default":"DENY","grantability":"NEVER"}},"network":{"default":"NONE","max_grantable":"NONE"},"never_delegable":["self_expand_authority","fabricate_consent"]},"rules":{"context_inherited":true,"authority_human_granted":true,"evidence_observed":true,"memory_derived":true,"tool_projection_only":true},"required_mission_for":["write","runtime","external"],"invariants":["pure-kernel-no-io","pure-kernel-has-verifier","tests-cover-boundary-false-and-forgery"]}
-->

## Core delta

Core kernels resolve caller-supplied data only. They do not read the
filesystem, environment, clock, process table, network, model provider, or
runtime. I/O belongs in read-only gatherers or CLI adapters. Each decision
kernel needs an independent re-derivation path and tests for boundary-false and
forged-clean inputs.
