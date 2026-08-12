---
name: hhc-adversarial-validation
description: Use when a high-stakes or non-trivial claim would benefit from a fresh, bounded attempt to disprove assumptions before completion.
---

# Adversarial Validation

Challenge high-risk decisions and artifacts with a compact disproof-oriented review; do not use it as universal ceremony.

## Method
1. Extract the smallest reviewable artifact and its explicit contract. Do not pass the author’s persuasive reasoning as context.
2. Look for unstated assumptions, edge cases, hidden coupling/shared state, contract violations, compatibility failures, irreversible blast radius, and unsupported claims.
3. Reconcile findings against the actual artifact/contract; classify them as actionable, accepted trade-off, contract/context problem, or noise.
4. Fix actionable findings in the owning task/session and perform scoped re-verification.
5. Bound the loop. If substantive problems persist after a small number of cycles, decompose or surface a real blocker instead of infinite reviewer ping-pong.

Use mainly for critical/security/irreversible/cross-boundary decisions. Do not spawn fresh reviewers for mechanical low-risk edits.
