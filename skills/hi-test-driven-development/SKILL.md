---
name: hi-test-driven-development
description: Use a failing test first when behavior can be specified economically before implementation.
---

# Test-Driven Development

## Contract

- **Trigger:** New/changed behavior benefits from executable specification and a tight red-green-refactor loop.
- **Do not trigger:** Pure documentation, exploratory diagnosis, or test-first cost exceeds value.
- **Exit condition:** Behavior is implemented with focused tests and no unnecessary test ceremony.
- **Role affinity:** test-engineer, coder
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Express the required behavior as the smallest failing executable example before changing implementation when the task permits a red-green loop.
2. Make the failure specific enough to prove the missing or incorrect behavior rather than environment noise or an unrelated assertion.
3. Implement the minimum behavior that makes the targeted example pass, then refactor only while preserving the new and relevant existing evidence.
4. Stop when the behavior is captured by durable tests at the correct boundary; do not manufacture tests that merely mirror implementation internals.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
