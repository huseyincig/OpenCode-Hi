---
name: hi-source-driven-development
description: Inspect authoritative source before adapting an external implementation or methodology.
---

# Source-Driven Development

## Contract

- **Trigger:** External repository/specification/implementation is material to the requested change.
- **Do not trigger:** Task is fully internal and no external implementation evidence is relevant.
- **Exit condition:** Source, license, primitive, ownership, reuse action, and test strategy are recorded before reuse.
- **Role affinity:** researcher
- **Context cost:** medium
- **Execution cost:** medium

## Method

1. Identify the exact external fact that can materially change implementation and select the most authoritative current source: official docs, specification, upstream source, release/tag, or generated API contract.
2. Extract only the version-relevant behavior needed for the task and distinguish normative contract from examples, implementation detail, issues, or speculation.
3. Map that verified external behavior to the local integration points and record any version or capability assumptions that must remain explicit.
4. Stop when the implementation decision is supported by traceable current source evidence; do not retain third-party wording or architecture where only the behavior is needed.

## Ownership boundary

This skill owns methodology only. It does not select models, spawn agents, choose topology, expand authority, continue the mission, adjudicate completion, or issue STOP.
