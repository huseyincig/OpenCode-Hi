---
name: hi-regression-review
description: Check likely neighboring behavior affected by a changed contract or shared component.
---

# Regression Review

## Contract

- **Trigger:** A change can plausibly affect existing consumers/shared behavior, or regression-focused review is explicitly requested.
- **Do not trigger:** Change is isolated with no dependent behavior.
- **Exit condition:** Likely regressions are covered by existing or targeted tests; scope does not expand speculatively.
- **Role affinity:** qa-reviewer
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Identify which existing consumers, shared state, invariants, or previously supported flows could be affected by the changed surface.
2. Trace dependency, call, and contract edges outward only until the plausible regression boundary is closed; prioritize reused code and implicit defaults over unrelated repository breadth.
3. Validate representative prior behavior with existing tests, targeted new evidence, or concrete consumer inspection and distinguish compatibility risk from hypothetical possibility.
4. Stop when plausible regression paths are either proven safe, covered by corrective work, or recorded as explicit unresolved risk.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
