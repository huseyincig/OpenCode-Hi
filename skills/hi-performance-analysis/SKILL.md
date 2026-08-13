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

1. Define the performance claim or target and choose an observable metric at the real bottleneck boundary before optimizing.
2. Establish a reproducible baseline and isolate where time, memory, I/O, allocation, contention, or repeated work is actually spent.
3. Change the smallest proven bottleneck, preserving behavior, then re-measure under comparable conditions and inspect secondary regressions.
4. Stop only when measured evidence supports the claimed improvement or a precise external or environmental limitation is documented.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
