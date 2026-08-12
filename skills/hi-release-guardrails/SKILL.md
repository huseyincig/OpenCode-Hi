---
name: hi-release-guardrails
description: Verify release metadata, package integrity, evidence, and authority boundaries.
---

# Release Guardrails

## Contract

- **Trigger:** A release candidate, package, tag, publish, or distribution step is being prepared.
- **Do not trigger:** Ordinary development not approaching a release boundary.
- **Exit condition:** Candidate evidence is exact-bound and external publication remains explicitly authorized.
- **Role affinity:** working-manager
- **Context cost:** high
- **Execution cost:** high

## Method

1. Start from the explicit task contract and current repository evidence.
2. Apply this methodology only to the smallest surface that satisfies its trigger.
3. Prefer deterministic evidence and existing project conventions over speculative generalization.
4. Stop when the exit condition is satisfied; do not take routing, topology, authority, completion, or STOP ownership.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
