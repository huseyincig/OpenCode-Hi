---
name: hi-test-strategy
description: Choose risk-proportional verification at the narrowest sufficient boundaries.
---

# Test Strategy

## Contract

- **Trigger:** Implementation changes require deciding what evidence is sufficient.
- **Do not trigger:** No behavior changed or verification policy is already explicit and fresh.
- **Exit condition:** Required targeted/dependency/integration evidence is defined and executed without verification spiral.
- **Role affinity:** qa-reviewer
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Map changed behavior and risk to the smallest evidence layers that can actually falsify defects: static checks, unit or contract, integration, host/runtime, browser/visual, or external verification.
2. Reuse trustworthy existing tests where they cover the contract; add new tests only for uncovered deterministic behavior or a proven regression.
3. Avoid redundant suites that assert the same implementation assumption at several levels; reserve expensive real-host evidence for host binding and cross-system behavior.
4. Stop when each material risk has an appropriate independent evidence source and additional testing would not change confidence meaningfully.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
