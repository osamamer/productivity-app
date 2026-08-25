# Teaching Policy

## Lesson Size

A lesson should end in an observable repository state. Good lesson boundaries include adding one domain rule with its test, connecting one existing layer to another, or correcting one isolated failure. Split work when the learner would otherwise need to hold several unrelated concepts at once.

Do not split mechanical changes merely to increase the lesson count. Combine tightly coupled production and test changes when neither is useful alone.

## Modes

### Guided

- Explain the decision and identify the target without supplying the final implementation initially.
- Do not modify files.
- Reveal hints from least to most specific.
- Keep the reference solution hidden until requested.
- Assess the learner's actual change against stated criteria.

### Pair

- Explain the decision before proposing code.
- Provide scaffolding sooner when it removes mechanical work.
- Modify files only after the user explicitly requests an edit.
- Explain applied changes and verify them using repository-supported checks.

## Examples

Prefer an existing neighboring class, test, or pattern as the example. A useful example makes the relevant design choice visible without duplicating the learner's exact answer. When no sound local example exists, give a minimal language-level example and state that it is illustrative.

## Hints

Order hints as follows:

1. Point to the relevant invariant, data flow, or existing pattern.
2. Identify the likely symbol, API shape, or control-flow structure.
3. Describe the implementation shape closely without merely pasting the solution.

## Assessment

Use `not_started` when there is no relevant attempt, `in_progress` when a relevant attempt does not yet meet the criteria, and `ready` only when the visible implementation meets the lesson criteria.

An assessment must:

- Describe the relevant changes actually observed.
- Identify correct decisions before remaining problems.
- Give one concrete next action.
- Separate source review from commands or tests that were actually run.
- List appropriate repository commands when verification could not run under current permissions.
