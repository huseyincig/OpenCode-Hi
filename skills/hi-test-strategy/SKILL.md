---
name: hi-test-strategy
description: Choose risk-proportional verification at the narrowest sufficient boundaries.
---

# Test Strategy

## Contract

- **Trigger:** Implementation changes require deciding what evidence is sufficient.
- **Do not trigger:** No behavior changed or verification policy is already explicit and fresh.
- **Exit condition:** Required targeted/dependency/integration evidence is defined and executed without verification spiral.
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
