# Phase 4 · Cartographer Claim-Stamp Intake · Pseudocode (PREVIEW)

**Pseudocode-bundle file:** `phase_04_cartographer_artifact_intake_pseudocode.md`  
**Maps to:** `CARTOGRAPHER-CLAIM-STAMP-INTAKE-PREVIEW-1A`  
**Truth label:** `DESIGNED_NOT_LIVE` until an implementation GO  
**I/O (when live):** read-only paths under operator-supplied directory; never mutate scanned repos

## Why this module exists

PAT-Cartographer Peak Synthesis (PDF sha256 `dc75867f…5c4b78bb`) claims three
load-bearing artifacts. On the founder machine (2026-10-29 absorb pass) those
JSON files were **ABSENT** — only the PDF arrived. Any local claim that “48
triples / 20 claims are verified here” would launder DECLARED_IN_PDF into
MEASURED_NOW.

This module specifies a **fail-closed intake preview** so a future slice can
bind PDF prose to re-derivable indices without touching foreign source trees.

## Required artifact set (names only — no secrets)

| Artifact | Role |
| --- | --- |
| `cross_repo_ledger.json` | ports, routes, hashes, councils |
| `bizra_hypergraph_triples.jsonl` | provenance triples (NDJSON) |
| `public_claims_audit.json` | badged claims + numeric drifts |

Operator supplies `intakeRoot` (absolute path). No default production path baked in.

## Pseudocode

```text
MODULE CartographerClaimStampIntakePreview

  CONST REQUIRED_FILES := [
    "cross_repo_ledger.json",
    "bizra_hypergraph_triples.jsonl",
    "public_claims_audit.json"
  ]

  CONST SCHEMA_HINTS := {
    # Soft hints for preview — exact schemas live in artifacts when present.
    "cross_repo_ledger.json":        "object",
    "bizra_hypergraph_triples.jsonl": "ndjson",
    "public_claims_audit.json":      "object"
  }

  FUNCTION assessCartographerIntake({ intakeRoot, readText, listNames }) -> result
    boundary := {
      runtime_execution: false,
      mint_performed: false,
      foreign_repo_write: false,
      authority_delta: 0
    }

    IF intakeRoot is not a non-empty string THEN
      RETURN {
        schema: "bizra.dema.cartographer_claim_stamp_intake_preview.v0.1",
        truth_label: "CARTOGRAPHER_INTAKE_BLOCKED",
        ok: false,
        missing: ["intake_root"],
        epistemic: "UNKNOWN",
        boundary
      }
    END IF

    names := listNames(intakeRoot)   # read-only
    missing := []
    FOR EACH f IN REQUIRED_FILES
      IF f not in names THEN missing.append(f)
    END FOR

    IF missing.length > 0 THEN
      RETURN {
        schema: "bizra.dema.cartographer_claim_stamp_intake_preview.v0.1",
        truth_label: "CARTOGRAPHER_INTAKE_BLOCKED",
        ok: false,
        missing,
        epistemic: "UNKNOWN",
        note: "PDF synthesis must not be promoted above DECLARED_IN_PDF",
        boundary
      }
    END IF

    parse_errors := []
    counts := {}

    ledger := tryParseJson(readText(intakeRoot / "cross_repo_ledger.json"))
    IF ledger is null THEN parse_errors.append("cross_repo_ledger.json")
    ELSE counts.ledger_keys := keys(ledger).length

    claims := tryParseJson(readText(intakeRoot / "public_claims_audit.json"))
    IF claims is null THEN parse_errors.append("public_claims_audit.json")
    ELSE counts.claim_entries := countClaimEntries(claims)  # implementation-defined

    triples := tryParseNdjson(readText(intakeRoot / "bizra_hypergraph_triples.jsonl"))
    IF triples is null THEN parse_errors.append("bizra_hypergraph_triples.jsonl")
    ELSE counts.triple_lines := triples.length

    IF parse_errors.length > 0 THEN
      RETURN {
        schema: "bizra.dema.cartographer_claim_stamp_intake_preview.v0.1",
        truth_label: "CARTOGRAPHER_INTAKE_PARSE_FAILED",
        ok: false,
        parse_errors,
        epistemic: "DECLARED_PARTIAL",
        boundary
      }
    END IF

    RETURN {
      schema: "bizra.dema.cartographer_claim_stamp_intake_preview.v0.1",
      truth_label: "CARTOGRAPHER_INTAKE_REPARSE_GREEN",
      ok: true,
      counts,
      epistemic: "MEASURED_FROM_ARTIFACTS",
      # Do NOT auto-assert PDF numbers (48/20) — compare only when operator
      # passes expectedCounts; mismatch → ok:false + CONTRADICTS stamp.
      boundary
    }
  END FUNCTION

END MODULE
```

## Flow

```text
PDF arrives
   │
   ▼
assessCartographerIntake(intakeRoot)
   │
   ├─ missing files ──► BLOCKED (epistemic UNKNOWN)
   ├─ parse fail    ──► PARSE_FAILED
   └─ reparse green ──► MEASURED_FROM_ARTIFACTS
                              │
                              ▼
                    optional expectedCounts check
                              │
                              └─ mismatch ⇒ do not mint “burst verified”
```

## Coupling to CLI-EXIT-TEETH

**None at runtime.** Phase 4 is a separate preview kernel. CLI-EXIT-TEETH must
not wait on Cartographer artifacts. Shared doctrine only: **missing evidence ⇒
not GREEN**.

## Explicit non-actions

- No scrape of BizraInfo clones in this preview
- No rewrite of award-winner / data-lake READMEs
- No promotion of FOUNDER_STATED or performance story numbers
- No council enum rename inside Dema-clean
