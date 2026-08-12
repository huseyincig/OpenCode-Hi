---
name: hi-security-review
description: Review authority, secrets, trust boundaries, input handling, and attack surface proportionally.
---

# Security Review

## Contract

- **Trigger:** Security-sensitive code, permissions, credentials, external actions, or trust boundaries changed.
- **Do not trigger:** No material security surface changed.
- **Exit condition:** Material threats are addressed or explicitly accepted with evidence; secrets are not exposed.
- **Role affinity:** security-reviewer
- **Context cost:** high
- **Execution cost:** high

## Method

1. Identify authority, trust, secret, input, persistence, and external-action boundaries touched by the change.
2. Test realistic misuse and failure paths using synthetic secrets/data.
3. Prefer concrete findings tied to code/contracts over generic checklists.
4. Do not expand host authority or bypass explicit denial.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
