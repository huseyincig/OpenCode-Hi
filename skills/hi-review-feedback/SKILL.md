---
name: hi-review-feedback
description: Validate review findings against current code and apply only evidence-backed corrections.
---

# Review Feedback Reconciliation

## Contract

- **Trigger:** Review/QA/security feedback proposes changes.
- **Do not trigger:** No external review findings need reconciliation.
- **Exit condition:** Each finding is classified and actionable ones are fixed and scoped-verified.
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
