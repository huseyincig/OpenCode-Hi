---
name: hi-dependency-change
description: Evaluate and verify dependency/lockfile changes for necessity, compatibility, and security.
---

# Dependency Change

## Contract

- **Trigger:** A dependency or lockfile must be added, removed, or upgraded.
- **Do not trigger:** No dependency surface changes.
- **Exit condition:** Need, version/lock impact, compatibility, and appropriate verification are established.
- **Role affinity:** coder
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Start from the explicit task contract and current repository evidence.
2. Apply this methodology only to the smallest surface that satisfies its trigger.
3. Prefer deterministic evidence and existing project conventions over speculative generalization.
4. Stop when the exit condition is satisfied; do not take routing, topology, authority, completion, or STOP ownership.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
