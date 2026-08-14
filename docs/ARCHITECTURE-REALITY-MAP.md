# v58 Architecture Reality Map

This map records actual v58 owners before OpenCode-Hi adds new responsibilities.

| Responsibility | Existing owner |
|---|---|
| Mission / obligations / core mission types | `plugin/src/runtime/mission/mission-store.ts`, `mission/types.ts` |
| Task lifecycle / worker result application | `runtime/task/task-runtime.ts`, `runtime/task/contracts.ts` |
| Worker lifecycle | `runtime/worker/worker-runtime.ts`, `runtime/background/registry.ts` |
| Intent normalization / repository hints | `runtime/intent/normalize.ts`, `runtime/intent/repo-context.ts` |
| Execution mode | `runtime/routing/execution-mode.ts` |
| Routing / model resolution / capability routing | `runtime/routing/**` |
| Skills registry / methodology injection | `runtime/skills/registry.ts`, `runtime/skills/methodology.ts` |
| Context budget / survival | `runtime/context/budget.ts`, `hooks/session-compacting.ts`, `runtime/state/snapshot.ts` |
| Evidence freshness / mutation invalidation | `runtime/evidence/evidence-runtime.ts`, verification modules |
| Authority / idempotent external actions | `runtime/safety/authority.ts`, `idempotency.ts`, `project-authority.ts`, `release-chain.ts` |
| Autopilot decision | `runtime/continuation/evaluator.ts`, `runtime/continuation/recovery.ts` |
| Continuation dispatch | `runtime/continuation/dispatcher.ts` |
| Completion / STOP adjudication | `runtime/completion/evaluator.ts` |
| Persistence | `runtime/state/persistence.ts`, `runtime/state/snapshot.ts` |
| Scheduler / parallel safety | `runtime/scheduler/**` |
| Verification policy / discovery | `runtime/verification/**` |
| Setup / reconfiguration / doctor | `plugin/src/config/**`, `plugin/src/doctor/**`, `scripts/native_plugin_setup.py` |
| Release / package verification | `scripts/release-build.py`, `scripts/validate.py`, Python release tests |
| OpenCode host integration | `plugin/src/opencode/**`, `plugin/src/plugin.ts` |
| Runtime process handling | Ordinary bash uses shell/tool lifecycle only; OpenCode 1.18.18 PTY is a separate native executor and is not currently adopted as Hi process ownership |
| Workspace isolation | Hi owns IsolationDecision/WorkspaceLease + WorkspaceRuntime/OpenCodeWorkspaceAdapter and exact OpenCode 1.18.18 T3 proves source-bound worktree provisioning, child workspace routing, isolated write/verification, primary preservation, cleanup, restart adoption and orphan quarantine |
| Telemetry | Bounded Mission ledger/state is canonical operational history; metrics/report/status are derived diagnostics, not a second telemetry event store |

Architecture freeze consequence: OpenCode-Hi should evolve these owners instead of introducing duplicate orchestration layers. New modules are justified only for responsibilities that are genuinely absent (for example first-class Process Governor, Project Intelligence, Semantic Context, Privacy Boundary, and Human Decision semantics).
