# opencode-background-agents

Status: VERIFIED STUDY PASS 1

## Identity

- Canonical repository: `kdcokenny/opencode-background-agents`
- Reference action: ADAPT

## Source surfaces inspected

- `src/plugin/background-agents.ts`

## Verified source facts

- Delegation is represented by a structured record containing root/child sessions, agent, status, timestamps, progress, notification, retrieval and artifact persistence state.
- Outputs are persisted to artifacts and parent context receives compact references/metadata.
- Lifecycle distinguishes registered/running/complete/error/cancelled/timeout.
- Agent capability/mode is queried from the host at the boundary.

## Useful engineering patterns

- Artifact-first child result handoff prevents context inflation.
- Notification, retrieval and artifact persistence are different lifecycle dimensions.
- Actual host agent capability should be observed, not assumed from local naming.

## Foreign / accidental semantics to reject

- Hi must not replace the native task/session runtime with a competing background orchestration engine.
- LLM-generated artifact metadata is optional presentation, not canonical artifact identity.

## Hi mapping

- Supports ContextArtifactStore + bounded WorkerResult + runtime worker/session identity.
- Team/background abstractions must remain projections over canonical TaskRuntime rather than alternate task runtimes.
