---
name: hi-accessibility-review
description: Check user-interface changes for material accessibility regressions.
---

# Accessibility Review

## Contract

- **Trigger:** UI behavior or markup changed and accessibility can be affected.
- **Do not trigger:** No user-facing UI surface changed.
- **Exit condition:** Accessibility risks are checked and actionable findings are resolved or recorded.
- **Role affinity:** visual-qa
- **Context cost:** low
- **Execution cost:** low

## Method

1. Check keyboard access and visible focus.
2. Verify labels, semantic roles, alternatives, and obvious contrast/state issues.
3. Use automated findings as evidence, not as an automatic PASS.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
