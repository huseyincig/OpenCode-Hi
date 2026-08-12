---
name: hi-safe-refactoring
description: Preserve behavior while making bounded structural changes.
---

# Safe Refactoring

## Contract

- **Trigger:** Refactor is explicitly requested or needed to enable a required change.
- **Do not trigger:** Behavior change is the primary task and no structural refactor is required.
- **Exit condition:** Pre/post behavior evidence is equivalent and public contracts remain stable unless explicitly changed.
- **Role affinity:** coder
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Start from the explicit task contract and current repository evidence.
2. Apply this methodology only to the smallest surface that satisfies its trigger.
3. Prefer deterministic evidence and existing project conventions over speculative generalization.
4. Stop when the exit condition is satisfied; do not take routing, topology, authority, completion, or STOP ownership.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
