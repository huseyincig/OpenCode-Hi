# 01 — Source Architecture Study

Status: PASS-1 COMPLETE WITH ONE SOURCE-VERSION HOLD

## Purpose

Study every project already listed in `docs/SOURCE-REUSE-MATRIX.md`, plus the explicitly supplied methodology/agent references, at source level. README descriptions are orientation only; architectural decisions require source/config/schema/test evidence.

## Classification vocabulary

- VERIFIED SOURCE FACT
- INFERENCE
- DESIGN DECISION
- USEFUL ENGINEERING PATTERN
- ACCIDENTAL IMPLEMENTATION DETAIL
- FOREIGN PRODUCT SEMANTIC
- REUSABLE HI CONCEPT
- REJECTED FOREIGN SEMANTIC

## Mandatory study dimensions

For each source, inspect where available:

- role and agent model;
- permissions and delegation;
- model selection/fallback;
- methodology/skill discovery and loading;
- task/handoff/result contracts;
- workflow/barriers/completion authority;
- context and artifact handling;
- evidence/review semantics;
- recovery/retry/process lifecycle;
- workspace/isolation semantics;
- storage/provenance;
- schemas/catalogs/templates;
- generators/projections;
- validators/acceptance tests;
- license and reuse boundary.

## Project inventory

The canonical starting inventory is `docs/SOURCE-REUSE-MATRIX.md`. Source-level study rows will be added below as repositories are verified.

| Source | Matrix action | Study status | Notes |
|---|---|---|---|
| OpenCode-HHC-Orchestrator v58 | DIRECT_PORT | VERIFIED LOCAL BASELINE | Root behavioral baseline; detailed comparison pending in this program. |
| opencode-dynamic-context-pruning | CLEAN_ROOM | VERIFIED STUDY PASS 1 | Context pruning/compression patterns. |
| OpenAgentsControl | ADAPT | VERIFIED STUDY PASS 1 | Context/repository pattern system. |
| agentic | ADAPT | SOURCE VERSION HOLD | Artifact/document lifecycle. |
| type-inject | CLEAN_ROOM | VERIFIED STUDY PASS 1 | Semantic type/interface extraction. |
| opencode-vibeguard | ADAPT | VERIFIED STUDY PASS 1 | Secret classification/redaction. |
| opencode-supermemory | IDEA_ONLY | VERIFIED STUDY PASS 1 | Optional memory semantics. |
| opencode-skillful | ADAPT | VERIFIED STUDY PASS 1 | Lazy skill registry/resource resolution. |
| plannotator | ADAPT | VERIFIED STUDY PASS 1 | Human annotation/decision lifecycle. |
| octto | ADAPT | VERIFIED STUDY PASS 1 | Structured questions/responses. |
| OpenCode-goal-plugin (willytop8) | ADAPT | VERIFIED STUDY PASS 1 | Budgets/continuation/no-progress. |
| OpenCode goal plugin (Prevalentware) | ADAPT | VERIFIED STUDY PASS 1 | Typed checkpoints/recovery. |
| opencode-background-agents | ADAPT | VERIFIED STUDY PASS 1 | Artifact-first child result handoff. |
| opencode-pty | ADAPT | VERIFIED STUDY PASS 1 | Process lifecycle/cleanup. |
| opencode-worktree | ADAPT | VERIFIED STUDY PASS 1 | Worktree safety/platform behavior. |
| opencode-shell-strategy | ADAPT | VERIFIED STUDY PASS 1 | Non-interactive shell safety. |
| OCX | ADAPT | VERIFIED STUDY PASS 1 | Capability profiles/config integrity. |
| opencode-plugin-template | ADAPT | VERIFIED STUDY PASS 1 | Plugin/package/publish hygiene. |
| opencode-md-table-formatter | REJECT | VERIFIED NOT CORE | No core architectural value. |
| obra/superpowers | METHODOLOGY REFERENCE | VERIFIED STUDY PASS 1 | Skill authoring, behavioral skill tests, worktree HOW, model-tier guidance. |
| opencode-agent-orchestration-kit | AGENT/CONTRACT REFERENCE | VERIFIED STUDY PASS 1 | Agent contracts, orchestration-contracts schema, harness validator, role-specific permissions. |
| OpenCode upstream | REFERENCE HOST | VERIFIED STUDY PASS 1 | Real agent/config/permission/model primitive surface; host facts, not product ontology. |

## Initial verified patterns from the two newly inspected repositories

### opencode-agent-orchestration-kit

VERIFIED SOURCE FACT:
- maintains explicit agent frontmatter with mode/permissions/skill/task delegation;
- maintains a separate machine-readable `orchestration-contracts.json` describing agents, commands, routing rules, retry policies, workflows, barriers, completion authority, and evidence;
- has `check-harness.mjs` mechanically compare contract declarations with actual agent frontmatter/delegation;
- uses structured Task Contract, Result Contract and Verification Envelope conventions;
- separates final general reviewer authority from partial/specialist review.

USEFUL ENGINEERING PATTERN:
- canonical portable contract + host projection + mechanical parity validator;
- explicit completion authority and workflow barriers;
- role-specific permission surfaces;
- minimum handoff/context quarantine.

FOREIGN PRODUCT SEMANTIC:
- several command-triggered fixed workflows and role names are specific to that kit; Hi must not inherit them as its product ontology.

### obra/superpowers

VERIFIED SOURCE FACT:
- treats skill bodies as harness-agnostic behavior-shaping content and maps actions to host tools at the harness boundary;
- requires real harness bootstrap/discovery rather than pretending files on disk are operational;
- `writing-skills` treats methodology authoring as behavioral engineering with baseline/counterexample pressure tests;
- `using-git-worktrees` is a safe HOW procedure, not a universal isolation control plane;
- subagent-development guidance explicitly considers model tier, task complexity, turn count and context isolation.

USEFUL ENGINEERING PATTERN:
- behavior-shaping methodology is separate from mechanical runtime enforcement;
- host capability truth must be proven by the integration, not assumed;
- model selection should consider expected completion cost, not only token price.

REJECTED FOREIGN SEMANTIC:
- unconditional human approval gates or fixed orchestration ownership that conflict with Hi authority/minimum-attention semantics are not adopted merely because they exist upstream.

## Pass-1 coverage result

The source records are now split under `sources/`. Every reference in the supplied matrix has a record, plus `obra/superpowers`, `opencode-agent-orchestration-kit`, and OpenCode upstream.

Current exception:

- `agentic`: the matrix-provided path `src/cli/metadata.ts` does not exist in the current public `transitive-bullshit/agentic` main tree. The record is explicitly `SOURCE VERSION MISMATCH — NEEDS ARCHIVE RESOLUTION`. No design decision may claim that source until the supplied archive/commit is recovered.

This is an evidence hold, not a skipped source.

## Cross-source engineering conclusions — Pass 1

VERIFIED SOURCE PATTERN:

1. **Product contract and host projection should be separate.** OpenAgentsControl separates OpenCode-valid frontmatter from richer metadata; the orchestration kit separately declares portable orchestration contracts; OpenCode upstream has a strict host Agent schema.
2. **Operational capability must be backed by a real host/runtime primitive.** Superpowers porting guidance, opencode-pty, opencode-worktree, and OpenCode upstream all reinforce this.
3. **State with lifecycle significance should be typed/versioned and written safely.** The Prevalentware goal plugin, OCX receipts and background-agent records are strong examples.
4. **Long child results should become artifacts/references, not parent transcript bulk.** Background-agents demonstrates artifact-first delegation; DCP and type-inject independently reinforce context-budget discipline.
5. **Human interaction shape and authority are different concepts.** Octto provides typed interaction forms; OpenAgentsControl demonstrates why natural-language approval detection is unsafe for Hi authority.
6. **Methodology content and runtime orchestration must remain separate.** Superpowers makes skill bodies harness-agnostic while harness integration maps actions to real tools.
7. **Schemas and validators should make drift expensive.** DCP schemas, OCX receipts/hashes, orchestration-contracts + check-harness, and skillful registry parsing all support this.
8. **Model cost is trajectory cost, not token price alone.** Superpowers subagent guidance and Hi's existing expected-turn/failure feedback both point toward capability/turn-aware routing.

DESIGN DIRECTION (not yet final constitution):

`Canonical Hi Contract -> generated/validated projections -> runtime executor -> host primitive -> evidence` should become the standard shape for material component classes.
