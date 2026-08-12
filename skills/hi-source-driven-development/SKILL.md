---
name: hi-source-driven-development
description: Inspect authoritative source before adapting an external implementation or methodology.
---

# Source-Driven Development

## Contract

- **Trigger:** External repository/specification/implementation is material to the requested change.
- **Do not trigger:** Task is fully internal and no external implementation evidence is relevant.
- **Exit condition:** Source, license, primitive, ownership, reuse action, and test strategy are recorded before reuse.
- **Role affinity:** repository-explorer
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Start from the explicit task contract and current repository evidence.
2. Apply this methodology only to the smallest surface that satisfies its trigger.
3. Prefer deterministic evidence and existing project conventions over speculative generalization.
4. Stop when the exit condition is satisfied; do not take routing, topology, authority, completion, or STOP ownership.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
