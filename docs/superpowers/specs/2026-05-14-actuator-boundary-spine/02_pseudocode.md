# Phase 02 - Pseudocode

## Module A - Actuator classification

```text
function classifyActuator(intentShape):
  classes = []

  for each permission in intentShape.permissions:
    if permission.action == "execute":
      add "bash" to classes
    if permission.action == "write":
      add "filesystem_mutation" to classes
    if permission.action == "call":
      add "external_call" to classes
    if permission.action == "spend":
      add "spend" to classes

  for each analogical note in intentShape.notes:
    if note references GUI automation:
      add "gui" to classes
    if note references migration across hosts:
      add "mobile_agent" to classes

  return unique classes sorted by risk
```

TDD anchors:

- command permission maps to `bash`;
- file write maps to `filesystem_mutation`;
- Slack or API call maps to `external_call`;
- unknown intent produces no capability and a review note.

## Module B - Consent spine preview

```text
function buildConsentSpinePreview(intent, now):
  if intent is empty:
    throw "non-empty intent required"

  intentShape = extractIntentShape(intent)
  actuatorClasses = classifyActuator(intentShape)
  permissions = intentShape.permissions

  consentScopeDraft = {
    mission_id: previewOnlyId(intent),
    agent_id: "preview.operator",
    permissions: permissions,
    expires_at: suggestedShortExpiry(now),
    commitment_hash: hash(stableStringify(permissions))
  }

  policyPreview = evaluatePreviewPolicies(intentShape, actuatorClasses)

  return {
    schema: "bizra.dema.actuator_consent_spine_preview.v0.1",
    mode: "PREVIEW_ONLY",
    actuator_classes: actuatorClasses,
    consent_scope_draft: consentScopeDraft,
    policy_preview: policyPreview,
    effect_capability: {
      minted: false,
      reason: "Dema drafts consent only; governed runtime must mint runtime capability"
    },
    proof_of_truth: buildProofLabels(policyPreview),
    boundary: previewBoundary()
  }
```

TDD anchors:

- preview never records approval;
- commitment hash is deterministic for equivalent permissions;
- effect capability is never minted by Dema;
- risky actuator classes are visible in JSON and formatted output.

## Module C - Policy decision preview

```text
function evaluatePreviewPolicies(intentShape, actuatorClasses):
  decisions = []

  if intentShape.unsafe_file_references is not empty:
    decisions add deny(
      code = "unsafe_file_reference",
      reason = "absolute, home-relative, or parent traversal paths excluded"
    )

  if "bash" in actuatorClasses:
    decisions add requireRuntimeHandoff(
      code = "bash_like_actuator",
      reason = "command execution needs governed runtime capability runtime"
    )

  if "external_call" in actuatorClasses and intentShape.category == "audit":
    decisions add requireHumanReview(
      code = "audit_external_delivery",
      reason = "audit outputs should stay local unless explicitly approved"
    )

  if "spend" in actuatorClasses:
    decisions add deny(
      code = "economic_channel_closed",
      reason = "economic effects are closed until verified impact governance"
    )

  if decisions is empty:
    decisions add allowPreviewOnly("no effecting permission detected")

  return decisions
```

TDD anchors:

- unsafe paths deny permission expansion;
- bash execution requires runtime handoff;
- audit plus external call requires human review;
- spend action is denied in Dema preview.

## Module D - Actuator source review gate

```text
function buildActuatorCheckReport(root, scanRoots):
  files = list source files under scanRoots
  findings = []

  for each file in files:
    body = read file
    findings add matches for "exec("
    findings add matches for "execSync("

    for each spawn or spawnSync call:
      if call options contain "shell: true":
        findings add spawn shell finding

  return {
    schema: "bizra.dema.review.actuator_check.v0.1",
    ok: findings is empty,
    scanned_files: files,
    findings: findings,
    boundary: readOnlyAuditBoundary()
  }
```

TDD anchors:

- current source tree passes;
- fixture with `exec` fails;
- fixture with `execSync` fails;
- fixture with `spawn(..., { shell: true })` fails;
- argv-based `execFile` and `spawnSync` are allowed.

## Module E - Future runtime capability runtime handoff

```text
function requestRuntimeCapability(runtimeClient, consentScope, policyDecision):
  if policyDecision is deny:
    return refused(policyDecision.reason)

  if consentScope.approval_recorded is false:
    return refused("exact consent required")

  if consentScope is expired or revoked:
    return refused("consent inactive")

  request = {
    consent_scope: consentScope,
    policy_decision: policyDecision,
    requested_effects: consentScope.permissions
  }

  return runtimeClient.requestRuntimeCapability(request)
```

TDD anchors:

- no exact consent means no runtime request;
- expired consent blocks request;
- denied policy blocks request;
- Dema test double confirms no local execution is invoked.
