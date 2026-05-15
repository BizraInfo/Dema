# Phase 02 - Pseudocode

## Module A - EffectCap request shape

```text
function buildEffectIntent(resourceId, action, params):
  if action not in ["read", "write", "execute", "call", "spend"]:
    return Denied("unknown action")

  if resourceId is empty:
    return Denied("resource required")

  if params contains function, exec, shell, or implementation pointer:
    return Denied("intent data only")

  return Intent(resourceId, action, params)
```

## Module B - Consent gate

```text
function checkConsent(consentScope, intent, now):
  if consentScope is missing:
    return Denied("consent missing")

  if consentScope.status == "revoked":
    return Denied("consent revoked")

  if consentScope.expires_at <= now:
    return Denied("consent expired")

  if consentScope.resource_id != intent.resourceId:
    return Denied("resource mismatch")

  if consentScope.action != intent.action:
    return Denied("action mismatch")

  return Allowed("consent active")
```

## Module C - Sealed registry dispatch

```text
function perform(intent, consentScope, registry, now):
  consentDecision = checkConsent(consentScope, intent, now)
  if consentDecision denied:
    return consentDecision

  key = intent.resourceId + ":" + intent.action
  entry = registry.get(key)
  if entry missing:
    return Denied("unknown operation")

  schemaDecision = entry.schema.validate(intent.params)
  if schemaDecision denied:
    return Denied("invalid params")

  if entry.risk == "bash" and consentScope.explicit_human_approval != true:
    return Denied("explicit human approval required")

  return entry.implementation(intent.params)
```

Critical invariant: callers do not provide `entry.implementation`; only the
sealed registry does.

## Module D - Declared intent versus actual effect

```text
function registryKey(intent):
  return intent.resourceId + ":" + intent.action

function dispatch(intent):
  entry = registry[registryKey(intent)]
  if entry.effect_class does not match intent.action:
    return Denied("declared action diverges from effect")

  return entry
```

## Module E - Policy DSL evaluator

```text
function evaluatePolicy(rule, context):
  if rule has "eval" or executable string:
    return Denied("policy must be data-only")

  if rule has all:
    return every child rule is allowed

  if rule has any:
    return at least one child rule is allowed

  if rule has field/op/value:
    value = read context field by path
    return compare(value, op, rule.value)

  return Denied("unknown policy rule")
```

## Module F - EffectLog preview

```text
function buildEffectLog(intent, decision, outcome):
  return {
    mission_id,
    agent_id,
    resource_id: intent.resourceId,
    action: intent.action,
    decision,
    outcome_digest,
    previous_hash,
    hash: sha256(stableStringify(log without hash))
  }
```

The EffectLog is future runtime work. This spec only defines what must be true
before that runtime exists.
