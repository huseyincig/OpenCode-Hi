---
name: hi-task-classification
description: Classify intent, risk, ambiguity, scope, dependency, and mutation authority to choose minimum sufficient execution.
---

# Task Classification

## Contract

- **Trigger:** A new or materially changed mission/task needs execution-path selection.
- **Do not trigger:** Already-classified unchanged substep can inherit a valid task contract.
- **Exit condition:** Execution path and adaptive axes are justified with no unnecessary capability activation.
- **Role affinity:** working-manager
- **Context cost:** low
- **Execution cost:** low

## Method

1. Read the user intent before considering capabilities.
2. Classify mutation authority, risk, ambiguity, dependency class, and scope.
3. Select DIRECT, EVIDENCE, PLANNED, or ESCALATED with the smallest sufficient roles, skills, model/tool capability, context, and isolation.
4. Record an escalation reason whenever execution becomes more expensive.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
