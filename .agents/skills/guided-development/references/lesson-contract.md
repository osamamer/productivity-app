# Structured Client Contract

Dev Coach supplies a JSON Schema for every response. Return only data matching that schema; do not wrap it in Markdown or add commentary outside the object.

## Course Plan

- Use one to six lessons.
- Give each lesson a stable, unique id.
- Describe concrete outcomes rather than topics such as "learn services."
- Order lessons so each completed step leaves a coherent repository.

## Lesson

- Keep `explanation` focused on the current decision.
- Use `example` for a concise, relevant code example.
- Use repository-relative paths in `task.targets`.
- Use symbols, class names, or method names rather than line numbers.
- Put executable commands only in `suggestedChecks` and only when supported by repository documentation or build files.
- Make hints progressively more specific.
- Include a complete reference fallback in `solution`; the client keeps it hidden until requested.

## Assessment

- Base status on the current worktree, not the proposed solution.
- Do not describe tests as passing unless they ran successfully during this assessment.
- Keep `nextStep` singular and actionable.
