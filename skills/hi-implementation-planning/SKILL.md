---
name: hi-implementation-planning
description: Create the minimum dependency-oriented plan required for coordinated changes.
---

# Implementation Planning

## Contract

- **Trigger:** Cross-module sequencing, migration, rollback, or coupled acceptance requires coordination.
- **Do not trigger:** Clear local task can be executed directly.
- **Exit condition:** Dependencies, ordered changes, acceptance, verification, and rollback needs are explicit enough to execute.
- **Role affinity:** working-manager
- **Context cost:** medium
- **Execution cost:** low

## Method

1. Separate current behavior from target behavior.
2. Order only real dependencies and coupled changes.
3. Include acceptance evidence and rollback needs where material.
4. Do not create a plan artifact for clear local work.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
