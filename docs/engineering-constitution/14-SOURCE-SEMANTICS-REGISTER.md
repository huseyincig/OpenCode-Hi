# 14 — Source Adoption / Rejection Register

Status: PASS-1 COMPLETE — SOURCE SEMANTICS CLASSIFIED

## Purpose

Record the semantic decision made for every studied source. A source may inspire architecture without becoming product truth. This register prevents future contributors from re-importing deliberately rejected behavior merely because it exists upstream.

## Decision vocabulary

- **ADOPT** — semantic pattern is compatible with Hi and should become part of the target architecture.
- **ADAPT** — engineering pattern is useful, but Hi-specific ownership/authority/capability semantics must replace source-specific assumptions.
- **REFERENCE ONLY** — source is useful for comparison or implementation technique but does not define a target component semantic.
- **REJECT** — semantics conflict with Hi invariants and must not be restored.
- **HOLD** — source/version evidence is unresolved; no architecture decision may depend on it.

These decisions apply to semantics, not licenses. Reuse/copy boundaries remain governed separately by source license and the existing source-reuse matrix.

## Register

| Source | Decision | Adopt / adapt | Explicit rejection / boundary |
|---|---|---|---|
| OpenCode-HHC-Orchestrator v58 | ADOPT behavior / ADAPT structure | proven mission, continuation, task-worker, review, recovery, authority and completion behavior remains regression baseline | v58 file layout and duplicate owners are not constitutional |
| opencode-dynamic-context-pruning | ADAPT | strict config schema, protected context, structural dedupe identity, explicit pruning state, model-specific context constraints | AGPL implementation is not copied; numeric defaults and broad user knobs are not Hi laws |
| OpenAgentsControl | ADAPT | product metadata separate from host-valid frontmatter; parity/registry concept | natural-language approval/authority keyword detection is REJECTED; foreign role/category ontology is REJECTED |
| agentic | HOLD | none until supplied archive/version is identified | current public tree must not be substituted for the missing referenced path |
| opencode-type-inject | ADAPT | extractor/formatter/lookup/prioritizer separation; budgeted semantic enrichment; call-ID correlation | TypeScript kinds are adapter semantics, not Core ontology; auto-inject-every-read is not adopted |
| opencode-vibeguard | ADAPT | provider-boundary privacy transformation, stable placeholder identity, overlap-safe redaction | regex/keyword security patterning must not become user-intent/authority routing |
| opencode-supermemory | REFERENCE ONLY / ADAPT optional adapter | capture/recall/compaction/privacy separation | remote memory is not Core truth; recalled memory is never proof or authority |
| opencode-skillful | ADAPT | registry readiness/admission/resource manifest/lazy body loading | last-one-wins canonical collision semantics are REJECTED; search is not selection authority |
| plannotator | ADAPT | human-decision bridge cancellation/resume lifecycle and integration testing | mandatory plan approval/annotation is REJECTED |
| octto | ADAPT | typed interaction forms and response schemas | `confirm` does not equal external-action Authority; UI catalog is not product ontology |
| OpenCode-goal-plugin (willytop8) | ADAPT | untrusted completion claim boundary, bounded criteria/checks/limitations, explicit not-run | worker completion claims do not own deterministic Mission completion |
| opencode-goal-plugin (Prevalentware) | ADAPT | versioned durable state, atomic write/rename, bounded history/checkpoints, no-progress persistence | second Goal/Mission state machine and source numeric defaults are REJECTED |
| opencode-background-agents | ADAPT | artifact-first child outputs, structured lifecycle, observed host agent facts | competing task/orchestration runtime is REJECTED |
| opencode-pty | ADAPT capability reference | explicit spawn/write/read/list/kill lifecycle and cleanup ownership | PTY runtime is not universal; ordinary bash must not be falsely reported as process-observable |
| opencode-worktree | ADAPT | isolation identity + state + launch binding + cleanup + fail-loud validation | worktree directory creation alone is not isolation proof; OCX launch machinery is not Core |
| opencode-shell-strategy | ADAPT | typed ALLOW/REWRITE/USER_ACTION_REQUIRED/DENY concept; fail-fast non-interactive safety | instruction prose and command example table cannot be sole enforcement/classifier |
| OCX | ADAPT | canonical component ID, revision, file hashes, owner, receipt/integrity model | legacy compatibility architecture and registry ontology are not adopted |
| opencode-plugin-template | REFERENCE ONLY | reusable setup/template governance | archived scaffold/API assumptions do not define current host behavior |
| opencode-md-table-formatter | REJECT CORE | none for metamodel | formatting utility has no Core architecture authority |
| obra/superpowers | ADAPT methodology engineering | harness-agnostic HOW, real host bootstrap, behavioral methodology testing, worktree HOW, expected-turn/cost thinking | fixed orchestration ownership and unconditional approval gates are REJECTED |
| opencode-agent-orchestration-kit | ADAPT | portable contract + host projection + checker; structured task/result/verification; explicit barriers/evidence/authority | its commands/workflows/role catalog are not Hi ontology; fixed agent count is not Hi topology policy |
| OpenCode upstream | ADOPT host facts / REJECT product ownership | actual agent schema, permission composition, model/variant/mode/steps and host primitives are authoritative adapter facts | built-in agent names/config merge do not define Hi Role/Evidence/Authority/Methodology semantics |

## Cross-source constitutional semantics

### S1 — canonical product contract is upstream of host projection

ADOPTED from the convergence of OpenAgentsControl, orchestration-kit, OCX and OpenCode upstream:

```text
Hi Contract -> Host Projection -> Host Execution -> Observation -> Validation
```

The host projection may encode only host-valid fields. Richer Hi semantics remain in the canonical contract/catalog.

### S2 — operational claims require real executors

ADOPTED from OpenCode upstream, PTY, Worktree and Superpowers harness guidance.

A component cannot claim a capability because a prompt, config flag, directory or helper exists. It must identify a runtime consumer and a host/runtime primitive that produces an observable effect.

### S3 — methodology HOW is not runtime WHETHER and not host CAN

ADOPTED from Superpowers and Skillful, reinforced by Hi Stage-1 behavior.

```text
Runtime Policy -> WHETHER
Methodology -> HOW
Host Capability -> CAN
```

### S4 — human interaction is not authority

ADOPTED from Octto's structured interaction pattern while explicitly rejecting OpenAgentsControl-style natural-language approval inference.

Authority must be exact-action-bound and validated separately from preference, confirmation, or free text.

### S5 — results and completion are untrusted until reconciled

ADOPTED from both goal-plugin sources and the orchestration kit.

WorkerResult/CompletionClaim is input. Deterministic Mission/Obligation/Evidence reconciliation owns final completion.

### S6 — long-lived or large child output becomes artifact/reference

ADOPTED from background-agents, reinforced by DCP/context-budget patterns.

Parent context receives the minimum sufficient handoff. Artifact identity, provenance and retrieval lifecycle remain separately modeled.

### S7 — state with lifecycle significance is typed, bounded and safely persisted

ADOPTED from Prevalentware goal state and OCX receipt/integrity patterns.

Durable state must have a schema/version, explicit storage owner and safe write semantics. Transcript replay is not persistence.

### S8 — generated/derived truth must be mechanically comparable to canonical truth

ADOPTED from orchestration-kit checker, OpenAgentsControl metadata separation and OCX hashes.

Generated agents/docs/receipts/config projections should carry source contract identity/hash where useful and must fail validation on semantic drift.

## Explicit permanent rejects

The following are not temporary omissions; restoring them requires an ADR that explicitly supersedes this register:

1. natural-language keyword/regex classification of user intent, negation, approval or authority;
2. prompt-only enforcement when a deterministic/runtime invariant is available;
3. last-one-wins collision for canonical Hi component IDs;
4. treating host agent names as Hi Role ontology;
5. treating generic confirmation as external-action authority;
6. claiming process/worktree/team/capability semantics without a real executor;
7. making optional remote memory a completion/evidence authority;
8. importing foreign fixed workflow/agent catalogs as Hi defaults without minimum-sufficient policy evidence.

## Hold ledger

### agentic

Status remains **HOLD**. The supplied source matrix references `src/cli/metadata.ts`, but that path is absent from the verified current public tree. No `ArtifactContract` or metadata lifecycle field in this program is justified by agentic until the intended archive/commit is recovered.

This hold does not block the constitution because Artifact semantics are independently grounded by current Hi runtime, background-agents, OCX provenance patterns and existing ContextArtifactStore behavior.
