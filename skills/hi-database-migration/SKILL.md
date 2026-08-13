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

1. Model current and target persistent schema or data states, deployment ordering, live-version overlap, data volume, locking, and rollback constraints.
2. Design forward migration and any backfill, dual-read, or dual-write transition so old and new application states remain compatible for the required deployment window.
3. Validate destructive or irreversible operations, defaults, nullability, indexes, transaction boundaries, retry/idempotency, and representative production-scale failure modes.
4. Stop when ordering, recovery, compatibility, and evidence are explicit and no step relies on an unverified assumption about existing data.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
