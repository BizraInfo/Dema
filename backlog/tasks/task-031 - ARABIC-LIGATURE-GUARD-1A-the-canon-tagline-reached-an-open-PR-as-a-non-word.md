---
id: TASK-031
title: 'ARABIC-LIGATURE-GUARD-1A: the canon tagline reached an open PR as a non-word'
status: Done
assignee:
  - '@claude'
created_date: '2026-07-31 00:45'
updated_date: '2026-07-31 00:46'
labels:
  - arabic
  - canon
  - gtm
  - truth-gate
dependencies: []
priority: high
type: bug
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
MEASURED 2026-07-31 on ops/first-witness-d2 (PR #446).

The canon tagline shipped into docs/gtm/AUG2_OPERATION_FIRST_WITNESS.md as `اإلنسانية` — code points U+0627 U+0625 U+0644 — where canon is `الإنسانية` = U+0627 U+0644 U+0625. The lam and the hamza-carrying alef are transposed. That is the signature of a lam-alef presentation form (ﻹ) being converted back to base characters in the wrong order, which is what PDF text extraction does, and the root canon lives in docs/root-canon/source/*.pdf. The result is not an Arabic word.

It was committed on the branch at lines 182 (EN section) and 205 (AR section), 4 instances total, in the file carrying the Aug 2 post — the single most quoted line the project has, in front of an EU-AI-Act audience.

WHY NOTHING CAUGHT IT: `npm run eval:layer1` reported PUBLIC_SAFE score 1 on that exact file. Layer-1 audits claim discipline and leakage; it has no orthography check. The claim-corpus gate, claim register, and no-overclaim scanner are all likewise blind to it. Nothing in the gate suite was looking at whether the Arabic was Arabic.

THE TELL that pins the mechanism: the adjacent canon line `كل إنسان عقدة` is CLEAN, because the space before إنسان prevents the ligature from forming. Only the word where lam is immediately followed by hamza-alef corrupted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All 4 instances repaired in docs/gtm/AUG2_OPERATION_FIRST_WITNESS.md; codepoints verified U+0627 U+0644 U+0625
- [x] #2 A guard exists that fires on a bare alef immediately followed by a hamza-carrying alef, the pattern that cannot occur inside a valid Arabic word
- [x] #3 The guard is built from code points so it cannot flag its own source, matching the existing name guard's construction
- [x] #4 tests/arabic-canonical-name.test.js is restored — it did not survive the carve, leaving the البذرة name guard absent from the branch entirely
- [x] #5 Zero false positives verified across the full tracked set
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Repaired 4 instances (0 residual, codepoints verified U+0627 U+0644 U+0625) and restored tests/arabic-canonical-name.test.js — which the carve had dropped entirely, leaving the branch with no البذرة name guard at all — then appended a lam-alef ligature guard to it. Pattern is a bare alef immediately followed by a hamza-carrying alef, which cannot occur inside a valid Arabic word; measured 2 hits before the fix (both real) and 0 after, across 2,199 tracked files, zero false positives. Verified: claim-corpus 122=122 new=0 · kernel-purity OK 446 scanned · claim-register 10 OK · doctor suites 51/51 · Layer-1 on the repaired doc still PUBLIC_SAFE. NOT verified here: the guard cannot execute in this sandbox because it calls `git ls-files`, which fails on the .git/config.worktree permission block; the pattern was validated against the same tracked set via a git alternates mirror instead. It must be run once in a real terminal or CI before merge.
<!-- SECTION:FINAL_SUMMARY:END -->
