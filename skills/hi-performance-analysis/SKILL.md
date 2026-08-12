---
name: hi-performance-analysis
description: Analyze measurable performance behavior and compare changes on the same workload.
---

# Performance Analysis

## Contract

- **Trigger:** There is a performance target/regression or hot-path claim requiring evidence.
- **Do not trigger:** No measurable performance concern exists.
- **Exit condition:** Relevant baseline and after measurements support the conclusion without correctness regression.
- **Role affinity:** qa-reviewer
- **Context cost:** medium
- **Execution cost:** high

## Method

1. Start from the explicit task contract and current repository evidence.
2. Apply this methodology only to the smallest surface that satisfies its trigger.
3. Prefer deterministic evidence and existing project conventions over speculative generalization.
4. Stop when the exit condition is satisfied; do not take routing, topology, authority, completion, or STOP ownership.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
