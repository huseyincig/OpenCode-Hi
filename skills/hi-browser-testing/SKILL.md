---
name: hi-browser-testing
description: Perform targeted browser validation using an authorized browser capability.
---

# Browser Testing

## Contract

- **Trigger:** Changed behavior requires real browser interaction or rendering evidence.
- **Do not trigger:** No browser surface is involved or browser tooling is unavailable.
- **Exit condition:** Target routes/interactions are exercised and relevant console/network/visual evidence is captured.
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
