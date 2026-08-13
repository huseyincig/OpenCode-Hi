---
name: hi-ci-build-recovery
description: Isolate the first real CI/build failure and repair its root cause.
---

# CI and Build Recovery

## Contract

- **Trigger:** Build or CI fails or differs materially from local execution.
- **Do not trigger:** No build/CI failure exists.
- **Exit condition:** Failure class and root cause are identified, repaired when authorized, and the affected pipeline evidence is green or externally blocked.
- **Role affinity:** coder
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Locate the first meaningful failing CI or build signal and classify whether it is source, dependency, configuration, platform, permission, cache, flaky test, or infrastructure related.
2. Reproduce the relevant step as closely as practical using the project’s declared commands and environment contract; do not fix unrelated downstream failures first.
3. Repair the natural owner of the root cause and keep CI-specific workarounds out of product code unless the platform contract truly requires them.
4. Re-run the failing stage and its immediate dependent stages; stop when the pipeline evidence is green or the remaining external blocker is precise and non-product.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
