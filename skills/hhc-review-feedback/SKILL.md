---
name: hhc-review-feedback
description: Use when acting on reviewer findings, pull-request comments, QA/security findings, or other proposed corrective changes that must be verified before implementation.
---

# Review Feedback Reconciliation

Treat review feedback as evidence to evaluate, not instructions to blindly obey.

## Method
1. Parse each finding into a concrete technical claim and affected scope.
2. Verify the claim against current code, tests, contracts, platform/version constraints, and prior user decisions.
3. Classify it as valid-actionable, valid-tradeoff, context/contract misunderstanding, or noise.
4. Resolve unclear or contradictory findings before applying dependent changes.
5. Apply valid changes one bounded item at a time and run scoped verification after each meaningful fix.
6. If the finding is technically wrong, retain the evidence supporting rejection instead of changing correct code.

Prefer same-task/same-session corrective resume. Do not create reviewer↔coder ping-pong or broaden scope for speculative “professionalization.”
