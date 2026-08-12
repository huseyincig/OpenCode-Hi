---
name: hi-api-contract-review
description: Review changed APIs, events, schemas, and compatibility contracts.
---

# API Contract Review

## Contract

- **Trigger:** An implemented contract boundary changed.
- **Do not trigger:** No externally or cross-module observable contract changed.
- **Exit condition:** Consumers, errors, compatibility, serialization, and contract tests are reconciled.
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
