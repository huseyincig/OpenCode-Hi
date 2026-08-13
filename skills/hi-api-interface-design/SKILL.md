---
name: hi-api-interface-design
description: Design a stable interface from consumer requirements and compatibility constraints.
---

# API and Interface Design

## Contract

- **Trigger:** A public/internal API, event, schema, command, or durable boundary is being created or materially changed.
- **Do not trigger:** Pure implementation detail with no boundary consequence.
- **Exit condition:** Inputs, outputs, errors, side effects, compatibility, and acceptance tests are explicit.
- **Role affinity:** architect
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Identify the real consumers and use cases before defining the interface; state inputs, outputs, errors, side effects, lifecycle, authority, and stability expectations.
2. Keep the contract minimal and composable, separating required semantics from convenience fields and implementation details.
3. Evaluate compatibility, idempotency, pagination, versioning, event ordering, and invalid or partial states where applicable.
4. Express acceptance examples or contract tests that a consumer can rely on and stop when the boundary is understandable without knowledge of the implementation.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
