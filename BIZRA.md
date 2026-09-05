# Dema BIZRA Context

This repository is the Dema product face inside the BIZRA node. It is a
repository contract, not a runtime activation claim.

<!-- BIZRA_CONTEXT
{"schema":"bizra.context.contract.v2","scope":"repository","context_id":"bizra://node0/dema","parent_context_id":"bizra://node0","authority":{"capabilities":{"runtime":{"default":"DENY","grantability":"NEVER"},"model_invocation":{"default":"DENY","grantability":"HUMAN_EXPLICIT"},"external_write":{"default":"DENY","grantability":"HUMAN_EXPLICIT"},"signing":{"default":"DENY","grantability":"NEVER"}},"network":{"default":"NONE","max_grantable":"NONE"},"never_delegable":["self_expand_authority","fabricate_consent"]},"rules":{"context_inherited":true,"authority_human_granted":true,"evidence_observed":true,"memory_derived":true,"tool_projection_only":true},"required_mission_for":["write","runtime","external"],"invariants":["dema-is-the-face","no-runtime-execution-in-this-repo","no-hidden-daemon","exact-string-consent-only","local-state-under-dema-home","receipts-read-list-here","node1-node2-preview-only"]}
-->

## Repository boundaries

- Dema is the face, not the whole system.
- No runtime execution or hidden daemon belongs in this repository.
- Exact-string consent remains the only consent surface.
- Local state stays under `DEMA_HOME` or `~/.dema`.
- Dema reads and lists receipts; governed runtime issues them.
- Node1, Node2, federation, token, wallet, and PoI surfaces remain preview-only
  until their proof gates pass.

The model-facing execution flow is
[docs/LLM_SYSTEM_FLOW.md](docs/LLM_SYSTEM_FLOW.md). Existing pure kernels,
read-only gatherers, CLI wrappers, event logs, and receipt verifiers remain the
owners for their respective concerns.

## Work routing

Before any task action, run `backlog instructions overview`; use the Backlog
CLI for task state and never edit Backlog task files directly. Before changing
code, read the relevant execution guide and keep one bounded proof story.

Use the narrowest check first, then `npm test`, `npm run check`,
`npm run llm:guidance`, and `git diff --check`. Report exact failures and do
not promote a green local check into runtime activation or Node0 closure.
