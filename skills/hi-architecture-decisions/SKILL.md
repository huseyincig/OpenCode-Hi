---
name: hi-architecture-decisions
description: Record durable architecture choices with evidence and consequences.
---

# Architecture Decisions

## Contract

- **Trigger:** A durable choice has credible alternatives and future maintenance consequences.
- **Do not trigger:** Local/reversible implementation choice does not need durable rationale.
- **Exit condition:** Decision, credible alternatives, consequences, and evidence are recorded in the project convention.
- **Role affinity:** architect
- **Context cost:** medium
- **Execution cost:** low

## Method

1. State the durable decision and the forces that make it architectural: ownership boundary, compatibility, deployment/runtime constraint, extensibility, or long-term maintenance cost.
2. Record the strongest credible alternatives, including the current approach when relevant, and explain why each was accepted or rejected using evidence.
3. Capture consequences: new invariants, operational costs, migration or rollback implications, extension points, and decisions intentionally deferred.
4. Store the decision in the project’s existing architecture convention and stop when future maintainers can understand both the choice and its boundary without reconstructing the discussion.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
