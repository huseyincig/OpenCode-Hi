# Storage Ownership Matrix

| Capability | Producer | Consumer | Artifact type | Scope | Owner | Class | Persistence | Version-controlled? | Sensitive? | Freshness / invalidation | Final storage | Cleanup owner |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OpenCode plugin registration | setup/OpenCode | OpenCode resolver | package spec | PROJECT/GLOBAL | OpenCode | canonical config | durable | project choice | no | config edit | `opencode.json` or OpenCode global config | OpenCode/setup |
| Packaged Hi skills | package build | OpenCode skill discovery | methodology/resources | PACKAGE | skill/OpenCode | canonical package | durable | yes, source package | no | package version | package `skills/hi-*` / OpenCode-native discovery | package manager |
| Packaged Hi agents | package build | OpenCode agent config | agent definitions | PACKAGE | OpenCode/Hi adapter | canonical package | durable | yes, source package | no | package version | package/config hook; no consumer copy | package manager |
| Project routing policy | runtime auto-init / explicit project reconfigure | config resolver | routing/model policy | PROJECT | Hi project routing policy | canonical | durable | optional | no | explicit edit/reconfigure | `.opencode/hi/policy/routing.json` | project routing policy owner/user |
| Project authority projection | native always approval | permission adapter | authority grants | PROJECT | Hi authority | canonical policy | durable | **no recommended** | security-sensitive authority, no secret | native approval/change | `.opencode/hi/policy/authority.json` | Authority owner/user |
| Setup ownership provenance | installer | doctor/upgrade/uninstall/rollback | active registration ownership/source binding | PROJECT | Hi setup | canonical provenance | durable while installed | optional | no | install/upgrade/rollback/uninstall | `.opencode/hi/provenance/setup.json` | Hi setup lifecycle |
| Setup transaction journal | installer | recover/doctor | operation/spec/hash/index metadata only; no config body | PROJECT | Hi setup | transient recovery | only while interrupted/in-flight | no | no secret/config body | transaction completion/recovery | `.opencode/hi/provenance/setup-transaction.json` | Hi setup recovery |
| Setup rollback point | installer | rollback/doctor | one prior registration/ownership transition; no config body | PROJECT | Hi setup | bounded recovery | exactly one latest point | optional | no secret/config body | replaced by next setup mutation or consumed by rollback | `.opencode/hi/provenance/setup-rollback.json` | Hi setup lifecycle |
| Mission survival state | runtime | runtime restore/continuation | mission/task/evidence state | RUNTIME keyed to project | Hi runtime | ephemeral with restart survival | bounded durable runtime | **no** | may contain operational context; secret persistence forbidden | each mutation/shutdown; schema-bound | OS state area `/opencode-hi/projects/<hash>/runtime-state.json` | runtime/doctor |
| Process state | ProcessGovernor | continuation/cleanup | pid/status/cleanup policy | SESSION | Hi runtime | ephemeral | memory | no | potentially operational | process exit/mission end | memory only | ProcessGovernor |
| Privacy redaction map | Privacy Boundary | local restoration | secret token map | REQUEST/SESSION | Hi privacy | sensitive ephemeral | memory | no | **yes** | request completion | memory only | Privacy Boundary |
| Context governor transform | Context Governor | provider/session | compacted context | SESSION | Hi context | derived/ephemeral | memory/host context | no | possibly sensitive before redaction | source/context change | host/session context | session |
| Semantic TypeScript extraction | Semantic Context | execution/context | types/signatures/contracts | MISSION | Hi semantic context | derived | current in-memory only | no | source-dependent | source hash/change | memory; no durable index in 0.1.0 | semantic provider |
| Project Intelligence patterns | Project Intelligence | retrieval/policy | evidence-backed patterns | PROJECT | Hi PI | derived reusable | lazy durable when project root supplied; otherwise memory | optional/project choice | no secrets permitted | source hash/change => `POTENTIALLY_STALE` | `.opencode/hi/project-intelligence/patterns/<id>.json` when retained | PI store |
| Project methodology candidates | methodology learning | methodology admission/catalog | evidence-bound reusable-HOW candidate | PROJECT | Hi methodology learning | derived reusable | lazy durable | optional/project choice | no secrets permitted | observation/admission lifecycle | `.opencode/hi/project-intelligence/methodology-candidates/<id>.json` | ProjectMethodologyLearningStore |
| Project methodology policy/provenance | authorized project methodology authoring | methodology admission/catalog | admission policy + hash-bound provenance | PROJECT | project methodology | canonical | durable | optional/project choice | no secrets permitted | explicit authoring/update | `.opencode/hi/policy/methodologies/<name>.json` + `.opencode/hi/provenance/methodologies/<name>.json` | project methodology owner/user |
| Project methodology skill | authorized project methodology authoring | OpenCode skill discovery / TaskRuntime | OpenCode-native SKILL.md/resources | PROJECT | OpenCode project skill | canonical | durable | optional/project choice | project content | explicit authoring/update | `.opencode/skills/hi-project-<purpose>/` | OpenCode/project owner/user |
| Knowledge assimilation decision | classifier | PI/skill/evidence owner | classification decision | MISSION/PROJECT | Hi knowledge | derived | memory unless explicit repo mutation | no | source-dependent | source/provenance change | owner-specific; no generic knowledge dump | receiving owner |
| Context artifact durable backing | Context owner | context/review consumers | long result + hash | MISSION/PROJECT | Hi Context | derived durable | lazy durable when project root supplied; otherwise memory | optional/project choice | payload-dependent; privacy boundary applies before retention | source-file invalidation | `.opencode/hi/artifacts/<semantic-kind>/<id>.json` when retained | ContextArtifactStore |
| Mission context artifact refs | runtime tool | mission/context | bounded URI/hash/summary refs | MISSION | Hi mission | derived runtime | mission survival state | no | summaries must be privacy-safe | mission lifecycle/source hash | runtime state only | runtime |
| Memory provider metadata | optional provider | retrieval policy | memory records | USER/PROJECT | provider | derived/historical | provider-owned | no | potentially sensitive | provider lifecycle | provider-specific, not `.opencode/hi/` | memory provider |
| Telemetry | runtime | offline analysis | bounded execution metrics | SESSION/RUN | Hi telemetry | derived | in-memory/local receipt only | no | privacy-safe only | run/candidate | memory or explicit validation receipts | telemetry/release |
| Benchmarks | benchmark script | release audit | deterministic summary | BUILD | Hi validation | derived evidence | durable build receipt | yes if curated validation data | no | source/candidate change | validation/release workspace | validation |
| Release ZIP/manifest/SBOM | release-build | release audit/user | build artifacts | RELEASE | Hi release | derived candidate | durable release | no in consumer project | no secrets | source candidate change invalidates | release output workspace | release owner |
| Human decision state | mission/authority | continuation | authority/preference/interrupt state | MISSION | Hi mission | canonical runtime decision | mission survival only | no | may be sensitive | user message/decision | runtime state, privacy filtered | runtime |
| Worktree isolation | Hi Mission execution + future Git/OpenCode adapter | task runtime | isolated workspace | TASK | Hi IsolationDecision/WorkspaceLease policy + Git/OpenCode mechanism | runtime capability | temporary git worktree | WorkspaceLease metadata in existing runtime-state only; no second worktree DB | project code | task/mission cleanup | configured worktree location, never Hi project data | isolation owner |
| External docs/repositories | user/tools | assimilation/retrieval | source evidence | MISSION/PROJECT | source/tool | canonical external source | source-location owned | no implicit copy | source-dependent | source hash/version | original source or explicit artifact; never generic dump | source/artifact owner |

## Supplied reference storage behavior audit

The supplied reference repositories were reviewed for storage behavior as part of source-reuse analysis. Their layouts are **not** copied wholesale into OpenCode-Hi.

| Reference | Storage behavior relevant to Hi | Hi decision |
|---|---|---|
| Dynamic Context Pruning | session/context transforms and pruning state | CLEAN_ROOM behavior only; transforms remain session-scoped, no project cache tree |
| OpenAgentsControl | repository/project context and durable project conventions | adapt evidence/freshness concepts; Hi Project Intelligence now persists lazily with source-hash invalidation when a project root is supplied |
| Agentic | durable research/document metadata | adapt provenance/artifact lifecycle concepts; no foreign workflow directory tree |
| type-inject | generated semantic/type context | CLEAN_ROOM extraction; derived output remains disposable/in-memory in 0.1.0 |
| VibeGuard | local redaction/session mappings | mappings remain memory-only and never project-visible |
| Supermemory | remote/provider memory data | provider-owned optional storage; no local mirror under `.opencode/hi/` |
| Skillful | skill-local references/scripts/assets | preserve ownership with each `hi-*` skill; no generic knowledge mirror |
| Plannotator / Octto | human review/question state | mission/authority state only; no copied annotation workspace layout in core 0.1.0 |
| Goal plugins | goal/checkpoint persistence | useful budget semantics integrated into MissionState; no duplicate goal-state store |
| Background Agents | long-result/artifact handoff | use Hi artifact references; no second artifact database |
| PTY | process/session state | ProcessGovernor state stays memory/runtime-owned, not project durable data |
| Worktree | worktree directories | Git/OpenCode mechanism owns directory bytes; Hi persists only `WorkspaceLease` metadata in the existing Mission runtime-state and creates no `.opencode/hi/worktrees/` mirror/store |
| Shell Strategy | no required durable data | methodology/policy only |
| OCX | profiles/config/integrity data | bounded Hi capability policy only; no imported foreign config hierarchy |
| Plugin Template | build/release files | release workspace only; never consumer project runtime storage |

This audit follows the rule **port behavior, not accidental filesystem layout**.

## Skill-driven ownership result

The complete 27-methodology capability/output audit is recorded in `docs/SKILL-ARTIFACT-OWNERSHIP.md`. It confirms that no skill-specific Hi storage tree is needed: project-created skills use OpenCode-native `.opencode/skills/`, while retained knowledge/artifacts converge on the shared semantic owners above.
