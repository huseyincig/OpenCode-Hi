---
name: hi-iterative-retrieval
description: Grow repository context only when current evidence creates a concrete information need.
---

# Iterative Retrieval

## Contract

- **Trigger:** Relevant symbols/paths are not known and bounded retrieval can reduce uncertainty.
- **Do not trigger:** Required context is already known and fresh.
- **Exit condition:** Task can execute or blocker is precise without further context expansion.
- **Role affinity:** repository-explorer
- **Context cost:** low
- **Execution cost:** low

## Method

1. Form one decision-changing retrieval question at a time.
2. Read/search the smallest symbol/path surface that answers it.
3. Compact the result into facts and paths before retrieving more.
4. Stop expanding context when execution or a precise blocker is possible.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
