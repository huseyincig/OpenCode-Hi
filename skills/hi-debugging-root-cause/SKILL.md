---
name: hi-debugging-root-cause
description: Turn a symptom into evidence-backed root cause through discriminating experiments.
---

# Root-Cause Debugging

## Contract

- **Trigger:** Failure cause is uncertain, repeated, or crosses boundaries.
- **Do not trigger:** Cause is already direct and proven by local evidence.
- **Exit condition:** Root cause is demonstrated or a precise external blocker is established; retries are materially different.
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
