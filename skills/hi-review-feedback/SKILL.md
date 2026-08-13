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

1. Normalize each review comment into a concrete claim: defect, risk, requested change, question, or preference, preserving its original scope.
2. Verify the claim against current source and evidence before changing code; reject stale or incorrect feedback with concise evidence instead of complying mechanically.
3. Group coupled findings so one fix does not create contradictory edits, then implement only accepted actionable changes at their natural owner.
4. Re-check the original findings after the change and stop when each item is resolved, rejected with evidence, or remains a precise blocker.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
