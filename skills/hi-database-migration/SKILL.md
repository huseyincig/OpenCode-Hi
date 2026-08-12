---
name: hi-database-migration
description: Plan and validate safe schema/data migrations and transitional compatibility.
---

# Database Migration

## Contract

- **Trigger:** Schema, migration, backfill, or persistent data compatibility changes.
- **Do not trigger:** No persistent schema/data transition.
- **Exit condition:** Ordering, compatibility, rollback, locking/volume risk, and migration evidence are sufficient.
- **Role affinity:** coder
- **Context cost:** high
- **Execution cost:** high

## Method

1. Start from the explicit task contract and current repository evidence.
2. Apply this methodology only to the smallest surface that satisfies its trigger.
3. Prefer deterministic evidence and existing project conventions over speculative generalization.
4. Stop when the exit condition is satisfied; do not take routing, topology, authority, completion, or STOP ownership.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
