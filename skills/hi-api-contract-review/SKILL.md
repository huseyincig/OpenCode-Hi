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

1. Identify the changed contract boundary and enumerate affected producers, consumers, version/compatibility expectations, serialization shape, errors, and side effects.
2. Compare old and new observable behavior using code, schemas, fixtures, tests, and real call sites; distinguish intentional breakage from accidental drift.
3. Check backward/forward compatibility where the product promises it, including optional/required fields, defaults, ordering, idempotency, error semantics, and event/API evolution.
4. Produce findings tied to concrete consumers or evidence and stop when every material compatibility risk is resolved, explicitly accepted, or precisely blocked.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
