---
name: hi-repository-analysis
description: Map the minimum relevant files, symbols, dependencies, tests, and configuration.
---

# Repository Analysis

## Contract

- **Trigger:** Task scope or ownership is unclear enough that repository inspection will change execution.
- **Do not trigger:** Known local scope already has fresh evidence.
- **Exit condition:** Relevant ownership and affected surface are known with remaining uncertainty explicit.
- **Role affinity:** repository-explorer
- **Context cost:** medium
- **Execution cost:** low

## Method

1. Start from task-specific entry points and symbols.
2. Trace only relevant callers, tests, configuration, and ownership boundaries.
3. Stop once the affected surface and remaining uncertainty are explicit.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
