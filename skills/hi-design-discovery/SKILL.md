---
name: hi-design-discovery
description: Resolve material product/architecture ambiguity before expensive implementation.
---

# Design Discovery

## Contract

- **Trigger:** Multiple materially different designs remain after repository evidence is considered.
- **Do not trigger:** Clear, low-risk, reversible implementation path exists.
- **Exit condition:** Material ambiguity is resolved into explicit constraints without unnecessary approval ceremony.
- **Role affinity:** architect
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Establish decision constraints from current repository behavior, user intent, compatibility, operability, and known non-goals before proposing designs.
2. Generate only materially different viable approaches; discard variants that differ cosmetically or violate established constraints.
3. Compare surviving approaches on ownership, complexity, migration cost, failure modes, extensibility, testability, and reversibility using repository evidence.
4. Stop when one approach is clearly preferred or the remaining trade-off requires an explicit human preference or authority decision.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
