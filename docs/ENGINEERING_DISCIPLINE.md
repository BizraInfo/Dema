# Engineering Discipline (v0.1)

Five rules for any code change in this repo. Originally condensed from user-scope `~/CLAUDE.md` (Operator Discipline) and Karpathy-school engineering practice; ratified for Dema during the v0.2 doctrine import on 2026-05-05.

1. **Small edits.** One concept per PR. If a PR description needs more than three bullets, split it. Mixing scopes (UX polish + architecture + CI) inflates review surface and hides regressions.
2. **Explicit assumptions.** Write the assumption down before the code that depends on it. If it's wrong, the comment fails first. Hidden assumptions are silent landmines for the next reader.
3. **No invented commands.** Verify a command exists (`--help`, file path, function name) before citing it. Never translate vision into commands that don't exist in the tree. ZANN risk grows fast — one fake command in a doc becomes ten in the next session.
4. **Testable success.** Every change ends in something a future reader can re-run: `npm test`, `npm run check`, a sample CLI invocation, a fixture file. "It works on my machine" without a recipe is not a finished change.
5. **Stop at ambiguity.** When the next step has two reasonable interpretations, halt and ask. Guesses compound; halts don't. Auto-mode does not override this.

## How this lands in practice

- A bug-fix PR fixes the bug and nothing else. The cleanup goes in a follow-up.
- A doc-only PR does not touch executable code. A code PR may include doc updates _for code it touches_, but does not import unrelated doctrine.
- New abstractions need a second concrete caller before they exist. Three similar lines is better than a premature abstraction.
- New dependencies need a written justification. Dema's current zero-dep status is a feature, not an oversight.
- Constants come from a named source. If a value lives in two places it will diverge.

## Review gate: automated advisory + self-review fallback

Ratified 2026-06-01 after five PRs (#119–#123) merged to `main` with **zero CodeRabbit review signal** — self-review carried every merge ad hoc. This formalizes that practice.

- **The required review is the CI gates, not CodeRabbit.** The four workflows (`test`, `check`, `BIZRA Review Gate`/`proof-quality`, `gitleaks`) plus the review scripts (`pr-class`, `proof-scope`, `no-overclaim`, `receipt-integrity`) always run and always gate. See [docs/CI_CD_PIPELINE.md](CI_CD_PIPELINE.md).
- **CodeRabbit is a third-party _advisory_ layer, not a required gate.** It is frequently silent (credits exhausted, "review skipped", rate-limit). Its silence does **not** block merge — and it does **not** satisfy the review obligation either.
- **A documented self-review is REQUIRED before merge when _either_:**
  1. the advisory layer produced no signal, **or**
  2. the diff contains novel (non-mirror) logic.
- **Mirror exception.** A verbatim structural mirror of already-reviewed code may substitute a normalized **structural-identity diff** (proving zero logic drift) for a full self-review — e.g. a new proof producer cloned from a reviewed sibling. Novel composition or first-of-its-kind logic never qualifies.
- **A self-review is evidence-based or it is nothing.** Read the actual committed diff, trace each real risk to the _code_ (not the PR description), and state a verdict — `SELF_REVIEW_CLEAN` or enumerated findings. Performative agreement is not a review.
- **Record the verdict** on the PR or in the merge body so a replayer sees that review happened and on what basis.

This is not a license to skip CodeRabbit when it works — when it posts a review, read it. It is the floor that holds when the advisory layer is absent.

## Halt gates that override auto-mode

These never fall through, even with `/A` or autonomous-mode flags set:

- Any push to `main` or any shared branch.
- Any destructive git operation (reset --hard, force-push, branch -D, rm -rf).
- Posting to GitHub PRs, issues, or external services on behalf of the user.
- Modifying CI workflows, secrets, or production configs.
- Issuing identity-bound artifacts (signing keys, DIDs, ARTIFACT-011).

For each, describe the blast radius in one line and ask. The cost of pausing is low; the cost of an unwanted action is high.

## See also

- User-scope canon at `~/CLAUDE.md` — operator discipline, halt gates, output style
- [docs/DECISION_two_dema_split.md](DECISION_two_dema_split.md) — example of a halt-gated multi-PR migration
- Repo CLAUDE.md — Dema-specific architecture spine and invariants
