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

1. Start from the explicit task contract and current repository evidence.
2. Apply this methodology only to the smallest surface that satisfies its trigger.
3. Prefer deterministic evidence and existing project conventions over speculative generalization.
4. Stop when the exit condition is satisfied; do not take routing, topology, authority, completion, or STOP ownership.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
