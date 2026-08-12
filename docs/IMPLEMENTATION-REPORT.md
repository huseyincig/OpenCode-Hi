# OpenCode-Hi 0.1.0 Implementation Report

## Baseline

OpenCode-Hi was evolved from the exact OpenCode-HHC-Orchestrator v58 baseline identified by commit `c4ded95d7ab58efab0efba398560f5b0cc1c9f94`. Baseline provenance is recorded in `docs/BASELINE-RECEIPT.md`. Before Hi-specific evolution, the preserved baseline passed 358 Node tests, 41 Python tests, and the source validator in the available local environment. Historical v58 external receipts are retained as provenance only and do not satisfy changed 0.1.0 runtime gates.

## Product migration

The canonical identity is `OpenCode-Hi`, package `opencode-hi`, release line `0.1.x`, current candidate `0.1.0`, repository `huseyincig/OpenCode-Hi`. Public skill identities were migrated from `hhc-*` to `hi-*`. Historical old-product identifiers remain only where technically required for exact baseline provenance, attribution, license obligations, or immutable historical receipts. OpenCode-Hi provides no legacy product compatibility surface.

## Source reuse

The complete source-level decision record is `docs/SOURCE-REUSE-MATRIX.md`. The v58 control plane is the root baseline. Permissively licensed reference projects were used only for bounded primitive adaptation where useful. `opencode-dynamic-context-pruning` is clean-room behavioral/test inspiration because of AGPL constraints. `type-inject` is clean-room/idea-derived because copying permission was not established. The supplied Supermemory source is idea-only for the optional memory-provider boundary. No foreign MissionState, completion, STOP, authority, global routing, or continuation owner was imported.

## Final architecture

Implemented responsibility owners are documented in `docs/ARCHITECTURE-REALITY-MAP.md` and audited in `data/validation/architecture-audit-0.1.0.json`. The implementation keeps separate responsibility families for Mission/Task/Worker, Evidence, Authority, Completion, Autopilot/Continuation, Adaptive Execution, Context, Runtime, Human Decision, Host capability boundaries, and Telemetry. No second agent runtime or mega-orchestrator was introduced.

## Autopilot

The existing continuation runtime remains first-class. It evaluates mission state, obligations, active work, evidence freshness, authority, failure/recovery state and completion rather than treating agent idle or a model “done” message as completion. STOP remains owned by deterministic completion semantics.

## Adaptive execution

The adaptive policy implements separate role, skill, model/tool, execution-depth, context-depth, and isolation-depth decisions. Execution paths are `DIRECT`, `EVIDENCE`, `PLANNED`, and `ESCALATED`. Topology is a decision layer only; native host execution remains behind the OpenCode adapter boundary. Direct local work is benchmarked as single-agent/default-zero-skill without planning/review fan-out.

## Agents and models

Role, agent instance, model, and topology remain separate concepts. The configuration/routing surface supports adaptive behavior and explicit project overrides. Single-agent multi-role behavior remains valid; multi-agent behavior is benefit-gated; repeated role/model mapping is bounded by project policy. Explicit task/user policy takes precedence over adaptive selection, which takes precedence over host defaults where supported.

## Skills

There are 29 canonical `hi-*` skills. Each was recalibrated with trigger, do-not-trigger, exit, role affinity, context/execution cost and composition data in `data/skill-profiles.json`. Default skill activation remains zero. Lazy skill resources are path-scoped and traversal-safe; orchestration ownership remains outside skills.

## Context

Mission survival state remains protected from transcript pressure. The Context Governor distinguishes `PROTECTED`, `COMPRESSIBLE`, and `PURGEABLE` context and may return NOOP. Project Intelligence stores bounded evidence-backed patterns with freshness invalidation. The first Semantic Context adapter extracts scoped TypeScript interfaces/types/classes/functions/enums instead of injecting full source/dependency trees.

## Knowledge assimilation

External material is classified into project knowledge, architecture/policy, reusable methodology, or temporary evidence. Reusable methodology is merged into an existing skill when overlapping; a new skill is appropriate only for a distinct reusable HOW capability with trigger/do-not-trigger/exit semantics. Runtime self-modifying skills are not implemented.

## Privacy

Provider-facing task prompts pass through the local Privacy Boundary. Synthetic secret tests cover redaction behavior, and plaintext secret mappings are not intentionally written to ledger/telemetry/artifacts/mission state. Local knowledge is not assumed to be provider knowledge.

## Human intelligence

The Human Value Gate filters non-material questions. Authority, preference, ambiguity, annotation, visual decisions and batched questions are separate semantics. Active user messages support `INTERRUPT`, `QUEUE`, and `SIDEBAND`; low-risk reversible work does not require approval spam.

## Runtime

Filesystem hygiene is enforced: durable project-local Hi data is confined to `.opencode/hi/`, OpenCode-native capability directories remain OpenCode-owned, package installation does not unpack Hi source into consumer repository roots, and transient lifecycle journals use OS temporary/runtime locations. Uninstall removes the Hi plugin registration and setup-owned policy/provenance surfaces while preserving durable Project Intelligence, retained artifacts, project-created OpenCode skills, unrelated `.opencode` content, and unrelated project files/configuration. Mission-survival state is project-keyed but stored in the OS/OpenCode state area because it is runtime data with restart-survival requirements, not durable project knowledge.

Mission budgets bound turns/model/tool/delegation/context/planning/verification/review dimensions. Failure classes and materially-different retry prevent generic retry loops. The Process Governor tracks long-running process lifecycle and cleanup. Adaptive isolation can remain in the current workspace or use a standard Git worktree when justified. Shell policy prefers safe non-interactive execution and does not fake OAuth/credential approval.

## Memory

Memory is optional behind a provider boundary. Core correctness does not depend on a remote memory service. Memory may guide retrieval but may not satisfy verification or replace current repository evidence/MissionState.

## Host

OpenCode is the 0.1.x reference host. Core semantic types are separated from the host capability manifest. The adapter uses native host primitives where available and Hi may restrict but must not expand host authority. In the current build environment the `opencode` binary is unavailable; therefore exact 0.1.0 native loader, child-session, provider/model binding and permission-denial receipts remain `PENDING_EXTERNAL`. Full Codex/Claude Code/Cursor adapters are intentionally deferred.

## Telemetry and efficiency

Privacy-safe execution telemetry covers execution shape without recording raw secret payloads. Derived metrics include execution cost proxy, wasted compute ratio, human attention efficiency, and context efficiency. `data/validation/benchmarks-0.1.0.json` covers all nine required scenarios as deterministic in-process policy simulations. It does not claim real provider token billing or model/OpenCode latency.

## Verification

Current local acceptance consists of the complete Node suite, Python suite, source validator, local lifecycle receipt, architecture audit, benchmark receipt, worktree/process/privacy/context/topology acceptance and deterministic release build. Exact current counts are intentionally not hard-coded into long-lived release-gate contracts; the command results are the fresh evidence. Historical v58 receipts remain separate.

## Release

Local release engineering produces deterministic source/distributable ZIPs, release manifest, dependency SBOM, supply-chain digest and hash binding. Two independent builds must be byte-identical after the final source change. Commit, push, tag and release publication are user-owned in this development session and were not performed. Exact Git-ref and external-host receipts can only be bound after the user creates the corresponding local Git identity and runs the required host lab.

## Remaining gaps

There are no known blocking internal source findings in the current architecture audit. Release readiness is still blocked by external evidence: exact OpenCode-Hi Git-ref native plugin loading, native child-session/provider/model/permission runtime verification, Windows runtime smoke, and external clean-consumer/supply-chain installation verification. Optional remote memory, additional semantic-language adapters, remote telemetry, external sandbox backends, full alternate-host adapters, MCP gateway expansion, and per-model methodology rendering are deferred and do not block the coherent 0.1.0 core.


## Storage Ownership

A capability-driven storage audit is recorded in `STORAGE-ARCHITECTURE.md`, `STORAGE-OWNERSHIP-MATRIX.md`, and `SKILL-ARTIFACT-OWNERSHIP.md`. Canonical project policy and setup provenance are durable Hi-owned stores. Project Intelligence and long-form artifacts persist lazily only when retention is materially useful and a project root is supplied. Project-created skills use OpenCode-native `.opencode/skills/<skill>/`. Runtime state, redaction mappings, process state, caches, and transient context transforms do not become project-visible durable storage.
