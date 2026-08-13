---
name: hi-debugging-root-cause
description: Turn a symptom into evidence-backed root cause through discriminating experiments.
---

# Root-Cause Debugging

## Contract

- **Trigger:** Failure cause is uncertain, repeated, or crosses boundaries.
- **Do not trigger:** Cause is already direct and proven by local evidence.
- **Exit condition:** Root cause is demonstrated or a precise external blocker is established; retries are materially different.
- **Role affinity:** coder
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Reproduce or characterize the failure precisely, separating deterministic product behavior from environment, permission, transport, or stale-state noise.
2. Trace backward from the first trustworthy failing signal through state and ownership boundaries until the earliest incorrect assumption or transition is found.
3. Form a falsifiable root-cause hypothesis and test it with the smallest discriminating observation before modifying code.
4. Fix the natural owner of the defect, then re-run the original failure path plus the nearest regression boundary; stop when cause and fix are both evidenced.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
