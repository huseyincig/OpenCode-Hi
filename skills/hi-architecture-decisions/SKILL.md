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

1. Start from the explicit task contract and current repository evidence.
2. Apply this methodology only to the smallest surface that satisfies its trigger.
3. Prefer deterministic evidence and existing project conventions over speculative generalization.
4. Stop when the exit condition is satisfied; do not take routing, topology, authority, completion, or STOP ownership.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
