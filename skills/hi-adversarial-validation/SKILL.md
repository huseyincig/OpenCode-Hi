---
name: hi-adversarial-validation
description: Run a bounded disproof-oriented challenge for high-stakes claims or decisions.
---

# Adversarial Validation

## Contract

- **Trigger:** Critical, security-sensitive, irreversible, or cross-boundary claim needs independent challenge.
- **Do not trigger:** Mechanical or low-risk work with direct evidence.
- **Exit condition:** Material assumptions are challenged and findings are reconciled without an open blocking issue.
- **Role affinity:** qa-reviewer
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. State the important claim to disprove and enumerate the strongest realistic assumptions, boundary conditions, misuse paths, and counterexamples that would invalidate it.
2. Attack the claim with evidence from independent code paths, failure injection, contradictory inputs, alternate consumers, or boundary cases proportionate to risk.
3. Treat a found counterexample as evidence to reconcile, not as a reason to expand scope indefinitely; distinguish product defect from unsupported requirement.
4. Stop when material attack paths are exhausted for the stated risk or one unresolved counterexample blocks the claim.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
