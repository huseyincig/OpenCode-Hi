---
name: hi-visual-qa
description: Validate changed visual output for layout, clipping, state, and responsive regressions.
---

# Visual QA

## Contract

- **Trigger:** Visual UI rendering/styling changed materially, or visual QA is explicitly requested.
- **Do not trigger:** No visual surface changed.
- **Exit condition:** Relevant viewports/states are checked and visual defects are resolved or recorded.
- **Role affinity:** visual-qa
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Identify the exact user-visible states affected by the change, including relevant breakpoints, themes, loading/error/empty states, and interaction states.
2. Exercise only the affected visual surfaces using the best available rendering/browser evidence and compare layout, clipping, hierarchy, responsiveness, and state transitions against the intended contract.
3. Separate cosmetic preference from functional visual regressions; record concrete viewport/state evidence for material findings.
4. Stop when affected visual states are checked and blocking regressions are resolved or explicitly recorded with reproducible evidence.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
