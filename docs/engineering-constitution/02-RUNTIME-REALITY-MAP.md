# 02 — Current Runtime Reality Map

Status: PRELIMINARY SOURCE-GROUNDED

## Purpose

Map OpenCode-Hi as it actually executes today. This is not the desired metamodel and not a restatement of README claims. Each row identifies the current owner, producer/consumer path and real executor/host effect.

## Reality-state vocabulary

- DECLARED — type/config/prompt exists.
- IMPLEMENTED_LIBRARY — implementation exists as callable code.
- RUNTIME_WIRED — production code calls it.
- EXECUTION_REACHABLE — a normal mission can reach it.
- HOST_BOUND — it changes/uses a real OpenCode primitive.
- BEHAVIORALLY_VERIFIED — a test/probe proves representative effect.

Operational claims require the latter states relevant to that capability.

## Top-level runtime aggregate

`MissionState` is currently the central runtime aggregate. It contains semantic assessment, normalized intent/risk, primary/execution mode, topology, verification policy, obligations, tasks, workers, evidence, context artifacts, methodology needs, authority, release-chain state, blockers, continuation/stagnation data, mutations and ledger state.

DESIGN OBSERVATION:

This makes `MissionState` the runtime aggregate, but it should **not** become the canonical schema owner for Role, Methodology, Model, Evidence, Host Capability, Config, Workflow or other component classes. Those domains need independent contracts that MissionState references or snapshots.

## Runtime ownership graph

| Domain | Current owner(s) | Producer | Consumer / executor | Current reality |
|---|---|---|---|---|
| Semantic assessment | `runtime/intent/semantic-assessment.ts`, `hi_intent_assess` | host primary model returns bounded structured assessment | MissionStore/gates/routing | RUNTIME_WIRED + HOST_BOUND |
| Primary role identity | Role catalog + chat-message observed agent binding | real `chat.message.agent` or configured fallback | MissionState / system transform | HOST_BOUND; observed identity preserved |
| Role catalog | `runtime/roles/catalog.ts` | static Core catalog | TaskRuntime, TeamRuntime, hooks, obligation authority | RUNTIME_WIRED |
| Host agent projection | `roles/*.md` -> generator -> generated agent config + `opencode/agent-binding.ts` | generator/config hook | OpenCode agent registry/session create | HOST_BOUND; fail-closed collision checks |
| Capability routing | `runtime/routing/capability-router.ts` | structured normalized intent + execution profile | TaskRuntime default child role/category | RUNTIME_WIRED |
| Execution policy | `config/execution-policy.ts` | config mode + structured intent | TaskRuntime profile, continuation policy | RUNTIME_WIRED |
| Model routing | `runtime/routing/model-resolver.ts` | available models + project/native policy + feedback | TaskRuntime child create/prompt | HOST_BOUND; effective model metadata later verified |
| Model runtime verification | TaskRuntime `noteEffectiveModel` | OpenCode assistant metadata | blockers/ledger/completion gates | HOST_BOUND |
| Topology | `runtime/execution/topology-policy.ts` | structured intent + execution config | Mission execution mode/parallelism; TaskRuntime `canRun` | RUNTIME_WIRED; parallelism executable |
| Scheduler capacity | `runtime/scheduler/scheduler.ts` | worker/provider/model acquisition | TaskRuntime queue/dispatch/fallback | RUNTIME_WIRED |
| Task contract/runtime | `runtime/task/*` and TaskRuntime | parent control-plane tool inputs + mission policy | native child session + provider prompt | HOST_BOUND |
| Worker identity | mission helpers + TaskRuntime | task/model/role selection | registry/scheduler/results/recovery | RUNTIME_WIRED |
| Worker result | `runtime/task/result-parser.ts` + WorkerResult shape | child assistant output | TaskRuntime reconciliation/evidence/obligations | RUNTIME_WIRED; untrusted input |
| Obligation authority | mission obligations + `roleCanOwnObligation` | mission planning/assessment | TaskRuntime bind/close logic | RUNTIME_WIRED; explicit IDs cannot bypass role authority |
| Evidence | `runtime/evidence/evidence-ledger.ts` | worker/tool/result reconciliation | verification/completion | RUNTIME_WIRED |
| Completion | `runtime/completion/completion-evaluator.ts` | obligations/evidence/blockers/authority/tasks | mission status/continuation | deterministic runtime owner |
| Methodology catalog | canonical `data/hi-methodologies.json` -> generated policy + runtime catalog | generator/project admission | semantic methodology needs, native skill plan/load | RUNTIME_WIRED + HOST_BOUND |
| Methodology lazy load | skills native OpenCode surface / TaskRuntime plan | selected methodology need | child prompt/native skill permission | HOST_BOUND; selected != loaded tracked |
| Project methodology admission | `runtime/methodology/project-policy.ts`, PI methodology candidate owner | repeated project observations + provenance/hash | catalog/permissions | RUNTIME_WIRED |
| Context governor | `runtime/context/context-governor.ts` | mission survival/context lines | native compaction hook | HOST_BOUND through session compaction bridge |
| Semantic Context | language-specific extractor path | task-scoped TS/TSX sources | child handoff | RUNTIME_WIRED, bounded |
| Context artifacts | Mission refs + `ContextArtifactStore` | explicit context artifact tool | task-selected handoff only | RUNTIME_WIRED; default selection 0 |
| Durable artifact freshness | `runtime/context/artifact-store.ts` | source file bindings/mutations | selected handoff | RUNTIME_WIRED; stale long content suppressed |
| Project Intelligence | `runtime/project-intelligence/store.ts` | source-bound observations | file-intersection task handoff | RUNTIME_WIRED; not Evidence |
| Privacy boundary | `runtime/privacy/privacy-boundary.ts` | provider/retention content | child prompt/artifact store | RUNTIME_WIRED at provider/storage boundary |
| Shell safety | `runtime/process/shell-policy.ts` | bash args in tool-before | actual OpenCode bash invocation | HOST_BOUND: allow/rewrite/deny/user-action |
| Process lifecycle | host capability manifest | OpenCode currently lacks ordinary bash PID lifecycle in adapter | no fake ProcessGovernor | DEGRADED, intentionally not claimed operational |
| Workspace isolation execution | host capability manifest | no verified alternate-workspace child binding | no fake WorktreeRuntime | UNSUPPORTED on current adapter |
| Authority | `runtime/safety/authority.ts`, project/release authority owners | exact structured approval state | external-action gates | RUNTIME_WIRED |
| Release chain | `runtime/safety/release-chain.ts` | explicit external-action authority | release/external controls | RUNTIME_WIRED; no implicit release authority |
| Team | `runtime/team/team-runtime.ts` | parent explicit team create/member ops | canonical TaskRuntime workers | RUNTIME_WIRED; bounded worker group only |
| Team messaging/board | removed | none | none | RETIRED because no executor |
| Recovery | TaskRuntime continuation/fallback/recovery | failure classification + evidence | same worker/session or confirmed-abort fresh child | HOST_BOUND; fallback now abort-confirmed |
| Telemetry/ledger | runtime ledger/events/telemetry | all major policy/runtime transitions | diagnostics/recovery/tests | RUNTIME_WIRED |
| Persistence | `runtime/state/persistence.ts` + MissionStore restore | MissionState | restart/resume | RUNTIME_WIRED, exact current schema |
| Doctor | `plugin/src/doctor/*` | config/runtime/host inspection | user diagnostics | RUNTIME_WIRED but not execution owner |
| Setup CLI | `scripts/native_plugin_setup.py` | user setup choices | writes materialized policy/config | setup owner only; must not impersonate runtime decision owner |

## Current projection chain

Current role path:

```text
Hi role IDs / role Markdown
        ↓
agent generator
        ↓
generated OpenCode agent config
        ↓
plugin config hook / collision binding
        ↓
TaskRuntime role selection
        ↓
OpenCode child session agent field
        ↓
actual assistant metadata / result
```

Current methodology path:

```text
data/hi-methodologies.json
        ↓
generate_methodology_policy.py
        ↓
generated policy + SKILL.md catalog
        ↓
semantic methodology need
        ↓
TaskRuntime skill plan / permission map
        ↓
OpenCode native skill load
        ↓
methodology exit requirements / evidence
```

Current model path:

```text
available model inventory
+ project policy
+ native provider policy
+ role/category preferences
+ mission failure feedback
        ↓
resolveModel
        ↓
selected primary + fallbacks + variant
        ↓
OpenCode child creation/prompt
        ↓
observed effective model metadata
        ↓
verification/blocker/fallback
```

## Reality gaps that motivate the metamodel

1. Role canonical truth is improved but still split between Core catalog, role Markdown, generated host config and runtime policy.
2. `ExecutionProfile` is a runtime snapshot that combines task, model, methodologies, permissions, verification and context budgets; it is useful runtime state but not a substitute for the canonical contracts of those domains.
3. Config schema knows types/defaults but does not machine-declare owner/consumer/executor effect for each option.
4. Host capabilities are represented but not yet generated from a common HostCapabilityContract with acceptance requirements.
5. WorkerResult/Evidence/Review finding semantics are partly structured but not yet all derived from reusable component schemas/templates.
6. Current generator/validator architecture is subsystem-specific rather than driven by one component metamodel.
7. Documentation matrices remain partly hand-maintained projections.

## Stage gate

This document is PRELIMINARY until the component metamodel can mechanically verify at least representative role, methodology, config, model, host-capability and evidence paths.
