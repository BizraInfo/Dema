# Phase 02 — Pseudocode

## Module A — Installer readiness flow

```text
function runInstaller(args, environment):
  mode = parseMode(args)
  plan = buildInstallPlan(environment)

  if mode == "check":
    report = validatePrerequisites(plan)
    return schemaTaggedCheckReport(report)

  if mode == "dry-run":
    return schemaTaggedDryRun(plan)

  if mode == "install":
    ensureNoDaemonStart(plan)
    createDirectoriesOnlyWhenMissing(plan.directories)
    createFilesOnlyWhenMissing(plan.files)
    return schemaTaggedInstallReport(created, existing, untouched)

  if mode == "uninstall":
    consent = readExactConsent(args)
    if consent != requiredUninstallPhrase:
      return refusal("exact consent required")
    removeOnlyDemaManagedPaths(plan)
    return schemaTaggedUninstallReport(removed, preserved)
```

TDD anchors:

- check mode does not write files;
- dry-run mode reports paths but does not create them;
- install preserves existing profile/config;
- uninstall refuses without exact phrase;
- no branch starts a background process.

## Module B — Verifier transparency flow

```text
function explainReceiptVerification(receipt):
  verifier = verifyReceipt(receipt)

  if verifier.verdict == "PERMIT":
    return rejectLocalOverclaim()

  return {
    schema: "bizra.dema.receipt_verification_explanation.v0.1",
    receipt_id: receipt.receipt_id,
    verifier_status: classify(verifier.verdict),
    certified: false,
    upstream_required: true,
    human_summary: renderPlainLanguage(verifier)
  }
```

TDD anchors:

- local verifier never returns certified=true;
- malformed receipt fails closed;
- placeholder verdict is visible in formatted output;
- gateway-handoff receipt explains upstream SAT dependency.

## Module C — Subprocess hardening flow

```text
function runExternalTool(commandName, args, policy):
  if commandName not in policy.allowed_commands:
    return refusal("external command not allowed")

  target = resolveTarget(policy.target_path)
  if target is missing:
    return refusal("target missing")

  if target is not under expected Dema home:
    return refusal("target outside Dema home")

  safeArgs = validateArgs(args, policy.allowed_flags)
  if safeArgs invalid:
    return refusal("unsupported argument")

  result = spawnWithTimeout(policy.binary, [target, ...safeArgs], policy.timeout_ms)
  return renderExternalToolResult(result)
```

TDD anchors:

- missing target refuses;
- unsupported flags refuse;
- timeout returns controlled error;
- output does not claim runtime success when child fails.

## Module D — Typed error envelope flow

```text
function toDemaError(error, fallbackCode):
  if error is DemaError:
    return error.toJSON()

  return {
    schema: "bizra.dema.error.v0.1",
    code: fallbackCode,
    message: safeMessage(error),
    hint: safeHintFor(fallbackCode)
  }
```

TDD anchors:

- known errors preserve code;
- unknown errors use safe fallback;
- private paths are not exposed unless already part of operator-visible input;
- CLI human output remains concise.

## Module E — Receipt schema documentation flow

```text
function documentReceiptSchema(version):
  fields = loadDeclaredReceiptFields(version)
  examples = buildMinimalExamples(fields)
  boundaries = describeVerifierBoundaries()

  writeDocsOnly(
    required_fields = fields.required,
    optional_fields = fields.optional,
    trust_labels = knownTruthLabels,
    verifier_states = knownVerifierStates,
    examples = examples,
    boundaries = boundaries
  )
```

TDD anchors:

- docs mention every currently emitted task receipt field;
- docs state local verifier is not SAT certification;
- examples are valid JSON snippets;
- docs link checker passes when available.
