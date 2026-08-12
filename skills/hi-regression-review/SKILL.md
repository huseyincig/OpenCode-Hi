---
name: hi-regression-review
description: Check likely neighboring behavior affected by a changed contract or shared component.
---

# Regression Review

## Contract

- **Trigger:** Change can plausibly affect existing consumers or shared behavior.
- **Do not trigger:** Change is isolated with no dependent behavior.
- **Exit condition:** Likely regressions are covered by existing or targeted tests; scope does not expand speculatively.
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
