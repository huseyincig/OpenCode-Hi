# Architecture

OpenCode HHC Orchestrator (OHO), OpenCode-native runtime primitive'leri üzerinde ince bir orchestration control plane'dir.

## HHC contract

`WHO + WHEN + MODEL + COST + TASK + STATE + EVIDENCE + STOP`

OHO owns mission/obligation state, routing, model/cost policy, task/worker coordination, evidence freshness, authority, continuation, completion adjudication and STOP.

OpenCode owns sessions/child sessions, agents/skills, permissions, providers/models, tools, diffs/events and compaction/runtime primitives.

HHC Native Skills own **methodology/HOW only**. They never become a second router, scheduler or completion owner.

## Execution levels

- Level 1: direct/single; default.
- Level 2: bounded parallel native workers only for proven independence.
- Level 3: Team Mode; exceptional and bounded.

## Skill runtime

Packaged `skills/*/SKILL.md` files are registered through OpenCode native skill discovery. HHC chooses zero or the minimum necessary methodology set per worker (normally 0–1, maximum 3). Child context embeds only selected methodology and keeps HHC control-plane tools unavailable.

## Completion

`agent idle != mission done` and `model says DONE != mission done`. Completion requires closed obligations, no pending/unreconciled workers, required fresh evidence, resolved blockers/authority, and runtime CompletionAdjudicator approval.
