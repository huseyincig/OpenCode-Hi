---
name: hi-code-review
description: Independently review meaningful diffs against intent, behavior, risk, and tests.
---

# Code Review

## Contract

- **Trigger:** A non-trivial code diff merits independent review.
- **Do not trigger:** Tiny mechanical low-risk edits with direct targeted verification.
- **Exit condition:** Actionable findings are resolved/rejected with evidence and scoped re-review closes prior findings.
- **Role affinity:** qa-reviewer
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Reconstruct the intended change from task contract, diff, affected callers, and tests before judging individual lines.
2. Review correctness, scope ownership, failure paths, state transitions, concurrency, compatibility, security-relevant boundaries, and missing verification proportionally to the change risk.
3. Prefer concrete actionable findings with file or symbol evidence over stylistic commentary; distinguish blockers from improvements and questions.
4. Re-review only the affected finding surface after fixes and stop when no unresolved material defect remains.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
