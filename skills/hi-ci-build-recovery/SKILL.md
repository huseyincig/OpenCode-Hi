---
name: hi-ci-build-recovery
description: Isolate the first real CI/build failure and repair its root cause.
---

# CI and Build Recovery

## Contract

- **Trigger:** Build or CI fails or differs materially from local execution.
- **Do not trigger:** No build/CI failure exists.
- **Exit condition:** Failure class and root cause are identified, repaired when authorized, and the affected pipeline evidence is green or externally blocked.
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
