---
name: hi-browser-testing
description: Perform targeted browser validation using an authorized browser capability.
---

# Browser Testing

## Contract

- **Trigger:** Changed behavior requires real browser interaction or rendering evidence.
- **Do not trigger:** No browser surface is involved or browser tooling is unavailable.
- **Exit condition:** Target routes/interactions are exercised and relevant console/network/visual evidence is captured.
- **Role affinity:** visual-qa
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Define the exact browser-visible behavior and the smallest routes, interactions, and states that require real browser evidence.
2. Use an authorized browser capability to execute those interactions, capturing rendered state plus relevant console, network, and runtime failures rather than relying on screenshots alone.
3. Cover only material engine or viewport differences required by the contract; avoid broad browser matrices when one targeted run proves the behavior.
4. Stop when the user flow is reproducible and the evidence proves the requested behavior or a precise browser/environment blocker.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
