---
name: hi-visual-qa
description: Validate changed visual output for layout, clipping, state, and responsive regressions.
---

# Visual QA

## Contract

- **Trigger:** Visual UI rendering or styling changed materially.
- **Do not trigger:** No visual surface changed.
- **Exit condition:** Relevant viewports/states are checked and visual defects are resolved or recorded.
- **Role affinity:** visual-qa
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Start from the explicit task contract and current repository evidence.
2. Apply this methodology only to the smallest surface that satisfies its trigger.
3. Prefer deterministic evidence and existing project conventions over speculative generalization.
4. Stop when the exit condition is satisfied; do not take routing, topology, authority, completion, or STOP ownership.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
