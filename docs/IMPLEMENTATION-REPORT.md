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

Execution concerns are independently owned: role routing, methodology selection, model/tool routing, topology, context, and isolation do not share a synthetic decision owner. The adaptive execution policy owns only the executable path `DIRECT | EVIDENCE | PLANNED | ESCALATED`; topology parallelism is consumed by TaskRuntime, while context and isolation remain owned by their dedicated subsystems. Direct local work is benchmarked as single-agent/default-zero-methodology without planning/review fan-out.

## Agents and models

Role, agent instance, model, and topology remain separate concepts. The configuration/routing surface supports adaptive behavior and explicit project overrides. Role-model setup metadata records how mappings were generated, while runtime routing consumes the resulting mappings/constraints rather than a decorative setup mode. Single-agent multi-role behavior remains valid; multi-agent behavior is benefit-gated; repeated role/model mapping is bounded by project policy. Explicit task/user policy takes precedence over adaptive selection, which takes precedence over host defaults where supported.

## Methodologies and OpenCode skills

There are **27 built-in canonical `hi-*` methodologies**. Each has trigger, do-not-trigger, activation signals, exit requirements, role compatibility, context/execution cost, weight, composition cost, coexistence/conflict metadata, and resource requirements in `data/hi-methodologies.json`. Default methodology activation is zero; typical work uses 0–1 methodology and composition is hard-bounded at 3. On OpenCode, selected methodology content is loaded lazily through the native `skill` primitive. Host skill discovery does not itself grant Hi auto-selection authority.

## Context

Mission survival state remains protected from transcript pressure. The Context Governor distinguishes `PROTECTED`, `COMPRESSIBLE`, and `PURGEABLE` context and may return NOOP. Project Intelligence stores bounded evidence-backed patterns with freshness invalidation. The first Semantic Context adapter extracts scoped TypeScript interfaces/types/classes/functions/enums instead of injecting full source/dependency trees.

## Knowledge and project methodology learning

Project facts belong to Project Intelligence, proof belongs to Evidence, reusable HOW may become a methodology candidate, and control decisions belong to Hi Runtime Policy. Runtime does not classify arbitrary prose with a keyword heuristic. Project methodology learning accepts only structured methodology observations bound to fresh task evidence, requires repeated independent observations before READY, and admits a `hi-project-*` methodology only through coherent native SKILL + Hi policy + hash-bound provenance. One observation never creates a methodology.

## Privacy

Provider-facing task prompts pass through the local Privacy Boundary. Synthetic secret tests cover redaction behavior, and plaintext secret mappings are not intentionally written to ledger/telemetry/artifacts/mission state. Local knowledge is not assumed to be provider knowledge.

## Human intelligence

Natural-language user meaning is handled by the host primary model and submitted to the bounded, host-agnostic Hi Semantic Assessment contract. Runtime policy consumes validated structured state rather than language-specific prose classifiers. Authority remains a separate safety protocol and native permission boundary; low-risk reversible work does not require approval spam.

## Runtime

Filesystem hygiene is enforced: durable project-local Hi data is confined to `.opencode/hi/`, OpenCode-native capability directories remain OpenCode-owned, package installation does not unpack Hi source into consumer repository roots, and transient lifecycle journals use OS temporary/runtime locations. Uninstall removes the Hi plugin registration and setup-owned policy/provenance surfaces while preserving durable Project Intelligence, retained artifacts, project-created OpenCode skills, unrelated `.opencode` content, and unrelated project files/configuration. Mission-survival state is project-keyed but stored in the OS/OpenCode state area because it is runtime data with restart-survival requirements, not durable project knowledge.

Mission budgets bound turns/model/tool/delegation/context/planning/verification/review dimensions. Failure classes and materially-different retry prevent generic retry loops. OpenCode process lifecycle for ordinary model-facing bash is currently degraded and alternate-workspace child execution is unsupported. OpenCode 1.18.16 does expose a separate PTY lifecycle and workspace/session binding primitives, but Hi does not promote those primitives to product support without owned routing/provisioning/cleanup and execution-binding proof. Browser execution is likewise unsupported despite MCP/tool discovery. Shell policy remains operational and non-interactive.

## Memory

Memory is optional behind a provider boundary. Core correctness does not depend on a remote memory service. Memory may guide retrieval but may not satisfy verification or replace current repository evidence/MissionState.

## Host

OpenCode is the 0.1.x reference host. Core semantic types are separated from the host capability manifest. The adapter uses native host primitives where available and Hi may restrict but must not expand host authority. The current controlled host exposes OpenCode `1.18.16`. Real-host receipts remain exact-source-bound: earlier M12/current-worktree observations prove only the source they actually tested and must be refreshed for a changed host-bound candidate. Full Codex/Claude Code/Cursor adapters are intentionally deferred.

## Telemetry and efficiency

Privacy-safe execution telemetry covers execution shape without recording raw secret payloads. Derived metrics include execution cost proxy, wasted compute ratio, human attention efficiency, and context efficiency. `data/validation/benchmarks-0.1.0.json` covers all nine required scenarios as deterministic in-process policy simulations. It does not claim real provider token billing or model/OpenCode latency.

## Verification

Current local acceptance consists of the complete Node suite, Python suite, source validator, local lifecycle receipt, architecture audit, benchmark receipt, worktree/process/privacy/context/topology acceptance and deterministic release build. Exact current counts are intentionally not hard-coded into long-lived release-gate contracts; the command results are the fresh evidence. Historical v58 receipts remain separate.

## Release

Local release engineering produces deterministic source/distributable ZIPs, release manifest, dependency SBOM, supply-chain digest and hash binding. Two independent builds must be byte-identical after the final source change. Local checkpoint commits are used as development provenance. Push, tag and release publication remain user-owned external actions and were not performed. Exact Git-ref and external-host receipts can only be bound after the user creates the corresponding local Git identity and runs the required host lab.

## Remaining gaps

There are no known blocking internal source findings in the current architecture audit. Release readiness still depends on exact-candidate external evidence. Optional remote memory, additional semantic-language adapters, remote telemetry, adoption of a distinct PTY process-control executor, first-class workspace-isolation policy/binding, deterministic browser execution, external sandbox backends, alternate-host adapters, MCP expansion, and per-model methodology rendering remain deferred; unsupported host capabilities are reported instead of faked.


## Storage Ownership

A capability-driven storage audit is recorded in `STORAGE-ARCHITECTURE.md`, `STORAGE-OWNERSHIP-MATRIX.md`, and `SKILL-ARTIFACT-OWNERSHIP.md`. Canonical project policy and setup provenance are durable Hi-owned stores. Project Intelligence and long-form artifacts persist lazily only when retention is materially useful and a project root is supplied. Project-created skills use OpenCode-native `.opencode/skills/<skill>/`. Runtime state, redaction mappings, process state, caches, and transient context transforms do not become project-visible durable storage.

Model routing feedback is bounded to the current Mission and current role/category. The runtime derives a newest-12 terminal-worker window with confidence thresholds, observed success/failure/retries, structured verification outcome, and timestamp-derived latency when available. Sparse feedback cannot manufacture routing credit, and no permanent global model reputation is persisted.
