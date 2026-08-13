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

1. State the behavior that must remain invariant and establish targeted evidence for it before structural change.
2. Refactor in bounded steps along natural ownership boundaries, avoiding simultaneous behavior additions unless the task explicitly requires them.
3. After each meaningful structural step, compare changed surface and run the smallest evidence that would expose semantic drift, lost error handling, or accidental scope expansion.
4. Stop when the intended structure is simpler or clearer, observable behavior is preserved, and no collateral change remains outside the refactor contract.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
