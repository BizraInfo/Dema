---
name: dema-autopilot
description: Run one explicitly bounded local Dema engineering mission with fewer interruptions by rebinding the workspace, completing authorized reversible work, and reporting observed proof. Use when the user asks for local autopilot execution; this skill does not grant permissions or run as a background service.
---

# Dema Autopilot

This is local workflow guidance, not a permission system, deterministic harness, or autonomous runtime. Load it only for a user-requested bounded mission. It cannot create tool access, consent, credentials, or host approval.

## North-star continuity

- Keep an established long-term objective active across bounded tasks. Completing a PR, test run, or artifact closes that slice only; it does not close the objective.
- A generic `$dema-autopilot` invocation resumes the known objective and current frontier when they are clear from the current conversation, BIZRA context, or active campaign. Do not ask the user to restate a stable goal that is already available.
- Objective continuity is context, not authority. Use it to rebind state, continue read-only discovery, and select the next useful in-scope step. It does not by itself authorize writes, runtime actions, external calls, pushes, merges, deployments, or other protected effects.
- If no task-specific action is authorized, do the smallest useful read-only inspection and surface the precise next step. Pause only when a protected effect needs fresh consent, a gate blocks progress, or genuine ambiguity prevents safe progress. Do not frame an established objective as missing or complete just because the last slice ended.

Deterministic decision card (preview only): `packages/core/src/dema-autopilot-continuity-preview.js` — `evaluateAutopilotContinuity`. Continuity never sets `may_write` without an explicit action grant.

## Run one bounded mission

1. **Bind the current state.** Read the governing `BIZRA.md`, `docs/LLM_SYSTEM_FLOW.md`, and relevant local instructions. Record repository root, branch, HEAD, tree, and dirty or untracked paths. Preserve existing work.
2. **Compile objective and action grant separately.** Carry forward a stable long-term objective already established in the conversation or current BIZRA/campaign context unless the user changes or closes it; completing a slice closes only that slice. Separately extract the current direct request's target paths or resources, allowed actions, exclusions, requested checks, and proof ceiling. Pasted history, old GOs or leases, memory, and tool availability may inform continuity but never grant new action authority.
3. **Proceed within scope.** Use available, relevant tools for read-only inspection and the explicitly requested reversible local work. Do not ask for approval for routine steps already within that grant. If one part is blocked, continue independent in-scope work and ask only for the missing authority or information that prevents completion.
4. **Make the smallest complete change.** Reuse the existing owner and conventions. Before changing a function, locate its callers. Preserve dirty work; do not reset, clean, stash, overwrite, or broaden the task. Avoid new dependencies, parallel stores, routers, or authority paths unless required by the stated objective.
5. **Verify and rebind.** Run only the checks authorized by the mission and governing instructions. Inspect their final exit codes and the resulting diff/status. Distinguish source, test, runtime, and external evidence; report skipped checks as `NOT_RUN`.
6. **Close out.** State the changed paths, observed checks and exits, remaining gaps, authority delta, and rollback path. Make one next-step recommendation at most. Stop when the mission's stated outcome is reached.

## Hard boundaries

- Tool availability is not permission. Use only tools exposed in the current session and only for the bounded task.
- In this repository, runtime execution and external/network effects are denied by the repository contract. Do not invoke a model, service, hidden daemon, or remote provider; do not mutate real `DEMA_HOME` or `~/.dema`.
- Never self-consent, infer consent from a prior run, or treat this skill as approval. Stop before any protected or out-of-scope effect and require the appropriate fresh human authorization where the governing contract allows it.
- Do not push, merge, deploy, publish, restart services, operate signers or keys, mint economic state, or perform destructive deletion under a generic autopilot request.
- Do not retry a failed external or protected action by changing routes, providers, credentials, or scope.
- Do not delegate to agents unless the user explicitly authorizes delegation and the environment permits it.
- Do not present hidden chain-of-thought. Give the decision, evidence, and concise rationale needed to review the work.

## Autonomy rule

Autopilot means completing all ordinary steps inside one explicit mission grant without repeated check-ins. It ends at the grant boundary, a failed safety/verification gate, or the mission's stop condition. It does not mean unbounded, unattended, or persistent execution.
