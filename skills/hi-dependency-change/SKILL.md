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

1. Prove the dependency change is necessary and identify the exact capability or version constraint, current lock state, transitive impact, and runtime/build surfaces it affects.
2. Prefer the smallest compatible version or scope change and inspect authoritative compatibility information when behavior can differ by version.
3. Update manifest and lockfile through the project’s native package workflow, then verify install, build, test behavior, and unexpected transitive changes.
4. Stop when the dependency graph is intentional, reproducible, minimally changed, and no unexplained package or install-script side effect remains.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
