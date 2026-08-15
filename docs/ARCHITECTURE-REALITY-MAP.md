# Architecture Reality Map

This document answers a narrow current-truth question: **where does each major OpenCode-Hi product responsibility actually live, what consumes/executes it, and what proof guards it?**

It is not a second semantic catalog. The runtime/contracts listed below remain the canonical owners; this table is generated from the reconstruction trace inventory.

## Product truth trace

<!-- BEGIN GENERATED PRODUCT TRUTH TRACE -->
Generated from `data/validation/product-truth-inventory.json`. This is a trace projection, not a semantic owner.

| Area | Canonical owner | Owner source | Consumer/executor | Proof | Canonical doc |
|---|---|---|---|---|---|
| `mission` | MissionStore | `plugin/src/runtime/mission/mission-store.ts` | `plugin/src/runtime/task/task-runtime.ts` | `plugin/test/mission.test.mjs`<br>`plugin/test/a3-mission-slices.test.mjs` | `docs/ARCHITECTURE.md` |
| `task-runtime` | TaskRuntime | `plugin/src/runtime/task/task-runtime.ts` | `plugin/src/runtime/task/child-execution-coordinator.ts`<br>`plugin/src/runtime/task/task-result-reconciler.ts`<br>`plugin/src/runtime/task/task-recovery-coordinator.ts` | `plugin/test/task-worker-contract.test.mjs`<br>`plugin/test/a2-task-runtime-collaborators.test.mjs` | `docs/ARCHITECTURE.md` |
| `worker` | WorkerRuntime | `plugin/src/runtime/worker/worker-runtime.ts` | `plugin/src/runtime/task/task-result-reconciler.ts` | `plugin/test/task-worker-contract.test.mjs`<br>`plugin/test/worker-result-contract.test.mjs` | `docs/ARCHITECTURE.md` |
| `roles-permissions` | RoleContract + PermissionProfileContract | `data/hi-roles.json` | `plugin/src/opencode/agent-binding.ts` | `plugin/test/stage2-role-contract.test.mjs`<br>`plugin/test/agent-binding-contract.test.mjs` | `docs/ARCHITECTURE.md` |
| `methodologies-skills` | MethodologyContract | `data/hi-methodologies.json` | `plugin/src/runtime/methodology/activation.ts`<br>`plugin/src/runtime/methodology/native-loading.ts` | `plugin/test/methodology-signal-contract.test.mjs`<br>`plugin/test/c7-skill-catalog-index.test.mjs` | `docs/SKILLS.md` |
| `routing-models` | Hi routing/model resolver | `plugin/src/runtime/routing/model-resolver.ts` | `plugin/src/runtime/task/task-runtime.ts` | `plugin/test/profile-system.test.mjs`<br>`plugin/test/per-role-routing-runtime.test.mjs` | `docs/EXECUTION-POLICY.md` |
| `configuration` | Hi config catalog/resolver | `data/hi-config-options.json` | `plugin/src/plugin.ts` | `plugin/test/config.test.mjs`<br>`plugin/test/config-option-contract.test.mjs`<br>`plugin/test/config-executable-effect.test.mjs` | `docs/INSTALLATION.md` |
| `authority` | AuthorityContract/runtime | `plugin/src/contracts/authority.ts` | `plugin/src/runtime/application/hi-tool-surface.ts`<br>`plugin/src/runtime/process/authority.ts` | `plugin/test/authority-contract.test.mjs`<br>`plugin/test/authority-side-effect-idempotency.test.mjs` | `docs/HUMAN-DECISIONS.md` |
| `external-actions-release` | ExternalAction + release chain | `plugin/src/contracts/external-action.ts` | `scripts/release-build.py`<br>`.github/workflows/npm-publish.yml` | `plugin/test/real-hosted-release-transaction.test.mjs`<br>`plugin/test/r1-npm-oidc-workflow.test.mjs` | `docs/RELEASE.md` |
| `human-decisions` | HumanDecisionContract/runtime | `plugin/src/contracts/human-decision.ts` | `plugin/src/plugin.ts` | `plugin/test/human-decision-contract.test.mjs`<br>`plugin/test/h1-human-decision-transport.test.mjs` | `docs/HUMAN-DECISIONS.md` |
| `context` | ContextGovernor | `plugin/src/runtime/context/governor.ts` | `plugin/src/hooks/session-compacting.ts`<br>`plugin/src/runtime/task/task-runtime.ts` | `plugin/test/context-survival-hardening.test.mjs`<br>`plugin/test/c4-context-budget-estimator.test.mjs` | `docs/CONTEXT.md` |
| `semantic-context` | SemanticContextAdapter | `plugin/src/runtime/semantic/adapter.ts` | `plugin/src/runtime/task/task-runtime.ts` | `plugin/test/c6-semantic-context-adapter.test.mjs` | `docs/CONTEXT.md` |
| `project-intelligence` | ProjectIntelligence store/retrieval | `plugin/src/runtime/project-intelligence/store.ts` | `plugin/src/runtime/task/task-runtime.ts` | `plugin/test/c5-project-intelligence-hybrid-retrieval.test.mjs` | `docs/PROJECT-INTELLIGENCE.md` |
| `evidence-verification` | EvidenceRuntime + VerificationEnvelope | `plugin/src/runtime/evidence/evidence-runtime.ts` | `plugin/src/runtime/task/task-result-reconciler.ts`<br>`plugin/src/runtime/completion/evaluator.ts` | `plugin/test/verification-envelope-contract.test.mjs`<br>`plugin/test/evidence-freshness-ordering.test.mjs` | `docs/VERIFICATION.md` |
| `completion-continuation` | Completion + continuation | `plugin/src/runtime/completion/evaluator.ts` | `plugin/src/runtime/application/runtime-event-controller.ts` | `plugin/test/flow-consistency.test.mjs`<br>`plugin/test/continuation-evaluator-wide-batch.test.mjs` | `docs/VERIFICATION.md` |
| `process` | ProcessContract/Runtime | `plugin/src/contracts/process.ts` | `plugin/src/opencode/open-code-pty-adapter.ts` | `plugin/test/p1-process-contract.test.mjs`<br>`plugin/test/p2-opencode-pty-executor.test.mjs` | `docs/HOSTS.md` |
| `workspace-isolation` | IsolationDecision/WorkspaceLease/Runtime | `plugin/src/contracts/workspace.ts` | `plugin/src/opencode/open-code-workspace-adapter.ts` | `plugin/test/w1-workspace-contract.test.mjs`<br>`plugin/test/w2-workspace-executor.test.mjs` | `docs/HOSTS.md` |
| `browser` | BrowserObservation/Runtime | `plugin/src/contracts/browser-observation.ts` | `plugin/src/opencode/playwright-browser-adapter.ts` | `plugin/test/b1-browser-observation-contract.test.mjs`<br>`plugin/test/b3-playwright-browser-runtime.test.mjs`<br>`plugin/test/b3-methodology-exit-evidence.test.mjs` | `docs/HOSTS.md` |
| `host-port` | OpenCodeHostPort | `plugin/src/opencode/host-port.ts` | `plugin/src/plugin.ts` | `plugin/test/a6-host-port-typing.test.mjs` | `docs/HOSTS.md` |
| `persistence-storage` | Mission persistence + storage ownership | `plugin/src/runtime/state/persistence.ts` | `plugin/src/runtime/mission/mission-store.ts` | `plugin/test/a4-persistence-validator-composition.test.mjs`<br>`plugin/test/storage-ownership-contract.test.mjs` | `docs/STORAGE-ARCHITECTURE.md` |
| `install-lifecycle` | native_plugin_setup.py | `scripts/native_plugin_setup.py` | `project-opencode-config` | `tests/test_hi.py` | `docs/INSTALLATION.md` |
| `privacy` | PrivacyBoundary | `plugin/src/runtime/privacy/boundary.ts` | `plugin/src/runtime/task/task-runtime.ts` | `plugin/test/hi-core-evolution.test.mjs` | `docs/PRIVACY.md` |
| `scheduler` | ConcurrencyScheduler | `plugin/src/runtime/scheduler/concurrency.ts` | `plugin/src/runtime/task/task-runtime.ts` | `plugin/test/scheduler-hardening.test.mjs` | `docs/BENCHMARKS.md` |
| `telemetry` | Mission-derived ledger metrics | `plugin/src/runtime/ledger/ledger.ts` | `plugin/src/runtime/telemetry/benchmarks.ts` | `plugin/test/ledger-status-metrics.test.mjs`<br>`plugin/test/hi-benchmarks.test.mjs` | `docs/BENCHMARKS.md` |
<!-- END GENERATED PRODUCT TRUTH TRACE -->

## Reading the trace

- **Owner** is the canonical source/catalog that owns the meaning.
- **Consumer/executor** is the downstream code path that makes the meaning operational.
- **Proof** names executable checks; the existence of a source file alone is not support evidence.
- **Canonical doc** is the current explanatory owner for that meaning.

For host-bound process/workspace/browser support, this map does not replace exact T3 receipts. See `data/validation/compatibility-matrix-0.1.0.json` and [Host Support](HOSTS.md).

## Cross-cutting reality rules

Hi owns `ProcessContract` + `ProcessRuntime` + `OpenCodePtyAdapter` for the bounded process-lifecycle surface; arbitrary native/model-facing shell jobs outside that ownership are not retroactively owned.

1. `MissionStore` remains the durable Mission owner; TaskRuntime/Team/host adapters do not create parallel mission state.
2. `TaskRuntime` is the application facade; child execution, reconciliation and recovery are collaborators, not second schedulers.
3. OpenCode adapter code stays below normalized Hi contracts/ports.
4. Generated role/methodology/config/support projections do not own the product semantics they represent.
5. Project Intelligence, Context, BrowserObservation and model prose do not become Evidence by resemblance.
6. Restart adopts exact owned native identity or quarantines it; ambiguous continuity is not guessed.
7. Setup/rollback acts only on Hi-owned registration state and preserves unrelated user configuration.
8. Release status and host support are receipt-derived; development HEAD is not silently equated with an old immutable tag.

## Failure and recovery ownership

| Failure class | Canonical response |
|---|---|
| Worker/task execution failure | classify through Worker/Task recovery owner; bounded retry/fallback only when policy allows |
| stale/late child callback | reject/quarantine against current Task/Worker generation; never overwrite newer state |
| process identity mismatch after restart | mark `ORPHANED`/quarantine; do not signal a mismatched PID |
| workspace lease missing/mismatched | quarantine/fail closed; required isolation does not recreate/fall back silently |
| browser runtime unhealthy | remove executable browser resource and fail preflight before child spawn |
| verification evidence stale after mutation | invalidate affected proof; completion remains open |
| setup transaction interrupted | block new mutation until `recover`; reconcile only recorded before/after hashes |
| rollback after user config drift | refuse rollback rather than overwrite user changes |
| external publication/auth unavailable | remain externally blocked; never convert local readiness into T4 |

The architectural target is not “more managers.” It is one coherent product-control plane with explicit ownership, bounded adapters and proof-backed capability claims.
